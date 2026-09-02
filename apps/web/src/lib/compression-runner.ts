import { WorkerPool, type WorkerTaskOptions } from "@paperzero/pdf-core";
import type { CompressionRunner } from "@paperzero/pdf-compression";

let compressionPool: WorkerPool | null = null;

export function getCompressionRunner(): CompressionRunner & {
  run: <T>(op: string, payload: unknown, options?: WorkerTaskOptions) => Promise<T>;
} {
  if (!compressionPool) {
    // Ghostscript is memory intensive. One dedicated worker also guarantees that
    // target-size retries share a single virtual filesystem and engine instance.
    compressionPool = new WorkerPool(
      () =>
        new Worker(new URL("../workers/compression.worker.ts", import.meta.url), {
          type: "module",
          name: "paperzero-compression-worker",
        }),
      1,
      10 * 60_000
    );
  }
  return compressionPool;
}
