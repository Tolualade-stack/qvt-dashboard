import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Create a dashboard · PRIME" };

// Placeholder until Phase 2b builds the "Create a dashboard" onboarding.
export default async function NewWorldPage() {
  await requireAdmin();
  const steps = [
    ["Identity", "Brand name, banner image and logo. PRIME reads the brand's colours from the logo."],
    ["Brand profile", "One or two lines about the brand, its website, industry, category and products."],
    ["What the campaign includes", "Digital, Traditional (TV/Radio), OOH, Experiential, Influencer/KOL, PR."],
    ["Channels and roles", "Which channels it runs on, and who holds each role."],
    ["Targets", "Content pieces, creative assets, spots and the reporting rhythm."],
  ];
  return (
    <div className="space-y-5">
      <section className="prime-gradient overflow-hidden rounded-[30px] p-6 text-white">
        <div className="text-xs font-semibold tracking-[0.2em] text-[#AFC3EE]">COMING IN THE NEXT UPDATE</div>
        <h1 className="mt-2 font-display text-4xl font-black leading-none tracking-tight">Build your brand&apos;s world</h1>
        <p className="mt-3 max-w-72 text-sm text-[#C9D6F5]">Creating a dashboard opens in Phase 2b. Here is what it will ask.</p>
      </section>
      <Card>
        <ol className="space-y-4">
          {steps.map(([title, detail], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy font-display font-black text-white">{i + 1}</span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted">{detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-ink">← Back to your worlds</Link>
    </div>
  );
}
