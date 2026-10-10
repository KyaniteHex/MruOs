import { AppHeader } from './AppHeader';
import { repositoryErrorMessages, usePlan } from './planContext';
import { slowServerMessage, useSlowHint } from './useSlowHint';

/** Shown instead of a page while the account's plan is not there yet. */
export function PlanStatusScreen() {
  const plan = usePlan();
  const slow = useSlowHint(plan.status === 'loading');

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="workspace">
        {plan.status === 'failed' ? (
          <div className="storage-alert" role="alert">
            <span>
              {plan.storageError
                ? repositoryErrorMessages[plan.storageError]
                : 'Nie udało się wczytać planu.'}
            </span>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void plan.retry()}
            >
              Spróbuj ponownie
            </button>
          </div>
        ) : (
          <p className="plan-loading" role="status">
            Wczytywanie planu…{slow && ` ${slowServerMessage}`}
          </p>
        )}
      </main>
    </div>
  );
}
