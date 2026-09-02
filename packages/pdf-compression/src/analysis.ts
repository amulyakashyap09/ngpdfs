import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "@cantoo/pdf-lib";
import { PaperZeroError } from "@paperzero/shared";
import type { CompressionAnalysis } from "./types";

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const needle = new TextEncoder().encode(value);
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function countImages(doc: PDFDocument): number {
  const seen = new Set<string>();
  for (const page of doc.getPages()) {
    let resources: PDFDict | undefined;
    try {
      resources = page.node.Resources();
    } catch {
      continue;
    }
    if (!resources) continue;
    const xobjects = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
    if (!xobjects) continue;
    for (const [, value] of xobjects.entries()) {
      try {
        const stream = doc.context.lookup(value) as PDFRawStream | undefined;
        if (!stream?.dict) continue;
        if (stream.dict.lookup(PDFName.of("Subtype"))?.toString() !== "/Image") continue;
        const ref = doc.context.getObjectRef(stream);
        seen.add(ref?.toString() ?? `${page.node.toString()}:${seen.size}`);
      } catch {
        continue;
      }
    }
  }
  return seen.size;
}

export async function analyzePdfForCompression(bytes: Uint8Array): Promise<CompressionAnalysis> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypted|password/i.test(message)) {
      throw new PaperZeroError(
        "ENCRYPTED_PDF",
        "This PDF is password protected. Remove its password before compression.",
        message
      );
    }
    throw new PaperZeroError("FILE_CORRUPT", "This PDF could not be parsed for compression.", message);
  }
  if (doc.isEncrypted) {
    throw new PaperZeroError(
      "ENCRYPTED_PDF",
      "This PDF is encrypted or permission-restricted. Remove its protection before compression."
    );
  }

  const pageCount = doc.getPageCount();
  const imageCount = countImages(doc);
  let hasSignatureFields = false;
  try {
    hasSignatureFields = doc
      .getForm()
      .getFields()
      .some((field) => field.constructor.name === "PDFSignature");
  } catch {
    // A malformed AcroForm should not prevent the rest of preflight from running.
  }
  const hasObjectStreams = containsAscii(bytes, "/ObjStm");
  const hasCompressedStreams =
    containsAscii(bytes, "/FlateDecode") || containsAscii(bytes, "/DCTDecode");
  const bytesPerPage = bytes.byteLength / Math.max(1, pageCount);
  const contentKind =
    imageCount >= Math.max(1, pageCount) ? "image-heavy" : imageCount > 0 ? "mixed" : "text-vector";
  const alreadyOptimized = hasObjectStreams && hasCompressedStreams && bytesPerPage < 300 * 1024;
  const compressibility = alreadyOptimized
    ? "low"
    : contentKind === "image-heavy" || bytesPerPage > 750 * 1024
      ? "high"
      : imageCount > 0 || bytesPerPage > 200 * 1024
        ? "moderate"
        : "low";
  const memoryEstimate = bytes.byteLength * 4 + 64 * 1024 * 1024;
  const memoryRisk = memoryEstimate > 600 * 1024 * 1024
    ? "high"
    : memoryEstimate > 250 * 1024 * 1024
      ? "moderate"
      : "low";
  const workScore = pageCount + bytes.byteLength / (2 * 1024 * 1024);
  const timeClass = workScore > 120 ? "long" : workScore > 25 ? "moderate" : "quick";

  return {
    inputBytes: bytes.byteLength,
    pageCount,
    imageCount,
    contentKind,
    compressibility,
    memoryRisk,
    timeClass,
    alreadyOptimized,
    hasSignatureFields,
    hasObjectStreams,
    hasCompressedStreams,
  };
}
