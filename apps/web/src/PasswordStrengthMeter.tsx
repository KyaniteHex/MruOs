import { passwordStrength } from './passwordStrength';

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) {
    return null;
  }
  const strength = passwordStrength(password);

  return (
    <div className="password-strength" aria-live="polite">
      <div
        aria-hidden="true"
        className={`password-strength-bar strength-${strength.score}`}
      >
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={step <= strength.score ? 'filled' : ''} />
        ))}
      </div>
      <p>
        Siła hasła: <strong>{strength.label}</strong>
        {strength.hint && <> – {strength.hint}</>}
      </p>
    </div>
  );
}
