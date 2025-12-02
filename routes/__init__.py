"""Routes package for API endpoints."""

from fastapi import APIRouter

from .auth import router as auth_router
from .documents import router as documents_router
from .admin import router as admin_router
from .chat import router as chat_router
from .codebase import router as codebase_router
from .credits import router as credits_router

__all__ = [
    "auth_router",
    "documents_router",
    "admin_router",
    "chat_router",
    "codebase_router",
    "credits_router",
]