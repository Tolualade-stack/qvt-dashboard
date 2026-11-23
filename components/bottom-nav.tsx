"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PrimeMark, PrimeWordmark } from "@/components/prime-logo";

// Phones and tablets: the floating menu bar at the bottom of every screen.
// Desktop (wide screens): the same links as a side menu down the left edge.
// The centre "+" is the
// main action: log an update. Admin and Team live inside Me, so the bar keeps
// five large buttons for everyone; Create a Dashboard is on Home.

const icons: Record<string, ReactNode> = {
  home: <path d="M3 11 12 4l9 7M5 10v10h14V10" />,
  log: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  work: (
    <>
      <path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
      <path d="M11 6h10M11 12h10M11 18h10" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
};

function Icon({ name }: { name: string }) {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/brands") || pathname.startsWith("/worlds");
    if (href === "/work") return pathname.startsWith("/work") || pathname.startsWith("/check-in");
    if (href === "/account") return pathname.startsWith("/account") || pathname.startsWith("/admin") || pathname.startsWith("/team");
    return pathname.startsWith(href);
  };
}

export function BottomNav() {
  const pathname = usePathname();
  const isActive = useIsActive();

  const left = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/work", label: "My work", icon: "work" },
  ];
  const right = [
    { href: "/log", label: "Log", icon: "log" },
    { href: "/account", label: "My account", icon: "account" },
  ];

  const item = (link: { href: string; label: string; icon: string }) => (
    <Link
      key={link.href}
      href={link.href}
      aria-label={link.label}
      aria-current={isActive(link.href) ? "page" : undefined}
      className={`flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-semibold transition ${isActive(link.href) ? "text-white" : "text-[#8FA3CC] hover:text-white"}`}
    >
      <Icon name={link.icon} />
      {link.label === "My account" ? "Me" : link.label}
    </Link>
  );

  return (
    <nav
      aria-label="Main menu"
      className="prime-gradient fixed inset-x-4 bottom-4 z-40 mx-auto flex h-[72px] lg:hidden max-w-md items-center justify-around rounded-[26px] px-2 shadow-2xl shadow-black/30"
    >
      {left.map(item)}
      <Link
        href="/update"
        aria-label="Add an update"
        aria-current={pathname === "/update" ? "page" : undefined}
        className="flex size-14 items-center justify-center rounded-[20px] bg-white text-navy shadow-lg transition hover:scale-105"
      >
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
      {right.map(item)}
    </nav>
  );
}

export function SideNav({ name, roleLabel, workspace, isAdmin }: { name: string; roleLabel: string; workspace: string | null; isAdmin: boolean }) {
  const pathname = usePathname();
  const isActive = useIsActive();
  const links = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/work", label: "My work", icon: "work" },
    { href: "/log", label: "Log", icon: "log" },
    { href: "/account", label: isAdmin ? "Me & Admin" : "Me", icon: "account" },
  ];

  return (
    <nav aria-label="Main menu" className="prime-gradient fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col px-4 py-6 text-white lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2" aria-label="PRIME home">
        <PrimeMark size={36} />
        <PrimeWordmark height={22} colour="#FFFFFF" />
      </Link>
      {workspace && <span className="mt-3 ml-2 self-start rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#C9D6F5]">{workspace}</span>}

      <Link
        href="/update"
        aria-current={pathname === "/update" ? "page" : undefined}
        className="mt-7 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white font-display text-base font-extrabold text-navy shadow-lg transition hover:scale-[1.02]"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Add an update
      </Link>

      <ul className="mt-6 space-y-1">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold transition ${isActive(link.href) ? "bg-white/15 text-white" : "text-[#8FA3CC] hover:bg-white/5 hover:text-white"}`}
            >
              <Icon name={link.icon} />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/account" className="mt-auto flex items-center gap-3 rounded-2xl bg-white/5 p-3 transition hover:bg-white/10">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white font-display text-base font-black text-navy">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{name}</span>
          <span className="block truncate text-xs text-[#8FA3CC]">{roleLabel}</span>
        </span>
      </Link>
    </nav>
  );
}
