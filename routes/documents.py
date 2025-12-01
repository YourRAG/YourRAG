"""Document routes including CRUD, groups, search, and file operations."""

from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File, Form
from typing import Optional, List

import json

from schemas import (
    DocumentInput,
    BatchDeleteInput,
    DocumentItem,
    PaginatedDocumentsResponse,
    PaginatedSearchResponse,
    DocumentGroup,
    DocumentGroupInput,
    GroupAssignInput,
    DocumentUpdateInput,
    BatchDeleteApiInput,
    MoveDocumentInput,
    GroupExportRequest,
    GroupImportRequest,
    SmartChunkRequest,
    SmartChunkResponse,
)
from auth import get_current_user, get_chat_user, prisma
from document_store import DocumentStore
from file_parser import FileParser, FileParseError
from activity_service import (
    record_document_add,
    record_document_delete,
    record_search,
)
from llm_service import LLMService

router = APIRouter()
store = DocumentStore()

# Maximum file size: 50MB
MAX_FILE_SIZE = 50 * 1024 * 1024


# =====================
# Document Routes
# =====================


@router.get("/documents", response_model=PaginatedDocumentsResponse)
async def list_documents(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Documents per page"),
    user_id: Optional[int] = Query(None, description="Filter by user ID (Admin only)"),
    group_id: Optional[int] = Query(None, description="Filter by group ID"),
    current_user=Depends(get_current_user),
):
    """Get paginated list of user's documents."""
    try:
        target_user_id = current_user.id
        if user_id is not None:
            if current_user.role != "ADMIN":
                raise HTTPException(status_code=403, detail="Permission denied")
            target_user_id = user_id

        offset = (page - 1) * page_size
        documents, total = await store.get_documents(
            user_id=target_user_id, limit=page_size, offset=offset, group_id=group_id
        )
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0

        return PaginatedDocumentsResponse(
            documents=documents,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/batch")
async def delete_documents_batch(
    data: BatchDeleteInput,
    user_id: Optional[int] = Query(None, description="Target user ID (Admin only)"),
    current_user=Depends(get_current_user)
):
    """Batch delete documents."""
    try:
        target_user_id = current_user.id
        if user_id is not None:
            if current_user.role != "ADMIN":
                raise HTTPException(status_code=403, detail="Permission denied")
            target_user_id = user_id

        count = await store.delete_documents(user_id=target_user_id, doc_ids=data.ids)

        if count > 0:
            await record_document_delete(prisma, target_user_id, 0)

        return {"message": f"Successfully deleted {count} documents"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{doc_id}", response_model=DocumentItem)
async def get_document(doc_id: int, current_user=Depends(get_current_user)):
    """Get a document by ID."""
    try:
        doc = await store.get_document(user_id=current_user.id, doc_id=doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: int,
    user_id: Optional[int] = Query(None, description="Target user ID (Admin only)"),
    current_user=Depends(get_current_user)
):
    """Delete a document by ID."""
    try:
        target_user_id = current_user.id
        if user_id is not None:
            if current_user.role != "ADMIN":
                raise HTTPException(status_code=403, detail="Permission denied")
            target_user_id = user_id

        deleted = await store.delete_document(user_id=target_user_id, doc_id=doc_id)
        if not deleted:
            raise HTTPException(
                status_code=404, detail="Document not found or permission denied"
            )

        await record_document_delete(prisma, target_user_id, doc_id)
        return {"message": "Document deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/documents/{doc_id}")
async def update_document(
    doc_id: int,
    data: DocumentUpdateInput,
    current_user=Depends(get_chat_user)
):
    """Update a document by ID (supports API Key authentication)."""
    try:
        result = await store.update_document(
            user_id=current_user.id,
            doc_id=doc_id,
            content=data.content,
            metadata=data.metadata,
            group_id=data.group_id,
            update_group=data.update_group
        )
        
        if not result:
            raise HTTPException(
                status_code=404, detail="Document not found or permission denied"
            )
        
        return {"message": "Document updated successfully", "document": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents")
async def add_document(doc: DocumentInput, current_user=Depends(get_chat_user)):
    """Add a new document."""
    try:
        group_id = None
        group_name = None
        
        if doc.metadata:
            group_id = doc.metadata.get("groupId")
            group_name = doc.metadata.get("groupName")
            doc.metadata.pop("groupId", None)
            doc.metadata.pop("groupName", None)
        
        if group_id is not None:
            try:
                group_id = int(group_id)
            except (ValueError, TypeError):
                group_id = None
        
        if group_name and not group_id:
            group_name = str(group_name).strip()
            if group_name:
                group_id = await store.find_or_create_group(
                    user_id=current_user.id, name=group_name
                )
            
        doc_id = await store.add_document(
            user_id=current_user.id, content=doc.content, metadata=doc.metadata, group_id=group_id
        )

        await record_document_add(prisma, current_user.id, doc_id, doc.content[:50])
        return {"id": doc_id, "message": "Document added successfully", "groupId": group_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents/smart-chunk", response_model=SmartChunkResponse)
async def smart_chunk_document(
    request: SmartChunkRequest,
    current_user=Depends(get_chat_user)
):
    """
    Use LLM to intelligently chunk a document into semantic segments.
    
    The LLM analyzes the document structure and content to determine
    optimal split points based on semantic boundaries like:
    - Topic changes
    - Section headers
    - Logical paragraph groupings
    - Natural content breaks
    """
    try:
        content = request.content.strip()
        if not content:
            raise HTTPException(status_code=400, detail="Content cannot be empty")
        
        if len(content) < 100:
            return SmartChunkResponse(chunks=[content], chunk_count=1)
        
        llm = LLMService()
        
        system_prompt = """You are a document segmentation expert. Your task is to analyze the given text and split it into logical, semantic chunks.

Rules:
1. Each chunk should be a coherent, self-contained unit of information
2. Split at natural boundaries: topic changes, section headers, logical breaks
3. Each chunk should be between 200-1500 characters ideally
4. Preserve complete sentences and paragraphs - never break mid-sentence
5. Return ONLY a valid JSON array of strings, where each string is a chunk
6. Do NOT add any explanation, markdown, or other text - ONLY the JSON array

Example output format:
["First chunk content here...", "Second chunk content here...", "Third chunk content here..."]"""

        user_prompt = f"""Analyze and split the following document into semantic chunks. Return ONLY a JSON array of chunk strings:

---
{content}
---

Remember: Return ONLY the JSON array, no other text."""

        response = llm.chat_completion(
            query=user_prompt,
            contexts=[],
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=4096
        )
        
        response_text = response.strip()
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
        
        try:
            chunks = json.loads(response_text)
            if not isinstance(chunks, list):
                raise ValueError("Response is not a list")
            chunks = [str(chunk).strip() for chunk in chunks if str(chunk).strip()]
        except (json.JSONDecodeError, ValueError):
            chunks = smart_fallback_chunk(content)
        
        if not chunks:
            chunks = [content]
        
        return SmartChunkResponse(chunks=chunks, chunk_count=len(chunks))
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Smart chunking error: {e}")
        chunks = smart_fallback_chunk(request.content)
        return SmartChunkResponse(chunks=chunks, chunk_count=len(chunks))


def smart_fallback_chunk(content: str, max_chunk_size: int = 1000) -> List[str]:
    """
    Fallback chunking when LLM fails.
    Splits by paragraphs and respects sentence boundaries.
    """
    paragraphs = content.split("\n\n")
    chunks = []
    current_chunk = ""
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        if len(current_chunk) + len(para) + 2 <= max_chunk_size:
            if current_chunk:
                current_chunk += "\n\n" + para
            else:
                current_chunk = para
        else:
            if current_chunk:
                chunks.append(current_chunk)
            if len(para) <= max_chunk_size:
                current_chunk = para
            else:
                sentences = para.replace(". ", ".|").split("|")
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    if len(current_chunk) + len(sentence) + 1 <= max_chunk_size:
                        if current_chunk:
                            current_chunk += " " + sentence
                        else:
                            current_chunk = sentence
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        current_chunk = sentence
    
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks if chunks else [content]


@router.post("/documents/parse")
async def parse_document(
    file: UploadFile = File(...),
    current_user=Depends(get_chat_user)
):
    """Parse a document file and return extracted text content."""
    try:
        filename = file.filename or "unknown"
        if not FileParser.is_supported(filename):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Supported: {', '.join(sorted(FileParser.SUPPORTED_EXTENSIONS))}"
            )
        
        file_bytes = await file.read()
        
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB"
            )
        
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        try:
            content = FileParser.parse_file(filename, file_bytes)
        except FileParseError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        if not content or not content.strip():
            raise HTTPException(
                status_code=400,
                detail="No text content could be extracted from the file"
            )
        
        return {
            "content": content,
            "filename": filename,
            "fileType": filename.rsplit('.', 1)[-1].lower() if '.' in filename else "unknown",
            "contentLength": len(content)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse file: {str(e)}")


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    group_id: Optional[int] = Form(None),
    group_name: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    current_user=Depends(get_chat_user)
):
    """Upload a document file (PDF, DOCX, TXT, MD) and extract text content."""
    try:
        filename = file.filename or "unknown"
        if not FileParser.is_supported(filename):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Supported: {', '.join(sorted(FileParser.SUPPORTED_EXTENSIONS))}"
            )
        
        file_bytes = await file.read()
        
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB"
            )
        
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        try:
            content = FileParser.parse_file(filename, file_bytes)
        except FileParseError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        if not content or not content.strip():
            raise HTTPException(
                status_code=400,
                detail="No text content could be extracted from the file"
            )
        
        metadata = {
            "originalFilename": filename,
            "fileType": filename.rsplit('.', 1)[-1].lower() if '.' in filename else "unknown",
            "fileSize": len(file_bytes),
        }
        
        if category and category.strip():
            metadata["category"] = category.strip()
        if source and source.strip():
            metadata["source"] = source.strip()
        
        resolved_group_id = None
        if group_id is not None:
            resolved_group_id = group_id
        elif group_name and group_name.strip():
            resolved_group_id = await store.find_or_create_group(
                user_id=current_user.id, name=group_name.strip()
            )
        
        doc_id = await store.add_document(
            user_id=current_user.id, content=content, metadata=metadata, group_id=resolved_group_id
        )
        
        await record_document_add(prisma, current_user.id, doc_id, content[:50])
        
        return {
            "id": doc_id,
            "message": "Document uploaded and processed successfully",
            "filename": filename,
            "contentLength": len(content),
            "groupId": resolved_group_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")


# =====================
# Document Group Routes
# =====================


@router.get("/groups", response_model=List[DocumentGroup])
async def list_groups(current_user=Depends(get_current_user)):
    """Get all document groups for the current user."""
    try:
        return await store.get_groups(user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/groups", response_model=DocumentGroup)
async def create_group(group: DocumentGroupInput, current_user=Depends(get_current_user)):
    """Create a new document group."""
    try:
        return await store.create_group(user_id=current_user.id, name=group.name)
    except Exception as e:
        if "Unique constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Group with this name already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/groups/{group_id}", response_model=DocumentGroup)
async def update_group(group_id: int, group: DocumentGroupInput, current_user=Depends(get_current_user)):
    """Update a document group."""
    try:
        result = await store.update_group(user_id=current_user.id, group_id=group_id, name=group.name)
        if not result:
            raise HTTPException(status_code=404, detail="Group not found")
        return result
    except Exception as e:
        if "Unique constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Group with this name already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: int,
    delete_documents: bool = Query(False, description="Whether to delete documents in the group"),
    current_user=Depends(get_current_user)
):
    """Delete a document group (Web UI - Cookie authentication)."""
    try:
        result = await store.delete_group(
            user_id=current_user.id, group_id=group_id, delete_documents=delete_documents
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Group not found")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/groups/assign")
async def assign_group(data: GroupAssignInput, current_user=Depends(get_current_user)):
    """Assign documents to a group."""
    try:
        count = await store.assign_documents_to_group(
            user_id=current_user.id, group_id=data.group_id, doc_ids=data.doc_ids
        )
        return {"message": f"Successfully assigned {count} documents"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/groups/{group_id}/export")
async def export_group(
    group_id: int, request: GroupExportRequest, current_user=Depends(get_current_user)
):
    """Export a document group."""
    try:
        export_data = await store.export_group(
            user_id=current_user.id, group_id=group_id, include_vectors=request.include_vectors
        )
        if not export_data:
            raise HTTPException(status_code=404, detail="Group not found")
        return export_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/groups/import")
async def import_group(request: GroupImportRequest, current_user=Depends(get_current_user)):
    """Import a document group."""
    try:
        import_data = request.import_data
        
        if request.use_existing_vectors:
            if not import_data.get("includesVectors"):
                raise HTTPException(
                    status_code=400,
                    detail="Import data does not include vectors. Please select 'Generate new vectors' option."
                )
            has_vectors = any(doc.get("embedding") for doc in import_data.get("documents", []))
            if not has_vectors:
                raise HTTPException(
                    status_code=400,
                    detail="Import data claims to include vectors but no vectors found in documents."
                )
        
        result = await store.import_group(
            user_id=current_user.id, import_data=import_data, use_existing_vectors=request.use_existing_vectors
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# Search Routes
# =====================


@router.get("/search", response_model=PaginatedSearchResponse)
async def search_documents(
    query: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(5, ge=1, le=50, description="Results per page"),
    group_id: Optional[int] = Query(None, description="Filter by group ID (optional)"),
    group_name: Optional[str] = Query(None, description="Filter by group name (optional)"),
    current_user=Depends(get_chat_user),
):
    """Search documents with optional group filtering."""
    try:
        resolved_group_id = group_id
        if group_name and not group_id:
            group = await prisma.documentgroup.find_first(
                where={"userId": current_user.id, "name": group_name}
            )
            if group:
                resolved_group_id = group.id
            else:
                return PaginatedSearchResponse(
                    results=[], total=0, page=page, page_size=page_size, total_pages=0
                )

        offset = (page - 1) * page_size
        user_similarity = (
            current_user.similarityThreshold if current_user.similarityThreshold is not None else 0.8
        )
        distance_threshold = 1.0 - user_similarity

        results, total = await store.search(
            user_id=current_user.id,
            query=query,
            threshold=distance_threshold,
            limit=page_size,
            offset=offset,
            group_id=resolved_group_id,
        )
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0

        await record_search(prisma, current_user.id, query, total)

        return PaginatedSearchResponse(
            results=results, total=total, page=page, page_size=page_size, total_pages=total_pages
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_stats(current_user=Depends(get_current_user)):
    """Get document statistics."""
    try:
        total = await store.get_total_documents(user_id=current_user.id)
        return {"total_documents": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# External API Routes (API Key Authentication)
# =====================


@router.delete("/api/documents/{doc_id}")
async def api_delete_document(doc_id: int, current_user=Depends(get_chat_user)):
    """Delete a document by ID (supports API Key authentication)."""
    try:
        deleted = await store.delete_document(user_id=current_user.id, doc_id=doc_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Document not found or permission denied")

        await record_document_delete(prisma, current_user.id, doc_id)
        return {"message": "Document deleted successfully", "id": doc_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/documents/batch")
async def api_delete_documents_batch(data: BatchDeleteApiInput, current_user=Depends(get_chat_user)):
    """Batch delete documents by IDs (supports API Key authentication)."""
    try:
        count = await store.delete_documents(user_id=current_user.id, doc_ids=data.ids)
        if count > 0:
            await record_document_delete(prisma, current_user.id, 0)
        return {"message": f"Successfully deleted {count} documents", "deletedCount": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/documents/{doc_id}/move")
async def api_move_document(doc_id: int, data: MoveDocumentInput, current_user=Depends(get_chat_user)):
    """Move a document to a different group (supports API Key authentication)."""
    try:
        target_group_id = None
        
        if data.group_id is not None:
            target_group_id = data.group_id
            group = await prisma.documentgroup.find_first(
                where={"id": target_group_id, "userId": current_user.id}
            )
            if not group:
                raise HTTPException(status_code=404, detail="Target group not found")
        elif data.group_name is not None and data.group_name.strip():
            target_group_id = await store.find_or_create_group(
                user_id=current_user.id, name=data.group_name.strip()
            )
        
        result = await store.update_document(
            user_id=current_user.id, doc_id=doc_id, group_id=target_group_id, update_group=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {"message": "Document moved successfully", "document": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/documents/{doc_id}")
async def api_update_document(doc_id: int, data: DocumentUpdateInput, current_user=Depends(get_chat_user)):
    """Update a document by ID (supports API Key authentication)."""
    try:
        result = await store.update_document(
            user_id=current_user.id,
            doc_id=doc_id,
            content=data.content,
            metadata=data.metadata,
            group_id=data.group_id,
            update_group=data.update_group
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Document not found or permission denied")
        
        return {"message": "Document updated successfully", "document": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/stats")
async def api_get_stats(current_user=Depends(get_chat_user)):
    """Get user statistics (supports API Key authentication)."""
    try:
        total_documents = await store.get_total_documents(user_id=current_user.id)
        groups = await store.get_groups(user_id=current_user.id)
        return {"totalDocuments": total_documents, "totalGroups": len(groups), "groups": groups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/groups", response_model=List[DocumentGroup])
async def api_list_groups(current_user=Depends(get_chat_user)):
    """Get all document groups (supports API Key authentication)."""
    try:
        return await store.get_groups(user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/groups", response_model=DocumentGroup)
async def api_create_group(group: DocumentGroupInput, current_user=Depends(get_chat_user)):
    """Create a new document group (supports API Key authentication)."""
    try:
        return await store.create_group(user_id=current_user.id, name=group.name)
    except Exception as e:
        if "Unique constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Group with this name already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/groups/{group_id}", response_model=DocumentGroup)
async def api_update_group(group_id: int, group: DocumentGroupInput, current_user=Depends(get_chat_user)):
    """Update a document group by ID (supports API Key authentication)."""
    try:
        result = await store.update_group(user_id=current_user.id, group_id=group_id, name=group.name)
        if not result:
            raise HTTPException(status_code=404, detail="Group not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        if "Unique constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Group with this name already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/groups/by-name/{group_name}", response_model=DocumentGroup)
async def api_update_group_by_name(
    group_name: str, group: DocumentGroupInput, current_user=Depends(get_chat_user)
):
    """Update a document group by name (supports API Key authentication)."""
    try:
        existing = await prisma.documentgroup.find_first(
            where={"userId": current_user.id, "name": group_name}
        )
        if not existing:
            raise HTTPException(status_code=404, detail=f"Group '{group_name}' not found")
        
        result = await store.update_group(user_id=current_user.id, group_id=existing.id, name=group.name)
        if not result:
            raise HTTPException(status_code=404, detail="Group not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        if "Unique constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Group with this name already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/groups/by-name/{group_name}/documents")
async def api_list_documents_by_group_name(group_name: str, current_user=Depends(get_chat_user)):
    """List all documents in a group by group name (supports API Key authentication)."""
    try:
        documents, group_id = await store.get_documents_by_group_name(
            user_id=current_user.id, group_name=group_name
        )
        
        if group_id is None:
            raise HTTPException(status_code=404, detail=f"Group '{group_name}' not found")
        
        return {
            "groupId": group_id, "groupName": group_name, "documents": documents, "total": len(documents)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/groups/by-name/{group_name}/documents/{doc_id}")
async def api_get_document_in_group(
    group_name: str,
    doc_id: int,
    include_vector: bool = Query(True, description="Whether to include the embedding vector"),
    current_user=Depends(get_chat_user)
):
    """Get a specific document in a group with its embedding vector (supports API Key authentication)."""
    try:
        group = await prisma.documentgroup.find_first(
            where={"userId": current_user.id, "name": group_name}
        )
        
        if not group:
            raise HTTPException(status_code=404, detail=f"Group '{group_name}' not found")
        
        if include_vector:
            document = await store.get_document_with_vector(
                user_id=current_user.id, doc_id=doc_id, group_id=group.id
            )
        else:
            document = await store.get_document(user_id=current_user.id, doc_id=doc_id)
            if document and document.get("group") and document["group"].get("id") != group.id:
                document = None
        
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found in group '{group_name}'")
        
        return document
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/groups/{group_id}")
async def api_delete_group(
    group_id: int,
    delete_documents: bool = Query(True, description="Whether to delete all documents in the group"),
    current_user=Depends(get_chat_user)
):
    """Delete a document group by ID (supports API Key authentication)."""
    try:
        result = await store.delete_group(
            user_id=current_user.id, group_id=group_id, delete_documents=delete_documents
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Group not found or permission denied")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/groups/by-name/{group_name}")
async def api_delete_group_by_name(
    group_name: str,
    delete_documents: bool = Query(True, description="Whether to delete all documents in the group"),
    current_user=Depends(get_chat_user)
):
    """Delete a document group by name (supports API Key authentication)."""
    try:
        group = await prisma.documentgroup.find_first(
            where={"userId": current_user.id, "name": group_name}
        )
        if not group:
            raise HTTPException(status_code=404, detail=f"Group '{group_name}' not found")
        
        result = await store.delete_group(
            user_id=current_user.id, group_id=group.id, delete_documents=delete_documents
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Group not found or permission denied")
        
        result["groupName"] = group_name
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))