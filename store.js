// Prosty magazyn danych w pliku JSON (bez bazy / bez zależności natywnych).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function readDefaultInstructions() {
  const home = process.env.HOME || '';
  const candidates = [
    path.join(home, 'Desktop/setter-ai/PROMPT-setter-followup.md'),
    path.join(__dirname, 'default-instructions.md'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8'); } catch {}
  }
  return '# styl\npisz krótko, z małych liter, naturalnie, bez ścian tekstu\n\n# poczatek rozmowy\nwywołaj reakcję, potem zadaj jedno pytanie discovery';
}

function defaultSettings() {
  return {
    provider: 'anthropic',
    apiKey: '',
    model: 'claude-sonnet-4-6',
    maxTokens: 320,
    bookingLink: 'followupagencja.com',
    instructions: readDefaultInstructions(),
    openers: [
      'jesteś?',
      'mogę o coś zapytać?',
      'mogę być szczery?',
      'mogę mieć feedback do twojego gabinetu?',
      'widzę gabinet, mogę o coś spytać?',
      'mam pytanie 🙂',
    ],
    instagram: {
      enabled: false,
      verifyToken: '',
      pageAccessToken: '',
      igUserId: '',
      appSecret: '',
      commentKeyword: 'oferta',
    },
  };
}

export function load() {
  if (db) return db;
  ensureDir();
  if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { db = null; }
  }
  if (!db) db = { settings: defaultSettings(), conversations: [] };
  if (!db.settings) db.settings = defaultSettings();
  if (!db.conversations) db.conversations = [];
  // dopełnij brakujące pola ustawień (gdy aktualizujemy aplikację)
  const d = defaultSettings();
  for (const k of Object.keys(d)) if (db.settings[k] === undefined) db.settings[k] = d[k];
  // produkcyjny fallback ze zmiennych środowiskowych (hosting bez trwałego dysku)
  if (process.env.AI_API_KEY && !db.settings.apiKey) db.settings.apiKey = process.env.AI_API_KEY;
  if (process.env.AI_PROVIDER) db.settings.provider = process.env.AI_PROVIDER;
  if (process.env.AI_MODEL) db.settings.model = process.env.AI_MODEL;
  save();
  return db;
}

export function save() {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function getSettings() { return load().settings; }

export function getInstagram() {
  const s = load().settings;
  if (!s.instagram) s.instagram = { enabled: false, verifyToken: '', pageAccessToken: '', igUserId: '', appSecret: '', commentKeyword: 'oferta' };
  return s.instagram;
}

export function updateSettings(patch) {
  const s = load().settings;
  for (const k of ['provider', 'model', 'maxTokens', 'bookingLink', 'instructions', 'openers']) {
    if (patch[k] !== undefined) s[k] = patch[k];
  }
  // klucz API zapisujemy tylko jeśli podano niepusty (żeby nie kasować przy edycji innych pól)
  if (typeof patch.apiKey === 'string' && patch.apiKey.trim() !== '') s.apiKey = patch.apiKey.trim();
  if (patch.clearApiKey === true) s.apiKey = '';
  if (patch.instagram && typeof patch.instagram === 'object') {
    if (!s.instagram) s.instagram = {};
    for (const k of ['enabled', 'verifyToken', 'igUserId', 'commentKeyword']) {
      if (patch.instagram[k] !== undefined) s.instagram[k] = patch.instagram[k];
    }
    if (typeof patch.instagram.pageAccessToken === 'string' && patch.instagram.pageAccessToken.trim() !== '') s.instagram.pageAccessToken = patch.instagram.pageAccessToken.trim();
    if (typeof patch.instagram.appSecret === 'string' && patch.instagram.appSecret.trim() !== '') s.instagram.appSecret = patch.instagram.appSecret.trim();
  }
  save();
  return s;
}

export function listConversations() {
  return load().conversations
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(c => ({
      id: c.id,
      username: c.username,
      source: c.source,
      stage: c.stage,
      booked: c.booked,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      count: c.messages.length,
      last: c.messages.length ? c.messages[c.messages.length - 1].text : '',
    }));
}

export function getConversation(id) {
  return load().conversations.find(c => c.id === id) || null;
}

export function createConversation({ source = 'test', username = 'klientka_test', messages = [], stage = 'zimny' } = {}) {
  const now = Date.now();
  const conv = {
    id: uid(), source, username, stage, booked: false,
    createdAt: now, updatedAt: now,
    messages: messages.map(m => ({ role: m.role, text: m.text, ts: now })),
  };
  load().conversations.push(conv);
  save();
  return conv;
}

export function addMessage(id, role, text) {
  const conv = getConversation(id);
  if (!conv) return null;
  conv.messages.push({ role, text, ts: Date.now() });
  conv.updatedAt = Date.now();
  save();
  return conv;
}

export function updateConversation(id, patch) {
  const conv = getConversation(id);
  if (!conv) return null;
  Object.assign(conv, patch);
  conv.updatedAt = Date.now();
  save();
  return conv;
}

export function deleteConversation(id) {
  const d = load();
  d.conversations = d.conversations.filter(c => c.id !== id);
  save();
}

export function analytics() {
  const convs = load().conversations;
  const stages = ['zimny', 'cieply', 'goracy', 'skonwertowany', 'semi_dq', 'dq'];
  const byStage = Object.fromEntries(stages.map(s => [s, 0]));
  let booked = 0;
  for (const c of convs) {
    if (byStage[c.stage] !== undefined) byStage[c.stage]++;
    if (c.booked) booked++;
  }
  const total = convs.length;
  return {
    total,
    booked,
    byStage,
    conversion: total ? Math.round((byStage.skonwertowany / total) * 1000) / 10 : 0,
  };
}
