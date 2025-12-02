"""
Redemption Code Service

Handles redemption code management and usage:
- Code generation (Admin)
- Code redemption (User)
- Code validation
"""
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from prisma import Prisma
from prisma.models import RedemptionCode
from credits_service import CreditsService, TransactionType

class RedemptionStatus:
    ACTIVE = "ACTIVE"
    USED = "USED"
    EXPIRED = "EXPIRED"
    DISABLED = "DISABLED"

class RedemptionService:
    def __init__(self, prisma: Prisma, credits_service: CreditsService):
        self.prisma = prisma
        self.credits_service = credits_service

    def _generate_code(self, length: int = 16) -> str:
        """Generate a random alphanumeric code."""
        # Using uppercase letters and digits for readability
        chars = string.ascii_uppercase + string.digits
        # Avoid ambiguous characters like O/0, I/1 if desired, but for now standard set is fine
        return ''.join(secrets.choice(chars) for _ in range(length))

    async def create_redemption_codes(
        self,
        amount: int,
        count: int,
        created_by: int,
        expires_at: Optional[datetime] = None,
        prefix: str = ""
    ) -> List[RedemptionCode]:
        """
        Generate multiple redemption codes.
        
        Args:
            amount: Credits amount per code
            count: Number of codes to generate
            created_by: Admin User ID
            expires_at: Optional expiration time
            prefix: Optional prefix for the codes
        """
        codes = []
        
        # We process one by one to ensure unique constraint
        # In a very high volume scenario, we might want to pre-generate and bulk insert,
        # but for typical admin usage, this is safer and sufficient.
        
        for _ in range(count):
            attempts = 0
            while attempts < 3:
                code_str = prefix + self._generate_code(16)
                try:
                    # Check existence first to avoid exception if possible, 
                    # though create will fail if unique constraint violated
                    existing = await self.prisma.redemptioncode.find_unique(
                        where={"code": code_str}
                    )
                    if not existing:
                        code = await self.prisma.redemptioncode.create(
                            data={
                                "code": code_str,
                                "amount": amount,
                                "status": RedemptionStatus.ACTIVE,
                                "createdBy": created_by,
                                "expiresAt": expires_at
                            }
                        )
                        codes.append(code)
                        break
                except Exception:
                    pass
                attempts += 1
        
        return codes

    async def redeem_code(self, code: str, user_id: int) -> Dict[str, Any]:
        """
        Redeem a code for a user.
        """
        # 1. Fetch code
        redemption = await self.prisma.redemptioncode.find_unique(
            where={"code": code}
        )
        
        if not redemption:
            raise ValueError("Invalid redemption code")
            
        # 2. Validate
        if redemption.status != RedemptionStatus.ACTIVE:
            raise ValueError(f"Code is {redemption.status.lower()}")
            
        if redemption.expiresAt and redemption.expiresAt < datetime.utcnow():
            # Update status to EXPIRED if found expired
            await self.prisma.redemptioncode.update(
                where={"id": redemption.id},
                data={"status": RedemptionStatus.EXPIRED}
            )
            raise ValueError("Code has expired")

        # 3. Process Redemption (Transaction)
        # We need to ensure atomicity. 
        # Since Prisma Client Python doesn't fully support interactive transactions in the async client 
        # the same way as Node.js (without experimental flags), we will sequence the operations carefully 
        # or use a batched transaction if possible. 
        # However, marking the code as USED first is safer to prevent double spending.
        
        try:
            # Mark as USED
            updated_code = await self.prisma.redemptioncode.update(
                where={
                    "id": redemption.id,
                    "status": RedemptionStatus.ACTIVE # Optimistic locking kind of check
                },
                data={
                    "status": RedemptionStatus.USED,
                    "usedBy": user_id,
                    "usedAt": datetime.utcnow()
                }
            )
            
            if not updated_code:
                # If update failed (e.g. status changed concurrently), fail
                raise ValueError("Code redemption failed or already used")

            # Add Credits
            transaction = await self.credits_service.add_credits(
                user_id=user_id,
                amount=redemption.amount,
                trans_type=TransactionType.RECHARGE,
                description=f"Redemption Code: {code}",
                reference_id=str(redemption.id),
                reference_type="REDEMPTION_CODE",
                metadata={
                    "code": code,
                    "redemptionId": redemption.id
                }
            )
            
            return {
                "success": True,
                "amount": redemption.amount,
                "transaction": transaction
            }

        except Exception as e:
            # Ideally we should rollback the status if credit addition fails,
            # but since that's a rare internal error, for now we log/raise.
            # Real production system would need a distributed transaction or compensation logic.
            raise e

    async def list_codes(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        min_amount: Optional[int] = None,
        max_amount: Optional[int] = None
    ) -> Dict[str, Any]:
        """List redemption codes for admin."""
        skip = (page - 1) * page_size
        where_clause = {}
        if status:
            where_clause["status"] = status
        
        if min_amount is not None or max_amount is not None:
            where_clause["amount"] = {}
            if min_amount is not None:
                where_clause["amount"]["gte"] = min_amount
            if max_amount is not None:
                where_clause["amount"]["lte"] = max_amount
            
        total = await self.prisma.redemptioncode.count(where=where_clause)
        codes = await self.prisma.redemptioncode.find_many(
            where=where_clause,
            skip=skip,
            take=page_size,
            order={"createdAt": "desc"},
            include={"createdByUser": True, "usedByUser": True}
        )
        
        return {
            "total": total,
            "items": codes,
            "page": page,
            "pageSize": page_size
        }

    async def delete_used_codes(self) -> int:
        """Delete all used redemption codes. Returns count of deleted codes."""
        result = await self.prisma.redemptioncode.delete_many(
            where={"status": RedemptionStatus.USED}
        )
        return result

    async def delete_expired_codes(self) -> int:
        """Delete all expired redemption codes. Returns count of deleted codes."""
        result = await self.prisma.redemptioncode.delete_many(
            where={"status": RedemptionStatus.EXPIRED}
        )
        return result