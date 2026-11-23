"use client";

import { useEffect, useRef, useState } from "react";
import { PrimeMark, PrimeWordmark } from "@/components/prime-logo";

// The animated PRIME logo shown full-screen when the app is opened, once per
// visit (it stays away while you move between screens). Tap to skip.
//
// It is part of the page from the very first frame (not added once the app's
// code has loaded), so the screen never flashes the page and then jumps to the
// intro. A tiny script in the root layout hides it straight away when it has
// already played in this visit, or when the phone is set to reduce motion.

const SEEN_KEY = "prime-intro-seen";

export function IntroSplash() {
  const [phase, setPhase] = useState<"showing" | "leaving" | "hidden">("showing");
  // Decided once per opening (kept if React runs this setup twice).
  const skipRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (skipRef.current === null) {
      let seen = false;
      try {
        seen = sessionStorage.getItem(SEEN_KEY) === "1";
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Storage blocked (private mode): just show it each time.
      }
      skipRef.current = seen || document.documentElement.classList.contains("prime-intro-skip") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    const skip = skipRef.current;

    // Timed from now: the animation started with the first frame, so by the
    // time it fades it has always played in full.
    const timers = skip
      ? [setTimeout(() => setPhase("hidden"), 0)]
      : [setTimeout(() => setPhase("leaving"), 2400), setTimeout(() => setPhase("hidden"), 2900)];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (phase === "hidden") return null;

  return (
    <button
      type="button"
      aria-label="Skip intro"
      onClick={() => setPhase("hidden")}
      className={`prime-intro fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[linear-gradient(160deg,#0B1F4B_0%,#071433_45%,#000000_100%)] transition-opacity duration-500 ${phase === "leaving" ? "opacity-0" : "opacity-100"}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-1/2 size-[440px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(76,125,255,0.4) 0%, rgba(11,31,75,0) 65%)" }}
      />
      <PrimeMark size={120} animated />
      <PrimeWordmark height={60} colour="#FFFFFF" animated />
      <span className="prime-fade-up text-base font-medium text-[#C9D6F5]" style={{ animationDelay: "1s" }}>
        Every campaign. Live.
      </span>
    </button>
  );
}
