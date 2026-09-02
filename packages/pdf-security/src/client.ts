import type { LocalDocumentFile, WorkerTaskOptions } from "@paperzero/pdf-core";
import type { WorkerRunner } from "@paperzero/pdf-operations";
import type { WorkerDoneResult } from "@paperzero/pdf-operations";
import type {
  UserPermissions,
  SanitizeOptionsPayload,
  RedactionRect,
} from "./index";

export interface SecurityOutcome {
  files: Array<{ name: string; blob: Blob }>;
  warnings: string[];
}

function toOutcome(result: WorkerDoneResult): SecurityOutcome {
  return {
    files: result.files.map((f) => ({
      name: f.name,
      blob: new Blob([f.bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" }),
    })),
    warnings: result.warnings,
  };
}

async function readBytes(file: LocalDocumentFile): Promise<Uint8Array> {
  const bytes = await file.asUint8Array();
  return bytes.slice();
}

const ctxOf = (
  options: WorkerTaskOptions
): { signal?: AbortSignal; onProgress?: WorkerTaskOptions["onProgress"] } => ({
  signal: options.signal,
  onProgress: options.onProgress,
});

export async function runEncrypt(
  runner: WorkerRunner,
  file: LocalDocumentFile,
  options: {
    userPassword: string;
    ownerPassword?: string;
    permissions?: UserPermissions;
  },
  taskOptions: WorkerTaskOptions = {}
): Promise<SecurityOutcome> {
  const bytes = await readBytes(file);
  const result = await runner.run<WorkerDoneResult>(
    "encrypt",
    { bytes, ...options },
    { ...ctxOf(taskOptions), transfer: [bytes.buffer as ArrayBuffer] }
  );
  return toOutcome(result);
}

export async function runDecryptStrip(
  runner: WorkerRunner,
  file: LocalDocumentFile,
  password: string,
  taskOptions: WorkerTaskOptions = {}
): Promise<SecurityOutcome> {
  const bytes = await readBytes(file);
  const result = await runner.run<WorkerDoneResult>(
    "decrypt-strip",
    { bytes, password },
    { ...ctxOf(taskOptions), transfer: [bytes.buffer as ArrayBuffer] }
  );
  return toOutcome(result);
}

export async function runStripRestrictions(
  runner: WorkerRunner,
  file: LocalDocumentFile,
  password: string | undefined,
  taskOptions: WorkerTaskOptions = {}
): Promise<SecurityOutcome> {
  const bytes = await readBytes(file);
  const result = await runner.run<WorkerDoneResult>(
    "strip-restrictions",
    { bytes, password },
    { ...ctxOf(taskOptions), transfer: [bytes.buffer as ArrayBuffer] }
  );
  return toOutcome(result);
}

export async function runSanitize(
  runner: WorkerRunner,
  file: LocalDocumentFile,
  sanitizeOptions: SanitizeOptionsPayload,
  taskOptions: WorkerTaskOptions = {}
): Promise<SecurityOutcome> {
  const bytes = await readBytes(file);
  const result = await runner.run<WorkerDoneResult>(
    "sanitize",
    { bytes, options: sanitizeOptions },
    { ...ctxOf(taskOptions), transfer: [bytes.buffer as ArrayBuffer] }
  );
  return toOutcome(result);
}

export async function runRedactBuild(
  runner: WorkerRunner,
  file: LocalDocumentFile,
  plan: {
    regions: Array<{ pageIndex: number; rects: RedactionRect[] }>;
    rasters: Array<{ pageIndex: number; bytes: Uint8Array; widthPt: number; heightPt: number }>;
    label?: string;
    overlayColor?: string;
  },
  taskOptions: WorkerTaskOptions = {}
): Promise<SecurityOutcome> {
  const bytes = await readBytes(file);
  const rasters = plan.rasters.map((r) => ({ ...r, bytes: r.bytes.slice() }));
  const transfer = [
    bytes.buffer as ArrayBuffer,
    ...rasters.map((r) => r.bytes.buffer as ArrayBuffer),
  ];
  const result = await runner.run<WorkerDoneResult>(
    "redact-build",
    { bytes, regions: plan.regions, rasters, label: plan.label, overlayColor: plan.overlayColor },
    { ...ctxOf(taskOptions), transfer: [...new Set(transfer)] }
  );
  return toOutcome(result);
}
