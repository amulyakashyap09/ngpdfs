import { describe, expect, it } from "vitest";
import { countPages } from "./test-fixtures";
import { imagesToPdf, pageDimensionsFor } from "./ops/imagestopdf";

const PNG_1PX = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0)
);

describe("pageDimensionsFor", () => {
  it("uses image aspect for auto size", () => {
    const dims = pageDimensionsFor(800, 600, { pageSize: "auto", orientation: "portrait" });
    expect(Math.abs(dims.width / dims.height - 800 / 600)).toBeLessThan(0.01);
  });

  it("returns A4 portrait/landscape", () => {
    const portrait = pageDimensionsFor(1000, 1000, { pageSize: "a4", orientation: "portrait" });
    expect(portrait.width).toBeCloseTo(595.28);
    expect(portrait.height).toBeCloseTo(841.89);
    const landscape = pageDimensionsFor(1000, 1000, { pageSize: "a4", orientation: "landscape" });
    expect(landscape.width).toBeCloseTo(841.89);
    expect(landscape.height).toBeCloseTo(595.28);
  });

  it("caps enormous auto pages", () => {
    const dims = pageDimensionsFor(30000, 40000, { pageSize: "auto", orientation: "portrait" });
    expect(dims.width).toBeLessThanOrEqual(14400);
    expect(dims.height).toBeLessThanOrEqual(14400);
  });
});

describe("imagesToPdf", () => {
  it("embeds PNGs one page per image", async () => {
    const result = await imagesToPdf(
      [
        { name: "one.png", bytes: PNG_1PX.slice(), type: "png", widthPx: 1, heightPx: 1 },
        { name: "two.png", bytes: PNG_1PX.slice(), type: "png", widthPx: 1, heightPx: 1 },
      ],
      { pageSize: "a4", orientation: "portrait", marginPt: 24, fit: "contain" }
    );
    expect(result.files).toHaveLength(1);
    expect(await countPages(result.files[0]!.bytes)).toBe(2);
  });

  it("rejects empty input", async () => {
    await expect(
      imagesToPdf([], { pageSize: "auto", orientation: "portrait", marginPt: 0, fit: "contain" })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("skips undecodable images with a warning instead of failing", async () => {
    const garbage = Uint8Array.from([0x00, 0x01, 0x02]);
    const result = await imagesToPdf(
      [
        { name: "broken.png", bytes: garbage, type: "png", widthPx: 10, heightPx: 10 },
        { name: "good.png", bytes: PNG_1PX.slice(), type: "png", widthPx: 1, heightPx: 1 },
      ],
      { pageSize: "a4", orientation: "portrait", marginPt: 0, fit: "contain" }
    );
    expect(result.warnings.some((w) => w.includes("broken.png"))).toBe(true);
    expect(await countPages(result.files[0]!.bytes)).toBe(1);
  });
});
