"""One-time script to get Google OAuth2 refresh token.

Run this locally:
    python get_refresh_token.py

It will open your browser for Google authorization.
After you grant access, it prints the REFRESH_TOKEN to paste into Railway.
"""

import json
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from google_auth_oauthlib.flow import Flow

CLIENT_SECRETS_FILE = "oauth_client.json"
SCOPES = ["https://www.googleapis.com/auth/drive.file"]
REDIRECT_PORT = 3000
REDIRECT_URI = f"http://localhost:{REDIRECT_PORT}/oauth/google/callback"


class CallbackHandler(BaseHTTPRequestHandler):
    """Handles the OAuth2 callback."""
    code = None

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        if "code" in params:
            CallbackHandler.code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h1>Authorization successful! You can close this tab.</h1>")
        else:
            self.send_response(400)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            error = params.get("error", ["unknown"])[0]
            self.wfile.write(f"<h1>Error: {error}</h1>".encode())

    def log_message(self, format, *args):
        pass  # Suppress logs


def main():
    with open(CLIENT_SECRETS_FILE) as f:
        client_config = json.load(f)

    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    print(f"\nOpening browser for authorization...")
    print(f"If it doesn't open, go to:\n{auth_url}\n")
    webbrowser.open(auth_url)

    server = HTTPServer(("localhost", REDIRECT_PORT), CallbackHandler)
    print(f"Waiting for authorization on localhost:{REDIRECT_PORT}...")

    while CallbackHandler.code is None:
        server.handle_request()

    server.server_close()

    flow.fetch_token(code=CallbackHandler.code)
    creds = flow.credentials

    print("\n" + "=" * 60)
    print("SUCCESS! Add these to Railway environment variables:")
    print("=" * 60)
    print(f"\nGOOGLE_OAUTH_CLIENT_ID={creds.client_id}")
    print(f"GOOGLE_OAUTH_CLIENT_SECRET={creds.client_secret}")
    print(f"GOOGLE_OAUTH_REFRESH_TOKEN={creds.refresh_token}")
    print(f"\nGOOGLE_DRIVE_FOLDER_ID=<your_folder_id>")
    print("=" * 60)


if __name__ == "__main__":
    main()
