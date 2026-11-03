// The media plan's budget lines, and how actual ad spend fills them.
// An ad counts against the line for its channel and format; if there is no line
// for that format, against the line for its whole channel (format left empty).
// Naira and Dollars are kept apart. Spend that matches no line is "unplanned".

import type { Ad, Currency } from "@/lib/ads";

export type BudgetLine = {
  id: string;
  brand_id: string;
  channel: string;
  format: string | null;
  label: string | null;
  planned_amount: number;
  currency: Currency;
  sort_order: number;
};

export type LineWithSpend = BudgetLine & { spent: number; ads: number };

export function allocate(lines: BudgetLine[], ads: Pick<Ad, "channel" | "format" | "currency" | "spend_to_date">[]) {
  const result: LineWithSpend[] = lines.map((l) => ({ ...l, planned_amount: Number(l.planned_amount), spent: 0, ads: 0 }));
  const unplanned = new Map<Currency, number>();

  for (const ad of ads) {
    const spend = Number(ad.spend_to_date);
    const exact = result.find((l) => l.channel === ad.channel && l.format && l.format === ad.format && l.currency === ad.currency);
    const wide = result.find((l) => l.channel === ad.channel && !l.format && l.currency === ad.currency);
    const line = exact ?? wide;
    if (line) {
      line.spent += spend;
      line.ads += 1;
    } else if (spend > 0) {
      unplanned.set(ad.currency, (unplanned.get(ad.currency) ?? 0) + spend);
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
  return { lines: result, unplanned, totals };
}
