import type { PDFDocumentProxy } from "pdfjs-dist";
import { assertNotAborted, PaperZeroError, type DeviceCapabilities } from "@paperzero/shared";
import { maxScaleForDimension } from "@paperzero/shared";
import { disposeCanvas } from "@paperzero/shared";

export interface RenderedPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  widthPx: number;
  heightPx: number;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) resolve(blob);
        else reject(new PaperZeroError("OUTPUT_INVALID", "Image encoding produced an empty file."));
      },
      type,
      quality
    );
  });
}

export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  options: {
    canvas?: HTMLCanvasElement;
    targetWidthCss?: number;
    devicePixelRatioCap?: number;
    scale?: number;
    maxDimension?: number;
    maxPixels?: number;
  } = {}
): Promise<RenderedPage> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  let scale: number;
  if (options.scale !== undefined) {
    scale = options.scale;
  } else {
    const cssWidth = options.targetWidthCss ?? 800;
    const dpr = Math.min(window.devicePixelRatio || 1, options.devicePixelRatioCap ?? 2);
    scale = (cssWidth * dpr) / base.width;
  }
  if (options.maxDimension !== undefined || options.maxPixels !== undefined) {
    const clamped = maxScaleForDimension(base.width, base.height, scale, {
      maxCanvasDimension: options.maxDimension ?? Number.MAX_SAFE_INTEGER,
      maxCanvasPixels: options.maxPixels ?? Number.MAX_SAFE_INTEGER,
    });
    scale = clamped.scale;
  }
  const viewport = page.getViewport({ scale });
  const canvas = options.canvas ?? document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new PaperZeroError("BROWSER_UNSUPPORTED", "Your browser could not create a rendering surface.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context as CanvasRenderingContext2D, viewport }).promise;
  page.cleanup();
  return { pageNumber, canvas, widthPx: canvas.width, heightPx: canvas.height };
}

export type ColorTransformMode = "invert" | "grayscale" | "sepia" | "high-contrast" | "dark-reading";

export function transformPixelColors(data: Uint8ClampedArray, mode: ColorTransformMode): void {
  const n = data.length;
  if (mode === "invert" || mode === "dark-reading") {
    for (let i = 0; i < n; i += 4) {
      data[i] = 255 - data[i]!;
      data[i + 1] = 255 - data[i + 1]!;
      data[i + 2] = 255 - data[i + 2]!;
      if (mode === "dark-reading") {
        const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
        data[i] = Math.min(255, r * 0.9 + 10);
        data[i + 1] = Math.min(255, g * 0.95 + 6);
        data[i + 2] = Math.min(255, b + 18);
      }
    }
    return;
  }
  if (mode === "grayscale") {
    for (let i = 0; i < n; i += 4) {
      const luma = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
      data[i] = luma;
      data[i + 1] = luma;
      data[i + 2] = luma;
    }
    return;
  }
  if (mode === "sepia") {
    for (let i = 0; i < n; i += 4) {
      const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
      data[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
      data[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
      data[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
    }
    return;
  }
  for (let i = 0; i < n; i += 4) {
    const luma = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    const stretched = clamp255((luma - 128) * 1.5 + 135);
    data[i] = stretched;
    data[i + 1] = stretched;
    data[i + 2] = stretched;
  }
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export interface PageImageResult {
  pageNumber: number;
  name: string;
  blob: Blob;
  widthPx: number;
  heightPx: number;
  dpiReduced?: boolean;
}

export async function renderPagesToImages(
  pdf: PDFDocumentProxy,
  pages: number[],
  options: {
    format: "jpg" | "png";
    dpi: number;
    quality?: number;
    capabilities: DeviceCapabilities;
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
    nameForPage?: (pageNumber: number) => string;
    pixelTransform?: ColorTransformMode;
  }
): Promise<{ images: PageImageResult[]; warnings: string[] }> {
  const { format, dpi, quality, capabilities, signal, onProgress } = options;
  const warnings: string[] = [];
  const images: PageImageResult[] = [];
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  for (let i = 0; i < pages.length; i++) {
    assertNotAborted(signal);
    const pageNumber = pages[i]!;
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const requested = dpi / 72;
    const { scale, clamped } = maxScaleForDimension(base.width, base.height, requested, {
      maxCanvasDimension: capabilities.maxCanvasDimension,
      maxCanvasPixels: capabilities.maxCanvasPixels,
    });
    if (clamped && !warnings.some((w) => w.includes("DPI"))) {
      warnings.push(
        `Requested DPI was reduced to protect this device's memory. The output uses the highest safe resolution.`
      );
    }
    const rendered = await renderPageToCanvas(pdf, pageNumber, {
      scale,
      maxDimension: capabilities.maxCanvasDimension,
      maxPixels: capabilities.maxCanvasPixels,
    });
    try {
      if (options.pixelTransform) {
        const context = rendered.canvas.getContext("2d");
        if (context) {
          const imageData = context.getImageData(0, 0, rendered.canvas.width, rendered.canvas.height);
          transformPixelColors(imageData.data, options.pixelTransform);
          context.putImageData(imageData, 0, 0);
        }
      }
      const blob = await canvasToBlob(rendered.canvas, mime, format === "jpg" ? quality ?? 0.9 : undefined);
      const name =
        options.nameForPage?.(pageNumber) ??
        `page-${String(pageNumber).padStart(3, "0")}.${format === "jpg" ? "jpg" : "png"}`;
      images.push({
        pageNumber,
        name,
        blob,
        widthPx: rendered.widthPx,
        heightPx: rendered.heightPx,
        dpiReduced: clamped,
      });
    } finally {
      disposeCanvas(rendered.canvas);
      page.cleanup();
    }
    onProgress?.(i + 1, pages.length);
    await yieldToBrowser();
  }
  return { images, warnings };
}

export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
