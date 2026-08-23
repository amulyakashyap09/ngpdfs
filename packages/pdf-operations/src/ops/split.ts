import { PDFDocument } from "pdf-lib";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { PageRangeSegment } from "@paperzero/shared";
import { sanitizeFilename, suggestOutputName } from "@paperzero/shared";
import type { OpProgressContext, NamedBytes } from "../pdf-utils";
import { loadPdfLibDocument, savePdfLibDocument } from "../pdf-utils";

export interface SplitOptionsPayload {
  baseName: string;
  segments: PageRangeSegment[];
}

function segmentName(base: string, seg: PageRangeSegment): string {
  const suffix = seg.start === seg.end ? `page-${seg.start}` : `pages-${seg.start}-${seg.end}`;
  return suggestOutputName({ baseNames: [base], suffix, extension: "pdf" });
}

export async function splitPdfBytes(
  bytes: Uint8Array,
  options: SplitOptionsPayload,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  ctx.throwIfCancelled?.();
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const src = await loadPdfLibDocument(bytes);
  const pageCount = src.getPageCount();

  if (options.segments.length === 0) {
    throw new (await import("@paperzero/shared")).PaperZeroError(
      "INVALID_INPUT",
      "Choose at least one page or range to extract."
    );
  }
  for (const seg of options.segments) {
    if (seg.start < 1 || seg.end > pageCount || seg.start > seg.end) {
      throw new (await import("@paperzero/shared")).PaperZeroError(
        "INVALID_INPUT",
        `Range ${seg.start}-${seg.end} is outside this ${pageCount}-page document.`
      );
    }
  }

  const base = sanitizeFilename(options.baseName.replace(/\.pdf$/i, ""), "document");
  const files: NamedBytes[] = [];
  for (let i = 0; i < options.segments.length; i++) {
    ctx.throwIfCancelled?.();
    const seg = options.segments[i]!;
    ctx.progress?.({
      phase: "extracting",
      completed: i + 1,
      total: options.segments.length,
      message: `Extracting pages ${seg.start}-${seg.end}`,
    });
    const out = await PDFDocument.create();
    const indices: number[] = [];
    for (let p = seg.start; p <= seg.end; p++) indices.push(p - 1);
    const copied = await out.copyPages(src, indices);
    for (const page of copied) out.addPage(page);
    out.setProducer("PaperZero");
    const outBytes = await savePdfLibDocument(out);
    await validateOutputPdf(outBytes, { expectedPageCount: indices.length });
    files.push({ name: segmentName(base, seg), bytes: outBytes });
  }
  return { files, warnings: [] };
}
