import { encode } from "@pdf-lib/upng";
import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compressPdfWithGhostscript } from "./engine";
import type { CompressionPreset } from "./types";

const benchmark = process.env.PAPERZERO_COMPRESSION_BENCHMARK === "1" ? describe : describe.skip;

function deterministicRgba(width: number, height: number, seed: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  let value = seed >>> 0;
  for (let index = 0; index < data.length; index += 4) {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    const noise = value & 0xff;
    const pixel = index / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    data[index] = (x / width) * 180 + noise * 0.3;
    data[index + 1] = (y / height) * 180 + noise * 0.25;
    data[index + 2] = 70 + noise * 0.6;
    data[index + 3] = 255;
  }
  return data;
}

async function pngFixture(width: number, height: number, seed: number): Promise<Uint8Array> {
  const rgba = deterministicRgba(width, height, seed);
  const pixels = new ArrayBuffer(rgba.byteLength);
  new Uint8Array(pixels).set(rgba);
  return new Uint8Array(encode([pixels], width, height, 0));
}

async function textReport(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
    const page = doc.addPage([595, 842]);
    for (let row = 0; row < 28; row++) {
      page.drawText(`Synthetic report · page ${pageIndex + 1} · row ${row + 1}`, {
        x: 48,
        y: 790 - row * 25,
        size: 11,
        font,
      });
    }
  }
  return doc.save({ useObjectStreams: false });
}

async function scannedDocument(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const png = await doc.embedPng(await pngFixture(1400, 1900, 42));
  const page = doc.addPage([595, 842]);
  page.drawImage(png, { x: 0, y: 0, width: 595, height: 842 });
  return doc.save({ useObjectStreams: false });
}

async function presentation(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let index = 0; index < 3; index++) {
    const png = await doc.embedPng(await pngFixture(1200, 720, 100 + index));
    const page = doc.addPage([720, 405]);
    page.drawImage(png, { x: 0, y: 0, width: 720, height: 405 });
  }
  return doc.save({ useObjectStreams: false });
}

async function vectorBrochure(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  for (let row = 0; row < 80; row++) {
    for (let column = 0; column < 12; column++) {
      page.drawRectangle({
        x: 20 + column * 46,
        y: 20 + row * 10,
        width: 40,
        height: 7,
        color: rgb((row % 7) / 7, (column % 5) / 5, ((row + column) % 9) / 9),
      });
    }
  }
  return doc.save({ useObjectStreams: false });
}

async function optimizedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([300, 300]);
  return doc.save({ useObjectStreams: true });
}

async function longDocument(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 105; index++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Synthetic long document page ${index + 1}`, { x: 48, y: 780, size: 12, font });
  }
  return doc.save({ useObjectStreams: true });
}

benchmark("local Phase 4 benchmark suite", () => {
  it("records synthetic, non-sensitive fixture results", async () => {
    const fixtures: Array<[string, () => Promise<Uint8Array>]> = [
      ["text-only report", textReport],
      ["high-resolution scan", scannedDocument],
      ["photo presentation", presentation],
      ["vector brochure", vectorBrochure],
      ["already optimized", optimizedPdf],
      ["105-page document", longDocument],
    ];
    const presets: CompressionPreset[] = ["light", "medium", "heavy"];
    const rows: Array<Record<string, string | number>> = [];
    const outputDir = process.env.PAPERZERO_BENCHMARK_DIR;
    if (outputDir) await mkdir(outputDir, { recursive: true });
    for (const [name, create] of fixtures) {
      const bytes = await create();
      const safeName = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      if (outputDir) await writeFile(join(outputDir, `${safeName}-source.pdf`), bytes);
      for (const preset of presets) {
        console.log(`[benchmark] ${name} / ${preset} / ${bytes.byteLength} bytes`);
        const started = performance.now();
        const result = await compressPdfWithGhostscript(bytes, { preset });
        rows.push({
          fixture: name,
          preset,
          sourceBytes: bytes.byteLength,
          outputBytes: result.stats.compressedBytes,
          savedPercent: result.stats.percentSaved,
          runtimeMs: Math.round(performance.now() - started),
        });
        if (outputDir && result.file) {
          await writeFile(join(outputDir, `${safeName}-${preset}.pdf`), result.file.bytes);
        }
        expect(result.analysis.pageCount).toBeGreaterThan(0);
      }
    }
    console.table(rows);
  }, 120_000);
});
