import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as store from './store.js';
import { generateReply, classifyStage } from './engine.js';
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

async function classifyAndSave(settings, id) {
  try {
    const cls = await classifyStage(settings, store.getConversation(id));
    if (cls) store.updateConversation(id, { stage: cls.stage, booked: cls.booked });
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
  const messages = [];
  if (opener) messages.push({ role: 'assistant', text: opener });
  if (leadFirstMessage) messages.push({ role: 'user', text: leadFirstMessage });
  const conv = store.createConversation({ source: 'test', username: username || 'klientka_test', messages });
  const settings = store.getSettings();
  if (conv.messages.length && conv.messages[conv.messages.length - 1].role === 'user') {
    try {
      const reply = await generateReply({
        provider: settings.provider, apiKey: settings.apiKey, model: settings.model,
        maxTokens: settings.maxTokens, systemPrompt: store.systemPrompt(), messages: conv.messages,
      });
      store.addMessage(conv.id, 'assistant', reply);
    } catch (e) {
      return res.status(apiErrStatus(e)).json({ error: apiErrMsg(e), conversation: store.getConversation(conv.id) });
    }
    await classifyAndSave(settings, conv.id);
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
      maxTokens: settings.maxTokens, systemPrompt: store.systemPrompt(),
      messages: store.getConversation(conv.id).messages,
    });
  } catch (e) {
    return res.status(apiErrStatus(e)).json({ error: apiErrMsg(e), conversation: store.getConversation(conv.id) });
  }
  store.addMessage(conv.id, 'assistant', reply);
  await classifyAndSave(settings, conv.id);
  res.json(store.getConversation(conv.id));
});

// ---- ANALITYKA ----
app.get('/api/analytics', (req, res) => res.json(store.analytics()));
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
