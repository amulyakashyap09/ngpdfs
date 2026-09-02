import { encode } from "@pdf-lib/upng";
import { join } from "node:path";
import { createWorker, OEM } from "tesseract.js";
import { describe, expect, it } from "vitest";

const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

function syntheticTextPng(text: string): Uint8Array {
  const scale = 12;
  const width = (text.length * 6 + 2) * scale;
  const height = 11 * scale;
  const rgba = new Uint8Array(width * height * 4).fill(255);
  for (let charIndex = 0; charIndex < text.length; charIndex++) {
    const glyph = GLYPHS[text[charIndex]!] ?? [];
    for (let row = 0; row < glyph.length; row++) {
      for (let column = 0; column < 5; column++) {
        if (glyph[row]![column] !== "1") continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = (charIndex * 6 + column + 1) * scale + dx;
            const y = (row + 2) * scale + dy;
            const index = (y * width + x) * 4;
            rgba[index] = rgba[index + 1] = rgba[index + 2] = 0;
            rgba[index + 3] = 255;
          }
        }
      }
    }
  }
  const buffer = new ArrayBuffer(rgba.byteLength);
  new Uint8Array(buffer).set(rgba);
  return new Uint8Array(encode([buffer], width, height, 0));
}

describe("Tesseract.js integration", () => {
  it("recognizes a deterministic local English fixture", async () => {
    const worker = await createWorker("eng", OEM.LSTM_ONLY, {
      langPath: join(process.cwd(), "node_modules/@tesseract.js-data/eng/4.0.0_best_int"),
      cacheMethod: "none",
      gzip: true,
    });
    try {
      const png = syntheticTextPng("PAPER ZERO OCR");
      const result = await worker.recognize(Buffer.from(png));
      const normalized = result.data.text.toUpperCase().replace(/[^A-Z]+/g, " ").trim();
      // The deliberately simple 5x7 bitmap font is not an accuracy claim; this
      // assertion proves that the pinned engine and local model perform OCR.
      expect(normalized).toContain("ZERO");
      expect(normalized.length).toBeGreaterThan(8);
    } finally {
      await worker.terminate();
    }
  }, 30_000);
});
