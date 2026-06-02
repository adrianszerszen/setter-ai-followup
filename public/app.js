// ---------- helpers ----------
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
async function api(path, opts) {
  const res = await fetch('/api' + path, { headers: { 'content-type': 'application/json' }, ...opts, body: opts && opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { data });
  return data;
}
const esc = s => (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const STAGE_LABEL = { zimny: 'zimny', cieply: 'ciepły', goracy: 'gorący', skonwertowany: 'skonwertowany', semi_dq: 'semi-DQ', dq: 'DQ' };
function flash(sel) { const e = $(sel); if (!e) return; e.classList.remove('hidden'); setTimeout(() => e.classList.add('hidden'), 1800); }

let settings = null, currentConvId = null;

// ---------- nav ----------
function showView(view) {
  $$('.nav-item, .nav-subitem').forEach(x => x.classList.toggle('active', x.dataset.view === view));
  $$('.view').forEach(v => v.classList.remove('active'));
  const el = $('#view-' + view); if (el) el.classList.add('active');
  if (view === 'panel') loadPanel();
  if (view === 'rozmowy') loadConversations();
  if (view === 'analityka') loadAnalytics();
  if (view === 'crm') loadCrm();
}
$$('.nav-item[data-view], .nav-subitem[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$$('.nav-parent[data-toggle]').forEach(b => b.addEventListener('click', () => {
  b.classList.toggle('open'); $('#sub-' + b.dataset.toggle).classList.toggle('open');
}));
$$('.qlink[data-go]').forEach(q => q.addEventListener('click', () => showView(q.dataset.go)));

// tabs (Osoba)
$$('#osobaTabs .tab').forEach(t => t.addEventListener('click', () => {
  $$('#osobaTabs .tab').forEach(x => x.classList.toggle('active', x === t));
  $$('#view-osoba .tabpane').forEach(p => p.classList.toggle('active', p.dataset.pane === t.dataset.tab));
}));

// ---------- settings load ----------
async function loadSettings() {
  settings = await api('/settings');
  const p = settings.persona || {}, c = settings.config || {}, i = settings.instagram || {};
  // Osoba
  $('#pFirma').value = p.firma || ''; $('#pNisza').value = p.nisza || ''; $('#pImie').value = p.imie || '';
  $('#pPlec').value = p.plec || ''; $('#pTytul').value = p.tytul || '';
  $('#pProblemy').value = p.problemy || ''; $('#pCele').value = p.cele || ''; $('#pLejek').value = p.lejek || '';
  $('#pZasoby').value = p.zasoby || ''; $('#pKryteria').value = p.kryteriaDQ || '';
  // Komentarze
  const cd = c.commentToDm || {}; $('#cKeyword').value = cd.keyword || ''; $('#cDm').value = cd.dm || ''; $('#cReply').checked = !!cd.replyToComment; $('#cPublic').value = cd.publicReply || '';
  // Zimny
  const co = c.coldOutreach || {}; $('#zEnabled').checked = !!co.enabled; $('#zLimit').value = co.dailyLimit || 40; $('#zQualifier').value = co.qualifier || ''; $('#zSources').value = (co.sources || []).join('\n');
  // Recovery
  const rc = c.recovery || {}; $('#rEnabled').checked = !!rc.enabled; $('#rMin').value = rc.dailyMin ?? 5; $('#rMax').value = rc.dailyMax ?? 15; $('#rMessages').value = (rc.messages || []).join('\n');
  // Ustawienia
  $$('input[name=provider]').forEach(r => r.checked = (r.value === settings.provider));
  $('#model').value = settings.model || ''; $('#maxTokens').value = settings.maxTokens || 320; $('#bookingLink').value = settings.bookingLink || '';
  $('#keyState').textContent = settings.apiKeySet ? '· zapisany ✓ (wpisz nowy, by zmienić)' : '· brak';
  const qh = c.quietHours || {}; $('#qhEnabled').checked = !!qh.enabled; $('#qhStart').value = qh.start || '23:30'; $('#qhEnd').value = qh.end || '06:30';
  $('#skipBig').checked = !!c.skipBigAccounts;
  // Konfiguracja
  renderProducts(c.products || []); $('#currency').value = c.currency || 'PLN';
  // Instagram
  $('#igEnabled').checked = !!i.enabled; $('#igVerifyToken').value = i.verifyToken || ''; $('#igUserId').value = i.igUserId || '';
  $('#igTokenState').textContent = i.pageAccessTokenSet ? '· ustawiony ✓' : '· brak';
  $('#igSecretState').textContent = i.appSecretSet ? '· ustawiony ✓' : '· brak';
  $('#igWebhookUrl').value = location.origin + '/webhook';
  // Openery + status
  renderOpeners(settings.openers || []); fillOpenerSelect(settings.openers || []);
  const ok = settings.apiKeySet;
  $('#statusDot').className = 'status-dot ' + (ok ? 'on' : 'off');
  $('#statusText').textContent = ok ? 'gotowy' : 'brak klucza API';
  $('#keyBanner').classList.toggle('hidden', ok);
  updateGamification();
}

