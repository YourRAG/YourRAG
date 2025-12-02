"""
Redemption Code Routes

Provides endpoints for:
- User: Redeem code
- Admin: Generate and list codes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any
from prisma import Prisma

from auth import get_current_user
from credits_service import CreditsService
from redemption_service import RedemptionService
from schemas import (
    RedemptionGenerateRequest,
    RedemptionUseRequest,
    RedemptionCodeResponse,
    RedemptionListResponse,
    TransactionResponse
)

router = APIRouter(prefix="/redemption", tags=["redemption"])

# Use shared Prisma instance if possible, otherwise create new global
# Ideally we should import prisma from a common database module or reuse from main/auth
# Here we define a local one for simplicity as seen in credits.py 
# (Note: In production app, usually a single Prisma client is shared via Dependency Injection container or app state)
prisma = Prisma()

async def get_redemption_service() -> RedemptionService:
    """Get redemption service instance."""
    if not prisma.is_connected():
        await prisma.connect()
    credits_service = CreditsService(prisma)
    return RedemptionService(prisma, credits_service)

# =====================
# User Routes
# =====================

@router.post("/use", response_model=Dict[str, Any])
async def redeem_code(
    request: RedemptionUseRequest,
    current_user=Depends(get_current_user),
    service: RedemptionService = Depends(get_redemption_service),
):
    """User: Redeem a code to add credits."""
    try:
        result = await service.redeem_code(request.code, current_user.id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================
# Admin Routes
# =====================

@router.post("/admin/generate", response_model=List[RedemptionCodeResponse])
async def admin_generate_codes(
    request: RedemptionGenerateRequest,
    current_user=Depends(get_current_user),
    service: RedemptionService = Depends(get_redemption_service),
):
    """Admin: Generate new redemption codes."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        codes = await service.create_redemption_codes(
            amount=request.amount,
            count=request.count,
            created_by=current_user.id,
            expires_at=request.expiresAt,
            prefix=request.prefix or ""
        )
        return codes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/list", response_model=RedemptionListResponse)
async def admin_list_codes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    min_amount: Optional[int] = Query(None, alias="minAmount"),
    max_amount: Optional[int] = Query(None, alias="maxAmount"),
    current_user=Depends(get_current_user),
    service: RedemptionService = Depends(get_redemption_service),
):
    """Admin: List redemption codes."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        result = await service.list_codes(
            page=page,
            page_size=page_size,
            status=status,
            min_amount=min_amount,
            max_amount=max_amount
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/cleanup/used", response_model=Dict[str, Any])
async def admin_cleanup_used_codes(
    current_user=Depends(get_current_user),
    service: RedemptionService = Depends(get_redemption_service),
):
    """Admin: Delete all used redemption codes."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        deleted_count = await service.delete_used_codes()
        return {"success": True, "deleted": deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/cleanup/expired", response_model=Dict[str, Any])
async def admin_cleanup_expired_codes(
    current_user=Depends(get_current_user),
    service: RedemptionService = Depends(get_redemption_service),
):
    """Admin: Delete all expired redemption codes."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        deleted_count = await service.delete_expired_codes()
        return {"success": True, "deleted": deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))