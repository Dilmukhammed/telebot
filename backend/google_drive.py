"""Google Drive integration for file uploads."""

import asyncio
import io
import json
import logging
from typing import Optional

from google.oauth2 import service_account, credentials as oauth2_credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from config import settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive.file"]

# Cached drive service (created once, reused)
_drive_service = None


def _get_drive_service():
    """Build Google Drive API service. Supports OAuth2 (personal Drive) or Service Account.

    Returns a cached singleton to avoid repeated HTTP discovery + credential refresh.
    """
    global _drive_service
    if _drive_service is not None:
        return _drive_service

    # Priority 1: OAuth2 with refresh token (works with personal Google accounts)
    if settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_REFRESH_TOKEN:
        creds = oauth2_credentials.Credentials(
            token=None,
            refresh_token=settings.GOOGLE_OAUTH_REFRESH_TOKEN,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_OAUTH_CLIENT_ID,
            client_secret=settings.GOOGLE_OAUTH_CLIENT_SECRET,
            scopes=SCOPES,
        )
        _drive_service = build("drive", "v3", credentials=creds)
        return _drive_service

    # Priority 2: Service account JSON in env var (Railway)
    if settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        info = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
        _drive_service = build("drive", "v3", credentials=creds)
        return _drive_service

    # Priority 3: Service account JSON file (local dev)
    if settings.GOOGLE_SERVICE_ACCOUNT_KEY_PATH:
        creds = service_account.Credentials.from_service_account_file(
            settings.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, scopes=SCOPES,
        )
        _drive_service = build("drive", "v3", credentials=creds)
        return _drive_service

    raise RuntimeError(
        "Set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_REFRESH_TOKEN, "
        "or GOOGLE_SERVICE_ACCOUNT_JSON, or GOOGLE_SERVICE_ACCOUNT_KEY_PATH"
    )


def _upload_file_sync(
    file_bytes: bytes,
    file_name: str,
    mime_type: str,
) -> tuple[str, str]:
    """Synchronous upload — called via asyncio.to_thread()."""
    service = _get_drive_service()

    file_metadata = {
        "name": file_name,
        "parents": [settings.GOOGLE_DRIVE_FOLDER_ID],
    }
    media = MediaIoBaseUpload(
        io.BytesIO(file_bytes),
        mimetype=mime_type,
        resumable=True,
    )

    created = (
        service.files()
        .create(body=file_metadata, media_body=media, fields="id, webViewLink")
        .execute()
    )

    file_id = created["id"]
    web_view_link = created.get("webViewLink", "")

    # Make file publicly readable via link
    service.permissions().create(
        fileId=file_id,
        body={"role": "reader", "type": "anyone"},
    ).execute()

    # Get the direct download link
    file_info = service.files().get(fileId=file_id, fields="webContentLink").execute()
    download_link = file_info.get("webContentLink", web_view_link)

    logger.info("Uploaded file to Google Drive: %s (%s)", file_name, file_id)
    return file_id, download_link


async def upload_file(
    file_bytes: bytes,
    file_name: str,
    mime_type: str = "application/octet-stream",
) -> tuple[str, str]:
    """Upload a file to Google Drive and make it publicly accessible.

    Runs synchronous Google API calls in a thread pool to avoid blocking
    the FastAPI event loop.

    Returns:
        (google_file_id, web_view_link)
    """
    return await asyncio.to_thread(_upload_file_sync, file_bytes, file_name, mime_type)


def _delete_file_sync(google_file_id: str) -> bool:
    """Synchronous delete — called via asyncio.to_thread()."""
    service = _get_drive_service()
    service.files().delete(fileId=google_file_id).execute()
    logger.info("Deleted file from Google Drive: %s", google_file_id)
    return True


async def delete_file(google_file_id: str) -> bool:
    """Delete a file from Google Drive.

    Runs synchronous Google API calls in a thread pool to avoid blocking
    the FastAPI event loop.
    """
    try:
        return await asyncio.to_thread(_delete_file_sync, google_file_id)
    except Exception as exc:
        logger.error("Failed to delete file from Google Drive: %s", exc)
        return False
