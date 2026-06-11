"""
Server-side in-memory TTL cache.
Uses cachetools for thread-safe TTL caches.
"""
from __future__ import annotations
import threading
from typing import Any, Optional
from cachetools import TTLCache

# Lock for thread safety
_lock = threading.Lock()

# User cache: telegram_id -> User object (dict representation)
# 500 users, 120 second TTL
user_cache: TTLCache = TTLCache(maxsize=500, ttl=120)

# Course list cache: 'courses_list' -> serialized list
# 60 second TTL
course_list_cache: TTLCache = TTLCache(maxsize=10, ttl=60)

# Test list cache: 'tests_list' -> serialized list
# 60 second TTL
test_list_cache: TTLCache = TTLCache(maxsize=10, ttl=60)

# Admin stats cache: 'admin_stats' -> serialized dict
# 30 second TTL
admin_stats_cache: TTLCache = TTLCache(maxsize=5, ttl=30)


def cache_get(cache: TTLCache, key: str) -> Optional[Any]:
    """Thread-safe cache get."""
    with _lock:
        return cache.get(key)


def cache_set(cache: TTLCache, key: str, value: Any) -> None:
    """Thread-safe cache set."""
    with _lock:
        cache[key] = value


def cache_delete(cache: TTLCache, key: str) -> None:
    """Thread-safe cache delete."""
    with _lock:
        cache.pop(key, None)


def invalidate_user(telegram_id: int) -> None:
    """Invalidate cached user data."""
    cache_delete(user_cache, f"user:{telegram_id}")


def invalidate_courses() -> None:
    """Invalidate all course list cache entries."""
    with _lock:
        keys_to_delete = [k for k in course_list_cache if k.startswith("courses_list")]
        for k in keys_to_delete:
            del course_list_cache[k]


def invalidate_tests() -> None:
    """Invalidate all test list cache entries."""
    with _lock:
        keys_to_delete = [k for k in test_list_cache if k.startswith("tests_list")]
        for k in keys_to_delete:
            del test_list_cache[k]


def invalidate_admin_stats() -> None:
    """Invalidate admin stats cache."""
    cache_delete(admin_stats_cache, "admin_stats")
