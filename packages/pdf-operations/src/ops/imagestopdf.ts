import { PDFDocument } from "pdf-lib";
import { PaperZeroError } from "@paperzero/shared";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { OpProgressContext, NamedBytes } from "../pdf-utils";
import { savePdfLibDocument } from "../pdf-utils";

export type ImagePageSize = "auto" | "a4" | "letter";
export type ImageOrientation = "portrait" | "landscape";
export type ImageFit = "contain" | "cover";

export interface NormalizedImage {
  name: string;
  bytes: Uint8Array;
  type: "jpeg" | "png";
  widthPx: number;
  heightPx: number;
  widthPt?: number;
  heightPt?: number;
}

export interface ImagesToPdfOptionsPayload {
  pageSize: ImagePageSize;
  orientation: ImageOrientation;
  marginPt: number;
  fit: ImageFit;
}

const PAGE_SIZES: Record<Exclude<ImagePageSize, "auto">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

const MAX_PAGE_DIMENSION_PT = 14400;

export async function imagesToPdf(
  images: NormalizedImage[],
  options: ImagesToPdfOptionsPayload,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  if (images.length === 0) {
    throw new PaperZeroError("INVALID_INPUT", "Add at least one image.");
  }
  const doc = await PDFDocument.create();
  const warnings: string[] = [];

  for (let i = 0; i < images.length; i++) {
    ctx.throwIfCancelled?.();
    const image = images[i]!;
    ctx.progress?.({
      phase: "placing",
      completed: i + 1,
      total: images.length,
      message: `Placing ${image.name}`,
    });

    let img: Awaited<ReturnType<PDFDocument["embedJpg"]>>;
    try {
      img = image.type === "png" ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);
    } catch {
      warnings.push(`"${image.name}" could not be decoded and was skipped.`);
      continue;
    }

    const dims = pageDimensionsFor(image.widthPx, image.heightPx, options, {
      widthPt: image.widthPt,
      heightPt: image.heightPt,
    });
    const page = doc.addPage([dims.width, dims.height]);
    const margin = Math.max(0, options.marginPt);
    const contentWidth = Math.max(1, dims.width - margin * 2);
    const contentHeight = Math.max(1, dims.height - margin * 2);

    const naturalWidth = img.width || image.widthPx;
    const naturalHeight = img.height || image.heightPx;
    const scale =
      options.fit === "cover"
        ? Math.max(contentWidth / naturalWidth, contentHeight / naturalHeight)
        : Math.min(contentWidth / naturalWidth, contentHeight / naturalHeight);
    const drawWidth = naturalWidth * scale;
    const drawHeight = naturalHeight * scale;
    const x = (dims.width - drawWidth) / 2;
    const y = (dims.height - drawHeight) / 2;
    page.drawImage(img, { x, y, width: drawWidth, height: drawHeight });
  }

  if (doc.getPageCount() === 0) {
    throw new PaperZeroError("OUTPUT_INVALID", "No images could be embedded into the PDF.");
  }

  doc.setProducer("PaperZero");
  const bytes = await savePdfLibDocument(doc);
  await validateOutputPdf(bytes, { expectedPageCount: doc.getPageCount() });
  return { files: [{ name: "images.pdf", bytes }], warnings };
}

export function pageDimensionsFor(
  widthPx: number,
  heightPx: number,
  options: Pick<ImagesToPdfOptionsPayload, "pageSize" | "orientation">,
  explicitPt?: { widthPt?: number; heightPt?: number }
): { width: number; height: number } {
  if (options.pageSize === "auto") {
    if (explicitPt?.widthPt && explicitPt?.heightPt) {
      return { width: explicitPt.widthPt, height: explicitPt.heightPt };
    }
    let width = widthPx;
    let height = heightPx;
    const largest = Math.max(width, height);
    if (largest > MAX_PAGE_DIMENSION_PT) {
      const factor = MAX_PAGE_DIMENSION_PT / largest;
      width *= factor;
      height *= factor;
    }
    return { width: Math.max(36, width), height: Math.max(36, height) };
  }
  const [shortSide, longSide] = PAGE_SIZES[options.pageSize];
  return options.orientation === "landscape"
    ? { width: longSide, height: shortSide }
    : { width: shortSide, height: longSide };
}
