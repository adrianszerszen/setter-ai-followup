import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as store from './store.js';
import { generateReply, analyzeConversation, noLongDashes } from './engine.js';
import * as ig from './instagram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, 'public')));

function apiErrStatus(e) { return e.message === 'NO_API_KEY' ? 400 : 502; }
function apiErrMsg(e) {
  return e.message === 'NO_API_KEY'
    ? 'Brak klucza API — dodaj go w zakładce Ustawienia.'
    : 'Błąd modelu AI: ' + e.message;
}

const memo = c => (c && c.contactNote) ? '\n\n# pamięć o tym kontakcie (z wcześniejszych wiadomości):\n' + c.contactNote : '';

async function analyzeAndSave(settings, id) {
  try {
    const a = await analyzeConversation(settings, store.getConversation(id));
    if (a) store.updateConversation(id, { stage: a.stage, booked: a.booked, contactNote: a.note, followups: a.followups });
  } catch {}
}

// ---- USTAWIENIA ----
app.get('/api/settings', (req, res) => {
  const s = store.getSettings();
  res.json({
    provider: s.provider, model: s.model, maxTokens: s.maxTokens,
    bookingLink: s.bookingLink, instructions: s.instructions, openers: s.openers,
    apiKeySet: !!s.apiKey,
    persona: s.persona || {},
    config: s.config || {},
    instagram: {
      enabled: !!(s.instagram && s.instagram.enabled),
      igUserId: (s.instagram && s.instagram.igUserId) || '',
      igUsername: (s.instagram && s.instagram.igUsername) || '',
      targetIgUsername: (s.instagram && s.instagram.targetIgUsername) || '',
      verifyToken: (s.instagram && s.instagram.verifyToken) || '',
      commentKeyword: (s.instagram && s.instagram.commentKeyword) || '',
      appId: (s.instagram && s.instagram.appId) || '',
      configId: (s.instagram && s.instagram.configId) || '',
      pageAccessTokenSet: !!(s.instagram && s.instagram.pageAccessToken),
      appSecretSet: !!(s.instagram && s.instagram.appSecret),
    },
  });
});
app.post('/api/settings', (req, res) => {
  const s = store.updateSettings(req.body || {});
  res.json({ ok: true, apiKeySet: !!s.apiKey });
});

// ---- ROZMOWY ----
app.get('/api/conversations', (req, res) => res.json(store.listConversations()));
app.get('/api/conversations/:id', (req, res) => {
  const c = store.getConversation(req.params.id);
  if (!c) return res.status(404).json({ error: 'nie znaleziono' });
  res.json(c);
});
app.delete('/api/conversations/:id', (req, res) => {
  store.deleteConversation(req.params.id);
  res.json({ ok: true });
});

app.post('/api/conversations', async (req, res) => {
  const { opener, leadFirstMessage, username } = req.body || {};
  const settings = store.getSettings();
  const ab = (settings.config && settings.config.ab) || {};
  let chosenOpener = opener, abOpener = null, abScript = null;
  if (ab.openers && ab.openers.enabled) { const v = store.pickVariant(ab.openers.variants); if (v) { chosenOpener = v.content; abOpener = v.id; } }
  if (ab.script && ab.script.enabled) { const v = store.pickVariant(ab.script.variants); if (v) abScript = v.id; }
  const messages = [];
  if (chosenOpener) messages.push({ role: 'assistant', text: noLongDashes(chosenOpener) });
  if (leadFirstMessage) messages.push({ role: 'user', text: leadFirstMessage });
  const conv = store.createConversation({ source: 'test', username: username || 'klientka_test', messages });
  store.updateConversation(conv.id, { abOpener, abScript });
  if (conv.messages.length && conv.messages[conv.messages.length - 1].role === 'user') {
    try {
      const reply = await generateReply({
        provider: settings.provider, apiKey: settings.apiKey, model: settings.model,
        maxTokens: settings.maxTokens, systemPrompt: store.systemPrompt(conv) + memo(conv), messages: conv.messages,
      });
      store.addMessage(conv.id, 'assistant', noLongDashes(reply));
    } catch (e) {
      return res.status(apiErrStatus(e)).json({ error: apiErrMsg(e), conversation: store.getConversation(conv.id) });
    }
    await analyzeAndSave(settings, conv.id);
  }
  res.json(store.getConversation(conv.id));
});

