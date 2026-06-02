// ---------- helpers ----------
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
async function api(path, opts) {
  const res = await fetch('/api' + path, {
    headers: { 'content-type': 'application/json' },
    ...opts,
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { data });
  return data;
}
const esc = s => (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const STAGE_LABEL = { zimny: 'zimny', cieply: 'ciepły', goracy: 'gorący', skonwertowany: 'skonwertowany', semi_dq: 'semi-DQ', dq: 'DQ' };

let settings = null;
let currentConvId = null;

// ---------- nav ----------
$$('.nav-item').forEach(b => b.addEventListener('click', () => {
  $$('.nav-item').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + b.dataset.view).classList.add('active');
  if (b.dataset.view === 'rozmowy') loadConversations();
  if (b.dataset.view === 'analityka') loadAnalytics();
}));

// ---------- settings ----------
async function loadSettings() {
  settings = await api('/settings');
  // ustawienia form
  $$('input[name=provider]').forEach(r => r.checked = (r.value === settings.provider));
  $('#model').value = settings.model || '';
  $('#maxTokens').value = settings.maxTokens || 320;
  $('#bookingLink').value = settings.bookingLink || '';
  $('#keyState').textContent = settings.apiKeySet ? '· zapisany ✓ (wpisz nowy, by zmienić)' : '· brak';
  // instrukcje
  $('#instructions').value = settings.instructions || '';
  // openery
  renderOpeners(settings.openers || []);
  fillOpenerSelect(settings.openers || []);
  // instagram
  const i = settings.instagram || {};
  $('#igEnabled').checked = !!i.enabled;
  $('#igVerifyToken').value = i.verifyToken || '';
  $('#igUserId').value = i.igUserId || '';
  $('#igKeyword').value = i.commentKeyword || '';
  $('#igTokenState').textContent = i.pageAccessTokenSet ? '· ustawiony ✓' : '· brak';
  $('#igSecretState').textContent = i.appSecretSet ? '· ustawiony ✓' : '· brak';
  $('#igWebhookUrl').value = location.origin + '/webhook';

  // status / banner
  const ok = settings.apiKeySet;
  $('#statusDot').className = 'status-dot ' + (ok ? 'on' : 'off');
  $('#statusText').textContent = ok ? 'gotowy' : 'brak klucza API';
  $('#keyBanner').classList.toggle('hidden', ok);
}

$('#saveSettings').addEventListener('click', async () => {
  const body = {
    provider: $$('input[name=provider]').find(r => r.checked)?.value || 'anthropic',
    model: $('#model').value.trim(),
    maxTokens: parseInt($('#maxTokens').value) || 320,
    bookingLink: $('#bookingLink').value.trim(),
  };
  const key = $('#apiKey').value.trim();
  if (key) body.apiKey = key;
  await api('/settings', { method: 'POST', body });
  $('#apiKey').value = '';
  flash('#setSaved');
  await loadSettings();
});

// ---------- instrukcje ----------
$('#saveInstr').addEventListener('click', async () => {
  await api('/settings', { method: 'POST', body: { instructions: $('#instructions').value } });
  flash('#instrSaved');
  settings.instructions = $('#instructions').value;
});

// ---------- openery ----------
function renderOpeners(list) {
  $('#openerList').innerHTML = list.map((o, i) => `
    <div class="opener-row">
      <input type="text" value="${esc(o)}" data-i="${i}" />
      <button class="btn danger" data-del="${i}">usuń</button>
    </div>`).join('');
  $$('#openerList [data-del]').forEach(b => b.addEventListener('click', () => {
    const arr = collectOpeners(); arr.splice(parseInt(b.dataset.del), 1); renderOpeners(arr);
  }));
}
function collectOpeners() {
  return $$('#openerList input').map(i => i.value.trim()).filter(Boolean);
}
$('#addOpener').addEventListener('click', () => {
  const v = $('#newOpener').value.trim(); if (!v) return;
  const arr = collectOpeners(); arr.push(v); renderOpeners(arr); $('#newOpener').value = '';
});
$('#saveOpeners').addEventListener('click', async () => {
  const arr = collectOpeners();
  await api('/settings', { method: 'POST', body: { openers: arr } });
  settings.openers = arr; fillOpenerSelect(arr); flash('#openSaved');
});
function fillOpenerSelect(list) {
  $('#openerSelect').innerHTML = list.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
}

// ---------- test-chat ----------
$$('input[name=startmode]').forEach(r => r.addEventListener('change', () => {
  const mode = $$('input[name=startmode]').find(x => x.checked).value;
  $('#openerRow').classList.toggle('hidden', mode !== 'opener');
  $('#leadRow').classList.toggle('hidden', mode !== 'lead');
}));

$('#newConvBtn').addEventListener('click', async () => {
  const mode = $$('input[name=startmode]').find(x => x.checked).value;
  const body = {};
  if (mode === 'opener') body.opener = $('#openerSelect').value;
  else {
    const t = $('#leadFirst').value.trim();
    if (!t) { alert('Wpisz pierwszą wiadomość klienta.'); return; }
    body.leadFirstMessage = t;
  }
  $('#newConvBtn').disabled = true;
  if (mode === 'lead') showTyping();
  try {
    const conv = await api('/conversations', { method: 'POST', body });
    currentConvId = conv.id;
    renderChat(conv);
    if (mode === 'lead') $('#leadFirst').value = '';
  } catch (e) {
    renderChatError(e);
  } finally {
    $('#newConvBtn').disabled = false;
  }
});

async function sendMessage() {
  const text = $('#chatInput').value.trim();
  if (!text) return;
  if (!currentConvId) { alert('Najpierw kliknij „Nowa rozmowa".'); return; }
  $('#chatInput').value = '';
  appendMsg({ role: 'user', text });
  showTyping();
  try {
    const conv = await api('/conversations/' + currentConvId + '/message', { method: 'POST', body: { text } });
    renderChat(conv);
  } catch (e) {
    renderChatError(e);
  }
}
$('#sendBtn').addEventListener('click', sendMessage);
$('#chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

function renderChat(conv) {
  const w = $('#chatWindow');
  if (!conv || !conv.messages.length) { w.innerHTML = '<div class="chat-empty muted">Brak wiadomości.</div>'; return; }
  w.innerHTML = conv.messages.map(m => msgHtml(m)).join('');
  w.scrollTop = w.scrollHeight;
  setStage(conv.stage);
}
function msgHtml(m) {
  const setter = m.role === 'assistant';
  return `<div class="msg ${setter ? 'setter' : 'klient'}"><span class="who">${setter ? 'setter' : 'klientka'}</span>${esc(m.text)}</div>`;
}
function appendMsg(m) {
  const w = $('#chatWindow');
  if (w.querySelector('.chat-empty')) w.innerHTML = '';
  w.insertAdjacentHTML('beforeend', msgHtml(m));
  w.scrollTop = w.scrollHeight;
}
function showTyping() {
  const w = $('#chatWindow');
  if (w.querySelector('.chat-empty')) w.innerHTML = '';
  w.insertAdjacentHTML('beforeend', '<div class="typing" id="typing">setter pisze…</div>');
  w.scrollTop = w.scrollHeight;
}
function setStage(stage) {
  const b = $('#stageBadge');
  if (!stage) { b.classList.add('hidden'); return; }
  b.className = 'badge ' + stage;
  b.textContent = 'etap: ' + (STAGE_LABEL[stage] || stage);
  b.classList.remove('hidden');
}
function renderChatError(e) {
  const t = document.getElementById('typing'); if (t) t.remove();
  const w = $('#chatWindow');
  w.insertAdjacentHTML('beforeend', `<div class="typing" style="color:#e0524b">⚠️ ${esc(e.message)}</div>`);
  if (e.data && e.data.conversation) currentConvId = e.data.conversation.id;
}

// ---------- rozmowy ----------
async function loadConversations() {
  const list = await api('/conversations');
  const el = $('#convList');
  if (!list.length) { el.innerHTML = '<p class="muted">Brak rozmów. Zacznij w Test-chacie.</p>'; return; }
  el.innerHTML = list.map(c => `
    <div class="list-item" data-id="${c.id}">
      <div class="li-main">
        <div><b>${esc(c.username)}</b> <span class="badge ${c.stage}">${STAGE_LABEL[c.stage] || c.stage}</span></div>
        <div class="li-last">${esc(c.last)}</div>
      </div>
      <button class="btn danger" data-del="${c.id}">usuń</button>
    </div>`).join('');
  $$('#convList .list-item').forEach(it => it.addEventListener('click', async e => {
    if (e.target.dataset.del) return;
    const conv = await api('/conversations/' + it.dataset.id);
    currentConvId = conv.id;
    $$('.nav-item').forEach(x => x.classList.remove('active'));
    $('.nav-item[data-view=testchat]').classList.add('active');
    $$('.view').forEach(v => v.classList.remove('active'));
    $('#view-testchat').classList.add('active');
    renderChat(conv);
  }));
  $$('#convList [data-del]').forEach(b => b.addEventListener('click', async e => {
    e.stopPropagation();
    await api('/conversations/' + b.dataset.del, { method: 'DELETE' });
    loadConversations();
  }));
}

// ---------- analityka ----------
async function loadAnalytics() {
  const a = await api('/analytics');
  $('#statCards').innerHTML = `
    <div class="stat"><div class="num">${a.total}</div><div class="lbl">rozmów łącznie</div></div>
    <div class="stat"><div class="num">${a.byStage.skonwertowany || 0}</div><div class="lbl">umówionych</div></div>
    <div class="stat"><div class="num">${a.conversion}%</div><div class="lbl">konwersja</div></div>`;
  const order = ['zimny', 'cieply', 'goracy', 'skonwertowany', 'semi_dq', 'dq'];
  const max = Math.max(1, ...order.map(s => a.byStage[s] || 0));
  $('#funnel').innerHTML = order.map(s => {
    const n = a.byStage[s] || 0;
    return `<div class="fbar"><div class="flabel">${STAGE_LABEL[s]}</div><div class="ftrack"><div class="ffill" style="width:${(n / max) * 100}%"></div></div><div class="fcount">${n}</div></div>`;
  }).join('');
}

// ---------- instagram ----------
$('#igGenToken').addEventListener('click', () => { $('#igVerifyToken').value = 'followup-' + Math.random().toString(36).slice(2, 10); });
$('#saveIg').addEventListener('click', async () => {
  const body = { instagram: {
    enabled: $('#igEnabled').checked,
    verifyToken: $('#igVerifyToken').value.trim(),
    igUserId: $('#igUserId').value.trim(),
    commentKeyword: $('#igKeyword').value.trim(),
  }};
  const pt = $('#igPageToken').value.trim(); if (pt) body.instagram.pageAccessToken = pt;
  const as = $('#igAppSecret').value.trim(); if (as) body.instagram.appSecret = as;
  await api('/settings', { method: 'POST', body });
  $('#igPageToken').value = ''; $('#igAppSecret').value = '';
  flash('#igSaved'); await loadSettings();
});

function flash(sel) { const e = $(sel); e.classList.remove('hidden'); setTimeout(() => e.classList.add('hidden'), 1800); }

// ---------- init ----------
loadSettings().catch(e => { $('#statusText').textContent = 'błąd: ' + e.message; });
