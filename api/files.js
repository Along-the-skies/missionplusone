const ROOT_FOLDER_ID = '1Q37NR6FS7buumV18U5kVB9_10embkofm';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ID_PATTERN = /^[a-zA-Z0-9_-]{10,200}$/;

async function listChildren(folderId, apiKey, foldersOnly = false) {
  const query = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false${foldersOnly ? ` and mimeType = '${FOLDER_MIME}'` : ''}`,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,thumbnailLink,size)',
    orderBy: 'folder,name',
    pageSize: '1000',
    key: apiKey,
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Google Drive could not return this folder.');
  return data.files || [];
}

async function resolveFolderTrail(trailIds, apiKey) {
  const ids = trailIds.length ? trailIds : [ROOT_FOLDER_ID];
  if (ids.length > 25 || ids[0] !== ROOT_FOLDER_ID || ids.some(id => !ID_PATTERN.test(id))) {
    throw new Error('Invalid folder path.');
  }
  const rootResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${ROOT_FOLDER_ID}?fields=id,name,mimeType&key=${encodeURIComponent(apiKey)}`);
  const root = await rootResponse.json();
  if (!rootResponse.ok || root.mimeType !== FOLDER_MIME) throw new Error('Could not open the study library.');
  const trail = [{ id: root.id, name: root.name }];
  let parentId = ROOT_FOLDER_ID;
  for (const childId of ids.slice(1)) {
    const children = await listChildren(parentId, apiKey, true);
    const child = children.find(item => item.id === childId);
    if (!child) throw new Error('That folder is not inside the study library.');
    trail.push({ id: child.id, name: child.name });
    parentId = child.id;
  }
  return { trail, folderId: parentId };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=240');
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Add GOOGLE_DRIVE_API_KEY in Vercel Project Settings to connect the live folder.' });
  const rawTrail = typeof req.query.trail === 'string' ? req.query.trail : '';
  const trailIds = rawTrail ? rawTrail.split(',') : [ROOT_FOLDER_ID];
  try {
    const { trail, folderId } = await resolveFolderTrail(trailIds, apiKey);
    const files = await listChildren(folderId, apiKey);
    return res.status(200).json({ files, folderId, rootFolderId: ROOT_FOLDER_ID, trail });
  } catch (error) {
    const message = error.message || 'Could not open this folder.';
    return res.status(message.startsWith('Add GOOGLE_') ? 503 : 403).json({ error: message });
  }
}

