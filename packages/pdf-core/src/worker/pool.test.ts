import { describe, expect, it, vi } from "vitest";
import { WorkerPool } from "./pool";
import type { WorkerResponse } from "./pool";

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  terminated = false;
  received: unknown[] = [];
  autoRespond?: (request: { taskId: string; op: string; payload: unknown }) => void;

  postMessage(message: unknown): void {
    if (this.terminated) return;
    this.received.push(message);
    const request = message as { taskId: string; op: string; payload: unknown };
    if (this.autoRespond) {
      queueMicrotask(() => this.autoRespond!(request));
    }
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(response: WorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<WorkerResponse>);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("WorkerPool", () => {
  it("completes a task with a result", async () => {
    const worker = new FakeWorker();
    worker.autoRespond = ({ taskId }) =>
      worker.respond({ taskId, type: "done", result: { ok: true } });
    const pool = new WorkerPool(() => worker as unknown as Worker, 1);

    const result = await pool.run<{ ok: boolean }>("op", {});
    expect(result.ok).toBe(true);
    pool.teardown();
  });

  it("reports progress before completion", async () => {
    const worker = new FakeWorker();
    worker.autoRespond = ({ taskId }) => {
      worker.respond({ taskId, type: "progress", progress: { phase: "half" } });
      worker.respond({ taskId, type: "done", result: null });
    };
    const pool = new WorkerPool(() => worker as unknown as Worker, 1);
    const onProgress = vi.fn();
    await pool.run("op", {}, { onProgress });
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: "half" }));
    pool.teardown();
  });

  it("rejects with error codes from the worker", async () => {
    const worker = new FakeWorker();
    worker.autoRespond = ({ taskId }) =>
      worker.respond({ taskId, type: "error", code: "ENCRYPTED_PDF", message: "nope" });
    const pool = new WorkerPool(() => worker as unknown as Worker, 1);
    await expect(pool.run("op", {})).rejects.toMatchObject({ code: "ENCRYPTED_PDF" });
    pool.teardown();
  });

  it("cancels tasks via AbortSignal and rejects CANCELLED", async () => {
    const worker = new FakeWorker();
    worker.autoRespond = () => {};
    const pool = new WorkerPool(() => worker as unknown as Worker, 1);
    const controller = new AbortController();
    const promise = pool.run("op", {}, { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: "CANCELLED" });
    pool.teardown();
  });

  it("times out stuck tasks", async () => {
    const worker = new FakeWorker();
    worker.autoRespond = () => {};
    const pool = new WorkerPool(() => worker as unknown as Worker, 1, 50);
    await expect(pool.run("slow-op", {})).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(worker.terminated).toBe(true);
    pool.teardown();
  });

  it("recovers after a worker crash", async () => {
    const first = new FakeWorker();
    const second = new FakeWorker();
    second.autoRespond = ({ taskId }) => second.respond({ taskId, type: "done", result: "recovered" });
    const workers = [first, second];
    const pool = new WorkerPool(() => (workers.shift() ?? new FakeWorker()) as unknown as Worker, 1);

    const crashing = pool.run("op", {});
    await delay(10);
    first.onerror?.(new Error("crash"));
    await expect(crashing).rejects.toBeTruthy();

    const result = await pool.run<string>("op", {});
    expect(result).toBe("recovered");
    pool.teardown();
  });

  it("queues tasks beyond concurrency limit and reuses idle workers", async () => {
    const created: FakeWorker[] = [];
    const pool = new WorkerPool(
      () => {
        const w = new FakeWorker();
        created.push(w);
        return w as unknown as Worker;
      },
      2
    );
    for (const w of created) w.autoRespond = () => {};

    const p1 = pool.run("a", {});
    const p2 = pool.run("b", {});
    const p3 = pool.run("c", {});

    await delay(5);
    expect(created.length).toBe(2);

    const taskIdOf = (worker: FakeWorker, index: number) =>
      (worker.received[index] as { taskId: string }).taskId;

    workerLoop: for (const worker of [created[0]!, created[1]!]) {
      let index = 0;
      while (index < worker.received.length) {
        const taskId = taskIdOf(worker, index);
        worker.respond({ taskId, type: "done", result: taskId });
        index += 1;
        await delay(5);
      }
    }

    const results = await Promise.all([p1, p2, p3]);
    expect(new Set(results).size).toBe(3);
    pool.teardown();
  });
});
