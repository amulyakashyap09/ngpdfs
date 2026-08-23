"use client";

import { useState } from "react";
import { Button, ErrorAlert, FileDropzone, ProcessingProgress, useOperation } from "@paperzero/pdf-ui";
import { formatBytes } from "@paperzero/shared";
import { runSha256 } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

interface DiagResult {
  hex: string;
  size: number;
  name: string;
}

export function HashDiagnosticClient() {
  const op = useOperation<DiagResult>();
  const [selectedName, setSelectedName] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        This developer diagnostic proves the PaperZero worker architecture end-to-end: a file is read locally,
        its bytes are transferred to a Web Worker with zero copies retained on the main thread, and a SHA-256
        digest is computed and returned. No network request carries file data.
      </p>
      <FileDropzone
        accept="*/*"
        label="Choose any file"
        hint="Runs the diagnostic hash operation in a background worker"
        disabled={op.isProcessing}
        onFiles={(files) => {
          const f = files[0];
          if (!f) return;
          setSelectedName(f.name);
          void op.start(async (signal, onProgress) => {
            onProgress({ phase: "reading", message: "Reading file into memory…" });
            const bytes = new Uint8Array(await f.arrayBuffer());
            onProgress({ phase: "hashing", message: "Hashing in worker…" });
            const hex = await runSha256(getWorkerRunner(), bytes, { signal });
            return { data: { hex, size: f.size, name: f.name }, warnings: [] };
          });
        }}
        onError={() => undefined}
      />
      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Running diagnostic" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <section aria-live="polite" className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-700 dark:bg-emerald-950/40">
          <h2 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Diagnostic complete</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <dt className="text-emerald-800 dark:text-emerald-200">File</dt>
            <dd className="break-all font-mono text-emerald-900 dark:text-emerald-100">{selectedName}</dd>
            <dt className="text-emerald-800 dark:text-emerald-200">Size</dt>
            <dd className="font-mono text-emerald-900 dark:text-emerald-100">{formatBytes(op.result.size)}</dd>
            <dt className="text-emerald-800 dark:text-emerald-200">SHA-256</dt>
            <dd className="break-all font-mono text-emerald-900 dark:text-emerald-100">{op.result.hex}</dd>
          </dl>
          <Button variant="secondary" className="mt-4" onClick={() => op.reset()}>
            Run again
          </Button>
        </section>
      ) : null}
    </div>
  );
}
