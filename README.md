# MruOS

Kalendarz studencki do zarządzania planem zajęć (wersja produkcyjna: https://mru-os.vercel.app). Wpisujesz zajęcia raz, jako serię (przedmiot, typ, sala, godziny, dni tygodnia, zakres semestru), a MruOS pokazuje je w widoku miesiąca i dnia, uwzględniając dni wolne, zajęcia co dwa tygodnie i pojedyncze zmiany terminów.

## Funkcje

- Widok miesiąca i dnia (7:00–21:00), kolory zajęć z czytelnym tekstem na każdym tle.
- Serie zajęć: co tydzień lub co dwa tygodnie, zakres jako daty albo tygodnie semestru.
- Edycja „tylko ten termin” (np. zmiana sali) albo „cała seria”, odwoływanie terminów.
- Ostrzeżenia o kolizjach, ustawienia semestru i dni wolnych.
- Praca bez konta (zapis w przeglądarce) albo z kontem: plan na serwerze, przeniesienie lokalnego planu przy pierwszym logowaniu.
- Import planu z pliku Excel (.xlsx) w formacie siatki dni × godzin z blokami zajęć: wybór grup dla każdego przedmiotu, podgląd i oznaczenie miejsc do poprawy.
- Kopia zapasowa JSON i eksport do kalendarza (.ics).
- Obsługa klawiaturą i układ dla telefonu.

## Architektura

```
przeglądarka ──► Vercel (frontend, apps/web)
                   │  /api/*  →  przekierowanie + nagłówek X-Origin-Secret
                   ▼
                 Render (API, apps/api) ──► MongoDB Atlas
```

Frontend i API działają pod jednym adresem, więc ciasteczko sesji jest `httpOnly`, `Secure`, `SameSite=Lax`. API odrzuca żądania, które nie przyszły przez Vercel (brak sekretu originu), dzięki czemu limit prób logowania liczy się dla prawdziwego adresu IP.

| Katalog           | Zawartość                                                   |
| ----------------- | ----------------------------------------------------------- |
| `apps/web`        | React, Vite, Tailwind, FullCalendar                         |
| `apps/api`        | Express, Mongoose, sesje, argon2                            |
| `packages/shared` | Typy, schematy zod, wyliczanie terminów z reguł powtarzania |
| `e2e`             | Testy Playwright (desktop i emulacja telefonu)              |

## Uruchomienie lokalne

Wymagania: Node.js 22+ i pnpm 10.

```bash
pnpm install
pnpm dev   # frontend: http://localhost:5173, API: http://localhost:3001
```

Bez pliku `.env` API startuje z tymczasową bazą MongoDB w pamięci: konta i plany działają, ale znikają przy każdym restarcie API (także po zmianie kodu). Żeby dane przetrwały, skopiuj `.env.example` do `.env` i ustaw `MONGODB_URI` (np. osobna baza `mruos-dev` w Atlasie) oraz `SESSION_SECRET` (min. 32 znaki).

Bez działającego API aplikacja nadal działa w trybie lokalnym (zapis w przeglądarce).

## Testy i jakość

```bash
pnpm lint                               # ESLint i sprawdzanie typów
pnpm test                               # testy jednostkowe i integracyjne (MongoDB w pamięci)
pnpm exec playwright install chromium   # jednorazowo
pnpm test:e2e                           # testy E2E na własnym API i bazie w pamięci
pnpm build
```

CI (GitHub Actions) uruchamia lint, testy, build oraz testy E2E dla każdego pusha i pull requesta.

## Środowiska i wydania

| Środowisko | Gałąź        | Frontend (Vercel)                 | API (Render)        | Baza (Atlas)    |
| ---------- | ------------ | --------------------------------- | ------------------- | --------------- |
| Produkcja  | `production` | https://mru-os.vercel.app         | `mruos-api`         | `mruos`         |
| Testowe    | `main`       | podglądy (`main` i pull requesty) | `mruos-api-staging` | `mruos-staging` |

Zmiany trafiają do `main` przez pull request i lądują w środowisku testowym. Po sprawdzeniu wydanie produkcyjne to:

```bash
git push origin main:production
```

## Wdrożenie od zera

Wartości oznaczone `<...>` wygeneruj lub skopiuj z paneli usług. Sekrety wpisuj tylko w panelach, nigdy do repozytorium.

### 1. MongoDB Atlas

1. W istniejącym klastrze (najlepiej region Frankfurt) utwórz dwóch użytkowników bazy z rolą `readWrite` tylko do swojej bazy: jednego dla `mruos`, drugiego dla `mruos-staging`.
2. Network Access: dodaj `0.0.0.0/0`. Darmowy Render nie ma stałych adresów IP, więc ochroną są silne, losowe hasła użytkowników.
3. Skopiuj connection string dla każdego użytkownika i dopisz nazwę bazy:
   `mongodb+srv://<user>:<hasło>@<klaster>/mruos?retryWrites=true&w=majority`
   (dla środowiska testowego: `/mruos-staging`).

### 2. Sekrety originu

Wygeneruj dwa różne sekrety, jeden dla produkcji i jeden dla środowiska testowego:

```bash
openssl rand -hex 32
```

### 3. Render (API)

1. Utwórz gałąź produkcyjną: `git push origin main:production`.
2. Render → **New → Blueprint** → wybierz repozytorium. Render odczyta `render.yaml` i utworzy `mruos-api` oraz `mruos-api-staging`.
3. Dla każdego serwisu podaj `MONGODB_URI` (odpowiednia baza) i `ORIGIN_SECRET` (odpowiedni sekret). `SESSION_SECRET` Render wygeneruje sam.
4. Zanotuj adresy serwisów, np. `https://mruos-api.onrender.com`. Sprawdzenie: `<adres>/health` zwraca `{"status":"ok"}`.

Darmowy serwis usypia po 15 minutach bez ruchu; pierwsze żądanie po przerwie trwa do około minuty.

### 4. Vercel (frontend)

1. Vercel → **Add New → Project** → repozytorium, **Root Directory**: `apps/web`. Resztę ustawień czyta `apps/web/vercel.json`.
2. Settings → Git → **Production Branch**: `production`.
3. Settings → Environment Variables:

   | Zmienna         | Production                       | Preview                                  |
   | --------------- | -------------------------------- | ---------------------------------------- |
   | `API_ORIGIN`    | `https://mruos-api.onrender.com` | `https://mruos-api-staging.onrender.com` |
   | `ORIGIN_SECRET` | sekret produkcyjny               | sekret testowy                           |

   `API_ORIGIN` bez końcowego `/`.

4. Wdróż ponownie i sprawdź, że rejestracja działa pod domeną produkcyjną.

### 5. Ochrona gałęzi

GitHub → Settings → Branches → reguła dla `main` (i `production`): wymagaj zielonych checków `quality` i `e2e` przed merge.

## Zmienne środowiskowe API

| Zmienna          | Wymagana    | Opis                                                             |
| ---------------- | ----------- | ---------------------------------------------------------------- |
| `MONGODB_URI`    | w produkcji | Connection string z nazwą bazy; lokalnie bez niej baza w pamięci |
| `SESSION_SECRET` | w produkcji | Min. 32 znaki, podpis ciasteczka sesji; lokalnie losowy          |
| `ORIGIN_SECRET`  | w produkcji | Min. 32 znaki, taki sam jak w odpowiednim środowisku Vercel      |
| `NODE_ENV`       | nie         | `production` włącza ciasteczka `Secure` i wymaga `ORIGIN_SECRET` |
| `PORT`           | nie         | Domyślnie 3001 (Render ustawia sam)                              |
| `WEB_ORIGIN`     | nie         | Tylko przy frontendzie pod innym adresem (CORS)                  |
