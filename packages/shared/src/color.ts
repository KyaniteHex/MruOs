// WCAG 2.x contrast for the `#rrggbb` colors accepted by EventSchema.
const hexColorPattern = /^#[\da-fA-F]{6}$/;

// Only pure black and white guarantee at least 4.5:1 on every background.
export const darkEventTextColor = '#000000';
export const lightEventTextColor = '#ffffff';

function linearChannel(channel: number): number {
  const value = channel / 255;

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hexColor: string): number {
  if (!hexColorPattern.test(hexColor)) {
    throw new Error(`Unsupported color format: ${hexColor}`);
  }

  const [red, green, blue] = [1, 3, 5].map((offset) =>
    linearChannel(Number.parseInt(hexColor.slice(offset, offset + 2), 16)),
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((left, right) => right - left);

  return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextColor(backgroundColor: string): string {
  return contrastRatio(backgroundColor, lightEventTextColor) >=
    contrastRatio(backgroundColor, darkEventTextColor)
    ? lightEventTextColor
    : darkEventTextColor;
}

/** Backgrounds and text of the app's two themes, matching index.css. */
export const themeColors = {
  light: { surface: '#ffffff', text: '#1d2a22' },
  dark: { surface: '#1b201d', text: '#e4eae5' },
} as const;

function channels(hexColor: string): [number, number, number] {
  if (!hexColorPattern.test(hexColor)) {
    throw new Error(`Unsupported color format: ${hexColor}`);
  }

  return [1, 3, 5].map((offset) =>
    Number.parseInt(hexColor.slice(offset, offset + 2), 16),
  ) as [number, number, number];
}

/** `color` laid over `base` with the given weight (0 to 1). */
export function mixColors(color: string, base: string, weight: number): string {
  const top = channels(color);
  const bottom = channels(base);

  return `#${top
    .map((channel, index) =>
      Math.round(channel * weight + (bottom[index] ?? 0) * (1 - weight))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/**
 * The colour itself, or a darker (or lighter) version of it that stands out
 * from the background by at least 3:1, as WCAG asks of graphics.
 */
function visibleOn(color: string, background: string, toward: string): string {
  for (let step = 0; step <= 10; step += 1) {
    const candidate = mixColors(toward, color, step / 10);
    if (contrastRatio(candidate, background) >= 3) {
      return candidate;
    }
  }

  return toward;
}

/** Colours of a class block: a light tint with a stripe in the class colour. */
export type ClassBlockColors = {
  tintLight: string;
  tintDark: string;
  stripeLight: string;
  stripeDark: string;
  /** Text on the full class colour, for the selected class. */
  onColor: string;
};

export function classBlockColors(color: string): ClassBlockColors {
  return {
    tintLight: mixColors(color, themeColors.light.surface, 0.18),
    tintDark: mixColors(color, themeColors.dark.surface, 0.3),
    stripeLight: visibleOn(color, themeColors.light.surface, '#000000'),
    stripeDark: visibleOn(color, themeColors.dark.surface, '#ffffff'),
    onColor: readableTextColor(color),
  };
}
