import { PDFDocument, StandardFonts, TextRenderingMode } from "@cantoo/pdf-lib";
import { validateOutputPdf } from "@paperzero/pdf-core";
import { PaperZeroError, type ProgressUpdate } from "@paperzero/shared";
import type { SearchablePdfPayload } from "./types";

export type { SearchablePdfPayload } from "./types";

export async function buildSearchablePdf(
  payload: SearchablePdfPayload,
  context: {
    progress?: (progress: ProgressUpdate) => void;
    throwIfCancelled?: () => void;
  } = {}
): Promise<{ files: Array<{ name: string; bytes: Uint8Array }>; warnings: string[] }> {
  const document = await PDFDocument.load(payload.bytes, {
    updateMetadata: false,
    throwOnInvalidObject: false,
  });
  if (document.isEncrypted) throw new PaperZeroError("ENCRYPTED_PDF", "Remove the PDF password before OCR.");
  const font = await document.embedFont(StandardFonts.Helvetica);
  const warnings: string[] = [];
  let embeddedWords = 0;

  for (let index = 0; index < payload.pages.length; index++) {
    context.throwIfCancelled?.();
    const result = payload.pages[index]!;
    if (result.status !== "recognized") continue;
    const page = document.getPage(result.pageNumber - 1);
    if (!page) continue;
    context.progress?.({
      phase: "embedding-text",
      completed: index + 1,
      total: payload.pages.length,
      message: `Embedding searchable text on page ${result.pageNumber}`,
    });
    for (const word of result.words) {
      if (!word.text || word.width <= 0 || word.height <= 0) continue;
      try {
        const heightSize = Math.max(2, word.height * 0.82);
        const widthAtOnePoint = Math.max(0.01, font.widthOfTextAtSize(word.text, 1));
        const size = Math.max(2, Math.min(heightSize, word.width / widthAtOnePoint));
        page.drawText(word.text, {
          x: word.x,
          y: word.y,
          size,
          font,
          renderMode: TextRenderingMode.Invisible,
        });
        embeddedWords += 1;
      } catch {
        warnings.push(`Some characters on page ${result.pageNumber} could not be embedded in the initial Latin font.`);
      }
    }
  }

  if (embeddedWords === 0) {
    throw new PaperZeroError("OUTPUT_INVALID", "OCR found no words to add to a searchable PDF.");
  }
  document.setProducer("PaperZero OCR");
  const bytes = await document.save({ useObjectStreams: true });
  await validateOutputPdf(bytes, { expectedPageCount: document.getPageCount() });
  return {
    files: [{ name: "searchable.pdf", bytes }],
    warnings: [...new Set(warnings)],
  };
}
