import { createWorkerHandler, type PdfWorkerMessage } from "@paperzero/pdf-operations";
import type { WorkerResponse } from "@paperzero/pdf-core";

const post = (message: WorkerResponse | { type: "cancel"; taskId: string }): void => {
  (self as unknown as {
    postMessage(message: unknown, transfer?: Transferable[]): void;
  }).postMessage(message);
};

const handler = createWorkerHandler(post);

self.onmessage = (event: MessageEvent<PdfWorkerMessage>) => {
  void handler(event.data);
};

export {};
