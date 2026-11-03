import { ImageResponse } from "next/og";

// The home-screen icon: "QVT" on dark navy with the three brand colours underneath
// (Alieve blue, Ducros green, CCR purple). Drawn in code, so there are no image files
// to keep in sync. `size` is the width and height in pixels.
export function appIcon(size: number) {
  const unit = size / 16;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#ffffff",
          fontSize: unit * 5,
          fontWeight: 700,
          letterSpacing: unit * 0.2,
        }}
      >
        <div>QVT</div>
        <div style={{ display: "flex", gap: unit * 0.5, marginTop: unit * 0.8 }}>
          {["#3B6FD4", "#3F9142", "#7B4FA6"].map((colour) => (
            <div key={colour} style={{ width: unit * 2.4, height: unit * 0.7, borderRadius: unit, background: colour }} />
          ))}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
