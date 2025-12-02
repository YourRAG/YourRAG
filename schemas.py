"""Pydantic schemas for API request/response models."""

from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime


# =====================
# Document Schemas
# =====================


class DocumentInput(BaseModel):
    content: str
    metadata: Optional[Dict[str, Any]] = {}


class BatchDeleteInput(BaseModel):
    ids: List[int]


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
    vector_dim: Optional[int] = None
    vector_preview: Optional[List[float]] = None


class PaginatedDocumentsResponse(BaseModel):
    documents: List[DocumentItem]
    total: int
    page: int
    page_size: int
    total_pages: int


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


class MoveDocumentInput(BaseModel):
    group_id: Optional[int] = None
    group_name: Optional[str] = None


class BatchDeleteApiInput(BaseModel):
    ids: List[int]


class GroupExportRequest(BaseModel):
    include_vectors: bool = False


class GroupImportRequest(BaseModel):
    import_data: Dict[str, Any]
    use_existing_vectors: bool = False


class SmartChunkRequest(BaseModel):
    """Request for smart document chunking."""
    content: str


class ChunkSuggestion(BaseModel):
    """A suggested chunk with start and end positions."""
    start: int
    end: int
    summary: str


class SmartChunkResponse(BaseModel):
    """Response containing chunked document segments."""
    chunks: List[str]
    chunk_count: int


# =====================
# User Schemas
# =====================


class BanInput(BaseModel):
    reason: str


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
    credits: int = 0


class UpdateSettingsInput(BaseModel):
    topK: int
    similarityThreshold: float


# =====================
# Activity Schemas
# =====================


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


# =====================
# System Config Schemas
# =====================


class SystemConfigInput(BaseModel):
    configs: Dict[str, str]


# =====================
# API Key Schemas
# =====================


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
# RAG/Chat Schemas
# =====================


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