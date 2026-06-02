# Setter AI – FollowUP (aplikacja, Etap 1: rdzeń lokalny)

Działający setter z panelem i test-chatem. Mózg = prompt z `~/Desktop/setter-ai/PROMPT-setter-followup.md` (ładowany automatycznie).

## Jak uruchomić (najprościej)
1. Dwuklik w **`start.command`**. Otworzy się okno terminala, doinstaluje co trzeba i odpali panel w przeglądarce.
   - Gdyby macOS zablokował plik: kliknij prawym → Otwórz → Otwórz.
2. W przeglądarce otworzy się `http://localhost:3000`.
3. Wejdź w **Ustawienia** → wklej swój klucz API (Anthropic albo OpenAI) → Zapisz.
4. Wejdź w **Test-chat** → „Nowa rozmowa" → pisz jak właścicielka gabinetu i sprawdź, jak setter prowadzi rozmowę.

## Alternatywnie (z terminala)
```bash
cd ~/Desktop/setter-ai-app
npm install      # tylko za pierwszym razem
npm start
```
Potem otwórz http://localhost:3000

## Klucz API
- Anthropic (Claude): https://console.anthropic.com → API Keys. Przykładowy model: `claude-sonnet-4-6`.
- albo OpenAI: https://platform.openai.com → API Keys. Przykładowy model: `gpt-4o`.
Klucz trzymany jest tylko lokalnie, w `data/db.json` na Twoim komputerze.

## Co już działa (Etap 1)
- Silnik AI prowadzący rozmowę wg promptu (styl, etapy, kwalifikacja, umawianie, follow-upy)
- Test-chat (symulacja rozmów, bez ruszania Instagrama)
- Automatyczne wykrywanie etapu leada (zimny / ciepły / gorący / skonwertowany / semi-DQ / DQ)
- Edytor instrukcji, lista openerów (A/B), lista rozmów, analityka
- Pole na klucz API i wybór modelu

## Etap 2 — Instagram na żywo (kod już gotowy, czeka na podłączenie)
Kod integracji jest wbudowany (webhook, odbiór/wysyłka DM, komentarz→DM, weryfikacja podpisu). Żeby ruszył na żywo:
1. **PRZEWODNIK-HOSTING.md** — postaw aplikację 24/7 z publicznym adresem https.
2. **PRZEWODNIK-META.md** — załóż apkę w Meta, zdobądź tokeny, wpisz je w zakładce **Instagram** w panelu.
3. Reklamy click-to-DM jako bezpieczne źródło ruchu (osobno).

Konfigurację IG wpisujesz w panelu (zakładka 📸 Instagram).

## Foldery
- `data/db.json` — Twoje dane (ustawienia, rozmowy). Kopia = backup.
- `public/` — panel (interfejs).
- `server.js`, `engine.js`, `store.js` — backend.
