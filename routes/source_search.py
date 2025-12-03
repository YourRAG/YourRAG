"""Source search routes for discovering and importing URLs."""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Dict, Optional
import json
import uuid
import asyncio

from schemas import (
    SourceSearchRequest,
    SourceSearchResult,
    SourceSearchStatus,
    SourceSearchTaskResponse,
    BatchUrlImportRequest,
    BatchUrlImportResult,
    BatchUrlImportResponse,
)
from auth import get_chat_user
from redis_service import RedisService
from llm_service import LLMService
from mcp_client import MCPClient
import ftfy
from datetime import datetime

router = APIRouter()

# In-memory task storage (fallback when Redis unavailable)
source_search_tasks: Dict[str, SourceSearchStatus] = {}

# Redis key prefix for source search tasks
REDIS_KEY_PREFIX = "source_search:"
REDIS_KEY_EXPIRE = 3600  # 1 hour


async def get_task_status(task_id: str, user_id: int) -> Optional[SourceSearchStatus]:
    """Get task status from Redis or memory."""
    key = f"{REDIS_KEY_PREFIX}{user_id}:{task_id}"
    
    try:
        client = RedisService.get_client()
        data = await client.get(key)
        if data:
            task_data = json.loads(data)
            return SourceSearchStatus(**task_data)
    except Exception:
        pass
    
    # Fallback to memory
    memory_key = f"{user_id}:{task_id}"
    return source_search_tasks.get(memory_key)


async def save_task_status(task_id: str, user_id: int, status: SourceSearchStatus):
    """Save task status to Redis and memory."""
    key = f"{REDIS_KEY_PREFIX}{user_id}:{task_id}"
    memory_key = f"{user_id}:{task_id}"
    
    # Always save to memory as backup
    source_search_tasks[memory_key] = status
    
    try:
        client = RedisService.get_client()
        await client.set(key, status.model_dump_json(), ex=REDIS_KEY_EXPIRE)
    except Exception:
        pass


