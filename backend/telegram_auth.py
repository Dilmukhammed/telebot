import hmac
import hashlib
import time
import logging
from json import loads
from urllib.parse import unquote, unquote_plus

from config import settings

logger = logging.getLogger("telegram_auth")

# Maximum age of initData in seconds (1 hour, per Telegram recommendation)
AUTH_DATE_MAX_AGE = 3600


def parse_init_data(init_data: str) -> dict:
    """Parse initData string into key-value dict, handling URL encoding."""
    # The whole string might be URL-encoded (e.g. by browser/proxy)
    decoded = unquote_plus(init_data)

    # If decoding changed nothing, try splitting the original
    candidates = [decoded, init_data]

    for data in candidates:
        pairs = [kv for kv in data.split("&") if kv.strip()]
        if not pairs:
            continue

        result = {}
        for pair in pairs:
            if "=" not in pair:
                continue
            key, value = pair.split("=", 1)
            result[key] = value

        if result:
            return result

    return {}


def validate_init_data(init_data: str) -> dict:
    """
    Validate Telegram initData string.

    Returns dict with user data or raises ValueError.

    initData format: key=value&key2=value2&...
    """
    logger.debug("validate_init_data called, raw_length=%d", len(init_data))

    # Parse the init_data string
    vals = parse_init_data(init_data)
    logger.debug("Parsed keys: %s", list(vals.keys()))

    if not vals:
        raise ValueError("Empty or unparseable initData")

    # Extract hash parameter
    received_hash = vals.pop("hash", None)
    if not received_hash:
        logger.error("No 'hash' key found. Available keys: %s", list(vals.keys()))
        raise ValueError("No hash in initData")

    # Sort keys alphabetically and create data_check_string (use unquoted values)
    data_check = "\n".join(f"{k}={unquote(vals[k])}" for k in sorted(vals.keys()))

    # Generate secret_key = HMAC-SHA256("WebAppData", bot_token)
    secret = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()

    # Generate hash = HMAC-SHA256(data_check_string, secret_key)
    computed_hash = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()

    # Timing-safe comparison to prevent timing attacks
    if not hmac.compare_digest(computed_hash, received_hash):
        raise ValueError("Invalid hash")

    # Check auth_date is not older than AUTH_DATE_MAX_AGE seconds
    auth_date = int(vals.get("auth_date", 0))
    if time.time() - auth_date > AUTH_DATE_MAX_AGE:
        raise ValueError(f"Data expired (>{AUTH_DATE_MAX_AGE}s)")

    # Parse user JSON from dict
    user = loads(unquote(vals.get("user", "{}")))
    if not isinstance(user, dict):
        raise ValueError("Invalid user data structure")
    return {
        "telegram_id": user.get("id"),
        "username": user.get("username"),
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "language_code": user.get("language_code", "ru"),
        "is_premium": user.get("is_premium", False),
        "photo_url": user.get("photo_url"),
    }