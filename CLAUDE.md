# MruOS: kalendarz studencki

Aplikacja webowa do zarządzania planem zajęć na studiach. Użytkownik ręcznie wprowadza zajęcia (przedmiot, typ, kolor, budynek, sala, godziny, zakres obowiązywania), a aplikacja pokazuje je w widoku tygodnia (domyślnym), miesiąca i dnia z podziałką godzinową. Każdy użytkownik konfiguruje swój kalendarz samodzielnie; plany nie są współdzielone.

Aktualny etap prac: patrz `ROADMAP.md`.

## Stos technologiczny

- Monorepo: pnpm workspaces.
- Język: TypeScript w trybie `strict` we wszystkich pakietach.
- Frontend (`apps/web`): React, Vite, Tailwind CSS, FullCalendar z pluginem `@fullcalendar/rrule`.
- Backend (`apps/api`): Node.js, Express, MongoDB z Mongoose.
- Wspólny kod (`packages/shared`): typy domenowe, schematy walidacji (zod), logika rozwijania reguł powtarzania.
- Daty i strefy czasowe: Luxon.
- Testy: Vitest (jednostkowe i integracyjne), Playwright (E2E).
- Jakość: ESLint, Prettier, GitHub Actions.

## Struktura repozytorium

```
apps/
  web/          frontend (widoki, komponenty, warstwa repozytorium danych)
  api/          backend w układzie MVC: models/, controllers/, routes/, middleware/
packages/
  shared/       typy, schematy zod, logika domeny (bez zależności od React i Express)
e2e/            testy Playwright
```

## Model domeny

Kolekcja `events`, jeden dokument na serię zajęć:

```json
{
  "userId": "ObjectId",
  "kind": "class",
  "subject": "Matematyka",
  "classType": "cwiczenia",
  "color": "#3b82f6",
  "building": "Wydział Mechaniczny",
  "room": "204",
  "startTime": "08:00",
  "endTime": "12:00",
  "timezone": "Europe/Warsaw",
  "recurrence": {
    "freq": "WEEKLY",
    "interval": 1,
    "byDay": ["MO"],
    "startDate": "2026-10-05",
    "endDate": "2026-11-13"
  },
  "exceptions": [
    { "date": "2026-11-02", "status": "cancelled" },
    { "date": "2026-10-19", "override": { "room": "112" } }
  ]
}
```

Zasady, których trzeba przestrzegać:

- `classType` przyjmuje wartości: `wyklad`, `cwiczenia`, `laboratorium`, `seminarium`, `zajecia-praktyczne`.
- `kind` na razie zawsze ma wartość `class`. Pole zostaje, bo w przyszłości mogą dojść inne rodzaje wydarzeń.
- Godziny są przechowywane jako czas lokalny (`HH:mm`) razem ze strefą `Europe/Warsaw`, nigdy jako znacznik UTC. Zajęcia o 8:00 muszą zostać o 8:00 po zmianie czasu w październiku i marcu.
- Nie wykonujemy arytmetyki na natywnym `Date`. Wszystkie obliczenia dat idą przez Luxon.
- Konkretne terminy zajęć (wystąpienia) są wyliczane z `recurrence` i `exceptions`, a nie zapisywane w bazie.
- `interval: 2` oznacza zajęcia co dwa tygodnie (tygodnie parzyste lub nieparzyste).
- Edycja „tylko tego terminu” tworzy wpis w `exceptions`. Edycja „całej serii” zmienia dokument.
- Semestr (`Semester`) przechowuje datę rozpoczęcia, dni wolne i opcjonalny harmonogram roku akademickiego (`academicYear`: semestry z okresami `teaching`, `break`, `exams`, `event`, `day-off` oraz nazwane dni wolne). Gdy harmonogram istnieje, `daysOff` jest z niego wyliczane.
- Z harmonogramem „tydzień N” zajęć w danym dniu tygodnia to N-ta data tego dnia w okresach `teaching` semestru; dzień wolny w okresie zajęć liczy się jako tydzień, a zajęcia tego dnia przepadają. Bez harmonogramu tygodnie to 7-dniowe okna od początku semestru, z pominięciem okien, w których wszystkie dni robocze są wolne.
- Kolokwia, egzaminy i notatki to wpisy w osobnej kolekcji `entries` (jeden dokument na wpis, `{ id, entry }` w planie). Kolokwium i egzamin są „w czasie zajęć” (`anchor.type: 'class'`) albo w osobnym terminie (`'own'`: data, godziny, opcjonalnie budynek i sala); notatka dotyczy terminu zajęć albo całego przedmiotu (`'subject'`). Przypomnienia to `P7D`, `P1D`, `PT2H`.
- Wpis „w czasie zajęć” jest przypięty przez przedmiot, typ zajęć, datę i godzinę rozpoczęcia, a nie przez id serii, dzięki czemu przetrwa ponowny import planu. Gdy godzina się zmieni, a tego dnia jest tylko jedne takie zajęcia, wpis zostaje przy nich. Wpisy, których zajęcia zniknęły (odwołane, dzień wolny, inny plan), trafiają na listę „Wpisy bez terminu”.
- Zapis planu bez pola `entries` (np. ze strony wczytanej przed wydaniem z wpisami) nie usuwa wpisów na serwerze.
- Pliki .ics buduje tylko `calendarIcs` z `@mruos/shared/ics`, wspólny dla pobierania i subskrypcji (frontend ładuje go dynamicznie). Kolokwium lub egzamin w czasie zajęć jest częścią wydarzenia zajęć; w osobnym terminie to osobne wydarzenie. Opcje: kolokwia i egzaminy, notatki, dni wolne, przerwy i sesja.
- Typy i schematy zod są zdefiniowane wyłącznie w `packages/shared` i importowane przez frontend oraz backend.

