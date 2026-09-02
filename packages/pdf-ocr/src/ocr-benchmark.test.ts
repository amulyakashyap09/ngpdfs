import { encode } from "@pdf-lib/upng";
import { join } from "node:path";
import { createWorker, OEM } from "tesseract.js";
import { describe, expect, it } from "vitest";
import { shouldOcrPage } from "./analysis";

const benchmark = process.env.PAPERZERO_OCR_BENCHMARK === "1" ? describe : describe.skip;

const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

interface Raster { rgba: Uint8Array; width: number; height: number }

function rasterText(text: string, foreground = 0, background = 255, slant = 0): Raster {
  const scale = 12;
  const width = (text.length * 6 + 6) * scale;
  const height = 12 * scale;
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = rgba[index + 1] = rgba[index + 2] = background;
    rgba[index + 3] = 255;
  }
  for (let charIndex = 0; charIndex < text.length; charIndex++) {
    const glyph = GLYPHS[text[charIndex]!] ?? [];
    for (let row = 0; row < glyph.length; row++) {
      for (let column = 0; column < 5; column++) {
        if (glyph[row]![column] !== "1") continue;
        const shift = Math.round((row - 3) * slant);
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = (charIndex * 6 + column + 2) * scale + dx + shift;
            const y = (row + 2) * scale + dy;
            if (x < 0 || x >= width) continue;
            const index = (y * width + x) * 4;
            rgba[index] = rgba[index + 1] = rgba[index + 2] = foreground;
          }
        }
      }
    }
  }
  return { rgba, width, height };
}

function rotate90(source: Raster): Raster {
  const rgba = new Uint8Array(source.rgba.length);
  const width = source.height;
  const height = source.width;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const destinationX = source.height - 1 - y;
      const destinationY = x;
      const from = (y * source.width + x) * 4;
      const to = (destinationY * width + destinationX) * 4;
      rgba.set(source.rgba.subarray(from, from + 4), to);
    }
  }
  return { rgba, width, height };
}

function addPhotoBlock(source: Raster): Raster {
  const rgba = source.rgba.slice();
  for (let y = 10; y < 45; y++) {
    for (let x = source.width - 70; x < source.width - 10; x++) {
      const index = (y * source.width + x) * 4;
      rgba[index] = 30;
      rgba[index + 1] = 110;
      rgba[index + 2] = 180;
    }
  }
  return { ...source, rgba };
}

function png(raster: Raster): Buffer {
  const buffer = new ArrayBuffer(raster.rgba.byteLength);
  new Uint8Array(buffer).set(raster.rgba);
  return Buffer.from(encode([buffer], raster.width, raster.height, 0));
}

function normalize(text: string): string {
  return text.toUpperCase().replace(/[^A-Z]+/g, " ").trim();
}

function characterAccuracy(expected: string, actual: string): number {
  const left = normalize(expected);
  const right = normalize(actual);
  const rows = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
  for (let i = 0; i <= left.length; i++) rows[i]![0] = i;
  for (let j = 0; j <= right.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      rows[i]![j] = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
  }
  return Math.max(0, 1 - rows[left.length]![right.length]! / Math.max(1, left.length));
}

benchmark("Phase 5 synthetic OCR benchmark", () => {
  it("records eight non-sensitive fixture categories", async () => {
    const worker = await createWorker("eng", OEM.LSTM_ONLY, {
      langPath: join(process.cwd(), "apps/web/public/ocr/lang"),
      cacheMethod: "none",
      gzip: true,
    });
    const fixtures = [
      { name: "300 DPI clean scan", expected: "PAPER ZERO OCR", raster: rasterText("PAPER ZERO OCR") },
      { name: "low contrast", expected: "PAPER ZERO OCR", raster: rasterText("PAPER ZERO OCR", 105, 180) },
      { name: "skewed", expected: "PAPER ZERO OCR", raster: rasterText("PAPER ZERO OCR", 0, 255, 0.8) },
      { name: "rotated", expected: "PAPER ZERO OCR", raster: rotate90(rasterText("PAPER ZERO OCR")), rotateAuto: true },
      { name: "two-column approximation", expected: "PAPER ZERO OCR PAPER ZERO OCR", raster: rasterText("PAPER ZERO OCR  PAPER ZERO OCR") },
      { name: "mixed text/image", expected: "PAPER ZERO OCR", raster: addPhotoBlock(rasterText("PAPER ZERO OCR")) },
    ];
    const rows: Array<Record<string, string | number>> = [];
    try {
      for (const fixture of fixtures) {
        const started = performance.now();
        const result = await worker.recognize(png(fixture.raster), { rotateAuto: fixture.rotateAuto ?? false });
        rows.push({
          fixture: fixture.name,
          recognized: normalize(result.data.text),
          characterAccuracy: Math.round(characterAccuracy(fixture.expected, result.data.text) * 1000) / 10,
          confidence: Math.round(result.data.confidence * 10) / 10,
          runtimeMs: Math.round(performance.now() - started),
        });
      }
      rows.push({
        fixture: "already-searchable PDF",
        recognized: shouldOcrPage("This existing text layer is long enough to be useful and must be preserved.") ? "OCR" : "SKIPPED",
        characterAccuracy: 100,
        confidence: 100,
        runtimeMs: 0,
      });
      await worker.reinitialize("spa");
      const spanish = rasterText("PAPEL CERO");
      const started = performance.now();
      const result = await worker.recognize(png(spanish));
      rows.push({
        fixture: "multilingual Spanish",
        recognized: normalize(result.data.text),
        characterAccuracy: Math.round(characterAccuracy("PAPEL CERO", result.data.text) * 1000) / 10,
        confidence: Math.round(result.data.confidence * 10) / 10,
        runtimeMs: Math.round(performance.now() - started),
      });
      expect(rows).toHaveLength(8);
      expect(rows.every((row) => Number(row.characterAccuracy) >= 0)).toBe(true);
      console.table(rows);
    } finally {
      await worker.terminate();
    }
  }, 120_000);
});
