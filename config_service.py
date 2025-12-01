from prisma import Prisma
from typing import Dict, Any, Optional
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import config

class ConfigService:
    _instance = None
    _config_cache: Dict[str, str] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ConfigService, cls).__new__(cls)
        return cls._instance

    async def load_config(self):
        """Load all system configurations into cache."""
        prisma = Prisma()
        try:
            if not prisma.is_connected():
                await prisma.connect()
            
            configs = await prisma.systemconfig.find_many()
            self._config_cache = {item.key: item.value for item in configs}
            
            # Ensure JWT keys exist after loading config
            await self._ensure_jwt_keys_internal(prisma)
            
        except Exception as e:
            print(f"Failed to load system config: {e}")
        finally:
            if prisma.is_connected():
                await prisma.disconnect()

    async def _ensure_jwt_keys_internal(self, prisma: Prisma):
        """Internal method to generate keys using existing connection."""
        if "PRIVATE_KEY" in self._config_cache and "PUBLIC_KEY" in self._config_cache:
            return

        # Check env vars first
        if config.PRIVATE_KEY and config.PUBLIC_KEY:
            return

        print("Generating new RSA keys for JWT...")
        try:
            # Generate new keys
            key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
            )
            
            private_pem = key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ).decode('utf-8')
            
            public_pem = key.public_key().public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ).decode('utf-8')
            
            # Store PRIVATE_KEY
            await prisma.systemconfig.upsert(
                where={"key": "PRIVATE_KEY"},
                data={
                    "create": {"key": "PRIVATE_KEY", "value": private_pem},
                    "update": {"value": private_pem}
                }
            )
            self._config_cache["PRIVATE_KEY"] = private_pem
            
            # Store PUBLIC_KEY
            await prisma.systemconfig.upsert(
                where={"key": "PUBLIC_KEY"},
                data={
                    "create": {"key": "PUBLIC_KEY", "value": public_pem},
                    "update": {"value": public_pem}
                }
            )
            self._config_cache["PUBLIC_KEY"] = public_pem
            
            print("RSA keys generated and stored in database.")
        except Exception as e:
            print(f"Failed to generate/store RSA keys: {e}")

    def get_value(self, key: str, default: str = "") -> str:
        """Get configuration value from cache synchronously."""
        if key in self._config_cache:
            return self._config_cache[key]
        
        # Fallback to environment variables (via config.py) or default
        # Map internal keys to config.py variable names if needed,
        # but here we assume keys match config.py variable names or we handle mapping elsewhere.
        # Actually, config.py has API_URL, API_KEY etc. mapping might be needed.
        
        mapping = {
            "EMBEDDING_API_URL": "API_URL",
            "EMBEDDING_API_KEY": "API_KEY",
            "EMBEDDING_MODEL_NAME": "MODEL_NAME",
            "EMBEDDING_VECTOR_DIMENSION": "VECTOR_DIMENSION",
        }
        
        # Handle JWT keys from config.py specially to handle newlines
        if key in ["PRIVATE_KEY", "PUBLIC_KEY"]:
            val = getattr(config, key, None)
            if val:
                return val.replace("\\n", "\n")
            return default

        config_key = mapping.get(key, key)
        env_value = getattr(config, config_key, default)
        return str(env_value)

    async def get_config(self, key: str, default: str = "") -> str:
        """Get configuration value, falling back to environment variables or default."""
        # Try cache first
        if key in self._config_cache:
            return self._config_cache[key]
        
        # Try database if not in cache (lazy load)
        prisma = Prisma()
        try:
            if not prisma.is_connected():
                await prisma.connect()
            
            item = await prisma.systemconfig.find_unique(where={"key": key})
            if item:
                self._config_cache[key] = item.value
                return item.value
        except Exception as e:
            print(f"Error fetching config {key}: {e}")
        finally:
            if prisma.is_connected():
                await prisma.disconnect()

        return self.get_value(key, default)

    async def set_config(self, key: str, value: str):
        """Set configuration value."""
        prisma = Prisma()
        try:
            if not prisma.is_connected():
                await prisma.connect()
            
            await prisma.systemconfig.upsert(
                where={"key": key},
                data={
                    "create": {"key": key, "value": value},
                    "update": {"value": value}
                }
            )
            self._config_cache[key] = value
        except Exception as e:
            print(f"Error setting config {key}: {e}")
            raise
        finally:
            if prisma.is_connected():
                await prisma.disconnect()

    async def get_all_configs(self) -> Dict[str, str]:
        """Get all system configurations."""
        # Ensure cache is populated
        if not self._config_cache:
            await self.load_config()
            
        # Merge with defaults from config.py for keys not in DB
        result = self._config_cache.copy()
        
        defaults = {
            "EMBEDDING_API_URL": config.API_URL,
            "EMBEDDING_API_KEY": config.API_KEY,
            "EMBEDDING_MODEL_NAME": config.MODEL_NAME,
            "EMBEDDING_VECTOR_DIMENSION": str(config.VECTOR_DIMENSION),
            "LLM_API_URL": config.LLM_API_URL,
            "LLM_API_KEY": config.LLM_API_KEY,
            "LLM_MODEL_NAME": config.LLM_MODEL_NAME,
            "RAG_SYSTEM_PROMPT": config.RAG_SYSTEM_PROMPT,
            "PRIVATE_KEY": config.PRIVATE_KEY.replace("\\n", "\n") if config.PRIVATE_KEY else "",
            "PUBLIC_KEY": config.PUBLIC_KEY.replace("\\n", "\n") if config.PUBLIC_KEY else "",
            "ENABLE_ACTIVITY_TRACKING": "true",  # Default: Activity tracking is enabled
        }
        
        for key, value in defaults.items():
            if key not in result:
                result[key] = str(value)
                
        return result

    async def get_public_configs(self) -> Dict[str, str]:
        """Get public configurations that can be exposed to frontend."""
        # Ensure cache is populated
        if not self._config_cache:
            await self.load_config()
            
        # Only return non-sensitive configs
        public_keys = ["ENABLE_ACTIVITY_TRACKING"]
        
        result = {}
        for key in public_keys:
            if key in self._config_cache:
                result[key] = self._config_cache[key]
            elif key == "ENABLE_ACTIVITY_TRACKING":
                result[key] = "true"  # Default value
                
        return result

    def is_activity_tracking_enabled(self) -> bool:
        """Check if activity tracking is enabled."""
        value = self._config_cache.get("ENABLE_ACTIVITY_TRACKING", "true")
        return value.lower() == "true"

# Global instance
config_service = ConfigService()