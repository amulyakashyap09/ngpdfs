import type { WorkerResponse } from "@paperzero/pdf-core";
import { PDFDocument } from "@cantoo/pdf-lib";
import { describe, expect, it } from "vitest";
import { createCompressionWorkerHandler } from "./worker-handler";

describe("compression worker handler", () => {
  it("honors cancellation before starting the native compression pass", async () => {
    const messages: WorkerResponse[] = [];
    const handle = createCompressionWorkerHandler((message) => messages.push(message));
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    const bytes = await doc.save();

    await handle({ taskId: "cancelled-job", type: "cancel" });
    await handle({
      taskId: "cancelled-job",
      type: "op",
      op: "compress",
      payload: { bytes, options: { preset: "medium" } },
    });

    expect(messages).toContainEqual({ taskId: "cancelled-job", type: "cancel-ack" });
    expect(messages).toContainEqual(
      expect.objectContaining({ taskId: "cancelled-job", type: "error", code: "CANCELLED" })
    );
  });

  it("returns a stable malformed-PDF error through the worker protocol", async () => {
    const messages: WorkerResponse[] = [];
    const handle = createCompressionWorkerHandler((message) => messages.push(message));

    await handle({
      taskId: "bad-job",
      type: "op",
      op: "compression-analyze",
      payload: { bytes: new TextEncoder().encode("broken") },
    });

    expect(messages).toContainEqual(
      expect.objectContaining({ taskId: "bad-job", type: "error", code: "FILE_CORRUPT" })
    );
  });
});
