"use client";

import { useState } from "react";
import { Button, ErrorAlert, FileDropzone, ProcessingProgress, useOperation } from "@paperzero/pdf-ui";
import { runSha256 } from "@paperzero/pdf-operations";
import { formatBytes } from "@paperzero/shared";
import { getWorkerRunner } from "@/lib/worker-runner";
import { triggerDownload } from "@paperzero/pdf-core";

interface HashResult {
  hex: string;
  size: number;
  name: string;
}

export function FingerprintClient() {
  const op = useOperation<HashResult>();
  const [, setFile] = useState<File | null>(null);
  const [compareValue, setCompareValue] = useState("");

  const handleHash = (selected: File[]) => {
    const f = selected[0];
    if (!f) return;
    setFile(f);
    void op.start(async (signal, onProgress) => {
      onProgress({ phase: "reading", message: "Reading file…" });
      const bytes = new Uint8Array(await f.arrayBuffer());
      onProgress({ phase: "hashing", message: "Computing SHA-256 in worker…" });
      const hex = await runSha256(getWorkerRunner(), bytes, { signal });
      return {
        data: { hex, size: f.size, name: f.name },
        warnings: [],
      };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <strong>Processed locally in your browser.</strong> SHA-256 verifies exact byte identity; it
        does not embed a recipient tracker or modify the file.
      </p>
      <FileDropzone
        accept="*/*"
        label="Choose any file or drop it here"
        hint="Any file type · SHA-256 computed inside a Web Worker"
        disabled={op.isProcessing}
        onFiles={handleHash}
        onError={() => undefined}
      />
      {op.isProcessing ? <ProcessingProgress progress={null} label="Hashing" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <>
          <section aria-label="Fingerprint result" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">SHA-256 fingerprint</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {op.result.name} · {formatBytes(op.result.size)}
            </p>
            <code
              className="mt-3 block break-all rounded-lg bg-slate-100 p-3 font-mono text-xs leading-relaxed text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              aria-live="polite"
            >
              {op.result.hex}
            </code>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(op.result!.hex)}>
                Copy hash
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  triggerDownload({
                    blob: new Blob([`${op.result!.hex}  ${op.result!.name}\n`], { type: "text/plain" }),
                    filename: `${op.result!.name}.sha256.txt`,
                  })
                }
              >
                Save checksum file
              </Button>
              <Button variant="secondary" onClick={() => op.reset()}>
                Hash another file
              </Button>
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <label htmlFor="verify-hash" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Verify against a known hash
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="verify-hash"
                type="text"
                value={compareValue}
                onChange={(e) => setCompareValue(e.target.value)}
                placeholder="Paste expected SHA-256…"
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
              />
              <span
                role="status"
                className={`flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold ${
                  compareValue.trim().toLowerCase() === op.result.hex
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                {compareValue.trim().length === 0
                  ? ""
                  : compareValue.trim().toLowerCase() === op.result.hex
                    ? "✓ Verified"
                    : "✗ Mismatch"}
              </span>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
