"use client";

import { useMemo, useState } from "react";
import {
  Button,
  DownloadResult,
  ErrorAlert,
  Field,
  FileCardList,
  FileDropzone,
  ProcessingProgress,
  SelectInput,
  useFileDocuments,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { runImagesToPdf, type ImagesToPdfOptionsPayload } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";
import { normalizeImageForPdf } from "@/lib/image-normalize";

const MARGINS: Record<string, number> = { none: 0, small: 24, medium: 48, large: 72 };

export function ImagesToPdfClient() {
  const docs = useFileDocuments("image");
  const op = useOperation<ResultFile[]>();
  const [pageSize, setPageSize] = useState<ImagesToPdfOptionsPayload["pageSize"]>("auto");
  const [orientation, setOrientation] = useState<ImagesToPdfOptionsPayload["orientation"]>("portrait");
  const [margin, setMargin] = useState("small");
  const [fit, setFit] = useState<ImagesToPdfOptionsPayload["fit"]>("contain");

  const options: ImagesToPdfOptionsPayload = useMemo(
    () => ({ pageSize, orientation, marginPt: MARGINS[margin] ?? 0, fit }),
    [pageSize, orientation, margin, fit]
  );

  const handleConvert = () => {
    void op.start(async (signal, onProgress) => {
      const normalized = [];
      const entries = docs.readyEntries;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        onProgress({ phase: "decoding", completed: i + 1, total: entries.length, message: `Decoding ${entry.name}` });
        const blob = entry.file.asBlob();
        normalized.push(await normalizeImageForPdf(new File([blob], entry.name)));
      }
      const outcome = await runImagesToPdf(getWorkerRunner(), normalized, options, { signal, onProgress });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple
        label="Choose images or drop them here"
        hint="JPG · PNG · WebP — one page per image"
        disabled={op.isProcessing}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />
      <FileCardList entries={docs.entries} reorderable onRemove={docs.removeEntry} onMove={docs.moveEntry} />
      {docs.readyEntries.length > 0 ? (
        <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Page layout</legend>
          <Field label="Page size" htmlFor="img-page-size">
            <SelectInput id="img-page-size" value={pageSize} onChange={(e) => setPageSize(e.target.value as typeof pageSize)}>
              <option value="auto">Auto (match image)</option>
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
            </SelectInput>
          </Field>
          <Field label="Orientation" htmlFor="img-orientation" hint="Used when page size is A4 or Letter">
            <SelectInput id="img-orientation" value={orientation} onChange={(e) => setOrientation(e.target.value as typeof orientation)}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </SelectInput>
          </Field>
          <Field label="Margins" htmlFor="img-margin">
            <SelectInput id="img-margin" value={margin} onChange={(e) => setMargin(e.target.value)}>
              <option value="none">None</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </SelectInput>
          </Field>
          <Field label="Fit" htmlFor="img-fit">
            <SelectInput id="img-fit" value={fit} onChange={(e) => setFit(e.target.value as typeof fit)}>
              <option value="contain">Contain (whole image visible)</option>
              <option value="cover">Cover (fill page, may crop)</option>
            </SelectInput>
          </Field>
        </fieldset>
      ) : null}
      {docs.readyEntries.length > 0 ? (
        <Button onClick={handleConvert} disabled={op.isProcessing}>
          Convert {docs.readyEntries.length} image{docs.readyEntries.length === 1 ? "" : "s"} to PDF
        </Button>
      ) : null}
      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Building PDF" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId="images-to-pdf"
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
