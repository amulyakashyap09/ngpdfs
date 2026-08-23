import { StandardFonts, degrees, rgb } from "pdf-lib";
import { validateOutputPdf } from "@paperzero/pdf-core";
import { resolvePosition, type NinePosition } from "../positions";
import type { OpProgressContext, NamedBytes } from "../pdf-utils";
import { loadPdfLibDocument, savePdfLibDocument } from "../pdf-utils";

export interface TextWatermarkOptionsPayload {
  text: string;
  fontSize: number;
  opacity: number;
  rotationDeg: number;
  color: [number, number, number];
  position: NinePosition;
  pages: number[];
}

export async function applyTextWatermark(
  bytes: Uint8Array,
  options: TextWatermarkOptionsPayload,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  if (!options.text.trim()) {
    throw new (await import("@paperzero/shared")).PaperZeroError(
      "INVALID_INPUT",
      "Enter watermark text."
    );
  }
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const doc = await loadPdfLibDocument(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageCount = doc.getPageCount();
  const targets = normalizePages(options.pages, pageCount);

  for (let i = 0; i < targets.length; i++) {
    ctx.throwIfCancelled?.();
    const pageNumber = targets[i]!;
    const page = doc.getPage(pageNumber - 1);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(options.text, options.fontSize);
    const point = resolvePosition(options.position, width, height, textWidth, options.fontSize, 0);
    page.drawText(options.text, {
      x: point.x,
      y: point.y,
      size: options.fontSize,
      font,
      color: rgb(clamp01(options.color[0]), clamp01(options.color[1]), clamp01(options.color[2])),
      opacity: clamp01(options.opacity),
      rotate: degrees(normalizeAngle(options.rotationDeg)),
    });
    ctx.progress?.({
      phase: "stamping",
      completed: i + 1,
      total: targets.length,
      message: `Watermarking page ${pageNumber}`,
    });
  }

  const outBytes = await savePdfLibDocument(doc);
  await validateOutputPdf(outBytes, { expectedPageCount: pageCount });
  return { files: [{ name: "watermarked.pdf", bytes: outBytes }], warnings: [] };
}

export interface ImageWatermarkOptionsPayload {
  imageType: "png" | "jpeg";
  scaleFraction: number;
  opacity: number;
  rotationDeg: number;
  position: NinePosition;
  pages: number[];
}

export async function applyImageWatermark(
  bytes: Uint8Array,
  imageBytes: Uint8Array,
  options: ImageWatermarkOptionsPayload,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const doc = await loadPdfLibDocument(bytes);
  const img =
    options.imageType === "png" ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes);
  const pageCount = doc.getPageCount();
  const targets = normalizePages(options.pages, pageCount);

  for (let i = 0; i < targets.length; i++) {
    ctx.throwIfCancelled?.();
    const pageNumber = targets[i]!;
    const page = doc.getPage(pageNumber - 1);
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const targetWidth = Math.max(8, Math.min(pageWidth, pageWidth * options.scaleFraction));
    const targetHeight = targetWidth * (img.height / img.width);
    const point = resolvePosition(options.position, pageWidth, pageHeight, targetWidth, targetHeight, 12);
    page.drawImage(img, {
      x: point.x,
      y: point.y,
      width: targetWidth,
      height: targetHeight,
      opacity: clamp01(options.opacity),
      rotate: degrees(normalizeAngle(options.rotationDeg)),
    });
    ctx.progress?.({
      phase: "stamping",
      completed: i + 1,
      total: targets.length,
      message: `Watermarking page ${pageNumber}`,
    });
  }

  const outBytes = await savePdfLibDocument(doc);
  await validateOutputPdf(outBytes, { expectedPageCount: pageCount });
  return { files: [{ name: "watermarked.pdf", bytes: outBytes }], warnings: [] };
}

function normalizePages(pages: number[], pageCount: number): number[] {
  const valid = [...new Set(pages)].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  return valid.length > 0 ? valid : [];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
