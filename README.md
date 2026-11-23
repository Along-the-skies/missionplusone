# Study Space File Drop (FastAPI)

A password-protected, Drive-like file drop for Vasudev and the resource collector. It supports drag-and-drop uploads, recursive folder uploads, folder creation, browsing, deletion, downloads, and in-browser previews for common browser-readable formats. Files live on the server's persistent disk.

## Recommended deployment: VPS with Docker

1. Point a domain or subdomain (for example `files.example.com`) to your VPS. Allow inbound TCP ports 80 and 443.
2. Install Docker Engine and Docker Compose on the VPS, then clone this branch:
   `git clone --branch fastapi-file-drop https://github.com/Along-the-skies/missionplusone.git`
3. Copy `.env.example` to `.env`. Set `DOMAIN` to your real domain, set `DROP_USERNAME`, and replace `DROP_PASSWORD` with a long random secret. Give the login details only to the resource collector.
4. Start the app: `docker compose up -d --build`
5. Open `https://your-domain`. Caddy obtains and renews HTTPS automatically. Uploaded files persist in `./data` across container restarts; back up that folder.

For a single-user/private VPS, restrict port 8000 from the public internet (Compose does not publish it; Caddy is the public entry point). Keep `.env` private and do not commit it.

## Storage and safety

All pages and file endpoints use HTTP Basic Authentication. Uploaded paths are normalized and constrained to the data directory. Each file is limited by `MAX_FILE_MB` (default 512). HTML, SVG, and XML files are offered as downloads instead of rendered inline. The app is intended for a trusted collector; use a unique password and keep the server patched.

## Vercel

The app can be adapted to Vercel's Python functions, but this deployment writes to local disk. Vercel's function filesystem is temporary, so uploaded files are not a reliable persistent library there. For Vercel, replace local storage with durable object storage (such as S3-compatible storage) before using it for uploads. This branch ships the durable VPS + volume setup.

## Local run without Docker

Install Python 3.12+, then run `pip install -r requirements.txt`. Set `DROP_PASSWORD`, `DROP_USERNAME`, and optionally `DROP_DATA_DIR` (defaults to `/data`) in your shell. Run `uvicorn app:app --host 0.0.0.0 --port 8000`.

