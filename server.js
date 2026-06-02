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
      verifyToken: (s.instagram && s.instagram.verifyToken) || '',
      commentKeyword: (s.instagram && s.instagram.commentKeyword) || '',
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
