// Turns budget lines read from a media plan into PRIME's channels and ticks.
// It works on plain rules, so it needs no outside service. Anything it isn't
// sure of goes on a "please check" list; a person confirms all of it.

import { CHANNELS } from "@/lib/campaign";
import { ALL_GROUPS } from "@/lib/campaign-setup";
import type { Currency } from "@/lib/ads";
import type { FoundLine } from "@/lib/plan-import";

// Turns a written channel name ("TikTok", "google ads", "TV") into PRIME's id.
export function channelId(name: string): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  const match = CHANNELS.find((c) => c.label.toLowerCase() === n || c.id === n.replace(/ /g, "_"));
  if (match) return match.id;
  const rules: [RegExp, string][] = [
    [/instagram|\big\b/, "instagram"],
    [/facebook|\bfb\b|\bmeta\b/, "facebook"],
    [/tik ?tok/, "tiktok"],
    [/youtube|\byt\b/, "youtube"],
    [/google|search|display|pmax|performance max|demand gen/, "google_ads"],
    [/linkedin/, "linkedin"],
    [/twitter|^x\b|\bx \(/, "x"],
    [/\btv\b|television|tvc/, "tv"],
    [/radio/, "radio"],
    [/ooh|billboard|outdoor/, "ooh"],
    [/influenc|kol/, "influencers"],
    [/\bpr\b|public relations|press/, "pr"],
    [/activation|experiential|event/, "activations"],
  ];
  return rules.find(([re]) => re.test(n))?.[1] ?? (n.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "other");
}

