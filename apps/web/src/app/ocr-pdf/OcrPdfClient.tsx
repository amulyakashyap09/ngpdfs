"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  ProcessingProgress,
  SelectInput,
  TextInput,
  useFileDocuments,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import {
  BrowserOcrSession,
  OCR_LANGUAGES,
  preprocessRgba,
  runSearchablePdfAssembly,
  shouldOcrPage,
  type OcrLanguage,
  type OcrPageResult,
  type OcrPreprocessOptions,
} from "@paperzero/pdf-ocr";
import {
  createDocumentFile,
  loadPdfDocument,
  releasePdfDocument,
  renderPageToCanvas,
  triggerDownload,
} from "@paperzero/pdf-core";
import {
  assertNotAborted,
  detectCapabilities,
  disposeCanvas,
  formatBytes,
  PaperZeroError,
  parsePageRanges,
  suggestOutputName,
} from "@paperzero/shared";
import { getWorkerRunner } from "@/lib/worker-runner";

interface OcrUiResult {
  files: ResultFile[];
  pages: OcrPageResult[];
}

const DEFAULT_PREPROCESS: OcrPreprocessOptions = {
  grayscale: true,
  normalizeContrast: true,
  threshold: false,
  denoise: false,
  deskew: true,
};

export function OcrPdfClient() {
  const docs = useFileDocuments("pdf");
  const operation = useOperation<OcrUiResult>();
  const [language, setLanguage] = useState<OcrLanguage>("eng");
  const [dpi, setDpi] = useState(220);
  const [ranges, setRanges] = useState("");
  const [forceOcr, setForceOcr] = useState(false);
  const [preprocess, setPreprocess] = useState(DEFAULT_PREPROCESS);
  const [corrections, setCorrections] = useState<Record<number, string>>({});
  const capabilities = useMemo(() => detectCapabilities(), []);
  const file = docs.readyEntries[0]?.file;
  const languageInfo = OCR_LANGUAGES.find((item) => item.code === language)!;

  const setPreprocessOption = (key: keyof OcrPreprocessOptions, value: boolean) => {
    setPreprocess((current) => ({ ...current, [key]: value }));
  };

  const handleOcr = () => {
    if (!file) return;
    void operation.start(async (signal, onProgress) => {
      const pdf = await loadPdfDocument(file);
      const selectedPages = ranges.trim()
        ? parsePageRanges(ranges, pdf.numPages).pages
        : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
      const pageResults: OcrPageResult[] = [];
      let session: BrowserOcrSession | null = null;
      const cancelSession = () => void session?.terminate();
      signal.addEventListener("abort", cancelSession, { once: true });

      try {
        for (let index = 0; index < selectedPages.length; index++) {
          assertNotAborted(signal);
          const pageNumber = selectedPages[index]!;
          onProgress({
            phase: "inspecting-text",
            completed: index,
            total: selectedPages.length,
            message: `Checking text on page ${pageNumber}`,
          });
          const page = await pdf.getPage(pageNumber);
          const textContent = await page.getTextContent();
          const existingText = textContent.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (!shouldOcrPage(existingText, forceOcr)) {
            pageResults.push({
              pageNumber,
              status: "existing-text",
              text: existingText,
              confidence: 100,
              words: [],
            });
            page.cleanup();
            continue;
          }

          if (!session) {
            onProgress({ phase: "loading-language", message: `Loading ${languageInfo.label} OCR model` });
            session = new BrowserOcrSession(language, onProgress);
            await session.initialize();
          }
          assertNotAborted(signal);
          const base = page.getViewport({ scale: 1 });
          const requestedScale = dpi / 72;
          const rendered = await renderPageToCanvas(pdf, pageNumber, {
            scale: requestedScale,
            maxDimension: capabilities.maxCanvasDimension,
            maxPixels: capabilities.maxCanvasPixels,
          });
          const viewport = page.getViewport({ scale: rendered.widthPx / base.width });
          try {
            const context = rendered.canvas.getContext("2d", { willReadFrequently: true });
            if (!context) throw new PaperZeroError("BROWSER_UNSUPPORTED", "Canvas preprocessing is unavailable.");
            if (preprocess.grayscale || preprocess.normalizeContrast || preprocess.threshold || preprocess.denoise) {
              onProgress({ phase: "preprocessing", message: `Preprocessing page ${pageNumber}` });
              const imageData = context.getImageData(0, 0, rendered.widthPx, rendered.heightPx);
              imageData.data.set(
                preprocessRgba(imageData.data, rendered.widthPx, rendered.heightPx, preprocess)
              );
              context.putImageData(imageData, 0, 0);
            }
            onProgress({
              phase: "recognizing-text",
              completed: index,
              total: selectedPages.length,
              message: `Recognizing page ${pageNumber} of ${selectedPages.length}`,
            });
            const recognized = await session.recognize(
              rendered.canvas,
              { width: rendered.widthPx, height: rendered.heightPx },
              { deskew: preprocess.deskew }
            );
            const words = recognized.words.map((word) => {
              const bottomLeft = viewport.convertToPdfPoint(word.bbox.x0, word.bbox.y1);
              const topRight = viewport.convertToPdfPoint(word.bbox.x1, word.bbox.y0);
              return {
                text: word.text,
                confidence: word.confidence,
                x: Math.min(bottomLeft[0], topRight[0]),
                y: Math.min(bottomLeft[1], topRight[1]),
                width: Math.abs(topRight[0] - bottomLeft[0]),
                height: Math.abs(topRight[1] - bottomLeft[1]),
              };
            });
            pageResults.push({
              pageNumber,
              status: recognized.text ? "recognized" : "empty",
              text: recognized.text,
              confidence: recognized.confidence,
              words,
              warning: recognized.confidence < 65 ? "Low OCR confidence; review this page carefully." : undefined,
            });
          } finally {
            disposeCanvas(rendered.canvas);
            page.cleanup();
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        assertNotAborted(signal);
        const recognizedPages = pageResults.filter((page) => page.status === "recognized");
        const warnings = pageResults.flatMap((page) => page.warning ? [`Page ${page.pageNumber}: ${page.warning}`] : []);
        let pdfFile: ResultFile;
        if (recognizedPages.length > 0) {
          onProgress({ phase: "building-searchable-pdf", message: "Adding the invisible searchable text layer" });
          const assembled = await runSearchablePdfAssembly(getWorkerRunner(), file, pageResults, {
            signal,
            onProgress,
          });
          const output = assembled.files[0];
          if (!output) throw new PaperZeroError("OUTPUT_INVALID", "Searchable PDF assembly produced no file.");
          await validateSearchablePdf(output.blob, pdf.numPages, recognizedPages[0]!.pageNumber);
          pdfFile = {
            name: suggestOutputName({ baseNames: [file.meta.name], suffix: "searchable", extension: "pdf" }),
            blob: output.blob,
          };
          warnings.push(...assembled.warnings);
        } else {
          warnings.push("Selected pages already contain useful text or OCR found no new words; the PDF visual content was not rewritten.");
          pdfFile = {
            name: suggestOutputName({ baseNames: [file.meta.name], suffix: "already-searchable", extension: "pdf" }),
            blob: file.asBlob(),
          };
        }
        const plainText = pageResults.map((page) => `Page ${page.pageNumber}\n${page.text}`).join("\n\n");
        const markdown = pageResults.map((page) => `## Page ${page.pageNumber}\n\n${page.text}`).join("\n\n");
        setCorrections(Object.fromEntries(pageResults.map((page) => [page.pageNumber, page.text])));
        return {
          data: {
            pages: pageResults,
            files: [
              pdfFile,
              { name: "ocr-text.txt", blob: new Blob([plainText], { type: "text/plain" }) },
              { name: "ocr-text.md", blob: new Blob([markdown], { type: "text/markdown" }) },
            ],
          },
          warnings,
        };
      } finally {
        signal.removeEventListener("abort", cancelSession);
        await session?.terminate();
        releasePdfDocument(file.id);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <strong>Local OCR:</strong> PDF pages and recognized text stay in this browser. The selected
        language model downloads from this site once and is cached for later offline use.
      </p>
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a scanned or mixed PDF"
        hint="One PDF · text-rich pages are skipped automatically"
        disabled={operation.isProcessing}
        onFiles={(files) => {
          operation.reset();
          docs.clearAll();
          void docs.addFiles(files.slice(0, 1));
        }}
        onError={() => undefined}
      />
      {file ? (
        <section className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-700" aria-label="OCR settings">
          <Field label="Recognition language" htmlFor="ocr-language" hint={`${formatBytes(languageInfo.modelBytes)} model; cached after first use`}>
            <SelectInput id="ocr-language" value={language} onChange={(event) => setLanguage(event.target.value as OcrLanguage)}>
              {OCR_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </SelectInput>
          </Field>
          <Field label="OCR resolution" htmlFor="ocr-dpi" hint="Higher DPI improves small text but uses more memory">
            <SelectInput id="ocr-dpi" value={String(dpi)} onChange={(event) => setDpi(Number(event.target.value))}>
              <option value="180">180 DPI · mobile</option>
              <option value="220">220 DPI · balanced</option>
              <option value="300">300 DPI · small print</option>
            </SelectInput>
          </Field>
          <Field label="Pages (optional)" htmlFor="ocr-pages" hint="Leave empty for all pages; example: 1-4,7">
            <TextInput id="ocr-pages" value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder="All pages" />
          </Field>
          <div className="flex flex-col gap-2">
            <Checkbox label="Force OCR even when text already exists" checked={forceOcr} onChange={setForceOcr} />
            <Checkbox label="Grayscale OCR image" checked={preprocess.grayscale} onChange={(value) => setPreprocessOption("grayscale", value)} />
            <Checkbox label="Normalize contrast" checked={preprocess.normalizeContrast} onChange={(value) => setPreprocessOption("normalizeContrast", value)} />
            <Checkbox label="Black-and-white threshold" checked={preprocess.threshold} onChange={(value) => setPreprocessOption("threshold", value)} />
            <Checkbox label="Noise reduction (slower)" checked={preprocess.denoise} onChange={(value) => setPreprocessOption("denoise", value)} />
            <Checkbox label="Automatic OCR deskew" checked={preprocess.deskew} onChange={(value) => setPreprocessOption("deskew", value)} />
          </div>
        </section>
      ) : null}
      {file ? <Button onClick={handleOcr} disabled={operation.isProcessing}>Recognize text and build searchable PDF</Button> : null}
      {operation.isProcessing ? <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label="Running OCR" /> : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}
      {operation.status === "success" && operation.result ? (
        <>
          <OcrPageReview
            pages={operation.result.pages}
            corrections={corrections}
            onCorrection={(pageNumber, value) => setCorrections((current) => ({ ...current, [pageNumber]: value }))}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Corrections below are used by the corrected TXT/Markdown downloads. The searchable
            PDF keeps the original OCR word geometry so text remains aligned to the scan.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadCorrections(corrections, "txt")}>Download corrected TXT</Button>
            <Button variant="secondary" onClick={() => downloadCorrections(corrections, "md")}>Download corrected Markdown</Button>
          </div>
          <DownloadResult
            toolId="ocr-pdf"
            files={operation.result.files}
            warnings={operation.warnings}
            onStartOver={() => {
              operation.reset();
              docs.clearAll();
              setCorrections({});
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function OcrPageReview({
  pages,
  corrections,
  onCorrection,
}: {
  pages: OcrPageResult[];
  corrections: Record<number, string>;
  onCorrection: (pageNumber: number, value: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3" aria-label="OCR page review">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Page review</h2>
      {pages.map((page) => (
        <details key={page.pageNumber} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <summary className="cursor-pointer text-sm font-semibold">
            Page {page.pageNumber} · {page.status.replace("-", " ")}
            {page.confidence !== undefined ? ` · ${Math.round(page.confidence)}% confidence` : ""}
          </summary>
          <label className="mt-3 block text-xs font-semibold text-slate-500" htmlFor={`ocr-correction-${page.pageNumber}`}>Review/correct extracted text</label>
          <textarea
            id={`ocr-correction-${page.pageNumber}`}
            value={corrections[page.pageNumber] ?? ""}
            onChange={(event) => onCorrection(page.pageNumber, event.target.value)}
            rows={6}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          />
        </details>
      ))}
    </section>
  );
}

function downloadCorrections(corrections: Record<number, string>, format: "txt" | "md") {
  const pages = Object.entries(corrections).sort(([left], [right]) => Number(left) - Number(right));
  const text = pages.map(([page, value]) => format === "md" ? `## Page ${page}\n\n${value}` : `Page ${page}\n${value}`).join("\n\n");
  triggerDownload({
    blob: new Blob([text], { type: format === "md" ? "text/markdown" : "text/plain" }),
    filename: `ocr-corrected.${format}`,
  });
}

async function validateSearchablePdf(blob: Blob, pageCount: number, samplePage: number): Promise<void> {
  const file = createDocumentFile(blob, { name: "ocr-validation.pdf", type: "application/pdf" });
  try {
    const pdf = await loadPdfDocument(file);
    if (pdf.numPages !== pageCount) throw new PaperZeroError("OUTPUT_INVALID", "OCR output page count changed unexpectedly.");
    const page = await pdf.getPage(samplePage);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join("").trim();
    page.cleanup();
    if (!text) throw new PaperZeroError("OUTPUT_INVALID", "The searchable text layer could not be verified.");
  } finally {
    releasePdfDocument(file.id);
    file.dispose();
  }
}
