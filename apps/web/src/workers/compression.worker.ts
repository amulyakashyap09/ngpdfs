import {
  createCompressionWorkerHandler,
  type CompressionWorkerMessage,
} from "@paperzero/pdf-compression/worker";
import type { WorkerResponse } from "@paperzero/pdf-core";

const workerScope = self as unknown as {
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const handler = createCompressionWorkerHandler((message: WorkerResponse, transfer?: Transferable[]) => {
  workerScope.postMessage(message, transfer);
});

self.onmessage = (event: MessageEvent<CompressionWorkerMessage>) => {
  void handler(event.data);
};

export {};
