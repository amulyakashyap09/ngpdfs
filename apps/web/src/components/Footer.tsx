import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/offline", label: "Offline" },
  { href: "/privacy#security", label: "Security" },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 font-black text-white">0</span>
            Paper<span className="-ml-1.5 text-blue-600">Zero</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            PDF tools that never see your PDFs.
          </p>
        </div>
        <nav aria-label="Footer">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Product</h3>
          <ul className="mt-2 space-y-1">
            <li><FooterLink href="/#tools">All tools</FooterLink></li>
            <li><FooterLink href="/diagnostics/hash">Developer diagnostics</FooterLink></li>
          </ul>
        </nav>
        <nav aria-label="Company links">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Learn</h3>
          <ul className="mt-2 space-y-1">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}><FooterLink href={link.href}>{link.label}</FooterLink></li>
            ))}
          </ul>
        </nav>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Local-first promise</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Standard tools process files entirely in your browser. No uploads, no watermarks, no
            account required.
          </p>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
        © {new Date().getFullYear()} PaperZero. Runs locally in your browser.
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-slate-600 hover:text-blue-700 hover:underline dark:text-slate-300 dark:hover:text-blue-400"
    >
      {children}
    </Link>
  );
}
