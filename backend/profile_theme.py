"""Profile card customization — tier 1 themes."""

from typing import Any, Optional

ALLOWED_CARD_THEMES = frozenset({"default", "lavender", "mint", "dusk", "slate", "rose", "ocean"})

DEFAULT_PROFILE_THEME: dict[str, Any] = {
    "card_theme": "default",
    "status_emoji": None,
    "status_text": None,
}


def normalize_profile_theme(raw: Any) -> dict[str, Any]:
    if not raw or not isinstance(raw, dict):
        return dict(DEFAULT_PROFILE_THEME)

    card_theme = raw.get("card_theme") or "default"
    if card_theme not in ALLOWED_CARD_THEMES:
        card_theme = "default"

    status_emoji = raw.get("status_emoji")
    if status_emoji is not None:
        status_emoji = str(status_emoji).strip()[:8] or None

    status_text = raw.get("status_text")
    if status_text is not None:
        status_text = str(status_text).strip()[:60] or None

    return {
        "card_theme": card_theme,
        "status_emoji": status_emoji,
        "status_text": status_text,
    }


def merge_profile_theme(current: Any, patch: dict[str, Any]) -> dict[str, Any]:
    base = normalize_profile_theme(current)
    if "card_theme" in patch and patch["card_theme"] is not None:
        base["card_theme"] = patch["card_theme"]
    if "status_emoji" in patch:
        base["status_emoji"] = patch["status_emoji"]
    if "status_text" in patch:
        base["status_text"] = patch["status_text"]
    return normalize_profile_theme(base)
