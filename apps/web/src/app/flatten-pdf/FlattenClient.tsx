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
} from "@paperzero/pdf-ui";
import { inspectFormFields } from "@paperzero/pdf-editor";
import { runFlattenForms } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

export function FlattenClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<{ name: string; blob: Blob }[]>();
  const [fieldCount, setFieldCount] = useState<number | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const file = docs.readyEntries[0]?.file;

  useEffect(() => {
    let cancelled = false;
    setFieldCount(null);
    setHasSignature(false);
    setInspectError(null);
    if (!file) return;
    void (async () => {
      try {
        const bytes = await file.asUint8Array();
        const { fields } = await inspectFormFields(bytes);
        if (cancelled) return;
        setFieldCount(fields.length);
        setHasSignature(fields.some((f) => f.kind === "signature"));
      } catch {
        if (!cancelled) setInspectError("This document's form layer could not be inspected. Flattening will still be attempted.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleFlatten = () => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      const outcome = await runFlattenForms(getWorkerRunner(), file, {}, { signal, onProgress });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · form fields are flattened locally"
        disabled={op.isProcessing}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <h2 className="mb-2 font-bold text-slate-900 dark:text-white">What flattening does here</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Fillable form fields are converted into fixed page content — answers become part of the page and fields stop being editable.</li>
          <li>This tool does not rasterize annotations in this pass and does not remove embedded JavaScript.</li>
          <li>Flattening is not “permanent non-editability” — capable tools can still modify PDFs.</li>
        </ul>
        {hasSignature ? (
          <p role="alert" className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
            A digital signature field was detected in this document. Modifying a signed file invalidates
            its cryptographic signatures.
          </p>
        ) : null}
        {inspectError ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400" role="note">{inspectError}</p>
        ) : null}
      </section>

      {file ? (
        <>
          {fieldCount !== null ? (
            <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
              {fieldCount === 0
                ? "No fillable form fields were found. You can still flatten to normalize the file."
                : `Ready to flatten ${fieldCount} field${fieldCount === 1 ? "" : "s"}.`}
            </p>
          ) : null}
          <Button onClick={handleFlatten} disabled={op.isProcessing}>
            Flatten PDF & download
          </Button>
        </>
      ) : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Flattening" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId="flatten-pdf"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
            setFieldCount(null);
          }}
        />
      ) : null}
    </div>
  );
}
