"""Main API entry point - FastAPI application with route registration."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from auth import prisma
from redis_service import RedisService
from config_service import config_service
from routes import auth_router, documents_router, admin_router, chat_router, codebase_router
import config
import uvicorn


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown."""
    # Startup
    await prisma.connect()
    try:
        await RedisService.connect()
    except Exception as e:
        print(f"Failed to connect to Redis: {e}")
    
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
    title="RAG API",
    lifespan=lifespan,
    docs_url=docs_url,
    redoc_url=redoc_url
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(admin_router)
app.include_router(chat_router)
app.include_router(codebase_router)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)