async def source_search_background(
    user_id: int,
    task_id: str,
    query: str,
    max_rounds: int,
    results_per_round: int,
):
    """Background task to perform iterative source search."""
    try:
        # Initialize task status
        status = SourceSearchStatus(
            task_id=task_id,
            status="searching",
            current_round=0,
            total_rounds=max_rounds,
            message="Starting source search...",
            results=[],
        )
        await save_task_status(task_id, user_id, status)
        
        mcp_client = MCPClient()
        llm_service = LLMService()
        all_results: Dict[str, SourceSearchResult] = {}  # URL as key for dedup
        
        current_date = datetime.now().strftime('%Y-%m-%d')

        # Generate better search queries using LLM for non-English queries
        try:
            query_prompt = f"""Generate 2-3 effective web search queries for the following topic.
Current Date: {current_date}

If the query is in Chinese or another non-English language, provide both:
1. The original language query (refined)
2. An English translation query

Topic: {query}

Respond with ONLY a JSON array of search query strings:
["query1", "query2", "query3"]"""
            
            query_response = llm_service.chat_completion(
                query=query_prompt,
                contexts=[],
                system_prompt=f"You are a search query optimizer. Current Date: {current_date}. Output only a JSON array of search queries.",
                temperature=0.5,
                max_tokens=200,
            )
            
            query_response = query_response.strip()
            if query_response.startswith("```"):
                lines = query_response.split("\n")
                query_response = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
            
            initial_queries = json.loads(query_response)
            if isinstance(initial_queries, list) and len(initial_queries) > 0:
                search_queries = [q for q in initial_queries if isinstance(q, str)][:3]
            else:
                search_queries = [query]
            
        except Exception as e:
            search_queries = [query]
        
        for round_num in range(1, max_rounds + 1):
            status.current_round = round_num
            status.message = f"Searching round {round_num}/{max_rounds}..."
            await save_task_status(task_id, user_id, status)
            
            round_results = []
            
            # Execute searches for current round's queries
            for search_query in search_queries[:3]:  # Limit to 3 queries per round
                try:
                    results = mcp_client.search_with_exa(
                        query=search_query,
                        num_results=results_per_round,
                        livecrawl="fallback",
                        search_type="auto",
                        context_max_characters=3000,
                    )
                    
                    # Handle different result formats
                    items_to_process = []
                    
                    if isinstance(results, list):
                        for item in results:
                            if isinstance(item, dict):
                                # Check if this is a text content item (Exa format)
                                if "text" in item and "url" not in item:
                                    # This might be wrapped text content, try to extract
                                    items_to_process.append(item)
                                else:
                                    items_to_process.append(item)
                            elif isinstance(item, str):
                                # If it's a string, it might contain the data
                                pass
                    elif isinstance(results, dict):
                        # Results might be wrapped in a dict
                        if "results" in results:
                            items_to_process = results["results"]
                        elif "data" in results:
                            items_to_process = results["data"]
                        else:
                            items_to_process = [results]
                    
                    for idx, result in enumerate(items_to_process):
                        url = ""
                        title = ""
                        text = ""
                        
                        if isinstance(result, dict):
                            # Check if it's the Exa text format: {'type': 'text', 'text': '...'}
                            if result.get("type") == "text" and "text" in result:
                                raw_text = result.get("text", "")
                                
                                # Parse the embedded format:
                                # Title: xxx
                                # Author: xxx
                                # Published Date: xxx
                                # URL: https://...
                                # Text: ...
                                import re
                                
                                # Extract URL
                                url_match = re.search(r'URL:\s*(https?://[^\s\n]+)', raw_text)
                                if url_match:
                                    url = url_match.group(1).strip()
                                
                                # Extract Title
                                title_match = re.search(r'Title:\s*([^\n]+)', raw_text)
                                if title_match:
                                    title = title_match.group(1).strip()
                                
                                # Extract the actual text content (after "Text: ")
                                text_match = re.search(r'Text:\s*(.*)', raw_text, re.DOTALL)
                                if text_match:
                                    text = text_match.group(1).strip()
                                else:
                                    text = raw_text
                                    
                            else:
                                # Standard dict format
                                url = result.get("url", "") or result.get("link", "") or result.get("href", "")
                                title = result.get("title", "")
                                text = result.get("text", "") or result.get("content", "") or result.get("snippet", "")
                        
                        # Skip if no URL or already have it
                        if not url or url in all_results:
                            continue
                            
                        # Fix encoding issues using ftfy
                        text = ftfy.fix_text(text)
                        title = ftfy.fix_text(title)
                        
                        # Create snippet from text
                        snippet = text[:300] + "..." if len(text) > 300 else text
                        
                        search_result = SourceSearchResult(
                            url=url,
                            title=title or url[:50],
                            snippet=snippet,
                        )
                        round_results.append(search_result)
                        all_results[url] = search_result
                            
                except Exception:
                    continue
            
            # Update results after each round
            status.results = list(all_results.values())
            await save_task_status(task_id, user_id, status)
            
            # If this is not the last round, generate new search queries using LLM
            if round_num < max_rounds and round_results:
                try:
                    # Build context from current results
                    results_context = "\n".join([
                        f"- {r.title}: {r.snippet[:200]}"
                        for r in round_results[:5]
                    ])
                    
                    prompt = f"""Based on the user's original query and the search results so far, suggest 2-3 related search queries to find more relevant sources.
Current Date: {current_date}

Original query: {query}

Current search results:
{results_context}

Respond with ONLY a JSON array of search query strings, nothing else:
["query1", "query2", "query3"]"""

                    response = llm_service.chat_completion(
                        query=prompt,
                        contexts=[],
                        system_prompt=f"You are a search query generator. Current Date: {current_date}. Respond only with a JSON array of search queries.",
                        temperature=0.7,
                        max_tokens=200,
                    )
                    
                    # Parse new queries
                    response = response.strip()
                    if response.startswith("```"):
                        lines = response.split("\n")
                        response = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
                    
                    new_queries = json.loads(response)
                    if isinstance(new_queries, list) and len(new_queries) > 0:
                        search_queries = [q for q in new_queries if isinstance(q, str)][:3]
                    
                except Exception:
                    # Continue with original query if LLM fails
                    search_queries = [query]
            
            # Small delay between rounds
            await asyncio.sleep(0.5)
        
        # Complete the task
        status.status = "completed"
        status.message = f"Found {len(all_results)} unique sources"
        await save_task_status(task_id, user_id, status)
        
    except Exception as e:
        status = SourceSearchStatus(
            task_id=task_id,
            status="failed",
            current_round=0,
            total_rounds=max_rounds,
            message="Search failed",
            results=[],
            error=str(e),
        )
        await save_task_status(task_id, user_id, status)


