"use client";

import type { OutputCompatibility } from "@paperzero/pdf-extraction";

export function ExtractionCompatibilityReport({ report }: { report: OutputCompatibility }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Output compatibility report">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Output compatibility</h2>
        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">{report.mode}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PDF structure is reconstructed heuristically; this report states the selected fidelity trade-off.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          ["Preserved", report.preserved, "text-emerald-700 dark:text-emerald-300"],
          ["Approximated", report.approximated, "text-amber-700 dark:text-amber-300"],
          ["Omitted", report.omitted, "text-red-700 dark:text-red-300"],
        ].map(([label, values, tone]) => (
          <div key={label as string}>
            <h3 className={`text-xs font-bold ${tone}`}>{label as string}</h3>
            <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-300">
              {(values as string[]).map((value) => <li key={value}>{value}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
