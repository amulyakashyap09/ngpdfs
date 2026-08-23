"use client";

import {
  DownloadResult,
  ErrorAlert,
  FileDropzone,
  PdfEditor,
  ProcessingProgress,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import type { EditorObject, EditorImageSource } from "@paperzero/pdf-editor";
import { runEditorExport } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

export function EditPdfClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<{ name: string; blob: Blob }[]>();
  const file = docs.readyEntries[0]?.file;

  const handleExport = (objects: EditorObject[], images: EditorImageSource[]) => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      const outcome = await runEditorExport(getWorkerRunner(), file, objects, images, { signal, onProgress });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · every edit happens locally"
        disabled={op.isProcessing}
        onFiles={(files) => {
          op.reset();
          void docs.addFiles(files);
        }}
        onError={() => undefined}
      />
      {file ? (
        <div className="flex flex-col gap-4">
          <PdfEditor file={file} onExport={handleExport} exporting={op.isProcessing} />
          {op.isProcessing ? (
            <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Applying edits" />
          ) : null}
        </div>
      ) : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId="edit-pdf"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
          }}
        />
      ) : null}
      {!file && op.status === "idle" ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tip: use “Edit text” to click any sentence and rewrite it; use Whiteout for visual
          corrections only — it is not secure redaction.
        </p>
      ) : null}
    </div>
  );
}
