const ROOT_FOLDER_ID = '1Q37NR6FS7buumV18U5kVB9_10embkofm';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ID_PATTERN = /^[a-zA-Z0-9_-]{10,200}$/;

async function listChildren(folderId, apiKey, foldersOnly = false, pageToken = '') {
  const query = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false${foldersOnly ? ` and mimeType = '${FOLDER_MIME}'` : ''}`,
    fields: 'nextPageToken,files(id,name,mimeType)',
    pageSize: '1000',
    key: apiKey,
  });
  if (pageToken) query.set('pageToken', pageToken);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`);
  const data = await response.json();
  if (!response.ok) throw new Error('Could not verify this study folder.');
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const fileId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!apiKey) return res.status(503).json({ error: 'Drive is not configured.' });
  if (!ID_PATTERN.test(fileId)) return res.status(400).json({ error: 'Invalid file id.' });

  const trailIds = typeof req.query.trail === 'string' ? req.query.trail.split(',') : [ROOT_FOLDER_ID];
  if (!trailIds.length || trailIds[0] !== ROOT_FOLDER_ID || trailIds.length > 25 || trailIds.some(id => !ID_PATTERN.test(id))) {
    return res.status(400).json({ error: 'Invalid folder path.' });
  }
  const key = encodeURIComponent(apiKey);
  try {
    let folderId = ROOT_FOLDER_ID;
    for (const childId of trailIds.slice(1)) {
      const data = await listChildren(folderId, apiKey, true);
      const child = (data.files || []).find(item => item.id === childId);
      if (!child) return res.status(403).json({ error: 'This folder is outside the study library.' });
      folderId = childId;
    }

    let pageToken = '';
    let fileIsInFolder = false;
    do {
      const data = await listChildren(folderId, apiKey, false, pageToken);
      if ((data.files || []).some(item => item.id === fileId)) fileIsInFolder = true;
      pageToken = data.nextPageToken || '';
    } while (pageToken && !fileIsInFolder);
    if (!fileIsInFolder) return res.status(403).json({ error: 'This file is outside the open folder.' });

    const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size&key=${key}`);
    const metadata = await metadataResponse.json();
    if (!metadataResponse.ok) return res.status(metadataResponse.status).json({ error: 'Could not read this material.' });
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

