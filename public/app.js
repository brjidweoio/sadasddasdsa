// ── Config
const DATA_VERSION = '4';
const GITHUB_REPO  = 'brjidweoio/sadasddasdsa';
const RAW_DATA_URL  = () => `https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/data.json?t=${Date.now()}`;
const RAW_FIXED_URL = () => `https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/fixed.json?t=${Date.now()}`;
const API_FIXED_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/public/fixed.json`;

// ── State
let nick          = '';
let vulns         = [];
let fixedMap      = {};
let ghToken       = '';
let activeSite    = 'all';
let activeStatus  = 'all';
let selectedSeverity = 'critical';

// ── Init
window.addEventListener('DOMContentLoaded', async () => {
  if (localStorage.getItem('vt_version') !== DATA_VERSION) {
    localStorage.removeItem('vt_vulns');
    localStorage.setItem('vt_version', DATA_VERSION);
  }

  nick    = localStorage.getItem('vt_nick')    || '';
  ghToken = localStorage.getItem('vt_token')   || '';

  await loadAll();

  if (nick) showMain();

  bindEvents();
});

async function loadAll() {
  await Promise.all([loadVulns(), loadFixed()]);
}

async function loadVulns() {
  const stored = localStorage.getItem('vt_vulns');
  if (stored) { try { vulns = JSON.parse(stored); return; } catch {} }

  try {
    const r = await fetch(RAW_DATA_URL());
    vulns = await r.json();
    localStorage.setItem('vt_vulns', JSON.stringify(vulns));
  } catch { vulns = []; }
}

async function loadFixed() {
  try {
    const r = await fetch(RAW_FIXED_URL());
    if (r.ok) fixedMap = await r.json();
  } catch {
    fixedMap = {};
  }
}

// ── Nick
function showMain() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('main-screen').classList.remove('hidden');
  render();
}

// ── Events
function bindEvents() {
  const nickInput = document.getElementById('nick-input');
  document.getElementById('nick-btn').addEventListener('click', submitNick);
  nickInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitNick(); });

  document.querySelectorAll('.site-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.site-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSite = btn.dataset.site;
      render();
    });
  });

  document.querySelectorAll('.status-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStatus = btn.dataset.status;
      render();
    });
  });

  document.getElementById('add-btn').addEventListener('click', openAddModal);
  document.getElementById('modal-close').addEventListener('click', closeAddModal);
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeAddModal();
  });

  document.getElementById('token-btn').addEventListener('click', openTokenModal);
  document.getElementById('token-modal-close').addEventListener('click', closeTokenModal);
  document.getElementById('token-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('token-modal')) closeTokenModal();
  });
  document.getElementById('token-save').addEventListener('click', saveToken);
  document.getElementById('token-clear').addEventListener('click', clearToken);

  document.querySelectorAll('.sev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sev-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSeverity = btn.dataset.sev;
    });
  });

  document.getElementById('form-submit').addEventListener('click', submitVuln);
}

function submitNick() {
  const val = document.getElementById('nick-input').value.trim();
  if (!val) return;
  nick = val;
  localStorage.setItem('vt_nick', nick);
  showMain();
}

// ── Token modal
function openTokenModal() {
  document.getElementById('token-input').value = ghToken;
  document.getElementById('token-modal').classList.remove('hidden');
  document.getElementById('token-input').focus();
}
function closeTokenModal() {
  document.getElementById('token-modal').classList.add('hidden');
}
function saveToken() {
  const val = document.getElementById('token-input').value.trim();
  ghToken = val;
  localStorage.setItem('vt_token', ghToken);
  closeTokenModal();
  updateTokenBadge();
}
function clearToken() {
  ghToken = '';
  localStorage.removeItem('vt_token');
  document.getElementById('token-input').value = '';
  closeTokenModal();
  updateTokenBadge();
}
function updateTokenBadge() {
  const btn = document.getElementById('token-btn');
  btn.textContent = ghToken ? 'Ключ: ON' : 'Ключ';
  btn.style.color = ghToken ? 'var(--green)' : '';
  btn.style.borderColor = ghToken ? 'var(--green)' : '';
}

// ── Add modal
function openAddModal() {
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('form-title').focus();
}
function closeAddModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('form-title').value = '';
  document.getElementById('form-desc').value = '';
  document.querySelectorAll('.sev-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.sev-btn[data-sev="critical"]').classList.add('active');
  selectedSeverity = 'critical';
}

function submitVuln() {
  const site  = document.getElementById('form-site').value;
  const title = document.getElementById('form-title').value.trim();
  const desc  = document.getElementById('form-desc').value.trim();

  if (!title) {
    const inp = document.getElementById('form-title');
    inp.focus();
    inp.style.borderColor = 'var(--red)';
    setTimeout(() => { inp.style.borderColor = ''; }, 1500);
    return;
  }

  const newVuln = {
    id: Date.now(), site, title,
    description: desc,
    severity: selectedSeverity,
    date: new Date().toISOString().split('T')[0],
    addedBy: nick
  };

  vulns.unshift(newVuln);
  localStorage.setItem('vt_vulns', JSON.stringify(vulns));
  closeAddModal();
  render();
}

// ── Toggle fixed (global via GitHub API)
async function toggleFixed(id) {
  if (!ghToken) {
    openTokenModal();
    return;
  }

  const key = String(id);
  const card = document.querySelector(`[data-id="${id}"]`);
  if (card) card.style.opacity = '0.5';

  const newFixedMap = Object.assign({}, fixedMap);
  if (newFixedMap[key]) {
    delete newFixedMap[key];
  } else {
    newFixedMap[key] = { nick, date: new Date().toISOString().split('T')[0] };
  }

  try {
    const shaRes = await fetch(API_FIXED_URL, {
      headers: { Authorization: `Bearer ${ghToken}` }
    });
    const shaData = await shaRes.json();
    const sha = shaData.sha;

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(newFixedMap, null, 2))));

    const putRes = await fetch(API_FIXED_URL, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ghToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: `toggle fix: ${key}`, content, sha })
    });

    if (putRes.ok) {
      fixedMap = newFixedMap;
    } else {
      const err = await putRes.json();
      alert('Ошибка: ' + (err.message || 'не удалось сохранить'));
    }
  } catch (e) {
    alert('Ошибка соединения с GitHub');
  }

  render();
}

// ── Render
function render() {
  updateTokenBadge();
  const list = document.getElementById('vuln-list');

  let filtered = vulns.slice();
  if (activeSite !== 'all') filtered = filtered.filter(v => v.site === activeSite);
  if (activeStatus === 'open')  filtered = filtered.filter(v => !fixedMap[String(v.id)]);
  if (activeStatus === 'fixed') filtered = filtered.filter(v => !!fixedMap[String(v.id)]);

  const siteFiltered = activeSite === 'all' ? vulns : vulns.filter(v => v.site === activeSite);
  const openCount  = siteFiltered.filter(v => !fixedMap[String(v.id)]).length;
  const fixedCount = siteFiltered.filter(v => !!fixedMap[String(v.id)]).length;
  document.getElementById('count-all').textContent   = siteFiltered.length;
  document.getElementById('count-open').textContent  = openCount;
  document.getElementById('count-fixed').textContent = fixedCount;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>Уязвимостей не найдено</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(v => {
    const key     = String(v.id);
    const isFixed = !!fixedMap[key];
    const fixer   = fixedMap[key];

    return `
      <div class="vuln-card ${isFixed ? 'fixed' : ''}" data-id="${v.id}" onclick="toggleFixed(${v.id})">
        <div class="vuln-checkbox">${isFixed ? '&#10003;' : ''}</div>
        <div class="vuln-body">
          <div class="vuln-meta">
            <span class="site-badge site-${v.site}">${v.site}</span>
            <span class="sev-badge sev-${v.severity}">${sevLabel(v.severity)}</span>
            <span class="vuln-date">${v.date}</span>
          </div>
          <div class="vuln-title">${escHtml(v.title)}</div>
          ${v.description ? `<div class="vuln-desc">${escHtml(v.description)}</div>` : ''}
          ${isFixed ? `<div class="fixer-info">Исправлено: ${escHtml(fixer.nick)}, ${fixer.date}</div>` : ''}
          ${v.addedBy ? `<div class="vuln-added">Добавил: ${escHtml(v.addedBy)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function sevLabel(sev) {
  return { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }[sev] || sev;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
