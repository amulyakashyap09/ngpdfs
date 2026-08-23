"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  searchTools,
  toolsByCategory,
  type ToolCategory,
  type ToolDefinition,
} from "@/lib/tool-registry";

const CATEGORY_ORDER: ToolCategory[] = [
  "page-management",
  "edit",
  "convert-to-pdf",
  "convert-from-pdf",
  "security",
];

export function ToolCatalog() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchTools(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <div id="tools">
      <div className="mx-auto max-w-xl">
        <label htmlFor="tool-search" className="sr-only">Search tools</label>
        <input
          id="tool-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search: merge, jpg, watermark…"
          className="min-h-[48px] w-full rounded-full border border-slate-300 bg-white px-5 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-2 focus:outline-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </div>

      {searching ? (
        <section aria-label="Search results" className="mt-8">
          <p className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" role="status">
            {results.length} tool{results.length === 1 ? "" : "s"} found
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </ul>
        </section>
      ) : (
        CATEGORY_ORDER.map((category) => (
          <section key={category} aria-labelledby={`cat-${category}`} className="mt-10">
            <h2 id={`cat-${category}`} className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
              {CATEGORY_LABELS[category]}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {toolsByCategory(category).map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolDefinition }) {
  if (tool.status === "coming-soon") {
    return (
      <li
        className="rounded-2xl border border-dashed border-slate-300 p-5 opacity-70 dark:border-slate-700"
        aria-label={`${tool.name} coming soon`}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300">{tool.name}</h3>
          <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {tool.plannedPhase ?? "Soon"}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.shortDescription}</p>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={`/${tool.slug}`}
        className="group block h-full rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
            {tool.name}
          </h3>
          <span aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500">→</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{tool.shortDescription}</p>
      </Link>
    </li>
  );
}
