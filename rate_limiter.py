from fastapi import Request, HTTPException, status
from functools import wraps
import config
from redis_service import RedisService

def rate_limit(key_prefix: str = "global"):
    """
    Rate limiting decorator using Token Bucket algorithm.
    
    Args:
        key_prefix: Prefix for the rate limit key to distinguish different endpoints
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 1. Global Rate Limiting
            if config.GLOBAL_RATE_LIMIT_CAPACITY > 0:
                allowed = await RedisService.acquire_token(
                    key=f"global_limit:{key_prefix}",
                    capacity=config.GLOBAL_RATE_LIMIT_CAPACITY,
                    rate=config.GLOBAL_RATE_LIMIT_RATE
                )
                if not allowed:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="System Busy"
                    )

            # 2. User Rate Limiting
            # Check if user rate limiting is enabled
            if config.RATE_LIMIT_CAPACITY <= 0:
                return await func(*args, **kwargs)
            
            # Get request object
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                for key, value in kwargs.items():
                    if isinstance(value, Request):
                        request = value
                        break
            
            if request:
                # Use client IP as identifier
                # Priority: CF-Connecting-IP > X-Forwarded-For > Client Host
                client_ip = request.headers.get("CF-Connecting-IP")
                
                if not client_ip:
                    forwarded = request.headers.get("X-Forwarded-For")
                    if forwarded:
                        # X-Forwarded-For can be a list, take the first one
                        client_ip = forwarded.split(",")[0].strip()
                
                if not client_ip:
                    client_ip = request.client.host if request.client else "unknown"
                
                # Construct unique key: prefix:ip
                key = f"{key_prefix}:{client_ip}"
                
                allowed = await RedisService.acquire_token(
                    key=key,
                    capacity=config.RATE_LIMIT_CAPACITY,
                    rate=config.RATE_LIMIT_RATE
                )
                
                if not allowed:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Too Many Requests"
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator