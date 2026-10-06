import { describe, expect, it } from 'vitest';
import { passwordStrength } from './passwordStrength';

describe('passwordStrength', () => {
  it('requires the minimum length first', () => {
    expect(passwordStrength('Krótkie1!')).toMatchObject({
      score: 0,
      label: 'Za krótkie',
    });
  });

  it('rates longer and more varied passwords higher', () => {
    const weak = passwordStrength('ksiazkakwiat');
    const medium = passwordStrength('ksiazkakwiatmorze');
    const strong = passwordStrength('Książka-Kwiat-Morze-7');

    expect(weak.score).toBe(1);
    expect(medium.score).toBe(2);
    expect(strong).toEqual({ score: 4, label: 'Silne', hint: null });
    expect(weak.hint).toContain('Dodaj wielkie litery');
  });

  it('penalises sequences, repeats and common words', () => {
    for (const password of [
      'Abcd-efgh-ijkl-9',
      'Zielony-aaa-Las-7',
      'Haslo-do-Mruos-2026',
      'Qwerty-Morze-Las-7',
    ]) {
      const result = passwordStrength(password);
      expect(result.score).toBeLessThan(4);
      expect(result.hint).toContain('Unikaj powtórzeń');
    }
  });
});
