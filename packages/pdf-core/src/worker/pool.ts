import { PaperZeroError, type ProgressUpdate } from "@paperzero/shared";

export interface WorkerTaskOptions {
  transfer?: Transferable[];
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (progress: ProgressUpdate) => void;
}

export interface WorkerRequest {
  taskId: string;
  type: "op";
  op: string;
  payload: unknown;
}

export type WorkerResponse =
  | { taskId: string; type: "accepted" }
  | { taskId: string; type: "progress"; progress: ProgressUpdate }
  | { taskId: string; type: "done"; result: unknown }
  | { taskId: string; type: "error"; code: string; message?: string }
  | { taskId: string; type: "cancel-ack" };

interface PendingTask {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  options: WorkerTaskOptions;
  timeoutHandle?: ReturnType<typeof setTimeout>;
  settled: boolean;
}

interface WorkerHandle {
  worker: Worker;
  busy: boolean;
  alive: boolean;
  currentTasks: Set<string>;
}

interface QueuedItem {
  taskId: string;
  request: WorkerRequest;
  options: WorkerTaskOptions;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

export type WorkerFactory = () => Worker;

const CANCEL_GRACE_MS = 400;

export class WorkerPool {
  private handles: WorkerHandle[] = [];
  private pending = new Map<string, PendingTask>();
  private queue: QueuedItem[] = [];
  private nextId = 0;

  constructor(
    private readonly factory: WorkerFactory,
    public readonly maxWorkers: number = 2,
    private readonly defaultTimeoutMs: number = 120_000
  ) {}

  run<T>(op: string, payload: unknown, options: WorkerTaskOptions = {}): Promise<T> {
    if (options.signal?.aborted) {
      return Promise.reject(PaperZeroError.cancelled());
    }
    const taskId = `task_${Date.now().toString(36)}_${(this.nextId++).toString(36)}`;
    const request: WorkerRequest = { taskId, type: "op", op, payload };
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        taskId,
        request,
        options,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.pump();
    });
  }

  private pump(): void {
    while (this.queue.length > 0) {
      let handle = this.handles.find((h) => h.alive && !h.busy);
      if (!handle) {
        if (this.handles.length < this.maxWorkers) {
          handle = this.spawn();
        } else {
          break;
        }
      }
      const item = this.queue.shift()!;
      this.dispatch(handle, item);
    }
  }

  private spawn(): WorkerHandle {
    const worker = this.factory();
    const handle: WorkerHandle = { worker, busy: false, alive: true, currentTasks: new Set() };
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.onMessage(handle, event.data);
    worker.onerror = () =>
      this.failWorker(handle, new PaperZeroError("WORKER_FAILED", "Background processing failed unexpectedly."));
    worker.onmessageerror = () =>
      this.failWorker(handle, new PaperZeroError("WORKER_FAILED", "Worker message could not be decoded."));
    this.handles.push(handle);
    return handle;
  }

  private dispatch(handle: WorkerHandle, item: QueuedItem): void {
    const { taskId, request, options, resolve, reject } = item;
    handle.busy = true;
    handle.currentTasks.add(taskId);
    const pending: PendingTask = { resolve, reject, options, settled: false };
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      pending.timeoutHandle = setTimeout(() => {
        this.settle(taskId, () =>
          reject(new PaperZeroError("TIMEOUT", "The operation took too long and was stopped."))
        );
        this.terminateHandle(handle);
        this.pump();
      }, timeoutMs);
    }
    this.pending.set(taskId, pending);

    const onAbort = () => this.cancel(taskId, handle);
    options.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      handle.worker.postMessage(request, options.transfer ?? []);
    } catch {
      this.settle(taskId, () =>
        reject(new PaperZeroError("WORKER_FAILED", "Could not send data to the background worker."))
      );
      handle.busy = false;
      this.pump();
    }
  }

  private cancel(taskId: string, handle: WorkerHandle): void {
    try {
      handle.worker.postMessage({ type: "cancel", taskId });
    } catch {
      void 0;
    }
    setTimeout(() => {
      const pending = this.pending.get(taskId);
      if (pending && !pending.settled) {
        this.terminateHandle(handle);
        this.pump();
      }
    }, CANCEL_GRACE_MS);
  }

  private onMessage(handle: WorkerHandle, message: WorkerResponse): void {
    if (!message || typeof message.taskId !== "string") return;
    switch (message.type) {
      case "progress":
        this.pending.get(message.taskId)?.options.onProgress?.(message.progress);
        break;
      case "done": {
        const pending = this.pending.get(message.taskId);
        this.settle(message.taskId, () => pending?.resolve(message.result));
        this.release(handle, message.taskId);
        break;
      }
      case "error": {
        const pending = this.pending.get(message.taskId);
        const code = message.code as PaperZeroError["code"];
        this.settle(message.taskId, () => pending?.reject(new PaperZeroError(code, message.message)));
        this.release(handle, message.taskId);
        break;
      }
      case "cancel-ack":
        break;
    }
  }

  private release(handle: WorkerHandle, taskId: string): void {
    handle.currentTasks.delete(taskId);
    if (handle.currentTasks.size === 0) {
      handle.busy = false;
      this.pump();
    }
  }

  private settle(taskId: string, fn: () => void): void {
    const pending = this.pending.get(taskId);
    if (!pending || pending.settled) return;
    pending.settled = true;
    if (pending.timeoutHandle) clearTimeout(pending.timeoutHandle);
    this.pending.delete(taskId);
    fn();
  }

  private failWorker(handle: WorkerHandle, error: PaperZeroError): void {
    for (const taskId of [...handle.currentTasks]) {
      const pending = this.pending.get(taskId);
      this.settle(taskId, () => pending?.reject(error));
    }
    this.removeHandle(handle);
    this.pump();
  }

  private terminateHandle(handle: WorkerHandle): void {
    for (const taskId of [...handle.currentTasks]) {
      const pending = this.pending.get(taskId);
      this.settle(taskId, () => pending?.reject(PaperZeroError.cancelled()));
    }
    this.removeHandle(handle);
  }

  private removeHandle(handle: WorkerHandle): void {
    this.handles = this.handles.filter((h) => h !== handle);
    try {
      handle.alive = false;
      handle.worker.terminate();
    } catch {
      void 0;
    }
  }

  teardown(): void {
    for (const handle of this.handles) this.removeHandle(handle);
    this.handles = [];
    for (const [taskId, pending] of [...this.pending]) {
      this.settle(taskId, () => pending.reject(PaperZeroError.cancelled()));
    }
    this.queue = [];
  }
}
