# Study Space

A Vercel-ready live study library for Vasudev, with resources collected by Dev L Kakkoth. It browses Google Drive folders inside the site and opens selected resources in an on-page preview. New Drive changes appear automatically after refresh.

## Deploy to Vercel

Import this repository as a Vercel project using the repository root. The `/api` folder contains the Vercel serverless functions; the site has no build step.

## Connect Google Drive

1. Enable the Google Drive API in Google Cloud Console and create an API key.
2. Restrict the key to the Google Drive API. Since the key is used by a serverless function, do not use website referrer restrictions.
3. In Vercel Project Settings → Environment Variables, add `GOOGLE_DRIVE_API_KEY` and select the deployment environments you use.
4. Redeploy. The folder and its materials must be viewable to site visitors.

The root folder and nested folders are browsed through internal site navigation. PDFs and other Drive-previewable files open in the on-page viewer; text and source files under 2 MB use the site's text viewer. Some file types may not support an embedded preview.