app.post('/api/conversations/:id/message', async (req, res) => {
  const conv = store.getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: 'nie znaleziono' });
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'pusta wiadomość' });
  store.addMessage(conv.id, 'user', text);
  const settings = store.getSettings();
  let reply;
  try {
    reply = await generateReply({
      provider: settings.provider, apiKey: settings.apiKey, model: settings.model,
      maxTokens: settings.maxTokens, systemPrompt: store.systemPrompt(conv) + memo(conv),
      messages: store.getConversation(conv.id).messages,
    });
  } catch (e) {
    return res.status(apiErrStatus(e)).json({ error: apiErrMsg(e), conversation: store.getConversation(conv.id) });
  }
  store.addMessage(conv.id, 'assistant', reply);
  await analyzeAndSave(settings, conv.id);
  res.json(store.getConversation(conv.id));
});

// ---- COFNIJ + WYGENERUJ PONOWNIE (pencil/regenerate jak w Setorze) ----
// body: { keep: N }  -> zostawia N pierwszych wiadomości; jeśli ostatnia jest od leada, generuje nową odpowiedź settera
app.post('/api/conversations/:id/regenerate', async (req, res) => {
  const conv0 = store.getConversation(req.params.id);
  if (!conv0) return res.status(404).json({ error: 'nie znaleziono' });
  const keep = Math.max(0, parseInt(req.body && req.body.keep) || 0);
  store.truncateConversation(conv0.id, keep);
  let conv = store.getConversation(conv0.id);
  const last = conv.messages[conv.messages.length - 1];
  if (last && last.role === 'user') {
    const settings = store.getSettings();
    let reply;
    try {
      reply = await generateReply({
        provider: settings.provider, apiKey: settings.apiKey, model: settings.model,
        maxTokens: settings.maxTokens, systemPrompt: store.systemPrompt(conv) + memo(conv),
        messages: conv.messages,
      });
    } catch (e) {
      return res.status(apiErrStatus(e)).json({ error: apiErrMsg(e), conversation: store.getConversation(conv.id) });
    }
    store.addMessage(conv.id, 'assistant', noLongDashes(reply));
    await analyzeAndSave(settings, conv.id);
  }
  res.json(store.getConversation(conv.id));
});

// ---- ANALITYKA ----
app.get('/api/analytics', (req, res) => res.json(store.analytics()));

// ---- INSTAGRAM INSIGHTS (realne liczby z konta przez Graph API) ----
app.get('/api/instagram/insights', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(90, parseInt(req.query.days) || 30));
    res.json(await ig.fetchInsights(days));
  } catch (e) {
    res.json({ connected: false, error: e.message });
  }
});

// ---- A/B TESTY ----
app.get('/api/ab', (req, res) => {
  const s = store.getSettings();
  res.json({ ab: (s.config && s.config.ab) || {}, stats: store.abStats() });
});
app.post('/api/ab', (req, res) => {
  if (req.body && req.body.ab) store.updateSettings({ config: { ab: req.body.ab } });
  res.json({ ok: true, stats: store.abStats() });
});

// ---- HISTORIA LIVE (instrukcje + wersje) ----
app.get('/api/live', (req, res) => res.json(store.getLive()));
app.post('/api/live', (req, res) => res.json(store.saveLive((req.body && req.body.instructions) || '')));
app.post('/api/live/restore', (req, res) => res.json(store.restoreLive(req.body && req.body.ts)));

