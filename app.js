const list = document.querySelector('#file-list');
const status = document.querySelector('#status');
const syncLabel = document.querySelector('#sync-label');
const search = document.querySelector('#search');
const dialog = document.querySelector('#preview');
const frame = document.querySelector('#preview-frame');
let files = [];

function iconFor(file) {
  const type = file.mimeType || '';
  if (type.includes('pdf')) return ['PDF', 'pdf'];
  if (type.includes('presentation')) return ['SL', 'slides'];
  if (type.includes('spreadsheet')) return ['SH', 'sheets'];
  if (type.includes('document')) return ['DOC', 'docs'];
  if (type.includes('image')) return ['IMG', 'image'];
  if (type.includes('folder')) return ['DIR', 'folder'];
  return ['FILE', 'other'];
}
function render() {
  const term = search.value.trim().toLowerCase();
  const shown = files.filter(f => f.name.toLowerCase().includes(term));
  list.replaceChildren();
  if (!shown.length) {
    status.hidden = false;
    status.textContent = files.length ? 'No materials match that search.' : 'No files are in this folder yet. New additions will appear automatically.';
    return;
  }
  status.hidden = true;
  for (const file of shown) {
    const [label, kind] = iconFor(file);
    const button = document.createElement('button');
    button.className = 'file-card';
    button.type = 'button';
    button.innerHTML = `<span class="file-icon ${kind}">${label}</span><span class="file-info"><strong></strong><small></small></span><span class="file-action">Preview <b>↗</b></span>`;
    button.querySelector('strong').textContent = file.name;
    button.querySelector('small').textContent = `${label === 'FILE' ? 'File' : label} · ${file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}) : 'Study material'}`;
    button.addEventListener('click', () => openPreview(file));
    list.append(button);
  }
}
function openPreview(file) {
  document.querySelector('#preview-title').textContent = file.name;
  document.querySelector('#open-drive').href = file.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`;
  frame.src = `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/preview`;
  dialog.showModal();
}
document.querySelector('#close-preview').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { frame.src = 'about:blank'; });
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
search.addEventListener('input', render);
async function loadFiles() {
  try {
    const response = await fetch('/api/files', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load the folder.');
    files = data.files || [];
    syncLabel.textContent = 'Synced with Drive';
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

