// ── State
const DATA_VERSION = '3';

let nick = '';
let vulns = [];
let fixedMap = {};   // { id: { nick, date } }
let activeSite = 'all';
let activeStatus = 'all';
let selectedSeverity = 'critical';

// ── Init
window.addEventListener('DOMContentLoaded', async () => {
  loadState();
  await loadVulns();

  if (nick) {
    showMain();
  }

  bindEvents();
});

function loadState() {
  if (localStorage.getItem('vt_version') !== DATA_VERSION) {
    localStorage.removeItem('vt_vulns');
    localStorage.removeItem('vt_fixed');
    localStorage.setItem('vt_version', DATA_VERSION);
  }
  nick = localStorage.getItem('vt_nick') || '';
  try {
    fixedMap = JSON.parse(localStorage.getItem('vt_fixed') || '{}');
  } catch {
    fixedMap = {};
  }
  try {
    const stored = JSON.parse(localStorage.getItem('vt_vulns') || 'null');
    if (stored) vulns = stored;
  } catch {
    vulns = [];
  }
}

function saveFixed() {
  localStorage.setItem('vt_fixed', JSON.stringify(fixedMap));
}

function saveVulns() {
  localStorage.setItem('vt_vulns', JSON.stringify(vulns));
}

async function loadVulns() {
  if (vulns.length > 0) return; // already loaded from localStorage

  try {
    const res = await fetch('data.json');
    vulns = await res.json();
    saveVulns();
  } catch (e) {
    vulns = [];
  }
}

// ── Nick
function showMain() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('main-screen').classList.remove('hidden');
  render();
}

// ── Bind events
function bindEvents() {
  // Nick continue
  const nickInput = document.getElementById('nick-input');
  document.getElementById('nick-btn').addEventListener('click', submitNick);
  nickInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitNick(); });

  // Site tabs
  document.querySelectorAll('.site-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.site-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSite = btn.dataset.site;
      render();
    });
  });

  // Status tabs
  document.querySelectorAll('.status-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStatus = btn.dataset.status;
      render();
    });
  });

  // Add button → modal
  document.getElementById('add-btn').addEventListener('click', openModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  // Severity picker
  document.querySelectorAll('.sev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sev-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSeverity = btn.dataset.sev;
    });
  });

  // Form submit
  document.getElementById('form-submit').addEventListener('click', submitVuln);
}

function submitNick() {
  const val = document.getElementById('nick-input').value.trim();
  if (!val) return;
  nick = val;
  localStorage.setItem('vt_nick', nick);
  showMain();
}

// ── Modal
function openModal() {
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('form-title').focus();
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('form-title').value = '';
  document.getElementById('form-desc').value = '';
  // Reset severity to critical
  document.querySelectorAll('.sev-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.sev-btn[data-sev="critical"]').classList.add('active');
  selectedSeverity = 'critical';
}

function submitVuln() {
  const site = document.getElementById('form-site').value;
  const title = document.getElementById('form-title').value.trim();
  const desc = document.getElementById('form-desc').value.trim();

  if (!title) {
    document.getElementById('form-title').focus();
    document.getElementById('form-title').style.borderColor = 'var(--red)';
    setTimeout(() => { document.getElementById('form-title').style.borderColor = ''; }, 1500);
    return;
  }

  const newVuln = {
    id: Date.now(),
    site,
    title,
    description: desc,
    severity: selectedSeverity,
    date: new Date().toISOString().split('T')[0],
    addedBy: nick
  };

  vulns.unshift(newVuln);
  saveVulns();
  closeModal();
  render();
}

// ── Toggle fixed
function toggleFixed(id) {
  const key = String(id);
  if (fixedMap[key]) {
    delete fixedMap[key];
  } else {
    fixedMap[key] = { nick, date: new Date().toISOString().split('T')[0] };
  }
  saveFixed();
  render();
}

// ── Render
function render() {
  const list = document.getElementById('vuln-list');

  let filtered = vulns.slice();

  if (activeSite !== 'all') {
    filtered = filtered.filter(v => v.site === activeSite);
  }

  if (activeStatus === 'open') {
    filtered = filtered.filter(v => !fixedMap[String(v.id)]);
  } else if (activeStatus === 'fixed') {
    filtered = filtered.filter(v => !!fixedMap[String(v.id)]);
  }

  // Stats (from full list filtered by site only)
  const siteFiltered = activeSite === 'all' ? vulns : vulns.filter(v => v.site === activeSite);
  const openCount  = siteFiltered.filter(v => !fixedMap[String(v.id)]).length;
  const fixedCount = siteFiltered.filter(v => !!fixedMap[String(v.id)]).length;
  document.getElementById('count-all').textContent   = siteFiltered.length;
  document.getElementById('count-open').textContent  = openCount;
  document.getElementById('count-fixed').textContent = fixedCount;

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>Уязвимостей не найдено</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(v => {
    const key = String(v.id);
    const isFixed = !!fixedMap[key];
    const fixer = fixedMap[key];
    const checkIcon = isFixed ? '✓' : '';

    return `
      <div class="vuln-card ${isFixed ? 'fixed' : ''}" onclick="toggleFixed(${v.id})">
        <div class="vuln-checkbox">${checkIcon}</div>
        <div class="vuln-body">
          <div class="vuln-meta">
            <span class="site-badge site-${v.site}">${v.site}</span>
            <span class="sev-badge sev-${v.severity}">${sevLabel(v.severity)}</span>
            <span class="vuln-date">${v.date}</span>
          </div>
          <div class="vuln-title">${escHtml(v.title)}</div>
          ${v.description ? `<div class="vuln-desc">${escHtml(v.description)}</div>` : ''}
          ${isFixed ? `<div class="fixer-info">Исправлено: ${escHtml(fixer.nick)}, ${fixer.date}</div>` : ''}
          ${v.addedBy ? `<div class="vuln-desc" style="margin-top:4px;font-size:0.75rem;color:var(--text3)">Добавил: ${escHtml(v.addedBy)}</div>` : ''}
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
