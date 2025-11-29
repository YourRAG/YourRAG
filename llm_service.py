import httpx
import config
from typing import List, Dict, Any, Optional, AsyncGenerator
import json
from config_service import config_service


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
        system_prompt: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """Build messages for RAG completion."""
        if not system_prompt:
            system_prompt = config_service.get_value("RAG_SYSTEM_PROMPT", config.RAG_SYSTEM_PROMPT)

        if not system_prompt:
            system_prompt = "You are a helpful assistant."

        context_text = "\n\n".join([
            f"[Document {i+1}]\n{ctx['content']}"
            for i, ctx in enumerate(contexts)
        ])

        user_content = f"""Please answer the question based on the following context documents.

Context:
{context_text}

Question: {query}

Please provide a helpful and accurate answer based on the context above. If the context doesn't contain enough information to answer the question, please say so."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        return messages

    async def list_models(self) -> List[Dict[str, Any]]:
        """List available models from the upstream LLM provider."""
        try:
            async with httpx.AsyncClient() as client:
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
        temperature: float = 0.7,
        max_tokens: int = 1024
    ) -> str:
        """Generate a response using RAG (Retrieval Augmented Generation)."""
        messages = self._build_rag_prompt(query, contexts, system_prompt)

        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        try:
            response = httpx.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=120.0
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
        temperature: float = 0.7,
        max_tokens: int = 1024,
        model: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response using RAG."""
        messages = self._build_rag_prompt(query, contexts, system_prompt)

        # Use provided model if available and not "default", otherwise use config model
        model_to_use = model if model and model != "default" else self.model_name

        payload = {
            "model": model_to_use,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=120.0
            ) as response:
                if response.status_code != 200:
                    # Use aiter_bytes to read error content asynchronously if needed,
                    # but for stream=True, we should check status before iterating
                    # response.read() is for non-streaming requests or after stream is consumed
                    # Here we just log the status code as reading the body might be tricky in stream mode
                    print(f"LLM API Error: {response.status_code}")
                    
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if "choices" in data and len(data["choices"]) > 0:
                                delta = data["choices"][0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
