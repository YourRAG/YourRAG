import httpx
import config
import time
from typing import List
from config_service import config_service

class EmbeddingService:
    def __init__(self):
        pass

    @property
    def api_url(self):
        return config_service.get_value("EMBEDDING_API_URL", config.API_URL)

    @property
    def api_key(self):
        return config_service.get_value("EMBEDDING_API_KEY", config.API_KEY)

    @property
    def model_name(self):
        return config_service.get_value("EMBEDDING_MODEL_NAME", config.MODEL_NAME)

    @property
    def headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def get_embeddings(self, texts: List[str], max_retries: int = 3) -> List[List[float]]:
        """Get embeddings for a list of text strings using OpenAI-compatible API."""
        payload = {
            "input": texts,
            "model": self.model_name
        }

        for attempt in range(max_retries):
            try:
                # Assuming config.API_URL is the full endpoint (e.g., .../v1/embeddings)
                response = httpx.post(self.api_url, headers=self.headers, json=payload, timeout=60.0)
                response.raise_for_status()
                data = response.json()

                # Sort by index to ensure order matches input
                data["data"].sort(key=lambda x: x["index"])
                embeddings = [item["embedding"] for item in data["data"]]
                return embeddings

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 503 and attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    print(f"Server busy (503), retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                print(f"HTTP error occurred: {e}")
                print(f"Response content: {e.response.text}")
                raise
            except Exception as e:
                print(f"An error occurred: {e}")
                raise

    def get_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text string."""
        embeddings = self.get_embeddings([text])
        if embeddings:
            return embeddings[0]
        return []