// ---------- persona ----------
$('#savePersona').addEventListener('click', async () => {
  await api('/settings', { method: 'POST', body: { persona: {
    firma: $('#pFirma').value, nisza: $('#pNisza').value, imie: $('#pImie').value, plec: $('#pPlec').value,
    tytul: $('#pTytul').value, problemy: $('#pProblemy').value, cele: $('#pCele').value, lejek: $('#pLejek').value,
    zasoby: $('#pZasoby').value, kryteriaDQ: $('#pKryteria').value,
  }}});
  flash('#personaSaved'); await loadSettings();
});

// ---------- config sections ----------
$('#saveKomentarze').addEventListener('click', async () => {
  await api('/settings', { method: 'POST', body: { config: { commentToDm: {
    keyword: $('#cKeyword').value.trim(), dm: $('#cDm').value, replyToComment: $('#cReply').checked, publicReply: $('#cPublic').value,
  }}}});
  flash('#komSaved'); await loadSettings();
});
$('#saveZimny').addEventListener('click', async () => {
  await api('/settings', { method: 'POST', body: { config: { coldOutreach: {
    enabled: $('#zEnabled').checked, dailyLimit: parseInt($('#zLimit').value) || 40, qualifier: $('#zQualifier').value,
    sources: $('#zSources').value.split('\n').map(s => s.trim()).filter(Boolean),
  }}}});
  flash('#zimnySaved'); await loadSettings();
});
$('#saveRecovery').addEventListener('click', async () => {
  await api('/settings', { method: 'POST', body: { config: { recovery: {
    enabled: $('#rEnabled').checked, dailyMin: parseInt($('#rMin').value) || 0, dailyMax: parseInt($('#rMax').value) || 0,
    messages: $('#rMessages').value.split('\n').map(s => s.trim()).filter(Boolean),
  }}}});
  flash('#recSaved'); await loadSettings();
});

// ---------- konfiguracja / products ----------
function renderProducts(list) {
  $('#prodList').innerHTML = (list && list.length) ? list.map((p, idx) => `
    <div class="list-item"><div><b>${esc(p.name)}</b> · ${esc(String(p.price))}</div><button class="btn danger sm" data-pdel="${idx}">usuń</button></div>`).join('')
    : '<p class="muted">Brak produktów.</p>';
  $$('#prodList [data-pdel]').forEach(b => b.addEventListener('click', () => {
    const arr = (settings.config.products || []).slice(); arr.splice(parseInt(b.dataset.pdel), 1);
    settings.config.products = arr; renderProducts(arr);
  }));
}
$('#addProd').addEventListener('click', () => {
  const name = $('#prodName').value.trim(); const price = $('#prodPrice').value.trim();
  if (!name) return;
  const arr = (settings.config.products || []).slice(); arr.push({ name, price });
  settings.config.products = arr; renderProducts(arr); $('#prodName').value = ''; $('#prodPrice').value = '';
});
$('#saveKonfig').addEventListener('click', async () => {
  await api('/settings', { method: 'POST', body: { config: { products: settings.config.products || [], currency: $('#currency').value } } });
  flash('#konfigSaved'); await loadSettings();
});

// ---------- ustawienia ----------
$('#saveSettings').addEventListener('click', async () => {
  const body = {
    provider: $$('input[name=provider]').find(r => r.checked)?.value || 'anthropic',
    model: $('#model').value.trim(), maxTokens: parseInt($('#maxTokens').value) || 320, bookingLink: $('#bookingLink').value.trim(),
    config: { quietHours: { enabled: $('#qhEnabled').checked, start: $('#qhStart').value, end: $('#qhEnd').value }, skipBigAccounts: $('#skipBig').checked },
  };
  const key = $('#apiKey').value.trim(); if (key) body.apiKey = key;
  await api('/settings', { method: 'POST', body }); $('#apiKey').value = ''; flash('#setSaved'); await loadSettings();
});

