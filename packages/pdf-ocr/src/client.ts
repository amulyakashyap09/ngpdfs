import type { LocalDocumentFile, WorkerTaskOptions } from "@paperzero/pdf-core";
import type { OcrPageResult } from "./types";

export interface OcrAssemblyRunner {
  run<T>(op: string, payload: unknown, options?: WorkerTaskOptions): Promise<T>;
}

export interface OcrAssemblyResult {
  files: Array<{ name: string; blob: Blob }>;
  warnings: string[];
}

export async function runSearchablePdfAssembly(
  runner: OcrAssemblyRunner,
  file: LocalDocumentFile,
  pages: OcrPageResult[],
  options: WorkerTaskOptions = {}
): Promise<OcrAssemblyResult> {
  const bytes = (await file.asUint8Array()).slice();
  const result = await runner.run<{
    files: Array<{ name: string; bytes: Uint8Array }>;
    warnings: string[];
  }>("ocr-searchable-pdf", { bytes, pages }, {
    ...options,
    transfer: [bytes.buffer as ArrayBuffer],
  });
  return {
    files: result.files.map((output) => ({
      name: output.name,
      blob: new Blob([output.bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" }),
    })),
    warnings: result.warnings,
  };
}
