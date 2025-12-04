"""
Credits and Billing Service

Handles all credit-related operations including:
- Credit balance queries
- Transaction recording
- Credit adjustments (admin)
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from prisma import Prisma
from prisma import Json
from enum import Enum


class TransactionType(str, Enum):
    RECHARGE = "RECHARGE"
    CONSUMPTION = "CONSUMPTION"
    REFUND = "REFUND"
    BONUS = "BONUS"
    ADJUSTMENT = "ADJUSTMENT"


class TransactionStatus(str, Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class CreditsService:
    """Service for managing user credits and transactions."""

    def __init__(self, prisma: Prisma):
        self.prisma = prisma

    async def get_user_credits(self, user_id: int) -> int:
        """Get user's current credit balance."""
        user = await self.prisma.user.find_unique(where={"id": user_id})
        if not user:
            raise ValueError(f"User {user_id} not found")
        return user.credits

    async def get_user_credits_summary(self, user_id: int) -> Dict[str, Any]:
        """Get user's credit summary including statistics."""
        user = await self.prisma.user.find_unique(where={"id": user_id})
        if not user:
            raise ValueError(f"User {user_id} not found")

        # Get transaction statistics
        total_recharged = await self._get_total_by_type(
            user_id, TransactionType.RECHARGE
        )
        total_consumed = await self._get_total_by_type(
            user_id, TransactionType.CONSUMPTION
        )
        total_bonus = await self._get_total_by_type(
            user_id, TransactionType.BONUS
        )

        return {
            "balance": user.credits,
            "totalRecharged": total_recharged,
            "totalConsumed": abs(total_consumed),
            "totalBonus": total_bonus,
        }

    async def _get_total_by_type(
        self, user_id: int, trans_type: TransactionType
    ) -> int:
        """Get total amount for a specific transaction type."""
        result = await self.prisma.query_raw(
            """
            SELECT COALESCE(SUM(amount), 0) as total
            FROM "Transaction"
            WHERE "userId" = $1 AND type = $2 AND status = 'COMPLETED'
            """,
            user_id,
            trans_type.value,
        )
        return int(result[0]["total"]) if result else 0

    async def add_credits(
        self,
        user_id: int,
        amount: int,
        trans_type: TransactionType,
        description: str,
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Add credits to user account and record transaction.

        Args:
            user_id: Target user ID
            amount: Credit amount (positive for add, negative for deduct)
            trans_type: Type of transaction
            description: Transaction description
            reference_id: Optional reference ID
            reference_type: Optional reference type
            metadata: Optional additional data

        Returns:
            Transaction record
        """
        user = await self.prisma.user.find_unique(where={"id": user_id})
        if not user:
            raise ValueError(f"User {user_id} not found")

        balance_before = user.credits
        balance_after = balance_before + amount

        # Prevent negative balance
        if balance_after < 0:
            raise ValueError("Insufficient credits")

        # Create transaction and update user balance in a transaction
        # Build data dict using connect syntax for relation
        create_data: Dict[str, Any] = {
            "user": {"connect": {"id": user_id}},
            "type": trans_type.value,
            "status": TransactionStatus.COMPLETED.value,
            "amount": amount,
            "balanceBefore": balance_before,
            "balanceAfter": balance_after,
            "description": description,
            "referenceId": reference_id,
            "referenceType": reference_type,
        }
        
        # Only set metadata if it has a value (Prisma Json field handling)
        if metadata is not None:
            create_data["metadata"] = Json(metadata)
        
        transaction = await self.prisma.transaction.create(data=create_data)

        # Update user balance
        await self.prisma.user.update(
            where={"id": user_id},
            data={"credits": balance_after},
        )

        return self._format_transaction(transaction)

    async def deduct_credits(
        self,
        user_id: int,
        amount: int,
        description: str,
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Deduct credits from user account."""
        return await self.add_credits(
            user_id=user_id,
            amount=-abs(amount),
            trans_type=TransactionType.CONSUMPTION,
            description=description,
            reference_id=reference_id,
            reference_type=reference_type,
            metadata=metadata,
        )

    async def get_transactions(
        self,
        user_id: int,
        limit: int = 20,
        offset: int = 0,
        trans_type: Optional[TransactionType] = None,
    ) -> Dict[str, Any]:
        """Get user's transaction history."""
        where: Dict[str, Any] = {"userId": user_id}
        if trans_type:
            where["type"] = trans_type.value

        transactions = await self.prisma.transaction.find_many(
            where=where,
            order={"createdAt": "desc"},
            take=limit,
            skip=offset,
        )

        total = await self.prisma.transaction.count(where=where)

        return {
            "transactions": [self._format_transaction(t) for t in transactions],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def get_transaction_by_id(
        self, transaction_id: int, user_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """Get a specific transaction by ID."""
        where: Dict[str, Any] = {"id": transaction_id}
        if user_id:
            where["userId"] = user_id

        transaction = await self.prisma.transaction.find_first(where=where)
        if not transaction:
            return None

        return self._format_transaction(transaction)

    async def admin_adjust_credits(
        self,
        user_id: int,
        amount: int,
        description: str,
        admin_id: int,
        reference_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Admin operation to adjust user credits."""
        final_ref_id = reference_id if reference_id else str(admin_id)
        
        return await self.add_credits(
            user_id=user_id,
            amount=amount,
            trans_type=TransactionType.ADJUSTMENT,
            description=description,
            reference_id=final_ref_id,
            reference_type="ADMIN_ADJUSTMENT",
            metadata={"adjustedBy": admin_id, "manualReference": reference_id},
        )

    async def grant_bonus(
        self,
        user_id: int,
        amount: int,
        description: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Grant bonus credits to user."""
        return await self.add_credits(
            user_id=user_id,
            amount=abs(amount),
            trans_type=TransactionType.BONUS,
            description=description,
            metadata={"reason": reason} if reason else None,
        )

    def _format_transaction(self, transaction) -> Dict[str, Any]:
        """Format transaction for API response."""
        return {
            "id": transaction.id,
            "userId": transaction.userId,
            "type": transaction.type,
            "status": transaction.status,
            "amount": transaction.amount,
            "balanceBefore": transaction.balanceBefore,
            "balanceAfter": transaction.balanceAfter,
            "description": transaction.description,
            "referenceId": transaction.referenceId,
            "referenceType": transaction.referenceType,
            "metadata": transaction.metadata,
            "createdAt": transaction.createdAt.isoformat(),
            "updatedAt": transaction.updatedAt.isoformat(),
        }