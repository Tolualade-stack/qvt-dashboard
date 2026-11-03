import Image from "next/image";
import Link from "next/link";
import { mediaUrl } from "@/lib/media";
import { worldTheme } from "@/lib/colour";
import { timeAgo } from "@/lib/format";
import { TIER_LABELS, type Brand } from "@/lib/types";
import { LiveDot } from "@/components/ui";

// A brand's card on Home: banner, logo, name, a status pill and three headline
// numbers, all in the brand's own colours.

export type WorldStats = {
  posted: number;        // content pieces posted this month
  adsLive: number;
  reach: string | null;  // latest uploaded reach, already formatted (e.g. "298k"); null until numbers arrive
};

export function WorldCard({ brand, stats, flag }: { brand: Brand; stats: WorldStats; flag?: string | null }) {
  const theme = worldTheme(brand.colour);
  const banner = mediaUrl(brand.banner_path);
  const logo = mediaUrl(brand.logo_path);
  const target = brand.monthly_content_target_max;

  const tiles = [
    { value: stats.posted, suffix: target ? `/${target}` : "", label: "posted" },
    { value: stats.adsLive, suffix: "", label: "ads live" },
    { value: stats.reach ?? "–", suffix: "", label: "reach" },
  ];

  return (
    <Link
      href={`/brands/${brand.id}`}
      className="block overflow-hidden rounded-[26px] bg-white transition hover:-translate-y-0.5"
      style={{ boxShadow: `0 10px 30px ${theme.main}2e, 0 0 0 1px ${theme.main}1f` }}
    >
      <div className="relative h-[150px] overflow-hidden" style={{ background: `linear-gradient(135deg, ${theme.main} 0%, ${theme.deep} 100%)` }}>
        {banner ? (
          <Image src={banner} alt="" fill sizes="(max-width: 640px) 100vw, 380px" className="object-cover object-[center_35%]" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full border-[1.5px] border-dashed border-white/60 px-3.5 py-2 text-[13px] font-semibold text-white/90">
              + Add a banner
            </span>
          </span>
        )}
        <div aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(0,0,0,0) 35%, ${theme.deep}d9 100%)` }} />
        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
          <LiveDot colour="#4ADE80" /> Live · {timeAgo(brand.updated_at)}
        </span>
      </div>

      <div className="relative px-4 pb-4">
        <span
          className="absolute -top-8 left-4 flex size-16 items-center justify-center overflow-hidden rounded-full bg-white font-display text-2xl font-black shadow-[0_6px_16px_rgba(0,0,0,0.18)]"
          style={{ color: theme.ink }}
        >
          {logo ? <Image src={logo} alt={`${brand.name} logo`} fill sizes="64px" className="object-contain p-1" /> : brand.name.slice(0, 1)}
        </span>

        <div className="flex items-end justify-between gap-2 pt-10">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-[0.08em]" style={{ color: theme.ink }}>THE WORLD OF</div>
            <div className="font-display text-[26px] leading-none font-black">{brand.name}</div>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={flag ? { backgroundColor: "#FFF1D6", color: "#8A3B00" } : { backgroundColor: theme.soft, color: theme.ink }}
          >
            {flag ?? TIER_LABELS[brand.tier]}
          </span>
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-[14px] p-2.5" style={{ backgroundColor: theme.soft }}>
              <div className="font-display text-[22px] leading-tight font-black" style={{ color: theme.ink }}>
                {tile.value}
                {tile.suffix && <span className="text-[13px] opacity-70">{tile.suffix}</span>}
              </div>
              <div className="text-[11px] text-muted">{tile.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}
