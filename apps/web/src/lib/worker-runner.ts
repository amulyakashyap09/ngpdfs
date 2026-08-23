import { WorkerPool, type WorkerTaskOptions } from "@paperzero/pdf-core";
import type { WorkerRunner } from "@paperzero/pdf-operations";

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

export function getWorkerRunner(): WorkerRunner & {
  run: <T>(op: string, payload: unknown, options?: WorkerTaskOptions) => Promise<T>;
} {
  return getPdfWorkerPool();
}
