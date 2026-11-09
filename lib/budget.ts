// The media plan's budget lines, and how actual spend fills them.
// A line's spend is what was entered for it in the weekly update. If nothing
// has been entered for it yet, it adds up the spend of the ads that match it:
// an ad counts against the line for its channel and format, or failing that the
// line for its whole channel (format left empty).
// Naira and Dollars are kept apart. Ad spend that matches no line is "unplanned".

import { money, type Ad, type Currency } from "@/lib/ads";

export type BudgetLine = {
  id: string;
  brand_id: string;
  campaign_id?: string | null;
  channel: string;
  format: string | null;
  label: string | null;
  planned_amount: number;
  currency: Currency;
  sort_order: number;
  spend_to_date?: number | null;
  spend_updated_at?: string | null;
};

export type LineWithSpend = BudgetLine & { spent: number; ads: number; recorded: boolean };

type AdSpend = Pick<Ad, "channel" | "format" | "currency" | "spend_to_date">;

export function allocate(lines: BudgetLine[], ads: AdSpend[]) {
  const result: LineWithSpend[] = lines.map((l) => ({
    ...l,
    planned_amount: Number(l.planned_amount),
    recorded: l.spend_to_date != null,
    spent: l.spend_to_date != null ? Number(l.spend_to_date) : 0,
    ads: 0,
  }));
  const unplanned = new Map<Currency, number>();
  const unplannedAds: AdSpend[] = [];

  for (const ad of ads) {
    const spend = Number(ad.spend_to_date);
    const exact = result.find((l) => l.channel === ad.channel && l.format && l.format === ad.format && l.currency === ad.currency);
    const wide = result.find((l) => l.channel === ad.channel && !l.format && l.currency === ad.currency);
    const line = exact ?? wide;
    if (line) {
      line.ads += 1;
      if (!line.recorded) line.spent += spend;
    } else if (spend > 0) {
      unplanned.set(ad.currency, (unplanned.get(ad.currency) ?? 0) + spend);
      unplannedAds.push(ad);
    }
  }

  // Totals per currency, for the headline "₦1.2m of ₦3m spent".
  const totals = new Map<Currency, { planned: number; spent: number }>();
  for (const l of result) {
    const t = totals.get(l.currency) ?? { planned: 0, spent: 0 };
    t.planned += l.planned_amount;
    t.spent += l.spent;
    totals.set(l.currency, t);
  }
  return { lines: result, unplanned, unplannedAds, totals };
}

// Spend so far for one channel (or all, channel = null), e.g. "₦860k + $120".
export function spendFor(spread: ReturnType<typeof allocate>, channel: string | null): string | null {
  const sums = new Map<Currency, number>();
  const add = (c: Currency, n: number) => sums.set(c, (sums.get(c) ?? 0) + n);
  for (const l of spread.lines) if (!channel || l.channel === channel) add(l.currency, l.spent);
  for (const a of spread.unplannedAds) if (!channel || a.channel === channel) add(a.currency, Number(a.spend_to_date));
  const parts = (["NGN", "USD"] as Currency[]).filter((c) => (sums.get(c) ?? 0) > 0).map((c) => money(sums.get(c)!, c, true));
  return parts.length ? parts.join(" + ") : null;
}
