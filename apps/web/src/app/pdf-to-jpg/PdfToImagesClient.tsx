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
  SliderInput,
  TextInput,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import { detectCapabilities, parsePageRanges } from "@paperzero/shared";
import { loadPdfDocument, renderPagesToImages } from "@paperzero/pdf-core";
import { zipBlobs } from "@paperzero/pdf-operations";
import type { ResultFile } from "@paperzero/pdf-ui";

export interface PdfToImagesClientProps {
  toolId: string;
  alwaysZip: boolean;
}

const DPI_OPTIONS = [72, 150, 300, 600];

export function PdfToImagesClient({ toolId, alwaysZip }: PdfToImagesClientProps) {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [format, setFormat] = useState<"jpg" | "png">("jpg");
  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(90);
  const [rangesText, setRangesText] = useState("");
  const capabilities = detectCapabilities();

  const file = docs.readyEntries[0]?.file;

  const handleConvert = () => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      const pdf = await loadPdfDocument(file);
      let pages = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
      const warnings: string[] = [];
      if (rangesText.trim()) {
        pages = parsePageRanges(rangesText, pdf.numPages).pages;
      }
      const effectiveDpi = Math.min(dpi, capabilities.maxRecommendedRenderDPI);
      if (effectiveDpi < dpi) {
        warnings.push(`DPI was capped at ${effectiveDpi} for this device's memory safety.`);
      }
      const result = await renderPagesToImages(pdf, pages, {
        format,
        dpi: effectiveDpi,
        quality: quality / 100,
        capabilities,
        signal,
        nameForPage: (n) => `page-${String(n).padStart(3, "0")}.${format === "jpg" ? "jpg" : "png"}`,
        onProgress: (completed, total) =>
          onProgress({ phase: "rendering", completed, total, message: `Rendering page ${completed}/${total}` }),
      });
      warnings.push(...result.warnings);

      if (alwaysZip || result.images.length > 1) {
        onProgress({ phase: "packaging", message: "Packaging ZIP archive" });
        const zip = await zipBlobs(result.images.map((img) => ({ name: img.name, blob: img.blob })));
        return {
          data: [{ name: `${file.meta.name.replace(/\.pdf$/i, "")}-images.zip`, blob: zip }],
          warnings,
        };
      }
      return {
        data: result.images.map((img) => ({ name: img.name, blob: img.blob })),
        warnings,
      };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint={`One PDF · up to ${capabilities.maxRecommendedRenderDPI} DPI recommended on this device`}
        disabled={op.isProcessing}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />
      {file ? (
        <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Output settings</legend>
          <Field label="Format" htmlFor="img-format">
            <SelectInput id="img-format" value={format} onChange={(e) => setFormat(e.target.value as "jpg" | "png")}>
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
            </SelectInput>
          </Field>
          <Field label="Resolution (DPI)" htmlFor="img-dpi">
            <SelectInput id="img-dpi" value={String(dpi)} onChange={(e) => setDpi(Number(e.target.value))}>
              {DPI_OPTIONS.map((value) => (
                <option key={value} value={value} disabled={value > capabilities.maxRecommendedRenderDPI}>
                  {value} DPI{value > capabilities.maxRecommendedRenderDPI ? " (not advised here)" : ""}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Pages (optional)" htmlFor="img-ranges" hint="Leave empty for all pages. Example: 1-3,7">
            <TextInput id="img-ranges" value={rangesText} onChange={(e) => setRangesText(e.target.value)} placeholder="All pages" />
          </Field>
          {format === "jpg" ? (
            <SliderInput
              label="JPG quality"
              min={40}
              max={100}
              step={5}
              value={quality}
              onChange={setQuality}
              format={(v) => `${v}%`}
            />
          ) : null}
        </fieldset>
      ) : null}
      {file ? (
        <Button onClick={handleConvert} disabled={op.isProcessing}>
          Convert to {format.toUpperCase()}
        </Button>
      ) : null}
      {op.isProcessing ? (
        <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Rendering pages" />
      ) : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId={toolId}
          files={op.result}
          warnings={[...op.warnings]}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
          }}
        />
      ) : null}
    </div>
  );
}