// ---------- instagram ----------
$('#igGenToken').addEventListener('click', () => { $('#igVerifyToken').value = 'followup-' + Math.random().toString(36).slice(2, 10); });
$('#saveIg').addEventListener('click', async () => {
  const body = { instagram: { enabled: $('#igEnabled').checked, verifyToken: $('#igVerifyToken').value.trim(), igUserId: $('#igUserId').value.trim() } };
  const pt = $('#igPageToken').value.trim(); if (pt) body.instagram.pageAccessToken = pt;
  const as = $('#igAppSecret').value.trim(); if (as) body.instagram.appSecret = as;
  await api('/settings', { method: 'POST', body }); $('#igPageToken').value = ''; $('#igAppSecret').value = ''; flash('#igSaved'); await loadSettings();
});

// ---------- openery ----------
function renderOpeners(list) {
  $('#openerList').innerHTML = list.map((o, i) => `<div class="kvrow"><input type="text" value="${esc(o)}" data-i="${i}" /><button class="btn danger sm" data-del="${i}">usuń</button></div>`).join('');
  $$('#openerList [data-del]').forEach(b => b.addEventListener('click', () => { const a = collectOpeners(); a.splice(+b.dataset.del, 1); renderOpeners(a); }));
}
function collectOpeners() { return $$('#openerList input').map(i => i.value.trim()).filter(Boolean); }
$('#addOpener').addEventListener('click', () => { const v = $('#newOpener').value.trim(); if (!v) return; const a = collectOpeners(); a.push(v); renderOpeners(a); $('#newOpener').value = ''; });
$('#saveOpeners').addEventListener('click', async () => { const a = collectOpeners(); await api('/settings', { method: 'POST', body: { openers: a } }); settings.openers = a; fillOpenerSelect(a); flash('#openSaved'); });
function fillOpenerSelect(list) { $('#openerSelect').innerHTML = list.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join(''); }

// ---------- gamification ----------
function getXp() { return parseInt(localStorage.getItem('setterXp') || '0'); }
function addXp(n) { localStorage.setItem('setterXp', String(getXp() + n)); updateGamification(); }
function updateGamification() { const xp = getXp(); $('#xpNum').textContent = xp; $('#lvlNum').textContent = Math.floor(xp / 10) + 1; }

