// Colour helpers for theming a brand's world from its logo colours.
// Colours are "#RRGGBB" strings throughout.

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Blends `hex` towards `target` by `amount` (0 = unchanged, 1 = target).
export function mix(hex: string, target: string, amount: number): string {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount) as [number, number, number]);
}

export const darken = (hex: string, amount: number) => mix(hex, "#000000", amount);
export const tint = (hex: string, amount: number) => mix(hex, "#FFFFFF", amount);

// How bright a colour looks (0 = black, 1 = white), per the WCAG formula.
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// White or black, whichever is easier to read on top of `hex`.
export function textOn(hex: string): "#FFFFFF" | "#000000" {
  return contrast(hex, "#FFFFFF") >= contrast(hex, "#000000") ? "#FFFFFF" : "#000000";
}

// A version of the colour dark enough for white text and small coloured text on
// white (4.5:1), used for labels and links so they stay readable.
export function readableShade(hex: string): string {
  let shade = hex;
  for (let i = 0; i < 10 && contrast(shade, "#FFFFFF") < 4.5; i++) shade = darken(shade, 0.12);
  return shade;
}

// The full set of colours a world uses, worked out from its main colour.
export function worldTheme(main: string) {
  return {
    main,
    deep: darken(main, 0.45),       // the dark end of gradients
    ink: readableShade(main),       // coloured text and links on white
    soft: tint(main, 0.9),          // pale tiles and chips
    onMain: textOn(main),           // text on a main-colour button
  };
}
