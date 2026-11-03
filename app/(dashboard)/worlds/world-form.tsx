"use client";

import { useActionState, useState } from "react";
import { saveWorld } from "./actions";
import { createClient } from "@/lib/supabase/browser";
import { detectColours, prepareImage } from "@/lib/image-tools";
import { worldTheme } from "@/lib/colour";
import { MEDIA_BUCKET } from "@/lib/media";
import { CHANNELS, INDUSTRIES, MARKETING_TYPES, REPORTING_OPTIONS, ROLES_NEEDED, labelFor, type MarketingType } from "@/lib/campaign";
import { fail, type FormState } from "@/lib/form-state";
import type { Brand } from "@/lib/types";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";

// "Create a dashboard" (and "Edit world"): four short steps on one page.
// Every step stays in the same form, so nothing is lost when going back.
// Images are shrunk in the browser, uploaded straight to storage, and the
// logo's colours are read on the spot.

type Props = {
  brand?: Brand;                       // set when editing an existing world
  bannerUrl?: string | null;
  logoUrl?: string | null;
  people: { id: string; name: string }[];
  assignedRoles: string[];             // role names already held on this brand
};

const STEPS = ["Identity", "Brand profile", "Campaign", "Targets"];
const DEFAULT_COLOUR = "#0B1F4B";

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-2xl border px-4 text-sm font-semibold transition ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:bg-mist"}`}
    >
      {on && (
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
      )}
      {children}
    </button>
  );
}

