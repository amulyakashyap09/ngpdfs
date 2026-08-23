"use client";

import { useEffect, useState } from "react";
import {
  Button,
  DownloadResult,
  ErrorAlert,
  FileDropzone,
  ProcessingProgress,
  useFileDocuments,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { readBasicMetadata, runRemoveMetadata } from "@paperzero/pdf-operations";
import type { BasicMetadata } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

const LABELS: Array<[keyof BasicMetadata, string]> = [
  ["title", "Title"],
  ["author", "Author"],
  ["subject", "Subject"],
  ["keywords", "Keywords"],
  ["creator", "Creator application"],
  ["producer", "Producer"],
  ["creationDate", "Created"],
  ["modificationDate", "Last modified"],
];

export function RemoveMetadataClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [metadata, setMetadata] = useState<BasicMetadata | null>(null);

  const file = docs.readyEntries[0]?.file;

  useEffect(() => {
    let cancelled = false;
    setMetadata(null);
    if (!file) return;
    void (async () => {
      try {
        const bytes = await file.asUint8Array();
        const found = await readBasicMetadata(bytes);
        if (!cancelled) setMetadata(found);
      } catch {
        if (!cancelled) setMetadata({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const hasAnyMetadata =
    metadata !== null && Object.values(metadata).some((value) => Boolean(value));

  const handleClean = () => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      const outcome = await runRemoveMetadata(getWorkerRunner(), file, { signal, onProgress });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · inspected and cleaned locally"
        disabled={op.isProcessing}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />

      {metadata ? (
        <section aria-label="Document properties" className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Properties found</h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {LABELS.map(([key, label]) => (
              <div key={key} className="flex gap-2">
                <dt className="w-40 shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="min-w-0 break-words text-slate-800 dark:text-slate-200">
                  {metadata[key] ? <span>{String(metadata[key])}</span> : <em className="text-slate-400">none</em>}
                </dd>
              </div>
            ))}
          </dl>
          {!hasAnyMetadata ? (
            <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">
              No identifying metadata detected — you can still clean the file to zero out timestamps.
            </p>
          ) : null}
        </section>
      ) : null}

      {file ? (
        <Button onClick={handleClean} disabled={op.isProcessing}>
          Remove metadata & download
        </Button>
      ) : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Cleaning" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId="remove-metadata"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
            setMetadata(null);
          }}
        />
      ) : null}
    </div>
  );
}
