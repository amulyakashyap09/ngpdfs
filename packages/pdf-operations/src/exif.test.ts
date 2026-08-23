import { describe, expect, it } from "vitest";
import { orientationSwapsDimensions, readExifOrientation } from "./exif";

function buildJpegWithExif(orientation: number): Uint8Array {
  const bytes: number[] = [0xff, 0xd8];
  const tiff: number[] = [];
  tiff.push(0x4d, 0x4d);
  tiff.push(0x00, 0x2a);
  tiff.push(0x00, 0x00, 0x00, 0x08);
  tiff.push(0x00, 0x01);
  tiff.push(0x01, 0x12);
  tiff.push(0x00, 0x03);
  tiff.push(0x00, 0x00, 0x00, 0x01);
  tiff.push(0x00, orientation);
  tiff.push(0x00, 0x00, 0x00, 0x00);

  const exifPayload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const length = exifPayload.length + 2;
  bytes.push(0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...exifPayload);
  bytes.push(0xff, 0xda, 0x00, 0x04, 0x00, 0x00);
  return Uint8Array.from(bytes);
}

describe("readExifOrientation", () => {
  it("returns 1 for non-JPEG data", () => {
    expect(readExifOrientation(Uint8Array.from([0x89, 0x50]))).toBe(1);
    expect(readExifOrientation(new Uint8Array(10))).toBe(1);
  });

  it("reads each orientation value", () => {
    for (const value of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(readExifOrientation(buildJpegWithExif(value))).toBe(value);
    }
  });

  it("defaults to 1 when no EXIF present", () => {
    const plain = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x84, 0x00]);
    expect(readExifOrientation(plain)).toBe(1);
  });
});

describe("orientationSwapsDimensions", () => {
  it("swaps for orientations 5-8", () => {
    expect(orientationSwapsDimensions(1)).toBe(false);
    expect(orientationSwapsDimensions(4)).toBe(false);
    expect(orientationSwapsDimensions(5)).toBe(true);
    expect(orientationSwapsDimensions(6)).toBe(true);
    expect(orientationSwapsDimensions(8)).toBe(true);
  });
});
