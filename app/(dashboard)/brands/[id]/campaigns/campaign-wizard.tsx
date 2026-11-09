"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import readXlsxFile from "read-excel-file/browser";
import { createClient } from "@/lib/supabase/browser";
import { CampaignHero } from "@/components/campaign-hero";
import { Field, inputClass } from "@/components/ui";
import { budgetChannels, channelName, MARKETING_TYPES, REPORTING_OPTIONS } from "@/lib/campaign";
import {
  ALL_GROUPS,
  AREAS,
  EMAIL_ALERTS,
  budgetChannelFor,
  KPI_METRICS,
  PANELS,
  areasFor,
  chosenChannels,
  draftAds,
  draftDeliverables,
  draftReports,
  toCount,
  type BudgetDraft,
  type CampaignFields,
  type CampaignPayload,
} from "@/lib/campaign-setup";
import { findBudgetLines, parseCsv, parseMoney } from "@/lib/plan-import";
import { channelId, readPlanRows, summarisePlan, type PlanRow } from "@/lib/plan-match";
import { money, type Currency } from "@/lib/ads";
import { dueDay } from "@/lib/reports";
import { currentTime, shortDate } from "@/lib/format";
import type { worldTheme } from "@/lib/colour";
import { addManagerLogin, launchCampaign, saveCampaign } from "./actions";

export type WizardPerson = { id: string; name: string; email: string | null; hasLogin: boolean };

type Props = {
  brandId: string;
  brandName: string;
  theme: ReturnType<typeof worldTheme>;
  banner: string | null;
  logo: string | null;
  people: WizardPerson[];
  myPersonId: string | null;
  defaults: { reporting: string; tier: "heavy" | "medium" | "low"; leaveCoverId: string | null; contentMin: number | null; contentMax: number | null; assets: number | null };
  existing: { content: number; ads: number; assets: number; reports: number };
  editing?: { id: string; fields: CampaignFields };
};

const STEP_LABELS = ["The campaign", "What's included", "The team", "Check and launch"];
const SAVE_STEPS = ["The campaign", "What's included", "The team"];