export function WorldForm({ brand, bannerUrl, logoUrl, people, assignedRoles }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(brand?.name ?? "");
  const [bannerPreview, setBannerPreview] = useState<string | null>(bannerUrl ?? null);
  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl ?? null);
  const [bannerBlob, setBannerBlob] = useState<Blob | null>(null);
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [palette, setPalette] = useState<string[]>(brand?.palette ?? []);
  const [colour, setColour] = useState(brand?.colour ?? DEFAULT_COLOUR);
  const [reading, setReading] = useState(false);
  const [products, setProducts] = useState<string[]>(brand?.products ?? []);
  const [productDraft, setProductDraft] = useState("");
  const [types, setTypes] = useState<string[]>(brand?.marketing_types ?? ["digital"]);
  const [channels, setChannels] = useState<string[]>(brand?.channels ?? []);
  const [localError, setLocalError] = useState<FormState>(null);

  const theme = worldTheme(colour);
  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function onBanner(file: File | undefined) {
    if (!file) return;
    try {
      const blob = await prepareImage(file, 1600, "image/webp");
      setBannerBlob(blob);
      setBannerPreview(URL.createObjectURL(blob));
    } catch (e) {
      setLocalError(fail((e as Error).message));
    }
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      const blob = await prepareImage(file, 512, "image/png");
      setLogoBlob(blob);
      setLogoPreview(URL.createObjectURL(blob));
      const found = await detectColours(blob);
      setPalette(found);
      if (found[0]) setColour(found[0]);
    } catch (e) {
      setLocalError(fail((e as Error).message));
    } finally {
      setReading(false);
    }
  }

  function addProduct() {
    const p = productDraft.trim();
    if (p && !products.includes(p)) setProducts([...products, p]);
    setProductDraft("");
  }

  // Upload any new images first, then save everything in one go.
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    try {
      const supabase = createClient();
      const folder = brand?.id ?? `new-${crypto.randomUUID()}`;
      for (const [kind, blob, ext, type] of [
        ["banner", bannerBlob, "webp", "image/webp"],
        ["logo", logoBlob, "png", "image/png"],
      ] as const) {
        if (!blob) continue;
        const path = `${folder}/${kind}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: type });
        if (error) return fail(`Couldn't upload the ${kind}: ${error.message}`);
        formData.set(`${kind}_path`, path);
      }
    } catch (e) {
      return fail((e as Error).message);
    }
    return saveWorld(brand?.id ?? null, prev, formData);
  }, null);

  function next() {
    if (step === 0 && name.trim().length < 2) {
      setLocalError(fail("Give the brand a name first."));
      return;
    }
    setLocalError(null);
    setStep(step + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const neededRoles = [...new Set(types.flatMap((t) => ROLES_NEEDED[t as MarketingType] ?? []))];

  return (
    <form action={formAction} className="space-y-5">
      {/* Progress */}
      <div>
        <div className="text-xs font-semibold tracking-[0.15em] text-muted uppercase">
          Step {step + 1} of 4 · {STEPS[step]}
        </div>
        <div aria-hidden="true" className="mt-2 flex gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "prime-gradient" : "bg-line"}`} />
          ))}
        </div>
      </div>

      {/* Values that live in component state */}
      <input type="hidden" name="colour" value={colour} />
      <input type="hidden" name="palette" value={palette.join(",")} />
      <input type="hidden" name="banner_path" value={brand?.banner_path ?? ""} />
      <input type="hidden" name="logo_path" value={brand?.logo_path ?? ""} />
      {products.map((p) => <input key={p} type="hidden" name="products" value={p} />)}
      {types.map((t) => <input key={t} type="hidden" name="marketing_types" value={t} />)}
      {channels.map((c) => <input key={c} type="hidden" name="channels" value={c} />)}

      {/* Step 1: Identity */}
      <section className={step === 0 ? "space-y-5" : "hidden"}>
        <h1 className="font-display text-[34px] leading-none font-black tracking-tight text-navy">
          {brand ? "Edit this world" : "Build your brand's world"}
        </h1>
        <Field label="Brand name">
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ducros Spices"
            className={`${inputClass} font-display text-xl font-black`}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-semibold">Banner · product or brand image</span>
          <label className="relative block h-44 cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed border-line bg-mist">
            {bannerPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file
              <img src={bannerPreview} alt="Banner preview" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-sm font-semibold text-muted">+ Add a banner</span>
            )}
            {bannerPreview && <span className="absolute right-3 bottom-3 rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white">Change banner</span>}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onBanner(e.target.files?.[0])} />
          </label>
        </div>

        <div className="flex items-center gap-4">
          <label className="relative flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-white shadow-md ring-2 ring-line">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file
              <img src={logoPreview} alt="Logo preview" className="size-[88%] object-contain" />
            ) : (
              <span className="text-xs font-semibold text-muted">+ Logo</span>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onLogo(e.target.files?.[0])} />
          </label>
          <div className="text-sm">
            <div className="font-semibold">Logo</div>
            <div className="text-muted">{reading ? "Reading colours from your logo…" : "PRIME reads the brand's colours from it."}</div>
          </div>
        </div>

        <section className="rounded-3xl bg-mist p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold">{palette.length ? "Colours found in the logo" : "Main colour"}</h2>
            <span className="text-xs text-muted">Tap to set the main colour</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {palette.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-pressed={hex === colour}
                aria-label={`Use ${hex} as the main colour`}
                onClick={() => setColour(hex)}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className="size-14 rounded-2xl shadow-sm"
                  style={{ backgroundColor: hex, boxShadow: hex === colour ? "0 0 0 3px #fff, 0 0 0 6px #0B1F4B" : undefined }}
                />
                <span className="font-mono text-[10px] text-muted">{hex}</span>
              </button>
            ))}
            <label className="flex flex-col items-center gap-1">
              <span className="relative flex size-14 items-center justify-center rounded-2xl border-2 border-dashed border-line bg-white text-xs font-semibold text-muted">
                Pick
                <input type="color" value={colour} onChange={(e) => setColour(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Pick a colour" />
              </span>
              <span className="text-[10px] text-muted">Your own</span>
            </label>
          </div>
        </section>

        <div>
          <span className="mb-1.5 block text-sm font-semibold">Preview</span>
          <div className="overflow-hidden rounded-3xl shadow-lg">
            <div className="p-5" style={{ background: `linear-gradient(150deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}>
              <div className="text-[11px] font-bold tracking-[0.2em] opacity-85">WELCOME TO THE WORLD OF</div>
              <div className="font-display text-3xl leading-none font-black">{name || "Your brand"}</div>
            </div>
            <div className="flex items-center gap-3 bg-white p-4">
              <div className="flex-1">
                <div className="text-xs text-muted">Content posted</div>
                <div className="mt-1.5 h-2 rounded-full bg-mist"><div className="h-2 w-2/3 rounded-full" style={{ backgroundColor: theme.main }} /></div>
              </div>
              <span className="rounded-full px-4 py-2 text-sm font-bold" style={{ backgroundColor: theme.main, color: theme.onMain }}>Mark posted</span>
            </div>
          </div>
        </div>
      </section>

      {/* Step 2: Brand profile */}
      <section className={step === 1 ? "space-y-4" : "hidden"}>
        <h1 className="font-display text-3xl leading-none font-black text-navy">Brand profile</h1>
        <p className="text-sm text-muted">Shown at the top of the brand&apos;s world.</p>
        <Field label="About, in 1 or 2 lines">
          <textarea name="about" defaultValue={brand?.about ?? ""} rows={3} className={`${inputClass} py-3`} />
        </Field>
        <Field label="Website">
          <input name="website" type="url" defaultValue={brand?.website ?? ""} placeholder="https://…" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Industry">
            <select name="industry" defaultValue={brand?.industry ?? "FMCG"} className={inputClass}>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <input name="category" defaultValue={brand?.category ?? ""} placeholder="e.g. Spices" className={inputClass} />
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Products</span>
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <span key={p} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-mist pr-1.5 pl-4 text-sm font-semibold">
                {p}
                <button type="button" aria-label={`Remove ${p}`} onClick={() => setProducts(products.filter((x) => x !== p))} className="flex size-7 items-center justify-center rounded-full bg-line">×</button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={productDraft}
              onChange={(e) => setProductDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addProduct();
                }
              }}
              placeholder="e.g. Curry"
              aria-label="New product"
              className={inputClass}
            />
            <Button type="button" variant="secondary" onClick={addProduct}>Add</Button>
          </div>
        </div>
      </section>

      {/* Step 3: Campaign */}
      <section className={step === 2 ? "space-y-5" : "hidden"}>
        <h1 className="font-display text-3xl leading-none font-black text-navy">What does the campaign include?</h1>
        <div className="flex flex-wrap gap-2">
          {MARKETING_TYPES.map((t) => (
            <Chip key={t.id} on={types.includes(t.id)} onClick={() => toggle(types, setTypes, t.id)}>{t.label}</Chip>
          ))}
        </div>

        {types.includes("digital") && (
          <div>
            <h2 className="mb-2 text-sm font-bold">Digital channels</h2>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <Chip key={c.id} on={channels.includes(c.id)} onClick={() => toggle(channels, setChannels, c.id)}>{c.label}</Chip>
              ))}
            </div>
            {channels.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                {channels.length} channels · each creative asset is posted on all of them. Ad formats:{" "}
                {channels.map((id) => `${labelFor(CHANNELS, id)} (${CHANNELS.find((c) => c.id === id)!.formats.join(", ")})`).join("; ")}.
              </p>
            )}
          </div>
        )}

        <div className="rounded-3xl border border-line p-4">
          <h2 className="text-sm font-bold">Roles this campaign needs</h2>
          <ul className="mt-2 divide-y divide-line">
            {neededRoles.map((role) => (
              <li key={role} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span className="font-semibold">{role}</span>
                {assignedRoles.includes(role) ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Filled</span>
                ) : (
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">Assign on Team</span>
                )}
              </li>
            ))}
          </ul>
          {neededRoles.length === 0 && <p className="text-sm text-muted">Tick a marketing type above.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Process level">
            <select name="tier" defaultValue={brand?.tier ?? "medium"} className={inputClass}>
              <option value="heavy">Heavy</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </Field>
          <label className="flex items-end gap-2 pb-3 text-sm font-semibold">
            <input type="checkbox" name="in_execution_cycle" defaultChecked={brand?.in_execution_cycle ?? true} className="size-5 accent-navy" />
            In the monthly cycle
          </label>
        </div>
      </section>

      {/* Step 4: Targets */}
      <section className={step === 3 ? "space-y-4" : "hidden"}>
        <h1 className="font-display text-3xl leading-none font-black text-navy">Targets</h1>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Content pieces a month, from">
            <input name="content_min" type="number" min={0} inputMode="numeric" defaultValue={brand?.monthly_content_target_min ?? 8} className={inputClass} />
          </Field>
          <Field label="to">
            <input name="content_max" type="number" min={0} inputMode="numeric" defaultValue={brand?.monthly_content_target_max ?? 10} className={inputClass} />
          </Field>
          <Field label="Creative assets this cycle">
            <input name="creative_assets_target" type="number" min={0} inputMode="numeric" defaultValue={brand?.creative_assets_target ?? ""} className={inputClass} />
          </Field>
        </div>
        {types.includes("traditional") && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="TV spots planned">
              <input name="tv_spots_target" type="number" min={0} inputMode="numeric" defaultValue={brand?.tv_spots_target ?? ""} className={inputClass} />
            </Field>
            <Field label="Radio spots planned">
              <input name="radio_spots_target" type="number" min={0} inputMode="numeric" defaultValue={brand?.radio_spots_target ?? ""} className={inputClass} />
            </Field>
          </div>
        )}
        <Field label="Client reports">
          <select name="reporting" defaultValue={brand?.reporting ?? REPORTING_OPTIONS[0]} className={inputClass}>
            {[...new Set([...(brand?.reporting ? [brand.reporting] : []), ...REPORTING_OPTIONS])].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Leave cover" hint="Who can edit this world while Leave Mode is on.">
          <select name="leave_cover_person_id" defaultValue={brand?.leave_cover_person_id ?? ""} className={inputClass}>
            <option value="">Nobody yet</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <div className="rounded-3xl border-2 border-dashed border-line p-4 text-sm text-muted">
          <span className="font-semibold text-ink">Media plan</span> · coming later: upload the plan so stations, spot durations and billboard locations are tracked one by one.
        </div>
      </section>

      <FormMessage state={localError ?? state} />

      <div className="flex gap-2 pt-1">
        {step > 0 && (
          <Button type="button" variant="secondary" onClick={() => setStep(step - 1)} className="min-h-14 flex-1">Back</Button>
        )}
        {step < 3 ? (
          <Button type="button" onClick={next} className="min-h-14 flex-[2] text-base">Continue</Button>
        ) : (
          <Button type="submit" disabled={pending} className="min-h-14 flex-[2] text-base">
            {pending ? "Saving…" : brand ? "Save changes" : "Create this world"}
          </Button>
        )}
      </div>
    </form>
  );
}