// ---------- test chat ----------
$$('input[name=startmode]').forEach(r => r.addEventListener('change', () => {
  const mode = $$('input[name=startmode]').find(x => x.checked).value;
  $('#openerRow').classList.toggle('hidden', mode !== 'opener');
  $('#leadRow').classList.toggle('hidden', mode !== 'lead');
}));
$('#newConvBtn').addEventListener('click', async () => {
  const mode = $$('input[name=startmode]').find(x => x.checked).value;
  const body = {};
  if (mode === 'opener') body.opener = $('#openerSelect').value;
  else { const t = $('#leadFirst').value.trim(); if (!t) { alert('Wpisz pierwszą wiadomość klienta.'); return; } body.leadFirstMessage = t; }
  $('#newConvBtn').disabled = true; if (mode === 'lead') showTyping();
  try { const conv = await api('/conversations', { method: 'POST', body }); currentConvId = conv.id; renderChat(conv); if (mode === 'lead') { $('#leadFirst').value = ''; addXp(1); } }
  catch (e) { renderChatError(e); } finally { $('#newConvBtn').disabled = false; }
});
async function sendMessage() {
  const text = $('#chatInput').value.trim(); if (!text) return;
  if (!currentConvId) { alert('Najpierw kliknij „Nowa rozmowa".'); return; }
  $('#chatInput').value = ''; appendMsg({ role: 'user', text }); showTyping();
  try { const conv = await api('/conversations/' + currentConvId + '/message', { method: 'POST', body: { text } }); renderChat(conv); addXp(1); }
  catch (e) { renderChatError(e); }
}
$('#sendBtn').addEventListener('click', sendMessage);
$('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
function renderChat(conv) {
  const w = $('#chatWindow');
  if (!conv || !conv.messages.length) { w.innerHTML = '<div class="chat-empty">Brak wiadomości.</div>'; return; }
  w.innerHTML = conv.messages.map(msgHtml).join(''); w.scrollTop = w.scrollHeight; setStage(conv.stage);
}
function msgHtml(m) { const s = m.role === 'assistant'; return `<div class="msg ${s ? 'setter' : 'klient'}"><span class="who">${s ? 'setter' : 'klientka'}</span>${esc(m.text)}</div>`; }
function appendMsg(m) { const w = $('#chatWindow'); if (w.querySelector('.chat-empty')) w.innerHTML = ''; w.insertAdjacentHTML('beforeend', msgHtml(m)); w.scrollTop = w.scrollHeight; }
function showTyping() { const w = $('#chatWindow'); if (w.querySelector('.chat-empty')) w.innerHTML = ''; w.insertAdjacentHTML('beforeend', '<div class="typing" id="typing">setter pisze…</div>'); w.scrollTop = w.scrollHeight; }
function setStage(stage) { const b = $('#stageBadge'); if (!stage) { b.classList.add('hidden'); return; } b.className = 'badge ' + stage; b.textContent = 'etap: ' + (STAGE_LABEL[stage] || stage); b.classList.remove('hidden'); }
function renderChatError(e) { const t = document.getElementById('typing'); if (t) t.remove(); $('#chatWindow').insertAdjacentHTML('beforeend', `<div class="typing" style="color:#e0524b">⚠️ ${esc(e.message)}</div>`); if (e.data && e.data.conversation) currentConvId = e.data.conversation.id; }

// ---------- conversations / rozmowy ----------
async function loadConversations() {
  const list = await api('/conversations'); const el = $('#convList');
  if (!list.length) { el.innerHTML = '<p class="muted">Brak rozmów. Zacznij w Testowym Czacie.</p>'; return; }
  el.innerHTML = list.map(c => `<div class="list-item" data-id="${c.id}"><div><div><b>${esc(c.username)}</b> <span class="badge ${c.stage}">${STAGE_LABEL[c.stage] || c.stage}</span></div><div class="li-last">${esc(c.last)}</div></div><button class="btn danger sm" data-del="${c.id}">usuń</button></div>`).join('');
  $$('#convList .list-item').forEach(it => it.addEventListener('click', async e => {
    if (e.target.dataset.del) return;
    const conv = await api('/conversations/' + it.dataset.id); currentConvId = conv.id; showView('testchat'); renderChat(conv);
  }));
  $$('#convList [data-del]').forEach(b => b.addEventListener('click', async e => { e.stopPropagation(); await api('/conversations/' + b.dataset.del, { method: 'DELETE' }); loadConversations(); }));
}

// ---------- CRM ----------
async function loadCrm() {
  const list = await api('/conversations'); const order = ['goracy', 'skonwertowany', 'cieply', 'zimny', 'semi_dq', 'dq'];
  const groups = {}; order.forEach(s => groups[s] = []);
  list.forEach(c => { (groups[c.stage] || (groups[c.stage] = [])).push(c); });
  let html = '';
  for (const s of order) { const g = groups[s]; if (!g.length) continue;
    html += `<h3><span class="badge ${s}">${STAGE_LABEL[s] || s}</span> · ${g.length}</h3><div class="list">` +
      g.map(c => `<div class="list-item" data-id="${c.id}"><div><b>${esc(c.username)}</b><div class="li-last">${esc(c.last)}</div></div><span class="muted small">${c.count} wiad.</span></div>`).join('') + '</div>';
  }
  $('#crmBody').innerHTML = html || '<p class="muted">Brak kontaktów. Pojawią się tu po rozmowach.</p>';
  $$('#crmBody .list-item').forEach(it => it.addEventListener('click', async () => { const conv = await api('/conversations/' + it.dataset.id); currentConvId = conv.id; showView('testchat'); renderChat(conv); }));
}

// ---------- analytics + panel ----------
async function loadAnalytics() {
  const a = await api('/analytics');
  $('#statCards').innerHTML = statCardsHtml(a);
  const order = ['zimny', 'cieply', 'goracy', 'skonwertowany', 'semi_dq', 'dq'];
  const max = Math.max(1, ...order.map(s => a.byStage[s] || 0));
  $('#funnel').innerHTML = order.map(s => { const n = a.byStage[s] || 0; return `<div class="fbar"><div class="flabel">${STAGE_LABEL[s]}</div><div class="ftrack"><div class="ffill" style="width:${(n / max) * 100}%"></div></div><div class="fcount">${n}</div></div>`; }).join('');
}
function statCardsHtml(a) {
  return `<div class="stat"><div class="num">${a.total}</div><div class="lbl">rozmów łącznie</div></div>
    <div class="stat"><div class="num">${a.byStage.skonwertowany || 0}</div><div class="lbl">umówionych</div></div>
    <div class="stat"><div class="num">${a.conversion}%</div><div class="lbl">konwersja</div></div>`;
}
async function loadPanel() { const a = await api('/analytics'); $('#panelStats').innerHTML = statCardsHtml(a); }

// ---------- init ----------
loadSettings().then(loadPanel).catch(e => { $('#statusText').textContent = 'błąd: ' + e.message; });
