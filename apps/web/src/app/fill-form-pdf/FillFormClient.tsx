"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  LivePagePreview,
  ProcessingProgress,
  SelectInput,
  TextInput,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import type { FormFieldInfo, FormValuePayload } from "@paperzero/pdf-editor";
import { inspectFormFields } from "@paperzero/pdf-editor";
import { runFillForm } from "@paperzero/pdf-operations";
import { PaperZeroError } from "@paperzero/shared";
import { getWorkerRunner } from "@/lib/worker-runner";

export function FillFormClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<{ name: string; blob: Blob }[]>();
  const [fields, setFields] = useState<FormFieldInfo[] | null>(null);
  const [values, setValues] = useState<Record<string, FormValuePayload>>({});
  const [flattenAnswers, setFlattenAnswers] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(0);

  const file = docs.readyEntries[0]?.file;

  useEffect(() => {
    let cancelled = false;
    setFields(null);
    setValues({});
    setInspectError(null);
    if (!file) return;
    void (async () => {
      try {
        const bytes = await file.asUint8Array();
        const result = await inspectFormFields(bytes);
        if (cancelled) return;
        setFields(result.fields);
      } catch (error) {
        if (!cancelled) setInspectError(error instanceof Error ? error.message : "Could not inspect this form.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const pagesWithWidgets = useMemo(() => {
    if (!fields) return [];
    const pageSet = new Set<number>();
    for (const field of fields) for (const w of field.widgets) if (w.width > 1) pageSet.add(w.pageIndex);
    return [...pageSet].sort((a, b) => a - b);
  }, [fields]);

  const setValue = (field: FormFieldInfo, value: FormValuePayload) =>
    setValues((prev) => ({ ...prev, [field.name]: value }));

  const handleSave = () => {
    if (!file || !fields) return;
    void op.start(async (signal, onProgress) => {
      const payload = fields
        .filter((f) => values[f.name])
        .map((f) => ({ ...f, ...values[f.name] }));
      if (payload.length === 0) return { data: [], warnings: ["No values were entered."] };
      const outcome = await runFillForm(getWorkerRunner(), file, payload, { flattenAnswers }, { signal, onProgress });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a fillable PDF or drop it here"
        hint="AcroForm text fields, checkboxes, radios and dropdowns · processed locally"
        disabled={op.isProcessing}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />

      {inspectError ? <ErrorAlert error={new PaperZeroError("FILE_CORRUPT", inspectError)} /> : null}

      {fields !== null && fields.length === 0 ? (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          No fillable form fields were found in this document. If it is a scanned form, the fields are part of the image — try OCR when it ships.
        </p>
      ) : null}

      {fields && fields.length > 0 ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <section className="flex-1" aria-label="Form fields">
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300" role="status">
              {fields.length} field{fields.length === 1 ? "" : "s"} found. Enter your answers below —
              the file stays fully local.
            </p>
            <ol className="flex flex-col gap-3">
              {fields.map((field) => (
                <li key={field.name} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <Field label={field.name} htmlFor={`fld-${field.name}`}>
                    {field.kind === "text" ? (
                      <TextInput
                        id={`fld-${field.name}`}
                        value={(values[field.name]?.textValue as string) ?? ""}
                        onChange={(e) => setValue(field, { name: field.name, kind: field.kind, textValue: e.target.value })}
                      />
                    ) : field.kind === "checkbox" ? (
                      <Checkbox
                        label="Checked"
                        checked={values[field.name]?.checked ?? false}
                        onChange={(checked) => setValue(field, { name: field.name, kind: field.kind, checked })}
                      />
                    ) : field.options && field.options.length > 0 ? (
                      <SelectInput
                        id={`fld-${field.name}`}
                        value={values[field.name]?.textValue ?? ""}
                        onChange={(e) => setValue(field, { name: field.name, kind: field.kind, textValue: e.target.value })}
                      >
                        <option value="">—</option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </SelectInput>
                    ) : (
                      <TextInput
                        id={`fld-${field.name}`}
                        value={(values[field.name]?.textValue as string) ?? ""}
                        onChange={(e) => setValue(field, { name: field.name, kind: field.kind, textValue: e.target.value })}
                      />
                    )}
                  </Field>
                </li>
              ))}
            </ol>

            <div className="mt-4 flex flex-col gap-2">
              <Checkbox label="Flatten answers into the page (fields become non-editable)" checked={flattenAnswers} onChange={setFlattenAnswers} />
              <Button onClick={handleSave} disabled={op.isProcessing}>
                Save filled PDF & download
              </Button>
            </div>
          </section>

          {pagesWithWidgets.length > 0 ? (
            <aside className="w-full shrink-0 lg:w-[420px]" aria-label="Field locations">
              <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Page {pagesWithWidgets[Math.min(previewPage, pagesWithWidgets.length - 1)]! + 1} preview
              </h2>
              <LivePagePreview
                file={file!}
                pageNumber={pagesWithWidgets[Math.min(previewPage, pagesWithWidgets.length - 1)]! + 1}
                widthCss={380}
                overlay={({ scale, heightPt }) => (
                  <>
                    {fields
                      .flatMap((f) => f.widgets.map((w) => ({ field: f, w })))
                      .filter(({ w }) => w.pageIndex === pagesWithWidgets[Math.min(previewPage, pagesWithWidgets.length - 1)])
                      .map(({ field, w }, i) => (
                        <button
                          key={`${field.name}-${i}`}
                          type="button"
                          title={field.name}
                          onClick={() => document.getElementById(`fld-${field.name}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                          className="absolute rounded-sm border border-blue-500/70 bg-blue-400/10 hover:bg-blue-400/25"
                          style={{
                            left: w.x * scale,
                            top: (heightPt - w.y - w.height) * scale,
                            width: Math.max(6, w.width * scale),
                            height: Math.max(6, w.height * scale),
                          }}
                        />
                      ))}
                  </>
                )}
              />
              {pagesWithWidgets.length > 1 ? (
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Button variant="secondary" onClick={() => setPreviewPage((p) => Math.max(0, p - 1))} disabled={previewPage === 0}>◀</Button>
                  <Button variant="secondary" onClick={() => setPreviewPage((p) => Math.min(pagesWithWidgets.length - 1, p + 1))} disabled={previewPage >= pagesWithWidgets.length - 1}>▶</Button>
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      ) : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Filling form" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result && op.result.length > 0 ? (
        <DownloadResult
          toolId="fill-form-pdf"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
            setValues({});
          }}
        />
      ) : null}
    </div>
  );
}


