import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/media";
import { tint, worldTheme } from "@/lib/colour";
import { getCurrentUser } from "@/lib/auth";
import { TIER_LABELS, type AuditEntry, type Brand, type BrandRole, type Person } from "@/lib/types";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { HistoryList } from "@/components/history-list";
import { CanvaLinkForm } from "./canva-link-form";

export default async function BrandPage({ params }: PageProps<"/brands/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const me = (await getCurrentUser())!;

  const [{ data: brandRow }, { data: roleRows }, { data: peopleRows }, { data: historyRows }] = await Promise.all([
    supabase.from("brands").select("*").eq("id", id).maybeSingle(),
    supabase.from("brand_roles").select("*").eq("brand_id", id).is("ended_at", null).order("sort_order"),
    supabase.from("people").select("id, slug, full_name, is_placeholder"),
    supabase
      .from("audit_log")
      .select("*")
      .eq("table_name", "brands")
      .eq("row_id", id)
      .order("changed_at", { ascending: false })
      .limit(10),
  ]);
  if (!brandRow) notFound();

  const brand = brandRow as Brand;
  const roles = (roleRows ?? []) as BrandRole[];
  const people = new Map(((peopleRows ?? []) as Person[]).map((p) => [p.id, p]));
  const coverName = people.get(brand.leave_cover_person_id ?? "")?.full_name;

  // Group the jobs by person, in the order of their first job on this brand.
  const team = new Map<string, BrandRole[]>();
  for (const role of roles) team.set(role.person_id, [...(team.get(role.person_id) ?? []), role]);

  // Mirrors the database rule can_edit_brand(); the database still has the final say.
  const canEdit =
    me.role === "admin" ||
    me.role === "updates_manager" ||
    (me.role === "leave_cover" && brand.leave_mode_on && brand.leave_cover_person_id === me.personId);

  // The world's colours, from the logo: the main colour and its shades, and up to
  // three logo colours for the profile dots.
  const theme = worldTheme(brand.colour);
  const dots = [0, 1, 2].map((i) => brand.palette[i] ?? tint(brand.colour, i * 0.3));
  const banner = mediaUrl(brand.banner_path);
  const logo = mediaUrl(brand.logo_path);

  const target =
    brand.monthly_content_target_min != null
      ? `${brand.monthly_content_target_min}–${brand.monthly_content_target_max} pieces a month`
      : "No monthly target yet";

  return (
    <>
      {/* Hero: the brand's banner photo fading into its own deep colour. */}
      <section className="relative -mx-5 -mt-4 h-[340px] overflow-hidden text-white sm:mx-0 sm:mt-0 sm:rounded-[30px]" style={{ backgroundColor: theme.deep }}>
        {banner ? (
          <Image src={banner} alt="" fill priority sizes="(max-width: 768px) 100vw, 768px" className="prime-hero-zoom object-cover object-[center_30%]" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${theme.main} 0%, ${theme.deep} 100%)` }} />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%, ${theme.deep}bf 70%, ${theme.deep} 100%)` }}
        />
        {me.role === "admin" && (
          <Link
            href={`/brands/${brand.id}/edit`}
            className="absolute top-4 right-4 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-black/50 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-black/65"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>
            Edit world
          </Link>
        )}
        <div className="absolute inset-x-5 bottom-7">
          <div className="prime-fade-up text-xs font-bold tracking-[0.25em] text-white/85">WELCOME TO THE WORLD OF</div>
          <h1 className="prime-fade-up mt-1 font-display text-5xl leading-[0.95] font-black tracking-tight" style={{ animationDelay: "0.15s" }}>
            {brand.name}
          </h1>
          <p className="prime-fade-up mt-2 text-sm text-white/85" style={{ animationDelay: "0.3s" }}>{brand.scope}</p>
        </div>
      </section>

      {/* Brand profile, with the logo overlapping the hero's edge. */}
      <section aria-label="Brand profile" className="relative mb-5 px-1">
        <span
          className="relative -mt-10 ml-4 flex size-20 items-center justify-center overflow-hidden rounded-full bg-white font-display text-3xl font-black shadow-lg ring-4 ring-white"
          style={{ color: theme.ink }}
        >
          {logo ? <Image src={logo} alt={`${brand.name} logo`} fill sizes="80px" className="object-contain p-1.5" /> : brand.name.slice(0, 1)}
        </span>
        {brand.about && <p className="mt-4 text-[15px] leading-relaxed text-ink">{brand.about}</p>}
        {brand.website && (
          <a
            href={brand.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-bold"
            style={{ color: theme.ink }}
          >
            {brand.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
          </a>
        )}
        {(brand.industry || brand.category || brand.products.length > 0) && (
          <ul className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
            {[
              ["Industry", brand.industry],
              ["Category", brand.category],
              ["Products", brand.products.join(" · ")],
            ].map(([label, value], i) => (
              <li key={label}>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: dots[i] }} />
                  {label}
                </span>
                <span className="mt-1 block text-sm font-bold">{value || "Not set"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap gap-2">
            <Badge>{TIER_LABELS[brand.tier]}</Badge>
            {brand.leave_mode_on ? (
              <Badge tone="amber">Leave Mode on: {coverName} can edit</Badge>
            ) : (
              <Badge>Leave cover: {coverName ?? "not set"}</Badge>
            )}
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Reporting</dt>
              <dd className="text-right">{brand.reporting}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Content target</dt>
              <dd className="text-right">{target}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <SectionTitle>Monthly Canva content calendar</SectionTitle>
          {brand.canva_calendar_url ? (
            <a
              href={brand.canva_calendar_url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm font-medium text-live underline"
            >
              Open this month&apos;s calendar in Canva
            </a>
          ) : (
            <p className="text-sm text-muted">No calendar linked yet.</p>
          )}
          {canEdit && <CanvaLinkForm brandId={brand.id} currentUrl={brand.canva_calendar_url ?? ""} />}
        </Card>

        <Card>
          <SectionTitle>Team</SectionTitle>
          <ul className="divide-y divide-line">
            {[...team.entries()].map(([personId, jobs]) => {
              const person = people.get(personId);
              return (
                <li key={personId} className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{person?.full_name}</span>
                    {person?.is_placeholder && <Badge>Supporting role</Badge>}
                    {personId === brand.leave_cover_person_id && <Badge tone="amber">Leave cover</Badge>}
                  </div>
                  {jobs.map((job) => (
                    <div key={job.id} className="mt-1 text-sm">
                      <span className="text-ink">{job.title}</span>
                      {job.responsibilities && (
                        <span className="block text-muted">{job.responsibilities}</span>
                      )}
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <SectionTitle>History</SectionTitle>
          <HistoryList entries={(historyRows ?? []) as AuditEntry[]} />
        </Card>
      </div>
    </>
  );
}
