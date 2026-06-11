"""Shared time helpers for Tashkent (UTC+5) timezone."""

from datetime import datetime, timedelta, timezone

TASHKENT_TZ = timezone(timedelta(hours=5))


def _get_tashkent_now() -> datetime:
    """Return current datetime in Asia/Tashkent as a *naive* datetime."""
    return datetime.now(TASHKENT_TZ).replace(tzinfo=None)


def _to_tashkent_iso(utc_dt: datetime) -> str:
    """Convert a naive-UTC datetime to an ISO string with +05:00 offset."""
    return (utc_dt + timedelta(hours=5)).isoformat() + "+05:00"


def _calculate_end_time(start_time: str, duration_minutes: int = 90) -> str:
    """Calculate end time from *HH:MM* start time and duration in minutes."""
    try:
        parts = start_time.strip().split(":")
        h, m = int(parts[0]), int(parts[1])
        total = h * 60 + m + duration_minutes
        return f"{total // 60:02d}:{total % 60:02d}"
    except Exception:
        return ""
