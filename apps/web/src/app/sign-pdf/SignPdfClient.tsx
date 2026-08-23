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

export function SignPdfClient() {
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
        hint="One PDF · your signature never leaves this device"
        disabled={op.isProcessing}
        onFiles={(files) => {
          op.reset();
          void docs.addFiles(files);
        }}
        onError={() => undefined}
      />
      {file ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <strong>How to sign:</strong> click “Signature…” to draw, type or upload your signature.
            Then click on the page where the top-left of the signature should appear. Switch pages to
            sign multiple pages. Drag to reposition; use the side panel to resize. This places an image
            of your signature — it is not a cryptographic digital signature.
          </div>
          <PdfEditor
            file={file}
            allowedTools={["select", "image"]}
            onExport={handleExport}
            exporting={op.isProcessing}
          />
          {op.isProcessing ? (
            <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Placing signature" />
          ) : null}
        </div>
      ) : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId="sign-pdf"
          files={op.result}
          warnings={[...op.warnings, "Keep a copy of the signed file; the signature image can be removed by later edits."]}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
          }}
        />
      ) : null}
      {!file && op.status === "idle" ? (
        <p className="text-xs text-slate-500 dark:text-slate-400" role="note">
          Need a certified cryptographic signature? That requires a certificate-based tool and is different from adding a visible signature image.
        </p>
      ) : null}
    </div>
  );
}
