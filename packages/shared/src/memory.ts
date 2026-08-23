export interface RenderMemoryEstimate {
  canvasBytes: number;
  totalBytes: number;
  withinBudget: boolean;
}

const SAFETY_MULTIPLIER = 1.6;

export function estimateRenderMemory(
  widthPx: number,
  heightPx: number,
  options?: { extraBuffersBytes?: number; sourceBytes?: number; budgetBytes?: number }
): RenderMemoryEstimate {
  const clampedW = Math.max(0, Math.floor(widthPx));
  const clampedH = Math.max(0, Math.floor(heightPx));
  const canvasBytes = clampedW * clampedH * 4;
  const parserOverhead = (options?.sourceBytes ?? 0) * 2.5;
  const outputBuffer = options?.extraBuffersBytes ?? 0;
  const totalBytes = Math.ceil((canvasBytes + parserOverhead + outputBuffer) * SAFETY_MULTIPLIER);
  const budget = options?.budgetBytes ?? Number.POSITIVE_INFINITY;
  return { canvasBytes, totalBytes, withinBudget: totalBytes <= budget };
}

export function maxScaleForDimension(
  pageWidthPt: number,
  pageHeightPt: number,
  scaleBase: number,
  limits: { maxCanvasDimension: number; maxCanvasPixels: number }
): { scale: number; clamped: boolean } {
  let scale = scaleBase;
  const dimLimit = Math.min(limits.maxCanvasDimension / Math.max(pageWidthPt, pageHeightPt, 1), scaleBase);
  if (dimLimit < scale) scale = dimLimit;
  const areaLimit = Math.sqrt(limits.maxCanvasPixels) / Math.max(Math.sqrt(pageWidthPt * pageHeightPt), 1);
  if (areaLimit < scale) scale = areaLimit;
  return { scale, clamped: scale < scaleBase - 1e-9 };
}

export function disposeCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}