// ---- AUTOMATYZACJE (flows) ----
app.get('/api/flows', (req, res) => {
  const s = store.getSettings();
  res.json({ flows: (s.config && s.config.flows) || [] });
});
app.post('/api/flows', (req, res) => {
  store.updateSettings({ config: { flows: Array.isArray(req.body.flows) ? req.body.flows : [] } });
  res.json({ ok: true });
});
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- LOGOWANIE META (oficjalny Facebook Login dla Instagrama) ----
function publicBase(req) { return process.env.PUBLIC_URL || ('https://' + (req.headers['x-forwarded-host'] || req.headers.host)); }
function authPage(title, msg) {
  return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Inter,system-ui,sans-serif;background:#0a0a0a;color:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px"><div style="max-width:560px;padding:32px;border:1px solid #333;border-radius:16px"><h2 style="margin:0 0 10px">' + title + '</h2><p style="color:#aaa;line-height:1.6">' + msg + '</p><a href="/" style="color:#5b9dff;text-decoration:none">&larr; wróć do panelu</a></div>';
}
app.get('/auth/facebook', (req, res) => {
  const ig = store.getInstagram();
  if (!ig.appId) return res.send(authPage('Najpierw skonfiguruj aplikację Meta', 'Aby zalogować się przez Facebooka, potrzebny jest App ID Twojej aplikacji Meta (z developers.facebook.com). Wklej App ID oraz App Secret w panelu (zakładka Instagram), zapisz i kliknij ponownie. To wymóg Meta: bez własnej aplikacji logowanie nie ruszy.'));
  const redirect = publicBase(req) + '/auth/facebook/callback';
  const base = 'https://www.facebook.com/v21.0/dialog/oauth?client_id=' + encodeURIComponent(ig.appId) + '&redirect_uri=' + encodeURIComponent(redirect) + '&response_type=code';
  // Aplikacja typu "Facebook Login dla firm" wymaga config_id (uprawnienia są zaszyte w Konfiguracji po stronie Meta).
  // Gdy configId nie jest ustawione, używamy klasycznego scope (zwykłe Facebook Login) jako fallback.
  const url = ig.configId
    ? base + '&config_id=' + encodeURIComponent(ig.configId)
    : base + '&scope=' + encodeURIComponent(['instagram_basic', 'instagram_manage_messages', 'pages_show_list', 'pages_messaging', 'business_management'].join(','));
  res.redirect(url);
});
app.get('/auth/facebook/callback', async (req, res) => {
  const ig = store.getInstagram();
  const code = req.query.code;
  if (req.query.error) return res.redirect('/?ig=denied');
  if (!code || !ig.appId || !ig.appSecret) return res.redirect('/?ig=error');
  try {
    const redirect = publicBase(req) + '/auth/facebook/callback';
    const tRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token?client_id=' + encodeURIComponent(ig.appId) + '&redirect_uri=' + encodeURIComponent(redirect) + '&client_secret=' + encodeURIComponent(ig.appSecret) + '&code=' + encodeURIComponent(code));
    const t = await tRes.json();
    if (!t.access_token) return res.redirect('/?ig=error');
    let userToken = t.access_token;
    try {
      const llRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=' + encodeURIComponent(ig.appId) + '&client_secret=' + encodeURIComponent(ig.appSecret) + '&fb_exchange_token=' + encodeURIComponent(t.access_token));
      const ll = await llRes.json(); if (ll.access_token) userToken = ll.access_token;
    } catch {}
    const pRes = await fetch('https://graph.facebook.com/v21.0/me/accounts?fields=name,access_token,instagram_business_account{id,username}&access_token=' + encodeURIComponent(userToken));
    const p = await pRes.json();
    const pages = (p.data || []).filter(x => x.instagram_business_account);
    if (!pages.length) return res.redirect('/?ig=nopage');
    // Wybierz konkretne konto IG (domyślnie adrian.szerszen), a nie pierwsze z brzegu —
    // u kogoś z wieloma podpiętymi kontami "pierwsze z brzegu" bywa cudze (np. klienta).
    const target = (ig.targetIgUsername || '').toLowerCase().trim();
    let page = target ? pages.find(x => ((x.instagram_business_account.username || '').toLowerCase() === target)) : null;
    if (!page) page = pages[0];
    const iba = page.instagram_business_account;
    store.updateSettings({ instagram: { enabled: true, igUserId: iba.id, igUsername: iba.username || '', pageAccessToken: page.access_token } });
    res.redirect('/?ig=connected');
  } catch (e) { res.redirect('/?ig=error'); }
});

// ---- WEBHOOK INSTAGRAM ----
app.get('/webhook', (req, res) => ig.verifyWebhook(req, res));
app.post('/webhook', async (req, res) => {
  if (!ig.verifySignature(req)) return res.sendStatus(403);
  res.sendStatus(200); // potwierdź szybko, przetwarzaj w tle
  try { await ig.handleWebhook(req.body); } catch (e) { console.error('webhook:', e.message); }
});

const PORT = process.env.PORT || 3000;
store.load();
app.listen(PORT, () => {
  console.log('\n  ✅ Setter AI – FollowUP działa');
  console.log('  👉 Otwórz w przeglądarce: http://localhost:' + PORT + '\n');
});
