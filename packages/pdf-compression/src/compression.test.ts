import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import { encode } from "@pdf-lib/upng";
import { describe, expect, it } from "vitest";
import { analyzePdfForCompression } from "./analysis";
import { compressPdfWithGhostscript } from "./engine";
import { buildTargetProfiles, COMPRESSION_PRESETS, ghostscriptArgs } from "./presets";

async function makeTextPdf(lines = 20): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  for (let index = 0; index < lines; index++) {
    page.drawText(`PaperZero compression fixture line ${index + 1}`, {
      x: 48,
      y: 790 - index * 24,
      size: 12,
      font,
    });
  }
  return doc.save({ useObjectStreams: false });
}

async function makeImagePdf(): Promise<Uint8Array> {
  const width = 700;
  const height = 980;
  const rgba = new Uint8Array(width * height * 4);
  let seed = 123456789;
  for (let index = 0; index < rgba.length; index += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    rgba[index] = seed & 0xff;
    rgba[index + 1] = (seed >>> 8) & 0xff;
    rgba[index + 2] = (seed >>> 16) & 0xff;
    rgba[index + 3] = 255;
  }
  const png = new Uint8Array(encode([rgba.buffer], width, height, 0));
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(png);
  const page = doc.addPage([595, 842]);
  page.drawImage(image, { x: 0, y: 0, width: 595, height: 842 });
  return doc.save({ useObjectStreams: false });
}

describe("compression presets", () => {
  it("maps quality levels to progressively stronger image settings", () => {
    expect(COMPRESSION_PRESETS.light.colorDpi).toBeGreaterThan(COMPRESSION_PRESETS.medium.colorDpi);
    expect(COMPRESSION_PRESETS.medium.colorDpi).toBeGreaterThan(COMPRESSION_PRESETS.heavy.colorDpi);
    expect(COMPRESSION_PRESETS.light.jpegQuality).toBeGreaterThan(COMPRESSION_PRESETS.heavy.jpegQuality);
    const args = ghostscriptArgs(COMPRESSION_PRESETS.medium);
    expect(args).toContain("-sDEVICE=pdfwrite");
    expect(args).toContain("-dColorImageResolution=150");
    expect(args).toContain("-dJPEGQ=80");
  });

  it("chooses a sensible start from the target ratio and never exceeds four passes", () => {
    expect(buildTargetProfiles(1_000_000, 800_000)[0]?.id).toBe("light");
    expect(buildTargetProfiles(1_000_000, 400_000)[0]?.id).toBe("medium");
    expect(buildTargetProfiles(1_000_000, 100_000)[0]?.id).toBe("heavy");
    expect(buildTargetProfiles(10_000_000, 20_000, 99)).toHaveLength(3);
    expect(buildTargetProfiles(1_000_000, 500_000, 2)).toHaveLength(2);
  });

  it("rejects invalid target sizes without creating attempts", () => {
    expect(buildTargetProfiles(1_000_000, 0)).toEqual([]);
    expect(buildTargetProfiles(1_000_000, Number.NaN)).toEqual([]);
  });
});

describe("compression preflight", () => {
  it("analyzes deterministic text fixtures", async () => {
    const bytes = await makeTextPdf();
    const analysis = await analyzePdfForCompression(bytes);
    expect(analysis.pageCount).toBe(1);
    expect(analysis.imageCount).toBe(0);
    expect(analysis.contentKind).toBe("text-vector");
    expect(analysis.inputBytes).toBe(bytes.byteLength);
    expect(analysis.hasSignatureFields).toBe(false);
  });

  it("routes encrypted PDFs to password removal", async () => {
    const doc = await PDFDocument.load(await makeTextPdf());
    doc.encrypt({ userPassword: "known123", ownerPassword: "owner123", algorithm: "AES-256" });
    await expect(analyzePdfForCompression(await doc.save())).rejects.toMatchObject({
      code: "ENCRYPTED_PDF",
    });
  });

  it("rejects malformed input with a stable error code", async () => {
    await expect(
      analyzePdfForCompression(new TextEncoder().encode("not a PDF"))
    ).rejects.toMatchObject({ code: "FILE_CORRUPT" });
  });
});

describe("Ghostscript WASM integration", () => {
  it("rewrites a real PDF and validates its page count", async () => {
    const bytes = await makeTextPdf(28);
    const result = await compressPdfWithGhostscript(bytes, { preset: "medium" });
    expect(result.analysis.pageCount).toBe(1);
    expect(result.attempts).toHaveLength(1);
    expect(result.stats.compressedBytes).toBeGreaterThan(100);
    expect(result.stats.attempts).toBe(1);
    expect(result.stats.bytesSaved).toBe(
      Math.max(0, result.stats.originalBytes - result.stats.compressedBytes)
    );
    expect(result.stats.percentSaved).toBeGreaterThanOrEqual(0);
  }, 30_000);

  it("bounds target-size retries while retaining the smallest valid result", async () => {
    const bytes = await makeImagePdf();
    const result = await compressPdfWithGhostscript(bytes, {
      preset: "heavy",
      targetBytes: 20 * 1024,
      maxAttempts: 4,
    });
    expect(result.attempts.length).toBeGreaterThan(1);
    expect(result.attempts.length).toBeLessThanOrEqual(4);
    expect(result.stats.compressedBytes).toBe(
      Math.min(...result.attempts.map((attempt) => attempt.outputBytes))
    );
  }, 30_000);
});
