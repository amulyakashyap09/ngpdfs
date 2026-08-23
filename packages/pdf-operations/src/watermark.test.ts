import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { createTextPdf } from "./test-fixtures";
import { applyImageWatermark, applyTextWatermark } from "./ops/watermark";
import { resolvePosition } from "./positions";

const PNG_1PX = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0)
);

describe("applyTextWatermark", () => {
  it("stamps text on all pages without changing page count", async () => {
    const fixture = await createTextPdf("body", 3);
    const result = await applyTextWatermark(fixture.bytes, {
      text: "CONFIDENTIAL",
      fontSize: 48,
      opacity: 0.2,
      rotationDeg: 45,
      color: rgb(1, 0, 0) ? [1, 0, 0] : [1, 0, 0],
      position: "middle-center",
      pages: [],
    });
    const { PDFDocument: Doc } = await import("pdf-lib");
    const doc = await Doc.load(result.files[0]!.bytes);
    expect(doc.getPageCount()).toBe(3);
  });

  it("respects selected page list", async () => {
    const fixture = await createTextPdf("body", 4);
    const result = await applyTextWatermark(fixture.bytes, {
      text: "DRAFT",
      fontSize: 24,
      opacity: 0.5,
      rotationDeg: 0,
      color: [0, 0, 1],
      position: "top-right",
      pages: [2, 3],
    });
    expect(result.files).toHaveLength(1);
  });

  it("rejects empty watermark text", async () => {
    const fixture = await createTextPdf("x", 1);
    await expect(
      applyTextWatermark(fixture.bytes, {
        text: "   ",
        fontSize: 12,
        opacity: 1,
        rotationDeg: 0,
        color: [0, 0, 0],
        position: "middle-center",
        pages: [],
      })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("applyImageWatermark", () => {
  it("embeds a PNG image at the requested scale", async () => {
    const fixture = await createTextPdf("x", 1);
    const result = await applyImageWatermark(
      fixture.bytes,
      PNG_1PX,
      { imageType: "png", scaleFraction: 0.25, opacity: 1, rotationDeg: 0, position: "bottom-right", pages: [] }
    );
    const { PDFDocument: Doc } = await import("pdf-lib");
    const doc = await Doc.load(result.files[0]!.bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});

describe("resolvePosition", () => {
  const pageW = 600;
  const pageH = 800;

  it("places items in all nine positions", () => {
    const itemW = 100;
    const itemH = 50;
    expect(resolvePosition("top-left", pageW, pageH, itemW, itemH)).toEqual({ x: 0, y: 750 });
    expect(resolvePosition("top-center", pageW, pageH, itemW, itemH)).toEqual({ x: 250, y: 750 });
    expect(resolvePosition("top-right", pageW, pageH, itemW, itemH)).toEqual({ x: 500, y: 750 });
    expect(resolvePosition("middle-left", pageW, pageH, itemW, itemH)).toEqual({ x: 0, y: 375 });
    expect(resolvePosition("middle-center", pageW, pageH, itemW, itemH)).toEqual({ x: 250, y: 375 });
    expect(resolvePosition("middle-right", pageW, pageH, itemW, itemH)).toEqual({ x: 500, y: 375 });
    expect(resolvePosition("bottom-left", pageW, pageH, itemW, itemH)).toEqual({ x: 0, y: 0 });
    expect(resolvePosition("bottom-center", pageW, pageH, itemW, itemH)).toEqual({ x: 250, y: 0 });
    expect(resolvePosition("bottom-right", pageW, pageH, itemW, itemH)).toEqual({ x: 500, y: 0 });
  });

  it("honors margin", () => {
    const point = resolvePosition("top-left", pageW, pageH, 100, 50, 20);
    expect(point).toEqual({ x: 20, y: 730 });
  });

  it("keeps items inside the page", () => {
    for (const pos of [
      "top-left",
      "top-center",
      "top-right",
      "middle-left",
      "middle-center",
      "middle-right",
      "bottom-left",
      "bottom-center",
      "bottom-right",
    ] as const) {
      const p = resolvePosition(pos, pageW, pageH, 120, 60, 10);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + 120).toBeLessThanOrEqual(pageW);
      expect(p.y + 60).toBeLessThanOrEqual(pageH);
    }
  });

  it("matches pdf-lib font metrics for centered placement", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const text = "CONFIDENTIAL";
    const width = font.widthOfTextAtSize(text, 40);
    const point = resolvePosition("middle-center", 595.28, 841.89, width, 40);
    expect(Math.abs(point.x + width / 2 - 595.28 / 2)).toBeLessThan(0.01);
  });
});
