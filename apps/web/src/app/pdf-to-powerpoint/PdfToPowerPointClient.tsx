"use client";

import { useState } from "react";
import { runPdfExport, type OutputCompatibility } from "@paperzero/pdf-extraction";
import { loadPdfDocument, releasePdfDocument, renderPagesToImages } from "@paperzero/pdf-core";
import { Button, DownloadResult, ErrorAlert, Field, FileDropzone, ProcessingProgress, SelectInput, TextInput, useFileDocuments, useOperation, type ResultFile } from "@paperzero/pdf-ui";
import { detectCapabilities, PaperZeroError, parsePageRanges } from "@paperzero/shared";
import { ExtractionCompatibilityReport } from "@/components/extraction/ExtractionCompatibilityReport";
import { analyzeLocalPdf } from "@/lib/pdf-layout-analysis";
import { getWorkerRunner } from "@/lib/worker-runner";

interface PowerPointResult { files: ResultFile[]; compatibility: OutputCompatibility }

const EXPECTED: OutputCompatibility = {
  format: "pptx", mode: "visual fidelity (flattened)", preserved: ["one slide per selected page", "visual page appearance", "page order", "source aspect ratio"], approximated: ["raster resolution", "mixed-size PDF pages within one slide size"], omitted: ["element-level text editing", "separate vector shapes", "PDF links", "PDF JavaScript"], warnings: [],
};

export function PdfToPowerPointClient() {
  const docs = useFileDocuments("pdf");
  const operation = useOperation<PowerPointResult>();
  const [ranges, setRanges] = useState("");
  const [dpi, setDpi] = useState(144);
  const entry = docs.readyEntries[0];

  const convert = () => {
    if (!entry) return;
    void operation.start(async (signal, onProgress) => {
      let pageCount = entry.pageCount;
      if (!pageCount) {
        const countingDocument = await loadPdfDocument(entry.file);
        pageCount = countingDocument.numPages;
        releasePdfDocument(entry.file.id);
      }
      const pages = ranges.trim() ? parsePageRanges(ranges, pageCount).pages : Array.from({ length: pageCount }, (_, index) => index + 1);
      if (pages.length > 250) throw new PaperZeroError("MEMORY_LIMIT", "Visual PowerPoint export is limited to 250 selected pages per job.");
      const document = await analyzeLocalPdf(entry.file, { pages, readingOrder: "visual", removeRepeatedHeadersFooters: false, integrateOcr: false, signal, onProgress });
      const pdf = await loadPdfDocument(entry.file);
      try {
        const rendered = await renderPagesToImages(pdf, pages, { format: "jpg", dpi, quality: 0.9, capabilities: detectCapabilities(), signal, onProgress: (completed, total) => onProgress({ phase: "rendering", completed, total, message: `Rendering visual slide ${completed}/${total}` }) });
        const rasters = await Promise.all(rendered.images.map(async (image) => ({ pageNumber: image.pageNumber, bytes: new Uint8Array(await image.blob.arrayBuffer()), mimeType: "image/jpeg" as const, widthPx: image.widthPx, heightPx: image.heightPx })));
        const output = await runPdfExport(getWorkerRunner(), { format: "pptx", document, sourceName: entry.name, rasters }, { signal, onProgress });
        return { data: { files: output.files, compatibility: output.compatibility }, warnings: [...rendered.warnings, ...output.warnings] };
      } finally {
        releasePdfDocument(entry.file.id);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><strong>Visual fidelity mode:</strong> every PDF page becomes one high-quality flattened slide image. The resulting deck looks close to the PDF, but text, tables, and shapes are not element-editable.</p>
      <FileDropzone accept="application/pdf,.pdf" label="Choose a presentation-style PDF" hint="One PDF · pages render sequentially and remain local" disabled={operation.isProcessing} onFiles={(files) => { operation.reset(); docs.clearAll(); void docs.addFiles(files.slice(0, 1)); }} onError={() => undefined} />
      {entry ? <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-700"><legend className="px-1 text-sm font-semibold">Visual slide settings</legend><Field label="Pages (optional)" htmlFor="ppt-pages" hint={`Leave empty for all ${entry.pageCount ?? ""} pages`}><TextInput id="ppt-pages" value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder="Example: 1-8" /></Field><Field label="Raster quality" htmlFor="ppt-dpi"><SelectInput id="ppt-dpi" value={String(dpi)} onChange={(event) => setDpi(Number(event.target.value))}><option value="108">108 DPI · compact</option><option value="144">144 DPI · balanced</option><option value="180">180 DPI · high</option></SelectInput></Field></fieldset> : null}
      <ExtractionCompatibilityReport report={operation.result?.compatibility ?? EXPECTED} />
      {entry ? <Button onClick={convert} disabled={operation.isProcessing}>Create visual-fidelity PowerPoint</Button> : null}
      {operation.isProcessing ? <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label="Rendering pages and building PPTX" /> : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}
      {operation.status === "success" && operation.result ? <DownloadResult toolId="pdf-to-powerpoint" files={operation.result.files} warnings={operation.warnings} onStartOver={() => { operation.reset(); docs.clearAll(); }} /> : null}
    </div>
  );
}
