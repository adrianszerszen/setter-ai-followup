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
  if (view === 'konto') loadKonto();
  if (view === 'ab') loadAb();
  if (view === 'automatyzacje') loadFlows();
  if (view === 'testchat') loadLive();
}
$$('.nav-item[data-view], .nav-subitem[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$$('.nav-parent[data-toggle]').forEach(b => b.addEventListener('click', () => {
  b.classList.toggle('open'); $('#sub-' + b.dataset.toggle).classList.toggle('open');
}));
// delegacja: każdy element z data-go przełącza widok (skróty na Panelu, linki w Akademii)
document.addEventListener('click', e => { const t = e.target.closest('[data-go]'); if (t) { e.preventDefault(); showView(t.dataset.go); } });

// ---------- Samouczek (modal) ----------
if ($('#openTutorial')) $('#openTutorial').addEventListener('click', () => $('#tutorialOverlay').classList.remove('hidden'));
if ($('#closeTutorial')) $('#closeTutorial').addEventListener('click', () => $('#tutorialOverlay').classList.add('hidden'));
if ($('#tutorialOverlay')) $('#tutorialOverlay').addEventListener('click', e => { if (e.target.id === 'tutorialOverlay') e.currentTarget.classList.add('hidden'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const o = $('#tutorialOverlay'); if (o) o.classList.add('hidden'); } });
$$('.copybtn').forEach(b => b.addEventListener('click', async () => {
  const el = $('#' + b.dataset.copy); if (!el) return;
  try { await navigator.clipboard.writeText(el.textContent); const o = b.textContent; b.textContent = 'skopiowano ✓'; setTimeout(() => b.textContent = o, 1500); }
  catch { const r = document.createRange(); r.selectNode(el); window.getSelection().removeAllRanges(); window.getSelection().addRange(r); }
}));

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
  renderLm(p.leadMagnets || []); $('#pKryteria').value = p.kryteriaDQ || '';
  // Komentarze
  const cd = c.commentToDm || {}; $('#cKeyword').value = cd.keyword || ''; $('#cDm').value = cd.dm || ''; $('#cReply').checked = !!cd.replyToComment; $('#cPublic').value = cd.publicReply || '';
  // Zimny zasięg (pełny moduł)
  const co = c.coldOutreach || {}; const zq = co.qualification || {};
  $('#zEnabled').checked = !!co.enabled; $('#zLimit').value = co.dailyLimit ?? 40;
  $('#zRampUp').checked = !!co.rampUp; $('#zStartDaily').value = co.startDaily ?? 30;
  $('#zOverwrite').checked = !!co.overwriteQualification; $('#zMessage').value = co.message || '';
  $('#zLikersAi').checked = !!co.likersAi; $('#zSources').value = (co.sources || []).join('\n');
  zSourceAccounts = (co.sourceAccounts || []).slice(); renderSourceAccounts();
  $('#zqEnabled').checked = zq.enabled !== false; $('#zqAi').value = zq.aiQuestion || co.qualifier || '';
  $('#zqSkipMen').checked = !!zq.skipMen; $('#zqSkipWomen').checked = !!zq.skipWomen;
  $('#zqNoPhoto').checked = !!zq.skipNoPhoto; $('#zqPrivate').checked = !!zq.skipPrivate; $('#zqEmptyBio').checked = !!zq.skipEmptyBio;
  $('#zqNoLink').checked = !!zq.skipNoLink; $('#zqNoHighlights').checked = !!zq.skipNoHighlights; $('#zqNoPosts').checked = !!zq.skipNoPosts;
  $('#zqMinF').value = zq.minFollowers ?? 0; $('#zqMaxF').value = zq.maxFollowers ?? 0; $('#zqMinP').value = zq.minPosts ?? 0;
  $('#zqUncertain').checked = zq.skipUncertain !== false; $('#zqFilterDm').checked = zq.filterIncomingDm !== false;
  // Recovery
  const rc = c.recovery || {}; $('#rEnabled').checked = !!rc.enabled; $('#rMin').value = rc.dailyMin ?? 5; $('#rMax').value = rc.dailyMax ?? 15; $('#rMessages').value = (rc.messages || []).join('\n');
  // Ustawienia
  $$('input[name=provider]').forEach(r => r.checked = (r.value === settings.provider));
  $('#model').value = settings.model || ''; $('#maxTokens').value = settings.maxTokens || 320; $('#bookingLink').value = settings.bookingLink || '';
  $('#keyState').textContent = settings.apiKeySet ? '· zapisany ✓ (wpisz nowy, by zmienić)' : '· brak';
  const qh = c.quietHours || {}; $('#qhEnabled').checked = !!qh.enabled; $('#qhStart').value = qh.start || '23:30'; $('#qhEnd').value = qh.end || '06:30';
  const rt = c.responseTime || {}; $('#rtMin').value = rt.min ?? 10; $('#rtMax').value = rt.max ?? 175; updateRtLabels(); updateQhDial();
  const fl = c.followersLimit || {}; $('#flEnabled').checked = (fl.enabled !== undefined ? !!fl.enabled : !!c.skipBigAccounts); $('#flValue').value = fl.value || 10000; updateFlLabel();
  blacklist = (c.blacklist || []).slice(); renderBlacklist();
  // Konfiguracja
  renderProducts(c.products || []); $('#currency').value = c.currency || 'PLN';
  // Instagram
  $('#igEnabled').checked = !!i.enabled; $('#igVerifyToken').value = i.verifyToken || ''; $('#igUserId').value = i.igUserId || '';
  $('#igTokenState').textContent = i.pageAccessTokenSet ? '· ustawiony ✓' : '· brak';
  $('#igSecretState').textContent = i.appSecretSet ? '· ustawiony ✓' : '· brak';
  $('#igWebhookUrl').value = location.origin + '/webhook';
  // Kontrola bota + karty połączeń
  const bc = c.botControl || {};
  if ($('#bcAuto')) { $('#bcAuto').checked = bc.autoReply !== false; $('#bcFollowups').checked = bc.smartFollowups !== false; $('#bcIgnoreFollowing').checked = !!bc.ignoreFollowing; $('#bcDelays').checked = !!bc.responseDelays; $('#bcHandoff').checked = bc.handoffDetection !== false; }
  renderConnCards(i);
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
    leadMagnets: collectLm(), kryteriaDQ: $('#pKryteria').value,
  }}});
  flash('#personaSaved'); await loadSettings();
});

