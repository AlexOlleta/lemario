import os
import re
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

STATIC_DIR = Path(__file__).parent / "static"
ALLOWED_PATHS = re.compile(
    r"words/(by-letter/[^/]+|by-length/\d+|search|pattern|rhymes|random|exists|exists/[^/]+)"
    r"|definitions/[^/]+"
)
MAX_QUERY_LENGTH = 2000
SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; img-src 'self' data:; object-src 'none'; "
        "base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
}


@dataclass(frozen=True)
class Settings:
    api_url: str = "http://127.0.0.1:8000"
    api_key: str = ""
    timeout: float = 10.0

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            api_url=os.getenv("LEMARIO_API_URL", cls.api_url).rstrip("/"),
            api_key=os.getenv("LEMARIO_API_KEY", ""),
            timeout=float(os.getenv("LEMARIO_TIMEOUT", cls.timeout)),
        )


def error(code: str, status: int) -> JSONResponse:
    return JSONResponse({"error": code}, status_code=status)


def create_app(
    settings: Settings | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        headers = {"X-API-Key": settings.api_key} if settings.api_key else {}
        async with httpx.AsyncClient(
            base_url=settings.api_url,
            headers=headers,
            timeout=settings.timeout,
            transport=transport,
        ) as client:
            app.state.client = client
            yield

    app = FastAPI(
        lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None
    )

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        return response

    @app.get("/api/status")
    async def status(request: Request):
        client: httpx.AsyncClient = request.app.state.client
        try:
            health = await client.get("/health")
            if health.status_code != 200:
                return {"state": "down"}
            if not health.json().get("index_ready", False):
                return {"state": "not_ready"}
            if not settings.api_key:
                return {"state": "bad_key"}
            probe = await client.get("/words/exists/a")
        except (httpx.HTTPError, ValueError):
            return {"state": "down"}
        return {"state": "bad_key" if probe.status_code == 401 else "ok"}

    @app.get("/api/{path:path}")
    async def proxy(path: str, request: Request):
        if not ALLOWED_PATHS.fullmatch(path):
            return error("not_found", 404)
        if len(request.url.query) > MAX_QUERY_LENGTH:
            return error("query_too_long", 414)

        client: httpx.AsyncClient = request.app.state.client
        try:
            upstream = await client.get(
                "/" + quote(path, safe="/"),
                params=request.query_params.multi_items(),
            )
        except httpx.HTTPError:
            return error("api_down", 503)
        if upstream.status_code == 401:
            return error("bad_key", 502)
        return Response(
            upstream.content,
            status_code=upstream.status_code,
            media_type=upstream.headers.get("content-type", "application/json"),
        )

    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
    return app


app = create_app()
