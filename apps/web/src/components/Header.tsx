"use client";

import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="PaperZero home">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-black text-white"
          >
            0
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            Paper<span className="text-blue-600">Zero</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          <NavLink href="/#tools">All tools</NavLink>
          <NavLink href="/how-it-works">How it works</NavLink>
          <NavLink href="/privacy">Privacy</NavLink>
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {menuOpen ? (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-950">
          <ul className="flex flex-col gap-1">
            <MobileNavLink href="/#tools" onClick={() => setMenuOpen(false)}>All tools</MobileNavLink>
            <MobileNavLink href="/how-it-works" onClick={() => setMenuOpen(false)}>How it works</MobileNavLink>
            <MobileNavLink href="/privacy" onClick={() => setMenuOpen(false)}>Privacy</MobileNavLink>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium leading-[28px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="block min-h-[44px] rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {children}
      </Link>
    </li>
  );
}
