import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PaperZeroError } from "@paperzero/shared";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { OpProgressContext, NamedBytes } from "@paperzero/pdf-operations";
import { loadPdfLibDocument, savePdfLibDocument, toExactBytes } from "@paperzero/pdf-operations";
import type { EditorObject, EditorImageSource, RGB } from "./commands";

export interface EditorExportPayload {
  bytes: Uint8Array;
  objects: EditorObject[];
  images: EditorImageSource[];
}

function toRgb(color: RGB) {
  return rgb(
    Math.min(1, Math.max(0, color[0])),
    Math.min(1, Math.max(0, color[1])),
    Math.min(1, Math.max(0, color[2]))
  );
}

export async function applyEditorObjects(
  payload: EditorExportPayload,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  const { bytes, objects, images } = payload;
  if (objects.length === 0 && images.length === 0) {
    throw new PaperZeroError("INVALID_INPUT", "Add at least one edit before exporting.");
  }
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const doc = await loadPdfLibDocument(bytes);
  const pageCount = doc.getPageCount();

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const embeddedImages = new Map<string, Awaited<ReturnType<PDFDocument["embedPng"]>>>();
  for (const source of images) {
    try {
      embeddedImages.set(
        source.ref,
        source.type === "png" ? await doc.embedPng(source.bytes) : await doc.embedJpg(source.bytes)
      );
    } catch {
      throw new PaperZeroError("INVALID_INPUT", "An added image or signature could not be decoded.");
    }
  }

  for (let i = 0; i < pageCount; i++) {
    const pageObjects = objects.filter((o) => o.pageIndex === i);
    if (pageObjects.length === 0) continue;
    const page = doc.getPage(i);
    const { width: pw, height: ph } = page.getSize();
    let done = 0;

    for (const obj of pageObjects) {
      ctx.throwIfCancelled?.();
      switch (obj.kind) {
        case "text": {
          const font = obj.bold ? bold : regular;
          const lines = obj.text.split("\n");
          const lineHeight = obj.size * 1.25;
          let cursorY = obj.y;
          for (const line of lines) {
            page.drawText(line, {
              x: obj.x,
              y: cursorY,
              size: obj.size,
              font,
              color: toRgb(obj.color),
            });
            cursorY -= lineHeight;
          }
          break;
        }
        case "whiteout": {
          page.drawRectangle({
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
            color: toRgb(obj.color),
          });
          break;
        }
        case "image": {
          const img = embeddedImages.get(obj.imageRef);
          if (img) {
            page.drawImage(img, {
              x: obj.x,
              y: obj.y,
              width: obj.width,
              height: obj.height,
              opacity: obj.opacity ?? 1,
            });
          }
          break;
        }
        case "replace-text": {
          page.drawRectangle({
            x: obj.coverX,
            y: obj.coverY,
            width: obj.coverWidth,
            height: obj.coverHeight,
            color: rgb(1, 1, 1),
          });
          const font = regular;
          const fitted = fitReplacementSize(obj.newText, obj.size, obj.coverWidth, font);
          page.drawText(obj.newText, {
            x: obj.coverX + 1,
            y: obj.baselineY,
            size: fitted,
            font,
            color: toRgb(obj.color),
          });
          break;
        }
      }
      done += 1;
      ctx.progress?.({
        phase: "drawing",
        completed: done,
        total: pageObjects.length,
        message: `Page ${i + 1}: edit ${done}/${pageObjects.length}`,
      });
    }
    void pw;
    void ph;
  }

  doc.setProducer("PaperZero");
  const outBytes = await savePdfLibDocument(doc);
  await validateOutputPdf(outBytes, { expectedPageCount: pageCount });
  return {
    files: [{ name: "edited.pdf", bytes: toExactBytes(outBytes) }],
    warnings: [],
  };
}

export function fitReplacementSize(
  text: string,
  requestedSize: number,
  maxWidthPt: number,
  font: { widthOfTextAtSize(text: string, size: number): number }
): number {
  let size = requestedSize;
  for (let guard = 0; guard < 40; guard++) {
    const width = font.widthOfTextAtSize(text, size);
    if (width <= maxWidthPt - 2 || size <= 4) return Math.max(3, size);
    size *= 0.92;
  }
  return Math.max(3, size);
}
