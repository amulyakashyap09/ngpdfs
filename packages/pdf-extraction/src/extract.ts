import { assertNotAborted, PaperZeroError } from "@paperzero/shared";
import { loadPdfDocument, releasePdfDocument, type LocalDocumentFile } from "@paperzero/pdf-core";
import { analyzePdfLayout } from "./analysis";
import type { AnalyzedPdf, LayoutAnalysisOptions, PositionedLink, PositionedTextItem, RawLayoutPage } from "./types";

export async function extractAndAnalyzePdf(
  file: LocalDocumentFile,
  options: LayoutAnalysisOptions & { pages?: number[]; signal?: AbortSignal; onProgress?: (completed: number, total: number, phase: string) => void } = {}
): Promise<AnalyzedPdf> {
  const pdf = await loadPdfDocument(file);
  try {
    if (pdf.numPages > 500) throw new PaperZeroError("MEMORY_LIMIT", "Layout analysis is limited to 500 PDF pages per job.");
    const selected = [...new Set(options.pages ?? [])].filter((page) => page >= 1 && page <= pdf.numPages).sort((a, b) => a - b);
    const targets = selected.length ? selected : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
    const rawPages: RawLayoutPage[] = [];
    for (let index = 0; index < targets.length; index++) {
      assertNotAborted(options.signal);
      const pageNumber = targets[index]!;
      options.onProgress?.(index, targets.length, `Analyzing text geometry on page ${pageNumber}`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const styles = content.styles as Record<string, { fontFamily?: string }>;
      const items: PositionedTextItem[] = [];
      for (const [itemIndex, raw] of (content.items as unknown as Array<Record<string, unknown>>).entries()) {
        if (typeof raw.str !== "string" || !Array.isArray(raw.transform) || !raw.str.trim()) continue;
        const transform = raw.transform as number[];
        const point = viewport.convertToViewportPoint(Number(transform[4] ?? 0), Number(transform[5] ?? 0));
        const fontSize = Math.max(1, Math.hypot(Number(transform[2] ?? 0), Number(transform[3] ?? 0)) || Number(raw.height ?? 0) || 10);
        const width = Math.abs(Number(raw.width ?? 0));
        const fontName = typeof raw.fontName === "string" ? raw.fontName : "unknown";
        const fontFamily = styles[fontName]?.fontFamily;
        const label = `${fontName} ${fontFamily ?? ""}`;
        const direction = raw.dir === "rtl" ? "rtl" : "ltr";
        items.push({
          id: `p${pageNumber}-i${itemIndex}`,
          pageNumber,
          text: raw.str,
          x: Math.min(viewport.width, Math.max(0, point[0])),
          y: Math.min(viewport.height, Math.max(0, point[1] - fontSize * 0.82)),
          width,
          height: Math.max(fontSize, Math.abs(Number(raw.height ?? 0))),
          fontName,
          fontFamily,
          fontSize,
          rotation: normalizeRotation(Math.atan2(Number(transform[1] ?? 0), Number(transform[0] ?? 1)) * 180 / Math.PI + viewport.rotation),
          bold: /bold|black|heavy|semibold|demi/i.test(label),
          italic: /italic|oblique/i.test(label),
          direction,
        });
      }
      const annotations = await page.getAnnotations({ intent: "display" });
      const links: PositionedLink[] = [];
      for (const annotation of annotations as Array<Record<string, unknown>>) {
        if (annotation.subtype !== "Link" || !Array.isArray(annotation.rect)) continue;
        const url = typeof annotation.url === "string" && /^(?:https?:|mailto:)/i.test(annotation.url) ? annotation.url : undefined;
        if (!url) continue;
        const rect = viewport.convertToViewportRectangle(annotation.rect as number[]);
        links.push({ pageNumber, x: Math.min(rect[0]!, rect[2]!), y: Math.min(rect[1]!, rect[3]!), width: Math.abs(rect[2]! - rect[0]!), height: Math.abs(rect[3]! - rect[1]!), url });
      }
      rawPages.push({ pageNumber, width: viewport.width, height: viewport.height, items, links });
      page.cleanup();
      options.onProgress?.(index + 1, targets.length, `Analyzed page ${pageNumber}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    let title: string | undefined;
    try {
      const metadata = await pdf.getMetadata();
      const info = metadata.info as { Title?: unknown };
      if (typeof info.Title === "string" && info.Title.trim()) title = info.Title.trim();
    } catch { /* metadata is optional */ }
    return analyzePdfLayout(rawPages, title ?? file.meta.name.replace(/\.pdf$/i, ""), options);
  } finally {
    releasePdfDocument(file.id);
  }
}

function normalizeRotation(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return Math.abs(normalized - 360) < 0.5 ? 0 : Math.round(normalized * 10) / 10;
}
