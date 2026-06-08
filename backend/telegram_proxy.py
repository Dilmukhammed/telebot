"""
Local reverse proxy for api.telegram.org using curl.exe (Schannel).
Bypasses DPI that blocks Python's OpenSSL TLS handshake but allows Schannel.
"""

import asyncio
import json
import logging
from aiohttp import web

logger = logging.getLogger("telegram_proxy")

PROXY_PORT = 9999
TELEGRAM_API = "https://api.telegram.org"


async def proxy_handler(request: web.Request) -> web.Response:
    """Forward request to api.telegram.org via curl.exe."""
    path = request.path
    url = f"{TELEGRAM_API}{path}"

    # Read request body if present
    body = await request.read()
    if not body:
        body = None

    # Build curl command
    cmd = [
        "curl.exe",
        "-s",
        "--connect-timeout", "10",
        "--max-time", "30",
        "-X", request.method,
    ]

    # Forward content-type and relevant headers
    for hdr in ("Content-Type", "Content-Length"):
        val = request.headers.get(hdr)
        if val:
            cmd.extend(["-H", f"{hdr}: {val}"])

    # Add body via stdin
    if body:
        cmd.extend(["--data-binary", "@-"])

    cmd.append(url)

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE if body else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=body),
            timeout=35,
        )

        if proc.returncode != 0:
            err = stderr.decode(errors="replace")[:200]
            logger.error("curl failed (rc=%d): %s", proc.returncode, err)
            return web.Response(status=502, text=f"curl error: {err}")

        # Try to parse as JSON to set correct content-type
        try:
            data = json.loads(stdout)
            return web.json_response(data)
        except (json.JSONDecodeError, ValueError):
            return web.Response(body=stdout)

    except asyncio.TimeoutError:
        logger.error("curl timeout for %s", url)
        return web.Response(status=504, text="curl timeout")
    except Exception as e:
        logger.error("proxy error: %s", e)
        return web.Response(status=500, text=str(e))


async def start_proxy():
    """Start the proxy server (call from main.py lifespan)."""
    app = web.Application()
    app.router.add_route("*", "/{path:.*}", proxy_handler)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", PROXY_PORT)
    await site.start()
    logger.info("Telegram proxy started on http://127.0.0.1:%d", PROXY_PORT)
    return runner


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app = web.Application()
    app.router.add_route("*", "/{path:.*}", proxy_handler)
    web.run_app(app, host="127.0.0.1", port=PROXY_PORT)
