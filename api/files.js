export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=240');
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Add GOOGLE_DRIVE_API_KEY in Vercel Project Settings to connect the live folder.' });
  const folderId = '1Q37NR6FS7buumV18U5kVB9_10embkofm';
  const query = new URLSearchParams({ q: `'${folderId}' in parents and trashed = false`, fields: 'files(id,name,mimeType,modifiedTime,webViewLink,thumbnailLink)', orderBy: 'folder,name', pageSize: '1000', key: apiKey });
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Google Drive could not return this folder.' });
    return res.status(200).json({ files: data.files || [] });
  } catch {
    return res.status(502).json({ error: 'Could not reach Google Drive. Please try again shortly.' });
  }
}

