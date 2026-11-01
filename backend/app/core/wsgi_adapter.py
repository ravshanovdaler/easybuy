import asyncio
from io import BytesIO
from typing import Callable, List, Tuple
from urllib.parse import unquote

def make_sync_wsgi_app(asgi_app):
    """
    Pure synchronous WSGI-to-ASGI adapter.
    Runs entirely in the current thread (no threading.Thread).
    Works 100% reliably in single-threaded uWSGI environments like PythonAnywhere.
    """
    def wsgi_handler(environ, start_response):
        # 1. Read input body
        content_length = int(environ.get("CONTENT_LENGTH") or 0)
        body = environ.get("wsgi.input", BytesIO()).read(content_length) if content_length > 0 else b""

        # 2. Extract headers
        headers: List[Tuple[bytes, bytes]] = []
        for k, v in environ.items():
            if k == "CONTENT_TYPE":
                headers.append((b"content-type", v.encode("latin1")))
            elif k == "CONTENT_LENGTH":
                headers.append((b"content-length", v.encode("latin1")))
            elif k.startswith("HTTP_"):
                header_name = k[5:].replace("_", "-").lower().encode("latin1")
                headers.append((header_name, v.encode("latin1")))

        # 3. Build ASGI HTTP scope
        path_info = environ.get("PATH_INFO", "/")
        query_string = environ.get("QUERY_STRING", "").encode("ascii")
        server = (environ.get("SERVER_NAME", "localhost"), int(environ.get("SERVER_PORT", 80)))
        client = (environ.get("REMOTE_ADDR", ""), int(environ.get("REMOTE_PORT", 0) or 0))

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": environ.get("REQUEST_METHOD", "GET"),
            "scheme": environ.get("wsgi.url_scheme", "http"),
            "path": unquote(path_info),
            "raw_path": path_info.encode("ascii"),
            "query_string": query_string,
            "root_path": environ.get("SCRIPT_NAME", ""),
            "headers": headers,
            "server": server,
            "client": client,
        }

        # 4. State for response
        response_status = [200]
        response_headers = []
        response_body = []
        body_sent = False

        async def receive():
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.disconnect"}

        async def send(message):
            m_type = message.get("type")
            if m_type == "http.response.start":
                response_status[0] = message["status"]
                for k, v in message.get("headers", []):
                    response_headers.append((k.decode("latin1"), v.decode("latin1")))
            elif m_type == "http.response.body":
                response_body.append(message.get("body", b""))

        # 5. Run ASGI application in the current thread's event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(asgi_app(scope, receive, send))
        finally:
            loop.close()

        # 6. Return WSGI response
        from http.client import responses
        status_msg = f"{response_status[0]} {responses.get(response_status[0], 'OK')}"

        # Guarantee CORS headers for netlify, telegram, and localhost
        origin = environ.get("HTTP_ORIGIN", "")
        if origin and not any(k.lower() == "access-control-allow-origin" for k, _ in response_headers):
            if "netlify.app" in origin or "telegram.org" in origin or "localhost" in origin:
                response_headers.append(("Access-Control-Allow-Origin", origin))
                response_headers.append(("Access-Control-Allow-Credentials", "true"))
                response_headers.append(("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS"))
                response_headers.append(("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With"))

        start_response(status_msg, response_headers)
        return response_body

    return wsgi_handler
