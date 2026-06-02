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
    model: 'claude-haiku-4-5',
    maxTokens: 320,
    bookingLink: 'https://followupagencja.com/',
    instructions: readDefaultInstructions(),
    openers: [
      'jesteś?',
      'mogę o coś zapytać?',
      'mogę być szczery?',
      'mogę mieć feedback do twojego gabinetu?',
      'widzę gabinet, mogę o coś spytać?',
      'mam pytanie 🙂',
    ],
    liveVersions: [],
    instagram: {
      enabled: false,
      verifyToken: '',
      pageAccessToken: '',
      igUserId: '',
      appSecret: '',
      commentKeyword: 'oferta',
    },
    persona: {
      firma: 'Adrian Szerszeń | Marketing Gabinetów i Skalowanie',
      nisza: 'marketing gabinetów i pozyskiwanie klientek dla gabinetów usługowych (beauty / medycyna estetyczna)',
      imie: 'Adrian',
      plec: 'Mężczyzna',
      tytul: 'Doradca ds. pozyskiwania klientek dla gabinetów',
      problemy: 'Puste grafiki zabiegowe i brak stałego napływu klientek\nZbyt mała liczba zapytań z internetu\nNieskuteczna reklama i przepalanie budżetu na działania bez zwrotu\nBrak uporządkowanego systemu pozyskiwania rezerwacji\nSłabe zaufanie do marki gabinetu w oczach potencjalnych klientek\nNiska liczba opinii i poleceń od zadowolonych klientek\nBrak wyróżnienia się na tle konkurencji w okolicy\nChaotyczna komunikacja oferty i cennika\nTrudność w zamienianiu obserwatorek w realne rezerwacje',
      cele: 'Zapełnić grafik zabiegami w ciągu 30 dni\nUstabilizować liczbę nowych klientek każdego tygodnia\nZwiększyć liczbę zapytań telefonicznych i wiadomości\nZbudować rozpoznawalność gabinetu w lokalnej okolicy\nPoprawić skuteczność działań promocyjnych\nZwiększyć liczbę opinii 5/5\nWprowadzić prosty system pozyskiwania rezerwacji\nPodnieść średnią wartość pojedynczej wizyty\nSkalować gabinet bez ciągłego dokładania własnej pracy',
      lejek: 'Cel = umówić bezpłatną konsultację strategiczną z Adrianem (followupagencja.com). Opis rozmowy: bezpłatna ~30-minutowa rozmowa, na której omawiamy obecne problemy gabinetu, źródła pozyskiwania klientek oraz zmiany, które mogą poprawić liczbę rezerwacji.',
      zasoby: 'Darmowy przewodnik: Jak zapełnić grafik gabinetu w 30 dni\nLista kontrolna: 10 kroków do większej liczby rezerwacji\nSzablon wiadomości do pozyskiwania klientek z internetu',
      kryteriaDQ: 'Gabinet nie ma żadnej oferty lub nie potrafi jasno jej opisać\nWłaścicielka nie chce wprowadzać zmian w obsłudze klientek\nBrak gotowości do pracy nad komunikacją i sprzedażą\nGabinet działa wyłącznie sezonowo i nie chce stabilnego wzrostu\nBudżet na działania promocyjne jest skrajnie ograniczony\nWłaścicielka oczekuje natychmiastowych efektów bez wdrażania zaleceń\nZespół nie ma czasu na uporządkowanie procesu pozyskiwania klientek\nGabinet nie obsługuje klientek detalicznych\nBrak zgody na mierzenie efektów i analizę wyników',
      leadMagnets: [
        { name: 'Darmowy przewodnik: Jak zapełnić grafik gabinetu w 30 dni', keywords: 'przewodnik, pdf, grafik, klientki, rezerwacje', link: '' },
        { name: 'Lista kontrolna: 10 kroków do większej liczby rezerwacji', keywords: 'lista, checklist, rezerwacje, kroki', link: '' },
        { name: 'Szablon wiadomości do pozyskiwania klientek', keywords: 'szablon, wiadomości, dm, pozyskiwanie', link: '' },
      ],
    },
    config: {
      quietHours: { enabled: true, start: '23:30', end: '06:30' },
      skipBigAccounts: true,
      commentToDm: { keyword: 'oferta', dm: 'jesteś? widziałem twój komentarz 🙂', replyToComment: true, publicReply: 'dzięki, zerknij na dm 🙂' },
      recovery: { enabled: false, dailyMin: 5, dailyMax: 15, messages: ['jesteś?', 'wracam, bo coś mi chodziło po głowie odnośnie twojego gabinetu', 'hej, robimy niedługo darmowy webinar o pozyskiwaniu klientek, wpadniesz?'] },
      coldOutreach: {
        enabled: false,
        dailyLimit: 40,
        rampUp: true,            // start niski, +10 co 2-3 dni (zgodnie z wideo)
        startDaily: 30,
        overwriteQualification: false, // gdy true: pisz do wszystkich z listy (omija kwalifikację) — zwykle OFF
        qualifier: 'Czy ten profil prowadzi gabinet kosmetyczny lub medycyny estetycznej (np. makijaż permanentny, depilacja laserowa, kosmetologia)?',
        sources: [],             // legacy: wolny tekst opisu źródeł
        // Źródła wg modelu Setora: similar (znajdź podobne), followers (ostatni 1000 obs.), monitor (nowi obs.), likers (lajkujący Twój content)
        sourceAccounts: [],      // [{ handle, type:'followers'|'monitor'|'similar'|'likers', note }]
        likersAi: false,         // skanuj lajkujących co ~10 min i dodawaj do listy
        message: 'hej, trafiłem na twój gabinet i robi wrażenie, mogę o coś zapytać?',
        // Zaawansowana kwalifikacja AI (filtr profili PRZED napisaniem) — dokładnie jak w wideo odc 9
        qualification: {
          enabled: true,
          skipMen: false, skipWomen: false,
          skipNoPhoto: true, skipPrivate: true, skipEmptyBio: true,
          skipNoLink: false, skipNoHighlights: false, skipNoPosts: true,
          minFollowers: 0, maxFollowers: 0, minPosts: 0,
          aiQuestion: 'Czy ten profil prowadzi gabinet beauty / medycyny estetycznej (gabinet kosmetyczny, PMU, laser, kosmetologia)?',
          skipUncertain: true,        // pomijaj profile, co do których AI nie jest pewne
          filterIncomingDm: true,     // filtruj nowe DM zanim AI odpisze (nie pisz do znajomych)
        },
      },
      products: [],
      currency: 'PLN',
      ab: {
        openers: { enabled: false, variants: [
          { id: 'A', label: 'A', content: 'jesteś?', weight: 50 },
          { id: 'B', label: 'B', content: 'mogę o coś zapytać?', weight: 50 },
        ] },
        script: { enabled: false, variants: [
          { id: 'A', label: 'A', instructions: '', weight: 50 },
          { id: 'B', label: 'B', instructions: '', weight: 50 },
        ] },
        minSample: 200,
      },
      flows: [
        {
          id: 'f1', name: 'Pozyskiwanie obserwujących + Lead Magnet', active: false,
          trigger: { type: 'comment', keyword: '' },
          nodes: [
            { type: 'welcome', message: 'hej! kliknij przycisk, żeby dostać materiał. pamiętaj że musisz mnie obserwować 🙂', button: 'CHCĘ TO' },
            { type: 'followers_check', ifNot: 'zaobserwuj mnie proszę, żeby dostać materiał, i kliknij ponownie' },
            { type: 'lead_magnet', resource: 'Darmowy przewodnik: Jak zapełnić grafik gabinetu w 30 dni' },
            { type: 'delay', hours: 2 },
            { type: 'followup', message: 'hej, zdążyłaś zerknąć na materiał? jakby co jestem tu' },
          ],
        },
      ],
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
  // dopełnij brakujące pod-pola config (np. nowe funkcje jak ab) i persony — kompatybilność przy aktualizacjach
  if (db.settings.config) { const dc = d.config || {}; for (const k of Object.keys(dc)) if (db.settings.config[k] === undefined) db.settings.config[k] = dc[k]; }
  if (db.settings.persona) { const dp = d.persona || {}; for (const k of Object.keys(dp)) if (db.settings.persona[k] === undefined) db.settings.persona[k] = dp[k]; }
  // dopełnij głębsze pod-pola (coldOutreach + jego qualification, recovery, commentToDm) — kompatybilność przy aktualizacjach
  const mergeDeep = (obj, def) => { if (!obj || !def) return; for (const k of Object.keys(def)) { if (obj[k] === undefined) obj[k] = def[k]; else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) mergeDeep(obj[k], def[k]); } };
  if (db.settings.config) {
    mergeDeep(db.settings.config.coldOutreach, (d.config || {}).coldOutreach);
    mergeDeep(db.settings.config.recovery, (d.config || {}).recovery);
    mergeDeep(db.settings.config.commentToDm, (d.config || {}).commentToDm);
    mergeDeep(db.settings.config.quietHours, (d.config || {}).quietHours);
    mergeDeep(db.settings.config.ab, (d.config || {}).ab);
  }
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

