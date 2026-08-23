import { PaperZeroError } from "@paperzero/shared";
import { LocalDocumentFile, type FileSource } from "./document-file";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, magic: number[], offset = 0): boolean {
  if (bytes.length < offset + magic.length) return false;
  return magic.every((b, i) => bytes[offset + i] === b);
}

export async function readMagicBytes(source: FileSource | LocalDocumentFile, length = 1024): Promise<Uint8Array> {
  let blobLike: Blob;
  if (source instanceof LocalDocumentFile) {
    const src = source.asBlob();
    blobLike = src.slice(0, Math.min(length, src.size));
  } else if (source instanceof Blob) {
    blobLike = source.slice(0, Math.min(length, source.size));
  } else if (source instanceof ArrayBuffer) {
    return new Uint8Array(source.slice(0, Math.min(length, source.byteLength)));
  } else {
    return source.slice(0, Math.min(length, source.byteLength));
  }
  const buf = await blobLike.arrayBuffer();
  return new Uint8Array(buf);
}

export async function validatePdfFile(file: File | LocalDocumentFile): Promise<void> {
  const head = await readMagicBytes(file instanceof LocalDocumentFile ? file : file.slice(0, 1024));
  const searchWindow = head.subarray(0, Math.min(head.length, 1024));
  for (let offset = 0; offset <= searchWindow.length - PDF_MAGIC.length; offset++) {
    if (startsWith(searchWindow, PDF_MAGIC, offset)) {
      return;
    }
  }
  throw new PaperZeroError(
    "UNSUPPORTED_FILE",
    "This does not look like a valid PDF file. Select a document with a .pdf extension."
  );
}

export type ImageKind = "jpeg" | "png" | "webp";

export async function sniffImageType(file: Blob): Promise<ImageKind> {
  const head = await readMagicBytes(file, 16);
  if (startsWith(head, JPEG_MAGIC)) return "jpeg";
  if (startsWith(head, PNG_MAGIC)) return "png";
  const riff = startsWith(head, [0x52, 0x49, 0x46, 0x46]);
  const webp = head.length >= 12 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
  if (riff && webp) return "webp";
  throw new PaperZeroError("UNSUPPORTED_FILE", "Supported image types are JPG, PNG and WebP.");
}

export interface OutputValidationOptions {
  expectedPageCount?: number;
  minBytes?: number;
}

export async function validateOutputPdf(bytes: Uint8Array, options: OutputValidationOptions = {}): Promise<string[]> {
  const warnings: string[] = [];
  if (!bytes || bytes.byteLength === 0) {
    throw new PaperZeroError("OUTPUT_INVALID", "The generated PDF was empty. Please retry.");
  }
  if (!startsWith(bytes, PDF_MAGIC)) {
    throw new PaperZeroError("OUTPUT_INVALID", "The generated file is not a readable PDF.");
  }
  const min = options.minBytes ?? 100;
  if (bytes.byteLength < min) {
    throw new PaperZeroError("OUTPUT_INVALID", "The generated PDF is suspiciously small.");
  }
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    const pages = doc.getPageCount();
    if (options.expectedPageCount !== undefined && pages !== options.expectedPageCount) {
      throw new PaperZeroError(
        "OUTPUT_INVALID",
        `Expected ${options.expectedPageCount} page(s) but produced ${pages}.`
      );
    }
  } catch (error) {
    if (error instanceof PaperZeroError) throw error;
    throw new PaperZeroError("OUTPUT_INVALID", "The generated PDF could not be re-opened for verification.");
  }
  return warnings;
}
