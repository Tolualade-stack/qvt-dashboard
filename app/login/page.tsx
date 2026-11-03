import type { Metadata } from "next";
import { PrimeMark, PrimeWordmark } from "@/components/prime-logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · PRIME" };

// PRIME's front door: the animated logo on the navy-to-black gradient, the two
// taglines taking turns, then the sign-in card.
export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#0B1F4B_0%,#071433_45%,#000000_100%)] px-4 py-10 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 left-1/2 size-[440px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(76,125,255,0.4) 0%, rgba(11,31,75,0) 65%)" }}
      />

      <div className="relative flex flex-col items-center gap-6">
        <PrimeMark size={112} animated />
        <PrimeWordmark height={58} colour="#FFFFFF" animated />
        <div className="prime-fade-up relative h-6 w-72 text-center text-base font-medium text-[#C9D6F5]" style={{ animationDelay: "1s" }}>
          <span className="prime-swap-a absolute inset-0">Every campaign. Live.</span>
          <span className="prime-swap-b absolute inset-0" aria-hidden="true">Be the first to know.</span>
        </div>
      </div>

      <div className="prime-fade-up relative mt-10 w-full max-w-sm rounded-3xl bg-white p-6 text-ink shadow-2xl shadow-black/40" style={{ animationDelay: "1.2s" }}>
        <h1 className="mb-4 font-display text-2xl font-black text-navy">Sign in</h1>
        <LoginForm />
      </div>
      <p className="relative mt-6 text-center text-xs text-[#8FA3CC]">Logins are created by your Admin. There is no public sign-up.</p>
    </main>
  );
}
