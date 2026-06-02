// Silnik AI: rozmowa (setter) + klasyfikacja etapu leada.
// Obsługuje dwóch dostawców: Anthropic (Claude) i OpenAI.

function prepareMessages(messages) {
  let msgs = messages.slice();
  let systemSuffix = '';
  // Anthropic wymaga, by pierwsza wiadomość była od "user".
  // Jeśli rozmowę rozpoczyna setter (opener), przenosimy ją do kontekstu systemowego.
  const leading = [];
  while (msgs.length && msgs[0].role === 'assistant') leading.push(msgs.shift());
  if (leading.length) {
    systemSuffix =
      'KONTEKST: Rozmowę rozpocząłeś samodzielnie wiadomością powitalną: "' +
      leading.map(m => m.text).join(' / ') +
      '". Rozmówca odpowiedział poniżej — kontynuuj naturalnie zgodnie ze swoim procesem.';
  }
  // scal kolejne wiadomości tej samej roli
  const merged = [];
  for (const m of msgs) {
    if (merged.length && merged[merged.length - 1].role === m.role) {
      merged[merged.length - 1].text += '\n' + m.text;
    } else {
      merged.push({ role: m.role, text: m.text });
    }
  }
  return { messages: merged, systemSuffix };
}

async function anthropicChat({ apiKey, model, maxTokens, system, messages }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 320,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.text })),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('Anthropic ' + res.status + ': ' + t.slice(0, 500));
  }
  const data = await res.json();
  return (data.content?.map(b => b.text).join('') || '').trim();
}

async function openaiChat({ apiKey, model, maxTokens, system, messages }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 320,
      messages: [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role, content: m.text }))],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('OpenAI ' + res.status + ': ' + t.slice(0, 500));
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

export async function generateReply({ provider, apiKey, model, maxTokens, systemPrompt, messages }) {
  if (!apiKey) throw new Error('NO_API_KEY');
  const { messages: prepared, systemSuffix } = prepareMessages(messages);
  if (!prepared.length) throw new Error('Brak wiadomości rozmówcy do odpowiedzi.');
  const system = systemSuffix ? systemPrompt + '\n\n' + systemSuffix : systemPrompt;
  if (provider === 'openai') return openaiChat({ apiKey, model, maxTokens, system, messages: prepared });
  return anthropicChat({ apiKey, model, maxTokens, system, messages: prepared });
}

const STAGES = ['zimny', 'cieply', 'goracy', 'skonwertowany', 'semi_dq', 'dq'];

export async function classifyStage(settings, conversation) {
  const transcript = conversation.messages
    .map(m => (m.role === 'assistant' ? 'SETTER' : 'KLIENT') + ': ' + m.text)
    .join('\n');
  const system =
    'Jesteś klasyfikatorem etapu leada w rozmowie, której celem jest umówienie bezpłatnej konsultacji dla gabinetu beauty. Odpowiadasz WYŁĄCZNIE surowym JSON, bez żadnego komentarza.';
  const user =
    'Oceniaj DECYDOWANIE, nie zachowawczo. Reguły:\n' +
    '- "zimny": dopiero zaczęli, brak realnej treści lub zaangażowania.\n' +
    '- "cieply": rozmówca zdradził swoją sytuację lub problem (np. ma gabinet, mało klientek).\n' +
    '- "goracy": rozmówca pokazał intencję I gotowość (chce więcej klientek ORAZ ma/da budżet na reklamy) — kwalifikuje się.\n' +
    '- "skonwertowany": zgodził się na konsultację, prosi o termin albo dostał link i chce się umówić.\n' +
    '- "semi_dq": na teraz nie (np. brak budżetu), ale wart follow-upu.\n' +
    '- "dq": nie nasz target (nie prowadzi gabinetu / inna branża).\n' +
    'Zwróć WYŁĄCZNIE JSON: {"stage":"<jeden_z_etapów>","booked":true|false}\n\nROZMOWA:\n' +
    transcript;
  try {
    const txt = await generateReply({
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      maxTokens: 60,
      systemPrompt: system,
      messages: [{ role: 'user', text: user }],
    });
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const json = JSON.parse(m[0]);
    if (!STAGES.includes(json.stage)) return null;
    return { stage: json.stage, booked: !!json.booked };
  } catch {
    return null;
  }
}
