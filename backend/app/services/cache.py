import time
import json
import logging
import os

logger = logging.getLogger(__name__)

# In-memory store fallback
_in_memory_cache = {}
_use_redis = False
_redis_client = None

try:
    import redis
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    _redis_client = redis.from_url(redis_url, socket_timeout=1.0)
    # Ping to check if Redis is alive
    _redis_client.ping()
    _use_redis = True
    logger.info("Connected to Redis successfully.")
except Exception as e:
    _use_redis = False
    _redis_client = None
    logger.warning(f"Redis is unavailable, falling back to in-memory caching. Error: {e}")

class CacheService:
    @staticmethod
    def get(key: str):
        if _use_redis and _redis_client:
            try:
                val = _redis_client.get(key)
                if val:
                    return json.loads(val.decode('utf-8'))
            except Exception as e:
                logger.error(f"Redis get error: {e}")
        
        # Fallback to in-memory cache
        if key in _in_memory_cache:
            entry = _in_memory_cache[key]
            if entry["expire_at"] is None or entry["expire_at"] > time.time():
                return entry["value"]
            else:
                try:
                    del _in_memory_cache[key] # Expired
                except KeyError:
                    pass
        return None

    @staticmethod
    def set(key: str, value: any, expire_seconds: int = 300):
        if _use_redis and _redis_client:
            try:
                _redis_client.setex(key, expire_seconds, json.dumps(value))
                return
            except Exception as e:
                logger.error(f"Redis set error: {e}")
        
        # Fallback to in-memory cache
        expire_at = time.time() + expire_seconds if expire_seconds else None
        _in_memory_cache[key] = {
            "value": value,
            "expire_at": expire_at
        }

    @staticmethod
    def delete(key: str):
        if _use_redis and _redis_client:
            try:
                _redis_client.delete(key)
            except Exception as e:
                logger.error(f"Redis delete error: {e}")
        
        if key in _in_memory_cache:
            try:
                del _in_memory_cache[key]
            except KeyError:
                pass

    @staticmethod
    def clear_pattern(pattern: str):
        """
        Clears all keys matching a certain prefix/pattern.
        """
        if _use_redis and _redis_client:
            try:
                cursor = 0
                while True:
                    cursor, keys = _redis_client.scan(cursor=cursor, match=pattern, count=100)
                    if keys:
                        _redis_client.delete(*keys)
                    if cursor == 0:
                        break
            except Exception as e:
                logger.error(f"Redis clear pattern error: {e}")
                
        # In-memory clear
        prefix = pattern.replace("*", "")
        keys_to_del = [k for k in _in_memory_cache.keys() if k.startswith(prefix)]
        for k in keys_to_del:
            try:
                del _in_memory_cache[k]
            except KeyError:
                pass
