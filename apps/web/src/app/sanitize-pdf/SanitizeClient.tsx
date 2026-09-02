"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  DownloadResult,
  ErrorAlert,
  FileDropzone,
  ProcessingProgress,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import type { ResultFile } from "@paperzero/pdf-ui";
import type { SanitizeOptionsPayload } from "@paperzero/pdf-security";
import { runSanitize } from "@paperzero/pdf-security";
import { getWorkerRunner } from "@/lib/worker-runner";

const OPTIONS: Array<{ key: keyof SanitizeOptionsPayload; label: string; hint: string; default: boolean }> = [
  { key: "clearInfo", label: "Document properties", hint: "Author, title, subject, keywords, creator, dates", default: true },
  { key: "removeXmp", label: "XMP metadata packet", hint: "Rich hidden metadata stream", default: true },
  { key: "removeJavascript", label: "JavaScript & auto-actions", hint: "Scripts that run on open; never executed here", default: true },
  { key: "removeAttachments", label: "Embedded file attachments", hint: "Files carried inside the PDF", default: true },
  { key: "removeAnnotations", label: "Comments & markup annotations", hint: "Reviewer notes, highlights, sticky notes", default: false },
  { key: "flattenForms", label: "Flatten form answers", hint: "Bakes field values into pages (irreversible)", default: false },
];

export function SanitizeClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [state, setState] = useState<SanitizeOptionsPayload>(
    Object.fromEntries(OPTIONS.map((o) => [o.key as string, o.default])) as unknown as SanitizeOptionsPayload
  );

  const file = docs.readyEntries[0]?.file;
  const hasSelection = OPTIONS.some((option) => Boolean(state[option.key]));

  const handleSanitize = () => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      const outcome = await runSanitize(getWorkerRunner(), file, state, { signal, onProgress });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <strong>Processed locally in your browser.</strong>{" "}
        Exactly what you select below is removed — shown before processing. Everything happens on
        this device.
        Sanitizing a signed PDF normally invalidates its existing cryptographic signatures.
      </p>

      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · sanitized locally"
        disabled={op.isProcessing}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />

      {file ? (
        <>
          <fieldset className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Remove</legend>
            {OPTIONS.map((option) => (
              <div key={option.key} className="flex items-start gap-1">
                <Checkbox
                  label={option.label}
                  checked={Boolean(state[option.key])}
                  onChange={(checked) => setState((prev) => ({ ...prev, [option.key]: checked }))}
                />
                <span className="mt-3 text-xs text-slate-400">{option.hint}</span>
              </div>
            ))}
          </fieldset>

          <Button onClick={handleSanitize} disabled={op.isProcessing || !hasSelection}>
            Sanitize PDF & download
          </Button>
          {!hasSelection ? (
            <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
              Select at least one category to remove.
            </p>
          ) : null}
        </>
      ) : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Sanitizing" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result && op.result.length > 0 ? (
        <DownloadResult
          toolId="sanitize-pdf"
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