// Historia Live — edycja instrukcji + wersjonowanie (jak /testing w Setorze)
export function getLive() {
  const s = load().settings;
  return { instructions: s.instructions || '', versions: (s.liveVersions || []).map(v => ({ ts: v.ts, preview: (v.instructions || '').slice(0, 90) })) };
}
export function saveLive(instructions) {
  const s = load().settings;
  s.instructions = instructions || '';
  if (!s.liveVersions) s.liveVersions = [];
  s.liveVersions.unshift({ ts: Date.now(), instructions: s.instructions });
  s.liveVersions = s.liveVersions.slice(0, 20);
  save();
  return getLive();
}
export function restoreLive(ts) {
  const s = load().settings;
  const v = (s.liveVersions || []).find(x => x.ts === ts);
  if (v) { s.instructions = v.instructions; s.liveVersions.unshift({ ts: Date.now(), instructions: v.instructions }); s.liveVersions = s.liveVersions.slice(0, 20); save(); }
  return getLive();
}

// Buduje pełny system prompt = blok persony (z zakładek Osoba) + instrukcje (skrypt).
export function systemPrompt(conv) {
  const s = load().settings;
  const p = s.persona || {};
  const asList = v => (v || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => '- ' + x).join('\n');
  const block = [
    '# persona i firma',
    [p.imie && ('Działasz jako asystent: ' + p.imie + (p.tytul ? ' — ' + p.tytul : '') + '.'),
     p.firma && ('Firma: ' + p.firma + '.'),
     p.nisza && ('Nisza: ' + p.nisza + '.')].filter(Boolean).join(' '),
    p.problemy && ('Problemy klientów, które rozwiązujemy (używaj na etapie badania problemów i kwalifikacji):\n' + asList(p.problemy)),
    p.cele && ('Cele/rezultaty, do których prowadzisz rozmowę (używaj do motywowania leada):\n' + asList(p.cele)),
    p.lejek && ('Cel rozmowy (lejek): ' + p.lejek),
    p.zasoby && ('Lead magnety / zasoby do podesłania, gdy pasują do rozmowy:\n' + asList(p.zasoby)),
    p.kryteriaDQ && ('Kryteria dyskwalifikacji (DQ; przy braku budżetu raczej semi-DQ + follow-up):\n' + asList(p.kryteriaDQ)),
    (p.leadMagnets && p.leadMagnets.length) && ('Lead magnety — gdy temat rozmowy pasuje do słów kluczowych, zaproponuj dany zasób i wyślij link (jeśli podany):\n' + p.leadMagnets.filter(z => z.name).map(z => '- ' + z.name + (z.keywords ? ' [słowa kluczowe: ' + z.keywords + ']' : '') + (z.link ? ' → ' + z.link : ' (brak linku — nie wysyłaj linku, zaproponuj na konsultacji)')).join('\n')),
  ].filter(Boolean).join('\n');
  let instr = s.instructions || '';
  const ab = s.config && s.config.ab;
  if (conv && conv.abScript && ab && ab.script) {
    const v = (ab.script.variants || []).find(x => x.id === conv.abScript);
    if (v && (v.instructions || '').trim()) instr = v.instructions;
  }
  return block + '\n\n' + instr;
}

