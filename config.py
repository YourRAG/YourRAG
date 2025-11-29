import os
from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
load_dotenv()

# Embedding API 配置 - 从环境变量读取
API_URL = os.environ.get("EMBEDDING_API_URL", "https://api.openai.com/v1/embeddings")
API_KEY = os.environ.get("EMBEDDING_API_KEY", "")
MODEL_NAME = os.environ.get("EMBEDDING_MODEL_NAME", "text-embedding-3-small")
VECTOR_DIMENSION = int(os.environ.get("EMBEDDING_VECTOR_DIMENSION", "1024"))

# LLM API 配置 - 用于RAG问答
LLM_API_URL = os.environ.get("LLM_API_URL", "https://api.openai.com/v1/chat/completions")
LLM_API_KEY = os.environ.get("LLM_API_KEY", os.environ.get("EMBEDDING_API_KEY", ""))
LLM_MODEL_NAME = os.environ.get("LLM_MODEL_NAME", "gpt-4o-mini")

# RAG 配置
RAG_SYSTEM_PROMPT = os.environ.get("RAG_SYSTEM_PROMPT",
    "You are a helpful assistant that answers questions based on the provided context. "
    "Be concise, accurate, and helpful. If the context doesn't contain enough information "
    "to answer the question, clearly state that."
)

# 数据库配置
DATABASE_PATH = os.environ.get("DATABASE_PATH", "documents.db")

# GitHub OAuth Configuration
GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET")

# JWT Configuration
PRIVATE_KEY = os.environ.get("PRIVATE_KEY")
PUBLIC_KEY = os.environ.get("PUBLIC_KEY")

# Frontend URL for OAuth redirect
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
# Redis Configuration
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
REDIS_DB = int(os.environ.get("REDIS_DB", "0"))
# Rate Limiting
RATE_LIMIT_CAPACITY = int(os.environ.get("RATE_LIMIT_CAPACITY", "0"))
RATE_LIMIT_RATE = float(os.environ.get("RATE_LIMIT_RATE", "1.0"))
# Global Rate Limiting
GLOBAL_RATE_LIMIT_CAPACITY = int(os.environ.get("GLOBAL_RATE_LIMIT_CAPACITY", "0"))
GLOBAL_RATE_LIMIT_RATE = float(os.environ.get("GLOBAL_RATE_LIMIT_RATE", "100.0"))

# Environment (development/production)
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
