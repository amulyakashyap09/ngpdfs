export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function cssToPdfPoint(
  cssX: number,
  cssY: number,
  pageHeightPt: number,
  scale: number
): Point {
  return { x: cssX / scale, y: pageHeightPt - cssY / scale };
}

export function pdfToCssRect(rect: Rect, pageHeightPt: number, scale: number): Rect {
  return {
    x: rect.x * scale,
    y: (pageHeightPt - rect.y - rect.height) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

export function normalizeDragRect(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

export function intersectRect(a: Rect, b: Rect): Rect {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function clampRectInside(rect: Rect, bounds: Rect): Rect {
  const width = Math.min(rect.width, bounds.width);
  const height = Math.min(rect.height, bounds.height);
  return {
    width,
    height,
    x: clamp(rect.x, bounds.x, bounds.x + bounds.width - width),
    y: clamp(rect.y, bounds.y, bounds.y + bounds.height - height),
  };
}

export function fitScale(
  contentWidth: number,
  contentHeight: number,
  targetWidth: number,
  targetHeight: number,
  mode: "center" | "fit" | "fill",
  marginPt = 0
): { scale: number; drawWidth: number; drawHeight: number } {
  const availW = Math.max(1, targetWidth - marginPt * 2);
  const availH = Math.max(1, targetHeight - marginPt * 2);
  if (mode === "fill") {
    const scale = Math.max(availW / contentWidth, availH / contentHeight);
    return { scale, drawWidth: contentWidth * scale, drawHeight: contentHeight * scale };
  }
  const scale =
    mode === "center"
      ? Math.min(1, Math.min(availW / contentWidth, availH / contentHeight))
      : Math.min(availW / contentWidth, availH / contentHeight);
  return { scale, drawWidth: contentWidth * scale, drawHeight: contentHeight * scale };
}

export const PAGE_SIZE_PRESETS_PT: Record<string, [number, number]> = {
  a3: [841.89, 1190.55],
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
};

const MM_TO_PT = 72 / 25.4;
const IN_TO_PT = 72;

export function customSizeToPt(
  width: number,
  height: number,
  unit: "mm" | "in" | "pt"
): { width: number; height: number } {
  switch (unit) {
    case "mm":
      return { width: width * MM_TO_PT, height: height * MM_TO_PT };
    case "in":
      return { width: width * IN_TO_PT, height: height * IN_TO_PT };
    case "pt":
    default:
      return { width, height };
  }
}

export function resolveTargetSize(options: {
  preset: keyof typeof PAGE_SIZE_PRESETS_PT | "custom";
  orientation: "portrait" | "landscape";
  custom?: { width: number; height: number; unit: "mm" | "in" | "pt" };
}): { width: number; height: number } {
  let shortSide: number;
  let longSide: number;
  if (options.preset === "custom") {
    const size = options.custom
      ? customSizeToPt(options.custom.width, options.custom.height, options.custom.unit)
      : { width: 595.28, height: 841.89 };
    shortSide = Math.min(size.width, size.height);
    longSide = Math.max(size.width, size.height);
  } else {
    const preset = PAGE_SIZE_PRESETS_PT[options.preset] ?? PAGE_SIZE_PRESETS_PT.a4!;
    shortSide = preset[0];
    longSide = preset[1];
  }
  return options.orientation === "landscape"
    ? { width: longSide, height: shortSide }
    : { width: shortSide, height: longSide };
}