@router.post("/documents/source-search", response_model=SourceSearchTaskResponse)
async def start_source_search(
    request: SourceSearchRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_chat_user),
):
    """
    Start a source search task to discover relevant URLs.
    
    Uses Exa search API and LLM to iteratively find related sources.
    Returns a task ID that can be used to poll for status and results.
    """
    try:
        query = request.query.strip()
        if not query:
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        
        if len(query) > 500:
            raise HTTPException(status_code=400, detail="Query too long (max 500 characters)")
        
        # Generate task ID
        task_id = str(uuid.uuid4())[:8]
        
        # Create initial status
        status = SourceSearchStatus(
            task_id=task_id,
            status="pending",
            current_round=0,
            total_rounds=request.max_rounds,
            message="Task queued, starting search...",
            results=[],
        )
        
        # Save initial status
        await save_task_status(task_id, current_user.id, status)
        
        # Start background task
        background_tasks.add_task(
            source_search_background,
            current_user.id,
            task_id,
            query,
            request.max_rounds,
            request.results_per_round,
        )
        
        return SourceSearchTaskResponse(
            task_id=task_id,
            message=f"Source search started for: {query[:50]}...",
            status=status,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start source search: {str(e)}")


@router.get("/documents/source-search/{task_id}", response_model=SourceSearchStatus)
async def get_source_search_status(
    task_id: str,
    current_user=Depends(get_chat_user),
):
    """
    Get the status and results of a source search task.
    
    Poll this endpoint to get updates on the search progress.
    """
    try:
        status = await get_task_status(task_id, current_user.id)
        
        if not status:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get task status: {str(e)}")


@router.post("/documents/batch-import-url", response_model=BatchUrlImportResponse)
async def batch_import_urls(
    request: BatchUrlImportRequest,
    current_user=Depends(get_chat_user),
):
    """
    Batch import content from multiple URLs.
    
    Each URL is crawled and converted to markdown format.
    Returns success/failure status for each URL.
    """
    try:
        if not request.urls:
            raise HTTPException(status_code=400, detail="No URLs provided")
        
        if len(request.urls) > 20:
            raise HTTPException(status_code=400, detail="Maximum 20 URLs per batch")
        
        mcp_client = MCPClient()
        llm_service = LLMService()
        results: list[BatchUrlImportResult] = []
        
        for url in request.urls:
            url = url.strip()
            if not url:
                continue
                
            if not url.startswith(("http://", "https://")):
                results.append(BatchUrlImportResult(
                    url=url,
                    success=False,
                    error="URL must start with http:// or https://",
                ))
                continue
            
            try:
                # Crawl the URL
                crawl_results = mcp_client.crawl_url_with_exa(
                    url=url,
                    max_characters=request.max_characters,
                )
                
                if not crawl_results:
                    results.append(BatchUrlImportResult(
                        url=url,
                        success=False,
                        error="No content returned from URL",
                    ))
                    continue
                
                # Extract content and title
                raw_content = ""
                title = None
                
                for item in crawl_results:
                    if isinstance(item, dict):
                        raw_content = item.get("text", "") or item.get("content", "")
                        title = item.get("title")
                        if raw_content:
                            break
                
                if not raw_content.strip():
                    results.append(BatchUrlImportResult(
                        url=url,
                        success=False,
                        error="No text content could be extracted",
                    ))
                    continue

                # Fix encoding issues using ftfy
                raw_content = ftfy.fix_text(raw_content)
                if title:
                    title = ftfy.fix_text(title)
                
                # Convert to markdown using LLM
                try:
                    format_prompt = f"""Convert the following web content to clean, well-formatted Markdown.
Current Date: {datetime.now().strftime('%Y-%m-%d')}

Rules:
1. Preserve headings hierarchy using # ## ###
2. Keep important links and code blocks
3. Remove navigation elements, ads, cookie notices
4. Clean up excessive whitespace
5. Preserve the main article content structure
6. If the content appears to be garbled or encoding-broken, try to interpret the likely correct characters.

Source URL: {url}

Content:
{raw_content[:15000]}"""

                    markdown_content = llm_service.chat_completion(
                        query=format_prompt,
                        contexts=[],
                        system_prompt="You are a web content formatter. Convert web content to clean markdown. Output only the formatted markdown, no explanations.",
                        temperature=0.3,
                        max_tokens=4000,
                    )
                    markdown_content = markdown_content.strip()
                    
                    # Check if LLM returned an error or empty content
                    if not markdown_content or len(markdown_content) < 10:
                        markdown_content = raw_content.strip()
                        
                except Exception:
                    markdown_content = raw_content.strip()
                
                results.append(BatchUrlImportResult(
                    url=url,
                    success=True,
                    content=markdown_content,
                    title=title,
                    content_length=len(markdown_content),
                ))
                
            except Exception as crawl_error:
                results.append(BatchUrlImportResult(
                    url=url,
                    success=False,
                    error=str(crawl_error),
                ))
        
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful
        
        return BatchUrlImportResponse(
            total=len(results),
            successful=successful,
            failed=failed,
            results=results,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch import failed: {str(e)}")