from __future__ import annotations

import hmac
import mimetypes
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles

APP_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DROP_DATA_DIR", "/data")).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_MB = int(os.getenv("MAX_FILE_MB", "512"))
MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
USERNAME = os.getenv("DROP_USERNAME", "collector")
PASSWORD = os.getenv("DROP_PASSWORD", "")
if not PASSWORD:
    raise RuntimeError("Set DROP_PASSWORD before starting the file drop server.")

security = HTTPBasic(auto_error=False)
app = FastAPI(title="Study Space File Drop", docs_url=None, redoc_url=None)


def auth(credentials: Annotated[HTTPBasicCredentials | None, Depends(security)]):
    if credentials is None or not (
        hmac.compare_digest(credentials.username, USERNAME)
        and hmac.compare_digest(credentials.password, PASSWORD)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to the study file drop",
            headers={"WWW-Authenticate": 'Basic realm="Study Space"'},
        )
    return credentials.username


def safe_path(value: str | None = "") -> Path:
    raw = (value or "").replace("\\", "/")
    relative = PurePosixPath(raw)
    if relative.is_absolute() or any(part in ("..", "") for part in relative.parts):
        if raw not in ("", "."):
            raise HTTPException(400, "Invalid folder path")
    clean = Path(*(part for part in relative.parts if part not in (".", "")))
    target = (DATA_DIR / clean).resolve()
    if target != DATA_DIR and DATA_DIR not in target.parents:
        raise HTTPException(400, "Invalid path")
    return target


def rel_path(path: Path) -> str:
    return path.relative_to(DATA_DIR).as_posix()


@app.get("/", response_class=HTMLResponse)
def home(_: Annotated[str, Depends(auth)]):
    return (APP_DIR / "static" / "index.html").read_text(encoding="utf-8")


@app.get("/static/{asset}")
def static_asset(asset: str, _: Annotated[str, Depends(auth)]):
    if asset not in {"app.js", "style.css"}:
        raise HTTPException(404, "Not found")
    return FileResponse(APP_DIR / "static" / asset)


@app.get("/api/items")
def items(path: str = Query(default=""), _: str = Depends(auth)):
    folder = safe_path(path)
    if not folder.exists():
        raise HTTPException(404, "Folder not found")
    if not folder.is_dir():
        raise HTTPException(400, "That path is not a folder")
    entries = []
    for child in sorted(folder.iterdir(), key=lambda p: (not p.is_dir(), p.name.casefold())):
        stat = child.stat()
        entries.append({
            "name": child.name,
            "path": rel_path(child),
            "type": "folder" if child.is_dir() else "file",
            "size": stat.st_size if child.is_file() else None,
            "modified": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
        })
    return {"path": rel_path(folder) if folder != DATA_DIR else "", "items": entries}


@app.post("/api/folders")
def create_folder(path: str = Form(...), _: str = Depends(auth)):
    target = safe_path(path)
    if target == DATA_DIR:
        raise HTTPException(400, "Choose a folder name")
    target.mkdir(parents=True, exist_ok=True)
    return {"created": rel_path(target)}


@app.post("/api/upload")
async def upload_files(
    files: Annotated[list[UploadFile], File(...)],
    paths: Annotated[list[str], Form(...)],
    _: str = Depends(auth),
):
    if len(files) != len(paths):
        raise HTTPException(400, "Upload paths did not match the selected files")
    saved = []
    for upload, relative in zip(files, paths):
        normalized = relative.replace("\\", "/").lstrip("/")
        target = safe_path(normalized)
        if target == DATA_DIR:
            target = safe_path(upload.filename or "upload")
        if upload.size is not None and upload.size > MAX_FILE_BYTES:
            raise HTTPException(413, f"{upload.filename or 'File'} exceeds the {MAX_FILE_MB} MB limit")
        target.parent.mkdir(parents=True, exist_ok=True)
        written = 0
        try:
            with target.open("wb") as output:
                while chunk := await upload.read(1024 * 1024):
                    written += len(chunk)
                    if written > MAX_FILE_BYTES:
                        output.close()
                        target.unlink(missing_ok=True)
                        raise HTTPException(413, f"{upload.filename or 'File'} exceeds the {MAX_FILE_MB} MB limit")
                    output.write(chunk)
        finally:
            await upload.close()
        saved.append({"path": rel_path(target), "size": written})
    return {"uploaded": saved}


@app.get("/api/file")
def get_file(path: str = Query(...), _: str = Depends(auth)):
    target = safe_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(404, "File not found")
    guessed, _ = mimetypes.guess_type(target.name)
    extension = target.suffix.lower()
    safe_inline = guessed and (guessed.startswith(("image/", "audio/", "video/", "text/")) or guessed == "application/pdf")
    if extension in {".html", ".htm", ".svg", ".xml", ".xhtml"}:
        safe_inline = False
    media_type = guessed or "application/octet-stream"
    if safe_inline and media_type.startswith("text/"):
        media_type = "text/plain; charset=utf-8"
    return FileResponse(
        target,
        media_type=media_type,
        filename=target.name,
        content_disposition_type="inline" if safe_inline else "attachment",
        headers={"X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox"},
    )


@app.delete("/api/item")
def delete_item(path: str = Query(...), _: str = Depends(auth)):
    target = safe_path(path)
    if target == DATA_DIR or not target.exists():
        raise HTTPException(404, "Item not found")
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
    return JSONResponse({"deleted": path})


@app.get("/health")
def health():
    return {"ok": True}

