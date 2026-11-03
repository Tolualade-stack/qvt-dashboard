"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The floating menu bar at the bottom of every screen. The centre "+" is the
// main action (create a dashboard). Admin-only items are left out for others.

const icons: Record<string, ReactNode> = {
  home: <path d="M3 11 12 4l9 7M5 10v10h14V10" />,
  log: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  admin: (
    <>
      <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3z" />
      <path d="m9 12 2 2 4-4" />
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

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/brands");
    if (href === "/admin") return pathname.startsWith("/admin") || pathname.startsWith("/team");
    return pathname.startsWith(href);
  };

  // Team management lives inside Admin, so the bar keeps five large buttons.
  const left = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/log", label: "Log", icon: "log" },
  ];
  const right = [...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "admin" }] : []), { href: "/account", label: "My account", icon: "account" }];

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
      className="prime-gradient fixed inset-x-4 bottom-4 z-40 mx-auto flex h-[72px] max-w-md items-center justify-around rounded-[26px] px-2 shadow-2xl shadow-black/30"
    >
      {left.map(item)}
      {isAdmin && (
        <Link
          href="/worlds/new"
          aria-label="Create a dashboard"
          className="flex size-14 items-center justify-center rounded-[20px] bg-white text-navy shadow-lg transition hover:scale-105"
        >
          <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      )}
      {right.map(item)}
    </nav>
  );
}
