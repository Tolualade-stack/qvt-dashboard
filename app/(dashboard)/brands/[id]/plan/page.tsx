import type { Metadata } from "next";
import Link from "next/link";
import { loadWorld } from "@/lib/world";
import { allocate, type BudgetLine } from "@/lib/budget";
import { budgetChannels, channelName } from "@/lib/campaign";
import { money, type Ad } from "@/lib/ads";
import { BudgetSpread } from "@/components/budget-spread";
import { Card, SectionTitle } from "@/components/ui";
import { deleteBudgetLine } from "./actions";
import { BudgetLineForm, ImportLinesForm, PlanDocumentsForm } from "./plan-forms";
import { FileImportForm } from "./file-import";

export const metadata: Metadata = { title: "Media plan · PRIME" };

// A world's media plan and strategy, and its budget: what was planned for each
// channel and format, and how much has actually been spent so far.
export default async function PlanPage({ params }: PageProps<"/brands/[id]/plan">) {
  const { id } = await params;
  const { me, brand, theme, supabase } = await loadWorld(id);
  const isAdmin = me.role === "admin";

  const [{ data: lineRows }, { data: adRows }] = await Promise.all([
    supabase.from("budget_lines").select("*").eq("brand_id", id).order("sort_order"),
    supabase.from("ads").select("channel, format, currency, spend_to_date").eq("brand_id", id).eq("is_archived", false),
  ]);
  const lines = (lineRows ?? []) as BudgetLine[];
  const spread = allocate(lines, (adRows ?? []) as Pick<Ad, "channel" | "format" | "currency" | "spend_to_date">[]);

  // Uploaded files are private: make short-lived links for whoever is viewing.
  const signed = async (path: string | null) =>
    path ? ((await supabase.storage.from("brand-documents").createSignedUrl(path, 3600)).data?.signedUrl ?? null) : null;
  const [planFile, strategyFile] = await Promise.all([signed(brand.media_plan_path), signed(brand.strategy_path)]);

  const docs = [
    ["Media plan", brand.media_plan_url, planFile],
    ["Strategy", brand.strategy_url, strategyFile],
  ] as const;

  return (
    <div className="space-y-5">
      <Link href={`/brands/${id}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        {brand.name}
      </Link>
      <h1 className="font-display text-3xl leading-none font-black">Media plan &amp; budget</h1>

      <Card>
        <SectionTitle>Plan and strategy</SectionTitle>
        <ul className="space-y-2">
          {docs.map(([label, link, file]) => (
            <li key={label} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3" style={{ backgroundColor: theme.soft }}>
              <span className="font-semibold">{label}</span>
              <span className="flex gap-2">
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-3 py-1.5 text-xs font-bold" style={{ color: theme.ink }}>
                    Open link ↗
                  </a>
                )}
                {file && (
                  <a href={file} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-3 py-1.5 text-xs font-bold" style={{ color: theme.ink }}>
                    Open file ↗
                  </a>
                )}
                {!link && !file && <span className="text-xs text-muted">Not added yet</span>}
              </span>
            </li>
          ))}
        </ul>
        {isAdmin && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-bold">Add or change the plan and strategy</summary>
            <div className="mt-3">
              <PlanDocumentsForm
                brandId={id}
                mediaPlanUrl={brand.media_plan_url}
                strategyUrl={brand.strategy_url}
                mediaPlanPath={brand.media_plan_path}
                strategyPath={brand.strategy_path}
              />
            </div>
          </details>
        )}
      </Card>

      <Card>
        <SectionTitle>Budget spread</SectionTitle>
        {lines.length === 0 ? (
          <p className="text-sm text-muted">No budget lines yet. Add them from the media plan below, and ad spend will fill each one in.</p>
        ) : (
          <BudgetSpread spread={spread} theme={theme} channelLabel={channelName} />
        )}
      </Card>

      {isAdmin && (
        <Card>
          <SectionTitle>Budget lines</SectionTitle>
          {lines.length > 0 && (
            <ul className="mb-4 divide-y divide-line">
              {lines.map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="font-semibold">{channelName(line.channel)}</span>
                    {line.format && <span className="text-muted"> · {line.format}</span>}
                    <span className="block text-xs text-muted">{money(Number(line.planned_amount), line.currency)} planned</span>
                  </span>
                  <form action={deleteBudgetLine.bind(null, line.id, id)}>
                    <button type="submit" className="min-h-9 rounded-full border border-line px-3 text-xs font-semibold">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <FileImportForm brandId={id} />
          <div className="mt-4">
            <BudgetLineForm brandId={id} channels={budgetChannels(brand.channels, brand.marketing_types)} />
          </div>
          <div className="mt-3">
            <ImportLinesForm brandId={id} />
          </div>
        </Card>
      )}
    </div>
  );
}