## Konwencje kodu

- Nazwy w kodzie (zmienne, funkcje, pliki) po angielsku. Teksty w interfejsie po polsku.
- Bez `any`. Jeśli typ jest nieznany, używamy `unknown` i zawężamy.
- Eksporty nazwane, bez `export default` (wyjątek: pliki, które wymagają go przez narzędzia).
- Komponenty React jako funkcje, stan lokalny przez hooki.
- Kolory w `apps/web/src/index.css` tylko przez zmienne `--color-*`, z wartością dla jasnego i ciemnego motywu (`:root[data-theme='dark']`). Kolory bloków zajęć liczy `classBlockColors` z `@mruos/shared`.
- Dostęp do danych na frontendzie tylko przez interfejs repozytorium (`EventRepository`), żeby implementację localStorage można było podmienić na API bez zmian w komponentach.
- Testy obok kodu: `nazwa.ts` i `nazwa.test.ts`.
- Logika domeny w `packages/shared` musi mieć testy jednostkowe przed użyciem w UI.

## Bezpieczeństwo (backend)

- Hasła hashowane przez argon2.
- Sesja w ciasteczku `httpOnly`, `secure`, `sameSite`. Tokenów nie przechowujemy w localStorage.
- Każde zapytanie do bazy dotyczące wydarzeń jest filtrowane po `userId` zalogowanego użytkownika.
- Walidacja wejścia schematami zod na każdym endpoincie.
- `helmet` oraz rate limiting na endpointach logowania i rejestracji.
- Subskrypcja kalendarza (kolekcja `calendarfeeds`, jedna na konto): w bazie tylko SHA-256 tokenu z linku, token pokazywany raz; nieznany lub unieważniony link daje 404; `/ical` działa bez sesji, ma własny limit zapytań i jest usuwany razem z kontem.
- Zmiana hasła i usunięcie konta wymagają obecnego hasła. Zmiana hasła i „wyloguj pozostałe urządzenia” zwiększają `sessionVersion` użytkownika, co unieważnia jego pozostałe sesje.
- Sekrety tylko w zmiennych środowiskowych, nigdy w repozytorium.

## Sposób pracy

- Pracujemy etapami z `ROADMAP.md`. Jeden etap to jedna gałąź i jeden pull request.
- Etap jest ukończony dopiero wtedy, gdy spełnione są jego kryteria „Gotowe, gdy” i przechodzą testy.
- Przed dodaniem nowej zależności zapytaj i uzasadnij wybór.
- Małe, opisowe commity w konwencji Conventional Commits (np. `feat(shared): expand weekly recurrence`).
- Jeśli wymaganie jest niejasne, zapytaj zamiast zgadywać.
- Wydania: `main` to środowisko testowe (Render `mruos-api-staging`, podglądy Vercel), gałąź `production` to produkcja. Wdrożenie produkcyjne: `git push origin main:production` po sprawdzeniu zmian w środowisku testowym.

## Komendy

Wymagania: Node.js 22 lub nowszy i pnpm 10. MongoDB 7.0+ (np. Atlas) jest potrzebne tylko do trwałych danych lokalnie i w produkcji.

Backend czyta opcjonalny root `.env` (wzór w `.env.example`). Lokalnie bez `MONGODB_URI` API startuje z tymczasową bazą w pamięci i losowym `SESSION_SECRET`; w produkcji (`NODE_ENV=production`) wymagane są `MONGODB_URI`, `SESSION_SECRET` (co najmniej 32 znaki) i `ORIGIN_SECRET`.

- Instalacja zależności: `pnpm install`
- Uruchomienie frontendu i API: `pnpm dev` (frontend: http://localhost:5173, API: http://localhost:3001)
- Testy wszystkich pakietów: `pnpm test` (testy integracyjne API uruchamiają MongoDB przez `mongodb-memory-server`; przy pierwszym uruchomieniu pobiera on binarkę do `~/.cache/mongodb-binaries`, a każda instancja potrzebuje ok. 200 MB w `/tmp`)
- Testy E2E (Playwright, desktop i emulacja telefonu): `pnpm test:e2e`; przy pierwszym uruchomieniu zainstaluj przeglądarkę: `pnpm exec playwright install chromium`. Testy startują własne API (port 3101, MongoDB w pamięci) i frontend (port 5174), więc nie kolidują z `pnpm dev`
- Lint: `pnpm lint`
- Build wszystkich pakietów: `pnpm build`
- Kontrola formatowania: `pnpm exec prettier --check .`
