"""
Credits and Billing API Routes

Provides endpoints for:
- User credit balance and summary
- Transaction history
- Admin credit adjustments
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from pydantic import BaseModel, Field
from prisma import Prisma

from auth import get_current_user
from credits_service import CreditsService, TransactionType


router = APIRouter(prefix="/credits", tags=["credits"])

# Initialize Prisma client
prisma = Prisma()


async def get_credits_service() -> CreditsService:
    """Get credits service instance."""
    if not prisma.is_connected():
        await prisma.connect()
    return CreditsService(prisma)


# Request/Response Models
class CreditsSummaryResponse(BaseModel):
    balance: int
    totalRecharged: int
    totalConsumed: int
    totalBonus: int


class TransactionItem(BaseModel):
    id: int
    userId: int
    type: str
    status: str
    amount: int
    balanceBefore: int
    balanceAfter: int
    description: str
    referenceId: Optional[str] = None
    referenceType: Optional[str] = None
    metadata: Optional[dict] = None
    createdAt: str
    updatedAt: str


class TransactionsResponse(BaseModel):
    transactions: list[TransactionItem]
    total: int
    limit: int
    offset: int


class AdjustCreditsRequest(BaseModel):
    userId: int
    amount: int = Field(..., description="Positive to add, negative to deduct")
    description: str


class GrantBonusRequest(BaseModel):
    userId: int
    amount: int = Field(..., gt=0, description="Must be positive")
    description: str
    reason: Optional[str] = None


class TransactionResponse(BaseModel):
    transaction: TransactionItem


# User Endpoints


@router.get("/balance", response_model=dict)
async def get_balance(
    current_user=Depends(get_current_user),
    service: CreditsService = Depends(get_credits_service),
):
    """Get current user's credit balance."""
    try:
        balance = await service.get_user_credits(current_user.id)
        return {"balance": balance}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/summary", response_model=CreditsSummaryResponse)
async def get_credits_summary(
    current_user=Depends(get_current_user),
    service: CreditsService = Depends(get_credits_service),
):
    """Get current user's credit summary with statistics."""
    try:
        summary = await service.get_user_credits_summary(current_user.id)
        return CreditsSummaryResponse(**summary)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/transactions", response_model=TransactionsResponse)
async def get_transactions(
    type: Optional[str] = Query(None, description="Filter by transaction type"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
    service: CreditsService = Depends(get_credits_service),
):
    """Get current user's transaction history."""
    trans_type = None
    if type:
        try:
            trans_type = TransactionType(type)
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid transaction type: {type}"
            )

    result = await service.get_transactions(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        trans_type=trans_type,
    )
    return TransactionsResponse(**result)


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    current_user=Depends(get_current_user),
    service: CreditsService = Depends(get_credits_service),
):
    """Get a specific transaction by ID."""
    transaction = await service.get_transaction_by_id(
        transaction_id, user_id=current_user.id
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"transaction": transaction}


# Admin Endpoints


@router.post("/admin/adjust", response_model=TransactionResponse)
async def admin_adjust_credits(
    request: AdjustCreditsRequest,
    current_user=Depends(get_current_user),
    service: CreditsService = Depends(get_credits_service),
):
    """Admin: Adjust user's credits (add or deduct)."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        transaction = await service.admin_adjust_credits(
            user_id=request.userId,
            amount=request.amount,
            description=request.description,
            admin_id=current_user.id,
        )
        return {"transaction": transaction}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/bonus", response_model=TransactionResponse)
async def admin_grant_bonus(
    request: GrantBonusRequest,
    current_user=Depends(get_current_user),
    service: CreditsService = Depends(get_credits_service),
):
    """Admin: Grant bonus credits to user."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        transaction = await service.grant_bonus(
            user_id=request.userId,
            amount=request.amount,
            description=request.description,
            reason=request.reason,
        )
        return {"transaction": transaction}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/admin/user/{user_id}/summary", response_model=CreditsSummaryResponse)
async def admin_get_user_summary(
    user_id: int,
    current_user=Depends(get_current_user),
    service: CreditsService = Depends(get_credits_service),
):
    """Admin: Get specific user's credit summary."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        summary = await service.get_user_credits_summary(user_id)
        return CreditsSummaryResponse(**summary)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/admin/user/{user_id}/transactions", response_model=TransactionsResponse)
async def admin_get_user_transactions(
    user_id: int,
    type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
    service: CreditsService = Depends(get_credits_service),
):
    """Admin: Get specific user's transaction history."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")

    trans_type = None
    if type:
        try:
            trans_type = TransactionType(type)
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid transaction type: {type}"
            )

    result = await service.get_transactions(
        user_id=user_id,
        limit=limit,
        offset=offset,
        trans_type=trans_type,
    )
    return TransactionsResponse(**result)