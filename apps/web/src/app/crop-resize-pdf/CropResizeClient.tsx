"use client";

import { useState } from "react";
import {
  DownloadResult,
  ErrorAlert,
  FileDropzone,
  ProcessingProgress,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import { getWorkerRunner } from "@/lib/worker-runner";
import { CropWorkspace } from "./CropPanel";
import { ResizePanel } from "./ResizePanel";

type Tab = "crop" | "resize";

import type { ResultFile } from "@paperzero/pdf-ui";

export interface RunTask {
  (
    signal: AbortSignal,
    onProgress: (p: { phase: string; completed?: number; total?: number; message?: string }) => void
  ): Promise<{ data: ResultFile[]; warnings?: string[] }>;
}

export function CropResizeClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<{ name: string; blob: Blob }[]>();
  const [tab, setTab] = useState<Tab>("crop");

  const file = docs.readyEntries[0]?.file;
  const runner = getWorkerRunner();

  const runTask = (task: RunTask) => {
    void op.start(async (signal, onProgress) => {
      const outcome = await task(
        signal,
        onProgress as unknown as (p: { phase: string; completed?: number; total?: number; message?: string }) => void
      );
      return outcome;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · cropping and resizing run locally"
        disabled={op.isProcessing}
        onFiles={(files) => {
          op.reset();
          void docs.addFiles(files);
        }}
        onError={() => undefined}
      />

      {file ? (
        <>
          <div className="flex gap-1" role="tablist" aria-label="Crop or resize">
            {(["crop", "resize"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                type="button"
                onClick={() => setTab(t)}
                className={`min-h-[40px] rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
                  tab === t
                    ? "bg-blue-600 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "crop" ? (
            <CropWorkspace file={file} exporting={op.isProcessing} runner={runner} onRun={runTask} />
          ) : (
            <ResizePanel file={file} exporting={op.isProcessing} runner={runner} onRun={runTask} />
          )}
        </>
      ) : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Processing" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result && op.result.length > 0 ? (
        <DownloadResult
          toolId="crop-resize-pdf"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
          }}
        />
      ) : null}
    </div>
  );
}

