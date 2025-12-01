from typing import List, Dict, Any, Optional, Tuple
import json
from datetime import datetime
from prisma import Prisma
from embedding_service import EmbeddingService
from config_service import config_service
import config

class DocumentStore:
    def __init__(self):
        # Prisma client is managed globally in api.py, but we can instantiate one here if needed
        # or better, pass it in. For now, we'll use a new instance but expect connection to be managed externally
        # or we can use the global one. To keep it simple and consistent with existing pattern,
        # we will assume the global prisma instance is connected.
        from auth import prisma
        self.db = prisma
        self.embedding_service = EmbeddingService()

    async def add_document(self, user_id: int, content: str, metadata: Dict[str, Any] = None, group_id: Optional[int] = None) -> int:
        """Add a document to the store. Generates embedding and saves both content and vector."""
        if metadata is None:
            metadata = {}

        # 1. Generate embedding
        embedding = self.embedding_service.get_embedding(content)
        if not embedding:
            raise ValueError("Failed to generate embedding for document")

        # 2. Insert document with vector
        # Prisma doesn't support vector types natively in create(), so we use execute_raw
        # or we can use create() for metadata and then update with raw sql for vector.
        # But execute_raw is more efficient for a single insert.

        # However, to get the ID back easily and handle JSON correctly, let's try a hybrid approach:
        # Create document first without embedding, then update it.
        # OR better: use execute_raw to do it in one go.

        # Note: Prisma's execute_raw returns number of affected rows, not the ID.
        # So we use query_raw to get the ID.

        metadata_json = json.dumps(metadata)
        embedding_str = f"[{','.join(map(str, embedding))}]"

        if group_id:
            query = """
                INSERT INTO "Document" ("userId", "content", "metadata", "embedding", "groupId", "updatedAt")
                VALUES ($1, $2, $3::jsonb, $4::vector, $5, NOW())
                RETURNING id
            """
            result = await self.db.query_raw(query, user_id, content, metadata_json, embedding_str, group_id)
        else:
            query = """
                INSERT INTO "Document" ("userId", "content", "metadata", "embedding", "updatedAt")
                VALUES ($1, $2, $3::jsonb, $4::vector, NOW())
                RETURNING id
            """
            result = await self.db.query_raw(query, user_id, content, metadata_json, embedding_str)

        if not result:
            raise Exception("Failed to insert document")

        return result[0]['id']

    async def search(
        self,
        user_id: int,
        query: str,
        threshold: float,
        limit: int = 10,
        offset: int = 0,
        group_id: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Search for similar documents using vector similarity with pagination.
        
        Args:
            user_id: The user ID
            query: The search query
            threshold: Distance threshold (1 - similarity)
            limit: Maximum number of results
            offset: Offset for pagination
            group_id: Optional group ID to filter results
        
        Returns:
            Tuple of (results list, total count)
        """
        query_embedding = self.embedding_service.get_embedding(query)
        if not query_embedding:
            return [], 0

        embedding_str = f"[{','.join(map(str, query_embedding))}]"

        # We use cosine distance (<=> operator in pgvector).
        # Distance = 1 - Cosine Similarity.
        # So if we want similarity >= 0.8, we want distance <= 0.2.

        if group_id is not None:
            # Search within a specific group
            sql = """
                SELECT
                    id,
                    content,
                    metadata,
                    (embedding <=> $1::vector) as distance
                FROM "Document"
                WHERE "userId" = $2
                  AND "groupId" = $3
                  AND (embedding <=> $1::vector) <= $4
                ORDER BY distance ASC
                LIMIT $5 OFFSET $6
            """
            results = await self.db.query_raw(
                sql, embedding_str, int(user_id), int(group_id), float(threshold), int(limit), int(offset)
            )

            count_sql = """
                SELECT COUNT(*)::int as count
                FROM "Document"
                WHERE "userId" = $1
                  AND "groupId" = $2
                  AND (embedding <=> $3::vector) <= $4
            """
            count_result = await self.db.query_raw(
                count_sql, user_id, group_id, embedding_str, threshold
            )
        else:
            # Search all documents
            sql = """
                SELECT
                    id,
                    content,
                    metadata,
                    (embedding <=> $1::vector) as distance
                FROM "Document"
                WHERE "userId" = $2
                  AND (embedding <=> $1::vector) <= $3
                ORDER BY distance ASC
                LIMIT $4 OFFSET $5
            """
            results = await self.db.query_raw(
                sql, embedding_str, int(user_id), float(threshold), int(limit), int(offset)
            )

            count_sql = """
                SELECT COUNT(*)::int as count
                FROM "Document"
                WHERE "userId" = $1
                  AND (embedding <=> $2::vector) <= $3
            """
            count_result = await self.db.query_raw(
                count_sql, user_id, embedding_str, threshold
            )
        
        total = count_result[0]['count'] if count_result else 0

        formatted_results = []
        for row in results:
            formatted_results.append({
                "id": row['id'],
                "content": row['content'],
                "metadata": json.loads(row['metadata']) if isinstance(row['metadata'], str) else row['metadata'],
                "distance": float(row['distance'])
            })

        return formatted_results, total

    async def get_total_documents(self, user_id: int) -> int:
        """Get total number of documents for a user."""
        return await self.db.document.count(where={"userId": user_id})

    async def get_document(self, user_id: int, doc_id: int) -> Optional[Dict[str, Any]]:
        """Get a single document by ID."""
        doc = await self.db.document.find_first(
            where={
                "id": doc_id,
                "userId": user_id
            },
            include={
                "group": True
            }
        )

        if not doc:
            return None

        group_data = None
        if doc.group:
            group_data = doc.group.dict()
            if 'createdAt' in group_data and hasattr(group_data['createdAt'], 'isoformat'):
                group_data['createdAt'] = group_data['createdAt'].isoformat()

        return {
            "id": doc.id,
            "content": doc.content,
            "metadata": json.loads(doc.metadata) if isinstance(doc.metadata, str) else doc.metadata,
            "created_at": doc.createdAt.isoformat(),
            "group": group_data
        }

    async def get_documents(
        self,
        user_id: int,
        limit: int = 10,
        offset: int = 0,
        group_id: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get all documents for a user with pagination."""

        where_clause = {"userId": user_id}
        if group_id is not None:
            where_clause["groupId"] = group_id

        total = await self.db.document.count(where=where_clause)

        docs = await self.db.document.find_many(
            where=where_clause,
            take=limit,
            skip=offset,
            order={"id": "desc"},
            include={"group": True}
        )

        documents = []
        for doc in docs:
            group_data = None
            if doc.group:
                group_data = doc.group.dict()
                if 'createdAt' in group_data and hasattr(group_data['createdAt'], 'isoformat'):
                    group_data['createdAt'] = group_data['createdAt'].isoformat()

            documents.append({
                "id": doc.id,
                "content": doc.content,
                "metadata": json.loads(doc.metadata) if isinstance(doc.metadata, str) else doc.metadata,
                "created_at": doc.createdAt.isoformat(),
                "group": group_data
            })

        return documents, total

    async def get_groups(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all document groups for a user."""
        # Use raw query to get counts reliably as Prisma Python client has issues with _count in includes
        query = """
            SELECT g."id", g."name", g."createdAt", COUNT(d."id") as "documentCount"
            FROM "DocumentGroup" g
            LEFT JOIN "Document" d ON g."id" = d."groupId"
            WHERE g."userId" = $1
            GROUP BY g."id", g."name", g."createdAt"
            ORDER BY g."createdAt" DESC
        """
        
        groups = await self.db.query_raw(query, user_id)
        
        return [
            {
                "id": g["id"],
                "name": g["name"],
                "createdAt": g["createdAt"].isoformat() if hasattr(g["createdAt"], 'isoformat') else str(g["createdAt"]),
                "documentCount": int(g["documentCount"])
            }
            for g in groups
        ]

    async def create_group(self, user_id: int, name: str) -> Dict[str, Any]:
        """Create a new document group."""
        group = await self.db.documentgroup.create(
            data={
                "name": name,
                "userId": user_id
            }
        )
        return {
            "id": group.id,
            "name": group.name,
            "createdAt": group.createdAt.isoformat(),
            "documentCount": 0
        }

    async def find_or_create_group(self, user_id: int, name: str) -> int:
        """Find an existing group by name or create a new one.
        
        Args:
            user_id: The user ID
            name: The group name
            
        Returns:
            The group ID (existing or newly created)
        """
        # Try to find existing group
        existing = await self.db.documentgroup.find_first(
            where={"userId": user_id, "name": name}
        )
        
        if existing:
            return existing.id
        
        # Create new group
        group = await self.db.documentgroup.create(
            data={
                "name": name,
                "userId": user_id
            }
        )
        return group.id

    async def update_group(self, user_id: int, group_id: int, name: str) -> Optional[Dict[str, Any]]:
        """Update a document group."""
        try:
            # Verify ownership first (since update with where composite key not supported fully in all clients if specific features off)
            # But Prisma supports update(where={id: ...}) if ID is unique.
            # To ensure ownership, we check first.
            existing = await self.db.documentgroup.find_unique(where={"id": group_id})
            if not existing or existing.userId != user_id:
                return None
                
            group = await self.db.documentgroup.update(
                where={"id": group_id},
                data={"name": name}
            )
            
            # Get count separately
            count = await self.db.document.count(where={"groupId": group_id})
            
            return {
                "id": group.id,
                "name": group.name,
                "createdAt": group.createdAt.isoformat(),
                "documentCount": count
            }
        except Exception:
            return None

    async def delete_group(self, user_id: int, group_id: int, delete_documents: bool = False) -> Optional[Dict[str, Any]]:
        """Delete a document group.
        
        Args:
            user_id: The user ID
            group_id: The group ID to delete
            delete_documents: If True, delete all documents in the group.
                             If False, documents are preserved (groupId set to null).
        
        Returns:
            Dict with deletion info or None if group not found
        """
        try:
            # First check ownership
            group = await self.db.documentgroup.find_unique(
                where={"id": group_id}
            )
            if not group or group.userId != user_id:
                return None
            
            deleted_doc_count = 0
            
            if delete_documents:
                # Delete all documents in the group
                deleted_doc_count = await self.db.document.delete_many(
                    where={"groupId": group_id, "userId": user_id}
                )
            
            await self.db.documentgroup.delete(where={"id": group_id})
            
            return {
                "message": "Group deleted successfully",
                "deletedDocuments": deleted_doc_count
            }
        except Exception:
            return None

    async def assign_documents_to_group(self, user_id: int, group_id: Optional[int], doc_ids: List[int]) -> int:
        """Assign documents to a group (or remove from group if group_id is None)."""
        if not doc_ids:
            return 0
            
        # Verify group ownership if group_id is provided
        if group_id:
            group = await self.db.documentgroup.find_unique(
                where={"id": group_id}
            )
            if not group or group.userId != user_id:
                return 0
        
        result = await self.db.document.update_many(
            where={
                "id": {"in": doc_ids},
                "userId": user_id
            },
            data={"groupId": group_id}
        )
        
        return result

    async def delete_document(self, user_id: int, doc_id: int) -> bool:
        """Delete a document."""
        # Verify ownership first
        doc = await self.db.document.find_first(
            where={
                "id": doc_id,
                "userId": user_id
            }
        )

        if not doc:
            return False

        await self.db.document.delete(where={"id": doc_id})
        return True

    async def delete_documents(self, user_id: int, doc_ids: List[int]) -> int:
        """Batch delete documents."""
        if not doc_ids:
            return 0

        count = await self.db.document.delete_many(
            where={
                "userId": user_id,
                "id": {"in": doc_ids}
            }
        )

        return count

    async def export_group(self, user_id: int, group_id: int, include_vectors: bool = False) -> Optional[Dict[str, Any]]:
        """Export a document group with all documents.
        
        Args:
            user_id: The user ID
            group_id: The group ID to export
            include_vectors: Whether to include embedding vectors in the export
            
        Returns:
            Export data dict or None if group not found
        """
        # Verify group ownership
        group = await self.db.documentgroup.find_unique(where={"id": group_id})
        if not group or group.userId != user_id:
            return None
        
        # Get all documents in the group
        if include_vectors:
            # Use raw query to get vectors
            query = """
                SELECT id, content, metadata, embedding::text as embedding_text
                FROM "Document"
                WHERE "groupId" = $1 AND "userId" = $2
                ORDER BY id ASC
            """
            docs = await self.db.query_raw(query, group_id, user_id)
            
            documents = []
            for doc in docs:
                doc_data = {
                    "content": doc["content"],
                    "metadata": json.loads(doc["metadata"]) if isinstance(doc["metadata"], str) else doc["metadata"]
                }
                # Parse embedding from text format [x,y,z,...] to list
                if doc["embedding_text"]:
                    embedding_str = doc["embedding_text"].strip("[]")
                    if embedding_str:
                        doc_data["embedding"] = [float(x) for x in embedding_str.split(",")]
                documents.append(doc_data)
        else:
            docs = await self.db.document.find_many(
                where={"groupId": group_id, "userId": user_id},
                order={"id": "asc"}
            )
            documents = [
                {
                    "content": doc.content,
                    "metadata": json.loads(doc.metadata) if isinstance(doc.metadata, str) else doc.metadata
                }
                for doc in docs
            ]
        
        # Get actual model name and dimension from config service
        actual_model_name = config_service.get_value("EMBEDDING_MODEL_NAME", config.MODEL_NAME)
        actual_dimension = int(config_service.get_value("EMBEDDING_VECTOR_DIMENSION", str(config.VECTOR_DIMENSION)))
        
        export_data = {
            "version": "1.0",
            "groupName": group.name,
            "exportedAt": datetime.utcnow().isoformat() + "Z",
            "includesVectors": include_vectors,
            "documents": documents
        }
        
        if include_vectors:
            export_data["embeddingModel"] = actual_model_name
            export_data["vectorDimension"] = actual_dimension
        
        return export_data

    async def generate_unique_group_name(self, user_id: int, base_name: str) -> str:
        """Generate a unique group name for the user.
        
        If base_name exists, appends (1), (2), etc. until unique.
        """
        # Check if base name exists
        existing = await self.db.documentgroup.find_first(
            where={"userId": user_id, "name": base_name}
        )
        
        if not existing:
            return base_name
        
        # Try incrementing suffix
        counter = 1
        while True:
            new_name = f"{base_name} ({counter})"
            existing = await self.db.documentgroup.find_first(
                where={"userId": user_id, "name": new_name}
            )
            if not existing:
                return new_name
            counter += 1
            # Safety limit
            if counter > 1000:
                raise ValueError("Too many groups with similar names")

    async def import_group(
        self,
        user_id: int,
        import_data: Dict[str, Any],
        use_existing_vectors: bool = False
    ) -> Dict[str, Any]:
        """Import a document group with documents.
        
        Args:
            user_id: The user ID
            import_data: The exported data to import
            use_existing_vectors: If True, use vectors from import_data;
                                  if False, generate new vectors
            
        Returns:
            Dict with group info and import statistics
        """
        # Validate import data
        if import_data.get("version") != "1.0":
            raise ValueError("Unsupported export version")
        
        documents = import_data.get("documents", [])
        if not documents:
            raise ValueError("No documents to import")
        
        # Generate unique group name
        base_name = import_data.get("groupName", "Imported Group")
        group_name = await self.generate_unique_group_name(user_id, base_name)
        
        # Create the new group
        group = await self.db.documentgroup.create(
            data={
                "name": group_name,
                "userId": user_id
            }
        )
        
        imported_count = 0
        failed_count = 0
        
        for doc_data in documents:
            try:
                content = doc_data.get("content", "")
                metadata = doc_data.get("metadata", {})
                
                if not content:
                    failed_count += 1
                    continue
                
                metadata_json = json.dumps(metadata)
                
                if use_existing_vectors and "embedding" in doc_data:
                    # Use pre-existing vectors
                    embedding = doc_data["embedding"]
                    embedding_str = f"[{','.join(map(str, embedding))}]"
                    
                    query = """
                        INSERT INTO "Document" ("userId", "content", "metadata", "embedding", "groupId", "updatedAt")
                        VALUES ($1, $2, $3::jsonb, $4::vector, $5, NOW())
                        RETURNING id
                    """
                    await self.db.query_raw(query, user_id, content, metadata_json, embedding_str, group.id)
                else:
                    # Generate new embeddings
                    embedding = self.embedding_service.get_embedding(content)
                    if not embedding:
                        failed_count += 1
                        continue
                    
                    embedding_str = f"[{','.join(map(str, embedding))}]"
                    
                    query = """
                        INSERT INTO "Document" ("userId", "content", "metadata", "embedding", "groupId", "updatedAt")
                        VALUES ($1, $2, $3::jsonb, $4::vector, $5, NOW())
                        RETURNING id
                    """
                    await self.db.query_raw(query, user_id, content, metadata_json, embedding_str, group.id)
                
                imported_count += 1
                
            except Exception as e:
                print(f"Failed to import document: {e}")
                failed_count += 1
        
        return {
            "group": {
                "id": group.id,
                "name": group.name,
                "createdAt": group.createdAt.isoformat()
            },
            "importedCount": imported_count,
            "failedCount": failed_count,
            "totalDocuments": len(documents)
        }
