"use client";

import type { ProgressUpdate } from "@paperzero/shared";

export interface ProcessingProgressProps {
  progress: ProgressUpdate | null;
  onCancel?: () => void;
  label?: string;
}

export function ProcessingProgress({ progress, onCancel, label = "Processing" }: ProcessingProgressProps) {
  const total = progress?.total;
  const completed = progress?.completed ?? 0;
  const percentage =
    progress?.percentage ??
    (total && total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : undefined);
  const message = progress?.message ?? label;

  return (
    <section
      aria-live="polite"
      aria-busy="true"
      className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            {label}…
          </p>
          <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">{message}</p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-900"
          >
            Cancel
          </button>
        ) : null}
      </div>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-label={`${label} progress`}
      >
        {percentage !== undefined ? (
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500" />
        )}
      </div>
    </section>
  );
}
