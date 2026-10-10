import { describe, expect, it } from 'vitest';
import {
  classBlockColors,
  contrastRatio,
  darkEventTextColor,
  lightEventTextColor,
  mixColors,
  readableTextColor,
  relativeLuminance,
  themeColors,
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

describe('class block colours', () => {
  // Default class colours and extremes a student might pick.
  const colors = [
    '#25745b',
    '#bf6548',
    '#39789a',
    '#96703e',
    '#7a5c99',
    '#000000',
    '#ffffff',
    '#ffeb3b',
    '#00ffff',
    '#ff00ff',
    '#777777',
  ];

  it('mixes colours channel by channel', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColors('#25745b', '#ffffff', 0)).toBe('#ffffff');
    expect(mixColors('#25745b', '#ffffff', 1)).toBe('#25745b');
  });

  it('keeps text on the tint readable in both themes', () => {
    for (const color of colors) {
      const block = classBlockColors(color);
      expect(
        contrastRatio(block.tintLight, themeColors.light.text),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(block.tintDark, themeColors.dark.text),
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(color, block.onColor)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the stripe visible on both backgrounds', () => {
    for (const color of colors) {
      const block = classBlockColors(color);
      expect(
        contrastRatio(block.stripeLight, themeColors.light.surface),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(block.stripeDark, themeColors.dark.surface),
      ).toBeGreaterThanOrEqual(3);
    }
    // A colour that already stands out is used as it is.
    expect(classBlockColors('#25745b').stripeLight).toBe('#25745b');
  });
});
