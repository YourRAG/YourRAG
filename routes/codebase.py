"""Code Base routes for GitHub repository indexing and management."""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import json
import asyncio

from auth import get_current_user, prisma
from document_store import DocumentStore
from github_service import GitHubService
from activity_service import record_document_add

router = APIRouter()
store = DocumentStore()


class IndexRepoInput(BaseModel):
    """Input for indexing a GitHub repository."""
    url: str
    branch: Optional[str] = None


class ReindexFileInput(BaseModel):
    """Input for reindexing a specific file."""
    group_id: int
    file_path: str


class CodeBaseStatus(BaseModel):
    """Status of a code base indexing task."""
    repo_name: str
    status: str  # "pending", "processing", "completed", "failed"
    progress: int
    total_files: int
    message: str
    group_id: Optional[int] = None
    error: Optional[str] = None


class CodeBaseInfo(BaseModel):
    """Information about an indexed code base."""
    group_id: int
    repo_name: str
    repo_url: str
    file_count: int
    chunk_count: int
    created_at: str


# In-memory task tracking (for demo - in production use Redis)
indexing_tasks: Dict[str, CodeBaseStatus] = {}


async def index_repo_background(
    user_id: int,
    url: str,
    task_id: str,
    branch: Optional[str] = None
):
    """Background task to index a GitHub repository."""
    try:
        github_service = GitHubService()
        
        # Parse URL to get repo name
        owner, repo, parsed_branch = github_service.parse_repo_url(url)
        repo_name = f"{owner}/{repo}"
        
        if branch:
            parsed_branch = branch
        
        indexing_tasks[task_id] = CodeBaseStatus(
            repo_name=repo_name,
            status="processing",
            progress=0,
            total_files=0,
            message="Fetching repository structure..."
        )
        
        # Check if group already exists
        existing_group = await prisma.documentgroup.find_first(
            where={
                "userId": user_id,
                "name": repo_name
            }
        )
        
        if existing_group:
            # Delete existing group and documents
            indexing_tasks[task_id].message = "Removing existing index..."
            await store.delete_group(
                user_id=user_id,
                group_id=existing_group.id,
                delete_documents=True
            )
        
        # Create new group
        group = await prisma.documentgroup.create(
            data={
                "name": repo_name,
                "userId": user_id
            }
        )
        
        indexing_tasks[task_id].group_id = group.id
        
        # Fetch and chunk repository
        def progress_callback(message: str, current: int, total: int):
            indexing_tasks[task_id].message = message
            indexing_tasks[task_id].progress = current
            indexing_tasks[task_id].total_files = total
        
        _repo_name, chunks = await github_service.fetch_and_chunk_repo(
            url,
            progress_callback
        )
        
        if not chunks:
            indexing_tasks[task_id].status = "failed"
            indexing_tasks[task_id].error = "No code files found in repository"
            return
        
        # Index each chunk
        total_chunks = len(chunks)
        indexed_count = 0
        
        for idx, chunk in enumerate(chunks):
            indexing_tasks[task_id].message = f"Indexing chunk {idx + 1}/{total_chunks}..."
            indexing_tasks[task_id].progress = idx + 1
            indexing_tasks[task_id].total_files = total_chunks
            
            # Build metadata with file identification info
            metadata = {
                "source": "codebase",
                "repo_url": chunk.repo_url,
                "repo_name": chunk.repo_name,
                "file_path": chunk.file_path,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "chunk_type": chunk.chunk_type,
                "language": chunk.language
            }
            
            try:
                await store.add_document(
                    user_id=user_id,
                    content=chunk.content,
                    metadata=metadata,
                    group_id=group.id
                )
                indexed_count += 1
            except Exception as e:
                # Log error but continue with other chunks
                print(f"Failed to index chunk {chunk.file_path}: {e}")
        
        indexing_tasks[task_id].status = "completed"
        indexing_tasks[task_id].message = f"Indexed {indexed_count} code chunks from {repo_name}"
        indexing_tasks[task_id].progress = total_chunks
        indexing_tasks[task_id].total_files = total_chunks
        
        # Record activity
        await record_document_add(
            prisma, user_id, group.id, f"Indexed repository: {repo_name}"
        )
        
    except ValueError as e:
        indexing_tasks[task_id].status = "failed"
        indexing_tasks[task_id].error = str(e)
    except Exception as e:
        indexing_tasks[task_id].status = "failed"
        indexing_tasks[task_id].error = f"Unexpected error: {str(e)}"


