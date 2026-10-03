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

- [ ] Typy `Event`, `Recurrence`, `Exception`, `Semester` w `packages/shared`
- [ ] Schematy zod odpowiadające typom
- [ ] Funkcja wyliczająca wystąpienia zajęć w zadanym zakresie dat
- [ ] Obsługa wyjątków: odwołanie terminu i nadpisanie pól (np. sali)
- [ ] Przeliczanie „tygodnie N do M semestru” na daty
- [ ] Pominięcie dni wolnych z ustawień semestru

Testy muszą obejmować:

- [ ] zajęcia co tydzień i co dwa tygodnie
- [ ] koniec zakresu (ostatni termin włącznie)
- [ ] odwołany termin i zmienioną salę w jednym dniu
- [ ] konwersję tygodni semestru na daty
- [ ] zmianę czasu pod koniec października i marca (godzina zajęć bez zmian)
- [ ] przypadek „zajęcia X do 6 tygodnia, od 7 tygodnia zajęcia Y”

**Gotowe, gdy:** wszystkie powyższe testy przechodzą, a logika nie zależy od React ani Express.

## Etap 2: Kalendarz (widoki)

- [ ] Widok miesiąca z przewijaniem miesięcy i kolorowymi oznaczeniami zajęć
- [ ] Kliknięcie dnia otwiera widok dnia
- [ ] Widok dnia z podziałką godzinową (domyślnie 7:00 do 21:00)
- [ ] Blok zajęć: przedmiot, sala, godziny, budynek, kolor tła
- [ ] Kliknięcie bloku otwiera panel szczegółów
- [ ] Zajęcia nakładające się w czasie wyświetlane obok siebie
- [ ] Układ działający na telefonie i desktopie

**Gotowe, gdy:** na danych testowych widoki działają płynnie na szerokości telefonu i desktopu.

## Etap 3: Formularz zajęć

- [ ] Dodawanie zajęć: przedmiot, typ, kolor, budynek, sala, godziny, dzień tygodnia
- [ ] Zakres obowiązywania jako daty albo jako tygodnie semestru
- [ ] Opcja „co dwa tygodnie”
- [ ] Domyślny kolor zależny od typu zajęć, z możliwością zmiany
- [ ] Edycja z wyborem: „tylko ten termin” albo „cała seria”
- [ ] Usuwanie terminu lub całej serii
- [ ] Walidacja: koniec po początku, data końcowa nie wcześniejsza od początkowej
- [ ] Ostrzeżenie o kolizji z innymi zajęciami

**Gotowe, gdy:** da się wprowadzić prawdziwy plan jednego semestru, łącznie z zajęciami zmieniającymi się w trakcie semestru.

## Etap 4: Zapis lokalny i ustawienia

- [ ] Interfejs `EventRepository` i implementacja na localStorage
- [ ] Ekran ustawień semestru: data rozpoczęcia, dni wolne
- [ ] Eksport i import kopii zapasowej (JSON)
- [ ] Eksport do pliku .ics
- [ ] Obsługa błędów zapisu (np. brak miejsca, uszkodzone dane)

**Gotowe, gdy:** aplikacja jest w pełni używalna bez backendu i przetestowana na prawdziwym planie zajęć.

## Etap 5: Backend

- [ ] Struktura MVC: `models/`, `controllers/`, `routes/`, `middleware/`
- [ ] Połączenie z MongoDB, modele Mongoose dla `Event`, `Semester`, `User`
- [ ] Endpointy: `GET/POST /events`, `PUT/DELETE /events/:id`, `GET/PUT /semester`
- [ ] Rejestracja, logowanie, wylogowanie (argon2, sesja w ciasteczku `httpOnly`)
- [ ] Walidacja wejścia schematami z `packages/shared`
- [ ] `helmet`, rate limiting na logowaniu i rejestracji
- [ ] Implementacja `EventRepository` oparta na API we frontendzie
- [ ] Przeniesienie danych z localStorage do konta po pierwszym logowaniu

**Gotowe, gdy:** frontend działa na API, a testy integracyjne potwierdzają, że użytkownik A nie może odczytać ani zmienić danych użytkownika B.

## Etap 6: Testy E2E i jakość

- [ ] Playwright: rejestracja i logowanie
- [ ] Playwright: dodanie zajęć cyklicznych i ich widoczność w kalendarzu
- [ ] Playwright: edycja jednego terminu i całej serii
- [ ] Playwright: przewijanie miesięcy i widok dnia
- [ ] Uruchomienie testów na emulacji telefonu
- [ ] Dostępność: nawigacja klawiaturą, czytelny kontrast tekstu na kolorach użytkownika
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
