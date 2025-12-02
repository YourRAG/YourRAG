"""User data export routes."""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from typing import Optional
from datetime import datetime, timezone

from auth import get_current_user, prisma
from redis_service import RedisService
from schemas import UserDataExportResponse

router = APIRouter(prefix="/user", tags=["export"])

# Export rate limit: 24 hours in seconds
EXPORT_COOLDOWN_SECONDS = 86400


async def check_export_limit(user_id: int) -> Optional[str]:
    """
    Check if user can export data.
    
    Returns:
        None if allowed, otherwise the remaining time message.
    """
    try:
        client = RedisService.get_client()
        key = f"export_limit:{user_id}"
        
        last_export = await client.get(key)
        if last_export:
            last_export_time = datetime.fromisoformat(last_export)
            now = datetime.now(timezone.utc)
            elapsed = (now - last_export_time).total_seconds()
            remaining = EXPORT_COOLDOWN_SECONDS - elapsed
            
            if remaining > 0:
                hours = int(remaining // 3600)
                minutes = int((remaining % 3600) // 60)
                return f"{hours}h {minutes}m"
        
        return None
    except RuntimeError:
        # Redis not connected, allow export
        return None


async def set_export_timestamp(user_id: int) -> None:
    """Record the export timestamp for rate limiting."""
    try:
        client = RedisService.get_client()
        key = f"export_limit:{user_id}"
        now = datetime.now(timezone.utc).isoformat()
        await client.set(key, now, ex=EXPORT_COOLDOWN_SECONDS)
    except RuntimeError:
        # Redis not connected, skip recording
        pass


@router.get("/export", response_model=UserDataExportResponse)
async def export_user_data(
    include_documents: bool = Query(True, description="Include documents"),
    include_groups: bool = Query(True, description="Include document groups"),
    include_activities: bool = Query(True, description="Include activity records"),
    include_transactions: bool = Query(True, description="Include transaction records"),
    include_api_keys: bool = Query(True, description="Include API keys (keys masked)"),
    current_user=Depends(get_current_user)
):
    """
    Export all user data as JSON.
    
    Rate limited to once per 24 hours.
    """
    # Check export rate limit
    remaining_time = await check_export_limit(current_user.id)
    if remaining_time:
        raise HTTPException(
            status_code=429,
            detail=f"Export limit reached. Please try again in {remaining_time}."
        )
    
    try:
        export_data = {
            "exportedAt": datetime.now(timezone.utc).isoformat(),
            "version": "1.0",
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "avatarUrl": current_user.avatarUrl,
                "role": current_user.role,
                "topK": current_user.topK,
                "similarityThreshold": current_user.similarityThreshold,
                "credits": current_user.credits,
            }
        }
        
        # Export documents
        if include_documents:
            documents = await prisma.document.find_many(
                where={"userId": current_user.id},
                order={"createdAt": "desc"}
            )
            export_data["documents"] = [
                {
                    "id": doc.id,
                    "content": doc.content,
                    "metadata": doc.metadata,
                    "groupId": doc.groupId,
                    "createdAt": doc.createdAt.isoformat() if doc.createdAt else None,
                    "updatedAt": doc.updatedAt.isoformat() if doc.updatedAt else None,
                }
                for doc in documents
            ]
        
        # Export document groups
        if include_groups:
            groups = await prisma.documentgroup.find_many(
                where={"userId": current_user.id},
                order={"createdAt": "desc"}
            )
            
            # Get document counts for each group
            group_data = []
            for group in groups:
                doc_count = await prisma.document.count(
                    where={"groupId": group.id}
                )
                group_data.append({
                    "id": group.id,
                    "name": group.name,
                    "documentCount": doc_count,
                    "createdAt": group.createdAt.isoformat() if group.createdAt else None,
                    "updatedAt": group.updatedAt.isoformat() if group.updatedAt else None,
                })
            export_data["groups"] = group_data
        
        # Export activities
        if include_activities:
            activities = await prisma.activity.find_many(
                where={"userId": current_user.id},
                order={"createdAt": "desc"}
            )
            export_data["activities"] = [
                {
                    "id": act.id,
                    "type": act.type,
                    "title": act.title,
                    "description": act.description,
                    "metadata": act.metadata,
                    "createdAt": act.createdAt.isoformat() if act.createdAt else None,
                }
                for act in activities
            ]
        
        # Export transactions
        if include_transactions:
            transactions = await prisma.transaction.find_many(
                where={"userId": current_user.id},
                order={"createdAt": "desc"}
            )
            export_data["transactions"] = [
                {
                    "id": txn.id,
                    "type": txn.type,
                    "status": txn.status,
                    "amount": txn.amount,
                    "balanceBefore": txn.balanceBefore,
                    "balanceAfter": txn.balanceAfter,
                    "description": txn.description,
                    "referenceId": txn.referenceId,
                    "referenceType": txn.referenceType,
                    "metadata": txn.metadata,
                    "createdAt": txn.createdAt.isoformat() if txn.createdAt else None,
                    "updatedAt": txn.updatedAt.isoformat() if txn.updatedAt else None,
                }
                for txn in transactions
            ]
        
        # Export API keys (mask the actual key values)
        if include_api_keys:
            api_keys = await prisma.apikey.find_many(
                where={"userId": current_user.id},
                order={"createdAt": "desc"}
            )
            export_data["apiKeys"] = [
                {
                    "id": key.id,
                    "name": key.name,
                    "keyPrefix": key.key[:8] + "..." if key.key else None,
                    "isActive": key.isActive,
                    "createdAt": key.createdAt.isoformat() if key.createdAt else None,
                    "expiresAt": key.expiresAt.isoformat() if key.expiresAt else None,
                    "lastUsedAt": key.lastUsedAt.isoformat() if key.lastUsedAt else None,
                }
                for key in api_keys
            ]
        
        # Record this export for rate limiting
        await set_export_timestamp(current_user.id)
        
        return export_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/status")
async def get_export_status(current_user=Depends(get_current_user)):
    """Check if user can export data and when."""
    remaining_time = await check_export_limit(current_user.id)
    
    if remaining_time:
        return {
            "canExport": False,
            "nextExportIn": remaining_time,
            "message": f"You can export again in {remaining_time}"
        }
    
    return {
        "canExport": True,
        "nextExportIn": None,
        "message": "You can export your data now"
    }