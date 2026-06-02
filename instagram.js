// Integracja z Instagramem (oficjalne API Meta / Graph API).
// Obsługuje: weryfikację webhooka, podpis, odbiór wiadomości i komentarzy,
// wysyłkę DM oraz odpowiedź prywatną na komentarz (Private Replies).
import crypto from 'crypto';
import * as store from './store.js';
import { generateReply, analyzeConversation, noLongDashes } from './engine.js';

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
      maxTokens: settings.maxTokens,
      systemPrompt: store.systemPrompt() + (store.getConversation(conv.id).contactNote ? '\n\n# pamięć o tym kontakcie:\n' + store.getConversation(conv.id).contactNote : ''),
      messages: store.getConversation(conv.id).messages,
    });
  } catch (e) {
    console.error('  ⚠️ engine:', e.message);
    return;
  }
  const clean = noLongDashes(reply);
  store.addMessage(conv.id, 'assistant', clean);
  try {
    await sendMessage(sender, clean);
  } catch (e) {
    console.error('  ⚠️ wysyłka IG:', e.message);
  }
  try {
    const a = await analyzeConversation(settings, store.getConversation(conv.id));
    if (a) store.updateConversation(conv.id, { stage: a.stage, booked: a.booked, contactNote: a.note, followups: a.followups });
  } catch {}
}

async function onComment(value) {
  const ig = store.getInstagram();
  const keyword = (ig.commentKeyword || '').toLowerCase().trim();
  const text = (value.text || '').toLowerCase();
  if (!keyword || !text.includes(keyword)) return;
  const commentId = value.id;
  // Najpierw zaczepka (nie link!) — zgodnie z zasadą z kursu: najpierw reakcja, potem rozmowa.
  const dm = noLongDashes(ig.commentDm || 'jesteś? widziałem twój komentarz 🙂');
  try {
    await privateReplyToComment(commentId, dm);
  } catch (e) {
    console.error('  ⚠️ private reply:', e.message);
  }
}

// ---- Instagram Insights (realne liczby z konta) ----
// Pobiera obserwujących + metryki zasięgu/zaangażowania z ostatnich N dni przez Graph API.
// Każda metryka osobno, z łapaniem błędów, żeby błąd jednej nie wywalił reszty
// (część metryk wymaga metric_type=total_value, część bywa niedostępna dla małych/nowych kont).
export async function fetchInsights(days = 30) {
  const ig = store.getInstagram();
  if (!ig.enabled || !ig.igUserId || !ig.pageAccessToken) return { connected: false };
  const id = ig.igUserId, token = ig.pageAccessToken, enc = encodeURIComponent;
  const out = {
    connected: true, username: null,
    followers: null, mediaCount: null,
    reach: null, impressions: null, profileViews: null, websiteClicks: null,
    likes: null, comments: null, shares: null, saved: null, replies: null,
    totalInteractions: null, accountsEngaged: null,
    _debug: {},
  };
  const gget = async (url) => { const r = await fetch(url); return r.json(); };

  // 1) Podstawy konta — najbardziej niezawodne (obserwujący + liczba postów)
  try {
    const j = await gget(`${GRAPH}/${id}?fields=username,followers_count,media_count&access_token=${enc(token)}`);
    if (j.error) out._debug.account = j.error.message;
    if (j.username) out.username = j.username;
    if (j.followers_count != null) out.followers = j.followers_count;
    if (j.media_count != null) out.mediaCount = j.media_count;
  } catch (e) { out._debug.account = e.message; }

  // 2) Metryki czasowe (ostatnie N dni) — w większości wymagają metric_type=total_value
  const until = Math.floor(Date.now() / 1000);
  const since = until - days * 86400;
  const metrics = [
    ['reach', 'reach'], ['profile_views', 'profileViews'], ['website_clicks', 'websiteClicks'],
    ['accounts_engaged', 'accountsEngaged'], ['total_interactions', 'totalInteractions'],
    ['likes', 'likes'], ['comments', 'comments'], ['shares', 'shares'],
    ['saves', 'saved'], ['replies', 'replies'], ['views', 'impressions'], ['impressions', 'impressions'],
  ];
  await Promise.all(metrics.map(async ([metric, key]) => {
    try {
      const j = await gget(`${GRAPH}/${id}/insights?metric=${metric}&metric_type=total_value&period=day&since=${since}&until=${until}&access_token=${enc(token)}`);
      if (j.error) { out._debug[metric] = j.error.message; return; }
      const d = j.data && j.data[0];
      let val = null;
      if (d && d.total_value && d.total_value.value != null) val = d.total_value.value;
      else if (d && Array.isArray(d.values)) val = d.values.reduce((s, v) => s + (v.value || 0), 0);
      if (val != null && out[key] == null) out[key] = val;
    } catch (e) { out._debug[metric] = e.message; }
  }));
  return out;
}
