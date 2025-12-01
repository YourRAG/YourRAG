from fastapi import FastAPI, HTTPException, Query, Depends, Response, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, RedirectResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime
from document_store import DocumentStore
from llm_service import LLMService
from file_parser import FileParser, FileParseError
from auth import (
    get_github_user,
    get_gitee_user,
    create_access_token,
    get_current_user,
    get_current_user_optional,
    get_chat_user,
    prisma,
)
from redis_service import RedisService
from rate_limiter import rate_limit
from activity_service import (
    ActivityService,
    record_login,
    record_document_add,
    record_document_delete,
    record_search,
    record_rag_query,
    record_settings_update,
)
import config
import uvicorn
import json
import time
import uuid
from contextlib import asynccontextmanager
from config_service import config_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await prisma.connect()
    try:
        await RedisService.connect()
    except Exception as e:
        print(f"连接 Redis 失败: {e}")
    
    # Load system configuration
    await config_service.load_config()

    yield

    # Shutdown
    await RedisService.disconnect()
    await prisma.disconnect()


# Disable docs in production
docs_url = "/docs" if config.ENVIRONMENT == "development" else None
redoc_url = "/redoc" if config.ENVIRONMENT == "development" else None

app = FastAPI(
    title="RAG API", lifespan=lifespan, docs_url=docs_url, redoc_url=redoc_url
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = DocumentStore()
llm_service = LLMService()


# GitHub OAuth callback URL
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
# Gitee OAuth callback URL
GITEE_AUTHORIZE_URL = "https://gitee.com/oauth/authorize"


class DocumentInput(BaseModel):
    content: str
    metadata: Optional[Dict[str, Any]] = {}


class BatchDeleteInput(BaseModel):
    ids: List[int]


class BanInput(BaseModel):
    reason: str


class SearchResult(BaseModel):
    id: int
    content: str
    metadata: Dict[str, Any]
    distance: float


class PaginatedSearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    page: int
    page_size: int
    total_pages: int


class RAGQueryInput(BaseModel):
    query: str
    top_k: Optional[int] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1024


class OpenAIMessage(BaseModel):
    role: str
    content: str
    name: Optional[str] = None  # OpenAI compatible: optional name field


class OpenAIRequest(BaseModel):
    messages: List[OpenAIMessage]
    model: Optional[str] = "default"
    stream: Optional[bool] = False
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1024
    top_k: Optional[int] = None
    # use_history is kept for backward compatibility but conversation history
    # is now always extracted from the messages array (standard OpenAI behavior)
    use_history: Optional[bool] = True
    # OpenAI compatible fields (ignored but accepted for compatibility)
    top_p: Optional[float] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
    stop: Optional[List[str]] = None
    user: Optional[str] = None


class RAGResponse(BaseModel):
    answer: str
    sources: List[SearchResult]


class DocumentGroup(BaseModel):
    id: int
    name: str
    createdAt: str
    documentCount: int = 0


class DocumentItem(BaseModel):
    id: int
    content: str
    metadata: Dict[str, Any]
    created_at: Optional[str] = None
    group: Optional[DocumentGroup] = None


class PaginatedDocumentsResponse(BaseModel):
    documents: List[DocumentItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class UserResponse(BaseModel):
    id: int
    githubId: Optional[str] = None
    giteeId: Optional[str] = None
    username: str
    email: Optional[str] = None
    avatarUrl: Optional[str] = None
    role: str = "USER"
    topK: int = 5
    similarityThreshold: float = 0.8


class UpdateSettingsInput(BaseModel):
    topK: int
    similarityThreshold: float


class ActivityItem(BaseModel):
    id: int
    type: str
    title: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    createdAt: str


class ActivitiesResponse(BaseModel):
    activities: List[ActivityItem]
    total: int


class UserStatsResponse(BaseModel):
    documentCount: int
    searchCount: int
    queryCount: int
    totalActivities: int


class SystemConfigInput(BaseModel):
    configs: Dict[str, str]


class ApiKeyCreateInput(BaseModel):
    name: str
    expiresAt: Optional[datetime] = None


class ApiKeyResponse(BaseModel):
    id: int
    key: str
    name: str
    createdAt: datetime
    expiresAt: Optional[datetime]
    lastUsedAt: Optional[datetime]
    isActive: bool


class DocumentGroupInput(BaseModel):
    name: str


class GroupAssignInput(BaseModel):
    doc_ids: List[int]
    group_id: Optional[int]


class DocumentUpdateInput(BaseModel):
    """Input for updating a document."""
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    group_id: Optional[int] = None
    update_group: bool = False


# =====================
# Auth Routes
# =====================


@app.get("/auth/providers")
async def get_auth_providers():
    """Get available authentication providers."""
    providers = []
    if config.GITHUB_CLIENT_ID and config.GITHUB_CLIENT_SECRET:
        providers.append("github")
    if config.GITEE_CLIENT_ID and config.GITEE_CLIENT_SECRET:
        providers.append("gitee")
    return {"providers": providers}


@app.get("/auth/github")
async def github_login(request: Request):
    """Redirect to GitHub OAuth login."""
    callback_url = str(request.url_for("github_callback"))
    redirect_uri = f"{GITHUB_AUTHORIZE_URL}?client_id={config.GITHUB_CLIENT_ID}&scope=user:email&redirect_uri={callback_url}"
    return RedirectResponse(url=redirect_uri)


@app.get("/auth/github/callback")
async def github_callback(code: str, request: Request, response: Response):
    """Handle GitHub OAuth callback."""
    try:
        callback_url = str(request.url_for("github_callback"))
        github_user = await get_github_user(code, callback_url)

        # Find or create user
        user = await prisma.user.find_unique(where={"githubId": str(github_user["id"])})

        if not user:
            # Check if this is the first user
            user_count = await prisma.user.count()
            role = "ADMIN" if user_count == 0 else "USER"

            user = await prisma.user.create(
                data={
                    "githubId": str(github_user["id"]),
                    "username": github_user["login"],
                    "email": github_user.get("email"),
                    "avatarUrl": github_user.get("avatar_url"),
                    "role": role,
                }
            )

        # Check if user is banned - prevent login for banned users
        if user.banned:
            from urllib.parse import urlencode
            error_params = urlencode({
                "error": "banned",
                "reason": user.banReason or "Your account has been banned"
            })
            return RedirectResponse(
                url=f"{config.FRONTEND_URL}?{error_params}", status_code=302
            )

        # Create JWT token
        token = create_access_token(data={"sub": str(user.id)})

        # Record login activity
        await record_login(prisma, user.id)

        # Set cookie and redirect to frontend
        response = RedirectResponse(url=config.FRONTEND_URL, status_code=302)
        response.set_cookie(
            key="token",
            value=token,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite="lax",
            max_age=60 * 60 * 24 * 7,  # 7 days
        )

        return response

    except Exception as e:
        import traceback

        error_msg = str(e) if str(e) else "Login failed"
        print(f"OAuth callback error: {error_msg}")
        print(traceback.format_exc())
        # Redirect to frontend with error parameter
        from urllib.parse import urlencode

        error_params = urlencode({"error": error_msg})
        return RedirectResponse(
            url=f"{config.FRONTEND_URL}?{error_params}", status_code=302
        )


@app.get("/auth/gitee")
async def gitee_login(request: Request):
    """Redirect to Gitee OAuth login."""
    callback_url = str(request.url_for("gitee_callback"))
    redirect_uri = f"{GITEE_AUTHORIZE_URL}?client_id={config.GITEE_CLIENT_ID}&response_type=code&redirect_uri={callback_url}"
    return RedirectResponse(url=redirect_uri)


@app.get("/auth/gitee/callback")
async def gitee_callback(code: str, request: Request, response: Response):
    """Handle Gitee OAuth callback."""
    try:
        callback_url = str(request.url_for("gitee_callback"))
        gitee_user = await get_gitee_user(code, callback_url)

        # Find or create user
        user = await prisma.user.find_unique(where={"giteeId": str(gitee_user["id"])})

        if not user:
            # Check if this is the first user
            user_count = await prisma.user.count()
            role = "ADMIN" if user_count == 0 else "USER"

            user = await prisma.user.create(
                data={
                    "giteeId": str(gitee_user["id"]),
                    "username": gitee_user["login"],
                    "email": gitee_user.get("email"),
                    "avatarUrl": gitee_user.get("avatar_url"),
                    "role": role,
                }
            )

        # Check if user is banned - prevent login for banned users
        if user.banned:
            from urllib.parse import urlencode
            error_params = urlencode({
                "error": "banned",
                "reason": user.banReason or "Your account has been banned"
            })
            return RedirectResponse(
                url=f"{config.FRONTEND_URL}?{error_params}", status_code=302
            )

        # Create JWT token
        token = create_access_token(data={"sub": str(user.id)})

        # Record login activity
        await record_login(prisma, user.id)

        # Set cookie and redirect to frontend
        response = RedirectResponse(url=config.FRONTEND_URL, status_code=302)
        response.set_cookie(
            key="token",
            value=token,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite="lax",
            max_age=60 * 60 * 24 * 7,  # 7 days
        )

        return response

    except Exception as e:
        import traceback

        error_msg = str(e) if str(e) else "Login failed"
        print(f"OAuth callback error: {error_msg}")
        print(traceback.format_exc())
        # Redirect to frontend with error parameter
        from urllib.parse import urlencode

        error_params = urlencode({"error": error_msg})
        return RedirectResponse(
            url=f"{config.FRONTEND_URL}?{error_params}", status_code=302
        )


@app.get("/auth/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    """Get current authenticated user."""
    return UserResponse(
        id=current_user.id,
        githubId=current_user.githubId,
        giteeId=current_user.giteeId,
        username=current_user.username,
        email=current_user.email,
        avatarUrl=current_user.avatarUrl,
        role=current_user.role,
        topK=current_user.topK,
        similarityThreshold=current_user.similarityThreshold,
    )


@app.post("/auth/logout")
async def logout(response: Response):
    """Logout and clear cookie."""
    response = Response(
        content='{"message": "Logged out"}', media_type="application/json"
    )
    response.delete_cookie(key="token")
    return response


# =====================
# Activity Routes
# =====================


@app.get("/activities", response_model=ActivitiesResponse)
async def get_activities(
    limit: int = Query(10, ge=1, le=50, description="Number of activities to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user=Depends(get_current_user),
):
    """Get current user's activities."""
    try:
        service = ActivityService(prisma)
        activities = await service.get_user_activities(
            user_id=current_user.id, limit=limit, offset=offset
        )
        total = await service.get_activity_count(current_user.id)

        return ActivitiesResponse(activities=activities, total=total)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/activities")
async def clear_activities(current_user=Depends(get_current_user)):
    """Clear all activities for the current user."""
    try:
        service = ActivityService(prisma)
        count = await service.clear_user_activities(current_user.id)
        return {"message": f"Successfully cleared {count} activities"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/user/stats", response_model=UserStatsResponse)
async def get_user_stats(current_user=Depends(get_current_user)):
    """Get current user's statistics."""
    try:
        service = ActivityService(prisma)
        stats = await service.get_user_stats(current_user.id)
        return UserStatsResponse(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# Document Routes
# =====================


@app.get("/documents", response_model=PaginatedDocumentsResponse)
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


@app.delete("/documents/batch")
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
            # Record activity (just record one generic activity for the batch)
            await record_document_delete(
                prisma, target_user_id, 0
            )  # 0 indicates batch/unknown

        return {"message": f"Successfully deleted {count} documents"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents/{doc_id}", response_model=DocumentItem)
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


@app.delete("/documents/{doc_id}")
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

        # Record activity
        await record_document_delete(prisma, target_user_id, doc_id)

        return {"message": "Document deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/documents/{doc_id}")
async def update_document(
    doc_id: int,
    data: DocumentUpdateInput,
    current_user=Depends(get_chat_user)
):
    """Update a document by ID (supports API Key authentication).
    
    If content is updated, the document will be re-vectorized automatically.
    
    Args:
        doc_id: Document ID to update
        data: Update data containing:
            - content: New content (optional, triggers re-vectorization if provided)
            - metadata: New metadata (optional)
            - group_id: New group ID (optional, only used if update_group is True)
            - update_group: Whether to update the group assignment
    
    Returns:
        Updated document info
    """
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
        
        return {
            "message": "Document updated successfully",
            "document": result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/documents")
async def add_document(doc: DocumentInput, current_user=Depends(get_chat_user)):
    try:
        group_id = None
        group_name = None
        
        if doc.metadata:
            # Support groupId (int) or groupName (string, will create if not exists)
            group_id = doc.metadata.get("groupId")
            group_name = doc.metadata.get("groupName")
            
            # Remove group fields from metadata to keep it clean
            doc.metadata.pop("groupId", None)
            doc.metadata.pop("groupName", None)
        
        # Process groupId if provided
        if group_id is not None:
            try:
                group_id = int(group_id)
            except (ValueError, TypeError):
                group_id = None
        
        # If groupName is provided but not groupId, find or create the group
        if group_name and not group_id:
            group_name = str(group_name).strip()
            if group_name:
                group_id = await store.find_or_create_group(
                    user_id=current_user.id,
                    name=group_name
                )
            
        doc_id = await store.add_document(
            user_id=current_user.id, content=doc.content, metadata=doc.metadata, group_id=group_id
        )

        # Record activity
        await record_document_add(prisma, current_user.id, doc_id, doc.content[:50])

        return {"id": doc_id, "message": "Document added successfully", "groupId": group_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Maximum file size: 50MB
MAX_FILE_SIZE = 50 * 1024 * 1024


@app.post("/documents/parse")
async def parse_document(
    file: UploadFile = File(...),
    current_user=Depends(get_chat_user)
):
    """
    Parse a document file and return extracted text content.
    This endpoint only extracts text without storing the document.
    
    Supported formats:
    - PDF (.pdf): Text extraction using PyMuPDF
    - Word (.docx): Text extraction using python-docx
    - Text (.txt, .md, .markdown): Direct text import
    
    Returns the extracted text that can be appended to the input field.
    """
    try:
        # Validate file type
        filename = file.filename or "unknown"
        if not FileParser.is_supported(filename):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Supported: {', '.join(sorted(FileParser.SUPPORTED_EXTENSIONS))}"
            )
        
        # Read file content
        file_bytes = await file.read()
        
        # Check file size
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB"
            )
        
        # Check if file is empty
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Parse file and extract text
        try:
            content = FileParser.parse_file(filename, file_bytes)
        except FileParseError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Validate extracted content
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


@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    group_id: Optional[int] = Form(None),
    group_name: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    current_user=Depends(get_chat_user)
):
    """
    Upload a document file (PDF, DOCX, TXT, MD) and extract text content.
    
    Supported formats:
    - PDF (.pdf): Text extraction using PyMuPDF
    - Word (.docx): Text extraction using python-docx
    - Text (.txt, .md, .markdown): Direct text import
    
    The extracted text will be stored as a document with optional metadata.
    """
    try:
        # Validate file type
        filename = file.filename or "unknown"
        if not FileParser.is_supported(filename):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Supported: {', '.join(sorted(FileParser.SUPPORTED_EXTENSIONS))}"
            )
        
        # Read file content
        file_bytes = await file.read()
        
        # Check file size
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB"
            )
        
        # Check if file is empty
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Parse file and extract text
        try:
            content = FileParser.parse_file(filename, file_bytes)
        except FileParseError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Validate extracted content
        if not content or not content.strip():
            raise HTTPException(
                status_code=400,
                detail="No text content could be extracted from the file"
            )
        
        # Build metadata
        metadata = {
            "originalFilename": filename,
            "fileType": filename.rsplit('.', 1)[-1].lower() if '.' in filename else "unknown",
            "fileSize": len(file_bytes),
        }
        
        if category and category.strip():
            metadata["category"] = category.strip()
        if source and source.strip():
            metadata["source"] = source.strip()
        
        # Handle group assignment
        resolved_group_id = None
        
        if group_id is not None:
            resolved_group_id = group_id
        elif group_name and group_name.strip():
            resolved_group_id = await store.find_or_create_group(
                user_id=current_user.id,
                name=group_name.strip()
            )
        
        # Store document
        doc_id = await store.add_document(
            user_id=current_user.id,
            content=content,
            metadata=metadata,
            group_id=resolved_group_id
        )
        
        # Record activity
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

@app.get("/groups", response_model=List[DocumentGroup])
async def list_groups(current_user=Depends(get_current_user)):
    """Get all document groups for the current user."""
    try:
        return await store.get_groups(user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/groups", response_model=DocumentGroup)
async def create_group(group: DocumentGroupInput, current_user=Depends(get_current_user)):
    """Create a new document group."""
    try:
        return await store.create_group(user_id=current_user.id, name=group.name)
    except Exception as e:
        # Check for unique constraint violation (name + user)
        if "Unique constraint failed" in str(e):
             raise HTTPException(status_code=400, detail="Group with this name already exists")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/groups/{group_id}", response_model=DocumentGroup)
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


@app.delete("/groups/{group_id}")
async def delete_group(
    group_id: int,
    delete_documents: bool = Query(False, description="Whether to delete documents in the group"),
    current_user=Depends(get_current_user)
):
    """Delete a document group (Web UI - Cookie authentication).
    
    If delete_documents is False (default), documents in the group will be preserved
    and their groupId will be set to null (moved to 'All Documents').
    
    If delete_documents is True, all documents in the group will be permanently deleted.
    """
    try:
        result = await store.delete_group(
            user_id=current_user.id,
            group_id=group_id,
            delete_documents=delete_documents
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Group not found")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# External API Routes (API Key Authentication)
# =====================


@app.delete("/api/documents/{doc_id}")
async def api_delete_document(
    doc_id: int,
    current_user=Depends(get_chat_user)
):
    """Delete a document by ID (supports API Key authentication).
    
    This endpoint is designed for external programs to delete documents.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    Args:
        doc_id: Document ID to delete
    
    Returns:
        Success message
    """
    try:
        deleted = await store.delete_document(user_id=current_user.id, doc_id=doc_id)
        if not deleted:
            raise HTTPException(
                status_code=404, detail="Document not found or permission denied"
            )

        # Record activity
        await record_document_delete(prisma, current_user.id, doc_id)

        return {"message": "Document deleted successfully", "id": doc_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BatchDeleteApiInput(BaseModel):
    ids: List[int]


@app.delete("/api/documents/batch")
async def api_delete_documents_batch(
    data: BatchDeleteApiInput,
    current_user=Depends(get_chat_user)
):
    """Batch delete documents by IDs (supports API Key authentication).
    
    This endpoint is designed for external programs to delete multiple documents at once.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    Args:
        data: Object containing list of document IDs to delete
    
    Returns:
        Success message with count of deleted documents
    """
    try:
        count = await store.delete_documents(user_id=current_user.id, doc_ids=data.ids)

        if count > 0:
            # Record activity
            await record_document_delete(prisma, current_user.id, 0)

        return {"message": f"Successfully deleted {count} documents", "deletedCount": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class MoveDocumentInput(BaseModel):
    group_id: Optional[int] = None
    group_name: Optional[str] = None


@app.put("/api/documents/{doc_id}/move")
async def api_move_document(
    doc_id: int,
    data: MoveDocumentInput,
    current_user=Depends(get_chat_user)
):
    """Move a document to a different group (supports API Key authentication).
    
    This endpoint is designed for external programs to move documents between groups.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    Set both group_id and group_name to null to remove the document from its group.
    If group_name is provided (and group_id is not), the group will be created if it doesn't exist.
    
    Args:
        doc_id: Document ID to move
        data: Target group (by id or name, or null to ungroup)
    
    Returns:
        Updated document info
    """
    try:
        # Determine target group ID
        target_group_id = None
        
        if data.group_id is not None:
            target_group_id = data.group_id
            # Verify group exists and belongs to user
            group = await prisma.documentgroup.find_first(
                where={"id": target_group_id, "userId": current_user.id}
            )
            if not group:
                raise HTTPException(status_code=404, detail="Target group not found")
        elif data.group_name is not None and data.group_name.strip():
            # Find or create group by name
            target_group_id = await store.find_or_create_group(
                user_id=current_user.id,
                name=data.group_name.strip()
            )
        
        # Update document's group
        result = await store.update_document(
            user_id=current_user.id,
            doc_id=doc_id,
            group_id=target_group_id,
            update_group=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {
            "message": "Document moved successfully",
            "document": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/documents/{doc_id}")
async def api_update_document(
    doc_id: int,
    data: DocumentUpdateInput,
    current_user=Depends(get_chat_user)
):
    """Update a document by ID (supports API Key authentication).
    
    This endpoint is designed for external programs to update documents.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    If content is updated, the document will be re-vectorized automatically.
    
    Args:
        doc_id: Document ID to update
        data: Update data containing:
            - content: New content (optional, triggers re-vectorization if provided)
            - metadata: New metadata (optional)
            - group_id: New group ID (optional, only used if update_group is True)
            - update_group: Whether to update the group assignment
    
    Returns:
        Updated document info
    """
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
        
        return {
            "message": "Document updated successfully",
            "document": result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def api_get_stats(current_user=Depends(get_chat_user)):
    """Get user statistics (supports API Key authentication).
    
    This endpoint is designed for external programs to get statistics.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    Returns:
        Statistics including total documents, groups, and usage info
    """
    try:
        total_documents = await store.get_total_documents(user_id=current_user.id)
        groups = await store.get_groups(user_id=current_user.id)
        total_groups = len(groups)
        
        return {
            "totalDocuments": total_documents,
            "totalGroups": total_groups,
            "groups": groups
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/groups", response_model=List[DocumentGroup])
async def api_list_groups(current_user=Depends(get_chat_user)):
    """Get all document groups for the current user (supports API Key authentication).
    
    This endpoint is designed for external programs to list groups.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    Returns:
        List of document groups with id, name, createdAt, and documentCount
    """
    try:
        return await store.get_groups(user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/groups", response_model=DocumentGroup)
async def api_create_group(group: DocumentGroupInput, current_user=Depends(get_chat_user)):
    """Create a new document group (supports API Key authentication).
    
    This endpoint is designed for external programs to create groups.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    Args:
        group: Group name
    
    Returns:
        Created group info
    """
    try:
        return await store.create_group(user_id=current_user.id, name=group.name)
    except Exception as e:
        if "Unique constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Group with this name already exists")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/groups/{group_id}", response_model=DocumentGroup)
async def api_update_group(group_id: int, group: DocumentGroupInput, current_user=Depends(get_chat_user)):
    """Update a document group by ID (supports API Key authentication).
    
    This endpoint is designed for external programs to rename groups.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    Args:
        group_id: Group ID
        group: New group name
    
    Returns:
        Updated group info
    """
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


@app.put("/api/groups/by-name/{group_name}", response_model=DocumentGroup)
async def api_update_group_by_name(group_name: str, group: DocumentGroupInput, current_user=Depends(get_chat_user)):
    """Update a document group by name (supports API Key authentication).
    
    This endpoint is designed for external programs to rename groups using the current name.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    Args:
        group_name: Current group name (case-sensitive)
        group: New group name
    
    Returns:
        Updated group info
    """
    try:
        # Find group by name
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


@app.get("/api/groups/by-name/{group_name}/documents")
async def api_list_documents_by_group_name(
    group_name: str,
    current_user=Depends(get_chat_user)
):
    """List all documents in a group by group name (supports API Key authentication).
    
    This endpoint is designed for external programs to list documents in a specific group.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    Args:
        group_name: Group name (case-sensitive)
    
    Returns:
        List of documents with id, content preview, metadata, and created_at
    """
    try:
        documents, group_id = await store.get_documents_by_group_name(
            user_id=current_user.id,
            group_name=group_name
        )
        
        if group_id is None:
            raise HTTPException(status_code=404, detail=f"Group '{group_name}' not found")
        
        return {
            "groupId": group_id,
            "groupName": group_name,
            "documents": documents,
            "total": len(documents)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/groups/by-name/{group_name}/documents/{doc_id}")
async def api_get_document_in_group(
    group_name: str,
    doc_id: int,
    include_vector: bool = Query(True, description="Whether to include the embedding vector"),
    current_user=Depends(get_chat_user)
):
    """Get a specific document in a group with its embedding vector (supports API Key authentication).
    
    This endpoint is designed for external programs to get document details including the vector.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    Args:
        group_name: Group name (case-sensitive)
        doc_id: Document ID
        include_vector: Whether to include the embedding vector (default: True)
    
    Returns:
        Document with content, metadata, and optionally the embedding vector
    """
    try:
        # First find the group
        group = await prisma.documentgroup.find_first(
            where={"userId": current_user.id, "name": group_name}
        )
        
        if not group:
            raise HTTPException(status_code=404, detail=f"Group '{group_name}' not found")
        
        if include_vector:
            document = await store.get_document_with_vector(
                user_id=current_user.id,
                doc_id=doc_id,
                group_id=group.id
            )
        else:
            # Get document without vector
            document = await store.get_document(
                user_id=current_user.id,
                doc_id=doc_id
            )
            # Verify it belongs to the group
            if document and document.get("group") and document["group"].get("id") != group.id:
                document = None
        
        if not document:
            raise HTTPException(
                status_code=404,
                detail=f"Document {doc_id} not found in group '{group_name}'"
            )
        
        return document
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/groups/{group_id}")
async def api_delete_group(
    group_id: int,
    delete_documents: bool = Query(True, description="Whether to delete all documents in the group (default: True)"),
    current_user=Depends(get_chat_user)
):
    """Delete a document group by ID (supports API Key authentication).
    
    This endpoint is designed for external programs to delete groups.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    By default (delete_documents=True), all documents in the group will be permanently deleted.
    Set delete_documents=False to preserve documents (their groupId will be set to null).
    
    Args:
        group_id: Group ID to delete
        delete_documents: Whether to delete all documents in the group (default: True)
    
    Returns:
        Deletion result with count of deleted documents
    """
    try:
        result = await store.delete_group(
            user_id=current_user.id,
            group_id=group_id,
            delete_documents=delete_documents
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Group not found or permission denied")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/groups/by-name/{group_name}")
async def api_delete_group_by_name(
    group_name: str,
    delete_documents: bool = Query(True, description="Whether to delete all documents in the group (default: True)"),
    current_user=Depends(get_chat_user)
):
    """Delete a document group by name (supports API Key authentication).
    
    This endpoint is designed for external programs to delete groups using the group name.
    Authentication via API Key header: Authorization: Bearer rag-xxx
    
    By default (delete_documents=True), all documents in the group will be permanently deleted.
    Set delete_documents=False to preserve documents (their groupId will be set to null).
    
    Args:
        group_name: Group name to delete (case-sensitive)
        delete_documents: Whether to delete all documents in the group (default: True)
    
    Returns:
        Deletion result with count of deleted documents
    """
    try:
        # Find group by name
        group = await prisma.documentgroup.find_first(
            where={"userId": current_user.id, "name": group_name}
        )
        if not group:
            raise HTTPException(status_code=404, detail=f"Group '{group_name}' not found")
        
        result = await store.delete_group(
            user_id=current_user.id,
            group_id=group.id,
            delete_documents=delete_documents
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Group not found or permission denied")
        
        # Add group name to result for clarity
        result["groupName"] = group_name
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/groups/assign")
async def assign_group(data: GroupAssignInput, current_user=Depends(get_current_user)):
    """Assign documents to a group."""
    try:
        count = await store.assign_documents_to_group(
            user_id=current_user.id,
            group_id=data.group_id,
            doc_ids=data.doc_ids
        )
        return {"message": f"Successfully assigned {count} documents"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class GroupExportRequest(BaseModel):
    include_vectors: bool = False


class GroupImportRequest(BaseModel):
    import_data: Dict[str, Any]
    use_existing_vectors: bool = False


@app.post("/groups/{group_id}/export")
async def export_group(
    group_id: int,
    request: GroupExportRequest,
    current_user=Depends(get_current_user)
):
    """Export a document group.
    
    If include_vectors is True, the export will include embedding vectors.
    This is useful for migrating to another instance with the same embedding model.
    The export will include the embedding model name and vector dimension for reference.
    """
    try:
        export_data = await store.export_group(
            user_id=current_user.id,
            group_id=group_id,
            include_vectors=request.include_vectors
        )
        if not export_data:
            raise HTTPException(status_code=404, detail="Group not found")
        return export_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/groups/import")
async def import_group(
    request: GroupImportRequest,
    current_user=Depends(get_current_user)
):
    """Import a document group.
    
    If use_existing_vectors is True and the import data contains vectors,
    those vectors will be used directly. This requires the same embedding model
    configuration on the target system.
    
    If use_existing_vectors is False, new embeddings will be generated using
    the current system's embedding model.
    
    A new group will always be created. If a group with the same name exists,
    a suffix like (1), (2) will be added automatically.
    """
    try:
        import_data = request.import_data
        
        # Validate that vectors exist if user wants to use them
        if request.use_existing_vectors:
            if not import_data.get("includesVectors"):
                raise HTTPException(
                    status_code=400,
                    detail="Import data does not include vectors. Please select 'Generate new vectors' option."
                )
            # Check if any document has embedding
            has_vectors = any(doc.get("embedding") for doc in import_data.get("documents", []))
            if not has_vectors:
                raise HTTPException(
                    status_code=400,
                    detail="Import data claims to include vectors but no vectors found in documents."
                )
        
        result = await store.import_group(
            user_id=current_user.id,
            import_data=import_data,
            use_existing_vectors=request.use_existing_vectors
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search", response_model=PaginatedSearchResponse)
async def search_documents(
    query: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(5, ge=1, le=50, description="Results per page"),
    group_id: Optional[int] = Query(None, description="Filter by group ID (optional)"),
    group_name: Optional[str] = Query(None, description="Filter by group name (optional, more user-friendly)"),
    current_user=Depends(get_chat_user),
):
    """Search documents with optional group filtering.
    
    You can filter by either group_id or group_name:
    - group_id: Filter by exact group ID
    - group_name: Filter by group name (case-sensitive)
    
    If both are provided, group_id takes precedence.
    Omit both to search all documents.
    """
    try:
        # Resolve group_name to group_id if provided
        resolved_group_id = group_id
        if group_name and not group_id:
            # Find group by name
            group = await prisma.documentgroup.find_first(
                where={"userId": current_user.id, "name": group_name}
            )
            if group:
                resolved_group_id = group.id
            else:
                # Group not found, return empty results
                return PaginatedSearchResponse(
                    results=[],
                    total=0,
                    page=page,
                    page_size=page_size,
                    total_pages=0,
                )

        offset = (page - 1) * page_size
        # Use user's similarity threshold for regular search too
        user_similarity = (
            current_user.similarityThreshold
            if current_user.similarityThreshold is not None
            else 0.8
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

        # Record activity
        await record_search(prisma, current_user.id, query, total)

        return PaginatedSearchResponse(
            results=results,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats")
async def get_stats(current_user=Depends(get_current_user)):
    try:
        total = await store.get_total_documents(user_id=current_user.id)
        return {"total_documents": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/system/instances")
async def get_active_instances():
    """Get list of active backend instances connected to Redis."""
    try:
        instances = await RedisService.get_active_instances()
        return {"count": len(instances), "instances": instances}
    except Exception as e:
        # If Redis is not available, return empty list
        return {"count": 0, "instances": []}


@app.get("/system/config")
async def get_public_config():
    """Get public system configurations (no authentication required)."""
    try:
        configs = await config_service.get_public_configs()
        return configs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/config")
async def get_system_config(current_user=Depends(get_current_user)):
    """Get all system configurations (Admin only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        configs = await config_service.get_all_configs()
        return configs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/config")
async def update_system_config(
    input_data: SystemConfigInput, current_user=Depends(get_current_user)
):
    """Update system configurations (Admin only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        for key, value in input_data.configs.items():
            await config_service.set_config(key, value)
            
        return {"message": "Configuration updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/stats")
async def get_admin_stats(current_user=Depends(get_current_user)):
    """Get admin statistics."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        total_users = await prisma.user.count()
        total_documents = await prisma.document.count()
        total_activities = await prisma.activity.count()
        
        return {
            "totalUsers": total_users,
            "totalDocuments": total_documents,
            "totalActivities": total_activities
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/users")
async def get_users(
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    role: Optional[str] = None,
    current_user=Depends(get_current_user)
):
    """Get paginated users list."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        skip = (page - 1) * page_size
        where = {}
        if search:
            where["OR"] = [
                {"username": {"contains": search, "mode": "insensitive"}},
                {"email": {"contains": search, "mode": "insensitive"}},
            ]
        
        if role:
            where["role"] = role
            
        users = await prisma.user.find_many(
            where=where,
            skip=skip,
            take=page_size,
            order={"createdAt": "desc"},
            include={"documents": True}  # We'll count them in python to avoid complex aggregation query issues if any
        )
        
        # Transform users to include document count
        users_with_count = []
        for user in users:
            user_dict = user.dict()
            user_dict["documentCount"] = len(user.documents)
            del user_dict["documents"] # Remove the full list to save bandwidth
            users_with_count.append(user_dict)
        
        total = await prisma.user.count(where=where)
        
        return {
            "users": users_with_count,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/users/{user_id}/ban")
async def ban_user(user_id: int, input_data: BanInput, current_user=Depends(get_current_user)):
    """Ban a user."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")
        
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot ban yourself")

    try:
        await prisma.user.update(
            where={"id": user_id},
            data={
                "banned": True,
                "banReason": input_data.reason,
                "bannedAt": datetime.utcnow()
            }
        )
        return {"message": "User banned successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/users/{user_id}/unban")
async def unban_user(user_id: int, current_user=Depends(get_current_user)):
    """Unban a user."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")

    try:
        await prisma.user.update(
            where={"id": user_id},
            data={
                "banned": False,
                "banReason": None,
                "bannedAt": None
            }
        )
        return {"message": "User unbanned successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/user/settings", response_model=UserResponse)
async def update_user_settings(
    input_data: UpdateSettingsInput, current_user=Depends(get_current_user)
):
    """Update user settings."""
    try:
        if not prisma.is_connected():
            await prisma.connect()

        user = await prisma.user.update(
            where={"id": current_user.id},
            data={
                "topK": input_data.topK,
                "similarityThreshold": input_data.similarityThreshold,
            },
        )

        # Record activity
        await record_settings_update(
            prisma,
            current_user.id,
            f"Updated settings: Top K={input_data.topK}, Threshold={input_data.similarityThreshold}",
        )

        return user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# API Key Routes
# =====================


@app.get("/user/apikeys", response_model=List[ApiKeyResponse])
async def get_api_keys(current_user=Depends(get_current_user)):
    """Get user's API keys."""
    try:
        api_keys = await prisma.apikey.find_many(
            where={"userId": current_user.id},
            order={"createdAt": "desc"}
        )
        return api_keys
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/user/apikeys", response_model=ApiKeyResponse)
async def create_api_key(
    input_data: ApiKeyCreateInput, current_user=Depends(get_current_user)
):
    """Create a new API key."""
    try:
        # Generate a secure random key
        key = f"rag-{uuid.uuid4().hex}"
        
        api_key = await prisma.apikey.create(
            data={
                "key": key,
                "name": input_data.name,
                "userId": current_user.id,
                "expiresAt": input_data.expiresAt,
            }
        )
        return api_key
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/user/apikeys/{key_id}")
async def delete_api_key(key_id: int, current_user=Depends(get_current_user)):
    """Delete an API key."""
    try:
        # Verify ownership
        api_key = await prisma.apikey.find_unique(where={"id": key_id})
        if not api_key or api_key.userId != current_user.id:
            raise HTTPException(status_code=404, detail="API key not found")
            
        await prisma.apikey.delete(where={"id": key_id})
        return {"message": "API key deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag", response_model=RAGResponse)
@rate_limit(key_prefix="rag_query")
async def rag_query(
    input_data: RAGQueryInput, request: Request, current_user=Depends(get_current_user)
):
    """RAG (Retrieval Augmented Generation) endpoint.

    Retrieves relevant documents and generates an answer using LLM.
    """
    try:
        # Use user's topK setting if not provided in request
        top_k = input_data.top_k or current_user.topK or 5

        # Convert similarity threshold (0-1, higher is better) to distance threshold (lower is better)
        # Default similarity is 0.8 if not set
        user_similarity = (
            current_user.similarityThreshold
            if current_user.similarityThreshold is not None
            else 0.8
        )
        distance_threshold = 1.0 - user_similarity

        results, _ = await store.search(
            user_id=current_user.id,
            query=input_data.query,
            threshold=distance_threshold,
            limit=top_k,
        )

        # Record activity
        await record_rag_query(prisma, current_user.id, input_data.query)

        if not results:
            return RAGResponse(
                answer="I couldn't find any relevant documents to answer your question.",
                sources=[],
            )

        answer = llm_service.chat_completion(
            query=input_data.query,
            contexts=results,
            temperature=input_data.temperature,
            max_tokens=input_data.max_tokens,
        )

        return RAGResponse(answer=answer, sources=results)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/models")
async def list_models(current_user=Depends(get_current_user)):
    """List available models (OpenAI Compatible)."""
    try:
        models = await llm_service.list_models()
        return {"object": "list", "data": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/chat/completions")
@rate_limit(key_prefix="rag_stream")
async def chat_completions(
    input_data: OpenAIRequest, request: Request, current_user=Depends(get_chat_user)
):
    """OpenAI Compatible Chat Completions Endpoint.

    Retrieves relevant documents and streams the generated answer.
    """
    try:
        # Extract query from the last user message
        last_user_message = next(
            (m for m in reversed(input_data.messages) if m.role == "user"), None
        )
        if not last_user_message:
            raise HTTPException(status_code=400, detail="No user message found")

        query = last_user_message.content

        # Extract system prompt if present
        system_message = next(
            (m for m in input_data.messages if m.role == "system"), None
        )
        system_prompt = system_message.content if system_message else None

        # Parse model field to extract actual model name and optional group name
        # Format: "model-name" or "model-name-Group Name"
        # Rule: Find the last "-", the part after it is the group name
        actual_model = input_data.model or "default"
        group_id_for_search = None
        
        if actual_model and actual_model != "default":
            last_dash_idx = actual_model.rfind("-")
            if last_dash_idx > 0:  # Must have at least one char before the dash
                potential_group_name = actual_model[last_dash_idx + 1:]
                potential_model_name = actual_model[:last_dash_idx]
                
                if potential_group_name:  # Group name is not empty
                    # Try to find the group by name
                    group = await prisma.documentgroup.find_first(
                        where={"userId": current_user.id, "name": potential_group_name}
                    )
                    if group:
                        # Group exists, use it for filtering
                        group_id_for_search = group.id
                        actual_model = potential_model_name
                    # If group doesn't exist, keep the original model name and search all docs

        # Construct conversation history for context
        # We'll use the last few messages to build context if needed,
        # but for RAG search we primarily use the latest query.
        # However, we might want to refine the query based on history in the future.

        # Use user's topK setting if not provided in request
        top_k = input_data.top_k or current_user.topK or 5

        # Convert similarity threshold to distance threshold
        user_similarity = (
            current_user.similarityThreshold
            if current_user.similarityThreshold is not None
            else 0.8
        )
        distance_threshold = 1.0 - user_similarity

        # Determine search query - use current query for RAG search
        search_query = query
        
        # Build conversation history from OpenAI-format messages
        # Standard OpenAI clients send full conversation history in messages array
        # We extract all messages except system and current user query as history
        history_messages = []
        
        # Filter out system messages and build history
        non_system_messages = [m for m in input_data.messages if m.role != "system"]
        
        # Remove the last user message (current query) from history to avoid duplication
        # since it will be added by llm_service wrapped with RAG context
        if non_system_messages and non_system_messages[-1].role == "user" and non_system_messages[-1].content == query:
            non_system_messages = non_system_messages[:-1]
        
        # Keep conversation history (last 20 messages to maintain context)
        history_messages = [{"role": m.role, "content": m.content} for m in non_system_messages[-20:]]

        results, _ = await store.search(
            user_id=current_user.id,
            query=search_query,
            threshold=distance_threshold,
            limit=top_k,
            group_id=group_id_for_search,
        )

        # Record activity
        await record_rag_query(prisma, current_user.id, query)

        async def stream_generator():
            chat_id = f"chatcmpl-{uuid.uuid4()}"
            created = int(time.time())

            # Send sources first (custom extension in OpenAI format)
            if results:
                sources_data = {
                    "id": chat_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": actual_model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"role": "assistant", "content": ""},
                            "finish_reason": None,
                        }
                    ],
                    "sources": [s.dict() if hasattr(s, "dict") else s for s in results],
                }
                yield f"data: {json.dumps(sources_data)}\n\n"

            # Even if no results, let the AI handle it (it will be prompted not to hallucinate)
            async for chunk in llm_service.chat_completion_stream(
                query=query,
                contexts=results,
                system_prompt=system_prompt,
                history=history_messages,
                temperature=input_data.temperature,
                max_tokens=input_data.max_tokens,
                model=actual_model,
            ):
                # Build delta with content and/or reasoning_content
                delta = {}
                if "content" in chunk:
                    delta["content"] = chunk["content"]
                if "reasoning_content" in chunk:
                    delta["reasoning_content"] = chunk["reasoning_content"]
                
                chunk_data = {
                    "id": chat_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": actual_model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": delta,
                            "finish_reason": None,
                        }
                    ],
                }
                yield f"data: {json.dumps(chunk_data)}\n\n"

            yield "data: [DONE]\n\n"

        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            },
        )

    except Exception as e:
        print(f"Error in chat_completions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
