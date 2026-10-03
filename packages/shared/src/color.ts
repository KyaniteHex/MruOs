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
