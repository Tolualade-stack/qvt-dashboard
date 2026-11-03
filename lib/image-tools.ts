// Browser-only image tools used while creating or editing a world.

import { toHex } from "@/lib/colour";

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file isn't an image PRIME can read."));
    img.src = url;
  });
}

// Shrinks a photo so it loads quickly on phones: at most `maxSize` pixels wide or
// tall. Banners become WebP; logos stay PNG so transparent backgrounds survive.
export async function prepareImage(file: File, maxSize: number, type: "image/webp" | "image/png"): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't prepare the image."))), type, 0.85),
  );
}

// Reads the main colours of a logo. Skips see-through, near-white, near-black,
// grey and pale edge pixels (backgrounds and outlines), groups similar shades, and
// returns up to `max` colours, most used first.
export async function detectColours(file: Blob, max = 4): Promise<string[]> {
  const img = await loadImage(file);
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size).data;

  // Count pixels in buckets of similar colour (32 levels per channel).
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    if (a < 128) continue;
    const hi = Math.max(r, g, b);
    const lo = Math.min(r, g, b);
    if (hi > 240 && lo > 225) continue; // near white
    if (hi < 28) continue; // near black
    if (hi - lo < 28) continue; // grey
    if ((hi + lo) / 2 > 200 && hi - lo < 100) continue; // pale blur where colours meet white
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  // Average each bucket, then merge buckets that look alike.
  const found: { count: number; rgb: [number, number, number] }[] = [];
  const sorted = [...buckets.values()].sort((x, y) => y.count - x.count);
  for (const bucket of sorted) {
    const rgb: [number, number, number] = [bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count];
    const near = found.find((f) => Math.hypot(f.rgb[0] - rgb[0], f.rgb[1] - rgb[1], f.rgb[2] - rgb[2]) < 60);
    if (near) near.count += bucket.count;
    else found.push({ count: bucket.count, rgb });
  }
  return found
    .sort((x, y) => y.count - x.count)
    .slice(0, max)
    .map((f) => toHex(f.rgb));
}
