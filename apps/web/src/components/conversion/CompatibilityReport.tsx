"use client";

import type { CompatibilityReport as Report } from "@paperzero/pdf-conversion";

export function CompatibilityReport({ report }: { report: Report }) {
  const sections = [
    { label: "Preserved", values: report.preserved, tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "Approximated", values: report.approximated, tone: "text-amber-700 dark:text-amber-300" },
    { label: "Omitted", values: report.omitted, tone: "text-red-700 dark:text-red-300" },
  ].filter((section) => section.values.length > 0);
  return (
    <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Compatibility report">
      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Compatibility report</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">NGPDFs reports what this browser-local renderer can reproduce; it does not claim pixel-perfect source pagination.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {sections.map((section) => (
          <div key={section.label}>
            <h3 className={`text-xs font-bold ${section.tone}`}>{section.label}</h3>
            <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-300">
              {section.values.map((value) => <li key={value}>{value}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
