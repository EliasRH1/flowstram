import { invoke } from '@tauri-apps/api/core';

const state = { extensions: [], catalogo: [], currentView: 'home' };
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

$$('.nav-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.view));
});

function navigate(view) {
  state.currentView = view;
  $$('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
}
window.navigate = navigate;

document.getElementById('content').addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', document.getElementById('content').scrollTop > 50);
});

function toast(message, type = 'success') {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ============ MIRU/JIRUHUB EXTENSION RUNTIME ============
class Extension {
  async request(path, options = {}) {
    let url = path;
    if (options.headers && options.headers['Miru-Url']) {
      url = options.headers['Miru-Url'];
    }
    if (!url.startsWith('http')) {
      url = (this.baseUrl || '') + url;
    }
    try {
      return await invoke('fetch_url', { url });
    } catch (e) {
      const res = await fetch(url);
      return await res.text();
    }
  }
  async querySelector(html, selector) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.querySelector(selector);
    if (!el) return { text: '', getAttributeText: () => '', content: '' };
    return {
      text: el.textContent || '',
      getAttributeText: (attr) => el.getAttribute(attr) || '',
      content: el.outerHTML || '',
    };
  }
  async querySelectorAll(html, selector) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll(selector)).map(el => ({
      text: el.textContent || '',
      getAttributeText: (attr) => el.getAttribute(attr) || '',
      content: el.outerHTML || '',
    }));
  }
  async getAttributeText(html, selector, attr) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.querySelector(selector);
    return el ? el.getAttribute(attr) || '' : '';
  }
}

// ============ EXTENSION LOADER ============
async function loadExtensions() {
  try {
    const names = await invoke('get_extensions');
    state.extensions = [];

    for (const name of names) {
      try {
        let code = await invoke('get_extension_code', { name });

        if (code.includes('extends Extension')) {
          // Wrap JiruHub/Miru extensions with runtime
          const wrapped = code
            .replace('export default class', 'class');
          const extClass = eval(wrapped);
          const instance = new extClass();
          if (instance.baseUrl) instance.baseUrl = instance.baseUrl;
          state.extensions.push(createAdapter(instance, name));
        } else {
          const ext = eval(code);
          state.extensions.push(ext);
        }
      } catch (e) {
        console.error(`Error loading ${name}:`, e);
      }
    }

    renderExtensions();
    const empty = document.getElementById('extensions-empty');
    empty.style.display = state.extensions.length > 0 ? 'none' : 'flex';
  } catch (e) {
    console.error(e);
  }
}

function createAdapter(inst, name) {
  return {
    name: name,
    sites: [name],
    _inst: inst,
    async search(query) {
      try {
        const results = await inst.search(query, 1);
        return (results || []).map(r => ({
          id: r.url || r.title,
          title: r.title || '',
          year: '',
          type: 'movie',
          poster: r.cover || '',
          description: '',
        }));
      } catch (e) { return []; }
    },
    async getStreams(id) {
      try {
        const detail = await inst.detail(id);
        if (!detail || !detail.episodes || !detail.episodes[0]) return [];
        const ep = detail.episodes[0];
        const lastUrl = ep.urls ? ep.urls[ep.urls.length - 1] : null;
        if (!lastUrl) return [];
        const watchResult = await inst.watch(lastUrl.url);
        if (!watchResult) return [];
        return [{ url: watchResult.url || '', quality: 'Auto', server: 'Miru' }];
      } catch (e) { return []; }
    },
  };
}

function renderExtensions() {
  const list = document.getElementById('extensions-list');
  list.innerHTML = state.extensions.map((ext, i) => `
    <div class="extension-card">
      <div class="ext-name">${ext.name || 'Sin nombre'}</div>
      <div class="ext-sites">${Array.isArray(ext.sites) ? ext.sites.join(', ') : ''}</div>
      <div class="ext-actions">
        <button class="btn-secondary" onclick="useExt(${i})">Usar</button>
        <button class="btn-secondary" onclick="removeExt(${i})" style="color:#ff6b6b">Eliminar</button>
      </div>
    </div>
  `).join('');
}

async function addExtension() {
  const url = document.getElementById('ext-url-input').value.trim();
  if (!url) return toast('Introduce una URL', 'error');
  try {
    const name = await invoke('add_extension', { url });
    document.getElementById('ext-url-input').value = '';
    closeModal();
    await loadExtensions();
    toast(`Extensión "${name}" instalada`);
  } catch (e) {
    toast(`Error: ${e}`, 'error');
  }
}
window.addExtension = addExtension;

async function removeExt(index) {
  const ext = state.extensions[index];
  if (!ext) return;
  try {
    await invoke('remove_extension', { name: ext.name });
    await loadExtensions();
    toast('Extensión eliminada');
  } catch (e) {
    toast(`Error: ${e}`, 'error');
  }
}
window.removeExt = removeExt;

