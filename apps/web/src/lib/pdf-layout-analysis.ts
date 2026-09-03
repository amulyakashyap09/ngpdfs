import { BrowserOcrSession } from "@paperzero/pdf-ocr";
import {
  analyzePdfLayout,
  extractAndAnalyzePdf,
  type AnalyzedPdf,
  type LayoutAnalysisOptions,
  type PositionedTextItem,
  type RawLayoutPage,
} from "@paperzero/pdf-extraction";
import { loadPdfDocument, releasePdfDocument, renderPageToCanvas, type LocalDocumentFile } from "@paperzero/pdf-core";
import { assertNotAborted, detectCapabilities, disposeCanvas, type ProgressUpdate } from "@paperzero/shared";

export interface LocalLayoutOptions extends LayoutAnalysisOptions {
  pages?: number[];
  integrateOcr?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: ProgressUpdate) => void;
}

export async function analyzeLocalPdf(file: LocalDocumentFile, options: LocalLayoutOptions = {}): Promise<AnalyzedPdf> {
  const initial = await extractAndAnalyzePdf(file, {
    pages: options.pages,
    readingOrder: options.readingOrder,
    removeRepeatedHeadersFooters: options.removeRepeatedHeadersFooters,
    tableMinConfidence: options.tableMinConfidence,
    signal: options.signal,
    onProgress: (completed, total, message) => options.onProgress?.({ phase: "layout-analysis", completed, total, message }),
  });
  const scanned = initial.pages.filter((page) => page.scanned);
  if (!scanned.length || !options.integrateOcr) return initial;

  const capabilities = detectCapabilities();
  const pdf = await loadPdfDocument(file);
  const session = new BrowserOcrSession("eng", options.onProgress);
  const recognized = new Map<number, PositionedTextItem[]>();
  const ocrWarnings: string[] = [];
  const abort = () => void session.terminate();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    options.onProgress?.({ phase: "ocr-model", message: "Loading the cached local English OCR model" });
    await session.initialize();
    for (let index = 0; index < scanned.length; index++) {
      assertNotAborted(options.signal);
      const sourcePage = scanned[index]!;
      options.onProgress?.({ phase: "ocr", completed: index, total: scanned.length, message: `Recognizing scanned page ${sourcePage.pageNumber}` });
      const rendered = await renderPageToCanvas(pdf, sourcePage.pageNumber, {
        scale: 220 / 72,
        maxDimension: capabilities.maxCanvasDimension,
        maxPixels: capabilities.maxCanvasPixels,
      });
      try {
        const result = await session.recognize(rendered.canvas, { width: rendered.widthPx, height: rendered.heightPx }, { deskew: true });
        const scaleX = sourcePage.width / rendered.widthPx;
        const scaleY = sourcePage.height / rendered.heightPx;
        recognized.set(sourcePage.pageNumber, result.words.map((word, wordIndex) => ({
          id: `p${sourcePage.pageNumber}-ocr${wordIndex}`,
          pageNumber: sourcePage.pageNumber,
          text: word.text,
          x: word.bbox.x0 * scaleX,
          y: word.bbox.y0 * scaleY,
          width: Math.max(1, (word.bbox.x1 - word.bbox.x0) * scaleX),
          height: Math.max(1, (word.bbox.y1 - word.bbox.y0) * scaleY),
          fontName: "OCR-fallback",
          fontFamily: "sans-serif",
          fontSize: Math.max(6, (word.bbox.y1 - word.bbox.y0) * scaleY),
          rotation: 0,
          bold: false,
          italic: false,
          direction: "ltr",
        })));
        if (result.confidence < 65) ocrWarnings.push(`Page ${sourcePage.pageNumber} OCR confidence was ${Math.round(result.confidence)}%; verify all reconstructed text carefully.`);
      } finally {
        disposeCanvas(rendered.canvas);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    options.signal?.removeEventListener("abort", abort);
    await session.terminate();
    releasePdfDocument(file.id);
  }
  const rawPages: RawLayoutPage[] = initial.pages.map((page) => ({
    pageNumber: page.pageNumber,
    width: page.width,
    height: page.height,
    items: recognized.get(page.pageNumber) ?? page.items,
    links: page.links,
  }));
  const analyzed = analyzePdfLayout(rawPages, initial.title, options);
  analyzed.warnings.push(`Local OCR supplied text for ${scanned.length} scanned page${scanned.length === 1 ? "" : "s"}.`, ...ocrWarnings);
  return analyzed;
}
