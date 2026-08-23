import { PDFDocument, degrees } from "pdf-lib";
import { PaperZeroError } from "@paperzero/shared";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { OpProgressContext, NamedBytes } from "@paperzero/pdf-operations";
import { loadPdfLibDocument, savePdfLibDocument, toExactBytes } from "@paperzero/pdf-operations";
import { clampRectInside, resolveTargetSize, fitScale, type Rect } from "./geometry";

export interface CropRequest {
  pageIndex: number;
  rect: Rect;
  applyToAllPages: boolean;
}

export async function applyCrop(
  bytes: Uint8Array,
  request: CropRequest,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const doc = await loadPdfLibDocument(bytes);
  const pageCount = doc.getPageCount();
  if (request.pageIndex < 0 || request.pageIndex >= pageCount) {
    throw new PaperZeroError("INVALID_INPUT", "That page does not exist in this document.");
  }
  const rect = request.rect;
  if (rect.width < 4 || rect.height < 4) {
    throw new PaperZeroError("INVALID_INPUT", "The crop area is too small. Drag a larger box.");
  }

  const targets = request.applyToAllPages
    ? Array.from({ length: pageCount }, (_, i) => i)
    : [request.pageIndex];

  for (let n = 0; n < targets.length; n++) {
    ctx.throwIfCancelled?.();
    const index = targets[n]!;
    const page = doc.getPage(index);
    const media = page.getMediaBox();
    const currentCrop = page.getCropBox();
    const absolute: Rect = {
      x: (currentCrop.x || media.x) + rect.x,
      y: (currentCrop.y || media.y) + rect.y,
      width: rect.width,
      height: rect.height,
    };
    const bounded = clampRectInside(
      { x: absolute.x - media.x, y: absolute.y - media.y, width: absolute.width, height: absolute.height },
      { x: 0, y: 0, width: media.width, height: media.height }
    );
    page.setCropBox(media.x + bounded.x, media.y + bounded.y, bounded.width, bounded.height);
    ctx.progress?.({
      phase: "cropping",
      completed: n + 1,
      total: targets.length,
      message: `Cropping page ${index + 1}`,
    });
  }

  doc.setProducer("PaperZero");
  const outBytes = await savePdfLibDocument(doc);
  await validateOutputPdf(outBytes, { expectedPageCount: pageCount });
  return {
    files: [{ name: "cropped.pdf", bytes: toExactBytes(outBytes) }],
    warnings: [
      "Cropping changes the visible area (CropBox). Content outside the box can remain in the file structure and may be recoverable with advanced tools.",
    ],
  };
}

export interface ResizeOptionsPayload {
  preset: "a3" | "a4" | "letter" | "legal" | "custom";
  orientation: "portrait" | "landscape";
  custom?: { width: number; height: number; unit: "mm" | "in" | "pt" };
  mode: "center" | "fit" | "fill";
}

export async function applyResize(
  bytes: Uint8Array,
  options: ResizeOptionsPayload,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const src = await loadPdfLibDocument(bytes);
  const out = await PDFDocument.create();
  const target = resolveTargetSize(options);
  const pageCount = src.getPageCount();

  for (let i = 0; i < pageCount; i++) {
    ctx.throwIfCancelled?.();
    const srcPage = src.getPage(i);
    const { width: pw, height: ph } = srcPage.getSize();
    const embedded = await out.embedPage(srcPage);
    const { scale } = fitScale(pw, ph, target.width, target.height, options.mode, 0);
    const drawWidth = pw * scale;
    const drawHeight = ph * scale;
    const page = out.addPage([target.width, target.height]);
    const offsetX =
      options.mode === "fill"
        ? (target.width - drawWidth) / 2
        : Math.max(0, (target.width - drawWidth) / 2);
    const offsetY =
      options.mode === "fill"
        ? (target.height - drawHeight) / 2
        : Math.max(0, (target.height - drawHeight) / 2);
    page.drawPage(embedded, {
      x: offsetX,
      y: offsetY,
      xScale: scale,
      yScale: scale,
      rotate: degrees(0),
    });
    ctx.progress?.({
      phase: "resizing",
      completed: i + 1,
      total: pageCount,
      message: `Resizing page ${i + 1}`,
    });
  }

  out.setProducer("PaperZero");
  const outBytes = await savePdfLibDocument(out);
  await validateOutputPdf(outBytes, { expectedPageCount: pageCount });
  return {
    files: [{ name: "resized.pdf", bytes: toExactBytes(outBytes) }],
    warnings:
      options.mode === "fill"
        ? ["Fill mode crops overflow on pages whose aspect ratio differs from the target size."]
        : [],
  };
}
