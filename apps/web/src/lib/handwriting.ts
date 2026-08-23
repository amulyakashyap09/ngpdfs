import { PaperZeroError } from "@paperzero/shared";
import type { ColorTransformMode } from "@paperzero/pdf-core";

export const PAPER_STYLES = ["blank", "ruled", "grid", "margin"] as const;
export type PaperStyle = (typeof PAPER_STYLES)[number];

export const HANDWRITING_FONTS = [
  { label: "Script", stack: "'Segoe Script', 'Brush Script MT', cursive" },
  { label: "Handwriting", stack: "'Bradley Hand', 'Comic Sans MS', cursive" },
  { label: "Print", stack: "'Trebuchet MS', Verdana, sans-serif" },
];

export interface HandwritingStyle {
  paperStyle: PaperStyle;
  inkColor: string;
  fontIdx: number;
  fontSizePx: number;
  lineHeightPx: number;
  topMarginPx: number;
  sideMarginPx: number;
}

export function layoutHandwritingLines(
  text: string,
  measure: (line: string) => number,
  maxWidthPx: number
): string[] {
  if (text.trim().length === 0) return [];
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n/g, "\n").split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (measure(candidate) > maxWidthPx && current.length > 0) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

export function drawPaperBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: HandwritingStyle
): void {
  ctx.fillStyle = "#fdfdfa";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#d7dbe2";
  ctx.lineWidth = 1;

  if (style.paperStyle === "ruled") {
    for (let y = style.topMarginPx; y < height - 8; y += style.lineHeightPx) {
      ctx.beginPath();
      ctx.moveTo(style.sideMarginPx, y + 0.5);
      ctx.lineTo(width - style.sideMarginPx, y + 0.5);
      ctx.stroke();
    }
  } else if (style.paperStyle === "grid") {
    const step = Math.max(16, Math.round(style.lineHeightPx));
    for (let x = style.sideMarginPx; x < width - style.sideMarginPx; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, style.topMarginPx - step);
      ctx.lineTo(x + 0.5, height - 8);
      ctx.stroke();
    }
    for (let y = style.topMarginPx; y < height - 8; y += step) {
      ctx.beginPath();
      ctx.moveTo(style.sideMarginPx, y + 0.5);
      ctx.lineTo(width - style.sideMarginPx, y + 0.5);
      ctx.stroke();
    }
  } else if (style.paperStyle === "margin") {
    ctx.strokeStyle = "#e08a8a";
    ctx.beginPath();
    ctx.moveTo(style.sideMarginPx - 14 + 0.5, 0);
    ctx.lineTo(style.sideMarginPx - 14 + 0.5, height);
    ctx.stroke();
    ctx.strokeStyle = "#d7dbe2";
    for (let y = style.topMarginPx; y < height - 8; y += style.lineHeightPx) {
      ctx.beginPath();
      ctx.moveTo(style.sideMarginPx, y + 0.5);
      ctx.lineTo(width - style.sideMarginPx, y + 0.5);
      ctx.stroke();
    }
  }
}

export function drawHandwritingText(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  style: HandwritingStyle,
  startIndex: number
): number {
  ctx.fillStyle = style.inkColor;
  ctx.font = `${style.fontSizePx}px ${HANDWRITING_FONTS[style.fontIdx]?.stack ?? "cursive"}`;
  ctx.textBaseline = "alphabetic";
  let drawn = 0;
  let y = style.topMarginPx + style.lineHeightPx * 0.72;
  for (let i = startIndex; i < lines.length; i++) {
    if (y > ctx.canvas.height - style.fontSizePx) break;
    const line = lines[i]!;
    if (line.length > 0) {
      const jitterX = deterministicJitter(i, 3);
      const jitterY = deterministicJitter(i * 13 + 1, 1.4);
      ctx.fillText(line, style.sideMarginPx + jitterX, y + jitterY);
    }
    drawn += 1;
    y += style.lineHeightPx;
  }
  return drawn;
}

export function deterministicJitter(seed: number, amplitude: number): number {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return (v - Math.floor(v) - 0.5) * 2 * amplitude;
}

export async function renderHandwritingPages(
  text: string,
  style: HandwritingStyle,
  options: {
    pageWidthPx: number;
    pageHeightPx: number;
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<Array<{ name: string; bytes: Uint8Array }>> {
  if (!text.trim()) {
    throw new PaperZeroError("INVALID_INPUT", "There is no text to render.");
  }
  const pages: Array<{ name: string; bytes: Uint8Array }> = [];
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) {
    throw new PaperZeroError("BROWSER_UNSUPPORTED", "Canvas is unavailable in this browser.");
  }
  probe.font = `${style.fontSizePx}px ${HANDWRITING_FONTS[style.fontIdx]?.stack ?? "cursive"}`;
  const maxWidthPx =
    options.pageWidthPx - style.sideMarginPx * 2;
  const lines = layoutHandwritingLines(text, (l) => probe.measureText(l || " ").width, maxWidthPx);
  const maxLinesPerPage = Math.max(
    4,
    Math.floor((options.pageHeightPx - style.topMarginPx - style.fontSizePx) / style.lineHeightPx)
  );
  const totalPages = Math.max(1, Math.ceil(lines.length / maxLinesPerPage));

  for (let p = 0; p < totalPages; p++) {
    if (options.signal?.aborted) throw new PaperZeroError("CANCELLED");
    const canvas = document.createElement("canvas");
    canvas.width = options.pageWidthPx;
    canvas.height = options.pageHeightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    drawPaperBackground(ctx, canvas.width, canvas.height, style);
    drawHandwritingText(ctx, lines, style, p * maxLinesPerPage);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b && b.size > 0 ? resolve(b) : reject(new Error("encode failed"))),
        "image/jpeg",
        0.92
      )
    );
    canvas.width = 0;
    canvas.height = 0;
    pages.push({
      name: `handwritten-${String(p + 1).padStart(2, "0")}.jpg`,
      bytes: new Uint8Array(await blob.arrayBuffer()),
    });
    options.onProgress?.(p + 1, totalPages);
    await new Promise((r) => setTimeout(r, 0));
  }
  void ("" as unknown as ColorTransformMode);
  return pages;
}
