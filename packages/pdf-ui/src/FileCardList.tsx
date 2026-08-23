"use client";

import { formatBytes } from "@paperzero/shared";
import type { DocumentEntry } from "./useFileDocuments";

export interface FileCardListProps {
  entries: DocumentEntry[];
  reorderable?: boolean;
  onRemove: (id: string) => void;
  onMove?: (fromIndex: number, toIndex: number) => void;
}

export function FileCardList({ entries, reorderable = false, onRemove, onMove }: FileCardListProps) {
  if (!reorderable) {
    return (
      <ul className="flex flex-col gap-2" aria-label="Selected files">
        {entries.map((entry) => (
          <FileCard key={entry.id} entry={entry} onRemove={onRemove} />
        ))}
      </ul>
    );
  }
  return (
    <ol className="flex flex-col gap-2" aria-label="Files in merge order">
      {entries.map((entry, index) => (
        <li key={entry.id}>
          <ReorderableCard
            entry={entry}
            index={index}
            count={entries.length}
            onRemove={onRemove}
            onMove={onMove ?? (() => undefined)}
          />
        </li>
      ))}
    </ol>
  );
}

function FileCard({
  entry,
  onRemove,
  orderLabel,
  moveControls,
}: {
  entry: DocumentEntry;
  onRemove: (id: string) => void;
  orderLabel?: string;
  moveControls?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-white p-3 dark:bg-slate-900 ${
        entry.status === "error"
          ? "border-red-300 dark:border-red-800"
          : "border-slate-200 dark:border-slate-700"
      }`}
    >
      {entry.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.thumbUrl}
          alt=""
          aria-hidden="true"
          className="h-14 w-11 rounded border border-slate-200 object-cover dark:border-slate-700"
        />
      ) : (
        <div className="flex h-14 w-11 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xs font-bold text-slate-400 dark:border-slate-700 dark:bg-slate-800">
          {entry.kind === "pdf" ? "PDF" : "IMG"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {orderLabel ? <span className="mr-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">{orderLabel}</span> : null}
          {entry.name}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {formatBytes(entry.size)}
          {entry.pageCount ? ` · ${entry.pageCount} page${entry.pageCount === 1 ? "" : "s"}` : ""}
        </p>
        {entry.status === "validating" ? (
          <p className="text-xs text-blue-600 dark:text-blue-400" role="status">Validating…</p>
        ) : null}
        {entry.status === "error" ? (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">{entry.error}</p>
        ) : null}
      </div>
      {moveControls}
      <button
        type="button"
        onClick={() => onRemove(entry.id)}
        aria-label={`Remove ${entry.name}`}
        className="min-h-[44px] min-w-[44px] rounded-lg px-2 text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:hover:bg-red-950"
      >
        ✕
      </button>
    </div>
  );
}

function ReorderableCard({
  entry,
  index,
  count,
  onRemove,
  onMove,
}: {
  entry: DocumentEntry;
  index: number;
  count: number;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <FileCard
      entry={entry}
      onRemove={onRemove}
      orderLabel={`#${index + 1}`}
      moveControls={
        <div className="flex flex-col" role="group" aria-label={`Reorder ${entry.name}`}>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label={`Move ${entry.name} up`}
            className="min-h-[36px] w-8 rounded px-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
          >
            ▲
          </button>
          <button
            type="button"
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label={`Move ${entry.name} down`}
            className="min-h-[36px] w-8 rounded px-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
          >
            ▼
          </button>
        </div>
      }
    />
  );
}