@router.post("/codebase/index")
async def index_repository(
    data: IndexRepoInput,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user)
):
    """Start indexing a GitHub repository."""
    try:
        github_service = GitHubService()
        
        # Validate URL
        owner, repo, branch = github_service.parse_repo_url(data.url)
        repo_name = f"{owner}/{repo}"
        
        # Check if already indexing
        for task_id, status in indexing_tasks.items():
            if (status.repo_name == repo_name and 
                status.status == "processing" and
                task_id.startswith(f"user_{current_user.id}_")):
                raise HTTPException(
                    status_code=400,
                    detail=f"Repository {repo_name} is already being indexed"
                )
        
        # Create task ID
        task_id = f"user_{current_user.id}_{repo_name.replace('/', '_')}"
        
        # Clean up old completed tasks
        old_tasks = [
            tid for tid, st in indexing_tasks.items()
            if st.status in ("completed", "failed") and 
               tid.startswith(f"user_{current_user.id}_")
        ]
        for tid in old_tasks:
            if tid != task_id:
                del indexing_tasks[tid]
        
        # Start background task
        background_tasks.add_task(
            index_repo_background,
            current_user.id,
            data.url,
            task_id,
            data.branch
        )
        
        indexing_tasks[task_id] = CodeBaseStatus(
            repo_name=repo_name,
            status="pending",
            progress=0,
            total_files=0,
            message="Starting indexing task..."
        )
        
        return {
            "task_id": task_id,
            "message": f"Started indexing {repo_name}",
            "status": indexing_tasks[task_id]
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/codebase/status/{task_id}")
async def get_indexing_status(
    task_id: str,
    current_user=Depends(get_current_user)
):
    """Get the status of an indexing task."""
    # Verify task belongs to user
    if not task_id.startswith(f"user_{current_user.id}_"):
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task_id not in indexing_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return indexing_tasks[task_id]


@router.get("/codebase/list", response_model=List[CodeBaseInfo])
async def list_codebases(current_user=Depends(get_current_user)):
    """List all indexed code bases for the current user."""
    try:
        # Get all groups that are code bases (have repo_url in metadata)
        groups = await prisma.documentgroup.find_many(
            where={"userId": current_user.id},
            order={"createdAt": "desc"}
        )
        
        codebases = []
        
        for group in groups:
            # Check if this group is a codebase by examining documents
            sample_doc = await prisma.document.find_first(
                where={
                    "groupId": group.id,
                    "userId": current_user.id
                }
            )
            
            if not sample_doc:
                continue
            
            # Parse metadata
            metadata = {}
            if sample_doc.metadata:
                if isinstance(sample_doc.metadata, str):
                    metadata = json.loads(sample_doc.metadata)
                else:
                    metadata = sample_doc.metadata
            
            # Check if it's a codebase
            if metadata.get("source") != "codebase":
                continue
            
            # Count documents and unique files
            doc_count = await prisma.document.count(
                where={
                    "groupId": group.id,
                    "userId": current_user.id
                }
            )
            
            # Get unique file count using raw query
            file_count_result = await prisma.query_raw(
                """
                SELECT COUNT(DISTINCT metadata->>'file_path') as count
                FROM "Document"
                WHERE "groupId" = $1 AND "userId" = $2
                """,
                group.id, current_user.id
            )
            
            file_count = file_count_result[0]["count"] if file_count_result else 0
            
            codebases.append(CodeBaseInfo(
                group_id=group.id,
                repo_name=group.name,
                repo_url=metadata.get("repo_url", ""),
                file_count=file_count,
                chunk_count=doc_count,
                created_at=group.createdAt.isoformat()
            ))
        
        return codebases
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/codebase/{group_id}/files")
async def list_codebase_files(
    group_id: int,
    current_user=Depends(get_current_user)
):
    """List all files in a code base with their chunk counts."""
    try:
        # Verify group ownership
        group = await prisma.documentgroup.find_first(
            where={
                "id": group_id,
                "userId": current_user.id
            }
        )
        
        if not group:
            raise HTTPException(status_code=404, detail="Code base not found")
        
        # Get file statistics
        file_stats_result = await prisma.query_raw(
            """
            SELECT 
                metadata->>'file_path' as file_path,
                metadata->>'language' as language,
                COUNT(*) as chunk_count,
                MIN(id) as first_doc_id
            FROM "Document"
            WHERE "groupId" = $1 AND "userId" = $2
            GROUP BY metadata->>'file_path', metadata->>'language'
            ORDER BY metadata->>'file_path'
            """,
            group_id, current_user.id
        )
        
        files = []
        for row in file_stats_result:
            files.append({
                "file_path": row["file_path"],
                "language": row["language"],
                "chunk_count": row["chunk_count"],
                "first_doc_id": row["first_doc_id"]
            })
        
        return {
            "group_id": group_id,
            "repo_name": group.name,
            "files": files,
            "total_files": len(files)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/codebase/{group_id}/reindex-file")
async def reindex_file(
    group_id: int,
    data: ReindexFileInput,
    current_user=Depends(get_current_user)
):
    """Reindex a specific file in a code base."""
    try:
        # Verify group ownership
        group = await prisma.documentgroup.find_first(
            where={
                "id": group_id,
                "userId": current_user.id
            }
        )
        
        if not group:
            raise HTTPException(status_code=404, detail="Code base not found")
        
        # Get sample document to extract repo info
        sample_doc = await prisma.document.find_first(
            where={
                "groupId": group_id,
                "userId": current_user.id
            }
        )
        
        if not sample_doc:
            raise HTTPException(status_code=404, detail="No documents in code base")
        
        # Parse metadata
        metadata = {}
        if sample_doc.metadata:
            if isinstance(sample_doc.metadata, str):
                metadata = json.loads(sample_doc.metadata)
            else:
                metadata = sample_doc.metadata
        
        repo_url = metadata.get("repo_url")
        if not repo_url:
            raise HTTPException(
                status_code=400, 
                detail="Cannot determine repository URL"
            )
        
        # Delete existing chunks for this file
        # Using raw query to filter by metadata and get doc IDs first
        docs_to_delete = await prisma.query_raw(
            """
            SELECT id FROM "Document"
            WHERE "groupId" = $1 AND "userId" = $2
            AND metadata->>'file_path' = $3
            """,
            group_id, current_user.id, data.file_path
        )
        
        if docs_to_delete:
            doc_ids = [doc["id"] for doc in docs_to_delete]
            await prisma.document.delete_many(
                where={
                    "id": {"in": doc_ids}
                }
            )
        
        # Fetch and reindex the file
        github_service = GitHubService()
        owner, repo, branch = github_service.parse_repo_url(repo_url)
        
        if not branch:
            branch = await github_service.get_default_branch(owner, repo)
        
        download_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{data.file_path}"
        content = await github_service.get_file_content(download_url)
        
        if not content:
            raise HTTPException(
                status_code=404, 
                detail=f"File {data.file_path} not found in repository"
            )
        
        # Split into chunks
        chunks = github_service.split_code_into_chunks(
            content,
            data.file_path,
            repo_url,
            group.name
        )
        
        # Index chunks
        indexed_count = 0
        for chunk in chunks:
            chunk_metadata = {
                "source": "codebase",
                "repo_url": chunk.repo_url,
                "repo_name": chunk.repo_name,
                "file_path": chunk.file_path,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "chunk_type": chunk.chunk_type,
                "language": chunk.language
            }
            
            await store.add_document(
                user_id=current_user.id,
                content=chunk.content,
                metadata=chunk_metadata,
                group_id=group_id
            )
            indexed_count += 1
        
        return {
            "message": f"Reindexed {data.file_path}",
            "chunks_indexed": indexed_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/codebase/{group_id}")
async def delete_codebase(
    group_id: int,
    current_user=Depends(get_current_user)
):
    """Delete a code base (group and all documents)."""
    try:
        result = await store.delete_group(
            user_id=current_user.id,
            group_id=group_id,
            delete_documents=True
        )
        
        if result is None:
            raise HTTPException(status_code=404, detail="Code base not found")
        
        return {
            "message": "Code base deleted successfully",
            "deleted_documents": result.get("deletedDocuments", 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/codebase/{group_id}/document/{doc_id}")
async def get_document_content(
    group_id: int,
    doc_id: int,
    current_user=Depends(get_current_user)
):
    """Get the content of a specific document in the code base."""
    try:
        doc = await store.get_document(
            user_id=current_user.id,
            doc_id=doc_id,
            group_id=group_id
        )
        
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return doc
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# External API Routes (API Key Authentication)
# =====================

from auth import get_chat_user


@router.post("/api/codebase/index")
async def api_index_repository(
    data: IndexRepoInput,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_chat_user)
):
    """Start indexing a GitHub repository (API Key auth)."""
    return await index_repository(data, background_tasks, current_user)


@router.get("/api/codebase/list")
async def api_list_codebases(current_user=Depends(get_chat_user)):
    """List all indexed code bases (API Key auth)."""
    return await list_codebases(current_user)


@router.delete("/api/codebase/{group_id}")
async def api_delete_codebase(
    group_id: int,
    current_user=Depends(get_chat_user)
):
    """Delete a code base (API Key auth)."""
    return await delete_codebase(group_id, current_user)