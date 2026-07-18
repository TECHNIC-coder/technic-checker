const API_URL = document.querySelector('meta[name="api-url"]')?.getAttribute('content') || '';
let authToken = localStorage.getItem('token');
let currentMode = 'checker';

const bgCanvas = document.getElementById('bgCanvas');
const ctx = bgCanvas.getContext('2d');

function resizeCanvas() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const nodes = [];
const NODE_COUNT = 60;
const CONNECTION_DIST = 120;

for (let i = 0; i < NODE_COUNT; i++) {
  nodes.push({
    x: Math.random() * bgCanvas.width,
    y: Math.random() * bgCanvas.height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    r: Math.random() * 2 + 1,
  });
}

function drawBg() {
  ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  for (const n of nodes) {
    n.x += n.vx;
    n.y += n.vy;
    if (n.x < 0 || n.x > bgCanvas.width) n.vx *= -1;
    if (n.y < 0 || n.y > bgCanvas.height) n.vy *= -1;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 136, 0.4)';
    ctx.fill();
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONNECTION_DIST) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.strokeStyle = `rgba(0, 255, 136, ${0.08 * (1 - dist / CONNECTION_DIST)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
  requestAnimationFrame(drawBg);
}
drawBg();

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }
function loading(btn, state) {
  if (state) { btn.classList.add('btn-loading'); btn.disabled = true; }
  else { btn.classList.remove('btn-loading'); btn.disabled = false; }
}

if (authToken) checkAuth();

// ===== Login =====
$('#keyInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
$('#loginBtn').addEventListener('click', login);

async function login() {
  const key = $('#keyInput').value.trim();
  if (!key) return;
  $('#errorMessage').classList.add('hidden');
  loading($('#loginBtn'), true);
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error === 'Key expired' ? 'KEY EXPIRED' : 'INVALID KEY');
      return;
    }
    authToken = data.token;
    localStorage.setItem('token', authToken);
    showDashboard(data);
  } catch {
    showError('CONNECTION ERROR');
  } finally {
    loading($('#loginBtn'), false);
  }
}

$('#logoutBtn').addEventListener('click', () => {
  authToken = null;
  localStorage.removeItem('token');
  hide('dashboardPage');
  show('loginPage');
  $('#keyInput').value = '';
});

// ===== Mode Tabs =====
$$('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentMode = tab.dataset.mode;
    hide('panelChecker');
    hide('panelValid');
    show('panel' + currentMode.charAt(0).toUpperCase() + currentMode.slice(1));
  });
});

// ===== DB Checker =====
$('#checkBtn').addEventListener('click', checkNickname);
$('#nickInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') checkNickname(); });

async function checkNickname() {
  const nick = $('#nickInput').value.trim();
  if (!nick) return;
  loading($('#checkBtn'), true);
  try {
    const res = await fetch(`${API_URL}/api/check/nickname`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ nickname: nick })
    });
    const data = await res.json();
    if (res.status === 403) { renderResults([], 'DAILY LIMIT EXCEEDED', true); return; }
    if (!res.ok) { renderResults([], data.error || 'ERROR', true); return; }
    renderResults(data.results, null, false, data.total);
  } catch {
    renderResults([], 'CONNECTION ERROR', true);
  } finally {
    loading($('#checkBtn'), false);
  }
}

function renderResults(results, error, isError, total) {
  const container = $('#checkResults');
  const list = $('#resultsList');
  const empty = $('#emptyState');
  const count = $('#resultCount');
  if (isError) {
    container.classList.remove('hidden'); empty.classList.add('hidden');
    list.innerHTML = `<div class="result-error">${error}</div>`;
    count.textContent = ''; return;
  }
  if (results.length === 0) {
    container.classList.add('hidden'); empty.classList.remove('hidden'); return;
  }
  container.classList.remove('hidden'); empty.classList.add('hidden');
  count.textContent = `${results.length} match${results.length !== 1 ? 'es' : ''}`;
  list.innerHTML = results.map(r =>
    `<div class="result-item">
      <span class="result-nick">${esc(r.nickname)}</span>
      <span class="result-db">${esc(r.database)}</span>
      <span class="result-pass">${esc(r.password)}</span>
    </div>`
  ).join('');
}

// ===== VALID Checker =====
const validSound = new Audio('valid.m4a');
validSound.loop = true;
const nevalidSound = new Audio('nevalid.mp3');

$('#validBtn').addEventListener('click', validCheck);
$('#validUserInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') validCheck(); });
$('#validPassInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') validCheck(); });

async function validCheck() {
  const username = $('#validUserInput').value.trim();
  const password = $('#validPassInput').value.trim();
  if (!username || !password) return;
  loading($('#validBtn'), true);
  validSound.currentTime = 0;
  validSound.play().catch(() => {});
  try {
    const res = await fetch(`${API_URL}/api/valid/check`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    validSound.pause();
    if (res.status === 403) { renderValidResult([{ label: 'Error', value: 'DAILY LIMIT EXCEEDED' }], true); return; }
    if (!res.ok) { renderValidResult([{ label: 'Error', value: data.error || 'CHECK FAILED' }], true); return; }
    const items = [
      { label: 'Status', value: data.valid ? 'VALID' : 'INVALID' },
      { label: '1FA', value: data.has1fa ? 'Yes' : 'No' },
      { label: '2FA', value: data.has2fa ? 'Yes' : 'No' },
      { label: 'Banned', value: data.banned ? 'Yes' : 'No' },
    ];
    if (data.banned && data.banReason) items.push({ label: 'Ban Reason', value: data.banReason });
    if (data.banned && data.banDuration) items.push({ label: 'Ban Duration', value: data.banDuration });
    renderValidResult(items, false, data.valid);
    showValidStats(data.valid);
    if (!data.valid) nevalidSound.play().catch(() => {});
  } catch {
    validSound.pause();
    renderValidResult([{ label: 'Error', value: 'CONNECTION ERROR' }], true);
  } finally {
    loading($('#validBtn'), false);
  }
}

function renderValidResult(items, isError, valid) {
  const container = $('#validResults');
  const list = $('#validResultList');
  const empty = $('#validEmptyState');
  container.classList.remove('hidden'); empty.classList.add('hidden');
  const status = valid ? '✅' : '❌';
  const color = valid ? 'var(--accent)' : 'var(--danger)';
  list.innerHTML = items.map((item, i) => {
    if (i === 0) {
      return `<div class="result-item" style="border-bottom: 1px solid var(--border-glass);">
        <span class="result-nick" style="font-size:18px;font-weight:700;color:${color}">${status} ${esc(item.value)}</span>
      </div>`;
    }
    return `<div class="result-item">
      <span class="result-nick" style="min-width:140px;font-size:12px;font-weight:500;color:var(--text-secondary)">${esc(item.label)}</span>
      <span class="result-pass" style="text-align:left;font-size:13px">${esc(item.value)}</span>
    </div>`;
  }).join('');
}

function showValidStats(v) {
  const parts = ($('#statDailyChecks').textContent || '0 / 500').split('/');
  const d = parseInt(parts[0]) || 0;
  const l = parseInt(parts[1]) || 500;
  const c = parseInt($('#statTotalChecks').textContent) || 0;
  if (v) {
    $('#statTotalChecks').textContent = c + 1;
    $('#statDailyChecks').textContent = `${d + 1} / ${l}`;
  }
  const pct = Math.min(((v ? d + 1 : d) / l) * 100, 100);
  const fill = $('#progressFill');
  fill.style.width = pct + '%';
  if (pct > 80) fill.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
  else fill.style.background = 'linear-gradient(90deg, #22c55e, #f59e0b)';
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ===== Auth / Dashboard =====
async function checkAuth() {
  try {
    const res = await fetch(`${API_URL}/api/user/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    showDashboard(data);
  } catch {
    localStorage.removeItem('token');
    authToken = null;
  }
}

