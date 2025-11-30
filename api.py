from fastapi import FastAPI, HTTPException, Query, Depends, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, RedirectResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime
from document_store import DocumentStore
from llm_service import LLMService
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


class OpenAIRequest(BaseModel):
    messages: List[OpenAIMessage]
    model: Optional[str] = "default"
    stream: Optional[bool] = False
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1024
    top_k: Optional[int] = None
    use_history: Optional[bool] = False


class RAGResponse(BaseModel):
    answer: str
    sources: List[SearchResult]


class DocumentItem(BaseModel):
    id: int
    content: str
    metadata: Dict[str, Any]
    created_at: Optional[str] = None


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
            user_id=target_user_id, limit=page_size, offset=offset
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


@app.post("/documents")
async def add_document(doc: DocumentInput, current_user=Depends(get_current_user)):
    try:
        doc_id = await store.add_document(
            user_id=current_user.id, content=doc.content, metadata=doc.metadata
        )

        # Record activity
        await record_document_add(prisma, current_user.id, doc_id, doc.content[:50])

        return {"id": doc_id, "message": "Document added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search", response_model=PaginatedSearchResponse)
async def search_documents(
    query: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(5, ge=1, le=50, description="Results per page"),
    current_user=Depends(get_current_user),
):
    try:

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

        # Determine search query
        search_query = query
        if input_data.use_history:
            # Get up to last 10 messages
            # Filter out system messages to avoid polluting search with instructions
            recent_messages = [m for m in input_data.messages if m.role != "system"][-10:]
            if recent_messages:
                search_query = "\n".join([m.content for m in recent_messages])

        results, _ = await store.search(
            user_id=current_user.id,
            query=search_query,
            threshold=distance_threshold,
            limit=top_k,
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
                    "model": input_data.model,
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

            if not results:
                no_result_data = {
                    "id": chat_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": input_data.model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {
                                "content": "I couldn't find any relevant documents to answer your question."
                            },
                            "finish_reason": None,
                        }
                    ],
                }
                yield f"data: {json.dumps(no_result_data)}\n\n"
                yield "data: [DONE]\n\n"
                return

            async for chunk in llm_service.chat_completion_stream(
                query=query,
                contexts=results,
                system_prompt=system_prompt,
                temperature=input_data.temperature,
                max_tokens=input_data.max_tokens,
                model=input_data.model,
            ):
                chunk_data = {
                    "id": chat_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": input_data.model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": chunk},
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
