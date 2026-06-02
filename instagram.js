// Integracja z Instagramem (oficjalne API Meta / Graph API).
// Obsługuje: weryfikację webhooka, podpis, odbiór wiadomości i komentarzy,
// wysyłkę DM oraz odpowiedź prywatną na komentarz (Private Replies).
import crypto from 'crypto';
import * as store from './store.js';
import { generateReply, classifyStage } from './engine.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

// ---- Weryfikacja webhooka (GET /webhook) ----
export function verifyWebhook(req, res) {
  const ig = store.getInstagram();
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && ig.verifyToken && token === ig.verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

// ---- Weryfikacja podpisu (POST /webhook) ----
export function verifySignature(req) {
  const ig = store.getInstagram();
  if (!ig.appSecret) return true; // brak sekretu = tryb dev (pomijamy)
  const sig = req.get('x-hub-signature-256');
  if (!sig || !req.rawBody) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', ig.appSecret).update(req.rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ---- Wysyłka DM ----
export async function sendMessage(recipientId, text) {
  const ig = store.getInstagram();
  if (!ig.pageAccessToken || !ig.igUserId) throw new Error('Brak konfiguracji IG (token/igUserId).');
  const res = await fetch(`${GRAPH}/${ig.igUserId}/messages?access_token=${encodeURIComponent(ig.pageAccessToken)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  if (!res.ok) throw new Error('IG send ' + res.status + ': ' + (await res.text()).slice(0, 300));
  return res.json();
}

// ---- Odpowiedź prywatna na komentarz ----
export async function privateReplyToComment(commentId, text) {
  const ig = store.getInstagram();
  if (!ig.pageAccessToken || !ig.igUserId) throw new Error('Brak konfiguracji IG (token/igUserId).');
  const res = await fetch(`${GRAPH}/${ig.igUserId}/messages?access_token=${encodeURIComponent(ig.pageAccessToken)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
  });
  if (!res.ok) throw new Error('IG private reply ' + res.status + ': ' + (await res.text()).slice(0, 300));
  return res.json();
}

// ---- Główna obsługa zdarzeń webhooka ----
export async function handleWebhook(body) {
  if (!body || !Array.isArray(body.entry)) return;
  for (const entry of body.entry) {
    for (const ev of entry.messaging || []) {
      const sender = ev.sender && ev.sender.id;
      if (!sender) continue;
      if (ev.message && ev.message.text && !ev.message.is_echo) {
        await onInboundMessage(sender, ev.message.text);
      }
    }
    for (const ch of entry.changes || []) {
      if (ch.field === 'comments' && ch.value) await onComment(ch.value);
    }
  }
}

function findConv(igSenderId) {
  return store.load().conversations.find(c => c.source === 'instagram' && c.igUser === igSenderId) || null;
}

async function onInboundMessage(sender, text) {
  const settings = store.getSettings();
  let conv = findConv(sender);
  if (!conv) {
    conv = store.createConversation({ source: 'instagram', username: 'ig:' + sender });
    store.updateConversation(conv.id, { igUser: sender });
  }
  store.addMessage(conv.id, 'user', text);
  let reply;
  try {
    reply = await generateReply({
      provider: settings.provider, apiKey: settings.apiKey, model: settings.model,
      maxTokens: settings.maxTokens, systemPrompt: settings.instructions,
      messages: store.getConversation(conv.id).messages,
    });
  } catch (e) {
    console.error('  ⚠️ engine:', e.message);
    return;
  }
  store.addMessage(conv.id, 'assistant', reply);
  try {
    await sendMessage(sender, reply);
  } catch (e) {
    console.error('  ⚠️ wysyłka IG:', e.message);
  }
  try {
    const cls = await classifyStage(settings, store.getConversation(conv.id));
    if (cls) store.updateConversation(conv.id, { stage: cls.stage, booked: cls.booked });
  } catch {}
}

async function onComment(value) {
  const ig = store.getInstagram();
  const keyword = (ig.commentKeyword || '').toLowerCase().trim();
  const text = (value.text || '').toLowerCase();
  if (!keyword || !text.includes(keyword)) return;
  const commentId = value.id;
  // Najpierw zaczepka (nie link!) — zgodnie z zasadą z kursu: najpierw reakcja, potem rozmowa.
  const dm = 'jesteś? widziałem twój komentarz 🙂';
  try {
    await privateReplyToComment(commentId, dm);
  } catch (e) {
    console.error('  ⚠️ private reply:', e.message);
  }
}
