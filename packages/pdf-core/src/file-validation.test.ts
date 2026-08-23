import { describe, expect, it } from "vitest";
import { LocalDocumentFile, createDocumentFile } from "./document-file";
import { sniffImageType, validateOutputPdf, validatePdfFile } from "./file-validation";

const PNG_1PX = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0)
);

describe("LocalDocumentFile", () => {
  it("wraps a File and exposes metadata", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "test.pdf", { type: "application/pdf" });
    const doc = createDocumentFile(file);
    expect(doc.meta.name).toBe("test.pdf");
    expect(doc.meta.size).toBe(3);
    expect(doc.isNativeFile).toBe(true);
  });

  it("converts between representations without aliasing", async () => {
    const source = new Uint8Array([9, 8, 7]);
    const doc = new LocalDocumentFile(source);
    const buffer = await doc.asArrayBuffer();
    const bytes = await doc.asUint8Array();
    expect(buffer.byteLength).toBe(3);
    expect(bytes.byteLength).toBe(3);
    const blob = doc.asBlob();
    expect(blob.size).toBe(3);
  });

  it("disposes underlying data", async () => {
    const doc = new LocalDocumentFile(new Uint8Array([1]));
    doc.dispose();
    await expect(doc.asArrayBuffer()).rejects.toThrow();
  });
});

describe("validatePdfFile", () => {
  it("accepts %PDF header at offset zero", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 fake body");
    await expect(validatePdfFile(new LocalDocumentFile(bytes))).resolves.toBeUndefined();
  });

  it("tolerates leading junk before %PDF signature", async () => {
    const junk = new Uint8Array(200).fill(0x41);
    const header = new TextEncoder().encode("%PDF-1.4");
    const combined = new Uint8Array(junk.length + header.length);
    combined.set(junk);
    combined.set(header, junk.length);
    await expect(validatePdfFile(new LocalDocumentFile(combined))).resolves.toBeUndefined();
  });

  it("rejects non-PDF content", async () => {
    const notPdf = new TextEncoder().encode("PK-zip-disguised-as-pdf");
    await expect(validatePdfFile(new LocalDocumentFile(notPdf))).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE",
    });
  });
});

describe("sniffImageType", () => {
  it("detects PNG by magic bytes", async () => {
    const blob = new Blob([PNG_1PX.slice().buffer as ArrayBuffer]);
    await expect(sniffImageType(blob)).resolves.toBe("png");
  });

  it("detects JPEG magic bytes", async () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    await expect(sniffImageType(new Blob([jpeg]))).resolves.toBe("jpeg");
  });

  it("detects WebP RIFF container", async () => {
    const webp = new Uint8Array(16);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    await expect(sniffImageType(new Blob([webp]))).resolves.toBe("webp");
  });

  it("rejects unknown types", async () => {
    await expect(sniffImageType(new Blob(["plain text"]))).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE",
    });
  });
});

describe("validateOutputPdf", () => {
  it("validates real PDF output and page count", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage();
    const bytes = await doc.save();
    await expect(
      validateOutputPdf(bytes, { expectedPageCount: 2 })
    ).resolves.toBeDefined();
  });

  it("fails on page count mismatch", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    await expect(validateOutputPdf(bytes, { expectedPageCount: 5 })).rejects.toMatchObject({
      code: "OUTPUT_INVALID",
    });
  });

  it("fails empty output", async () => {
    await expect(validateOutputPdf(new Uint8Array())).rejects.toMatchObject({
      code: "OUTPUT_INVALID",
    });
  });

  it("fails garbage bytes", async () => {
    const garbage = Uint8Array.from({ length: 500 }, () => Math.floor(Math.random() * 255));
    await expect(validateOutputPdf(garbage)).rejects.toMatchObject({ code: "OUTPUT_INVALID" });
  });
});
