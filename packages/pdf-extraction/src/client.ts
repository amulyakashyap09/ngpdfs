import type { WorkerTaskOptions } from "@paperzero/pdf-core";
import type { BuiltOutput, PdfExportPayload } from "./types";

export interface PdfExportRunner {
  run<T>(op: string, payload: unknown, options?: WorkerTaskOptions): Promise<T>;
}

export interface BrowserBuiltOutput {
  files: Array<{ name: string; blob: Blob }>;
  warnings: string[];
  compatibility: BuiltOutput["compatibility"];
}

export async function runPdfExport(runner: PdfExportRunner, payload: PdfExportPayload, options: WorkerTaskOptions = {}): Promise<BrowserBuiltOutput> {
  const prepared = payload.format === "pptx"
    ? { ...payload, rasters: payload.rasters.map((raster) => ({ ...raster, bytes: raster.bytes.slice() })) }
    : payload;
  const transfer = prepared.format === "pptx" ? prepared.rasters.map((raster) => raster.bytes.buffer as ArrayBuffer) : [];
  const result = await runner.run<BuiltOutput>("pdf-layout-export", prepared, { ...options, transfer });
  return {
    files: result.files.map((file) => ({ name: file.name, blob: new Blob([file.bytes.slice().buffer as ArrayBuffer], { type: file.mimeType }) })),
    warnings: result.warnings,
    compatibility: result.compatibility,
  };
}
