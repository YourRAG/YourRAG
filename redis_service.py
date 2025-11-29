import redis.asyncio as redis
import config
from typing import Optional, List
import time
import uuid
import asyncio
import socket

class RedisService:
    _instance: Optional[redis.Redis] = None
    _instance_id: str = str(uuid.uuid4())
    _heartbeat_task: Optional[asyncio.Task] = None
    _hostname: str = socket.gethostname()
    
    # Lua script for token bucket algorithm
    _token_bucket_script = """
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local requested = tonumber(ARGV[4])
    
    -- Get current bucket state
    local bucket_info = redis.call("HMGET", key, "tokens", "last_refill")
    local tokens = tonumber(bucket_info[1])
    local last_refill = tonumber(bucket_info[2])
    
    -- Initialize if not exists
    if tokens == nil then
        tokens = capacity
        last_refill = now
    end
    
    -- Refill tokens based on time passed
    local delta = math.max(0, now - last_refill)
    local new_tokens = delta * rate
    tokens = math.min(capacity, tokens + new_tokens)
    
    -- Check if we have enough tokens
    local allowed = 0
    if tokens >= requested then
        tokens = tokens - requested
        allowed = 1
    end
    
    -- Update bucket state
    redis.call("HMSET", key, "tokens", tokens, "last_refill", now)
    -- Set expiry to avoid stale keys (e.g., 1 hour)
    redis.call("EXPIRE", key, 3600)
    
    return allowed
    """

    @classmethod
    async def connect(cls):
        """Initialize Redis connection pool."""
        if cls._instance is None:
            try:
                # 尝试使用配置的密码连接
                cls._instance = redis.Redis(
                    host=config.REDIS_HOST,
                    port=config.REDIS_PORT,
                    password=config.REDIS_PASSWORD,
                    db=config.REDIS_DB,
                    decode_responses=True,
                    encoding="utf-8",
                )
                # Test connection
                await cls._instance.ping()
                print(f"成功连接到 Redis: {config.REDIS_HOST}:{config.REDIS_PORT}")
            except redis.ResponseError as e:
                # 如果报错提示未配置密码，则尝试免密连接
                if "without any password configured" in str(e):
                    print(f"Redis 服务器未配置密码，尝试免密连接...")
                    await cls._instance.close()
                    cls._instance = redis.Redis(
                        host=config.REDIS_HOST,
                        port=config.REDIS_PORT,
                        password=None,
                        db=config.REDIS_DB,
                        decode_responses=True,
                        encoding="utf-8",
                    )
                    await cls._instance.ping()
                    print(f"成功以免密模式连接到 Redis: {config.REDIS_HOST}:{config.REDIS_PORT}")
                else:
                    raise e
            except Exception as e:
                print(f"连接 Redis 失败: {e}")
                raise e
            
            # Start heartbeat
            cls._heartbeat_task = asyncio.create_task(cls._run_heartbeat())

    @classmethod
    async def disconnect(cls):
        """Close Redis connection."""
        if cls._heartbeat_task:
            cls._heartbeat_task.cancel()
            try:
                await cls._heartbeat_task
            except asyncio.CancelledError:
                pass
            
            # Remove self from active instances
            if cls._instance:
                try:
                    await cls._instance.zrem("active_instances", cls._instance_id)
                except Exception:
                    pass

        if cls._instance:
            await cls._instance.close()
            cls._instance = None
            print("已断开 Redis 连接")

    @classmethod
    def get_client(cls) -> redis.Redis:
        """Get Redis client instance."""
        if cls._instance is None:
            raise RuntimeError("Redis 客户端未初始化，请先调用 connect()")
        return cls._instance

    @classmethod
    async def _run_heartbeat(cls):
        """Periodically update instance heartbeat."""
        while True:
            try:
                if cls._instance:
                    # Use current timestamp as score
                    # Value format: hostname:uuid
                    member = f"{cls._hostname}:{cls._instance_id}"
                    await cls._instance.zadd("active_instances", {member: time.time()})
                    # Expire old instances (older than 15 seconds)
                    min_score = time.time() - 15
                    await cls._instance.zremrangebyscore("active_instances", 0, min_score)
            except Exception as e:
                print(f"心跳检测错误: {e}")
            
            await asyncio.sleep(5)

    @classmethod
    async def get_active_instances(cls) -> List[str]:
        """Get list of active instances."""
        if not cls._instance:
            return []
        
        # Get all members with score > now - 15s
        min_score = time.time() - 15
        instances = await cls._instance.zrangebyscore("active_instances", min_score, "+inf")
        return instances

    @classmethod
    async def acquire_token(cls, key: str, capacity: int, rate: float, tokens: int = 1) -> bool:
        """
        Try to acquire tokens from the bucket.
        
        Args:
            key: Unique key for the bucket (e.g., user_id or ip)
            capacity: Maximum number of tokens in the bucket
            rate: Token refill rate per second
            tokens: Number of tokens to acquire
            
        Returns:
            True if tokens were acquired, False otherwise
        """
        if not cls._instance:
            # If Redis is not connected, fail open (allow request) or closed (deny)
            # Here we choose to fail open to avoid blocking service
            return True
            
        try:
            # Use Lua script for atomicity
            result = await cls._instance.eval(
                cls._token_bucket_script,
                1,  # numkeys
                f"rate_limit:{key}",  # key
                capacity,  # argv[1]
                rate,      # argv[2]
                time.time(), # argv[3]
                tokens     # argv[4]
            )
            return bool(result)
        except Exception as e:
            print(f"限流检查失败: {e}")
            # Fail open on error
            return True