// ---------- lead magnety (Osoba → Zasoby) ----------
function renderLm(list) {
  $('#lmList').innerHTML = (list || []).map((z, i) => `<div class="card" style="background:var(--panel2);margin:6px 0">
    <input type="text" class="lm-name" placeholder="nazwa zasobu (np. Darmowy przewodnik…)" value="${esc(z.name || '')}" />
    <div class="row"><input type="text" class="lm-kw" placeholder="słowa kluczowe po przecinku" value="${esc(z.keywords || '')}" /><input type="text" class="lm-link" placeholder="link (opcjonalnie)" value="${esc(z.link || '')}" /><button class="btn danger sm" data-lmdel="${i}">usuń</button></div></div>`).join('');
  $$('#lmList [data-lmdel]').forEach(b => b.addEventListener('click', () => { const a = collectLm(); a.splice(+b.dataset.lmdel, 1); renderLm(a); }));
}
function collectLm() {
  const n = $$('#lmList .lm-name'), k = $$('#lmList .lm-kw'), l = $$('#lmList .lm-link');
  return n.map((x, i) => ({ name: x.value.trim(), keywords: k[i].value.trim(), link: l[i].value.trim() })).filter(z => z.name);
}
$('#addLm').addEventListener('click', () => { const a = collectLm(); a.push({ name: '', keywords: '', link: '' }); renderLm(a); });