function useExt(i) { navigate('search'); $('#search-input').value = ''; $('#search-results').innerHTML = ''; $('#search-input').focus(); }
window.useExt = useExt;

$('#btn-add-extension').addEventListener('click', () => {
  $('#modal-overlay').style.display = 'flex';
  $('#ext-url-input').value = '';
});

// ============ SEARCH ============
let searchTimeout;
$('#search-input').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) {
    $('#search-results').innerHTML = '';
    $('#search-empty').style.display = 'flex';
    return;
  }
  searchTimeout = setTimeout(() => searchAll(q), 600);
});

async function searchAll(query) {
  const resultsDiv = $('#search-results');
  const emptyDiv = $('#search-empty');
  resultsDiv.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px"><div class="spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Buscando...</p></div>';
  emptyDiv.style.display = 'none';

  try {
    let all = [];
    for (let i = 0; i < state.extensions.length; i++) {
      try {
        const ext = state.extensions[i];
        if (typeof ext.search !== 'function') continue;
        const results = await ext.search(query);
        if (Array.isArray(results)) {
          results.forEach(r => r.extIndex = i);
          all = all.concat(results);
        }
      } catch (e) { console.error(e); }
    }
    state.catalogo = all;
    if (all.length === 0) {
      resultsDiv.innerHTML = '';
      emptyDiv.style.display = 'flex';
      emptyDiv.querySelector('h3').textContent = 'Sin resultados';
      return;
    }
    renderCards(all, resultsDiv);
  } catch (e) {
    resultsDiv.innerHTML = '';
    emptyDiv.style.display = 'flex';
    emptyDiv.querySelector('h3').textContent = 'Error';
  }
}

function renderCards(items, container) {
  container.innerHTML = items.map(item => `
    <div class="movie-card" onclick="showDetail('${item.id.replace(/'/g, "\\'")}', ${item.extIndex})">
      ${item.poster
        ? `<img src="${item.poster}" alt="${item.title}" loading="lazy" />`
        : `<div class="no-poster"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="2" width="20" height="20" rx="2.18"/></svg></div>`
      }
      <div class="card-overlay">
        <div class="card-title">${item.title}</div>
        <div class="card-meta"><span>${item.year || ''}</span></div>
      </div>
    </div>
  `).join('');
}

// ============ DETAIL & PLAYER ============
window.showDetail = async function(id, extIndex) {
  const overlay = $('#detail-overlay');
  const content = $('#detail-content');
  overlay.style.display = 'flex';
  const item = state.catalogo.find(i => i.id === id);
  content.innerHTML = `
    <div class="detail-hero">
      ${item && item.poster ? `<img src="${item.poster}" alt="${item.title}" />` : ''}
      <div class="gradient"></div>
    </div>
    <div class="detail-body">
      <h2>${item ? item.title : ''}</h2>
      <p>${item ? (item.description || 'Sin descripción.') : ''}</p>
      <button class="btn-play" onclick="openPlayer('${(item ? item.id : '').replace(/'/g, "\\'")}', ${extIndex})">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Reproducir
      </button>
    </div>`;
};

window.closeDetail = function() { $('#detail-overlay').style.display = 'none'; };

window.openPlayer = async function(id, extIndex) {
  $('#player-overlay').style.display = 'flex';
  $('#player-status').style.display = 'flex';
  $('#stream-options').innerHTML = '';
  try {
    const ext = state.extensions[extIndex];
    if (!ext || typeof ext.getStreams !== 'function') throw new Error('No soporta reproducción');
    const streams = await ext.getStreams(id);
    $('#player-status').style.display = 'none';
    if (!streams || streams.length === 0) {
      $('#stream-options').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">No hay fuentes</p>';
      return;
    }
    $('#stream-options').innerHTML = streams.map(s =>
      `<button class="stream-btn" onclick="playStream('${encodeURIComponent(s.url)}')"><span>${s.server || 'Servidor'}${s.quality ? ' - ' + s.quality : ''}</span></button>`
    ).join('');
  } catch (e) {
    $('#player-status').style.display = 'none';
    $('#stream-options').innerHTML = `<p style="color:#ff6b6b;text-align:center;padding:20px">Error: ${e.message || e}</p>`;
  }
};

window.playStream = async function(url) {
  try {
    await invoke('play_with_mpv', { url: decodeURIComponent(url) });
    toast('Reproduciendo en MPV');
  } catch (e) { toast(`Error: ${e}`, 'error'); }
};

window.closePlayer = function() { $('#player-overlay').style.display = 'none'; };
window.closeModal = function() { $('#modal-overlay').style.display = 'none'; };

$$('.overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target.classList.contains('overlay-backdrop')) overlay.style.display = 'none';
  });
});

// ============ INIT ============
init();
async function init() {
  await loadExtensions();
}
