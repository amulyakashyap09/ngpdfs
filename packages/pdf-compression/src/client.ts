import type { LocalDocumentFile, WorkerTaskOptions } from "@paperzero/pdf-core";
import type {
  CompressionAnalysis,
  CompressionClientResult,
  CompressionOptions,
  CompressionWorkerResult,
} from "./types";

export interface CompressionRunner {
  run<T>(op: string, payload: unknown, options?: WorkerTaskOptions): Promise<T>;
}

async function copyBytes(file: LocalDocumentFile): Promise<Uint8Array> {
  return (await file.asUint8Array()).slice();
}

export async function runCompressionAnalysis(
  runner: CompressionRunner,
  file: LocalDocumentFile,
  taskOptions: WorkerTaskOptions = {}
): Promise<CompressionAnalysis> {
  const bytes = await copyBytes(file);
  return runner.run<CompressionAnalysis>(
    "compression-analyze",
    { bytes },
    { ...taskOptions, transfer: [bytes.buffer as ArrayBuffer], timeoutMs: 60_000 }
  );
}

export async function runCompression(
  runner: CompressionRunner,
  file: LocalDocumentFile,
  options: CompressionOptions,
  taskOptions: WorkerTaskOptions = {}
): Promise<CompressionClientResult> {
  const bytes = await copyBytes(file);
  const result = await runner.run<CompressionWorkerResult>(
    "compress",
    { bytes, options },
    { ...taskOptions, transfer: [bytes.buffer as ArrayBuffer], timeoutMs: 10 * 60_000 }
  );
  return {
    ...result,
    file: result.file
      ? {
          name: result.file.name,
          blob: new Blob([result.file.bytes.slice().buffer as ArrayBuffer], {
            type: "application/pdf",
          }),
        }
      : undefined,
  };
}
