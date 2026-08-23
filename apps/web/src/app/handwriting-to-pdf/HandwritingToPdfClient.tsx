"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  FileCardList,
  ProcessingProgress,
  TextInput,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import { runImagesToPdf, runTextPages } from "@paperzero/pdf-operations";
import { normalizeImageForPdf } from "@/lib/image-normalize";
import type { NamedBytes } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

export function HandwritingToPdfClient() {
  const pdfDocs = useFileDocuments("pdf");
  const imageDocs = useFileDocuments("image");
  const op = useOperation<{ name: string; blob: Blob }[]>();
  const [transcription, setTranscription] = useState("");
  const [includeTranscription, setIncludeTranscription] = useState(false);

  const hasSources = pdfDocs.readyEntries.length > 0 || imageDocs.readyEntries.length > 0;
  const sourceCount = useMemo(
    () => pdfDocs.readyEntries.length + imageDocs.readyEntries.length,
    [pdfDocs.readyEntries.length, imageDocs.readyEntries.length]
  );

  const handleBuild = () => {
    void op.start(async (signal, onProgress) => {
      const sources: NamedBytes[] = [];
      let step = 0;
      const totalSteps = sourceCount + (includeTranscription && transcription.trim() ? 1 : 0) + 1;

      for (const entry of pdfDocs.readyEntries) {
        step += 1;
        onProgress({ phase: "collecting", completed: step, total: totalSteps, message: `Adding ${entry.name}` });
        sources.push({ name: entry.name, bytes: await entry.file.asUint8Array() });
      }

      if (imageDocs.readyEntries.length > 0) {
        const normalized = [];
        for (const entry of imageDocs.readyEntries) {
          step += 1;
          onProgress({
            phase: "preparing",
            completed: step,
            total: totalSteps,
            message: `Preparing ${entry.name}`,
          });
          normalized.push(await normalizeImageForPdf(new File([entry.file.asBlob()], entry.name)));
        }
        const imagePdf = await runImagesToPdf(
          getWorkerRunner(),
          normalized.map((img) => ({
            name: img.name,
            bytes: img.bytes,
            type: img.type === "png" ? ("png" as const) : ("jpeg" as const),
            widthPx: img.widthPx,
            heightPx: img.heightPx,
          })),
          { pageSize: "auto", orientation: "portrait", marginPt: 0, fit: "contain" },
          { signal, onProgress }
        );
        for (const f of imagePdf.files) {
          sources.push({ name: `${f.name}`, bytes: new Uint8Array(await f.blob.arrayBuffer()) });
        }
      }

      if (includeTranscription && transcription.trim()) {
        step += 1;
        onProgress({ phase: "transcribing", completed: step, total: totalSteps, message: "Composing typed pages" });
        const typed = await runTextPages(
          getWorkerRunner(),
          {
            text: transcription,
            pageSize: [595.28, 841.89],
            fontSize: 12,
            lineHeightFactor: 1.5,
            marginPt: 56,
            title: "Typed transcription",
          },
          { signal, onProgress }
        );
        for (const f of typed.files) {
          sources.push({ name: "typed-transcription.pdf", bytes: new Uint8Array(await f.blob.arrayBuffer()) });
        }
      }

      step += 1;
      onProgress({ phase: "merging", completed: step, total: totalSteps, message: "Combining into one PDF" });
      const outcome = await mergeViaWorker(sources, signal, onProgress as never);
      return {
        data: outcome.files,
        warnings: [
          ...outcome.warnings,
          "Handwriting recognition (OCR) is planned for a later release. Typed transcription pages are added manually by you.",
        ],
      };
    });
  };

  async function mergeViaWorker(sources: NamedBytes[], signal: AbortSignal, onProgress: (p: never) => void) {
    const runner = getWorkerRunner();
    return runMergeShim(runner, sources, signal, onProgress);
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" role="note">
        <strong>Beta:</strong> this tool preserves your handwritten scans/photos as high-quality
        PDF pages and can append a typed transcription you write yourself. Automatic handwriting
        recognition is planned with our OCR engine (Phase 5).
      </p>

      <section aria-label="Scanned or handwritten PDFs">
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">1 · Scanned / existing PDFs</h2>
        <FileDropzone
          accept="application/pdf,.pdf"
          multiple
          label="Add PDF pages"
          hint="Optional"
          disabled={op.isProcessing}
          onFiles={(files) => void pdfDocs.addFiles(files)}
          onError={() => undefined}
        />
        <div className="mt-2">
          <FileCardList entries={pdfDocs.entries} reorderable onRemove={pdfDocs.removeEntry} onMove={pdfDocs.moveEntry} />
        </div>
      </section>

      <section aria-label="Photos of handwritten notes">
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">2 · Photos of notes</h2>
        <FileDropzone
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          label="Add photos"
          hint="JPG · PNG · WebP — one page per photo"
          disabled={op.isProcessing}
          onFiles={(files) => void imageDocs.addFiles(files)}
          onError={() => undefined}
        />
        <div className="mt-2">
          <FileCardList entries={imageDocs.entries} reorderable onRemove={imageDocs.removeEntry} onMove={imageDocs.moveEntry} />
        </div>
      </section>

      <section aria-label="Typed transcription">
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">3 · Optional typed transcription</h2>
        <Checkbox
          label="Append a typed transcription page at the end"
          checked={includeTranscription}
          onChange={setIncludeTranscription}
        />
        {includeTranscription ? (
          <Field label="Transcription text" htmlFor="hw-tr">
            <TextInput
              id="hw-tr"
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              placeholder="Type what your notes say…"
            />
          </Field>
        ) : null}
      </section>

      <Button onClick={handleBuild} disabled={!hasSources || op.isProcessing}>
        Build combined PDF ({sourceCount} source{sourceCount === 1 ? "" : "s"})
      </Button>

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Building" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId="handwriting-to-pdf"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            pdfDocs.clearAll();
            imageDocs.clearAll();
            setTranscription("");
          }}
        />
      ) : null}
    </div>
  );
}

import { runMerge } from "@paperzero/pdf-operations";
import type { LocalDocumentFile } from "@paperzero/pdf-core";

async function runMergeShim(
  runner: Parameters<typeof runMerge>[0],
  sources: Array<{ name: string; bytes: Uint8Array }>,
  signal: AbortSignal,
  onProgress: unknown
) {
  const files = sources.map(
    (s) =>
      ({
        id: s.name,
        meta: { name: s.name, size: s.bytes.byteLength, type: "application/pdf" },
        asUint8Array: async () => s.bytes.slice(),
      }) as unknown as LocalDocumentFile
  );
  return runMerge(runner, files, {
    signal,
    onProgress: onProgress as never,
  });
}
