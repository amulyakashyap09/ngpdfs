import type { OcrPreprocessOptions } from "./types";
import { preprocessRgba } from "./preprocess";

export interface ScanPoint { x: number; y: number }
export type ScanCorners = [ScanPoint, ScanPoint, ScanPoint, ScanPoint];
export type ScanEnhancement = "original" | "auto" | "grayscale" | "black-white";

export function fullImageCorners(width: number, height: number): ScanCorners {
  return [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];
}

export function correctedDimensions(corners: ScanCorners, maxDimension = 3000): { width: number; height: number } {
  const distance = (a: ScanPoint, b: ScanPoint) => Math.hypot(a.x - b.x, a.y - b.y);
  let width = Math.max(distance(corners[0], corners[1]), distance(corners[3], corners[2]));
  let height = Math.max(distance(corners[0], corners[3]), distance(corners[1], corners[2]));
  const scale = Math.min(1, maxDimension / Math.max(1, width, height));
  width = Math.max(32, Math.round(width * scale));
  height = Math.max(32, Math.round(height * scale));
  return { width, height };
}

export function warpPerspectiveRgba(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  corners: ScanCorners,
  outputWidth: number,
  outputHeight: number
): Uint8ClampedArray {
  const destination: ScanCorners = fullImageCorners(outputWidth, outputHeight);
  const matrix = solveHomography(destination, corners);
  const output = new Uint8ClampedArray(outputWidth * outputHeight * 4);
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const denominator = matrix[6]! * x + matrix[7]! * y + 1;
      const sourceX = (matrix[0]! * x + matrix[1]! * y + matrix[2]!) / denominator;
      const sourceY = (matrix[3]! * x + matrix[4]! * y + matrix[5]!) / denominator;
      sampleBilinear(source, sourceWidth, sourceHeight, sourceX, sourceY, output, (y * outputWidth + x) * 4);
    }
  }
  return output;
}

export function enhanceScanRgba(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  mode: ScanEnhancement
): Uint8ClampedArray {
  if (mode === "original") return new Uint8ClampedArray(input);
  const options: OcrPreprocessOptions = {
    grayscale: mode !== "auto",
    normalizeContrast: true,
    threshold: mode === "black-white",
    denoise: mode === "black-white",
    deskew: false,
  };
  return preprocessRgba(input, width, height, options);
}

export function estimateDocumentCorners(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): ScanCorners {
  let left = width - 1;
  let right = 0;
  let top = height - 1;
  let bottom = 0;
  let found = 0;
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const index = (y * width + x) * 4;
      const center = luminance(rgba, index);
      const gradient = Math.abs(center - luminance(rgba, index - 4)) +
        Math.abs(center - luminance(rgba, index - width * 4));
      if (gradient > 70) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        found += 1;
      }
    }
  }
  if (found < 30 || right - left < width * 0.3 || bottom - top < height * 0.3) {
    return fullImageCorners(width, height);
  }
  const marginX = Math.max(0, Math.round((right - left) * 0.02));
  const marginY = Math.max(0, Math.round((bottom - top) * 0.02));
  return [
    { x: Math.max(0, left - marginX), y: Math.max(0, top - marginY) },
    { x: Math.min(width - 1, right + marginX), y: Math.max(0, top - marginY) },
    { x: Math.min(width - 1, right + marginX), y: Math.min(height - 1, bottom + marginY) },
    { x: Math.max(0, left - marginX), y: Math.min(height - 1, bottom + marginY) },
  ];
}

function luminance(rgba: Uint8ClampedArray, index: number): number {
  return rgba[index]! * 0.2126 + rgba[index + 1]! * 0.7152 + rgba[index + 2]! * 0.0722;
}

function solveHomography(from: ScanCorners, to: ScanCorners): number[] {
  const rows: number[][] = [];
  for (let index = 0; index < 4; index++) {
    const x = from[index]!.x;
    const y = from[index]!.y;
    const u = to[index]!.x;
    const v = to[index]!.y;
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) {
      if (Math.abs(rows[row]![column]!) > Math.abs(rows[pivot]![column]!)) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot]!, rows[column]!];
    const divisor = rows[column]![column]!;
    if (Math.abs(divisor) < 1e-10) throw new Error("Invalid crop quadrilateral");
    for (let value = column; value < 9; value++) rows[column]![value]! /= divisor;
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const factor = rows[row]![column]!;
      for (let value = column; value < 9; value++) rows[row]![value]! -= factor * rows[column]![value]!;
    }
  }
  return rows.map((row) => row[8]!);
}

function sampleBilinear(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  output: Uint8ClampedArray,
  outputIndex: number
): void {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const dx = x - x0;
  const dy = y - y0;
  for (let channel = 0; channel < 4; channel++) {
    const top = source[(y0 * width + x0) * 4 + channel]! * (1 - dx) + source[(y0 * width + x1) * 4 + channel]! * dx;
    const bottom = source[(y1 * width + x0) * 4 + channel]! * (1 - dx) + source[(y1 * width + x1) * 4 + channel]! * dx;
    output[outputIndex + channel] = top * (1 - dy) + bottom * dy;
  }
}
