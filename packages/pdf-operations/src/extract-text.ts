import { PaperZeroError, assertNotAborted } from "@paperzero/shared";
import { loadPdfDocument, getPageTextItems, releasePdfDocument } from "@paperzero/pdf-core";
import type { LocalDocumentFile } from "@paperzero/pdf-core";
import type { ExtractedTextItem } from "./text-lines";
import { groupItemsIntoLines } from "./text-lines";

export interface ExtractedPageText {
  pageNumber: number;
  lines: string[];
}

export interface ExtractTextResult {
  pages: ExtractedPageText[];
  warnings: string[];
}

export async function extractPdfText(
  file: LocalDocumentFile,
  options: {
    pages?: number[];
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<ExtractTextResult> {
  const pdf = await loadPdfDocument(file);
  const warnings: string[] = [];
  try {
    const pageCount = pdf.numPages;
    const selected = [...new Set(options.pages ?? [])]
      .filter((p) => p >= 1 && p <= pageCount)
      .sort((a, b) => a - b);
    const targets = selected.length > 0 ? selected : Array.from({ length: pageCount }, (_, i) => i + 1);
    const pages: ExtractedPageText[] = [];

    for (let i = 0; i < targets.length; i++) {
      assertNotAborted(options.signal);
      const pageNumber = targets[i]!;
      const page = await pdf.getPage(pageNumber);
      const raw = await getPageTextItems(page);
      const items: ExtractedTextItem[] = raw.map((item) => ({
        str: item.str,
        x: item.transform[4] ?? 0,
        y: item.transform[5] ?? 0,
        width: item.width,
        height: Math.abs(item.transform[3] ?? 10),
      }));
      const lines = groupItemsIntoLines(items).map((line) => line.text.trim()).filter((t) => t.length > 0);
      if (lines.length === 0) {
        warnings.push(`Page ${pageNumber} contains no extractable text and may be a scanned image. OCR support is planned.`);
      }
      pages.push({ pageNumber, lines });
      page.cleanup();
      options.onProgress?.(i + 1, targets.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return { pages, warnings };
  } finally {
    releasePdfDocument(file.id);
    void pdf;
  }
}

export async function countPdfPages(file: LocalDocumentFile): Promise<number> {
  const pdf = await loadPdfDocument(file);
  return pdf.numPages;
}

export async function getPdfPageCountOrThrow(file: LocalDocumentFile): Promise<number> {
  const count = await countPdfPages(file);
  if (!count) {
    throw new PaperZeroError("FILE_CORRUPT", "This PDF reports zero pages.");
  }
  return count;
}
