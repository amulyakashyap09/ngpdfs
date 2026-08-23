import { readExifOrientation } from "@paperzero/pdf-operations";
import { PaperZeroError } from "@paperzero/shared";

export interface NormalizedImageInput {
  name: string;
  bytes: Uint8Array;
  type: "jpeg" | "png";
  widthPx: number;
  heightPx: number;
}

const MAX_DIMENSION = 4096;

export async function normalizeImageForPdf(file: File): Promise<NormalizedImageInput> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectType(file);
  const bitmap = await loadBitmap(file);
  try {
    const orientation = type === "jpeg" ? readExifOrientation(bytes) : 1;
    const swaps = orientation >= 5 && orientation <= 8;
    let drawW = swaps ? bitmap.height : bitmap.width;
    let drawH = swaps ? bitmap.width : bitmap.height;
    const largest = Math.max(drawW, drawH);
    const scaleFactor = largest > MAX_DIMENSION ? MAX_DIMENSION / largest : 1;
    drawW = Math.round(drawW * scaleFactor);
    drawH = Math.round(drawH * scaleFactor);

    if (orientation === 1 && scaleFactor === 1) {
      return { name: file.name, bytes, type, widthPx: drawW, heightPx: drawH };
    }

    const canvas = document.createElement("canvas");
    canvas.width = drawW;
    canvas.height = drawH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PaperZeroError("BROWSER_UNSUPPORTED", "Canvas is unavailable in this browser.");
    ctx.imageSmoothingQuality = "high";
    applyOrientationTransform(ctx, orientation, drawW / scaleFactor, drawH / scaleFactor);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();

    const mime = type === "png" ? "image/png" : "image/jpeg";
    const quality = type === "png" ? undefined : 0.92;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b && b.size > 0 ? resolve(b) : reject(new Error("encode failed"))),
        mime,
        quality
      )
    );
    canvas.width = 0;
    canvas.height = 0;
    const outBytes = new Uint8Array(await blob.arrayBuffer());
    return {
      name: file.name,
      bytes: outBytes,
      type: type === "png" ? "png" : "jpeg",
      widthPx: drawW,
      heightPx: drawH,
    };
  } finally {
    bitmap.close?.();
  }
}

function detectType(file: File): "jpeg" | "png" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".png") || file.type === "image/png") return "png";
  return "jpeg";
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new PaperZeroError("UNSUPPORTED_FILE", `"${file.name}" could not be decoded as an image.`);
  }
}

function applyOrientationTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  w: number,
  h: number
): void {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, w, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, w, h);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, h);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, h, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, h, w);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, w);
      break;
    default:
      break;
  }
}
