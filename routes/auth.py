"""Authentication and activity routes."""

from fastapi import APIRouter, HTTPException, Query, Depends, Response, Request
from fastapi.responses import RedirectResponse

from schemas import (
    UserResponse,
    ActivitiesResponse,
    UserStatsResponse,
)
from auth import (
    get_github_user,
    get_gitee_user,
    create_access_token,
    get_current_user,
    prisma,
)
from activity_service import (
    ActivityService,
    record_login,
)
from config_service import ConfigService
import config

router = APIRouter()

# GitHub OAuth callback URL
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
# Gitee OAuth callback URL
GITEE_AUTHORIZE_URL = "https://gitee.com/oauth/authorize"


# =====================
# Auth Routes
# =====================


@router.get("/auth/providers")
async def get_auth_providers():
    """Get available authentication providers."""
    providers = []
    if config.GITHUB_CLIENT_ID and config.GITHUB_CLIENT_SECRET:
        providers.append("github")
    if config.GITEE_CLIENT_ID and config.GITEE_CLIENT_SECRET:
        providers.append("gitee")
    return {"providers": providers}


@router.get("/auth/github")
async def github_login(request: Request):
    """Redirect to GitHub OAuth login."""
    callback_url = str(request.url_for("github_callback"))
    redirect_uri = f"{GITHUB_AUTHORIZE_URL}?client_id={config.GITHUB_CLIENT_ID}&scope=user:email&redirect_uri={callback_url}"
    return RedirectResponse(url=redirect_uri)


@router.get("/auth/github/callback")
async def github_callback(code: str, request: Request, response: Response):
    """Handle GitHub OAuth callback."""
    try:
        callback_url = str(request.url_for("github_callback"))
        github_user = await get_github_user(code, callback_url)

        # Find or create user
        user = await prisma.user.find_unique(where={"githubId": str(github_user["id"])})

        if not user:
            # Check if registration is disabled (except for first user who becomes admin)
            user_count = await prisma.user.count()
            
            if user_count > 0:
                # Check if registration is disabled
                config_service = ConfigService()
                if config_service.is_registration_disabled():
                    from urllib.parse import urlencode
                    error_params = urlencode({
                        "error": "registration_disabled",
                        "reason": "New user registration is currently disabled"
                    })
                    return RedirectResponse(
                        url=f"{config.FRONTEND_URL}?{error_params}", status_code=302
                    )
            
            role = "ADMIN" if user_count == 0 else "USER"

            user = await prisma.user.create(
                data={
                    "githubId": str(github_user["id"]),
                    "username": github_user["login"],
                    "email": github_user.get("email"),
                    "avatarUrl": github_user.get("avatar_url"),
                    "role": role,
                }
            )

        # Check if user is banned - prevent login for banned users
        if user.banned:
            from urllib.parse import urlencode
            error_params = urlencode({
                "error": "banned",
                "reason": user.banReason or "Your account has been banned"
            })
            return RedirectResponse(
                url=f"{config.FRONTEND_URL}?{error_params}", status_code=302
            )

        # Create JWT token
        token = create_access_token(data={"sub": str(user.id)})

        # Record login activity
        await record_login(prisma, user.id)

        # Set cookie and redirect to frontend
        response = RedirectResponse(url=config.FRONTEND_URL, status_code=302)
        response.set_cookie(
            key="token",
            value=token,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite="lax",
            max_age=60 * 60 * 24 * 7,  # 7 days
        )

        return response

    except Exception as e:
        import traceback

        error_msg = str(e) if str(e) else "Login failed"
        print(f"OAuth callback error: {error_msg}")
        print(traceback.format_exc())
        # Redirect to frontend with error parameter
        from urllib.parse import urlencode

        error_params = urlencode({"error": error_msg})
        return RedirectResponse(
            url=f"{config.FRONTEND_URL}?{error_params}", status_code=302
        )


@router.get("/auth/gitee")
async def gitee_login(request: Request):
    """Redirect to Gitee OAuth login."""
    callback_url = str(request.url_for("gitee_callback"))
    redirect_uri = f"{GITEE_AUTHORIZE_URL}?client_id={config.GITEE_CLIENT_ID}&response_type=code&redirect_uri={callback_url}"
    return RedirectResponse(url=redirect_uri)


