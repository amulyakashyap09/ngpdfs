"use client";

import { PaperZeroError } from "@paperzero/shared";

export function ErrorAlert({ error, onRetry }: { error: PaperZeroError; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40"
    >
      <div className="flex items-start gap-3">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            {error.code === "CANCELLED" ? "Cancelled" : "Something went wrong"}
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error.userMessage}</p>
          {onRetry && error.code !== "CANCELLED" ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 min-h-[44px] rounded-lg border border-red-400 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function WarningsList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" role="note">
      {warnings.map((warning, i) => (
        <li key={i} className="list-disc pl-4">{warning}</li>
      ))}
    </ul>
  );
}
