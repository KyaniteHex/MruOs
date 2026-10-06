import { Link } from 'react-router';
import { AuthLayout } from './AuthLayout';

export function PrivacyPage() {
  return (
    <AuthLayout title="Prywatność" wide>
      <div className="privacy-text">
        <p>
          MruOS służy do prowadzenia własnego planu zajęć. Zbieramy tylko dane
          potrzebne do tego celu i nie udostępniamy ich nikomu.
        </p>

        <h2>Jakie dane przechowujemy</h2>
        <ul>
          <li>
            <strong>Konto:</strong> adres e-mail, skrót hasła (samego hasła nie
            zapisujemy) i datę założenia konta.
          </li>
          <li>
            <strong>Plan:</strong> wpisane lub zaimportowane zajęcia,
            harmonogram roku akademickiego i dni wolne.
          </li>
          <li>
            <strong>Sesja:</strong> identyfikator sesji w ciasteczku
            <code> mruos.sid</code>, dzięki któremu pozostajesz zalogowany.
          </li>
          <li>
            <strong>Ochrona konta:</strong> liczba nieudanych logowań, zapisana
            pod skrótem adresu e-mail i usuwana po 15 minutach.
          </li>
        </ul>
        <p>
          Dostawcy hostingu mogą przez krótki czas zapisywać techniczne dane
          połączeń, na przykład adres IP, w dziennikach serwera.
        </p>

        <h2>Gdzie są przechowywane</h2>
        <p>
          Dane konta i planu trzyma baza MongoDB Atlas. Serwer aplikacji działa
          w usłudze Render w regionie Frankfurt, a stronę dostarcza Vercel.
        </p>

        <h2>Tryb bez konta</h2>
        <p>
          W trybie bez konta plan zapisuje się wyłącznie w pamięci tej
          przeglądarki i nie trafia na serwer.
        </p>

        <h2>Ciasteczka</h2>
        <p>
          Używamy tylko ciasteczka sesji, niezbędnego do logowania. Nie
          stosujemy analityki, reklam ani ciasteczek śledzących.
        </p>

        <h2>Jak długo</h2>
        <p>
          Dane przechowujemy do czasu usunięcia konta. Sesja z opcją „Nie
          wylogowuj mnie” trwa 30 dni od ostatniej aktywności, a bez niej kończy
          się po zamknięciu przeglądarki.
        </p>

        <h2>Twoje możliwości</h2>
        <ul>
          <li>
            Pobranie kopii danych i usunięcie konta:{' '}
            <Link to="/konto">Konto</Link> („Pobierz moje dane”, „Usuń konto”).
          </li>
          <li>Zmiana hasła i wylogowanie innych urządzeń: także w Koncie.</li>
        </ul>

        <h2>Kontakt</h2>
        <p>
          Pytania o prywatność można zgłaszać w{' '}
          <a href="https://github.com/KyaniteHex/MruOs/issues">
            repozytorium projektu na GitHubie
          </a>
          .
        </p>
        <p>
          <Link to="/">← Wróć</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
