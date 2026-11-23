# Study Space

A Vercel-ready live study library for Vasudev. It lists files from the shared Drive folder and opens supported materials in an on-page preview. The list refreshes every five minutes.

## Deploy to Vercel

Import this repository as a static site. Vercel serves `index.html`, `styles.css`, and `app.js`; the `/api/files` serverless function supplies the live folder listing.

## Connect Google Drive

1. In Google Cloud Console, enable the Google Drive API for a project and create an API key.
2. Restrict the key to the Google Drive API. If you configure website referrer restrictions, allow your Vercel domain; the key is only used by the serverless function.
3. In Vercel, open **Project Settings → Environment Variables** and add `GOOGLE_DRIVE_API_KEY` with the key as its value.
4. Redeploy. The folder must be shared so the Drive API key can read its file metadata (for a public folder, use an API key; private folders require OAuth instead).

The site's preview uses Google's Drive preview frame, displayed inside a modal on the website. Google may require visitors to have access to the source file. The “Open source” link is available in the preview if a file type cannot be embedded.
# Text and source files under 2 MB are rendered as readable text in the modal; other file types use Google's embedded Drive preview. Some formats may have no browser preview.

