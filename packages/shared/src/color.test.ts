import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  darkEventTextColor,
  lightEventTextColor,
  readableTextColor,
  relativeLuminance,
} from './color.js';

describe('color contrast', () => {
  it('matches WCAG reference values', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBe(1);
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('picks dark text on light colors and light text on dark colors', () => {
    expect(readableTextColor('#ffeb3b')).toBe(darkEventTextColor);
    expect(readableTextColor('#25745b')).toBe(lightEventTextColor);
  });

  it('keeps at least 4.5:1 contrast for any user color', () => {
    const steps = ['00', '33', '66', '80', '99', 'cc', 'ff'];

    for (const red of steps) {
      for (const green of steps) {
        for (const blue of steps) {
          const background = `#${red}${green}${blue}`;

          expect(
            contrastRatio(background, readableTextColor(background)),
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('rejects colors outside the stored format', () => {
    expect(() => relativeLuminance('red')).toThrow();
  });
});
