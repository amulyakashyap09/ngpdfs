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
  SelectInput,
  TextInput,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import { runImagesToPdf, runTextPages } from "@paperzero/pdf-operations";
import { normalizeImageForPdf } from "@/lib/image-normalize";
import type { NamedBytes } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";
import {
  BrowserOcrSession,
  OCR_LANGUAGES,
  runSearchablePdfAssembly,
  shouldOcrPage,
  type OcrLanguage,
  type OcrPageResult,
} from "@paperzero/pdf-ocr";
import {
  createDocumentFile,
  loadPdfDocument,
  releasePdfDocument,
  renderPageToCanvas,
} from "@paperzero/pdf-core";
import { detectCapabilities, disposeCanvas, PaperZeroError, type ProgressUpdate } from "@paperzero/shared";

export function HandwritingToPdfClient() {
  const pdfDocs = useFileDocuments("pdf");
  const imageDocs = useFileDocuments("image");
  const op = useOperation<{ name: string; blob: Blob }[]>();
  const [transcription, setTranscription] = useState("");
  const [includeTranscription, setIncludeTranscription] = useState(false);
  const [recognizeHandwriting, setRecognizeHandwriting] = useState(false);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>("eng");
  const capabilities = useMemo(() => detectCapabilities(), []);

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
      let files = outcome.files;
      const warnings = [...outcome.warnings];
      if (recognizeHandwriting) {
        const combined = files[0];
        if (!combined) throw new PaperZeroError("OUTPUT_INVALID", "The handwriting PDF could not be assembled.");
        const recognized = await recognizeHandwritingPdf(
          combined,
          ocrLanguage,
          capabilities.maxCanvasDimension,
          capabilities.maxCanvasPixels,
          signal,
          onProgress
        );
        files = recognized.files;
        warnings.push(...recognized.warnings);
      }
      return {
        data: files,
        warnings: [
          ...warnings,
          ...(recognizeHandwriting
            ? ["Handwriting OCR is Beta: Tesseract is optimized for print, so compare low-confidence text with the preserved original pages."]
            : []),
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
        <strong>Beta:</strong> this tool always preserves your original handwritten pages. Optional
        local recognition uses a print-oriented OCR model, so its text must be reviewed rather than
        treated as an authoritative transcription.
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

      <section aria-label="Handwriting recognition" className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <Checkbox
          label="Beta: recognize handwriting and add a searchable text layer"
          checked={recognizeHandwriting}
          onChange={setRecognizeHandwriting}
        />
        {recognizeHandwriting ? (
          <Field label="Recognition language" htmlFor="handwriting-ocr-language">
            <SelectInput id="handwriting-ocr-language" value={ocrLanguage} onChange={(event) => setOcrLanguage(event.target.value as OcrLanguage)}>
              {OCR_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
            </SelectInput>
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

async function recognizeHandwritingPdf(
  input: { name: string; blob: Blob },
  language: OcrLanguage,
  maxDimension: number,
  maxPixels: number,
  signal: AbortSignal,
  onProgress: (progress: ProgressUpdate) => void
): Promise<{ files: Array<{ name: string; blob: Blob }>; warnings: string[] }> {
  const local = createDocumentFile(input.blob, { name: input.name, type: "application/pdf" });
  const session = new BrowserOcrSession(language, onProgress);
  const cancel = () => void session.terminate();
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const pdf = await loadPdfDocument(local);
    await session.initialize();
    const results: OcrPageResult[] = [];
    const warnings: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (signal.aborted) throw PaperZeroError.cancelled();
      const page = await pdf.getPage(pageNumber);
      const existing = (await page.getTextContent()).items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();
      if (!shouldOcrPage(existing)) {
        results.push({ pageNumber, status: "existing-text", text: existing, confidence: 100, words: [] });
        page.cleanup();
        continue;
      }
      onProgress({ phase: "handwriting-ocr", completed: pageNumber - 1, total: pdf.numPages, message: `Recognizing handwritten page ${pageNumber}` });
      const base = page.getViewport({ scale: 1 });
      const rendered = await renderPageToCanvas(pdf, pageNumber, {
        scale: 180 / 72,
        maxDimension,
        maxPixels,
      });
      const viewport = page.getViewport({ scale: rendered.widthPx / base.width });
      try {
        const recognized = await session.recognize(rendered.canvas, { width: rendered.widthPx, height: rendered.heightPx }, { deskew: true });
        const result: OcrPageResult = {
          pageNumber,
          status: recognized.text ? "recognized" : "empty",
          text: recognized.text,
          confidence: recognized.confidence,
          words: recognized.words.map((word) => {
            const lower = viewport.convertToPdfPoint(word.bbox.x0, word.bbox.y1);
            const upper = viewport.convertToPdfPoint(word.bbox.x1, word.bbox.y0);
            return {
              text: word.text,
              confidence: word.confidence,
              x: Math.min(lower[0], upper[0]),
              y: Math.min(lower[1], upper[1]),
              width: Math.abs(upper[0] - lower[0]),
              height: Math.abs(upper[1] - lower[1]),
            };
          }),
        };
        if (recognized.confidence < 65) warnings.push(`Page ${pageNumber} handwriting confidence was ${Math.round(recognized.confidence)}%.`);
        results.push(result);
      } finally {
        disposeCanvas(rendered.canvas);
        page.cleanup();
      }
    }
    if (!results.some((result) => result.status === "recognized")) {
      return { files: [input], warnings: [...warnings, "No additional handwriting text was recognized."] };
    }
    const assembled = await runSearchablePdfAssembly(getWorkerRunner(), local, results, { signal, onProgress });
    const text = results.map((result) => `Page ${result.pageNumber}\n${result.text}`).join("\n\n");
    return {
      files: [
        { name: "handwriting-searchable.pdf", blob: assembled.files[0]!.blob },
        { name: "handwriting-ocr.txt", blob: new Blob([text], { type: "text/plain" }) },
      ],
      warnings: [...warnings, ...assembled.warnings],
    };
  } finally {
    signal.removeEventListener("abort", cancel);
    await session.terminate();
    releasePdfDocument(local.id);
    local.dispose();
  }
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
