# PRZEWODNIK: hosting 24/7 — krok po kroku

Po co: żeby setter działał całą dobę i żeby Meta mogła słać webhooki na **publiczny adres https** (localhost nie zadziała z Instagramem).

Rekomendacja: **Render.com** (prosty, daje https, ma trwały dysk na dane). Alternatywa: Railway.app.
W repo jest już `render.yaml`, który ustawia wszystko automatycznie (serwer + trwały dysk + `DATA_DIR`).

⏱️ ~30–45 min. 💸 Koszt: Render „Starter" ~$7/mc (potrzebny dla 24/7 + trwały dysk; darmowy usypia konto i kasuje dane). Do tego model AI płatny od użycia. Razem grosze przy 4000 zł/mc za Setora.

---

## KROK 1 — Kod na GitHub
Render wdraża z repozytorium. Najłatwiej: założymy repo i wrzucimy tam kod (mogę to zrobić z Tobą jedną komendą — wymaga zalogowania do GitHuba).
- Konto: github.com (jeśli nie masz).
- W folderze `setter-ai-app`: zrobimy `git init`, commit i wypchnięcie do nowego repo.
  (Plik `.gitignore` już pilnuje, żeby NIE wysłać `data/` ani kluczy.)

## KROK 2 — Render: nowy serwis
1. Wejdź na **render.com** → załóż konto (możesz „Sign in with GitHub").
2. **New + → Blueprint** → wskaż swoje repo `setter-ai-app`.
3. Render wykryje `render.yaml` → kliknij **Apply**. Postawi serwer + trwały dysk.
4. (Jeśli woli „Web Service" zamiast Blueprint: Build `npm install`, Start `node server.js`, dodaj dysk zamontowany w `/var/data` i zmienną `DATA_DIR=/var/data`.)

## KROK 3 — Publiczny adres
Po wdrożeniu dostaniesz adres typu **https://setter-ai-followup.onrender.com**.
- To jest Twój publiczny URL.
- **Webhook dla Meta** = ten adres + `/webhook`, czyli np. `https://setter-ai-followup.onrender.com/webhook`.

## KROK 4 — Konfiguracja w działającej aplikacji
1. Otwórz swój adres Render w przeglądarce → to ten sam panel co lokalnie.
2. **Ustawienia** → wklej klucz API (Anthropic) → Zapisz. (Zapisze się na trwałym dysku.)
3. **Instagram** → wklej dane z `PRZEWODNIK-META.md` → Zapisz.
4. Dane przeżywają restarty (trwały dysk).

## KROK 5 — Połącz z Metą
Wróć do `PRZEWODNIK-META.md` Krok 4 i użyj publicznego adresu `/webhook` jako Callback URL.

---

## Alternatywa: Railway.app
Podobnie: New Project → Deploy from repo → ustaw `DATA_DIR` na zamontowany wolumen. Powiedz, jeśli wolisz Railway — przeprowadzę.

## Bezpieczeństwo
- `data/` (z kluczem API i tokenami) NIE trafia do GitHuba (jest w `.gitignore`).
- Na hostingu dane siedzą na trwałym dysku serwisu, nie w repo.

👉 Najlepiej zrobimy to **razem na żywo** — Ty zakładasz konta (GitHub, Render), ja podaję dokładne komendy/kliknięcia i wszystko sprawdzam.
