// Reads budget lines out of a media plan spreadsheet (Excel or CSV), whatever
// its exact layout. It looks for a header row with a channel-like column and a
// money column, then reads the rows under it. Everything found is shown to the
// person to confirm before anything is saved.

export type FoundLine = { channel: string; format: string; amount: number; currency: "NGN" | "USD" };
export type FoundPlan = { sheet: string; lines: FoundLine[]; columns: { channel: string; format: string | null; amount: string } } | null;

type Cell = string | number | boolean | Date | null | undefined;

const CHANNEL = /channel|platform|media(?!\s*plan)|medium|vehicle|station|network/i;
const FORMAT = /format|ad\s*type|placement|buy\s*type|objective|type/i;
const AMOUNT = /budget|amount|cost|spend|investment|net|gross|naira|₦|\$|usd|ngn|total/i;
const CURRENCY = /currency|curr\b/i;

const text = (c: Cell) => (c instanceof Date ? c.toISOString().slice(0, 10) : String(c ?? "")).trim();

// "₦1,250,000.00" -> 1250000; returns null for anything that isn't money.
export function parseMoney(c: Cell): number | null {
  if (typeof c === "number") return c >= 0 ? c : null;
  const s = text(c).replace(/[₦$,\s]|ngn|usd|naira/gi, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function findInSheet(name: string, rows: Cell[][]): FoundPlan {
  for (let h = 0; h < Math.min(rows.length, 20); h++) {
    const header = rows[h].map(text);
    const channelCol = header.findIndex((v) => CHANNEL.test(v));
    // Prefer a column that says budget/cost/amount over one that just says "total".
    const moneyCols = header.map((v, i) => (AMOUNT.test(v) && i !== channelCol ? i : -1)).filter((i) => i >= 0);
    const amountCol = moneyCols.find((i) => /budget|amount|cost|spend|investment/i.test(header[i])) ?? moneyCols[0];
    if (channelCol < 0 || amountCol === undefined) continue;
    const formatCol = header.findIndex((v, i) => FORMAT.test(v) && i !== channelCol && i !== amountCol);
    const currencyCol = header.findIndex((v) => CURRENCY.test(v));
    const headerSaysUsd = /\$|usd|dollar/i.test(header[amountCol]);

    const lines: FoundLine[] = [];
    let lastChannel = "";
    for (const row of rows.slice(h + 1)) {
      const channelCell = text(row[channelCol]) || lastChannel; // merged cells: the channel carries down
      if (!channelCell) continue;
      if (/total|grand|sub-?total/i.test(channelCell) || /total/i.test(text(row[formatCol]))) continue;
      lastChannel = text(row[channelCol]) || lastChannel;
      const amount = parseMoney(row[amountCol]);
      if (!amount) continue;
      const currencyText = currencyCol >= 0 ? text(row[currencyCol]) : text(row[amountCol]);
      lines.push({
        channel: channelCell,
        format: formatCol >= 0 ? text(row[formatCol]) : "",
        amount,
        currency: /\$|usd|dollar/i.test(currencyText) || (headerSaysUsd && !/₦|ngn|naira/i.test(currencyText)) ? "USD" : "NGN",
      });
    }
    if (lines.length) {
      return { sheet: name, lines, columns: { channel: header[channelCol], format: formatCol >= 0 ? header[formatCol] : null, amount: header[amountCol] } };
    }
  }
  return null;
}

// Tries every sheet and keeps the one with the most budget lines.
export function findBudgetLines(sheets: { sheet: string; data: readonly (readonly unknown[])[] }[]): FoundPlan {
  return sheets.map((s) => findInSheet(s.sheet, s.data as Cell[][])).filter(Boolean).sort((a, b) => b!.lines.length - a!.lines.length)[0] ?? null;
}

// Simple CSV reader (handles quoted cells with commas).
export function parseCsv(content: string): Cell[][] {
  return content.split(/\r?\n/).map((line) => {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"' && quoted) {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return cells;
  });
}
