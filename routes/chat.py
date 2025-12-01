"""RAG and OpenAI compatible chat routes."""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
import json
import time
import uuid

from schemas import (
    RAGQueryInput,
    RAGResponse,
    OpenAIRequest,
    SearchResult,
)
from auth import get_current_user, get_chat_user, prisma
from document_store import DocumentStore
from llm_service import LLMService
from rate_limiter import rate_limit
from activity_service import record_rag_query

router = APIRouter()
store = DocumentStore()
llm_service = LLMService()


@router.post("/rag", response_model=RAGResponse)
@rate_limit(key_prefix="rag_query")
async def rag_query(
    input_data: RAGQueryInput, request: Request, current_user=Depends(get_current_user)
):
    """RAG (Retrieval Augmented Generation) endpoint.

    Retrieves relevant documents and generates an answer using LLM.
    """
    try:
        top_k = input_data.top_k or current_user.topK or 5

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


@router.get("/v1/models")
async def list_models(current_user=Depends(get_current_user)):
    """List available models (OpenAI Compatible)."""
    try:
        models = await llm_service.list_models()
        return {"object": "list", "data": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/chat/completions")
@rate_limit(key_prefix="rag_stream")
async def chat_completions(
    input_data: OpenAIRequest, request: Request, current_user=Depends(get_chat_user)
):
    """OpenAI Compatible Chat Completions Endpoint.

    Retrieves relevant documents and streams the generated answer.
    """
    try:
        last_user_message = next(
            (m for m in reversed(input_data.messages) if m.role == "user"), None
        )
        if not last_user_message:
            raise HTTPException(status_code=400, detail="No user message found")

        query = last_user_message.content

        system_message = next(
            (m for m in input_data.messages if m.role == "system"), None
        )
        system_prompt = system_message.content if system_message else None

        actual_model = input_data.model or "default"
        group_id_for_search = None
        
        if actual_model and actual_model != "default":
            last_dash_idx = actual_model.rfind("-")
            if last_dash_idx > 0:
                potential_group_name = actual_model[last_dash_idx + 1:]
                potential_model_name = actual_model[:last_dash_idx]
                
                if potential_group_name:
                    group = await prisma.documentgroup.find_first(
                        where={"userId": current_user.id, "name": potential_group_name}
                    )
                    if group:
                        group_id_for_search = group.id
                        actual_model = potential_model_name

        top_k = input_data.top_k or current_user.topK or 5

        user_similarity = (
            current_user.similarityThreshold
            if current_user.similarityThreshold is not None
            else 0.8
        )
        distance_threshold = 1.0 - user_similarity

        search_query = query
        
        history_messages = []
        non_system_messages = [m for m in input_data.messages if m.role != "system"]
        
        if non_system_messages and non_system_messages[-1].role == "user" and non_system_messages[-1].content == query:
            non_system_messages = non_system_messages[:-1]
        
        history_messages = [{"role": m.role, "content": m.content} for m in non_system_messages[-20:]]

        results, _ = await store.search(
            user_id=current_user.id,
            query=search_query,
            threshold=distance_threshold,
            limit=top_k,
            group_id=group_id_for_search,
        )

        await record_rag_query(prisma, current_user.id, query)

        async def stream_generator():
            chat_id = f"chatcmpl-{uuid.uuid4()}"
            created = int(time.time())

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

            async for chunk in llm_service.chat_completion_stream(
                query=query,
                contexts=results,
                system_prompt=system_prompt,
                history=history_messages,
                temperature=input_data.temperature,
                max_tokens=input_data.max_tokens,
                model=actual_model,
            ):
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