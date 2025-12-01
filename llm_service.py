import httpx
import config
from typing import List, Dict, Any, Optional, AsyncGenerator, TypedDict
import json
from config_service import config_service


class StreamChunk(TypedDict, total=False):
    """Streaming chunk with content and optional reasoning."""
    content: str
    reasoning_content: str


class LLMService:
    def __init__(self):
        pass

    @property
    def api_url(self):
        return config_service.get_value("LLM_API_URL", config.LLM_API_URL)

    @property
    def api_key(self):
        return config_service.get_value("LLM_API_KEY", config.LLM_API_KEY)

    @property
    def model_name(self):
        return config_service.get_value("LLM_MODEL_NAME", config.LLM_MODEL_NAME)

    @property
    def headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def _build_rag_prompt(
        self,
        query: str,
        contexts: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> List[Dict[str, str]]:
        """Build messages for RAG completion."""
        if not system_prompt:
            system_prompt = config_service.get_value("RAG_SYSTEM_PROMPT", config.RAG_SYSTEM_PROMPT)

        if not system_prompt:
            system_prompt = "You are a helpful assistant."

        if contexts:
            context_text = "\n\n".join([
                f"[Document {i+1}]\n{ctx['content']}"
                for i, ctx in enumerate(contexts)
            ])
            
            user_content = f"""Please answer the question based on the provided context documents.

Context:
{context_text}

Question: {query}

Instructions:
1. Answer the question using ONLY the information from the provided context.
2. If the context does not contain enough information to answer the question fully, state what is missing or that you cannot answer based on the available information.
3. Do NOT make up or hallucinate information that is not present in the context."""
        else:
            user_content = f"""Question: {query}

Instructions for interactions without knowledge base context:

1. **Analyze User Intent**: Determine if the user's query is:
    *   **Conversational/Personal**: Greetings ("Hello"), questions about you ("Who are you?"), or small talk ("How are you?", "I love you").
    *   **Factual/Specific**: Questions asking for specific data, facts, technical details, or internal knowledge.

2. **Response Guidelines**:
    *   **If Conversational**: Respond naturally, warmly, and helpfuly as a AI assistant. Be polite and engage with the user. You DO NOT need to mention the knowledge base.
        *   *Example ("Who are you?"):* "I am an AI assistant designed to help you navigate and understand your knowledge base."
        *   *Example ("Hello"):* "Hello! How can I help you today?"
    *   **If Factual/Specific**: Politely explain that you don't have information on that specific topic in your current knowledge base, but offer to help if they can provide more details or upload relevant documents.
        *   *Example:* "I don't have information about [Topic] in my current records. Could you provide more details, or would you like to add a document covering this?"

3. **General Rule**: Be helpful and human-like. Avoid repetitive or robotic refusals like "I cannot find relevant documents" unless it's truly a specific query that failed."""

        messages = [{"role": "system", "content": system_prompt}]
        
        if history:
            messages.extend(history)
            
        messages.append({"role": "user", "content": user_content})

        return messages

    async def list_models(self) -> List[Dict[str, Any]]:
        """List available models from the upstream LLM provider."""
        try:
            # Disable proxies for local connections
            proxies = {"all://": None}
            async with httpx.AsyncClient(proxies=proxies) as client:
                response = await client.get(
                    f"{self.api_url.rsplit('/chat/completions', 1)[0]}/models",
                    headers=self.headers,
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("data", [])
        except Exception as e:
            print(f"Error fetching models: {e}")
            # Return a default list if upstream fails
            return [
                {
                    "id": self.model_name,
                    "object": "model",
                    "created": 1677610602,
                    "owned_by": "system",
                }
            ]

    def chat_completion(
        self,
        query: str,
        contexts: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024
    ) -> str:
        """Generate a response using RAG (Retrieval Augmented Generation)."""
        messages = self._build_rag_prompt(query, contexts, system_prompt, history)

        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        try:
            # Disable proxies for local connections
            proxies = {"all://": None}
            response = httpx.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=120.0,
                proxies=proxies
            )
            response.raise_for_status()
            data = response.json()

            return data["choices"][0]["message"]["content"]

        except httpx.HTTPStatusError as e:
            print(f"HTTP error occurred: {e}")
            print(f"Response content: {e.response.text}")
            raise
        except Exception as e:
            print(f"An error occurred: {e}")
            raise

    async def chat_completion_stream(
        self,
        query: str,
        contexts: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        model: Optional[str] = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Generate a streaming response using RAG.
        
        Yields StreamChunk dictionaries with 'content' and/or 'reasoning_content'.
        This supports models with thinking/reasoning capabilities (e.g., QwQ, Claude thinking).
        """
        messages = self._build_rag_prompt(query, contexts, system_prompt, history)

        # Use provided model if available and not "default", otherwise use config model
        model_to_use = model if model and model != "default" else self.model_name

        max_retries = 1
        attempt = 0

        while attempt <= max_retries:
            payload = {
                "model": model_to_use,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True
            }
            
            # Disable proxies for local connections to prevent "All connection attempts failed" errors
            proxies = {"all://": None}
            
            should_retry = False
            
            try:
                async with httpx.AsyncClient(proxies=proxies) as client:
                    async with client.stream(
                        "POST",
                        self.api_url,
                        headers=self.headers,
                        json=payload,
                        timeout=120.0
                    ) as response:
                        if response.status_code != 200:
                            error_content = await response.aread()
                            error_msg = error_content.decode('utf-8')
                            print(f"LLM API Error: {response.status_code} - {error_msg}")
                            
                            # Handle "Model does not exist" error
                            if response.status_code == 400 and "Model does not exist" in error_msg:
                                if attempt < max_retries:
                                    print(f"Model '{model_to_use}' not found. Attempting to switch model...")
                                    try:
                                        # Try to list available models
                                        available_models = await self.list_models()
                                        # Filter out the current failed model if it's in the list (it might be if list_models fell back)
                                        candidates = [m["id"] for m in available_models if m["id"] != model_to_use]
                                        
                                        if candidates:
                                            new_model = candidates[0]
                                            print(f"Switching to available model: {new_model}")
                                            model_to_use = new_model
                                            attempt += 1
                                            should_retry = True
                                        else:
                                            print("No other models found via list_models.")
                                            # Try a hardcoded common fallback if we haven't tried it yet
                                            fallback = "gpt-3.5-turbo"
                                            if model_to_use != fallback:
                                                print(f"Attempting fallback to {fallback}")
                                                model_to_use = fallback
                                                attempt += 1
                                                should_retry = True
                                    except Exception as e:
                                        print(f"Error during model recovery: {e}")
                            
                            if not should_retry:
                                response.raise_for_status()

                        if should_retry:
                            continue

                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                data_str = line[6:]
                                if data_str.strip() == "[DONE]":
                                    break
                                try:
                                    data = json.loads(data_str)
                                    if "choices" in data and len(data["choices"]) > 0:
                                        delta = data["choices"][0].get("delta", {})
                                        chunk: StreamChunk = {}
                                        
                                        # Extract regular content
                                        content = delta.get("content", "")
                                        if content:
                                            chunk["content"] = content
                                        
                                        # Extract reasoning content - support both field names:
                                        # - reasoning_content: used by DeepSeek-R1, QwQ, vLLM, etc.
                                        # - reasoning: used by some other providers
                                        reasoning_content = delta.get("reasoning_content") or delta.get("reasoning", "")
                                        if reasoning_content:
                                            chunk["reasoning_content"] = reasoning_content
                                        
                                        # Only yield if there's actual content
                                        if chunk:
                                            yield chunk
                                except json.JSONDecodeError:
                                    continue
                
                if not should_retry:
                    break

            except httpx.HTTPStatusError:
                raise
            except Exception as e:
                print(f"Stream error: {e}")
                raise
