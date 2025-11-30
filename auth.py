import os
import httpx
from datetime import datetime
from fastapi import HTTPException, Depends, status, Request
from fastapi.security import APIKeyCookie, HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from prisma import Prisma
from pydantic import BaseModel
from typing import Optional
import config

# Initialize Prisma client
prisma = Prisma()

# Cookie-based authentication
cookie_scheme = APIKeyCookie(name="token", auto_error=False)
security = HTTPBearer(auto_error=False)


class User(BaseModel):
    id: int
    githubId: Optional[str] = None
    giteeId: Optional[str] = None
    username: str
    email: Optional[str] = None
    avatarUrl: Optional[str] = None
    role: str = "USER"
    topK: int = 5
    similarityThreshold: float = 0.8


def get_private_key() -> str:
    """Get private key and handle escaped newlines."""
    key = config.PRIVATE_KEY or ""
    return key.replace("\\n", "\n")


def get_public_key() -> str:
    """Get public key and handle escaped newlines."""
    key = config.PUBLIC_KEY or ""
    return key.replace("\\n", "\n")


async def get_github_user(code: str, redirect_uri: str):
    async with httpx.AsyncClient() as client:
        # Exchange code for access token
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": config.GITHUB_CLIENT_ID,
                "client_secret": config.GITHUB_CLIENT_SECRET,
                "code": code,
            },
        )
        response.raise_for_status()
        data = response.json()
        access_token = data.get("access_token")
        
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to get access token from GitHub")

        # Get user info
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )
        user_response.raise_for_status()
        return user_response.json()


async def get_gitee_user(code: str, redirect_uri: str):
    async with httpx.AsyncClient() as client:
        # Exchange code for access token
        response = await client.post(
            "https://gitee.com/oauth/token",
            headers={"Accept": "application/json"},
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": config.GITEE_CLIENT_ID,
                "redirect_uri": redirect_uri,
                "client_secret": config.GITEE_CLIENT_SECRET,
            },
        )
        response.raise_for_status()
        data = response.json()
        access_token = data.get("access_token")
        
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to get access token from Gitee")

        # Get user info
        user_response = await client.get(
            "https://gitee.com/api/v5/user",
            params={"access_token": access_token},
        )
        user_response.raise_for_status()
        return user_response.json()


async def get_current_user(
    token: Optional[str] = Depends(cookie_scheme),
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Get current user from JWT token (Cookie or Header)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    if auth:
        token = auth.credentials

    if not token:
        raise credentials_exception
    
    # JWT Authentication
    try:
        payload = jwt.decode(token, get_public_key(), algorithms=["RS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    if not prisma.is_connected():
        await prisma.connect()
        
    user = await prisma.user.find_unique(where={"id": int(user_id)})

    if user is None:
        raise credentials_exception
    
    # Check if user is banned
    if user.banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=user.banReason or "Your account has been banned",
            headers={"Set-Cookie": "token=; Max-Age=0; Path=/; HttpOnly"}
        )
    
    return user


async def get_chat_user(
    token: Optional[str] = Depends(cookie_scheme),
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Get user for Chat API (Supports API Key via Header OR JWT via Cookie/Header)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    # 1. Check for API Key in Header (Authorization: Bearer rag-...)
    if auth and auth.credentials.startswith("rag-"):
        api_key_token = auth.credentials
        
        if not prisma.is_connected():
            await prisma.connect()

        api_key = await prisma.apikey.find_unique(
            where={"key": api_key_token},
            include={"user": True}
        )
        
        if not api_key or not api_key.isActive:
            raise credentials_exception
            
        # Ensure timezone-aware comparison
        now = datetime.now(api_key.expiresAt.tzinfo) if api_key.expiresAt and api_key.expiresAt.tzinfo else datetime.utcnow()
        
        if api_key.expiresAt and api_key.expiresAt < now:
            raise credentials_exception
            
        # Update last used time
        await prisma.apikey.update(
            where={"id": api_key.id},
            data={"lastUsedAt": datetime.utcnow()}
        )
        
        user = api_key.user
        
        if user is None:
            raise credentials_exception
            
        if user.banned:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=user.banReason or "Your account has been banned"
            )
            
        return user

    # 2. Fallback to standard JWT Authentication (Cookie or Header)
    return await get_current_user(token, auth)


async def get_current_user_optional(
    token: Optional[str] = Depends(cookie_scheme),
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Get current user, or None if not authenticated.

    Note: This function returns None for banned users to avoid exposing ban status
    in optional authentication contexts. For protected routes, use get_current_user
    which properly handles banned users with 403 response.
    """
    if auth:
        token = auth.credentials

    if not token:
        return None
    
    try:
        payload = jwt.decode(token, get_public_key(), algorithms=["RS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
        
    if not prisma.is_connected():
        await prisma.connect()
        
    user = await prisma.user.find_unique(where={"id": int(user_id)})
    
    # Return None for banned users in optional auth context
    if user and user.banned:
        return None
    
    return user


def create_access_token(data: dict):
    to_encode = data.copy()
    encoded_jwt = jwt.encode(to_encode, get_private_key(), algorithm="RS256")
    return encoded_jwt