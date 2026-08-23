export type NinePosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export const NINE_POSITIONS: NinePosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export interface ResolvedPoint {
  x: number;
  y: number;
}

export function resolvePosition(
  position: NinePosition,
  pageWidth: number,
  pageHeight: number,
  itemWidth: number,
  itemHeight: number,
  margin = 0
): ResolvedPoint {
  const x =
    position.endsWith("left")
      ? margin
      : position.endsWith("right")
        ? pageWidth - itemWidth - margin
        : (pageWidth - itemWidth) / 2;
  const yTop = pageHeight - itemHeight - margin;
  const yMiddle = (pageHeight - itemHeight) / 2;
  const yBottom = margin;
  const y = position.startsWith("top") ? yTop : position.startsWith("middle") ? yMiddle : yBottom;
  return { x, y };
}

export function toCssOverlay(
  point: ResolvedPoint,
  pageHeight: number,
  itemHeight: number,
  scale: number
): { left: number; top: number } {
  return { left: point.x * scale, top: (pageHeight - point.y - itemHeight) * scale };
}
