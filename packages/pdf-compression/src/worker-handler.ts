import type { WorkerResponse } from "@paperzero/pdf-core";
import { PaperZeroError, toPaperZeroError, type ProgressUpdate } from "@paperzero/shared";
import { analyzePdfForCompression } from "./analysis";
import { compressPdfWithGhostscript } from "./engine";
import type { CompressionOptions, CompressionWorkerResult } from "./types";

export interface CompressionWorkerMessage {
  taskId?: string;
  type?: string;
  op?: string;
  payload?: unknown;
}

type PostMessageFn = (message: WorkerResponse, transfer?: Transferable[]) => void;

export function createCompressionWorkerHandler(post: PostMessageFn) {
  const cancelled = new Set<string>();
  return async function handle(message: CompressionWorkerMessage): Promise<void> {
    if (!message || typeof message.taskId !== "string") return;
    const taskId = message.taskId;
    if (message.type === "cancel") {
      cancelled.add(taskId);
      post({ taskId, type: "cancel-ack" });
      return;
    }
    if (message.type !== "op") return;

    const throwIfCancelled = () => {
      if (cancelled.has(taskId)) throw PaperZeroError.cancelled();
    };
    const progress = (update: ProgressUpdate) =>
      post({ taskId, type: "progress", progress: update });

    try {
      post({ taskId, type: "accepted" });
      const payload = message.payload as { bytes?: Uint8Array; options?: CompressionOptions };
      if (!(payload?.bytes instanceof Uint8Array)) {
        throw new PaperZeroError("INVALID_INPUT", "Compression received no PDF bytes.");
      }
      if (message.op === "compression-analyze") {
        const result = await analyzePdfForCompression(payload.bytes);
        post({ taskId, type: "done", result });
        return;
      }
      if (message.op !== "compress") {
        throw new PaperZeroError("INVALID_INPUT", `Unknown compression operation "${message.op ?? ""}".`);
      }
      const result = await compressPdfWithGhostscript(
        payload.bytes,
        payload.options ?? { preset: "medium" },
        { progress, throwIfCancelled }
      );
      throwIfCancelled();
      const transfer = result.file ? [result.file.bytes.buffer as ArrayBuffer] : [];
      post({ taskId, type: "done", result }, transfer);
    } catch (error) {
      const normalized = toPaperZeroError(error);
      post({
        taskId,
        type: "error",
        code: normalized.code,
        message: normalized.userMessage,
      });
    } finally {
      cancelled.delete(taskId);
    }
  };
}

export type { CompressionWorkerResult };
