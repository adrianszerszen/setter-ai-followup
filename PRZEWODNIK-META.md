# PRZEWODNIK: podłączenie Instagrama (Meta) — krok po kroku

Cel: dać aplikacji dane, dzięki którym setter będzie odbierał i wysyłał DM-y na Twoim koncie.
Uwaga: panele Meta często zmieniają wygląd — jeśli coś wygląda inaczej, napisz, przejdziemy to razem na żywo. Najpierw zróbmy **Hosting** (PRZEWODNIK-HOSTING.md), bo potrzebny jest publiczny adres do webhooka.

⏱️ Realny czas: ~1–2 h klikania + **oczekiwanie na App Review Meta (kilka dni do ~2–4 tyg.)**. Do czasu zatwierdzenia setter działa tylko z kontami testowymi i Twoim własnym.

---

## CZEGO BĘDZIESZ POTRZEBOWAĆ (zbierzemy to po drodze i wkleimy w panel → zakładka Instagram)
- **Instagram User ID** (ID Twojego konta firmowego)
- **Page Access Token** (token długożyciowy)
- **App Secret** (sekret aplikacji)
- **Verify Token** (dowolne hasło — wymyślasz sam, np. przyciskiem „losuj" w panelu)
- **Webhook URL** (Twój publiczny adres z hostingu + `/webhook`)

---

## KROK 1 — Konto firmowe IG + strona FB
1. Instagram → Ustawienia → przełącz konto na **profesjonalne** (Biznes).
2. Załóż/wybierz **stronę na Facebooku** i **połącz ją** z kontem IG (Ustawienia IG → „Strona").
   (To wymóg Meta dla wysyłki DM przez API.)

## KROK 2 — Konto deweloperskie i aplikacja
1. Wejdź na **developers.facebook.com** → zaloguj się → „Get Started" (jeśli pierwszy raz).
2. **My Apps → Create App** → typ **Business** → nazwa np. „FollowUP Setter".

## KROK 3 — Dodaj produkt do aplikacji
1. W panelu aplikacji dodaj produkt **Instagram** (lub **Messenger → Instagram Settings**).
2. Podłącz swoją stronę FB / konto IG.
3. Z tego ekranu skopiujesz później **Page Access Token** oraz zobaczysz **Instagram User ID**.

## KROK 4 — Webhook
1. W produkcie Instagram/Messenger → sekcja **Webhooks**.
2. **Callback URL** = Twój adres z hostingu, np. `https://twojadomena.onrender.com/webhook`
3. **Verify Token** = to samo, co wpiszesz w panelu aplikacji (zakładka Instagram → „losuj" → Zapisz).
4. Kliknij **Verify and Save** — Meta odpyta Twój serwer (aplikacja musi już działać na hostingu).
5. **Subskrybuj pola**: `messages`, `messaging_postbacks`, oraz `comments` (dla komentarz→DM).

## KROK 5 — Tokeny i ID → wklej w panel
1. Skopiuj **Page Access Token** (najlepiej zamień na **długożyciowy** — pokażę jak, to jedno zapytanie).
2. Skopiuj **App Secret** (Ustawienia aplikacji → Podstawowe → Pokaż).
3. Skopiuj **Instagram User ID**.
4. W aplikacji: zakładka **Instagram** → wklej wszystko → zaznacz **Włącz obsługę Instagrama** → Zapisz.

## KROK 6 — Tryb testowy → produkcja (App Review)
- Na starcie aplikacja jest w trybie **Development**: setter pisze tylko z Tobą i z dodanymi **testerami**. To wystarczy, żeby wszystko sprawdzić na żywo.
- Aby pisać z prawdziwymi obserwującymi, złóż wniosek o **Advanced Access** dla `instagram_manage_messages` (App Review): weryfikacja biznesu + krótki film pokazujący działanie. Zatwierdzenie: kilka dni–kilka tygodni.

---

## MAPA: pole w Meta → pole w aplikacji (zakładka Instagram)
| Meta | Aplikacja |
|---|---|
| Instagram User ID | „Instagram User ID" |
| Page Access Token | „Page Access Token" |
| App Secret | „App Secret" |
| (wymyślasz) | „Verify Token" (ten sam w Meta) |
| Callback URL | pokazany jako „Webhook URL" |

## WAŻNE (zgodność)
Ta integracja używa **oficjalnego API** = bezpieczna dla konta. Setter odpowiada na wiadomości i komentarze, których inicjatorem jest klient (w tym „napisz SŁOWO"). Świadomie NIE robimy masowego pisania pierwszego do obcych (cold outreach) — to łamie regulamin IG i grozi blokadą konta. Ruch zapewniamy reklamami **click-to-DM** (osobno).
