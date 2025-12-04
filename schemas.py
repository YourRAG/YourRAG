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
# =====================
# Transaction Schemas
# =====================


class TransactionItem(BaseModel):
    id: int
    userId: int
    type: str
    status: str
    amount: int
    balanceBefore: int
    balanceAfter: int
    description: str
    referenceId: Optional[str] = None
    referenceType: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True


class TransactionResponse(BaseModel):
    transaction: TransactionItem


class TransactionsResponse(BaseModel):
    transactions: List[TransactionItem]
    total: int
    limit: int
    offset: int


class CreditsSummaryResponse(BaseModel):
    balance: int
    totalRecharged: int
    totalConsumed: int
    totalBonus: int


class AdjustCreditsRequest(BaseModel):
    userId: int
    amount: int
    description: str


class BatchAdjustCreditsRequest(BaseModel):
    userIds: List[int]
    amount: int
    description: str


class BulkAdjustmentItem(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    userId: Optional[int] = None
    amount: int
    description: str
    referenceId: Optional[str] = None


class BulkImportResponse(BaseModel):
    total: int
    successful: int
    failed: int
    results: List[Dict[str, Any]]


class GrantBonusRequest(BaseModel):
    userId: int
    amount: int
    description: str
    reason: Optional[str] = None

# =====================
# Redemption Schemas
# =====================


class RedemptionGenerateRequest(BaseModel):
    amount: int
    count: int = 1
    expiresAt: Optional[datetime] = None
    prefix: Optional[str] = ""


class RedemptionUseRequest(BaseModel):
    code: str


class RedemptionCodeResponse(BaseModel):
    id: int
    code: str
    amount: int
    status: str
    createdAt: datetime
    expiresAt: Optional[datetime]
    usedAt: Optional[datetime]
    createdBy: int
    usedBy: Optional[int]


class RedemptionListResponse(BaseModel):
    items: List[RedemptionCodeResponse]
    total: int
    page: int
    pageSize: int


# =====================
# Export Schemas
# =====================


class ExportUserInfo(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    avatarUrl: Optional[str] = None
    role: str
    topK: int
    similarityThreshold: float
    credits: int


class ExportDocumentItem(BaseModel):
    id: int
    content: str
    metadata: Optional[Dict[str, Any]] = None
    groupId: Optional[int] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class ExportGroupItem(BaseModel):
    id: int
    name: str
    documentCount: int
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class ExportActivityItem(BaseModel):
    id: int
    type: str
    title: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    createdAt: Optional[str] = None


class ExportTransactionItem(BaseModel):
    id: int
    type: str
    status: str
    amount: int
    balanceBefore: int
    balanceAfter: int
    description: str
    referenceId: Optional[str] = None
    referenceType: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class ExportApiKeyItem(BaseModel):
    id: int
    name: str
    keyPrefix: Optional[str] = None
    isActive: bool
    createdAt: Optional[str] = None
    expiresAt: Optional[str] = None
    lastUsedAt: Optional[str] = None


class UserDataExportResponse(BaseModel):
    exportedAt: str
    version: str
    user: ExportUserInfo
    documents: Optional[List[ExportDocumentItem]] = None
    groups: Optional[List[ExportGroupItem]] = None
    activities: Optional[List[ExportActivityItem]] = None
    transactions: Optional[List[ExportTransactionItem]] = None
    apiKeys: Optional[List[ExportApiKeyItem]] = None


# =====================
# Fact Check Schemas
# =====================


class FactCheckSource(BaseModel):
    """A source used for fact checking."""
    title: str
    url: str
    snippet: str


class FactCheckRequest(BaseModel):
    """Request for fact checking a document."""
    content: str
    current_time: Optional[str] = None  # ISO 8601 format from client browser


class FactCheckResponse(BaseModel):
    """Response containing fact check results."""
    credibility_score: int  # 0-100 percentage
    verdict: str  # "verified" | "mostly_true" | "mixed" | "unverified" | "false"
    analysis: str  # Detailed analysis explanation
    sources: List[FactCheckSource]  # Sources used for verification
    claims_checked: int  # Number of claims checked


# =====================
# Knowledge Check Schemas
# =====================


class KnowledgeCheckSource(BaseModel):
    """A source document used for knowledge checking."""
    doc_id: int
    title: str
    snippet: str
    similarity: float  # Similarity score (0-1)


class KnowledgeCheckRequest(BaseModel):
    """Request for knowledge checking a document against existing knowledge base."""
    content: str
    group_id: Optional[int] = None  # Optional: limit search to specific group


class KnowledgeCheckResponse(BaseModel):
    """Response containing knowledge check results."""
    consistency_score: int  # 0-100 percentage
    verdict: str  # "consistent" | "mostly_consistent" | "mixed" | "no_reference" | "inconsistent"
    analysis: str  # Detailed analysis explanation
    sources: List[KnowledgeCheckSource]  # Source documents from knowledge base
    claims_checked: int  # Number of claims checked


# =====================
# URL Import Schemas
# =====================


class UrlImportRequest(BaseModel):
    """Request for importing content from a URL."""
    url: str
    max_characters: int = 10000


class UrlImportResponse(BaseModel):
    """Response containing imported content from URL."""
    content: str
    source_url: str
    title: Optional[str] = None
    content_length: int


# =====================
# Source Search Schemas
# =====================


class SourceSearchRequest(BaseModel):
    """Request for starting a source search task."""
    query: str
    max_rounds: int = 3  # Maximum search iterations
    results_per_round: int = 5  # Number of results per search round


class SourceSearchResult(BaseModel):
    """A single search result with URL and metadata."""
    url: str
    title: str
    snippet: str
    relevance_score: Optional[float] = None  # Optional relevance score from LLM


class SourceSearchStatus(BaseModel):
    """Status of a source search task."""
    task_id: str
    status: str  # "pending" | "searching" | "completed" | "failed"
    current_round: int
    total_rounds: int
    message: str
    results: List[SourceSearchResult] = []
    error: Optional[str] = None


class SourceSearchTaskResponse(BaseModel):
    """Response when starting a source search task."""
    task_id: str
    message: str
    status: SourceSearchStatus


class BatchUrlImportRequest(BaseModel):
    """Request for batch importing multiple URLs."""
    urls: List[str]
    max_characters: int = 15000


class BatchUrlImportResult(BaseModel):
    """Result of importing a single URL in batch."""
    url: str
    success: bool
    content: Optional[str] = None
    title: Optional[str] = None
    content_length: Optional[int] = None
    error: Optional[str] = None


class BatchUrlImportResponse(BaseModel):
    """Response containing batch import results."""
    total: int
    successful: int
    failed: int
    results: List[BatchUrlImportResult]