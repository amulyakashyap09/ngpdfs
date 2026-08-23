import { PaperZeroError } from "@paperzero/shared";
import type { LocalDocumentFile } from "@paperzero/pdf-core";
import type { WorkerPool, WorkerTaskOptions } from "@paperzero/pdf-core";
import type { PageRangeSegment } from "@paperzero/shared";
import type { NinePosition } from "./positions";
import type { PageNumberAlign, PageNumberFormat, PageNumberPosition } from "./ops/pagenumbers";
import type { ImagesToPdfOptionsPayload } from "./ops/imagestopdf";
import type { WorkerDoneResult } from "./worker-handler";

export interface WorkerRunner {
  run<T>(op: string, payload: unknown, options?: WorkerTaskOptions): Promise<T>;
}

export function poolAsRunner(pool: WorkerPool): WorkerRunner {
  return {
    run: <T,>(op: string, payload: unknown, options?: WorkerTaskOptions) =>
      pool.run<T>(op, payload, options),
  };
}

export interface OutputFile {
  name: string;
  blob: Blob;
}

export interface OperationOutcome {
  files: OutputFile[];
  warnings: string[];
}

function toOutputFiles(result: WorkerDoneResult): OutputFile[] {
  return result.files.map((file) => ({
    name: file.name,
    blob: new Blob([file.bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" }),
  }));
}

async function readBytes(file: LocalDocumentFile): Promise<Uint8Array> {
  const bytes = await file.asUint8Array();
  return bytes.slice();
}

export async function runMerge(
  runner: WorkerRunner,
  files: LocalDocumentFile[],
  options: { signal?: AbortSignal; onProgress?: WorkerTaskOptions["onProgress"] }
): Promise<OperationOutcome> {
  if (files.length < 2) throw new PaperZeroError("INVALID_INPUT", "Select at least two PDF files to merge.");
  const payloads = [];
  for (const file of files) {
    payloads.push({ name: file.meta.name, bytes: await readBytes(file) });
  }
  const transfer = payloads.map((p) => p.bytes.buffer as ArrayBuffer);
  const result = await runner.run<WorkerDoneResult>("merge", { files: payloads }, {
    ...options,
    transfer,
  });
  return { files: toOutputFiles(result), warnings: result.warnings };
}

export async function runSplit(
  runner: WorkerRunner,
  file: LocalDocumentFile,
  segments: PageRangeSegment[],
  options: { signal?: AbortSignal; onProgress?: WorkerTaskOptions["onProgress"] }
): Promise<OperationOutcome> {
  const bytes = await readBytes(file);
  const result = await runner.run<WorkerDoneResult>(
    "split",
    { bytes, baseName: file.meta.name, segments },
    { ...options, transfer: [bytes.buffer as ArrayBuffer] }
  );
  return { files: toOutputFiles(result), warnings: result.warnings };
}

export async function runOrganize(
  runner: WorkerRunner,
  file: LocalDocumentFile,
  descriptors: Array<{ index: number; rotateDelta: number }>,
  options: { signal?: AbortSignal; onProgress?: WorkerTaskOptions["onProgress"] }
): Promise<OperationOutcome> {
  const bytes = await readBytes(file);
  const result = await runner.run<WorkerDoneResult>(
    "organize",
    { bytes, descriptors },
    { ...options, transfer: [bytes.buffer as ArrayBuffer] }
  );
  return { files: toOutputFiles(result), warnings: result.warnings };
}

export async function runTextWatermark(
  runner: WorkerRunner,
  file: LocalDocumentFile,
  watermark: {
    text: string;
    fontSize: number;
    opacity: number;
    rotationDeg: number;
    color: [number, number, number];
    position: NinePosition;
    pages: number[];
  },
  options: { signal?: AbortSignal; onProgress?: WorkerTaskOptions["onProgress"] }
): Promise<OperationOutcome> {
  const bytes = await readBytes(file);
  const result = await runner.run<WorkerDoneResult>(
    "watermark-text",
    { bytes, options: watermark },
    { ...options, transfer: [bytes.buffer as ArrayBuffer] }
  );
  return { files: toOutputFiles(result), warnings: result.warnings };
}

export async function runImageWatermark(
  runner: WorkerRunner,
  file: LocalDocumentFile,
  image: { bytes: Uint8Array; type: "png" | "jpeg" },
  watermark: {
    scaleFraction: number;
    opacity: number;
    rotationDeg: number;
    position: NinePosition;
    pages: number[];
  },
  options: { signal?: AbortSignal; onProgress?: WorkerTaskOptions["onProgress"] }
): Promise<OperationOutcome> {
  const bytes = await readBytes(file);
  const imageBytes = image.bytes.slice();
  const result = await runner.run<WorkerDoneResult>(
    "watermark-image",
    { bytes, imageBytes, options: watermark },
    {
      ...options,
      transfer: [
        bytes.buffer as ArrayBuffer,
        imageBytes.buffer as ArrayBuffer,
      ],
    }
  );
  return { files: toOutputFiles(result), warnings: result.warnings };
}

export async function runPageNumbers(
  runner: WorkerRunner,
  file: LocalDocumentFile,
  numbering: {
    position: PageNumberPosition;
    align: PageNumberAlign;
    startNumber: number;
    prefix: string;
    suffix: string;
    format: PageNumberFormat;
    fontSize: number;
    skipFirst: boolean;
    pages: number[];
  },
  options: { signal?: AbortSignal; onProgress?: WorkerTaskOptions["onProgress"] }
): Promise<OperationOutcome> {
  const bytes = await readBytes(file);
  const result = await runner.run<WorkerDoneResult>(
    "page-numbers",
    { bytes, options: numbering },
    { ...options, transfer: [bytes.buffer as ArrayBuffer] }
  );
  return { files: toOutputFiles(result), warnings: result.warnings };
}

export async function runRemoveMetadata(
  runner: WorkerRunner,
  file: LocalDocumentFile,
  options: { signal?: AbortSignal; onProgress?: WorkerTaskOptions["onProgress"] }
): Promise<OperationOutcome> {
  const bytes = await readBytes(file);
  const result = await runner.run<WorkerDoneResult>(
    "remove-metadata",
    { bytes },
    { ...options, transfer: [bytes.buffer as ArrayBuffer] }
  );
  return { files: toOutputFiles(result), warnings: result.warnings };
}

export async function runImagesToPdf(
  runner: WorkerRunner,
  images: Array<{ name: string; bytes: Uint8Array; type: "jpeg" | "png"; widthPx: number; heightPx: number }>,
  layout: ImagesToPdfOptionsPayload,
  options: { signal?: AbortSignal; onProgress?: WorkerTaskOptions["onProgress"] }
): Promise<OperationOutcome> {
  const prepared = images.map((img) => ({ ...img, bytes: img.bytes.slice() }));
  const transfer = [...new Set(prepared.map((p) => p.bytes.buffer as ArrayBuffer))];
  const result = await runner.run<WorkerDoneResult>(
    "images-to-pdf",
    { images: prepared, options: layout },
    { ...options, transfer }
  );
  return { files: toOutputFiles(result), warnings: result.warnings };
}

export async function runSha256(
  runner: WorkerRunner,
  bytes: Uint8Array,
  options: { signal?: AbortSignal; onProgress?: WorkerTaskOptions["onProgress"] } = {}
): Promise<string> {
  const copy = bytes.slice();
  const result = await runner.run<{ files: Array<{ name: string; bytes: Uint8Array }>; warnings: string[] }>(
    "sha256",
    { bytes: copy },
    { ...options, transfer: [copy.buffer as ArrayBuffer] }
  );
  return result.warnings[0] ?? "";
}
