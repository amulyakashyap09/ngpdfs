import { PDFDocument } from "pdf-lib";
import { PaperZeroError, type ProgressUpdate } from "@paperzero/shared";

export interface OpProgressContext {
  progress?: (progress: ProgressUpdate) => void;
  throwIfCancelled?: () => void;
}

export interface NamedBytes {
  name: string;
  bytes: Uint8Array;
}

export interface OpOutcomePayload {
  files: NamedBytes[];
  warnings: string[];
}

export async function loadPdfLibDocument(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypted/i.test(message)) {
      throw new PaperZeroError(
        "ENCRYPTED_PDF",
        "This PDF is password protected. Remove the password with your PDF viewer first.",
        message
      );
    }
    if (error instanceof PaperZeroError) throw error;
    throw new PaperZeroError(
      "FILE_CORRUPT",
      "This PDF appears to be damaged and could not be processed.",
      message
    );
  }
}

export async function savePdfLibDocument(doc: PDFDocument): Promise<Uint8Array> {
  const out = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  return toExactBytes(out);
}

export function toExactBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes;
  }
  return bytes.slice();
}

export function transferablesOf(files: NamedBytes[]): Transferable[] {
  const buffers = files.map((f) => f.bytes.buffer as ArrayBuffer);
  return [...new Set(buffers)];
}

export function emptyOutcome(warnings: string[] = []): OpOutcomePayload {
  return { files: [], warnings };
}
