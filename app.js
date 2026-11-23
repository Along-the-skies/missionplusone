const list = document.querySelector('#file-list');
const status = document.querySelector('#status');
const syncLabel = document.querySelector('#sync-label');
const search = document.querySelector('#search');
const dialog = document.querySelector('#preview');
const frame = document.querySelector('#preview-frame');
const textPreview = document.querySelector('#text-preview');
const breadcrumbs = document.querySelector('#breadcrumbs');
let files = [];
let currentFolderId = new URLSearchParams(window.location.search).get('folder') || null;
let rootFolderId = null;
let folderTrail = [];
let previewRequest = 0;

function iconFor(file) {
  const type = file.mimeType || '';
  if (type.includes('folder')) return ['DIR', 'folder'];
  if (type.includes('pdf')) return ['PDF', 'pdf'];
  if (type.includes('presentation')) return ['SL', 'slides'];
  if (type.includes('spreadsheet')) return ['SH', 'sheets'];
  if (type.includes('document')) return ['DOC', 'docs'];
  if (type.includes('image')) return ['IMG', 'image'];
  return ['FILE', 'other'];
}
function renderBreadcrumbs() {
  breadcrumbs.replaceChildren();
  const home = document.createElement('button');
  home.type = 'button';
  home.textContent = 'All materials';
  home.addEventListener('click', () => navigateTo(rootFolderId));
  breadcrumbs.append(home);
  for (const folder of folderTrail.slice(1)) {
    const divider = document.createElement('span');
    divider.textContent = '/';
    breadcrumbs.append(divider);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = folder.name;
    button.addEventListener('click', () => navigateTo(folder.id));
    breadcrumbs.append(button);
  }
}
function navigateTo(folderId) {
  currentFolderId = folderId === rootFolderId ? null : folderId;
  const nextUrl = currentFolderId ? `?folder=${encodeURIComponent(currentFolderId)}` : window.location.pathname;
  window.history.pushState({}, '', nextUrl);
  search.value = '';
  loadFiles();
}
function render() {
  const term = search.value.trim().toLowerCase();
  const shown = files.filter(f => f.name.toLowerCase().includes(term));
  list.replaceChildren();
  if (!shown.length) {
    status.hidden = false;
    status.textContent = files.length ? 'No materials match that search.' : 'This folder is empty.';
    return;
  }
  status.hidden = true;
  for (const file of shown) {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    const [label, kind] = iconFor(file);
    const button = document.createElement('button');
    button.className = `file-card${isFolder ? ' folder-card' : ''}`;
    button.type = 'button';
    button.innerHTML = `<span class="file-icon ${kind}">${label}</span><span class="file-info"><strong></strong><small></small></span><span class="file-action">${isFolder ? 'Open folder' : 'Preview'} <b>↗</b></span>`;
    button.querySelector('strong').textContent = file.name;
    const detail = isFolder ? 'Folder' : `${label === 'FILE' ? 'File' : label} · ${file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}) : 'Study material'}`;
    button.querySelector('small').textContent = detail;
    button.addEventListener('click', () => isFolder ? navigateTo(file.id) : openPreview(file));
    list.append(button);
  }
}
function openPreview(file) {
  const requestId = ++previewRequest;
  document.querySelector('#preview-title').textContent = file.name;
  document.querySelector('#open-drive').href = file.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`;
  textPreview.hidden = true;
  textPreview.textContent = '';
  frame.hidden = false;
  frame.src = `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/preview`;
  dialog.showModal();
  fetch(`/api/file?id=${encodeURIComponent(file.id)}`, { cache: 'no-store' })
    .then(async response => response.ok ? response.json() : null)
    .then(data => {
      if (!data || requestId !== previewRequest || !dialog.open) return;
      textPreview.textContent = data.text;
      textPreview.hidden = false;
      frame.hidden = true;
    })
    .catch(() => {});
}
document.querySelector('#close-preview').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { previewRequest++; frame.src = 'about:blank'; textPreview.textContent = ''; });
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
search.addEventListener('input', render);
window.addEventListener('popstate', () => {
  currentFolderId = new URLSearchParams(window.location.search).get('folder') || null;
  search.value = '';
  loadFiles();
});
async function loadFiles() {
  try {
    const endpoint = new URL('/api/files', window.location.origin);
    if (currentFolderId) endpoint.searchParams.set('folderId', currentFolderId);
    const response = await fetch(endpoint, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load the folder.');
    files = data.files || [];
    currentFolderId = data.folderId;
    rootFolderId = data.rootFolderId;
    folderTrail = data.trail || [];
    syncLabel.textContent = 'Synced with Drive';
    renderBreadcrumbs();
    render();
    document.querySelector('#updated-at').textContent = `Updated ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
  } catch (error) {
    syncLabel.textContent = 'Drive setup needed';
    status.hidden = false;
    status.innerHTML = '';
    const title = document.createElement('strong');
    title.textContent = 'Connect the Drive folder';
    const detail = document.createElement('span');
    detail.textContent = error.message;
    status.append(title, detail);
  }
}
loadFiles();
setInterval(loadFiles, 5 * 60 * 1000);

