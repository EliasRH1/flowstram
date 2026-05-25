import { invoke } from '@tauri-apps/api/core';

// ==================== STATE ====================
const state = {
  extensions: [],
  catalogo: [],
  currentView: 'home',
  playerOpen: false,
};

// ==================== DOM REFS ====================
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ==================== NAVIGATION ====================
$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.view));
});

function navigate(view) {
  state.currentView = view;
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
}

// ==================== TOAST ====================
function toast(message, type = 'success') {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ==================== EXTENSIONS ====================
async function loadExtensions() {
  try {
    state.extensions = await invoke('get_extensions');
    renderExtensions();
    if (state.extensions.length > 0) {
      document.getElementById('extensions-empty').style.display = 'none';
    } else {
      document.getElementById('extensions-empty').style.display = 'flex';
    }
  } catch (e) {
    console.error('Error loading extensions:', e);
  }
}

function renderExtensions() {
  const list = document.getElementById('extensions-list');
  list.innerHTML = state.extensions.map((ext, i) => `
    <div class="extension-card">
      <div class="extension-card-header">
        <span class="extension-name">${ext.name}</span>
        <span class="status-badge success">Activa</span>
      </div>
      <div class="extension-sites">${ext.sites ? ext.sites.join(', ') : 'Sin sitios'}</div>
      <div class="extension-actions">
        <button class="btn-secondary" onclick="useExtension(${i})">Usar</button>
        <button class="btn-secondary" onclick="removeExtension(${i})" style="color:var(--danger)">Eliminar</button>
      </div>
    </div>
  `).join('');
}

async function addExtension() {
  const urlInput = document.getElementById('ext-url-input');
  const url = urlInput.value.trim();
  if (!url) return toast('Introduce una URL', 'error');

  try {
    await invoke('add_extension', { url });
    urlInput.value = '';
    closeModal();
    await loadExtensions();
    toast('Extensión instalada correctamente');
  } catch (e) {
    toast(`Error: ${e}`, 'error');
  }
}

window.addExtension = addExtension;

async function removeExtension(index) {
  try {
    await invoke('remove_extension', { index });
    await loadExtensions();
    toast('Extensión eliminada');
  } catch (e) {
    toast(`Error: ${e}`, 'error');
  }
}
window.removeExtension = removeExtension;

async function useExtension(index) {
  navigate('search');
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-input').focus();
  toast(`Usando extensión: ${state.extensions[index].name}`);
}
window.useExtension = useExtension;

// ==================== SEARCH ====================
let searchTimeout;
document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) {
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-empty').style.display = 'flex';
    return;
  }
  searchTimeout = setTimeout(() => searchAll(q), 400);
});

async function searchAll(query) {
  const resultsDiv = document.getElementById('search-results');
  const emptyDiv = document.getElementById('search-empty');
  resultsDiv.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px"><div class="spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Buscando...</p></div>';
  emptyDiv.style.display = 'none';

  try {
    const results = await invoke('search_all', { query });
    state.catalogo = results;
    if (results.length === 0) {
      resultsDiv.innerHTML = '';
      emptyDiv.style.display = 'flex';
      emptyDiv.querySelector('p').textContent = 'Sin resultados';
      return;
    }
    renderCatalogo(results, resultsDiv);
  } catch (e) {
    resultsDiv.innerHTML = '';
    emptyDiv.style.display = 'flex';
    emptyDiv.querySelector('p').textContent = `Error: ${e}`;
  }
}

function renderCatalogo(items, container) {
  container.innerHTML = items.map(item => `
    <div class="media-card" onclick="showDetail('${item.id}', ${item.extIndex})">
      <div class="media-card-poster">
        ${item.poster
          ? `<img src="${item.poster}" alt="${item.title}" loading="lazy" />`
          : `<svg class="no-poster" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></svg>`
        }
      </div>
      <div class="media-card-info">
        <div class="media-card-title">${item.title}</div>
        <div class="media-card-meta">
          <span class="media-card-type">${item.type}</span>
          <span>${item.year || ''}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ==================== DETAIL ====================
window.showDetail = async function(id, extIndex) {
  const overlay = document.getElementById('detail-overlay');
  const content = document.getElementById('detail-content');
  const title = document.getElementById('detail-title');

  const item = state.catalogo.find(i => i.id === id);
  title.textContent = item ? item.title : 'Detalles';

  content.innerHTML = `
    <div class="detail-content">
      ${item && item.poster ? `<img src="${item.poster}" class="detail-poster" />` : ''}
      <div class="detail-info">
        <h3>${item ? item.title : ''}</h3>
        <div class="meta">${item ? `${item.year} · ${item.type}` : ''}</div>
        <p>${item ? (item.description || 'Sin descripción disponible.') : ''}</p>
      </div>
      <button class="btn-primary" onclick="openPlayer('${id}', ${extIndex})">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Reproducir
      </button>
    </div>
  `;
  overlay.style.display = 'flex';
};

window.closeDetail = function() {
  document.getElementById('detail-overlay').style.display = 'none';
};

// ==================== PLAYER ====================
window.openPlayer = async function(id, extIndex) {
  const overlay = document.getElementById('player-overlay');
  const statusDiv = document.getElementById('player-status');
  const streamDiv = document.getElementById('stream-options');
  const title = document.getElementById('player-title');

  const item = state.catalogo.find(i => i.id === id);
  title.textContent = item ? item.title : 'Reproduciendo';
  overlay.style.display = 'flex';
  state.playerOpen = true;

  statusDiv.style.display = 'flex';
  streamDiv.innerHTML = '';

  try {
    const ext = state.extensions[extIndex];
    if (!ext) throw new Error('Extensión no encontrada');

    const streams = await invoke('get_streams', { extensionIndex: extIndex, id });
    statusDiv.style.display = 'none';

    if (!streams || streams.length === 0) {
      streamDiv.innerHTML = '<p style="color:var(--text-muted)">No hay streams disponibles</p>';
      return;
    }

    streamDiv.innerHTML = streams.map((s, i) => `
      <button class="stream-btn" onclick="playStream('${encodeURIComponent(s.url)}', '${s.quality}')">
        ${s.server || 'Server'} — ${s.quality || 'Auto'}
      </button>
    `).join('');
  } catch (e) {
    statusDiv.style.display = 'none';
    streamDiv.innerHTML = `<p style="color:var(--danger)">Error: ${e}</p>`;
  }
};

window.playStream = async function(url, quality) {
  try {
    await invoke('play_with_mpv', { url: decodeURIComponent(url) });
    toast(`Reproduciendo en MPV (${quality})`);
  } catch (e) {
    toast(`Error al reproducir: ${e}`, 'error');
  }
};

window.closePlayer = function() {
  document.getElementById('player-overlay').style.display = 'none';
  state.playerOpen = false;
};

// ==================== MODAL ====================
document.getElementById('btn-add-extension').addEventListener('click', () => {
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('ext-url-input').value = '';
  document.getElementById('ext-preview').style.display = 'none';
});

window.closeModal = function() {
  document.getElementById('modal-overlay').style.display = 'none';
};

// Close modals on overlay click
$$('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
    }
  });
});

// Escanear extensiones
document.getElementById('btn-scan-extensions').addEventListener('click', async () => {
  toast('Escaneando extensiones...');
  await loadExtensions();
  toast('Extensiones cargadas');
});

// ==================== INIT ====================
async function init() {
  await loadExtensions();
}

init();