// ---------- config sections ----------
$('#saveKomentarze').addEventListener('click', async () => {
  await api('/settings', { method: 'POST', body: { config: { commentToDm: {
    keyword: $('#cKeyword').value.trim(), dm: $('#cDm').value, replyToComment: $('#cReply').checked, publicReply: $('#cPublic').value,
  }}}});
  flash('#komSaved'); await loadSettings();
});
// Zimny zasięg: zakładki + źródła
let zSourceAccounts = [];
const SRC_TYPE = { followers: 'ostatni 1000 obs.', monitor: 'monitor nowych', similar: 'podobne konta', likers: 'lajkujący' };
$$('#zimnyTabs .tab').forEach(t => t.addEventListener('click', () => {
  $$('#zimnyTabs .tab').forEach(x => x.classList.toggle('active', x === t));
  $$('#view-zimny .zpane').forEach(p => p.classList.toggle('active', p.dataset.zpane === t.dataset.ztab));
}));
function renderSourceAccounts() {
  const el = $('#zSourceList'); if (!el) return;
  el.innerHTML = zSourceAccounts.length
    ? zSourceAccounts.map((s, i) => `<div class="list-item"><div><b>${esc(s.handle)}</b> <span class="badge zimny">${SRC_TYPE[s.type] || s.type}</span></div><button class="btn danger sm" data-srcdel="${i}">usuń</button></div>`).join('')
    : '<p class="muted small">Brak źródeł. Dodaj kilkanaście kont poniżej.</p>';
  $$('#zSourceList [data-srcdel]').forEach(b => b.addEventListener('click', () => { zSourceAccounts.splice(+b.dataset.srcdel, 1); renderSourceAccounts(); }));
}
if ($('#addSrc')) $('#addSrc').addEventListener('click', () => {
  const h = $('#zSrcHandle').value.trim(); if (!h) return;
  zSourceAccounts.push({ handle: h, type: $('#zSrcType').value, note: '' }); $('#zSrcHandle').value = ''; renderSourceAccounts();
});
$('#saveZimny').addEventListener('click', async () => {
  await api('/settings', { method: 'POST', body: { config: { coldOutreach: {
    enabled: $('#zEnabled').checked,
    dailyLimit: parseInt($('#zLimit').value) || 40,
    rampUp: $('#zRampUp').checked,
    startDaily: parseInt($('#zStartDaily').value) || 30,
    overwriteQualification: $('#zOverwrite').checked,
    message: $('#zMessage').value,
    likersAi: $('#zLikersAi').checked,
    sources: $('#zSources').value.split('\n').map(s => s.trim()).filter(Boolean),
    sourceAccounts: zSourceAccounts,
    qualifier: $('#zqAi').value, // kompatybilność ze starym polem
    qualification: {
      enabled: $('#zqEnabled').checked,
      aiQuestion: $('#zqAi').value,
      skipMen: $('#zqSkipMen').checked, skipWomen: $('#zqSkipWomen').checked,
      skipNoPhoto: $('#zqNoPhoto').checked, skipPrivate: $('#zqPrivate').checked, skipEmptyBio: $('#zqEmptyBio').checked,
      skipNoLink: $('#zqNoLink').checked, skipNoHighlights: $('#zqNoHighlights').checked, skipNoPosts: $('#zqNoPosts').checked,
      minFollowers: parseInt($('#zqMinF').value) || 0, maxFollowers: parseInt($('#zqMaxF').value) || 0, minPosts: parseInt($('#zqMinP').value) || 0,
      skipUncertain: $('#zqUncertain').checked, filterIncomingDm: $('#zqFilterDm').checked,
    },
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
    : '<div class="empty-state"><div class="es-ico">📦</div><div>Brak produktów</div><div class="es-act">Utwórz swój pierwszy produkt poniżej</div></div>';
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
    config: {
      quietHours: { enabled: $('#qhEnabled').checked, start: $('#qhStart').value, end: $('#qhEnd').value },
      responseTime: { min: parseInt($('#rtMin').value) || 0, max: parseInt($('#rtMax').value) || 0 },
      skipBigAccounts: $('#flEnabled').checked,
      followersLimit: { enabled: $('#flEnabled').checked, value: parseInt($('#flValue').value) || 10000 },
      blacklist,
      botControl: { autoReply: $('#bcAuto').checked, smartFollowups: $('#bcFollowups').checked, ignoreFollowing: $('#bcIgnoreFollowing').checked, responseDelays: $('#bcDelays').checked, handoffDetection: $('#bcHandoff').checked },
    },
  };
  const key = $('#apiKey').value.trim(); if (key) body.apiKey = key;
  await api('/settings', { method: 'POST', body }); $('#apiKey').value = ''; flash('#setSaved'); await loadSettings();
});

// ---------- Ustawienia: czasy, godziny ciszy, czarna lista, limit obserwujących ----------
let blacklist = [];
function updateRtLabels() { if ($('#rtMinL')) $('#rtMinL').textContent = $('#rtMin').value || '0'; if ($('#rtMaxL')) $('#rtMaxL').textContent = $('#rtMax').value || '0'; }
function updateFlLabel() { if ($('#flValLabel')) $('#flValLabel').textContent = (+($('#flValue').value) || 0).toLocaleString('pl-PL'); }
function updateQhDial() {
  const d = $('#qhDial'); if (!d) return;
  const toMin = t => { const [a, b] = (t || '0:0').split(':').map(Number); return a * 60 + (b || 0); };
  const s = toMin($('#qhStart').value || '23:30'), e = toMin($('#qhEnd').value || '06:30');
  const dur = (e - s + 1440) % 1440;
  const h = Math.round(dur / 60 * 10) / 10;
  if ($('#qhHours')) $('#qhHours').textContent = h + 'h';
  d.style.setProperty('--qh-deg', (dur / 1440 * 360) + 'deg');
}
function renderBlacklist() {
  const el = $('#blList'); if (!el) return;
  el.innerHTML = blacklist.length
    ? '<div class="list" style="margin-top:8px">' + blacklist.map((u, i) => `<div class="list-item"><div><b>${esc(u)}</b></div><button class="btn danger sm" data-bldel="${i}">usuń</button></div>`).join('') + '</div>'
    : '<div class="bl-empty">🚫 Nie dodano jeszcze żadnych użytkowników</div>';
  $$('#blList [data-bldel]').forEach(b => b.addEventListener('click', () => { blacklist.splice(+b.dataset.bldel, 1); renderBlacklist(); }));
}
if ($('#addBl')) $('#addBl').addEventListener('click', () => { const v = $('#blInput').value.trim().replace(/^@/, ''); if (!v) return; blacklist.push('@' + v); $('#blInput').value = ''; renderBlacklist(); });
$$('#rtMin, #rtMax').forEach(el => el.addEventListener('input', updateRtLabels));
$$('#qhStart, #qhEnd').forEach(el => el.addEventListener('input', updateQhDial));
if ($('#flValue')) $('#flValue').addEventListener('input', updateFlLabel);

// ---------- AI Helper + dzwonek ----------
if ($('#aiHelperBtn')) $('#aiHelperBtn').addEventListener('click', () => { const o = $('#tutorialOverlay'); if (o) o.classList.remove('hidden'); });
if ($('#bellBtn')) $('#bellBtn').addEventListener('click', () => alert('Brak nowych powiadomień 🙂'));

// ---------- karty połączeń (Integracje) + zakładki ----------
function renderConnCards(ig) {
  const el = $('#connCards'); if (!el) return;
  const connected = !!(ig && ig.enabled && ig.pageAccessTokenSet);
  const handle = (ig && ig.igUserId) ? '@' + ig.igUserId : 'Twoje konto Instagram';
  el.innerHTML =
    `<div class="conn-card"><div class="conn-ico ig">📷</div><div class="conn-main"><div class="conn-name">${connected ? esc(handle) : 'Instagram'} <span class="conn-badge ${connected ? 'ok' : 'no'}">${connected ? 'POŁĄCZONO' : 'NIE POŁĄCZONO'}</span></div><div class="conn-desc">${connected ? 'Setter obsługuje wiadomości na tym koncie' : 'Połącz konto, aby setter odpowiadał na DM-y'}</div></div>${connected ? '<button class="btn danger" data-conn="ig-off">Odłącz</button>' : '<button class="btn" data-go="instagram">Połącz</button>'}</div>`
    + `<div class="conn-card"><div class="conn-ico fb">f</div><div class="conn-main"><div class="conn-name">Facebook Messenger <span class="conn-badge no">NIE POŁĄCZONO</span></div><div class="conn-desc">Połącz stronę Facebook, aby odpowiadać na Messenger</div></div><button class="btn" data-conn="fb">Połącz Facebook</button></div>`;
  const off = $('#connCards [data-conn="ig-off"]'); if (off) off.addEventListener('click', async () => { await api('/settings', { method: 'POST', body: { instagram: { enabled: false } } }); await loadSettings(); });
  const fb = $('#connCards [data-conn="fb"]'); if (fb) fb.addEventListener('click', () => alert('Integracja Facebook Messenger, wkrótce. Najpierw podłączamy Instagram.'));
}
$$('#setTabs .tab').forEach(t => t.addEventListener('click', () => $$('#setTabs .tab').forEach(x => x.classList.toggle('active', x === t))));
$$('#dtabs .dtab').forEach(t => t.addEventListener('click', () => $$('#dtabs .dtab').forEach(x => x.classList.toggle('active', x === t))));

// ---------- Ustawienia Konta ----------
async function loadKonto() {
  try {
    const a = await api('/analytics'); const used = a.aiRequests || 0; const lim = 10000;
    if ($('#kontoReq')) $('#kontoReq').textContent = used.toLocaleString('pl-PL') + ' / ' + lim.toLocaleString('pl-PL');
    const pct = Math.min(100, Math.round(used / lim * 100));
    if ($('#kontoReqFill')) $('#kontoReqFill').style.width = pct + '%';
    if ($('#kontoReqPct')) $('#kontoReqPct').textContent = pct + '% miesięcznego limitu';
  } catch {}
  if (settings) { if ($('#kontoModel')) $('#kontoModel').textContent = settings.model || '—'; if ($('#kontoProv')) $('#kontoProv').textContent = settings.provider || '—'; }
}

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
function updateGamification() {
  const xp = getXp(); const lvl = Math.floor(xp / 10) + 1;
  $('#xpNum').textContent = xp; $('#lvlNum').textContent = lvl;
  const g = $('#lvlGoal');
  if (g) {
    if (lvl >= 12) g.innerHTML = '✅ poziom 12 osiągnięty, instrukcje zwykle gotowe na żywo';
    else { const left = (12 - lvl) * 10 - (xp % 10); g.innerHTML = 'do poziomu 12 jeszcze ~' + left + ' PD (ok. ' + left + ' wiadomości testowych)'; }
  }
  const pill = $('#lvlPill'); if (pill) pill.classList.toggle('ready', lvl >= 12);
}

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
  let head = '';
  if (conv.contactNote) head += `<div class="memo">🧠 <b>pamięć:</b> ${esc(conv.contactNote)}</div>`;
  if (conv.followups && conv.followups.length) head += `<div class="memo fu">⏰ <b>zaplanowane follow-upy:</b> ${conv.followups.map(esc).join(' · ')}</div>`;
  w.innerHTML = head + conv.messages.map((m, i) => msgHtml(m, i)).join('');
  w.scrollTop = w.scrollHeight; setStage(conv.stage);
  $$('#chatWindow [data-regen]').forEach(b => b.addEventListener('click', () => regenerateFrom(parseInt(b.dataset.regen))));
}
function msgHtml(m, i) {
  const s = m.role === 'assistant';
  // przycisk cofnięcia/regeneracji: setter -> usuń od tej wiadomości i wygeneruj ponownie; klient -> zostaw do tej i wygeneruj odpowiedź
  const keep = (typeof i === 'number') ? (s ? i : i + 1) : null;
  const btn = (keep !== null) ? `<button class="regen" data-regen="${keep}" title="cofnij tu i wygeneruj odpowiedź na nowo (jak ołówek w Setorze)">↻</button>` : '';
  return `<div class="msg ${s ? 'setter' : 'klient'}"><span class="who">${s ? 'setter' : 'klientka'}</span>${esc(m.text)}${btn}</div>`;
}
async function regenerateFrom(keep) {
  if (!currentConvId) return;
  showTyping();
  try { const conv = await api('/conversations/' + currentConvId + '/regenerate', { method: 'POST', body: { keep } }); renderChat(conv); }
  catch (e) { renderChatError(e); }
}
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
  const list = await api('/conversations');
  const up = list.filter(c => c.booked || c.stage === 'skonwertowany');
  const nostat = list.filter(c => !c.booked && c.stage !== 'skonwertowany' && c.stage !== 'dq' && c.stage !== 'semi_dq');
  const hist = list.filter(c => !c.booked && (c.stage === 'dq' || c.stage === 'semi_dq'));
  $('#crmBody').innerHTML =
    crmSection('up', 'Nadchodzące rozmowy', up) +
    crmSection('nostat', 'Leady bez statusu', nostat) +
    crmSection('hist', 'Historia rozmów', hist);
  $$('#crmBody tbody tr[data-id]').forEach(tr => tr.addEventListener('click', async () => { const conv = await api('/conversations/' + tr.dataset.id); currentConvId = conv.id; showView('testchat'); renderChat(conv); }));
}
function crmSection(cls, title, rows) {
  const cols = ['Instagram', 'Data', 'E-mail', 'Telefon', 'Link do rozmowy', 'Notatki', 'Produkt', 'Wartość', 'Status'];
  const head = `<div class="crm-sec ${cls}"><div class="crm-head">${esc(title)} <span class="cnt">(${rows.length})</span></div><div class="crm-tbl">`;
  if (!rows.length) return head + `<div class="crm-empty">Brak pozycji</div></div></div>`;
  const body = `<table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>` +
    rows.map(c => `<tr data-id="${c.id}">
      <td><b>@${esc(c.username)}</b></td>
      <td>${c.createdAt ? new Date(c.createdAt).toLocaleDateString('pl-PL') : '—'}</td>
      <td class="muted">—</td><td class="muted">—</td>
      <td>${c.booked ? 'followupagencja.com' : '<span class="muted">—</span>'}</td>
      <td class="muted">${esc((c.last || '').slice(0, 40))}</td>
      <td class="muted">—</td><td class="muted">—</td>
      <td><span class="badge ${c.stage}">${STAGE_LABEL[c.stage] || c.stage}</span></td>
    </tr>`).join('') + '</tbody></table>';
  return head + body + '</div></div>';
}

// ---------- analytics + panel ----------
async function loadAnalytics() {
  const a = await api('/analytics');
  $('#statCards').innerHTML = statCardsHtml(a);
  if ($('#attrCards')) $('#attrCards').innerHTML =
    `<div class="stat"><div class="num">0</div><div class="lbl">Punkty styku</div></div>`
    + `<div class="stat"><div class="num">0</div><div class="lbl">Aktywne źródła</div></div>`
    + `<div class="stat"><div class="num">—</div><div class="lbl">Najlepsze źródło</div></div>`
    + `<div class="stat"><div class="num">${a.conversion ?? 0}%</div><div class="lbl">Konwersja</div><div class="lbl" style="opacity:.7;margin-top:4px">${a.konwersje || 0} / ${a.total || 0}</div></div>`;
  if ($('#chart')) $('#chart').innerHTML = chartHtml(a.series);
  if ($('#convChart')) $('#convChart').innerHTML = convChartHtml(a.series);
  if ($('#newbieNote')) $('#newbieNote').innerHTML = a.newbiePeak
    ? '<div class="warn">📈 Wygląda na „pik nowicjusza”: konwersja na starcie jest sztucznie wysoka, bo najpierw odpisują najgorętsze leady. Spadnie do 50-70% i to będzie Twój realny poziom. To nie znaczy, że setter działa gorzej.</div>'
    : '';
  const order = ['zimny', 'cieply', 'goracy', 'skonwertowany', 'semi_dq', 'dq'];
  const max = Math.max(1, ...order.map(s => a.byStage[s] || 0));
  $('#funnel').innerHTML = order.map(s => { const n = a.byStage[s] || 0; return `<div class="fbar"><div class="flabel">${STAGE_LABEL[s]}</div><div class="ftrack"><div class="ffill" style="width:${(n / max) * 100}%"></div></div><div class="fcount">${n}</div></div>`; }).join('');
}
function statCardsHtml(a) {
  const card = (num, lbl, sub) => `<div class="stat"><div class="num">${num}</div><div class="lbl">${lbl}</div>${sub ? `<div class="lbl" style="margin-top:4px;opacity:.7">${sub}</div>` : ''}</div>`;
  return card(a.konwersje ?? 0, 'Konwersje')
    + card(a.responded ?? 0, 'Rozpoczęte', 'lead odpisał')
    + card((a.convFromResponded ?? 0) + '%', 'Konwersja', 'z rozpoczętych')
    + card(a.kontakty ?? 0, 'Kontakty')
    + card(a.obserwujacy ?? 'b/d', 'Obserwujący', 'wymaga IG')
    + card(a.wizyty ?? 'b/d', 'Wizyty profilu', 'wymaga IG');
}
function chartHtml(series) {
  if (!series || !series.length) return '';
  const max = Math.max(1, ...series.map(s => s.count));
  return `<div class="chart">${series.map(s => `<div class="chart-col" title="${s.day}: ${s.count} rozmów"><div class="chart-bar" style="height:${Math.max(2, Math.round(s.count / max * 100))}%"></div><div class="chart-x">${s.day.slice(0, 2)}</div></div>`).join('')}</div>`;
}
function convChartHtml(series) {
  if (!series || !series.length) return '';
  const max = Math.max(1, ...series.map(s => s.rate || 0));
  return `<div class="chart">${series.map(s => `<div class="chart-col" title="${s.day}: ${s.rate}% konwersji (${s.conv}/${s.count})"><div class="chart-bar conv" style="height:${Math.max(2, Math.round((s.rate || 0) / max * 100))}%"></div><div class="chart-x">${s.day.slice(0, 2)}</div></div>`).join('')}</div>`;
}
async function loadPanel() { const a = await api('/analytics'); $('#panelStats').innerHTML = statCardsHtml(a); }

// ---------- A/B testy ----------
let abData = null;
async function loadAb() { abData = await api('/ab'); renderAb(); }
function abCard(key, title, field, cfg, stats, winner, min) {
  const byId = Object.fromEntries((stats || []).map(s => [s.id, s]));
  const totalStarted = (stats || []).reduce((a, s) => a + (s.started || 0), 0);
  const anyButNotEnough = (stats || []).some(s => s.started > 0) && (stats || []).every(s => s.started < min);
  const vars = (cfg.variants || []).map(v => {
    const s = byId[v.id] || { started: 0, conv: 0 };
    const win = winner === v.id ? ' ⭐ zwycięzca' : '';
    const inputEl = field === 'instructions'
      ? `<textarea class="abv" data-k="${key}" data-id="${v.id}" data-f="instructions" rows="3" placeholder="instrukcje tego wariantu (puste = używa głównych instrukcji z Osoby)">${esc(v.instructions || '')}</textarea>`
      : `<input type="text" class="abv" data-k="${key}" data-id="${v.id}" data-f="content" value="${esc(v.content || '')}" />`;
    return `<div class="card" style="background:var(--panel2);margin:8px 0">
      <div class="row"><b>Wariant ${esc(v.label || v.id)}${win}</b>
        <span class="badge ${s.started >= min ? 'goracy' : 'zimny'}">rozpoczęte: ${s.started}/${min}</span>
        <span class="badge skonwertowany">konwersja: ${s.conv}%</span>
        <button class="btn danger sm" data-abdel="${key}:${v.id}">usuń</button></div>
      ${inputEl}
      <div class="row"><span class="muted small">ruch %</span><input type="number" min="0" max="100" class="abw" data-k="${key}" data-id="${v.id}" value="${v.weight || 0}" style="max-width:90px" /></div>
    </div>`;
  }).join('');
  const warn = anyButNotEnough ? `<div class="warn">⏳ Za mało danych. Zbierz min. ${min} <b>rozpoczętych</b> rozmów na wariant, zanim wyciągniesz wnioski (mniejsze liczby kłamią). Nie wyłączaj wariantu zbyt wcześnie.</div>` : '';
  const winLine = winner ? `<div class="ok-banner">⭐ Zwycięzca: wariant ${winner}. Teraz 80% ruchu na niego i jego delikatne warianty, 20% na nowy, szalony pomysł. <b>Co działa, nie ruszaj.</b></div>` : '';
  return `<div class="card"><div class="card-title">${title} <span class="muted small">· rozpoczętych łącznie: ${totalStarted}</span></div>
    <label class="radio"><input type="checkbox" class="aben" data-k="${key}" ${cfg.enabled ? 'checked' : ''}/> &nbsp;Włącz ten test (ruch rozdzielany automatycznie wg %)</label>
    ${warn}${winLine}
    ${vars}
    <div class="row"><button class="btn sm" data-abadd="${key}">+ dodaj wariant</button>${winner ? `<button class="btn sm" data-abdup="${key}">⭐ Duplikuj zwycięzcę (wariant wariantu)</button>` : ''}</div></div>`;
}
function renderAb() {
  const ab = abData.ab || {}, st = abData.stats || {}, min = st.minSample || 200;
  $('#abMin').textContent = min;
  const guide = `<div class="card guide">
    <div class="card-title">📏 Zasady testów A/B (z Akademii)</div>
    <ul class="tight">
      <li>Patrz na <b>rozpoczęte</b> rozmowy (odpowiedzi), nie na wysłane.</li>
      <li><b>200-300</b> rozpoczętych na wariant, zanim ocenisz. Wcześniej nie ruszaj.</li>
      <li>Wariant może mieć dobry % odpowiedzi, ale słabą konwersję na konsultację. Liczy się konwersja.</li>
      <li><b>80/20</b>: gros ruchu na zwycięzcę i jego warianty, część na nowe pomysły. Co działa, nie ruszaj.</li>
      <li>Wchodź tu <b>raz w tygodniu</b> (wpisz w kalendarz). Spadek % w czasie to norma (coraz zimniejsi obserwujący), nie wada.</li>
    </ul></div>`;
  $('#abBody').innerHTML = guide +
    abCard('openers', '✨ Openery A/B', 'content', ab.openers || { variants: [] }, st.openers, st.openerWinner, min) +
    abCard('script', '🧠 Skrypt A/B (cały proces)', 'instructions', ab.script || { variants: [] }, st.script, st.scriptWinner, min);
  $$('#abBody [data-abdel]').forEach(b => b.addEventListener('click', () => { const [k, id] = b.dataset.abdel.split(':'); abData.ab[k].variants = abData.ab[k].variants.filter(v => v.id !== id); saveAb(); }));
  $$('#abBody [data-abadd]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.abadd; collectAb(); const used = (abData.ab[k].variants || []).map(v => v.id); const id = 'ABCDEFGH'.split('').find(l => !used.includes(l)) || ('V' + used.length); abData.ab[k].variants.push({ id, label: id, weight: 0, content: '', instructions: '' }); saveAb(); }));
  $$('#abBody [data-abdup]').forEach(b => b.addEventListener('click', () => duplicateWinner(b.dataset.abdup)));
  $$('#abBody .aben, #abBody .abv, #abBody .abw').forEach(el => el.addEventListener('change', () => saveAb()));
}
// Duplikuj zwycięzcę: klon treści zwycięzcy do nowego wariantu, ustaw 80/20 (zwycięzca 80, klon 20, reszta 0)
function duplicateWinner(key) {
  collectAb();
  const st = abData.stats || {};
  const winId = key === 'openers' ? st.openerWinner : st.scriptWinner;
  const cfg = abData.ab[key]; if (!cfg || !winId) return;
  const win = (cfg.variants || []).find(v => v.id === winId); if (!win) return;
  const used = cfg.variants.map(v => v.id);
  const id = 'ABCDEFGHIJ'.split('').find(l => !used.includes(l)) || ('V' + used.length);
  cfg.variants.push({ id, label: id, weight: 20, content: win.content || '', instructions: win.instructions || '' });
  cfg.variants.forEach(v => { v.weight = v.id === winId ? 80 : (v.id === id ? 20 : 0); });
  cfg.enabled = true;
  saveAb().then(() => alert('Utworzono wariant ' + id + ' jako kopię zwycięzcy ' + winId + '. Wprowadź drobną zmianę (np. dodaj „???” albo serduszko) i obserwuj, czy przebije zwycięzcę. Ruch ustawiony 80/20.'));
}
function collectAb() {
  ['openers', 'script'].forEach(k => {
    const cfg = abData.ab[k]; if (!cfg) return;
    const en = $(`#abBody .aben[data-k="${k}"]`); if (en) cfg.enabled = en.checked;
    (cfg.variants || []).forEach(v => {
      const vi = $(`#abBody .abv[data-k="${k}"][data-id="${v.id}"]`);
      if (vi) { if (vi.dataset.f === 'instructions') v.instructions = vi.value; else v.content = vi.value; }
      const wi = $(`#abBody .abw[data-k="${k}"][data-id="${v.id}"]`);
      if (wi) v.weight = parseInt(wi.value) || 0;
    });
  });
}
async function saveAb() { collectAb(); const r = await api('/ab', { method: 'POST', body: { ab: abData.ab } }); if (r.stats) abData.stats = r.stats; renderAb(); }

// ---------- Automatyzacje (flows) ----------
let flowsData = null;
const NODE_TYPES = { welcome: '💬 Wiadomość powitalna', followers_check: '✅ Sprawdź obserwację', lead_magnet: '🎁 Wyślij lead magnet', delay: '⏲️ Opóźnienie', followup: '🔁 Follow-up', send_dm: '✉️ Wyślij DM' };
async function loadFlows() { flowsData = (await api('/flows')).flows || []; renderFlows(); }
function defaultNode(t) { if (t === 'welcome') return { type: t, message: '', button: 'CHCĘ TO' }; if (t === 'followers_check') return { type: t, ifNot: '' }; if (t === 'lead_magnet') return { type: t, resource: '' }; if (t === 'delay') return { type: t, hours: 2 }; return { type: t, message: '' }; }
function nodeHtml(n, fi, ni) {
  let body;
  if (n.type === 'welcome') body = `<textarea class="nd" data-fi="${fi}" data-ni="${ni}" data-f="message" rows="2" placeholder="wiadomość">${esc(n.message || '')}</textarea><input type="text" class="nd" data-fi="${fi}" data-ni="${ni}" data-f="button" placeholder="napis na przycisku" value="${esc(n.button || '')}"/>`;
  else if (n.type === 'followers_check') body = `<input type="text" class="nd" data-fi="${fi}" data-ni="${ni}" data-f="ifNot" placeholder="wiadomość gdy NIE obserwuje" value="${esc(n.ifNot || '')}"/>`;
  else if (n.type === 'lead_magnet') body = `<input type="text" class="nd" data-fi="${fi}" data-ni="${ni}" data-f="resource" placeholder="nazwa lead magnetu" value="${esc(n.resource || '')}"/>`;
  else if (n.type === 'delay') body = `<input type="number" class="nd" data-fi="${fi}" data-ni="${ni}" data-f="hours" value="${n.hours || 0}" style="max-width:110px"/> <span class="muted small">godzin</span>`;
  else body = `<textarea class="nd" data-fi="${fi}" data-ni="${ni}" data-f="message" rows="2" placeholder="treść">${esc(n.message || '')}</textarea>`;
  return `<div class="flow-node" style="text-align:left;min-width:auto;max-width:520px"><div class="row" style="margin:0 0 5px"><b>${NODE_TYPES[n.type] || n.type}</b><button class="btn danger sm" data-nddel="${fi}:${ni}" style="margin-left:auto">×</button></div>${body}</div>`;
}
function flowCardHtml(f, fi) {
  const nodes = (f.nodes || []).map((n, ni) => nodeHtml(n, fi, ni)).join('<div style="color:var(--muted);margin:2px 0 2px 14px">↓</div>');
  return `<div class="card">
    <div class="row"><input type="text" class="fl-name" data-fi="${fi}" value="${esc(f.name || '')}" style="font-weight:600;max-width:340px"/>
      <label class="radio"><input type="checkbox" class="fl-active" data-fi="${fi}" ${f.active ? 'checked' : ''}/> aktywny</label>
      <button class="btn sm" data-flexport="${fi}">Export</button>
      <button class="btn danger sm" data-fldel="${fi}">usuń flow</button></div>
    <div class="row"><span class="muted small">trigger</span>
      <select class="fl-trig" data-fi="${fi}"><option value="comment" ${f.trigger.type === 'comment' ? 'selected' : ''}>Komentarz pod postem</option><option value="dm_keyword" ${f.trigger.type === 'dm_keyword' ? 'selected' : ''}>Słowo kluczowe w DM</option></select>
      <input type="text" class="fl-kw" data-fi="${fi}" placeholder="słowo kluczowe (puste = wszystkie)" value="${esc(f.trigger.keyword || '')}" style="max-width:240px"/>
      <select class="fl-apply" data-fi="${fi}"><option value="all" ${(f.trigger.applyTo || 'all') === 'all' ? 'selected' : ''}>wszystkie posty</option><option value="next" ${f.trigger.applyTo === 'next' ? 'selected' : ''}>następny post</option><option value="specific" ${f.trigger.applyTo === 'specific' ? 'selected' : ''}>konkretny post</option></select></div>
    <div style="margin:12px 0">${nodes}</div>
    <div class="row"><select class="fl-addtype" data-fi="${fi}">${Object.entries(NODE_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><button class="btn sm" data-fladd="${fi}">+ dodaj krok</button></div>
  </div>`;
}
function renderFlows() {
  $('#flowsBody').innerHTML = (flowsData && flowsData.length) ? flowsData.map((f, fi) => flowCardHtml(f, fi)).join('') : '<p class="muted">Brak flow. Kliknij „Nowy flow".</p>';
  $$('#flowsBody [data-fldel]').forEach(b => b.addEventListener('click', () => { collectFlows(); flowsData.splice(+b.dataset.fldel, 1); saveFlows(); }));
  $$('#flowsBody [data-fladd]').forEach(b => b.addEventListener('click', () => { collectFlows(); const fi = +b.dataset.fladd; const t = $(`#flowsBody .fl-addtype[data-fi="${fi}"]`).value; flowsData[fi].nodes.push(defaultNode(t)); saveFlows(); }));
  $$('#flowsBody [data-nddel]').forEach(b => b.addEventListener('click', () => { collectFlows(); const [fi, ni] = b.dataset.nddel.split(':').map(Number); flowsData[fi].nodes.splice(ni, 1); saveFlows(); }));
  $$('#flowsBody [data-flexport]').forEach(b => b.addEventListener('click', () => { collectFlows(); exportFlow(flowsData[+b.dataset.flexport]); }));
  $$('#flowsBody .fl-name, #flowsBody .fl-active, #flowsBody .fl-trig, #flowsBody .fl-kw, #flowsBody .fl-apply, #flowsBody .nd').forEach(el => el.addEventListener('change', saveFlows));
}
function collectFlows() {
  if (!flowsData) return;
  flowsData.forEach((f, fi) => {
    const nm = $(`#flowsBody .fl-name[data-fi="${fi}"]`); if (nm) f.name = nm.value;
    const ac = $(`#flowsBody .fl-active[data-fi="${fi}"]`); if (ac) f.active = ac.checked;
    const tt = $(`#flowsBody .fl-trig[data-fi="${fi}"]`); if (tt) f.trigger.type = tt.value;
    const kw = $(`#flowsBody .fl-kw[data-fi="${fi}"]`); if (kw) f.trigger.keyword = kw.value;
    const ap = $(`#flowsBody .fl-apply[data-fi="${fi}"]`); if (ap) f.trigger.applyTo = ap.value;
    (f.nodes || []).forEach((n, ni) => { $$(`#flowsBody .nd[data-fi="${fi}"][data-ni="${ni}"]`).forEach(el => { n[el.dataset.f] = el.type === 'number' ? (parseInt(el.value) || 0) : el.value; }); });
  });
}
async function saveFlows() { collectFlows(); await api('/flows', { method: 'POST', body: { flows: flowsData } }); renderFlows(); }
function exportFlow(f) { const blob = new Blob([JSON.stringify(f, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (f.name || 'flow') + '.json'; a.click(); }
$('#newFlow').addEventListener('click', () => { if (!flowsData) flowsData = []; else collectFlows(); flowsData.push({ id: 'f' + Date.now(), name: 'Nowy flow', active: false, trigger: { type: 'comment', keyword: '' }, nodes: [defaultNode('welcome')] }); saveFlows(); });
$('#importFlow').addEventListener('click', () => { const t = prompt('Wklej JSON flow:'); if (!t) return; try { const f = JSON.parse(t); if (!flowsData) flowsData = []; flowsData.push(f); saveFlows(); } catch (e) { alert('Niepoprawny JSON'); } });
// Szablon Lead Magnet (wg wideo odc 9, ścieżka trenera, dopasowana do gabinetu)
function leadMagnetTemplate() {
  return {
    id: 'f' + Date.now(), name: 'Lead Magnet (przewodnik dla gabinetu)', active: false,
    trigger: { type: 'comment', keyword: 'przewodnik', applyTo: 'all' },
    nodes: [
      { type: 'welcome', message: 'cześć 🙂 kliknij przycisk, żeby dostać przewodnik jak zapełnić grafik gabinetu. pamiętaj, musisz obserwować konto, żeby dostać dostęp', button: 'CHCĘ TO' },
      { type: 'followers_check', ifNot: 'zaobserwuj proszę konto, żeby dostać przewodnik, i kliknij ponownie' },
      { type: 'lead_magnet', resource: 'Darmowy przewodnik: Jak zapełnić grafik gabinetu w 30 dni' },
      { type: 'send_dm', message: 'swoją drogą, jak u ciebie teraz z obłożeniem grafiku?' },
      { type: 'delay', hours: 2 },
      { type: 'followup', message: 'cześć, doszła moja wiadomość?' },
      { type: 'delay', hours: 4 },
      { type: 'followup', message: '??' },
    ],
  };
}
if ($('#tplFlow')) $('#tplFlow').addEventListener('click', () => { if (!flowsData) flowsData = []; else collectFlows(); flowsData.push(leadMagnetTemplate()); saveFlows(); });

// ---------- Historia Live (instrukcje + wersje) ----------
async function loadLive() {
  const d = await api('/live');
  if ($('#liveInstr')) $('#liveInstr').value = d.instructions || '';
  renderLiveHistory(d.versions || []);
}
function renderLiveHistory(versions) {
  if (!$('#liveHistory')) return;
  $('#liveHistory').innerHTML = (versions && versions.length)
    ? versions.map(v => `<div class="list-item"><div class="li-main"><div>${new Date(v.ts).toLocaleString('pl-PL')}</div><div class="li-last">${esc(v.preview)}…</div></div><button class="btn sm" data-restore="${v.ts}">przywróć</button></div>`).join('')
    : '<p class="muted small">Brak zapisanych wersji. Kliknij „Zapisz na Live".</p>';
  $$('#liveHistory [data-restore]').forEach(b => b.addEventListener('click', async () => { const d = await api('/live/restore', { method: 'POST', body: { ts: Number(b.dataset.restore) } }); if ($('#liveInstr')) $('#liveInstr').value = d.instructions || ''; renderLiveHistory(d.versions || []); }));
}
if ($('#saveLive')) $('#saveLive').addEventListener('click', async () => { const d = await api('/live', { method: 'POST', body: { instructions: $('#liveInstr').value } }); renderLiveHistory(d.versions || []); flash('#liveSaved'); });

// ---------- init ----------
loadSettings().then(loadPanel).catch(e => { $('#statusText').textContent = 'błąd: ' + e.message; });
