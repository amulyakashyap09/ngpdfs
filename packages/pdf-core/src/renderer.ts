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
