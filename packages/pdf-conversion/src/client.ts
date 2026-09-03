import type { WorkerTaskOptions } from "@paperzero/pdf-core";
import type { BinaryConversionPayload, CompatibilityReport, ConversionPayload } from "./types";

export interface ConversionRunner {
  run<T>(op: string, payload: unknown, options?: WorkerTaskOptions): Promise<T>;
}

export async function runBinaryConversion(
  runner: ConversionRunner,
  payload: BinaryConversionPayload,
  options: WorkerTaskOptions = {}
): Promise<BrowserConversionResult> {
  const bytes = payload.bytes.slice();
  const result = await runner.run<{
    files: Array<{ name: string; bytes: Uint8Array }>;
    warnings: string[];
    report: CompatibilityReport;
  }>("convert-binary-to-pdf", { ...payload, bytes }, { ...options, transfer: [bytes.buffer as ArrayBuffer] });
  return {
    files: result.files.map((file) => ({ name: file.name, blob: new Blob([file.bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" }) })),
    warnings: result.warnings,
    report: result.report,
  };
}

export interface BrowserConversionResult {
  files: Array<{ name: string; blob: Blob }>;
  warnings: string[];
  report: CompatibilityReport;
}

export async function runSourceConversion(
  runner: ConversionRunner,
  payload: ConversionPayload,
  options: WorkerTaskOptions = {}
): Promise<BrowserConversionResult> {
  const result = await runner.run<{
    files: Array<{ name: string; bytes: Uint8Array }>;
    warnings: string[];
    report: CompatibilityReport;
  }>("convert-source-to-pdf", payload, options);
  return {
    files: result.files.map((file) => ({ name: file.name, blob: new Blob([file.bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" }) })),
    warnings: result.warnings,
    report: result.report,
  };
}
