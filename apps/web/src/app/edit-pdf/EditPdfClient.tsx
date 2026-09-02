"use client";

import { useMemo, useState } from "react";
import {
  Button,
  DownloadResult,
  ErrorAlert,
  FileDropzone,
  PdfEditor,
  ProcessingProgress,
  useFileDocuments,
  useOperation,
  type EditorOcrHit,
} from "@paperzero/pdf-ui";
import type { EditorObject, EditorImageSource } from "@paperzero/pdf-editor";
import { runEditorExport } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";
import { BrowserOcrSession, shouldOcrPage } from "@paperzero/pdf-ocr";
import { loadPdfDocument, renderPageToCanvas } from "@paperzero/pdf-core";
import { detectCapabilities, disposeCanvas, PaperZeroError } from "@paperzero/shared";

export function EditPdfClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<{ name: string; blob: Blob }[]>();
  const ocrOp = useOperation<Record<number, EditorOcrHit[]>>();
  const [ocrHits, setOcrHits] = useState<Record<number, EditorOcrHit[]>>({});
  const capabilities = useMemo(() => detectCapabilities(), []);
  const file = docs.readyEntries[0]?.file;

  const handleExport = (objects: EditorObject[], images: EditorImageSource[]) => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      const outcome = await runEditorExport(getWorkerRunner(), file, objects, images, { signal, onProgress });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  const handleEditorOcr = () => {
    if (!file) return;
    void ocrOp.start(async (signal, onProgress) => {
      const pdf = await loadPdfDocument(file);
      const session = new BrowserOcrSession("eng", onProgress);
      const cancel = () => void session.terminate();
      signal.addEventListener("abort", cancel, { once: true });
      const found: Record<number, EditorOcrHit[]> = {};
      const warnings: string[] = [];
      try {
        await session.initialize();
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (signal.aborted) throw PaperZeroError.cancelled();
          const page = await pdf.getPage(pageNumber);
          const existingText = (await page.getTextContent()).items
            .map((item) => ("str" in item ? item.str : ""))
            .join("")
            .trim();
          if (!shouldOcrPage(existingText)) {
            page.cleanup();
            continue;
          }
          onProgress({ phase: "editor-ocr", completed: pageNumber - 1, total: pdf.numPages, message: `Finding editable text on page ${pageNumber}` });
          const base = page.getViewport({ scale: 1 });
          const rendered = await renderPageToCanvas(pdf, pageNumber, {
            scale: 180 / 72,
            maxDimension: capabilities.maxCanvasDimension,
            maxPixels: capabilities.maxCanvasPixels,
          });
          const viewport = page.getViewport({ scale: rendered.widthPx / base.width });
          try {
            const recognized = await session.recognize(rendered.canvas, { width: rendered.widthPx, height: rendered.heightPx }, { deskew: true });
            found[pageNumber] = recognized.words.map((word) => {
              const lower = viewport.convertToPdfPoint(word.bbox.x0, word.bbox.y1);
              const upper = viewport.convertToPdfPoint(word.bbox.x1, word.bbox.y0);
              const height = Math.abs(upper[1] - lower[1]);
              return {
                x: Math.min(lower[0], upper[0]),
                y: Math.min(lower[1], upper[1]),
                width: Math.abs(upper[0] - lower[0]),
                height,
                baseline: Math.min(lower[1], upper[1]) + height * 0.2,
                text: word.text,
                size: Math.max(4, height * 0.8),
                confidence: word.confidence,
              };
            });
            if (recognized.confidence < 65) warnings.push(`Page ${pageNumber} OCR confidence was low; verify every overlay edit.`);
          } finally {
            disposeCanvas(rendered.canvas);
            page.cleanup();
          }
        }
        setOcrHits(found);
        return { data: found, warnings };
      } finally {
        signal.removeEventListener("abort", cancel);
        await session.terminate();
      }
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
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <strong>Scanned page?</strong> OCR-assisted editing creates selectable word regions.
            Changes use a whiteout plus text overlay; they do not reconstruct original content.
            <div className="mt-2">
              <Button variant="secondary" onClick={handleEditorOcr} disabled={ocrOp.isProcessing}>
                Find scanned text with OCR
              </Button>
            </div>
          </section>
          {ocrOp.isProcessing ? <ProcessingProgress progress={ocrOp.progress} onCancel={ocrOp.cancel} label="Finding scanned text" /> : null}
          {ocrOp.error ? <ErrorAlert error={ocrOp.error} onRetry={() => ocrOp.reset()} /> : null}
          {ocrOp.status === "success" ? <p className="text-xs text-emerald-700 dark:text-emerald-300">OCR regions are ready. Choose Edit text and select a recognized word.</p> : null}
          <PdfEditor file={file} onExport={handleExport} exporting={op.isProcessing} ocrTextHits={ocrHits} />
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
