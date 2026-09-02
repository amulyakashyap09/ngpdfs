import { PDFDocument } from "@cantoo/pdf-lib";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildSearchablePdf } from "./assembly";
import { shouldOcrPage } from "./analysis";
import { OCR_LANGUAGES } from "./languages";
import { otsuThreshold, preprocessRgba } from "./preprocess";
import {
  correctedDimensions,
  estimateDocumentCorners,
  fullImageCorners,
  warpPerspectiveRgba,
} from "./scan";

function pixelGrid(width: number, height: number, value = 255): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }
  return data;
}

describe("OCR preprocessing", () => {
  it("skips useful existing text unless OCR is forced", () => {
    expect(shouldOcrPage("short label")).toBe(true);
    expect(shouldOcrPage("A useful existing text layer with substantially more than forty characters.")).toBe(false);
    expect(shouldOcrPage("A useful existing text layer with substantially more than forty characters.", true)).toBe(true);
  });
  it("finds a useful threshold and binarizes pixels", () => {
    const data = pixelGrid(4, 1);
    data[0] = data[1] = data[2] = 20;
    data[4] = data[5] = data[6] = 40;
    data[8] = data[9] = data[10] = 210;
    data[12] = data[13] = data[14] = 240;
    expect(otsuThreshold(data)).toBeGreaterThanOrEqual(20);
    const output = preprocessRgba(data, 4, 1, {
      grayscale: true,
      normalizeContrast: false,
      threshold: true,
      denoise: false,
      deskew: false,
    });
    expect(output[0]).toBe(0);
    expect(output[12]).toBe(255);
  });

  it("normalizes low-contrast grayscale input", () => {
    const data = pixelGrid(2, 1);
    data[0] = data[1] = data[2] = 100;
    data[4] = data[5] = data[6] = 120;
    const output = preprocessRgba(data, 2, 1, {
      grayscale: true,
      normalizeContrast: true,
      threshold: false,
      denoise: false,
      deskew: false,
    });
    expect(output[0]).toBe(0);
    expect(output[4]).toBe(255);
  });
});

describe("scan geometry", () => {
  it("preserves an image under an identity perspective transform", () => {
    const source = pixelGrid(3, 3, 80);
    source[0] = 10;
    const output = warpPerspectiveRgba(source, 3, 3, fullImageCorners(3, 3), 3, 3);
    expect([...output]).toEqual([...source]);
  });

  it("caps corrected output dimensions for mobile memory safety", () => {
    const dimensions = correctedDimensions(fullImageCorners(6000, 4000), 2000);
    expect(dimensions.width).toBe(2000);
    expect(dimensions.height).toBeLessThanOrEqual(1334);
  });

  it("falls back to the full image when no reliable edge contour exists", () => {
    expect(estimateDocumentCorners(pixelGrid(100, 80), 100, 80)).toEqual(fullImageCorners(100, 80));
  });
});

describe("searchable PDF assembly", () => {
  it("preserves page dimensions and adds a validated invisible text layer", async () => {
    const source = await PDFDocument.create();
    source.addPage([612, 792]);
    const bytes = await source.save();
    const result = await buildSearchablePdf({
      bytes,
      pages: [{
        pageNumber: 1,
        status: "recognized",
        text: "PaperZero OCR",
        confidence: 95,
        words: [{ text: "PaperZero", confidence: 96, x: 48, y: 700, width: 72, height: 14 }],
      }],
    });
    const output = await PDFDocument.load(result.files[0]!.bytes);
    expect(output.getPageCount()).toBe(1);
    expect(output.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
    expect(result.files[0]!.bytes.byteLength).toBeGreaterThan(bytes.byteLength);
    const pdfjs = await getDocument({
      data: result.files[0]!.bytes.slice(),
      isEvalSupported: false,
      verbosity: 0,
    }).promise;
    try {
      const page = await pdfjs.getPage(1);
      const text = (await page.getTextContent()).items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      expect(text).toContain("PaperZero");
      page.cleanup();
    } finally {
      await pdfjs.destroy();
    }
  });

  it("ships only explicit, size-labelled initial language models", () => {
    expect(OCR_LANGUAGES.map((language) => language.code)).toEqual(["eng", "spa"]);
    expect(OCR_LANGUAGES.every((language) => language.modelBytes > 1_000_000)).toBe(true);
  });
});