// [what a plan might say, group id, option, budget channel, marketing type]
const NON_DIGITAL: [RegExp, string, string, string, string][] = [
  [/\btvc\b|tv spot|television spot|\bspots? \(?tv|^tv$|^television$/i, "tv", "Spot (TVC)", "tv", "traditional"],
  [/(tv|television).*(sponsor)/i, "tv", "Programme sponsorship", "tv", "traditional"],
  [/(tv|television).*(mention)/i, "tv", "Presenter mention", "tv", "traditional"],
  [/product placement/i, "tv", "Product placement", "tv", "traditional"],
  [/oap|live read|live mention/i, "radio", "Live read (OAP mention)", "radio", "traditional"],
  [/radio.*(sponsor)/i, "radio", "Programme sponsorship", "radio", "traditional"],
  [/radio.*(segment)/i, "radio", "Sponsored segment", "radio", "traditional"],
  [/radio|jingle/i, "radio", "Spot / jingle", "radio", "traditional"],
  [/full page/i, "print", "Full page", "print", "traditional"],
  [/half page/i, "print", "Half page", "print", "traditional"],
  [/advertorial/i, "print", "Advertorial", "print", "traditional"],
  [/\binsert\b/i, "print", "Insert", "print", "traditional"],
  [/\bled\b|digital (billboard|board)|dooh/i, "billboards", "Digital billboard (LED)", "ooh", "ooh"],
  [/unipole/i, "billboards", "Unipole", "ooh", "ooh"],
  [/gantry|gantries/i, "billboards", "Gantry", "ooh", "ooh"],
  [/bridge panel/i, "billboards", "Bridge panel", "ooh", "ooh"],
  [/wall drape|building wrap|wallscape/i, "billboards", "Wall drape / building wrap", "ooh", "ooh"],
  [/billboard|static board|hoarding/i, "billboards", "Static billboard", "ooh", "ooh"],
  [/brt station|bus stop/i, "transit", "BRT stations and bus stops", "ooh", "ooh"],
  [/\bbrt\b|bus (brand|wrap)|danfo/i, "transit", "Bus branding (BRT, danfo)", "ooh", "ooh"],
  [/keke|tricycle/i, "transit", "Keke branding", "ooh", "ooh"],
  [/vehicle|fleet|truck|van brand/i, "transit", "Vehicle / fleet branding", "ooh", "ooh"],
  [/lamp ?-?(post|pole)/i, "street", "Lamp-post banners", "ooh", "ooh"],
  [/bus shelter/i, "street", "Bus shelters", "ooh", "ooh"],
  [/parasol/i, "street", "Parasols", "ooh", "ooh"],
  [/kiosk/i, "street", "Kiosks", "ooh", "ooh"],
  [/airport/i, "place", "Airports", "ooh", "ooh"],
  [/\bmall\b/i, "place", "Malls", "ooh", "ooh"],
  [/cinema/i, "place", "Cinemas", "ooh", "ooh"],
  [/in-?store screen/i, "place", "In-store screens", "ooh", "ooh"],
  [/market storm/i, "activations", "Market storm", "activations", "experiential"],
  [/in-?store/i, "activations", "In-store activation", "activations", "experiential"],
  [/sampling/i, "activations", "Product sampling", "activations", "experiential"],
  [/road ?show/i, "activations", "Roadshow", "activations", "experiential"],
  [/campus/i, "activations", "Campus activation", "activations", "experiential"],
  [/event/i, "activations", "Event sponsorship", "activations", "experiential"],
  [/pop-?up/i, "activations", "Pop-up", "activations", "experiential"],
  [/nano/i, "tiers", "Nano", "influencers", "kol"],
  [/micro/i, "tiers", "Micro", "influencers", "kol"],
  [/macro/i, "tiers", "Macro", "influencers", "kol"],
  [/mega|celebrity/i, "tiers", "Mega / celebrity", "influencers", "kol"],
  [/ambassador/i, "kolcontent", "Brand ambassador", "influencers", "kol"],
  [/press release/i, "prwork", "Press release", "pr", "pr"],
  [/media event|press event/i, "prwork", "Media event", "pr", "pr"],
  [/interview/i, "prwork", "Interview", "pr", "pr"],
  [/op-?ed/i, "prwork", "Op-ed", "pr", "pr"],
  [/blogger/i, "prwork", "Blogger outreach", "pr", "pr"],
];

// Other names plans use for digital ad formats.
const FORMAT_ALIASES: [RegExp, string][] = [
  [/reel/i, "Reels"],
  [/stor(y|ies)/i, "Stories"],
  [/carousel/i, "Carousel"],
  [/spark/i, "Spark Ads"],
  [/in-?feed/i, "In-Feed"],
  [/top ?view/i, "TopView"],
  [/bumper/i, "Bumper (6 s)"],
  [/non-?skip/i, "Non-skippable in-stream"],
  [/skip|trueview/i, "Skippable in-stream"],
  [/short/i, "Shorts"],
  [/search/i, "Search"],
  [/pmax|performance max/i, "Performance Max"],
  [/demand gen/i, "Demand Gen"],
  [/display|\bgdn\b/i, "Display"],
  [/video/i, "Video"],
  [/image|static/i, "Image"],
  [/promoted/i, "Promoted post"],
];

export type Place = { group: string; option: string };

// One line of the plan, and where PRIME put it. The person can change it.
export type PlanRow = {
  label: string;           // as the plan wrote it, e.g. "Meta (FB/IG) · Reels"
  format: string;
  amount: number;
  currency: Currency;
  qty: number | null;      // how many spots, sites, units... if the plan says
  places: Place[];         // the ticks it stands for (Meta = Instagram and Facebook)
  channel: string;         // the budget channel it counts against
  skipped: boolean;        // "leave this line out"
};

export type PlanMatch = {
  rows: PlanRow[];
  types: string[];
  selections: Record<string, string[]>;
  quantities: Record<string, string>;
  ticked: number;
  unplaced: number;
};

// Where a line goes for one tick.
function place(line: FoundLine): { places: Place[]; channel: string } {
  const text = `${line.channel} ${line.format}`;
  const channel = channelId(line.channel);
  const digital = CHANNELS.find((c) => c.id === channel);
  if (!digital) {
    const rule = NON_DIGITAL.find(([re]) => re.test(text));
    return rule ? { places: [{ group: rule[1], option: rule[2] }], channel: rule[3] } : { places: [], channel };
  }
  // "Meta" or "FB/IG" means both Facebook and Instagram.
  const family = /\bmeta\b/i.test(line.channel) || (/\bfb\b|facebook/i.test(line.channel) && /\big\b|instagram/i.test(line.channel)) ? ["instagram", "facebook"] : [digital.id as string];
  const label = line.format.trim();
  const alias = label ? FORMAT_ALIASES.find(([re]) => re.test(label))?.[1] : undefined;
  const places: Place[] = [];
  for (const id of family) {
    const options = CHANNELS.find((c) => c.id === id)!.formats as readonly string[];
    const option = options.find((o) => o.toLowerCase() === label.toLowerCase()) ?? (alias && options.includes(alias) ? alias : undefined);
    if (option) places.push({ group: id, option });
  }
  return { places, channel };
}

export function readPlanRows(found: FoundLine[]): PlanRow[] {
  return found.map((line) => ({
    label: [line.channel, line.format].filter(Boolean).join(" · "),
    format: line.format.trim(),
    amount: line.amount,
    currency: line.currency,
    qty: line.qty ?? null,
    skipped: false,
    ...place(line),
  }));
}

// The ticks, types and "how many" figures the rows add up to.
export function summarisePlan(rows: PlanRow[]): PlanMatch {
  const selections: Record<string, string[]> = {};
  const types = new Set<string>();
  const totals: Record<string, number> = {};
  for (const row of rows) {
    if (row.skipped) continue;
    for (const p of row.places) {
      selections[p.group] = [...new Set([...(selections[p.group] ?? []), p.option])];
      const group = ALL_GROUPS.find((g) => g.id === p.group);
      if (group) types.add(group.type);
    }
    // Counts go to the first tick's group, for non-digital work only.
    const first = row.places[0];
    if (first && row.qty != null && ALL_GROUPS.find((g) => g.id === first.group)?.qtyLabel) {
      totals[first.group] = (totals[first.group] ?? 0) + row.qty;
    }
  }
  const live = rows.filter((r) => !r.skipped);
  return {
    rows,
    types: [...types],
    selections,
    quantities: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, String(v)])),
    ticked: Object.values(selections).reduce((a, l) => a + l.length, 0),
    unplaced: live.filter((r) => r.places.length === 0).length,
  };
}

export function matchPlan(found: FoundLine[]): PlanMatch {
  return summarisePlan(readPlanRows(found));
}
