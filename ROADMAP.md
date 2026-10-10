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
- [x] Testy E2E w CI blokujące merge przy błędzie

**Gotowe, gdy:** wszystkie scenariusze przechodzą w CI.

## Etap 7: Wdrożenie

- [x] Frontend na Vercel
- [x] Backend na Render lub Railway
- [x] Baza w MongoDB Atlas
- [x] Zmienne środowiskowe i osobne środowisko testowe
- [x] README z opisem projektu i instrukcją uruchomienia

**Gotowe, gdy:** aplikacja działa pod publicznym adresem, a nowa osoba może się zarejestrować i wprowadzić plan.

## Etap 8: Import z Excela (po MVP)

- [x] Wgranie pliku .xlsx i wybór arkusza
- [x] Rozpoznanie zajęć z bloków planu (przedmiot, typ, grupa, godziny, tygodnie, sala); zmienione z „mapowania kolumn”, bo plany uczelni to bloki tekstu na siatce, a nie kolumny
- [x] Wybór grupy z planu obejmującego wiele grup (osobno dla każdego przedmiotu)
- [x] Podgląd wynikowych zajęć przed zapisem, z oznaczeniem miejsc do poprawy
- [x] Ostrzeżenia o kolizjach już przy wyborze grup (także z obecnym planem)
- [x] Testy na prawdziwych plikach (Farmacja, Kosmetologia I i II stopnia)

**Gotowe, gdy:** import planu z prawdziwego pliku uczelni daje poprawny kalendarz bez ręcznych poprawek albo z jasno wskazanymi miejscami do poprawy.

## Etap 9: Harmonogram roku akademickiego

- [x] Okno „Rok akademicki” zamiast „Semestr”: semestr zimowy i letni z pozycjami (nazwa, rodzaj: zajęcia, przerwa, sesja, wydarzenie, dzień wolny, daty od–do), dodawanie i usuwanie pozycji
- [x] Dni wolne od zajęć: święta ustawowe wyliczane dla wybranego roku (z Wielkanocą, Wigilią i 15 sierpnia), z możliwością edycji, usuwania, dodawania i przywrócenia
- [x] Numeracja tygodni według okresów zajęć: tydzień N to N-ty dzień zajęć w okresach „Zajęcia”; święto w okresie zajęć liczy się jako tydzień, a zajęcia przepadają
- [x] Import z Excela i formularz zajęć liczą tygodnie z harmonogramu (wybór semestru zamiast daty początku)
- [x] Dni wolne jako bloki z nazwą, przerwy, sesje i wydarzenia jako paski w kalendarzu; szczegóły po kliknięciu
- [x] Zapis harmonogramu w koncie i w przeglądarce, zgodny wstecz ze starymi danymi

**Gotowe, gdy:** harmonogram UMK 2026/27 wpisany w formularzu daje poprawne daty importu planu Farmacji (zmiana sali 2.02 trafia w tydzień 15), a dni wolne i przerwy są widoczne w kalendarzu na desktopie i telefonie.

## Etap 10: Konto i prywatność

- [x] Strony aplikacji (React Router): `/` logowanie, `/rejestracja`, `/kalendarz`, `/konto`, `/prywatnosc`; reguła na Vercelu, żeby adresy działały po odświeżeniu
- [x] Strona startowa z logowaniem; zalogowany trafia do kalendarza, niezalogowany z `/kalendarz` do logowania
- [x] „Wypróbuj bez konta”: tryb lokalny, plan zapisany w przeglądarce
- [x] „Nie wylogowuj mnie”: sesja na 30 dni, bez zaznaczenia do zamknięcia przeglądarki
- [x] Rejestracja na osobnej stronie, ze wskaźnikiem siły hasła
- [x] Ustawienia konta: zmiana hasła (wylogowuje pozostałe urządzenia), wylogowanie ze wszystkich urządzeń, pobranie moich danych, usunięcie konta
- [x] Czasowa blokada konta po wielu nieudanych logowaniach
- [x] Strona „Prywatność”: jakie dane przechowujemy, po co, jak je pobrać i usunąć
- [x] Aktualizacja akcji GitHub Actions do wersji na Node 24

