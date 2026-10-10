import { useEffect, useState } from 'react';
import type { CalendarFeed, CalendarFeedOptions } from '@mruos/shared';
import { accountErrorMessages } from '../accountApi';
import type { AccountApi, AccountApiError } from '../accountApi';

type CalendarSubscriptionProps = {
  api: AccountApi;
  apiBaseUrl: string;
  /** Called when the session turned out to be over; must be stable. */
  onUnauthorized: () => unknown;
};

const optionLabels: Record<keyof CalendarFeedOptions, string> = {
  assessments: 'Kolokwia i egzaminy, z przypomnieniami',
  notes: 'Notatki, w opisach zajęć',
  daysOff: 'Dni wolne od zajęć',
  periods: 'Przerwy i sesja',
};

function formatDate(isoDateTime: string): string {
  return isoDateTime.slice(0, 10).split('-').reverse().join('.');
}

/** The subscription link: "Kalendarz w telefonie" in the settings. */
export function CalendarSubscription({
  api,
  apiBaseUrl,
  onUnauthorized,
}: CalendarSubscriptionProps) {
  const [feed, setFeed] = useState<CalendarFeed | null>(null);
  // The link is known only right after it is created.
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.calendarFeed().then((result) => {
      if (result.success) {
        setFeed(result.value);
        return;
      }
      if (result.error === 'unauthorized') {
        onUnauthorized();
      }
      setError(accountErrorMessages[result.error]);
    });
  }, [api, onUnauthorized]);

  function fail(code: AccountApiError) {
    if (code === 'unauthorized') {
      onUnauthorized();
    }
    setError(accountErrorMessages[code]);
  }

  async function createLink() {
    setBusy(true);
    setError(null);
    const result = await api.createCalendarFeed();
    setBusy(false);
    if (!result.success) {
      fail(result.error);
      return;
    }

    const { token, ...created } = result.value;
    setFeed(created);
    setCopied(false);
    setLink(
      new URL(
        `${apiBaseUrl}/ical/${token}.ics`,
        window.location.origin,
      ).toString(),
    );
  }

  async function changeOption(option: keyof CalendarFeedOptions) {
    if (!feed) {
      return;
    }

    const options = { ...feed.options, [option]: !feed.options[option] };
    setFeed({ ...feed, options });
    setError(null);
    const result = await api.updateCalendarFeedOptions(options);
    if (result.success) {
      setFeed(result.value);
    } else {
      setFeed(feed);
      fail(result.error);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    const result = await api.deleteCalendarFeed();
    setBusy(false);
    if (!result.success) {
      fail(result.error);
      return;
    }
    setLink(null);
    setFeed((current) => current && { ...current, active: false });
  }

  async function copyLink() {
    if (!link) {
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError('Nie udało się skopiować. Zaznacz link i skopiuj go ręcznie.');
    }
  }

  return (
    <div className="calendar-subscription">
      <p className="field-hint">
        Link, który dodajesz w Kalendarzu Google, na iPhonie albo na Macu. Plan
        pojawi się tam i będzie aktualizował się sam. Każdy, kto zna link,
        zobaczy Twój plan, więc go nie udostępniaj.
      </p>

      {link && (
        <div className="feed-link" role="status">
          <p>
            <strong>Twój link.</strong> Pokazujemy go tylko teraz: skopiuj go
            albo od razu dodaj do kalendarza.
          </p>
          <input
            aria-label="Link subskrypcji"
            onFocus={(event) => event.target.select()}
            readOnly
            value={link}
          />
          <div className="feed-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => void copyLink()}
            >
              {copied ? 'Skopiowano' : 'Kopiuj link'}
            </button>
            <a
              className="secondary-button"
              href={link.replace(/^https?:/, 'webcal:')}
            >
              Dodaj do Apple
            </a>
          </div>
        </div>
      )}

      {feed?.active && (
        <>
          {!link && feed.createdAt && (
            <p className="field-hint">
              Subskrypcja działa od {formatDate(feed.createdAt)}. Link był
              widoczny tylko przy tworzeniu; jeśli go nie masz, wygeneruj nowy.
            </p>
          )}
          <fieldset className="form-section feed-options">
            <legend>Co wysyłać do kalendarza oprócz zajęć</legend>
            {(Object.keys(optionLabels) as (keyof CalendarFeedOptions)[]).map(
              (option) => (
                <label className="interval-option" key={option}>
                  <input
                    checked={feed.options[option]}
                    onChange={() => void changeOption(option)}
                    type="checkbox"
                  />
                  <span>{optionLabels[option]}</span>
                </label>
              ),
            )}
            <p className="field-hint">
              Zmiany trafią do kalendarza przy jego najbliższym odświeżeniu.
            </p>
          </fieldset>
        </>
      )}

      {error && (
        <p className="form-errors" role="alert">
          {error}
        </p>
      )}

      {feed && (
        <div className="feed-actions">
          {feed.active ? (
            <>
              <button
                className="secondary-button"
                disabled={busy}
                type="button"
                onClick={() => void createLink()}
              >
                Wygeneruj nowy link
              </button>
              <button
                className="danger-button"
                disabled={busy}
                type="button"
                onClick={() => void turnOff()}
              >
                Wyłącz subskrypcję
              </button>
            </>
          ) : (
            <button
              className="primary-button"
              disabled={busy}
              type="button"
              onClick={() => void createLink()}
            >
              Utwórz link
            </button>
          )}
        </div>
      )}
      {feed?.active && (
        <p className="field-hint">
          Nowy link od razu wyłącza stary. Wyłączenie subskrypcji zatrzymuje
          aktualizacje; to, co już jest w kalendarzu, usuniesz w jego
          ustawieniach.
        </p>
      )}

      <details className="feed-help">
        <summary>Jak dodać link do kalendarza</summary>
        <h3>Kalendarz Google</h3>
        <ol>
          <li>Otwórz calendar.google.com na komputerze.</li>
          <li>Przy „Inne kalendarze” kliknij „+”, a potem „Z adresu URL”.</li>
          <li>Wklej link i kliknij „Dodaj kalendarz”.</li>
        </ol>
        <p>
          Aplikacja na telefonie nie dodaje kalendarzy z adresu, ale kalendarz
          dodany na komputerze pokaże się też w telefonie. Google odświeża
          subskrypcje samodzielnie, zwykle co kilka godzin.
        </p>
        <h3>iPhone</h3>
        <ol>
          <li>
            Otwórz tę stronę na iPhonie i stuknij „Dodaj do Apple” albo w
            Ustawieniach otwórz Kalendarz → Konta → Dodaj konto → Inne → „Dodaj
            subskrybowany kalendarz” i wklej link.
          </li>
          <li>Żeby działały przypomnienia, wyłącz opcję „Usuń alerty”.</li>
        </ol>
        <h3>Mac</h3>
        <ol>
          <li>W Kalendarzu wybierz Plik → „Nowa subskrypcja kalendarza”.</li>
          <li>
            Wklej link, ustaw częstotliwość odświeżania i odznacz usuwanie
            alertów, jeśli chcesz przypomnień.
          </li>
        </ol>
      </details>
    </div>
  );
}