@router.get("/auth/gitee/callback")
async def gitee_callback(code: str, request: Request, response: Response):
    """Handle Gitee OAuth callback."""
    try:
        callback_url = str(request.url_for("gitee_callback"))
        gitee_user = await get_gitee_user(code, callback_url)

        # Find or create user
        user = await prisma.user.find_unique(where={"giteeId": str(gitee_user["id"])})

        if not user:
            # Check if registration is disabled (except for first user who becomes admin)
            user_count = await prisma.user.count()
            
            if user_count > 0:
                # Check if registration is disabled
                config_service = ConfigService()
                if config_service.is_registration_disabled():
                    from urllib.parse import urlencode
                    error_params = urlencode({
                        "error": "registration_disabled",
                        "reason": "New user registration is currently disabled"
                    })
                    return RedirectResponse(
                        url=f"{config.FRONTEND_URL}?{error_params}", status_code=302
                    )
            
            role = "ADMIN" if user_count == 0 else "USER"

            user = await prisma.user.create(
                data={
                    "giteeId": str(gitee_user["id"]),
                    "username": gitee_user["login"],
                    "email": gitee_user.get("email"),
                    "avatarUrl": gitee_user.get("avatar_url"),
                    "role": role,
                }
            )

        # Check if user is banned - prevent login for banned users
        if user.banned:
            from urllib.parse import urlencode
            error_params = urlencode({
                "error": "banned",
                "reason": user.banReason or "Your account has been banned"
            })
            return RedirectResponse(
                url=f"{config.FRONTEND_URL}?{error_params}", status_code=302
            )

        # Create JWT token
        token = create_access_token(data={"sub": str(user.id)})

        # Record login activity
        await record_login(prisma, user.id)

        # Set cookie and redirect to frontend
        response = RedirectResponse(url=config.FRONTEND_URL, status_code=302)
        response.set_cookie(
            key="token",
            value=token,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite="lax",
            max_age=60 * 60 * 24 * 7,  # 7 days
        )

        return response

    except Exception as e:
        import traceback

        error_msg = str(e) if str(e) else "Login failed"
        print(f"OAuth callback error: {error_msg}")
        print(traceback.format_exc())
        # Redirect to frontend with error parameter
        from urllib.parse import urlencode

        error_params = urlencode({"error": error_msg})
        return RedirectResponse(
            url=f"{config.FRONTEND_URL}?{error_params}", status_code=302
        )


@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    """Get current authenticated user."""
    return UserResponse(
        id=current_user.id,
        githubId=current_user.githubId,
        giteeId=current_user.giteeId,
        username=current_user.username,
        email=current_user.email,
        avatarUrl=current_user.avatarUrl,
        role=current_user.role,
        topK=current_user.topK,
        similarityThreshold=current_user.similarityThreshold,
        credits=current_user.credits,
    )


@router.post("/auth/logout")
async def logout(response: Response):
    """Logout and clear cookie."""
    response = Response(
        content='{"message": "Logged out"}', media_type="application/json"
    )
    response.delete_cookie(key="token")
    return response


# =====================
# Activity Routes
# =====================


@router.get("/activities", response_model=ActivitiesResponse)
async def get_activities(
    limit: int = Query(10, ge=1, le=50, description="Number of activities to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user=Depends(get_current_user),
):
    """Get current user's activities."""
    try:
        service = ActivityService(prisma)
        activities = await service.get_user_activities(
            user_id=current_user.id, limit=limit, offset=offset
        )
        total = await service.get_activity_count(current_user.id)

        return ActivitiesResponse(activities=activities, total=total)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/activities")
async def clear_activities(current_user=Depends(get_current_user)):
    """Clear all activities for the current user."""
    try:
        service = ActivityService(prisma)
        count = await service.clear_user_activities(current_user.id)
        return {"message": f"Successfully cleared {count} activities"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/stats", response_model=UserStatsResponse)
async def get_user_stats(current_user=Depends(get_current_user)):
    """Get current user's statistics."""
    try:
        service = ActivityService(prisma)
        stats = await service.get_user_stats(current_user.id)
        return UserStatsResponse(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))