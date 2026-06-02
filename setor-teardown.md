# TEARDOWN SETOR AI — inspekcja funkcji (DOM/kod/kontrolki)
Cel: prześwietlić każdą funkcję Setora i przekuć w lepszy efekt w naszym panelu.
Stack Setora: Next.js + shadcn/ui (Tailwind + Radix) + Inter + paleta oklch. Auto-zapis pól.

## 1) PERSONA (/prompts) — mózg AI, 6 zakładek
### Tożsamość
- Informacje o firmie: Nazwa firmy; Nisza biznesowa (ph: "np. E-commerce, SaaS, Consulting")
- Tożsamość persony: Imię persony (ph: "np. Ola, Mateusz, Kasia"); Płeć (dropdown); Tytuł persony (ph: "np. Asystent Sprzedaży, Manager Sukcesu Klienta")

### Problemy — LISTA pozycji (Adrian ma 9). Help: "AI wykorzysta do zrozumienia i kwalifikacji leadów"
1. Puste grafiki zabiegowe i brak stałego napływu klientek
2. Zbyt mała liczba zapytań z internetu
3. Nieskuteczna reklama i przepalanie budżetu na działania bez zwrotu
4. Brak uporządkowanego systemu pozyskiwania rezerwacji
5. Słabe zaufanie do marki gabinetu w oczach potencjalnych klientek
6. Niska liczba opinii i poleceń od zadowolonych klientek
7. Brak wyróżnienia się na tle konkurencji w okolicy
8. Chaotyczna komunikacja oferty i cennika
9. Trudność w zamienianiu obserwatorek w realne rezerwacje

### Cele — LISTA (9). Help: "AI wykorzysta do motywowania leadów i prowadzenia do konwersji"
1. Zapełnić grafik zabiegami w ciągu trzydziestu dni
2. Ustabilizować liczbę nowych klientek każdego tygodnia
3. Zwiększyć liczbę zapytań telefonicznych i wiadomości
4. Zbudować rozpoznawalność gabinetu w lokalnej okolicy
5. Poprawić skuteczność działań promocyjnych
6. Zwiększyć liczbę opinii pięć na pięć
7. Wprowadzić prosty system pozyskiwania rezerwacji
8. Podnieść średnią wartość pojedynczej wizyty
9. Skalować gabinet bez ciągłego dokładania własnej pracy

### Funnel — integracja rezerwacji
- Połącz kalendarz (rekomendowane) LUB ręczny link (ph: "https://calendly.com/twoja-nazwa/15min")
- Opis rozmowy (textarea): "O czym jest ta rozmowa?" → Adrian: bezpłatna 30-min rozmowa o problemach gabinetu, źródłach klientek i zmianach poprawiających rezerwacje.

### Zasoby — LEAD MAGNETY (nazwa + słowa kluczowe + link). Słowa kluczowe wybierają zasób.
1. Darmowy przewodnik: Jak zapełnić grafik gabinetu w 30 dni — [przewodnik, pdf, gabinet, klientki, rezerwacje, marketing]
2. Lista kontrolna: 10 kroków do większej liczby rezerwacji — [lista kontrolna, pdf, rezerwacje, gabinet, sprzedaż, klientki]
3. Szablon wiadomości do pozyskiwania klientek z internetu — [szablon, wiadomości, klientki, gabinet]

### Kryteria Dyskwalifikacji — LISTA (9) + zaawansowana kwalifikacja AI
1. Gabinet nie ma żadnej oferty lub nie potrafi jasno jej opisać
2. Właścicielka nie chce wprowadzać zmian w obsłudze klientek
3. Brak gotowości do pracy nad komunikacją i sprzedażą
4. Gabinet działa wyłącznie sezonowo i nie chce stabilnego wzrostu
5. Budżet na działania promocyjne jest skrajnie ograniczony
6. Właścicielka oczekuje natychmiastowych efektów bez wdrażania zaleceń
7. Zespół nie ma czasu na uporządkowanie procesu pozyskiwania klientek
8. Gabinet nie obsługuje klientek detalicznych
9. Brak zgody na mierzenie efektów i analizę wyników

**WNIOSEK → wdrożone:** persona jako bogate listy, wpięte w system prompt (problemy→badanie, cele→motywacja, kryteria→DQ, zasoby→lead magnety, funnel→domknięcie). Treść Adriana wgrana 1:1.

## DO ZROBIENIA (kolejne moduły do prześwietlenia)
- Testowy Czat (poziomy/XP, A/B skryptu, Historia Live, "Zapisz na Live")
- Wiadomości Powitalne A/B (warianty + statystyki + suwak %)
- Komentarze i DM · Automatyzacje (kreator) · Zimny zasięg · Tryb Recovery
- Analityka (metryki: Konwersje, Kontakty, Obserwujący, Wizyty profilu; widżety)
- CRM · Konfiguracja (Produkty, Waluta)
