"""Google Drive integration for file uploads."""

import io
import json
import logging
from typing import Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from config import settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def _get_drive_service():
    """Build Google Drive API service from service account credentials."""
    if settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        # Railway / production: JSON string in env var
        info = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    elif settings.GOOGLE_SERVICE_ACCOUNT_KEY_PATH:
        # Local dev: JSON file on disk
        creds = service_account.Credentials.from_service_account_file(
            settings.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, scopes=SCOPES,
        )
    else:
        raise RuntimeError("Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_PATH")

    return build("drive", "v3", credentials=creds)


async def upload_file(
    file_bytes: bytes,
    file_name: str,
    mime_type: str = "application/octet-stream",
) -> tuple[str, str]:
    """Upload a file to Google Drive and make it publicly accessible.

    Returns:
        (google_file_id, web_view_link)
    """
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


async def delete_file(google_file_id: str) -> bool:
    """Delete a file from Google Drive."""
    try:
        service = _get_drive_service()
        service.files().delete(fileId=google_file_id).execute()
        logger.info("Deleted file from Google Drive: %s", google_file_id)
        return True
    except Exception as exc:
        logger.error("Failed to delete file from Google Drive: %s", exc)
        return False
