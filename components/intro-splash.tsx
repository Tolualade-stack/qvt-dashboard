"use client";

import { useEffect, useState } from "react";
import { PrimeMark, PrimeWordmark } from "@/components/prime-logo";

// The animated PRIME logo shown full-screen when the app is opened, once per
// visit (it stays away while you move between screens). Tap to skip.
// Skipped entirely for people whose phone is set to reduce motion.

const SEEN_KEY = "prime-intro-seen";

export function IntroSplash() {
  const [phase, setPhase] = useState<"hidden" | "showing" | "leaving">("hidden");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage blocked (private mode): just show it each time.
    }
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Deferred a tick so the first paint shows the intro, not a flash of the page.
    const show = setTimeout(() => setPhase("showing"), 0);
    const leave = setTimeout(() => setPhase("leaving"), 2400);
    const hide = setTimeout(() => setPhase("hidden"), 2900);
    return () => [show, leave, hide].forEach(clearTimeout);
  }, []);

  if (phase === "hidden") return null;

  return (
    <button
      type="button"
      aria-label="Skip intro"
      onClick={() => setPhase("hidden")}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[linear-gradient(160deg,#0B1F4B_0%,#071433_45%,#000000_100%)] transition-opacity duration-500 ${phase === "leaving" ? "opacity-0" : "opacity-100"}`}
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
