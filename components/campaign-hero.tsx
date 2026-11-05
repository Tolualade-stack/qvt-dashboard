import Image from "next/image";
import type { ReactNode } from "react";
import type { worldTheme } from "@/lib/colour";

// The brand's banner, logo and name across the top of campaign screens.
export function CampaignHero({
  theme,
  banner,
  logo,
  brandName,
  title,
  label,
  back,
}: {
  theme: ReturnType<typeof worldTheme>;
  banner: string | null;
  logo: string | null;
  brandName: string;
  title: string;
  label: string;
  back: ReactNode;
}) {
  return (
    <section className="relative -mx-5 -mt-4 h-[168px] overflow-hidden text-white sm:mx-0 sm:mt-0 sm:rounded-[26px]" style={{ backgroundColor: theme.deep }}>
      {banner ? (
        <Image src={banner} alt="" fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover object-[center_35%]" />
      ) : (
        <div aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${theme.main} 0%, ${theme.deep} 100%)` }} />
      )}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.4) 0%, ${theme.deep}cc 70%, ${theme.deep} 100%)` }} />
      <div className="relative flex items-center gap-3 px-5 pt-4">
        {back}
        <div className="text-xs font-bold tracking-[0.12em] uppercase">{label}</div>
      </div>
      <div className="absolute inset-x-5 bottom-3.5 flex items-center gap-2.5">
        <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white font-display text-lg font-black" style={{ color: theme.ink }}>
          {logo ? <Image src={logo} alt={`${brandName} logo`} fill sizes="44px" className="object-contain p-0.5" /> : brandName.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs text-white/85">The World of {brandName}</div>
          <div className="truncate font-display text-xl leading-tight font-black">{title}</div>
        </div>
      </div>
    </section>
  );
}
