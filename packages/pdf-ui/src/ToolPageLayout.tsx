"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PrivacyChips } from "./primitives";

export interface ToolPageMeta {
  name: string;
  slug: string;
  shortDescription: string;
  categoryLabel: string;
  howItWorks: string[];
  faq: Array<{ question: string; answer: string }>;
  offlineCapable: boolean;
  remoteDisclosure?: string | null;
}

export interface RelatedToolLink {
  name: string;
  slug: string;
  shortDescription: string;
}

export interface ToolPageLayoutProps {
  tool: ToolPageMeta;
  related?: RelatedToolLink[];
  children: ReactNode;
}

export function ToolPageLayout({ tool, related = [], children }: ToolPageLayoutProps) {
  const chips = ["Processed locally in your browser", "No watermark", "No sign-up"];
  if (tool.offlineCapable) chips.push("Works offline");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link href="/" className="hover:underline">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li>{tool.categoryLabel}</li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-slate-700 dark:text-slate-200">{tool.name}</li>
        </ol>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {tool.name}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
          {tool.shortDescription}
        </p>
        <div className="mt-3">
          <PrivacyChips chips={chips} />
        </div>
        {tool.remoteDisclosure ? (
          <p role="note" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            {tool.remoteDisclosure}
          </p>
        ) : null}
      </header>

      <main id="workspace">{children}</main>

      <section aria-labelledby="how-it-works" className="mt-12">
        <h2 id="how-it-works" className="text-lg font-bold text-slate-900 dark:text-white">How it works</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {tool.howItWorks.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="privacy-note" className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 id="privacy-note" className="text-lg font-bold text-slate-900 dark:text-white">Your privacy</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          This tool runs entirely inside your browser using JavaScript and Web Workers. Your document
          is never uploaded to any server — you can even disconnect from the internet and keep
          working once the page has loaded.
        </p>
      </section>

      <section aria-labelledby="faq" className="mt-10">
        <h2 id="faq" className="text-lg font-bold text-slate-900 dark:text-white">Frequently asked questions</h2>
        <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-700">
          {tool.faq.map((item) => (
            <details key={item.question} className="group py-3">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800 marker:hidden hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-400">
                <span className="mr-2 inline-block transition-transform group-open:rotate-90">▸</span>
                {item.question}
              </summary>
              <p className="mt-2 pl-5 text-sm text-slate-600 dark:text-slate-300">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related-tools" className="mt-10">
          <h2 id="related-tools" className="text-lg font-bold text-slate-900 dark:text-white">Related tools</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((rel) => (
              <li key={rel.slug}>
                <Link
                  href={`/${rel.slug}`}
                  className="block h-full rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-400 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500"
                >
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{rel.name}</span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{rel.shortDescription}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
