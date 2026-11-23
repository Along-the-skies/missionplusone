export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const fileId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!apiKey) return res.status(503).json({ error: 'Drive is not configured.' });
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) return res.status(400).json({ error: 'Invalid file id.' });

  const folderId = '1Q37NR6FS7buumV18U5kVB9_10embkofm';
  const key = encodeURIComponent(apiKey);
  try {
    const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,parents&key=${key}`);
    const metadata = await metadataResponse.json();
    if (!metadataResponse.ok) return res.status(metadataResponse.status).json({ error: 'Could not read this material.' });
    if (!(metadata.parents || []).includes(folderId)) return res.status(403).json({ error: 'This file is outside the study folder.' });

    const textExtensions = /\.(txt|md|markdown|csv|tsv|json|js|jsx|ts|tsx|py|java|c|h|cc|cpp|hpp|cs|html|css|xml|yaml|yml|sh|sql|log|ini|toml|ipynb)$/i;
    const mimeType = metadata.mimeType || '';
    if (!mimeType.startsWith('text/') && !textExtensions.test(metadata.name || '')) return res.status(415).json({ error: 'This file uses Google Drive preview.' });
    if (Number(metadata.size || 0) > 2_000_000) return res.status(413).json({ error: 'Text preview is limited to files under 2 MB.' });

    const contentResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${key}`);
    if (!contentResponse.ok) return res.status(contentResponse.status).json({ error: 'Could not load the file contents.' });
    const text = await contentResponse.text();
    if (Buffer.byteLength(text, 'utf8') > 2_000_000) return res.status(413).json({ error: 'Text preview is limited to files under 2 MB.' });
    return res.status(200).json({ name: metadata.name, mimeType, text });
  } catch {
    return res.status(502).json({ error: 'Could not reach Google Drive.' });
  }
}

