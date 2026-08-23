import { WorkerPool } from "@paperzero/pdf-core";

let pool: WorkerPool | null = null;

export function getPdfWorkerPool(): WorkerPool {
  if (!pool) {
    pool = new WorkerPool(
      () =>
        new Worker(new URL("../workers/pdf.worker.ts", import.meta.url), {
          type: "module",
          name: "paperzero-pdf-worker",
        }),
      typeof navigator !== "undefined" && navigator.hardwareConcurrency
        ? Math.min(Math.max(1, navigator.hardwareConcurrency - 1), 4)
        : 2
    );
  }
  return pool;
}
