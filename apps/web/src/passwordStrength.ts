// A light estimate for the registration and password forms; the server only
// enforces the 12-character minimum.

export type PasswordStrength = {
  /** 0: too short, 1: weak … 4: strong. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hint: string | null;
};

export const minimumPasswordLength = 12;

const commonWords = [
  'haslo',
  'hasło',
  'password',
  'qwerty',
  'admin',
  'student',
  'mruos',
  'kalendarz',
  'zaq1',
  'letmein',
];
const sequences = [
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

function hasPattern(password: string): boolean {
  const lower = password.toLocaleLowerCase('pl-PL');
  if (/(.)\1\1/u.test(password)) {
    return true;
  }
  if (commonWords.some((word) => lower.includes(word))) {
    return true;
  }
  return sequences.some((sequence) =>
    Array.from({ length: sequence.length - 3 }, (_, index) =>
      sequence.slice(index, index + 4),
    ).some(
      (part) =>
        lower.includes(part) || lower.includes([...part].reverse().join('')),
    ),
  );
}

const labels = ['Za krótkie', 'Słabe', 'Średnie', 'Dobre', 'Silne'] as const;

export function passwordStrength(password: string): PasswordStrength {
  if ([...password].length < minimumPasswordLength) {
    return {
      score: 0,
      label: labels[0],
      hint: `Hasło musi mieć co najmniej ${minimumPasswordLength} znaków.`,
    };
  }

  const length = [...password].length;
  const classes = [/\p{Ll}/u, /\p{Lu}/u, /\d/u, /[^\p{L}\d]/u].filter(
    (pattern) => pattern.test(password),
  ).length;
  const pattern = hasPattern(password);
  let score = 1;
  if (length >= 16) score += 1;
  if (classes >= 3) score += 1;
  if (length >= 20 || classes === 4) score += 1;
  if (pattern) score -= 1;
  const clamped = Math.min(4, Math.max(1, score)) as 1 | 2 | 3 | 4;

  const hint = pattern
    ? 'Unikaj powtórzeń, ciągów (1234, abcd, qwerty) i popularnych słów.'
    : clamped >= 3
      ? null
      : classes < 3
        ? 'Dodaj wielkie litery, cyfry lub znaki specjalne albo wydłuż hasło.'
        : 'Dłuższe hasło jest silniejsze, np. kilka słów.';

  return { score: clamped, label: labels[clamped], hint };
}
