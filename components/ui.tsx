// Small shared building blocks so every screen looks the same.
// Sizes are chosen for phones first: large tap targets, single column.

import type { ComponentProps, ReactNode } from "react";

export function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-3xl font-black leading-none tracking-tight text-navy">{children}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-white p-5 ${className}`}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl font-black text-ink">{children}</h2>
      {action}
    </div>
  );
}

const BADGE_TONES = {
  grey: "bg-mist text-muted",
  navy: "bg-navy text-white",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-800",
} as const;

export function Badge({ children, tone = "grey" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

const BUTTON_STYLES = {
  primary: "prime-gradient text-white shadow-lg shadow-navy/25 hover:brightness-125",
  secondary: "border border-line bg-white text-ink hover:bg-mist",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BUTTON_STYLES }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "block min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base text-ink focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15";

// Success or error message after a form is submitted.
export function FormMessage({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state?.message) return null;
  return (
    <p role="status" className={`text-sm font-medium ${state.ok ? "text-emerald-700" : "text-red-700"}`}>
      {state.message}
    </p>
  );
}

// A small pulsing dot that says "this is live".
export function LiveDot({ colour = "#2F6BFF" }: { colour?: string }) {
  return <span aria-hidden="true" className="prime-live inline-block size-2 rounded-full" style={{ backgroundColor: colour }} />;
}

// A thin strip in the brand's colour.
export function BrandStripe({ colour }: { colour: string }) {
  return <span className="block h-1.5 w-full rounded-full" style={{ backgroundColor: colour }} />;
}
