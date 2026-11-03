import { ImageResponse } from "next/og";

// The home-screen icon: PRIME's P mark (the Ragick-based P and the blue live dot)
// on the navy-to-black gradient. `size` is the width and height in pixels.
export function appIcon(size: number) {
  const glyph = size * 0.7;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(150deg, #1A3A86 0%, #0B1F4B 45%, #000000 100%)",
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 100 100">
          <path
            transform="translate(17 15)"
            fill="#FFFFFF"
            fillRule="evenodd"
            d="M32.70 0L0 0L0 70L18 70L18 56.10L39.70 45.70C51.30 40.20 57 30.30 57 21C57 10 48.70 0 32.70 0ZM32.10 31L18 37.90L18 16L31.30 16C36.50 16 38.70 18.70 38.70 22C38.60 25.20 36.20 29 32.10 31Z"
          />
          <circle cx="84" cy="19" r="8" fill="#4C7DFF" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
