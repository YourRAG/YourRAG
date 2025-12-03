"""Admin routes including user management, system config, and API keys."""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime
import uuid

from fastapi import Query

from schemas import (
    BanInput,
    UserResponse,
    UpdateSettingsInput,
    SystemConfigInput,
    ApiKeyCreateInput,
    ApiKeyResponse,
    ActivitiesResponse,
    BatchAdjustCreditsRequest,
)
from auth import get_current_user, prisma
from redis_service import RedisService
from config_service import config_service
from activity_service import record_settings_update, ActivityService
from credits_service import CreditsService

router = APIRouter()


# =====================
# System Routes
# =====================


@router.get("/system/instances")
async def get_active_instances():
    """Get list of active backend instances connected to Redis."""
    try:
        instances = await RedisService.get_active_instances()
        return {"count": len(instances), "instances": instances}
    except Exception:
        return {"count": 0, "instances": []}


@router.get("/system/config")
async def get_public_config():
    """Get public system configurations (no authentication required)."""
    try:
        configs = await config_service.get_public_configs()
        return configs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/config")
async def get_system_config(current_user=Depends(get_current_user)):
    """Get all system configurations (Admin only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        configs = await config_service.get_all_configs()
        return configs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/config")
async def update_system_config(input_data: SystemConfigInput, current_user=Depends(get_current_user)):
    """Update system configurations (Admin only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        for key, value in input_data.configs.items():
            await config_service.set_config(key, value)
        return {"message": "Configuration updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/stats")
async def get_admin_stats(current_user=Depends(get_current_user)):
    """Get admin statistics."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        total_users = await prisma.user.count()
        total_documents = await prisma.document.count()
        total_activities = await prisma.activity.count()
        
        return {
            "totalUsers": total_users,
            "totalDocuments": total_documents,
            "totalActivities": total_activities
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# User Management Routes
# =====================


@router.get("/admin/users")
async def get_users(
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    role: Optional[str] = None,
    min_credits: Optional[int] = Query(None, alias="minCredits"),
    max_credits: Optional[int] = Query(None, alias="maxCredits"),
    start_date: Optional[str] = Query(None, alias="startDate"),
    end_date: Optional[str] = Query(None, alias="endDate"),
    current_user=Depends(get_current_user)
):
    """Get paginated users list with advanced filtering."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        skip = (page - 1) * page_size
        where = {}
        if search:
            where["OR"] = [
                {"username": {"contains": search, "mode": "insensitive"}},
                {"email": {"contains": search, "mode": "insensitive"}},
            ]
        
        if role:
            where["role"] = role

        if min_credits is not None or max_credits is not None:
            where["credits"] = {}
            if min_credits is not None:
                where["credits"]["gte"] = min_credits
            if max_credits is not None:
                where["credits"]["lte"] = max_credits
        
        if start_date or end_date:
            where["createdAt"] = {}
            if start_date:
                where["createdAt"]["gte"] = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            if end_date:
                where["createdAt"]["lte"] = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            
        users = await prisma.user.find_many(
            where=where,
            skip=skip,
            take=page_size,
            order={"createdAt": "desc"},
            include={"documents": True}
        )
        
        users_with_count = []
        for user in users:
            user_dict = user.dict()
            user_dict["documentCount"] = len(user.documents)
            del user_dict["documents"]
            users_with_count.append(user_dict)
        
        total = await prisma.user.count(where=where)
        
        return {
            "users": users_with_count,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/users/{user_id}/ban")
async def ban_user(user_id: int, input_data: BanInput, current_user=Depends(get_current_user)):
    """Ban a user."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")
        
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot ban yourself")

    try:
        await prisma.user.update(
            where={"id": user_id},
            data={
                "banned": True,
                "banReason": input_data.reason,
                "bannedAt": datetime.utcnow()
            }
        )
        return {"message": "User banned successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/users/{user_id}/unban")
async def unban_user(user_id: int, current_user=Depends(get_current_user)):
    """Unban a user."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")

    try:
        await prisma.user.update(
            where={"id": user_id},
            data={"banned": False, "banReason": None, "bannedAt": None}
        )
        return {"message": "User unbanned successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/credits/batch")
async def batch_adjust_credits(
    input_data: BatchAdjustCreditsRequest,
    current_user=Depends(get_current_user)
):
    """Batch adjust credits for multiple users."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")

    try:
        service = CreditsService(prisma)
        success_count = 0
        failed_ids = []

        for user_id in input_data.userIds:
            try:
                await service.admin_adjust_credits(
                    user_id=user_id,
                    amount=input_data.amount,
                    description=input_data.description,
                    admin_id=current_user.id
                )
                success_count += 1
            except Exception:
                failed_ids.append(user_id)

        return {
            "message": "Batch operation completed",
            "total": len(input_data.userIds),
            "successful": success_count,
            "failed": len(failed_ids),
            "failedIds": failed_ids
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int, current_user=Depends(get_current_user)):
    """Delete a transaction record (Admin only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")

    try:
        # Check if transaction exists
        transaction = await prisma.transaction.find_unique(where={"id": transaction_id})
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")

        # Delete transaction
        await prisma.transaction.delete(where={"id": transaction_id})
        
        return {"message": "Transaction deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/users/{user_id}/activities", response_model=ActivitiesResponse)
async def get_user_activities(
    user_id: int,
    limit: int = Query(10, ge=1, le=50, description="Number of activities to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user=Depends(get_current_user)
):
    """Get a user's activities (Admin only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        user = await prisma.user.find_unique(where={"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        service = ActivityService(prisma)
        activities = await service.get_user_activities(
            user_id=user_id, limit=limit, offset=offset
        )
        total = await service.get_activity_count(user_id)
        
        return ActivitiesResponse(activities=activities, total=total)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# User Settings Routes
# =====================


@router.put("/user/settings", response_model=UserResponse)
async def update_user_settings(input_data: UpdateSettingsInput, current_user=Depends(get_current_user)):
    """Update user settings."""
    try:
        if not prisma.is_connected():
            await prisma.connect()

        user = await prisma.user.update(
            where={"id": current_user.id},
            data={
                "topK": input_data.topK,
                "similarityThreshold": input_data.similarityThreshold,
            },
        )

        await record_settings_update(
            prisma,
            current_user.id,
            f"Updated settings: Top K={input_data.topK}, Threshold={input_data.similarityThreshold}",
        )

        return user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# API Key Routes
# =====================


@router.get("/user/apikeys", response_model=List[ApiKeyResponse])
async def get_api_keys(current_user=Depends(get_current_user)):
    """Get user's API keys."""
    try:
        api_keys = await prisma.apikey.find_many(
            where={"userId": current_user.id},
            order={"createdAt": "desc"}
        )
        return api_keys
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user/apikeys", response_model=ApiKeyResponse)
async def create_api_key(input_data: ApiKeyCreateInput, current_user=Depends(get_current_user)):
    """Create a new API key."""
    try:
        key = f"rag-{uuid.uuid4().hex}"
        
        api_key = await prisma.apikey.create(
            data={
                "key": key,
                "name": input_data.name,
                "userId": current_user.id,
                "expiresAt": input_data.expiresAt,
            }
        )
        return api_key
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/user/apikeys/{key_id}")
async def delete_api_key(key_id: int, current_user=Depends(get_current_user)):
    """Delete an API key."""
    try:
        api_key = await prisma.apikey.find_unique(where={"id": key_id})
        if not api_key or api_key.userId != current_user.id:
            raise HTTPException(status_code=404, detail="API key not found")
            
        await prisma.apikey.delete(where={"id": key_id})
        return {"message": "API key deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))