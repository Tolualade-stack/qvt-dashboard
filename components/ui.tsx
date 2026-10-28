// Small shared building blocks so every screen looks the same.
// Sizes are chosen for phones first: large tap targets, single column.

import type { ComponentProps, ReactNode } from "react";

export function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-semibold text-slate-900">{children}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-base font-semibold text-slate-900">{children}</h2>;
}

const BADGE_TONES = {
  grey: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
} as const;

export function Badge({ children, tone = "grey" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

const BUTTON_STYLES = {
  primary: "bg-slate-900 text-white hover:bg-slate-700",
  secondary: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BUTTON_STYLES }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-slate-900 focus:outline-none";

// Success or error message after a form is submitted.
export function FormMessage({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state?.message) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>
      {state.message}
    </p>
  );
}

// A thin coloured strip in the brand's colour.
export function BrandStripe({ colour }: { colour: string }) {
  return <span className="block h-1.5 w-full rounded-full" style={{ backgroundColor: colour }} />;
}
