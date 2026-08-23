"use client";

import { useState } from "react";
import {
  Button,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  ProcessingProgress,
  SelectInput,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import type { ResultFile } from "@paperzero/pdf-ui";
import { detectCapabilities, PaperZeroError } from "@paperzero/shared";
import type { ColorTransformMode } from "@paperzero/pdf-core";
import { loadPdfDocument, renderPagesToImages } from "@paperzero/pdf-core";
import { runImagesToPdf } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

const MODES: Array<{ value: ColorTransformMode; label: string; hint: string }> = [
  { value: "invert", label: "Invert", hint: "Photo-negative of every page" },
  { value: "grayscale", label: "Grayscale", hint: "Remove all color" },
  { value: "sepia", label: "Sepia", hint: "Warm vintage tone" },
  { value: "high-contrast", label: "High contrast", hint: "Boosted B/W readability" },
  { value: "dark-reading", label: "Dark reading", hint: "Dark background for night reading" },
];

function paperZeroCancelled(): PaperZeroError {
  return new PaperZeroError("CANCELLED");
}

export function InvertColorsClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [mode, setMode] = useState<ColorTransformMode>("invert");
  const [dpi, setDpi] = useState(150);
  const capabilities = detectCapabilities();

  const file = docs.readyEntries[0]?.file;

  const handleApply = () => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      onProgress({ phase: "analyzing", message: "Measuring pages…" });
      const pdf = await loadPdfDocument(file);
      const pageCount = pdf.numPages;
      const pageSizes: Array<{ w: number; h: number }> = [];
      for (let p = 1; p <= pageCount; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1 });
        pageSizes.push({ w: viewport.width, h: viewport.height });
        page.cleanup();
        if (p % 10 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      if (signal.aborted) throw paperZeroCancelled();

      const effectiveDpi = Math.min(dpi, capabilities.maxRecommendedRenderDPI);
      const warnings: string[] =
        effectiveDpi < dpi
          ? [`DPI was capped at ${effectiveDpi} for this device's memory safety.`]
          : [];

      onProgress({ phase: "rendering", message: "Rendering with color transform…" });
      const { images } = await renderPagesToImages(pdf, Array.from({ length: pageCount }, (_, i) => i + 1), {
        format: "jpg",
        dpi: effectiveDpi,
        quality: 0.9,
        capabilities,
        pixelTransform: mode,
        signal,
        nameForPage: (n) => `page-${String(n).padStart(3, "0")}.jpg`,
        onProgress: (completed, total) =>
          onProgress({ phase: "rendering", completed, total, message: `Page ${completed}/${total}` }),
      });

      const normalized = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i]!;
        normalized.push({
          name: img.name,
          bytes: new Uint8Array(await img.blob.arrayBuffer()),
        type: "jpeg" as const,
        widthPx: img.widthPx,
        heightPx: img.heightPx,
          widthPt: Math.round(pageSizes[i]?.w ?? 595.28),
          heightPt: Math.round(pageSizes[i]?.h ?? 841.89),
        });
      }

      onProgress({ phase: "assembling", message: "Rebuilding PDF…" });
      const outcome = await runImagesToPdf(
        getWorkerRunner(),
        normalized,
        { pageSize: "auto", orientation: "portrait", marginPt: 0, fit: "contain" },
        { signal, onProgress }
      );
      return { data: outcome.files, warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · transformed locally"
        disabled={op.isProcessing}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />

      <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        This tool rasterizes each page at your chosen DPI and rebuilds the PDF. Text will no
        longer be selectable and file size usually increases. Keep the original for archival.
      </p>

      {file ? (
        <>
          <fieldset className="grid gap-3 sm:grid-cols-2" aria-label="Color mode">
            {MODES.map((m) => (
              <label
                key={m.value}
                className={`flex min-h-[64px] cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                  mode === m.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                    : "border-slate-200 hover:border-blue-300 dark:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="color-mode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                  className="mt-1 accent-blue-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{m.label}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{m.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <Field label="Render DPI (quality vs. size)" htmlFor="inv-dpi">
            <SelectInput id="inv-dpi" value={String(dpi)} onChange={(e) => setDpi(Number(e.target.value))}>
              {[96, 150, 220, 300].map((value) => (
                <option key={value} value={value} disabled={value > capabilities.maxRecommendedRenderDPI}>
                  {value} DPI{value > capabilities.maxRecommendedRenderDPI ? " (not advised here)" : ""}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Button onClick={handleApply} disabled={op.isProcessing}>
            Apply & download
          </Button>
        </>
      ) : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Transforming colors" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId="invert-colors"
          files={op.result}
          warnings={[...op.warnings, "Output pages are rasterized; selectable text is not preserved."]}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
          }}
        />
      ) : null}
    </div>
  );
}
