import type { OcrPreprocessOptions } from "./types";

function clamp(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

export function preprocessRgba(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  options: OcrPreprocessOptions
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(input);
  let min = 255;
  let max = 0;
  for (let index = 0; index < output.length; index += 4) {
    const luma = Math.round(
      output[index]! * 0.2126 + output[index + 1]! * 0.7152 + output[index + 2]! * 0.0722
    );
    min = Math.min(min, luma);
    max = Math.max(max, luma);
    if (options.grayscale || options.normalizeContrast || options.threshold) {
      output[index] = luma;
      output[index + 1] = luma;
      output[index + 2] = luma;
    }
  }

  if (options.normalizeContrast && max > min) {
    const scale = 255 / (max - min);
    for (let index = 0; index < output.length; index += 4) {
      const value = clamp((output[index]! - min) * scale);
      output[index] = value;
      output[index + 1] = value;
      output[index + 2] = value;
    }
  }

  if (options.threshold) {
    const cutoff = otsuThreshold(output);
    for (let index = 0; index < output.length; index += 4) {
      const value = output[index]! >= cutoff ? 255 : 0;
      output[index] = value;
      output[index + 1] = value;
      output[index + 2] = value;
    }
  }

  return options.denoise ? medianFilter(output, width, height) : output;
}

export function otsuThreshold(rgba: Uint8ClampedArray): number {
  const histogram = new Uint32Array(256);
  for (let index = 0; index < rgba.length; index += 4) histogram[rgba[index]!]! += 1;
  const total = rgba.length / 4;
  let sum = 0;
  for (let value = 0; value < 256; value++) sum += value * histogram[value]!;
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let best = 127;
  for (let value = 0; value < 256; value++) {
    backgroundWeight += histogram[value]!;
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += value * histogram[value]!;
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      best = value;
    }
  }
  return best;
}

function medianFilter(rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const output = new Uint8ClampedArray(rgba);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const values: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) values.push(rgba[((y + dy) * width + x + dx) * 4]!);
      }
      values.sort((a, b) => a - b);
      const value = values[4]!;
      const index = (y * width + x) * 4;
      output[index] = value;
      output[index + 1] = value;
      output[index + 2] = value;
    }
  }
  return output;
}