**Gotowe, gdy:** nowa osoba trafia na stronę logowania, może założyć konto albo wypróbować aplikację bez konta, zmienić hasło, pobrać i usunąć swoje dane; testy integracyjne potwierdzają, że usunięcie konta usuwa wszystkie dane i sesje, a zmiana hasła unieważnia sesje na innych urządzeniach; scenariusze E2E przechodzą na desktopie i telefonie.

## Etap 11: Kolokwia, egzaminy i notatki

- [x] Model danych: kolokwium i egzamin w czasie zajęć albo w osobnym terminie (data, godziny, budynek, sala), notatka do terminu albo całego przedmiotu
- [x] Zapis wpisów w przeglądarce i w koncie (API z filtrowaniem po użytkowniku), w kopii JSON i w „Pobierz moje dane”
- [x] Przyciski „+ Kolokwium”, „+ Egzamin”, „+ Notatka” w szczegółach zajęć oraz „+ Kolokwium / egzamin” nad kalendarzem; edycja i usuwanie wpisów
- [x] Oznaczenia w kalendarzu: ⚑ i pomarańczowa obwódka dla kolokwium, ★ i czerwona dla egzaminu, osobne bloki dla wpisów w osobnym terminie, ✎ dla notatki, opisy dla czytników ekranu
- [x] Panel „Nadchodzące”: kolokwia i egzaminy z 14 dni, z odliczaniem; napis, gdy nic nie ma
- [x] Wpisy przetrwają ponowny import planu; wpisy bez terminu trafiają na osobną listę
- [x] Eksport .ics z wyborem: kolokwia i egzaminy (z przypomnieniami do wyboru: tydzień, dzień, 2 godziny wcześniej) oraz notatki

**Gotowe, gdy:** do zajęć da się dodać kolokwium, w sesji egzamin, a do zajęć notatkę; wpisy są widoczne w kalendarzu i w „Nadchodzących” i przetrwają ponowny import planu.

## Etap 12: Subskrypcja kalendarza

- [x] Tajny link subskrypcji dla każdego konta, pokazany tylko raz przy utworzeniu; generowanie nowego unieważnia stary, można też wyłączyć subskrypcję; na serwerze tylko skrót tokenu
- [x] Adres .ics bez logowania: zajęcia z wyjątkami oraz do wyboru kolokwia i egzaminy z przypomnieniami (domyślnie włączone), notatki, dni wolne, przerwy i sesja (domyślnie wyłączone); zmiana ustawień bez nowego linku
- [x] Kolokwium lub egzamin w czasie zajęć to jedno wydarzenie z zajęciami (np. „⚑ Matematyka · Kolokwium”), także w pobieranym pliku .ics; te same opcje w oknie „Eksport ICS”
- [x] Generowanie .ics w `packages/shared`, wspólne dla pliku i subskrypcji
- [x] Limit zapytań do adresu subskrypcji
- [x] Instrukcja dodania w Google Calendar, na iPhonie i Macu

**Gotowe, gdy:** link dodany w Google Calendar pokazuje plan, zmiana w MruOS pojawia się po odświeżeniu przez Google, a unieważniony link przestaje działać.

## Później (do wyboru)

- Konto: reset hasła i potwierdzanie adresu e-mailem (wymaga usługi mailowej), usuwanie kont nieaktywnych, sprawdzanie haseł w bazie wycieków, logowanie przez Google
- Na co dzień: widok tygodnia, ekran „Dziś” z linkiem do mapy, aplikacja na telefon (PWA), ciemny motyw
- Studia: obecności z licznikiem nieobecności, oceny i zaliczenia, karta przedmiotu
- Technika: mniejsza paczka frontendu, dostrojenie hashowania haseł
- Logi API: zapis błędów 500 (metoda, ścieżka, komunikat i stos, bez treści zapytań i e-maili) oraz krótki log zapytań (metoda, ścieżka, status, czas; bez `/health`, z zamaskowanym kodem w `/ical/…`), żeby awarie zostawiały ślad, a pobrania subskrypcji przez Google były widoczne w logach Rendera
- Notatki: eksport do czytelnego pliku (np. do wydruku), pogrupowany po przedmiotach
- Długoterminowo: integracja z USOS, udostępnianie planu (zmienia założenie, że plany nie są współdzielone)
