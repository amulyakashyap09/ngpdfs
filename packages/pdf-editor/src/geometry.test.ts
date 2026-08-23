import { describe, expect, it } from "vitest";
import {
  clampRectInside,
  cssToPdfPoint,
  customSizeToPt,
  fitScale,
  intersectRect,
  normalizeDragRect,
  pdfToCssRect,
  resolveTargetSize,
} from "./geometry";

describe("geometry conversions", () => {
  const pageHeight = 842;

  it("converts CSS top-left to PDF bottom-left", () => {
    const point = cssToPdfPoint(100, 200, pageHeight, 1);
    expect(point.x).toBe(100);
    expect(point.y).toBe(642);
  });

  it("round-trips a rect between coordinate systems", () => {
    const rect = { x: 50, y: 600, width: 120, height: 40 };
    const css = pdfToCssRect(rect, pageHeight, 2);
    expect(css.y).toBe((pageHeight - 600 - 40) * 2);
    const pdfTop = pageHeight - css.y / 2;
    expect(pdfTop - rect.height).toBeCloseTo(rect.y);
    expect(css.x / 2).toBeCloseTo(rect.x);
    expect(css.width / 2).toBeCloseTo(rect.width);
    expect(css.height / 2).toBeCloseTo(rect.height);
  });
});

describe("drag helpers", () => {
  it("normalizes drag rectangles", () => {
    const rect = normalizeDragRect({ x: 300, y: 500 }, { x: 100, y: 620 });
    expect(rect).toEqual({ x: 100, y: 500, width: 200, height: 120 });
  });

  it("clamps rects inside bounds", () => {
    const clamped = clampRectInside({ x: -10, y: -10, width: 50, height: 50 }, { x: 0, y: 0, width: 100, height: 80 });
    expect(clamped).toEqual({ x: 0, y: 0, width: 50, height: 50 });
    const tooBig = clampRectInside({ x: 0, y: 0, width: 500, height: 500 }, { x: 0, y: 0, width: 100, height: 80 });
    expect(tooBig.width).toBe(100);
    expect(tooBig.height).toBe(80);
  });

  it("computes intersections", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 5, y: 5, width: 10, height: 10 };
    expect(intersectRect(a, b)).toEqual({ x: 5, y: 5, width: 5, height: 5 });
    const far = { x: 50, y: 50, width: 5, height: 5 };
    expect(intersectRect(a, far).width).toBe(0);
  });
});

describe("fitScale", () => {
  it("centers without upscaling beyond original size", () => {
    const result = fitScale(1000, 500, 500, 800, "center");
    expect(result.scale).toBeLessThanOrEqual(1);
    expect(result.drawWidth / result.drawHeight).toBeCloseTo(2);
  });

  it("fits by shrinking to the limiting dimension", () => {
    const result = fitScale(400, 200, 200, 400, "fit");
    expect(result.scale).toBeCloseTo(0.5);
    expect(result.drawWidth).toBeCloseTo(200);
  });

  it("fills by covering both dimensions", () => {
    const result = fitScale(400, 200, 200, 400, "fill");
    expect(result.drawWidth).toBeGreaterThanOrEqual(200);
    expect(result.drawHeight).toBeGreaterThanOrEqual(400);
  });

  it("respects margins", () => {
    const noMargin = fitScale(100, 100, 200, 200, "fit");
    const withMargin = fitScale(100, 100, 200, 200, "fit", 50);
    expect(withMargin.scale).toBeLessThan(noMargin.scale);
  });
});

describe("resolveTargetSize", () => {
  it("maps presets with orientation", () => {
    const portrait = resolveTargetSize({ preset: "a4", orientation: "portrait" });
    expect(portrait.width).toBeCloseTo(595.28);
    expect(portrait.height).toBeCloseTo(841.89);
    const landscape = resolveTargetSize({ preset: "letter", orientation: "landscape" });
    expect(landscape.width).toBe(792);
    expect(landscape.height).toBe(612);
  });

  it("supports custom units", () => {
    const mm = customSizeToPt(210, 297, "mm");
    expect(mm.width).toBeCloseTo(595.28, 1);
    const inches = customSizeToPt(8.5, 11, "in");
    expect(inches.width).toBe(612);
    const target = resolveTargetSize({
      preset: "custom",
      orientation: "portrait",
      custom: { width: 210, height: 297, unit: "mm" },
    });
    expect(target.width).toBeCloseTo(595.28, 1);
  });
});
