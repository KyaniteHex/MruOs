# MruOS: plan prac

Zakres MVP: plan zajęć z ręcznym dodawaniem, widok miesiąca i dnia, zapis lokalny, potem backend z kontami. Import z Excela po MVP. Integracje z zewnętrznymi grafikami poza zakresem.

## Etap 0: Fundament

- [x] Monorepo pnpm: `apps/web`, `apps/api`, `packages/shared`
- [x] TypeScript `strict` we wszystkich pakietach
- [x] ESLint i Prettier ze wspólną konfiguracją
- [x] Vite + React + Tailwind w `apps/web`
- [x] Express w `apps/api` (endpoint `GET /health`)
- [x] Vitest skonfigurowany w każdym pakiecie
- [x] GitHub Actions: lint i testy przy każdym pushu
- [x] Sekcja „Komendy” w `CLAUDE.md` uzupełniona

**Gotowe, gdy:** obie aplikacje startują jedną komendą, przykładowy test przechodzi, CI jest zielone.

## Etap 1: Model domeny i logika

- [x] Typy `Event`, `Recurrence`, `Exception`, `Semester` w `packages/shared`
- [x] Schematy zod odpowiadające typom
- [x] Funkcja wyliczająca wystąpienia zajęć w zadanym zakresie dat
- [x] Obsługa wyjątków: odwołanie terminu i nadpisanie pól (np. sali)
- [x] Przeliczanie „tygodnie N do M semestru” na daty
- [x] Pominięcie dni wolnych z ustawień semestru

Testy muszą obejmować:

- [x] zajęcia co tydzień i co dwa tygodnie
- [x] koniec zakresu (ostatni termin włącznie)
- [x] odwołany termin i zmienioną salę w jednym dniu
- [x] konwersję tygodni semestru na daty
- [x] zmianę czasu pod koniec października i marca (godzina zajęć bez zmian)
- [x] przypadek „zajęcia X do 6 tygodnia, od 7 tygodnia zajęcia Y”

**Gotowe, gdy:** wszystkie powyższe testy przechodzą, a logika nie zależy od React ani Express.

## Etap 2: Kalendarz (widoki)

- [x] Widok miesiąca z przewijaniem miesięcy i kolorowymi oznaczeniami zajęć
- [x] Kliknięcie dnia otwiera widok dnia
- [x] Widok dnia z podziałką godzinową (domyślnie 7:00 do 21:00)
- [x] Blok zajęć: przedmiot, sala, godziny, budynek, kolor tła
- [x] Kliknięcie bloku otwiera panel szczegółów
- [x] Zajęcia nakładające się w czasie wyświetlane obok siebie
- [x] Układ działający na telefonie i desktopie

**Gotowe, gdy:** na danych testowych widoki działają płynnie na szerokości telefonu i desktopu.

## Etap 3: Formularz zajęć

- [x] Dodawanie zajęć: przedmiot, typ, kolor, budynek, sala, godziny, dzień tygodnia
- [x] Zakres obowiązywania jako daty albo jako tygodnie semestru
- [x] Opcja „co dwa tygodnie”
- [x] Domyślny kolor zależny od typu zajęć, z możliwością zmiany
- [x] Edycja z wyborem: „tylko ten termin” albo „cała seria”
- [x] Usuwanie terminu lub całej serii
- [x] Walidacja: koniec po początku, data końcowa nie wcześniejsza od początkowej
- [x] Ostrzeżenie o kolizji z innymi zajęciami

**Gotowe, gdy:** da się wprowadzić prawdziwy plan jednego semestru, łącznie z zajęciami zmieniającymi się w trakcie semestru.

## Etap 4: Zapis lokalny i ustawienia

- [x] Interfejs `EventRepository` i implementacja na localStorage
- [x] Ekran ustawień semestru: data rozpoczęcia, dni wolne
- [x] Eksport i import kopii zapasowej (JSON)
- [x] Eksport do pliku .ics
- [x] Obsługa błędów zapisu (np. brak miejsca, uszkodzone dane)

**Gotowe, gdy:** aplikacja jest w pełni używalna bez backendu i przetestowana na prawdziwym planie zajęć.

## Etap 5: Backend

- [x] Struktura MVC: `models/`, `controllers/`, `routes/`, `middleware/`
- [x] Połączenie z MongoDB, modele Mongoose dla `Event`, `Semester`, `User`
- [x] Endpointy: `GET/POST /events`, `PUT/DELETE /events/:id`, `GET/PUT /semester`
- [x] Rejestracja, logowanie, wylogowanie (argon2, sesja w ciasteczku `httpOnly`)
- [x] Walidacja wejścia schematami z `packages/shared`
- [x] `helmet`, rate limiting na logowaniu i rejestracji
- [x] Implementacja `EventRepository` oparta na API we frontendzie
- [x] Przeniesienie danych z localStorage do konta po pierwszym logowaniu

**Gotowe, gdy:** frontend działa na API, a testy integracyjne potwierdzają, że użytkownik A nie może odczytać ani zmienić danych użytkownika B.

## Etap 6: Testy E2E i jakość

- [x] Playwright: rejestracja i logowanie
- [x] Playwright: dodanie zajęć cyklicznych i ich widoczność w kalendarzu
- [x] Playwright: edycja jednego terminu i całej serii
- [x] Playwright: przewijanie miesięcy i widok dnia
- [x] Uruchomienie testów na emulacji telefonu
- [x] Dostępność: nawigacja klawiaturą, czytelny kontrast tekstu na kolorach użytkownika
- [ ] Testy E2E w CI blokujące merge przy błędzie

**Gotowe, gdy:** wszystkie scenariusze przechodzą w CI.

## Etap 7: Wdrożenie

- [ ] Frontend na Vercel
- [ ] Backend na Render lub Railway
- [ ] Baza w MongoDB Atlas
- [ ] Zmienne środowiskowe i osobne środowisko testowe
- [ ] README z opisem projektu i instrukcją uruchomienia

**Gotowe, gdy:** aplikacja działa pod publicznym adresem, a nowa osoba może się zarejestrować i wprowadzić plan.

## Etap 8: Import z Excela (po MVP)

- [ ] Wgranie pliku .xlsx i wybór arkusza
- [ ] Mapowanie kolumn przez użytkownika
- [ ] Wybór grupy z planu obejmującego wiele grup
- [ ] Podgląd wynikowych zajęć przed zapisem
- [ ] Testy na prawdziwych plikach z kilku wydziałów

**Gotowe, gdy:** import planu z prawdziwego pliku uczelni daje poprawny kalendarz bez ręcznych poprawek albo z jasno wskazanymi miejscami do poprawy.