function showDashboard(data) {
  hide('loginPage');
  show('dashboardPage');
  $('#statUserId').textContent = data.userId ?? '—';
  $('#statRegNum').textContent = '#' + (data.registrationNumber ?? '—');
  $('#statTotalChecks').textContent = data.totalChecks ?? 0;
  const dc = data.dailyChecks ?? 0;
  const dl = data.dailyLimit ?? 500;
  $('#statDailyChecks').textContent = `${dc} / ${dl}`;
  const pct = Math.min((dc / dl) * 100, 100);
  const fill = $('#progressFill');
  fill.style.width = '0%';
  setTimeout(() => { fill.style.width = pct + '%'; }, 100);
  if (pct > 80) fill.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
  else fill.style.background = 'linear-gradient(90deg, #22c55e, #f59e0b)';
}

function showError(msg) {
  const el = $('#errorMessage');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ===== F12 Easter Egg =====
document.addEventListener('keydown', e => {
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || (e.ctrlKey && e.key === 'U')) {
    e.preventDefault();
    nevalidSound.currentTime = 0;
    nevalidSound.play().catch(() => {});
  }
});

setInterval(() => {
  const start = performance.now();
  debugger;
  if (performance.now() - start > 100) {
    nevalidSound.currentTime = 0;
    nevalidSound.play().catch(() => {});
  }
}, 500);
