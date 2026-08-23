import { StandardFonts } from "pdf-lib";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { OpProgressContext, NamedBytes } from "../pdf-utils";
import { loadPdfLibDocument, savePdfLibDocument } from "../pdf-utils";

export type PageNumberPosition = "header" | "footer";
export type PageNumberAlign = "left" | "center" | "right";
export type PageNumberFormat = "plain" | "page-n" | "n-of-total";

export interface PageNumbersOptionsPayload {
  position: PageNumberPosition;
  align: PageNumberAlign;
  startNumber: number;
  prefix: string;
  suffix: string;
  format: PageNumberFormat;
  fontSize: number;
  skipFirst: boolean;
  pages: number[];
}

export function formatPageLabel(
  format: PageNumberFormat,
  n: number,
  totalNumbered: number
): string {
  switch (format) {
    case "page-n":
      return `Page ${n}`;
    case "n-of-total":
      return `${n} / ${totalNumbered}`;
    case "plain":
    default:
      return `${n}`;
  }
}

export async function applyPageNumbers(
  bytes: Uint8Array,
  options: PageNumbersOptionsPayload,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const doc = await loadPdfLibDocument(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pageCount = doc.getPageCount();
  const requestedPages =
    options.pages.length > 0 ? options.pages : Array.from({ length: pageCount }, (_, i) => i + 1);
  const targets = [...new Set(requestedPages)]
    .filter((p) => p >= 1 && p <= pageCount && (!options.skipFirst || p > 1))
    .sort((a, b) => a - b);

  if (targets.length === 0) {
    throw new (await import("@paperzero/shared")).PaperZeroError(
      "INVALID_INPUT",
      "No pages match the selected numbering range."
    );
  }

  const margin = 36;
  let n = Math.max(1, Math.floor(options.startNumber));
  for (let i = 0; i < targets.length; i++) {
    ctx.throwIfCancelled?.();
    const pageNumber = targets[i]!;
    const page = doc.getPage(pageNumber - 1);
    const { width, height } = page.getSize();
    const label = `${options.prefix}${formatPageLabel(options.format, n, targets.length)}${options.suffix}`;
    const textWidth = font.widthOfTextAtSize(label, options.fontSize);
    const x =
      options.align === "left"
        ? margin
        : options.align === "right"
          ? width - textWidth - margin
          : (width - textWidth) / 2;
    const y =
      options.position === "header"
        ? height - margin - options.fontSize * 0.2
        : margin;
    page.drawText(label, { x, y, size: options.fontSize, font });
    ctx.progress?.({
      phase: "numbering",
      completed: i + 1,
      total: targets.length,
      message: `Numbering page ${pageNumber}`,
    });
    n += 1;
  }

  const outBytes = await savePdfLibDocument(doc);
  await validateOutputPdf(outBytes, { expectedPageCount: pageCount });
  return { files: [{ name: "numbered.pdf", bytes: outBytes }], warnings: [] };
}
