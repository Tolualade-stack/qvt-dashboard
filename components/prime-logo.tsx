// The PRIME logo: the P mark (a tile with the P and the blue "live" dot) and the
// "Prime" wordmark, whose i-dot is the same live dot. Both are fixed shapes drawn
// from the Ragick typeface, so they never depend on a font being installed.

// The P on its own, in a 100 x 100 box (placed with translate(17 15)).
const P_PATH =
  "M32.70 0L0 0L0 70L18 70L18 56.10L39.70 45.70C51.30 40.20 57 30.30 57 21C57 10 48.70 0 32.70 0ZM32.10 31L18 37.90L18 16L31.30 16C36.50 16 38.70 18.70 38.70 22C38.60 25.20 36.20 29 32.10 31Z";

// The wordmark letters, in a 254 x 76 box. The i-dot is drawn separately as the live dot.
const LETTERS = [
  "M32.70 4.20L0 4.20L0 74.20L18 74.20L18 60.30L39.70 49.90C51.30 44.40 57 34.50 57 25.20C57 14.20 48.70 4.20 32.70 4.20ZM32.10 35.20L18 42.10L18 20.20L31.30 20.20C36.50 20.20 38.70 22.90 38.70 26.20C38.60 29.40 36.20 33.20 32.10 35.20Z",
  "M75.50 22.60L58.40 22.60L58.40 74.20L75.50 74.20L75.50 50C75.50 43 80.90 39 88.80 39C91.10 39 93.70 39.40 96.40 40.10L96.40 21.70C94.40 21.30 92.50 21.10 90.70 21.10C83.30 21.10 78.30 24.90 75.50 31.20Z",
  "M115.30 74.20L115.30 22.80L98.20 22.80L98.20 74.20Z",
  "M199.90 74.20L199.90 44.10C199.90 28.70 192.40 21.30 181.90 21.30C174.70 21.30 168.90 24.60 166 31C163 24.40 157.50 21.30 150.40 21.30C144.70 21.30 140 23.40 136.80 27.40L136.80 22.60L119.70 22.60L119.70 74.20L136.80 74.20L136.80 42.80C137.50 38.60 140 36 144 36C148.20 36 151.40 39 151.40 46.40L151.40 74.20L168.40 74.20L168.40 44.10C168.40 43.50 168.40 42.90 168.40 42.30C169.20 38.40 171.70 36 175.50 36C180.20 36 182.80 39 182.80 46.40L182.80 74.20Z",
  "M243.60 53.50C239.50 57.60 234.40 59.60 229.90 59.60C227.20 59.60 224.70 58.90 222.70 57.50L251.40 44.80C251.40 30.20 242 21.80 227.50 21.80C211.90 21.80 201.90 31.90 201.90 48.40L201.90 48.50C201.90 66.50 214.60 75.90 229.60 75.90C239.80 75.90 247.10 72.50 253.20 65.50ZM227.10 35.30C230.50 35.30 232.70 37.90 233.40 41.20L218.50 47.90C218.70 40 222 35.30 227.10 35.30Z",
];

export const LIVE_BLUE = "#4C7DFF";

// The P alone, as an SVG to place inside a tile (also used for the app icon).
export function PGlyph({ size, colour = "#FFFFFF", animated = false }: { size: number; colour?: string; animated?: boolean }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100">
      <path transform="translate(17 15)" fill={colour} fillRule="evenodd" d={P_PATH} />
      <circle cx="84" cy="19" r="8" fill={LIVE_BLUE} className={animated ? "prime-dot-in" : undefined} />
    </svg>
  );
}

// The P mark: the P on a navy-to-black rounded tile.
export function PrimeMark({ size = 36, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <span
      role="img"
      aria-label="PRIME"
      className={`prime-gradient relative inline-flex shrink-0 items-center justify-center overflow-hidden ${animated ? "prime-mark-in" : ""}`}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <PGlyph size={size * 0.72} animated={animated} />
      {animated && (
        <span
          aria-hidden="true"
          className="prime-sheen absolute -top-1/5 left-0 h-[140%] w-2/5"
          style={{ background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 100%)" }}
        />
      )}
    </span>
  );
}

// The "Prime" wordmark. `height` sets its size; the width follows.
export function PrimeWordmark({ height = 24, colour = "#0B1F4B", animated = false }: { height?: number; colour?: string; animated?: boolean }) {
  return (
    <svg role="img" aria-label="Prime" height={height} width={(height * 258) / 80} viewBox="-2 -2 258 80" style={{ overflow: "visible" }}>
      {LETTERS.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={colour}
          fillRule="evenodd"
          className={animated ? "prime-letter-in" : undefined}
          style={animated ? { animationDelay: `${0.35 + i * 0.07}s` } : undefined}
        />
      ))}
      <circle
        cx="106.65"
        cy="9.35"
        r="9.35"
        fill={LIVE_BLUE}
        className={animated ? "prime-dot-in" : undefined}
        style={animated ? { animationDelay: "0.85s" } : undefined}
      />
    </svg>
  );
}