// Wybór wariantu A/B wg wagi (suwak %)
export function pickVariant(variants) {
  const active = (variants || []).filter(v => (v.weight || 0) > 0);
  if (!active.length) return null;
  const total = active.reduce((s, v) => s + (v.weight || 0), 0);
  let r = Math.random() * total;
  for (const v of active) { r -= (v.weight || 0); if (r <= 0) return v; }
  return active[active.length - 1];
}

// Statystyki A/B liczone z rozmów (rozpoczęte = lead odpisał; konwersja = skonwertowany)
export function abStats() {
  const s = load().settings;
  const convs = load().conversations;
  const min = (s.config && s.config.ab && s.config.ab.minSample) || 200;
  const calc = (variants, key) => (variants || []).map(v => {
    const mine = convs.filter(c => c[key] === v.id);
    const started = mine.filter(c => (c.messages || []).length >= 2).length;
    const conversions = mine.filter(c => c.stage === 'skonwertowany' || c.booked).length;
    return { id: v.id, label: v.label, weight: v.weight, started, conversions, conv: started ? Math.round((conversions / started) * 1000) / 10 : 0 };
  });
  const winner = arr => { const elig = arr.filter(v => v.started >= min); if (elig.length < 2) return null; const top = elig.slice().sort((a, b) => b.conv - a.conv); return top[0].conv > top[1].conv ? top[0].id : null; };
  const openers = calc(s.config && s.config.ab && s.config.ab.openers && s.config.ab.openers.variants, 'abOpener');
  const script = calc(s.config && s.config.ab && s.config.ab.script && s.config.ab.script.variants, 'abScript');
  return { minSample: min, openers, script, openerWinner: winner(openers), scriptWinner: winner(script) };
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
  if (patch.persona && typeof patch.persona === 'object') {
    if (!s.persona) s.persona = {};
    Object.assign(s.persona, patch.persona);
  }
  if (patch.config && typeof patch.config === 'object') {
    if (!s.config) s.config = {};
    for (const k of Object.keys(patch.config)) s.config[k] = patch.config[k];
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

// Cofnij rozmowę do wybranej wiadomości (zostaw pierwsze keep wiadomości) — do testowania od konkretnego momentu.
export function truncateConversation(id, keep) {
  const conv = getConversation(id);
  if (!conv) return null;
  conv.messages = conv.messages.slice(0, Math.max(0, keep));
  conv.updatedAt = Date.now();
  save();
  return conv;
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
  // "rozpoczęte" rozmowy = lead odpisał (>=2 wiadomości). To metryka, na którą patrzymy wg wideo (nie "wysłane").
  const responded = convs.filter(c => (c.messages || []).length >= 2).length;
  const now = new Date();
  const fmt = d => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
  const series = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate() - i); series.push({ day: fmt(d), count: 0, conv: 0, rate: 0 }); }
  for (const c of convs) {
    const key = fmt(new Date(c.createdAt || Date.now()));
    const s = series.find(x => x.day === key);
    if (s) { s.count++; if (c.stage === 'skonwertowany' || c.booked) s.conv++; }
  }
  for (const s of series) s.rate = s.count ? Math.round((s.conv / s.count) * 1000) / 10 : 0;
  // wykrycie "piku nowicjusza": średnia konwersja pierwszych dni z ruchem vs ostatnich
  const withTraffic = series.filter(s => s.count > 0);
  let newbiePeak = false;
  if (withTraffic.length >= 6) {
    const head = withTraffic.slice(0, Math.ceil(withTraffic.length / 3));
    const tail = withTraffic.slice(-Math.ceil(withTraffic.length / 3));
    const avg = arr => arr.reduce((a, b) => a + b.rate, 0) / (arr.length || 1);
    if (avg(head) > avg(tail) * 1.3 && avg(head) > 0) newbiePeak = true;
  }
  return {
    total, booked, byStage, responded,
    conversion: total ? Math.round((byStage.skonwertowany / total) * 1000) / 10 : 0,
    convFromResponded: responded ? Math.round((byStage.skonwertowany / responded) * 1000) / 10 : 0,
    konwersje: byStage.skonwertowany, kontakty: total, obserwujacy: null, wizyty: null,
    series, newbiePeak,
  };
}