export function CampaignWizard({ brandId, brandName, theme, banner, logo, people: startPeople, myPersonId, defaults, existing, editing }: Props) {
  const router = useRouter();
  const e = editing?.fields;
  // Setup is remembered on this device until launch, so a reload loses nothing.
  const draftKey = `prime-campaign-draft-${brandId}`;
  const [draftState] = useState<Record<string, unknown>>(() => (editing ? {} : readDraft(draftKey)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each value is checked by the state it seeds
  const d = draftState as Record<string, any>;
  const restored = !editing && Object.keys(d).length > 0;
  const [step, setStep] = useState<number>(d.step ?? (0));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState<string>(d.name ?? (e?.name ?? ""));
  const [objective, setObjective] = useState<string>(d.objective ?? (e?.objective ?? ""));
  const [start, setStart] = useState<string>(d.start ?? (e?.start_date ?? ""));
  const [end, setEnd] = useState<string>(d.end ?? (e?.end_date ?? ""));
  const [kpis, setKpis] = useState<Record<string, string>>(d.kpis ?? (Object.fromEntries((e?.kpis ?? []).map((k) => [k.metric, k.target == null ? "" : k.target.toLocaleString("en-GB")]))));

  // Step 2
  const [types, setTypes] = useState<string[]>(d.types ?? (e?.marketing_types ?? ["digital"]));
  const [selections, setSelections] = useState<Record<string, string[]>>(d.selections ?? (e?.selections ?? {}));
  const [quantities, setQuantities] = useState<Record<string, string>>(d.quantities ?? (Object.fromEntries(Object.entries(e?.quantities ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)]))));
  const [closed, setClosed] = useState<string[]>([]);
  const [extraOptions, setExtraOptions] = useState<Record<string, string[]>>(d.extraOptions ?? (() => {
      // Anything saved earlier that isn't a standard option still shows.
      const extras: Record<string, string[]> = {};
      for (const panel of PANELS) for (const g of panel.groups) {
        const custom = (e?.selections[g.id] ?? []).filter((o) => !g.options.includes(o));
        if (custom.length) extras[g.id] = custom;
      }
      return extras;
    }));
  const [contentMin, setContentMin] = useState<string>(d.contentMin ?? (String(e?.content_target_min ?? defaults.contentMin ?? "")));
  const [contentMax, setContentMax] = useState<string>(d.contentMax ?? (String(e?.content_target_max ?? defaults.contentMax ?? "")));
  const [assetsTarget, setAssetsTarget] = useState<string>(d.assetsTarget ?? (String(e?.creative_assets_target ?? defaults.assets ?? "")));
  const [reporting, setReporting] = useState<string>(d.reporting ?? (e?.reporting ?? defaults.reporting ?? REPORTING_OPTIONS[0]));
  const [tier, setTier] = useState<"heavy" | "medium" | "low">(d.tier ?? (e?.tier ?? defaults.tier));
  const [inCycle, setInCycle] = useState<boolean>(d.inCycle ?? (e?.in_monthly_cycle ?? true));
  const [planUrl, setPlanUrl] = useState<string>(d.planUrl ?? (e?.media_plan_url ?? ""));
  const [strategyUrl, setStrategyUrl] = useState<string>(d.strategyUrl ?? (e?.strategy_url ?? ""));
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [strategyFile, setStrategyFile] = useState<File | null>(null);
  const [planRead, setPlanRead] = useState<{ file: string } | null>(d.planRead ?? (null));
  const [planRows, setPlanRows] = useState<PlanRow[]>(d.planRows ?? ([]));
  const [showRows, setShowRows] = useState(true);
  const [planNote, setPlanNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [manualLines, setManualLines] = useState<BudgetDraft[]>(d.manualLines ?? ([]));
  // Budget lines: the plan's (minus any left out), then any added by hand.
  const lines = useMemo<BudgetDraft[]>(
    () => [
      ...planRows.filter((r) => !r.skipped).map((r) => ({ channel: r.channel, format: r.format, amount: r.amount, currency: r.currency })),
      ...manualLines,
    ],
    [planRows, manualLines],
  );
  const planSummary = summarisePlan(planRows);

  // Step 3
  const [people, setPeople] = useState<WizardPerson[]>(d.people ?? (startPeople));
  const [lead, setLead] = useState<string>(d.lead ?? (e?.account_lead_person_id ?? myPersonId ?? ""));
  const [managers, setManagers] = useState<string[]>(d.managers ?? (e?.team ?? []));
  const [areas, setAreas] = useState<Record<string, string>>(d.areas ?? (Object.fromEntries((e?.areas ?? []).map((a) => [a.area, a.person_id]))));
  const [leaveCover, setLeaveCover] = useState<string>(d.leaveCover ?? (e?.leave_cover_person_id ?? defaults.leaveCoverId ?? ""));
  const [alerts, setAlerts] = useState<string[]>(d.alerts ?? (e?.email_alerts ?? EMAIL_ALERTS.map(([id]) => id)));
  const [addingName, setAddingName] = useState("");
  const [addingEmail, setAddingEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState<Record<string, string>>({});
  const [passwordFor, setPasswordFor] = useState<{ name: string; email: string; password: string } | null>(null);
  const [teamProblem, setTeamProblem] = useState<string | null>(null);

  // Step 4
  const [unticked, setUnticked] = useState<string[]>(d.unticked ?? ([]));
  const [handContent, setHandContent] = useState<{ title: string; date: string }[]>(d.handContent ?? ([]));
  const [contentTitle, setContentTitle] = useState("");
  const [contentDate, setContentDate] = useState("");
  const [attachExisting, setAttachExisting] = useState<boolean>(d.attachExisting ?? (true));

  const steps = editing ? SAVE_STEPS : STEP_LABELS;
  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? "Someone";
  const leadName = lead ? personName(lead) : "the Account Lead";
  const neededAreas = areasFor(types);
  const coverOf = (area: string) => (areas[area] && managers.includes(areas[area]) ? areas[area] : "");
  const coverName = (area: string) => (coverOf(area) ? personName(coverOf(area)) : leadName);

  const flip = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0 });
  };

  const chip = (on: boolean) =>
    on ? { backgroundColor: theme.main, color: theme.onMain, borderColor: theme.main } : { backgroundColor: "#FFFFFF", color: "#000000", borderColor: theme.soft };

  // ------------------------------------------------------------- media plan
  async function readPlan(file: File | undefined) {
    if (!file) return;
    setPlanNote(null);
    setPlanFile(file);
    if (/\.(pdf|pptx|docx|xls)$/i.test(file.name)) {
      setPlanNote("The file is kept with the campaign, but PRIME can only read Excel (.xlsx) and CSV plans for now. Please tick what applies below.");
      return;
    }
    setReading(true);
    try {
      const sheets = /\.csv$/i.test(file.name) ? [{ sheet: file.name, data: parseCsv(await file.text()) }] : await readXlsxFile(file);
      const found = findBudgetLines(sheets);
      if (!found) {
        setPlanNote("The file is kept with the campaign, but PRIME couldn't find a channel column and a money column in it. Please tick what applies below.");
        return;
      }
      const rows = readPlanRows(found.lines);
      const match = summarisePlan(rows);
      setTypes((current) => [...new Set([...current, ...match.types])]);
      setSelections((current) => {
        const merged = { ...current };
        for (const [group, options] of Object.entries(match.selections)) merged[group] = [...new Set([...(merged[group] ?? []), ...options])];
        return merged;
      });
      setQuantities((current) => ({ ...current, ...match.quantities }));
      setPlanRows(rows);
      setShowRows(true);
      setPlanRead({ file: file.name });
    } catch {
      setPlanNote("The file is kept with the campaign, but PRIME couldn't read it. Please tick what applies below.");
    } finally {
      setReading(false);
    }
  }

  function clearPlan() {
    setPlanRead(null);
    setPlanFile(null);
    setSelections({});
    setQuantities({});
    setPlanRows([]);
    setPlanNote(null);
  }

  // Moves one plan line somewhere else ("group|option"), leaves it unplaced (""),
  // or leaves it out ("skip"). The ticks below follow.
  function placeRow(index: number, value: string) {
    const old = planRows[index];
    let next: PlanRow;
    if (value === "skip") next = { ...old, skipped: true };
    else if (value === "") next = { ...old, skipped: false, places: [] };
    else {
      const [group, option] = value.split("|");
      next = { ...old, skipped: false, places: [{ group, option }], channel: budgetChannelFor(group) };
    }
    const rows = planRows.map((r, i) => (i === index ? next : r));
    const stillUsed = (group: string, option: string) =>
      rows.some((r) => !r.skipped && r.places.some((p) => p.group === group && p.option === option));
    const updated = { ...selections };
    for (const p of old.places) if (!stillUsed(p.group, p.option)) updated[p.group] = (updated[p.group] ?? []).filter((o) => o !== p.option);
    const newTypes = new Set(types);
    for (const p of next.skipped ? [] : next.places) {
      updated[p.group] = [...new Set([...(updated[p.group] ?? []), p.option])];
      const type = ALL_GROUPS.find((g) => g.id === p.group)?.type;
      if (type) newTypes.add(type);
    }
    setTypes([...newTypes]);
    setSelections(updated);
    setPlanRows(rows);
  }

  // ------------------------------------------------------------- budget lines
  const budgetOptions = budgetChannels(chosenChannels(types, selections), types);
  const [lineChannel, setLineChannel] = useState("");
  const [lineFormat, setLineFormat] = useState("");
  const [lineAmount, setLineAmount] = useState("");
  const [lineCurrency, setLineCurrency] = useState<Currency>("NGN");
  const [pasteRows, setPasteRows] = useState("");

  useEffect(() => {
    if (editing || (!name.trim() && step === 0)) return;
    const snapshot = { step, name, objective, start, end, kpis, types, selections, quantities, extraOptions, contentMin, contentMax, assetsTarget, reporting, tier, inCycle, planUrl, strategyUrl, planRead, planRows, manualLines, people, lead, managers, areas, leaveCover, alerts, unticked, handContent, attachExisting };
    try {
      localStorage.setItem(draftKey, JSON.stringify(snapshot));
    } catch {
      // Private browsing or full storage: setup still works, it just isn't remembered.
    }
  });
  const lineTotals = (["NGN", "USD"] as Currency[])
    .map((c) => [c, lines.filter((l) => l.currency === c).reduce((a, l) => a + l.amount, 0)] as const)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => money(n, c))
    .join(" + ");

  // A plan line is left out (and its ticks follow); a hand-added one is removed.
  function removeLine(index: number) {
    const planIndexes = planRows.map((r, i) => (r.skipped ? -1 : i)).filter((i) => i >= 0);
    if (index < planIndexes.length) placeRow(planIndexes[index], "skip");
    else setManualLines(manualLines.filter((_, j) => j !== index - planIndexes.length));
  }

  function addLine() {
    const amount = parseMoney(lineAmount);
    const channel = lineChannel || budgetOptions[0]?.id;
    if (!channel || !amount) return;
    setManualLines([...manualLines, { channel, format: lineFormat.trim(), amount, currency: lineCurrency }]);
    setLineFormat("");
    setLineAmount("");
  }

  function addPasted() {
    const added: BudgetDraft[] = [];
    for (const raw of pasteRows.split(/\r?\n/)) {
      const cells = raw.split(raw.includes("\t") ? "\t" : ",").map((c) => c.trim());
      const at = cells.findIndex((c, i) => i > 0 && parseMoney(c) !== null);
      if (at < 1) continue;
      added.push({
        channel: channelId(cells[0]),
        format: at > 1 ? cells[1] : "",
        amount: parseMoney(cells[at])!,
        currency: /\$|usd|dollar/i.test(raw) ? "USD" : "NGN",
      });
    }
    setManualLines([...manualLines, ...added]);
    setPasteRows("");
  }

  // ------------------------------------------------------------- team
  async function addSomeone() {
    setTeamProblem(null);
    const result = await addManagerLogin({ name: addingName, email: addingEmail });
    if (!result.ok || !result.person) {
      setTeamProblem(result.message);
      return;
    }
    setPeople([...people, result.person]);
    setManagers([...managers, result.person.id]);
    setPasswordFor({ name: result.person.name, email: result.person.email ?? "", password: result.tempPassword ?? "" });
    setAddingName("");
    setAddingEmail("");
  }

  async function createLoginFor(person: WizardPerson) {
    setTeamProblem(null);
    const result = await addManagerLogin({ personId: person.id, email: loginEmail[person.id] ?? person.email ?? "" });
    if (!result.ok || !result.person) {
      setTeamProblem(result.message);
      return;
    }
    setPeople(people.map((p) => (p.id === person.id ? result.person! : p)));
    setPasswordFor({ name: result.person.name, email: result.person.email ?? "", password: result.tempPassword ?? "" });
  }

  // ------------------------------------------------------------- the draft
  const quantitiesForDraft = useMemo(() => quantities, [quantities]);
  const draftedAds = useMemo(() => draftAds(lines), [lines]);
  // Only what's still to come: a report already past its date would start out overdue.
  const draftedReports = useMemo(() => {
    const now = new Date(currentTime()).toISOString();
    return draftReports(reporting, start, end).filter((r) => r.due_at > now);
  }, [reporting, start, end]);
  const draftedWork = useMemo(() => draftDeliverables(types, selections, quantitiesForDraft), [types, selections, quantitiesForDraft]);
  const channels = chosenChannels(types, selections);
  const assetsCount = toCount(assetsTarget);
  const existingTotal = existing.content + existing.ads + existing.assets + existing.reports;

  type Row = { key: string; title: string; detail: string };
  const groups: { area: string; name: string; source: string; rows: Row[] }[] = [
    {
      area: "content",
      name: "Content",
      source: "Added here",
      rows: handContent.map((c, i) => ({ key: `content-${i}`, title: c.title, detail: c.date ? shortDate(c.date) : "No date yet" })),
    },
    ...(assetsCount
      ? [{ area: "assets", name: "Creative assets", source: "From your target", rows: [{ key: "assets", title: "Creative assets", detail: `0 of ${assetsCount} deployed` }] }]
      : []),
    {
      area: "reports",
      name: "Client reports",
      source: "From your reporting rhythm",
      rows: draftedReports.map((r) => ({ key: `report-${r.due_at}`, title: `${r.kind === "monthly" ? "Monthly" : r.kind === "weekly" ? "Weekly" : "Bi-weekly"} report`, detail: `${r.label} · due ${dueDay(r.due_at)}` })),
    },
    ...(types.includes("digital")
      ? [
          {
            area: "ads",
            name: "Digital ads",
            source: planRead ? "From the media plan" : "From your budget lines",
            rows: draftedAds.map((a, i) => ({ key: `ad-${i}`, title: a.name, detail: `${money(a.budget, a.currency)} · Not started` })),
          },
          ...(channels.length
            ? [{ area: "numbers", name: "Channel numbers", source: "From your channels", rows: [{ key: "numbers", title: "Weekly numbers", detail: channels.map(channelName).join(", ") }] }]
            : []),
        ]
      : []),
    ...[...new Set(draftedWork.map((d) => d.area))].map((area) => ({
      area,
      name: AREAS[area]?.label ?? area,
      source: planRead ? "From the media plan" : "From what you ticked",
      rows: draftedWork.filter((d) => d.area === area).map((d) => ({
        key: `work-${d.group_id}`,
        title: d.title,
        detail: `${d.planned_qty != null ? `0 of ${d.planned_qty} ${d.unit}` : "No number yet"} · ${d.detail}`,
      })),
    })),
  ];
  const tickedRows = groups.flatMap((g) => g.rows.filter((r) => !unticked.includes(r.key)).map(() => g.area));
  const countFor = new Map<string, number>();
  for (const area of tickedRows) {
    const who = coverName(area);
    countFor.set(who, (countFor.get(who) ?? 0) + 1);
  }

  function baseFields(planPath: string | null, strategyPath: string | null): CampaignFields {
    return {
      brand_id: brandId,
      name: name.trim(),
      objective: objective.trim() || null,
      start_date: start || null,
      end_date: end || null,
      kpis: KPI_METRICS.filter(([id]) => id in kpis).map(([metric]) => ({ metric, target: toCount(kpis[metric]) })),
      marketing_types: types,
      channels,
      selections: Object.fromEntries(Object.entries(selections).filter(([, v]) => v.length > 0)),
      quantities: Object.fromEntries(Object.entries(quantities).map(([k, v]) => [k, toCount(v)]).filter(([, v]) => v != null)),
      content_target_min: toCount(contentMin),
      content_target_max: toCount(contentMax),
      creative_assets_target: assetsCount,
      reporting,
      tier,
      in_monthly_cycle: inCycle,
      media_plan_url: planUrl.trim() || null,
      media_plan_path: planPath,
      strategy_url: strategyUrl.trim() || null,
      strategy_path: strategyPath,
      account_lead_person_id: lead || null,
      leave_cover_person_id: leaveCover || null,
      email_alerts: alerts,
      team: managers,
      areas: neededAreas.filter((a) => coverOf(a)).map((a) => ({ area: a, person_id: coverOf(a) })),
    };
  }

  async function uploadDoc(file: File | null, kind: string, existingPath: string | null) {
    if (!file) return existingPath;
    const supabase = createClient();
    const path = `${brandId}/${kind}-${currentTime()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
    const { error: uploadError } = await supabase.storage.from("brand-documents").upload(path, file, { contentType: file.type || undefined });
    if (uploadError) throw new Error(`Couldn't upload the file: ${uploadError.message}`);
    return path;
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const planPath = await uploadDoc(planFile, "media_plan", e?.media_plan_path ?? null);
        const strategyPath = await uploadDoc(strategyFile, "strategy", e?.strategy_path ?? null);
        if (editing) {
          const result = await saveCampaign(editing.id, baseFields(planPath, strategyPath));
          if (!result.ok) return setError(result.message);
          router.push(`/brands/${brandId}/campaigns/${editing.id}`);
          return;
        }
        const on = (key: string) => !unticked.includes(key);
        const payload: CampaignPayload = {
          ...baseFields(planPath, strategyPath),
          track_assets: on("assets"),
          track_numbers: on("numbers"),
          budget_lines: lines,
          ads: draftedAds.filter((_, i) => on(`ad-${i}`)),
          content: handContent.filter((_, i) => on(`content-${i}`)).map((c) => ({ title: c.title, date: c.date || null, platforms: channels })),
          reports: draftedReports.filter((r) => on(`report-${r.due_at}`)),
          deliverables: draftedWork.filter((d) => on(`work-${d.group_id}`)),
          attach_existing: existingTotal > 0 && attachExisting,
        };
        const result = await launchCampaign(payload);
        if (!result.ok || !result.id) return setError(result.message);
        try {
          localStorage.removeItem(draftKey);
        } catch {}
        router.push(`/brands/${brandId}/campaigns/${result.id}?launched=1`);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  const back = step === 0 ? (
    <Link href={editing ? `/brands/${brandId}/campaigns/${editing.id}` : `/brands/${brandId}`} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-black/45 text-white">
      <BackIcon />
    </Link>
  ) : (
    <button type="button" onClick={() => go(step - 1)} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-black/45 text-white">
      <BackIcon />
    </button>
  );

  const stepOneProblem = name.trim().length < 2 ? "Give the campaign a name." : start && end && end < start ? "The end date is before the start date." : null;

  return (
    <div className="space-y-5 pb-4">
      <CampaignHero
        theme={theme}
        banner={banner}
        logo={logo}
        brandName={brandName}
        title={name.trim() || "A new campaign"}
        label={`Step ${step + 1} of ${steps.length} · ${steps[step]}`}
        back={back}
      />
      {restored && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 text-sm" style={{ backgroundColor: theme.soft }}>
          <span>Picked up where you left off{planFile === null && planRead ? ". Upload the plan file again if you want it kept" : ""}.</span>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(draftKey);
              } catch {}
              window.location.reload();
            }}
            className="min-h-10 rounded-full bg-white px-3 text-[13px] font-bold"
            style={{ color: theme.ink }}
          >
            Start again
          </button>
        </div>
      )}
      <div aria-hidden="true" className="flex gap-1.5">
        {steps.map((s, i) => (
          <span key={s} className="h-[5px] flex-1 rounded-full" style={{ backgroundColor: i <= step ? theme.main : theme.soft }} />
        ))}
      </div>

      {/* ---------------------------------------------------------- Step 1 */}
      {step === 0 && (
        <>
          <div>
            <h1 className="font-display text-[34px] leading-none font-black tracking-tight" style={{ color: theme.ink }}>
              {editing ? "Edit this campaign" : "Start a campaign"}
            </h1>
            <p className="mt-1.5 text-sm text-muted">What is it, when does it run, and how will you judge it?</p>
          </div>
          <Field label="Campaign name">
            <input value={name} onChange={(ev) => setName(ev.target.value)} placeholder="e.g. Curry Season 2026" className={`${inputClass} font-display text-xl font-extrabold`} style={{ borderColor: theme.main }} />
          </Field>
          <Field label="Objective, in a line or two">
            <textarea value={objective} onChange={(ev) => setObjective(ev.target.value)} rows={3} className={`${inputClass} py-3`} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts"><input type="date" value={start} onChange={(ev) => setStart(ev.target.value)} className={inputClass} /></Field>
            <Field label="Ends"><input type="date" value={end} onChange={(ev) => setEnd(ev.target.value)} className={inputClass} /></Field>
          </div>
          <section className="rounded-[22px] p-4" style={{ backgroundColor: theme.soft }}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-bold">KPIs</h2>
              <span className="text-xs text-muted">Tap to choose, up to 7</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {KPI_METRICS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={id in kpis}
                  onClick={() => {
                    if (id in kpis) {
                      const rest = { ...kpis };
                      delete rest[id];
                      setKpis(rest);
                    } else if (Object.keys(kpis).length < 7) setKpis({ ...kpis, [id]: "" });
                  }}
                  className="min-h-11 rounded-[14px] border-[1.5px] px-3.5 text-sm font-semibold"
                  style={chip(id in kpis)}
                >
                  {label}
                </button>
              ))}
            </div>
            {Object.keys(kpis).length > 0 && (
              <div className="mt-3.5 space-y-2">
                {KPI_METRICS.filter(([id]) => id in kpis).map(([id, label]) => (
                  <label key={id} className="flex items-center gap-2.5 rounded-2xl bg-white py-2 pr-2 pl-3.5">
                    <span className="flex-1 text-sm font-semibold">{label}</span>
                    <input
                      inputMode="numeric"
                      placeholder="Target"
                      aria-label={`${label} target`}
                      value={kpis[id]}
                      onChange={(ev) => setKpis({ ...kpis, [id]: ev.target.value })}
                      className="min-h-11 w-32 rounded-xl border-0 px-3 text-right font-display text-[17px] font-extrabold"
                      style={{ backgroundColor: theme.soft, color: theme.ink }}
                    />
                  </label>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted">PRIME measures these against the numbers your team already logs, so nobody fills in anything twice.</p>
          </section>
        </>
      )}

      {/* ---------------------------------------------------------- Step 2 */}
      {step === 1 && (
        <>
          {!editing && !planRead && (
            <section className="rounded-3xl p-[18px]" style={{ backgroundColor: theme.soft }}>
              <div className="text-[11px] font-bold tracking-[0.15em]" style={{ color: theme.ink }}>OPTIONAL</div>
              <h2 className="mt-1 font-display text-2xl leading-tight font-black" style={{ color: theme.ink }}>Have a media plan?</h2>
              <p className="mt-1 mb-3 text-sm leading-relaxed text-muted">Upload it and PRIME goes through it line by line, shows you where each line goes, and ticks the boxes for you. No plan? Just tick below.</p>
              <label
                className="flex min-h-[54px] cursor-pointer items-center justify-center rounded-[18px] font-display text-[17px] font-extrabold"
                style={{ background: `linear-gradient(135deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}
              >
                {reading ? "Reading your plan…" : "Upload a media plan"}
                <input type="file" accept=".xlsx,.csv,.pdf,.xls,.pptx,.docx" className="sr-only" onChange={(ev) => readPlan(ev.target.files?.[0])} />
              </label>
              <div className="mt-1.5 text-center text-xs text-muted">PRIME reads Excel (.xlsx) and CSV. Other files are kept, not read.</div>
              {planNote && <p className="mt-3 rounded-2xl bg-white p-3 text-sm">{planNote}</p>}
            </section>
          )}

          {planRead && (
            <section className="overflow-hidden rounded-3xl border-[1.5px]" style={{ borderColor: theme.main }}>
              <div className="p-[18px]" style={{ background: `linear-gradient(140deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}>
                <div className="text-xs font-bold tracking-[0.12em] opacity-85">YOUR MEDIA PLAN</div>
                <div className="mt-1 font-display text-[26px] leading-tight font-black">
                  {planRows.filter((r) => !r.skipped).length} lines read{planSummary.unplaced ? `, ${planSummary.unplaced} need you` : ", all placed"}
                </div>
                <div className="mt-1 text-[13px] opacity-90">{planRead.file}</div>
              </div>
              {showRows ? (
                <div className="bg-white p-3.5">
                  <p className="mb-2.5 text-[13px] leading-snug text-muted">
                    Each line of your plan, and where PRIME put it. If one is wrong, choose the right place. The ticks further down follow your choices.
                  </p>
                  <ul className="space-y-2">
                    {planRows.map((row, i) => {
                      const value = row.skipped ? "skip" : row.places[0] ? `${row.places[0].group}|${row.places[0].option}` : "";
                      const placed = !row.skipped && row.places.length > 0;
                      return (
                        <li key={i} className={`rounded-2xl p-3 ${row.skipped ? "bg-mist opacity-60" : placed ? "" : "bg-[#FFF7E8]"}`} style={placed ? { backgroundColor: theme.soft } : undefined}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 text-sm font-bold">{row.label}</span>
                            <span className="shrink-0 text-[13px] font-semibold">{money(row.amount, row.currency)}</span>
                          </div>
                          {row.qty != null && <div className="text-xs text-muted">{row.qty.toLocaleString("en-GB")} planned</div>}
                          <div className="mt-1.5 text-xs font-semibold" style={{ color: placed ? theme.ink : "#8A3B00" }}>
                            {row.skipped
                              ? "Left out"
                              : placed
                                ? `✓ Goes to ${row.places.map((p) => `${groupLabel(p.group)}: ${p.option}`).join(" and ")}`
                                : "PRIME isn't sure where this goes. Choose below."}
                          </div>
                          <select
                            aria-label={`Where "${row.label}" goes`}
                            value={value}
                            onChange={(ev) => placeRow(i, ev.target.value)}
                            className="mt-1.5 min-h-11 w-full rounded-xl border bg-white px-2 text-sm"
                            style={{ borderColor: placed ? theme.soft : "#F5D9A6" }}
                          >
                            <option value="">Not sure yet (keep the budget, tick nothing)</option>
                            {PANELS.map((panel) => (
                              <optgroup key={panel.type} label={panel.heading}>
                                {panel.groups.flatMap((g) =>
                                  g.options.map((o) => (
                                    <option key={`${g.id}|${o}`} value={`${g.id}|${o}`}>{g.label}: {o}</option>
                                  )),
                                )}
                              </optgroup>
                            ))}
                            <option value="skip">Leave this line out</option>
                          </select>
                        </li>
                      );
                    })}
                  </ul>
                  <button type="button" onClick={() => setShowRows(false)} className="mt-3 min-h-12 w-full rounded-2xl text-sm font-bold" style={{ backgroundColor: theme.main, color: theme.onMain }}>
                    Looks right
                  </button>
                </div>
              ) : (
                <div className="bg-white p-3.5">
                  <button type="button" onClick={() => setShowRows(true)} className="min-h-11 rounded-xl border-[1.5px] px-3 text-[13px] font-bold" style={{ borderColor: theme.main, color: theme.ink }}>
                    See the lines again
                  </button>
                </div>
              )}
              <div className="border-t bg-white px-3.5 pb-2" style={{ borderColor: theme.soft }}>
                <button type="button" onClick={clearPlan} className="min-h-11 text-[13px] font-semibold text-muted underline">
                  Clear the plan and tick by hand
                </button>
              </div>
            </section>
          )}

          <div>
            <h1 className="mb-3 font-display text-[32px] leading-none font-black tracking-tight" style={{ color: theme.ink }}>What does the campaign include?</h1>
            <div className="flex flex-wrap gap-2">
              {MARKETING_TYPES.map((t) => (
                <button key={t.id} type="button" aria-pressed={types.includes(t.id)} onClick={() => setTypes(flip(types, t.id))} className="min-h-[46px] rounded-2xl border-[1.5px] px-4 text-sm font-semibold" style={chip(types.includes(t.id))}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {PANELS.filter((p) => types.includes(p.type)).map((panel) => {
            const open = !closed.includes(panel.type);
            const total = panel.groups.reduce((a, g) => a + (selections[g.id] ?? []).length, 0);
            return (
              <section key={panel.type}>
                <button type="button" aria-expanded={open} onClick={() => setClosed(flip(closed, panel.type))} className="flex min-h-12 w-full items-center gap-2.5 text-left">
                  <span className="flex-1 font-display text-2xl leading-tight font-black">{panel.heading}</span>
                  {total > 0 && <span className="text-xs font-bold" style={{ color: theme.ink }}>{total} selected</span>}
                  <span className="text-[13px] font-semibold text-muted underline">{open ? "Hide" : "Show"}</span>
                </button>
                {open && (
                  <>
                    <p className="mt-0.5 mb-2.5 text-[13px] leading-snug text-muted">{panel.hint}</p>
                    <div className="space-y-2.5">
                      {panel.groups.map((g) => {
                        const picked = selections[g.id] ?? [];
                        const options = [...g.options, ...(extraOptions[g.id] ?? [])];
                        return (
                          <div key={g.id} className="rounded-[20px] border-[1.5px] p-3" style={picked.length ? { borderColor: theme.main, backgroundColor: "#FFFFFF" } : { borderColor: theme.soft, backgroundColor: theme.soft + "80" }}>
                            <div className="flex min-h-11 items-center gap-2.5">
                              <div className="min-w-0 flex-1">
                                <div className="text-base font-bold">{g.label}</div>
                                <div className="text-xs text-muted">{picked.length ? `${picked.length} of ${options.length} selected` : "Tap what applies"}</div>
                              </div>
                              {g.qtyLabel && (
                                <label className="flex shrink-0 items-center gap-1.5">
                                  <span className="text-xs text-muted">{g.qtyLabel}</span>
                                  <input
                                    inputMode="numeric"
                                    placeholder="0"
                                    aria-label={`${g.label}: how many ${g.qtyLabel.toLowerCase()}`}
                                    value={quantities[g.id] ?? ""}
                                    onChange={(ev) => setQuantities({ ...quantities, [g.id]: ev.target.value })}
                                    className="min-h-11 w-[62px] rounded-xl border bg-white text-center font-display text-base font-extrabold"
                                    style={{ borderColor: theme.soft, color: theme.ink }}
                                  />
                                </label>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {options.map((o) => (
                                <button key={o} type="button" aria-pressed={picked.includes(o)} onClick={() => setSelections({ ...selections, [g.id]: flip(picked, o) })} className="min-h-11 rounded-xl border-[1.5px] px-3 text-[13px] font-semibold" style={chip(picked.includes(o))}>
                                  {o}
                                </button>
                              ))}
                              <OtherOption
                                label={g.label}
                                onAdd={(o) => {
                                  setExtraOptions({ ...extraOptions, [g.id]: [...(extraOptions[g.id] ?? []), o] });
                                  setSelections({ ...selections, [g.id]: [...picked, o] });
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            );
          })}

          <section>
            <h2 className="mb-3 font-display text-2xl font-black">Content and assets</h2>
            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Content a month, from"><input inputMode="numeric" value={contentMin} onChange={(ev) => setContentMin(ev.target.value)} className={inputClass} /></Field>
              <Field label="to"><input inputMode="numeric" value={contentMax} onChange={(ev) => setContentMax(ev.target.value)} className={inputClass} /></Field>
              <Field label="Creative assets"><input inputMode="numeric" value={assetsTarget} onChange={(ev) => setAssetsTarget(ev.target.value)} className={inputClass} /></Field>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-black">Client reports</h2>
            <p className="mt-1 mb-3 text-[13px] text-muted">PRIME works out every due date from this.</p>
            <div className="space-y-2">
              {REPORTING_OPTIONS.map((r) => (
                <button key={r} type="button" aria-pressed={reporting === r} onClick={() => setReporting(r)} className="block min-h-12 w-full rounded-[14px] border-[1.5px] px-3.5 text-left text-sm font-semibold" style={chip(reporting === r)}>
                  {r}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-[20px] p-4" style={{ backgroundColor: theme.soft }}>
            <h2 className="text-[15px] font-bold">Media plan and strategy links and files</h2>
            <Field label="Media plan live link (optional)"><input type="url" value={planUrl} onChange={(ev) => setPlanUrl(ev.target.value)} placeholder="https://…" className={inputClass} /></Field>
            {planFile && <p className="text-xs text-muted">Media plan file ready: {planFile.name}</p>}
            {editing && (
              <label className="block text-sm font-semibold">
                Replace the media plan file
                <input type="file" accept=".xlsx,.csv,.pdf,.xls,.pptx,.docx" onChange={(ev) => setPlanFile(ev.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm file:mr-3 file:min-h-10 file:rounded-full file:border-0 file:bg-white file:px-4 file:font-semibold" />
              </label>
            )}
            <Field label="Strategy live link (optional)"><input type="url" value={strategyUrl} onChange={(ev) => setStrategyUrl(ev.target.value)} placeholder="https://…" className={inputClass} /></Field>
            <label className="block text-sm font-semibold">
              Strategy file (optional)
              <input type="file" accept=".pdf,.xlsx,.xls,.csv,.pptx,.docx" onChange={(ev) => setStrategyFile(ev.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm file:mr-3 file:min-h-10 file:rounded-full file:border-0 file:bg-white file:px-4 file:font-semibold" />
            </label>
          </section>

          {editing ? (
            <section className="rounded-[20px] border-[1.5px] p-4 text-sm" style={{ borderColor: theme.soft }}>
              <b>Budget lines</b> are on the <Link href={`/brands/${brandId}/plan`} className="font-bold underline" style={{ color: theme.ink }}>Media plan &amp; budget</Link> screen.
            </section>
          ) : (
            <section>
              <div className="flex items-baseline justify-between gap-2.5">
                <h2 className="font-display text-2xl font-black">Budget lines</h2>
                <span className="font-display text-[15px] font-extrabold" style={{ color: theme.ink }}>{lineTotals}</span>
              </div>
              <p className="mt-1 mb-2 text-[13px] text-muted">{planRead ? "Read from your media plan. Change anything before you continue." : "None yet. Add them here, or upload a plan at the top."}</p>
              <ul>
                {lines.map((l, i) => (
                  <li key={i} className="flex items-center gap-2.5 border-t py-1" style={{ borderColor: theme.soft }}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{channelName(l.channel)}{l.format ? ` · ${l.format}` : ""}</div>
                      <div className="text-xs text-muted">{money(l.amount, l.currency)} planned</div>
                    </div>
                    <button type="button" aria-label={`Remove ${channelName(l.channel)} ${l.format}`} onClick={() => removeLine(i)} className="size-11 shrink-0 rounded-xl text-lg" style={{ backgroundColor: theme.soft }}>×</button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-[18px] p-3" style={{ backgroundColor: theme.soft }}>
                <select aria-label="Channel" value={lineChannel || budgetOptions[0]?.id || ""} onChange={(ev) => setLineChannel(ev.target.value)} className={inputClass}>
                  {budgetOptions.length === 0 && <option value="">Tick a channel first</option>}
                  {budgetOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <input aria-label="Format" placeholder="Format (optional)" value={lineFormat} onChange={(ev) => setLineFormat(ev.target.value)} className={inputClass} />
                <input aria-label="Amount" inputMode="numeric" placeholder="Amount" value={lineAmount} onChange={(ev) => setLineAmount(ev.target.value)} className={inputClass} />
                <select aria-label="Currency" value={lineCurrency} onChange={(ev) => setLineCurrency(ev.target.value as Currency)} className={inputClass}>
                  <option value="NGN">₦ Naira</option>
                  <option value="USD">$ Dollars</option>
                </select>
                <button type="button" onClick={addLine} className="col-span-2 min-h-11 rounded-xl text-sm font-bold" style={{ backgroundColor: theme.main, color: theme.onMain }}>+ Add this line</button>
              </div>
              <details className="mt-2">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold" style={{ color: theme.ink }}>Paste rows from a spreadsheet</summary>
                <textarea aria-label="Rows to paste" value={pasteRows} onChange={(ev) => setPasteRows(ev.target.value)} rows={4} placeholder={"Channel, Format, Amount\nTikTok, Spark Ads, 300000"} className={`${inputClass} py-3`} />
                <button type="button" onClick={addPasted} className="mt-2 min-h-11 w-full rounded-xl border-[1.5px] text-sm font-bold" style={{ borderColor: theme.main, color: theme.ink }}>Add these rows</button>
              </details>
            </section>
          )}

          <section className="rounded-[20px] border-[1.5px] p-4" style={{ borderColor: theme.soft }}>
            <h2 className="mb-2.5 text-[15px] font-bold">Process level</h2>
            <div className="grid grid-cols-3 gap-2">
              {(["heavy", "medium", "low"] as const).map((t) => (
                <button key={t} type="button" aria-pressed={tier === t} onClick={() => setTier(t)} className="min-h-11 rounded-xl border-[1.5px] text-sm font-semibold capitalize" style={chip(tier === t)}>{t}</button>
              ))}
            </div>
            <label className="mt-3 flex min-h-11 items-center gap-2.5 text-sm font-semibold">
              <input type="checkbox" checked={inCycle} onChange={(ev) => setInCycle(ev.target.checked)} className="size-5" style={{ accentColor: theme.main }} />
              In the monthly cycle
            </label>
          </section>
        </>
      )}

      {/* ---------------------------------------------------------- Step 3 */}
      {step === 2 && (
        <>
          <div>
            <h1 className="font-display text-[34px] leading-none font-black tracking-tight" style={{ color: theme.ink }}>Who updates what?</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">One Account Lead, and up to 3 Update Managers who each cover an area.</p>
          </div>

          <section className="rounded-[22px] p-[18px]" style={{ background: `linear-gradient(140deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}>
            <label className="block">
              <span className="block text-[11px] font-bold tracking-[0.15em] opacity-85">ACCOUNT LEAD</span>
              <select value={lead} onChange={(ev) => setLead(ev.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl bg-white px-3 font-display text-lg font-extrabold text-black">
                <option value="">Choose</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span className="mt-1.5 block text-[13px] opacity-90">Sets up the campaign and sees everything.</span>
            </label>
          </section>

          <section>
            <div className="mb-2.5 flex items-baseline justify-between gap-2.5">
              <h2 className="font-display text-[22px] font-black">Update Managers</h2>
              <span className="text-[13px] font-semibold text-muted">{managers.length} of 3</span>
            </div>
            <div className="space-y-2">
              {managers.map((id) => {
                const person = people.find((p) => p.id === id);
                if (!person) return null;
                const covers = neededAreas.filter((a) => coverOf(a) === id).map((a) => AREAS[a]?.label ?? a);
                return (
                  <div key={id} className="rounded-[18px] p-3" style={{ backgroundColor: theme.soft }}>
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] font-display text-lg font-black" style={{ backgroundColor: theme.main, color: theme.onMain }}>{person.name.slice(0, 1)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-bold">{person.name}</div>
                        <div className="truncate text-[13px] text-muted">{person.email ?? "No email yet"}</div>
                      </div>
                      <button type="button" aria-label={`Remove ${person.name}`} onClick={() => setManagers(managers.filter((m) => m !== id))} className="size-11 shrink-0 rounded-xl bg-white text-lg">×</button>
                    </div>
                    <div className="mt-1.5 text-xs leading-snug text-muted"><b className="text-ink">Covers:</b> {covers.length ? covers.join(", ") : "No areas yet"}</div>
                    {person.hasLogin ? (
                      <span className="mt-2 inline-block rounded-full bg-[#E3F5EA] px-2.5 py-1 text-xs font-bold text-[#17633A]">Has a login</span>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <input type="email" aria-label={`${person.name}'s email`} placeholder="Their email" value={loginEmail[id] ?? person.email ?? ""} onChange={(ev) => setLoginEmail({ ...loginEmail, [id]: ev.target.value })} className={inputClass} />
                        <button type="button" onClick={() => createLoginFor(person)} className="min-h-12 shrink-0 rounded-2xl px-3 text-sm font-bold" style={{ backgroundColor: theme.main, color: theme.onMain }}>Create login</button>
                      </div>
                    )}
                  </div>
                );
              })}

              {managers.length < 3 && (
                <div className="rounded-[18px] border-[1.5px] border-dashed p-3.5" style={{ borderColor: theme.soft }}>
                  <div className="text-[15px] font-bold">Add an Update Manager</div>
                  <div className="mt-2 mb-1 text-xs text-muted">Someone already on your team</div>
                  <div className="flex flex-wrap gap-1.5">
                    {people.filter((p) => !managers.includes(p.id) && p.id !== lead).map((p) => (
                      <button key={p.id} type="button" onClick={() => setManagers([...managers, p.id])} className="min-h-11 rounded-full border-[1.5px] bg-white px-3.5 text-[13px] font-semibold" style={{ borderColor: theme.soft }}>{p.name}</button>
                    ))}
                  </div>
                  <div className="mt-2.5 mb-1 text-xs text-muted">Or someone new</div>
                  <div className="space-y-2">
                    <input aria-label="Their name" placeholder="Their name" value={addingName} onChange={(ev) => setAddingName(ev.target.value)} className={inputClass} />
                    <input type="email" aria-label="Their email" placeholder="Their email, for their login and notifications" value={addingEmail} onChange={(ev) => setAddingEmail(ev.target.value)} className={inputClass} />
                    <button type="button" onClick={addSomeone} className="min-h-12 w-full rounded-2xl text-sm font-bold" style={{ backgroundColor: theme.main, color: theme.onMain }}>Add and create their login</button>
                  </div>
                </div>
              )}
              {teamProblem && <p role="alert" className="text-sm font-medium text-red-700">{teamProblem}</p>}
              {passwordFor && (
                <div role="status" className="rounded-[18px] bg-[#FFF3D6] p-3.5 text-sm text-[#5A3700]">
                  <b>Login ready for {passwordFor.name}.</b> PRIME can&apos;t send email yet, so give them these privately. This password only shows once:
                  <div className="mt-2 rounded-xl bg-white p-2.5 font-mono text-[13px] break-all text-black">{passwordFor.email}<br />{passwordFor.password}</div>
                  <button type="button" onClick={() => setPasswordFor(null)} className="mt-2 min-h-11 font-bold underline">I&apos;ve noted it</button>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[20px] p-4" style={{ backgroundColor: theme.soft }}>
            <h2 className="text-[15px] font-bold">What Update Managers get by email</h2>
            <p className="mt-0.5 mb-1.5 text-xs leading-snug text-muted">Your choices are saved. Emails start once PRIME has its own web address.</p>
            {EMAIL_ALERTS.map(([id, label]) => (
              <label key={id} className="flex min-h-11 items-center gap-2.5 text-sm">
                <input type="checkbox" checked={alerts.includes(id)} onChange={() => setAlerts(flip(alerts, id))} className="size-5 shrink-0" style={{ accentColor: theme.main }} />
                {label}
              </label>
            ))}
          </section>

          <section>
            <h2 className="font-display text-[22px] font-black">Who covers each area</h2>
            <p className="mt-1 mb-2.5 text-[13px] leading-relaxed text-muted">Each person gets only their own areas in My work, and can only update those. One person can cover several.</p>
            {neededAreas.map((area) => (
              <div key={area} className="border-t py-3" style={{ borderColor: theme.soft }}>
                <div className="text-[15px] font-bold">{AREAS[area]?.label}</div>
                <div className="text-xs text-muted">{AREAS[area]?.detail}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {managers.map((id) => (
                    <button key={id} type="button" aria-pressed={coverOf(area) === id} onClick={() => setAreas({ ...areas, [area]: id })} className="min-h-11 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold" style={chip(coverOf(area) === id)}>
                      {personName(id)}
                    </button>
                  ))}
                  <button type="button" aria-pressed={!coverOf(area)} onClick={() => setAreas({ ...areas, [area]: "" })} className="min-h-11 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold" style={chip(!coverOf(area))}>
                    {leadName}
                  </button>
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-[20px] p-4" style={{ backgroundColor: theme.soft }}>
            <Field label="Leave cover" hint="Takes over this campaign's updates while Leave Mode is on.">
              <select value={leaveCover} onChange={(ev) => setLeaveCover(ev.target.value)} className={inputClass}>
                <option value="">Nobody yet</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </section>

          <p className="text-[13px] text-muted">
            Roles on this brand stay on the <Link href="/team" className="font-bold underline" style={{ color: theme.ink }}>Team</Link> screen, as a record of who does the work.
          </p>
        </>
      )}

      {/* ---------------------------------------------------------- Step 4 */}
      {step === 3 && !editing && (
        <>
          <div>
            <h1 className="font-display text-[34px] leading-none font-black tracking-tight" style={{ color: theme.ink }}>PRIME has drafted the work</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">Everything starts ticked. Untick what you don&apos;t want, add what&apos;s missing, then launch.</p>
          </div>

          {groups.map((g) => (
            <section key={g.area}>
              <h2 className="font-display text-xl font-black">{g.name}</h2>
              <div className="mb-2 text-xs text-muted">{g.source} · goes to <b className="text-ink">{coverName(g.area)}</b></div>
              {g.rows.length > 0 && (
                <div className="rounded-[18px] px-3 py-0.5" style={{ backgroundColor: theme.soft }}>
                  {g.rows.map((r, i) => {
                    const on = !unticked.includes(r.key);
                    return (
                      <label key={r.key} className="flex min-h-[60px] cursor-pointer items-center gap-3 py-2" style={i ? { borderTop: `1px solid ${theme.main}22` } : undefined}>
                        <input type="checkbox" checked={on} onChange={() => setUnticked(flip(unticked, r.key))} className="size-6 shrink-0" style={{ accentColor: theme.main }} />
                        <span className={`min-w-0 flex-1 ${on ? "" : "opacity-45"}`}>
                          <span className="block text-sm font-semibold">{r.title}</span>
                          <span className="block text-xs text-muted">{r.detail}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {g.rows.length === 0 && g.area !== "content" && <p className="text-sm text-muted">{g.area === "reports" ? "Set the campaign's dates in step 1 to schedule its reports." : "Nothing yet. Add budget lines in step 2 to draft ads."}</p>}
              {g.area === "content" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input aria-label="Content title" placeholder="e.g. Curry jollof reel" value={contentTitle} onChange={(ev) => setContentTitle(ev.target.value)} className={`${inputClass} min-w-0 flex-[2_1_180px]`} />
                  <input aria-label="Planned date" type="date" value={contentDate} onChange={(ev) => setContentDate(ev.target.value)} className={`${inputClass} flex-[1_1_130px]`} />
                  <button
                    type="button"
                    onClick={() => {
                      if (contentTitle.trim().length < 2) return;
                      setHandContent([...handContent, { title: contentTitle.trim(), date: contentDate }]);
                      setContentTitle("");
                      setContentDate("");
                    }}
                    className="min-h-12 w-full rounded-2xl border-[1.5px] border-dashed text-sm font-bold"
                    style={{ borderColor: theme.main, color: theme.ink }}
                  >
                    + Add content
                  </button>
                </div>
              )}
            </section>
          ))}

          {existingTotal > 0 && (
            <section className="rounded-[18px] border-[1.5px] p-3.5" style={{ borderColor: theme.soft }}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={attachExisting} onChange={(ev) => setAttachExisting(ev.target.checked)} className="mt-0.5 size-6 shrink-0" style={{ accentColor: theme.main }} />
                <span>
                  <span className="block text-sm font-bold">Bring in what {brandName} is already tracking</span>
                  <span className="block text-xs leading-snug text-muted">
                    {[
                      [existing.content, "content"],
                      [existing.ads, "ads"],
                      [existing.assets, "assets"],
                      [existing.reports, "reports"],
                    ].filter(([n]) => Number(n) > 0).map(([n, label]) => `${n} ${label}`).join(", ")} not yet in a campaign. They move into this one, unchanged.
                  </span>
                </span>
              </label>
            </section>
          )}

          <p className="rounded-2xl border-[1.5px] p-3.5 text-[13px] leading-relaxed text-muted" style={{ borderColor: theme.soft }}>
            <b className="text-ink">No plan or calendar yet?</b> You can still launch. Add work by hand on the Update screen, or import it later.
          </p>
        </>
      )}

      {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p>}
      {step === 0 && name.length > 0 && stepOneProblem && <p role="alert" className="text-sm font-medium text-red-700">{stepOneProblem}</p>}

      {step === steps.length - 1 && !editing && (
        <p className="text-[13px] leading-relaxed text-muted">
          {[...countFor.entries()].map(([who, n]) => `${n} ${n === 1 ? "item" : "items"} for ${who}`).join(", ") || "No work ticked yet"}. {leadName} sees all of it.
        </p>
      )}

      <div className="flex gap-2.5">
        {step > 0 && (
          <button type="button" onClick={() => go(step - 1)} className="min-h-[58px] flex-1 rounded-[20px] text-[15px] font-semibold" style={{ backgroundColor: theme.soft, color: theme.ink }}>Back</button>
        )}
        <button
          type="button"
          disabled={pending || !!stepOneProblem}
          onClick={() => (step < steps.length - 1 ? go(step + 1) : submit())}
          className="min-h-[58px] flex-[2] rounded-[20px] font-display text-lg font-extrabold transition disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain, boxShadow: `0 12px 26px ${theme.main}59` }}
        >
          {step < steps.length - 1 ? "Continue" : pending ? "Saving…" : editing ? "Save changes" : "Launch campaign"}
        </button>
      </div>
    </div>
  );
}

const groupLabel = (id: string) => ALL_GROUPS.find((g) => g.id === id)?.label ?? id;

function readDraft(key: string): Record<string, unknown> {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function BackIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
  );
}

// "+ Other": add a type that isn't on the list.
function OtherOption({ label, onAdd }: { label: string; onAdd: (option: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  if (!open) {
    return (
      <button type="button" aria-label={`Add another type to ${label}`} onClick={() => setOpen(true)} className="min-h-11 rounded-xl border-[1.5px] border-dashed bg-white px-3 text-[13px] font-semibold text-muted">
        + Other
      </button>
    );
  }
  return (
    <span className="flex w-full gap-1.5">
      <input autoFocus aria-label={`New type for ${label}`} value={value} onChange={(ev) => setValue(ev.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm" />
      <button
        type="button"
        onClick={() => {
          if (value.trim()) onAdd(value.trim());
          setValue("");
          setOpen(false);
        }}
        className="min-h-11 rounded-xl border-[1.5px] bg-white px-3 text-[13px] font-bold"
      >
        Add
      </button>
    </span>
  );
}
