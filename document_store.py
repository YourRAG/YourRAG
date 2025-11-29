from typing import List, Dict, Any, Optional, Tuple
import json
from prisma import Prisma
from embedding_service import EmbeddingService

class DocumentStore:
    def __init__(self):
        # Prisma client is managed globally in api.py, but we can instantiate one here if needed
        # or better, pass it in. For now, we'll use a new instance but expect connection to be managed externally
        # or we can use the global one. To keep it simple and consistent with existing pattern,
        # we will assume the global prisma instance is connected.
        from auth import prisma
        self.db = prisma
        self.embedding_service = EmbeddingService()

    async def add_document(self, user_id: int, content: str, metadata: Dict[str, Any] = None) -> int:
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
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Search for similar documents using vector similarity with pagination.
        
        Returns:
            Tuple of (results list, total count)
        """
        query_embedding = self.embedding_service.get_embedding(query)
        if not query_embedding:
            return [], 0

        embedding_str = f"[{','.join(map(str, query_embedding))}]"

        # Calculate total count for this user (approximate or exact depending on needs)
        # For search results, total usually means "total matches", but with vector search
        # almost everything matches to some degree.
        # Here we return the count of documents that satisfy the threshold.

        # We use cosine distance (<=> operator in pgvector).
        # Distance = 1 - Cosine Similarity.
        # So if we want similarity >= 0.8, we want distance <= 0.2.

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

        # Ensure types are native Python types
        results = await self.db.query_raw(
            sql, embedding_str, int(user_id), float(threshold), int(limit), int(offset)
        )

        # Get total count for pagination
        count_sql = """
            SELECT COUNT(*)::int as count
            FROM "Document"
            WHERE "userId" = $1
              AND (embedding <=> $2::vector) <= $3
        """

        count_result = await self.db.query_raw(
            count_sql,
            user_id,
            embedding_str,
            threshold
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
            }
        )

        if not doc:
            return None

        return {
            "id": doc.id,
            "content": doc.content,
            "metadata": json.loads(doc.metadata) if isinstance(doc.metadata, str) else doc.metadata,
            "created_at": doc.createdAt.isoformat()
        }

    async def get_documents(
        self,
        user_id: int,
        limit: int = 10,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get all documents for a user with pagination."""

        total = await self.get_total_documents(user_id)

        docs = await self.db.document.find_many(
            where={"userId": user_id},
            take=limit,
            skip=offset,
            order={"id": "desc"}
        )

        documents = []
        for doc in docs:
            documents.append({
                "id": doc.id,
                "content": doc.content,
                "metadata": json.loads(doc.metadata) if isinstance(doc.metadata, str) else doc.metadata,
                "created_at": doc.createdAt.isoformat()
            })

        return documents, total

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
