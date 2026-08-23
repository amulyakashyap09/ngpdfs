import { describe, expect, it } from "vitest";
import { estimateRenderMemory, maxScaleForDimension } from "./memory";

describe("estimateRenderMemory", () => {
  it("computes RGBA canvas bytes", () => {
    const result = estimateRenderMemory(1000, 1000);
    expect(result.canvasBytes).toBe(4_000_000);
    expect(result.totalBytes).toBeGreaterThan(result.canvasBytes);
  });

  it("respects budget", () => {
    const small = estimateRenderMemory(500, 500, { budgetBytes: 10 * 1024 * 1024 });
    const large = estimateRenderMemory(20000, 20000, { budgetBytes: 10 * 1024 * 1024 });
    expect(small.withinBudget).toBe(true);
    expect(large.withinBudget).toBe(false);
  });

  it("includes source overhead and extra buffers", () => {
    const withExtras = estimateRenderMemory(100, 100, {
      sourceBytes: 1024,
      extraBuffersBytes: 2048,
    });
    expect(withExtras.totalBytes).toBeGreaterThan(estimateRenderMemory(100, 100).totalBytes);
  });
});

describe("maxScaleForDimension", () => {
  it("returns base scale when within limits", () => {
    const { scale, clamped } = maxScaleForDimension(595, 842, 2, {
      maxCanvasDimension: 16384,
      maxCanvasPixels: 64 * 1024 * 1024,
    });
    expect(scale).toBe(2);
    expect(clamped).toBe(false);
  });

  it("clamps by maximum dimension", () => {
    const { scale, clamped } = maxScaleForDimension(595, 842, 40, {
      maxCanvasDimension: 16384,
      maxCanvasPixels: Number.MAX_SAFE_INTEGER,
    });
    expect(clamped).toBe(true);
    expect(595 * scale).toBeLessThanOrEqual(16384);
  });

  it("clamps by total pixel area", () => {
    const limit = 16 * 1024 * 1024;
    const { scale } = maxScaleForDimension(595, 842, 40, {
      maxCanvasDimension: 65535,
      maxCanvasPixels: limit,
    });
    expect(595 * scale * (842 * scale)).toBeLessThanOrEqual(limit + 1);
  });
});
