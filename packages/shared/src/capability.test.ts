import { describe, expect, it } from "vitest";
import { detectCapabilities } from "./capability";

const MB = 1024 * 1024;

describe("detectCapabilities", () => {
  it("classifies desktop Chrome conservatively", () => {
    const caps = detectCapabilities({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      maxTouchPoints: 0,
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });
    expect(caps.deviceClass).toBe("desktop");
    expect(caps.memoryClass).toBe("high");
    expect(caps.maxRecommendedFileBytes).toBe(150 * MB);
    expect(caps.maxRecommendedRenderDPI).toBe(600);
  });

  it("classifies Android phones as mobile", () => {
    const caps = detectCapabilities({
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0 Mobile Safari/537.36",
      maxTouchPoints: 5,
    });
    expect(caps.deviceClass).toBe("mobile");
    expect(caps.maxWorkerConcurrency).toBeGreaterThanOrEqual(1);
    expect(caps.maxCanvasPixels).toBeLessThanOrEqual(16 * 1024 * 1024);
  });

  it("detects iPad as tablet", () => {
    const caps = detectCapabilities({
      userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0) AppleWebKit/605.1.15 Safari/604.1",
      maxTouchPoints: 5,
    });
    expect(caps.deviceClass).toBe("tablet");
    expect(caps.isSafariFamily).toBe(true);
  });

  it("treats iOS Safari conservatively for canvas limits", () => {
    const caps = detectCapabilities({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      maxTouchPoints: 5,
    });
    expect(caps.isIOS).toBe(true);
    expect(caps.maxCanvasDimension).toBeLessThanOrEqual(8192);
    expect(caps.warnings.length).toBeGreaterThan(0);
  });

  it("reduces limits on low-memory devices", () => {
    const desktop = detectCapabilities({ userAgent: "Chrome", deviceMemory: 8 });
    const low = detectCapabilities({ userAgent: "Chrome", deviceMemory: 2 });
    expect(low.maxRecommendedFileBytes).toBeLessThan(desktop.maxRecommendedFileBytes);
    expect(low.maxRecommendedRenderDPI).toBeLessThanOrEqual(desktop.maxRecommendedRenderDPI);
  });

  it("never exceeds core count minus one for workers", () => {
    const caps = detectCapabilities({ userAgent: "Chrome", hardwareConcurrency: 2 });
    expect(caps.maxWorkerConcurrency).toBeLessThanOrEqual(2);
  });
});
