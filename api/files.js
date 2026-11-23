const ROOT_FOLDER_ID = '1Q37NR6FS7buumV18U5kVB9_10embkofm';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ID_PATTERN = /^[a-zA-Z0-9_-]{10,200}$/;

async function driveGet(path, apiKey) {
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  url.searchParams.set('key', apiKey);
  const response = await fetch(url);
  const data = await response.json();
  return { response, data };
}

async function folderTrail(folderId, apiKey) {
  if (!ID_PATTERN.test(folderId)) throw new Error('Invalid folder id.');
  const trail = [];
  let currentId = folderId;
  const visited = new Set();
  for (let depth = 0; depth < 25; depth++) {
    if (visited.has(currentId)) throw new Error('Invalid folder hierarchy.');
    visited.add(currentId);
    const { response, data } = await driveGet(`files/${encodeURIComponent(currentId)}?fields=id,name,mimeType,parents`, apiKey);
    if (!response.ok) throw new Error(data.error?.message || 'Could not read this folder.');
    if (data.mimeType !== FOLDER_MIME) throw new Error('That item is not a folder.');
    trail.unshift({ id: data.id, name: data.name });
    if (currentId === ROOT_FOLDER_ID) return trail;
    const parentId = (data.parents || [])[0];
    if (!parentId) throw new Error('That folder is outside the study library.');
    currentId = parentId;
  }
  throw new Error('Folder nesting is too deep.');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=240');
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Add GOOGLE_DRIVE_API_KEY in Vercel Project Settings to connect the live folder.' });
  const folderId = typeof req.query.folderId === 'string' && req.query.folderId ? req.query.folderId : ROOT_FOLDER_ID;
  try {
    const trail = await folderTrail(folderId, apiKey);
    const query = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,thumbnailLink,size)',
      orderBy: 'folder,name',
      pageSize: '1000',
      key: apiKey,
    });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Google Drive could not return this folder.' });
    return res.status(200).json({ files: data.files || [], folderId, rootFolderId: ROOT_FOLDER_ID, trail });
  } catch (error) {
    return res.status(403).json({ error: error.message || 'Could not open this folder.' });
  }
}

