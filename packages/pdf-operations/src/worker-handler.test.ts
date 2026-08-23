import { describe, expect, it } from "vitest";
import { createWorkerHandler, type WorkerDoneResult } from "./worker-handler";
import type { WorkerResponse } from "@paperzero/pdf-core";
import { createTextPdf } from "./test-fixtures";

function collect() {
  const messages: WorkerResponse[] = [];
  const post = (message: WorkerResponse | { type: "cancel"; taskId: string }): void => {
    messages.push(message as WorkerResponse);
  };
  return { handler: createWorkerHandler(post), messages };
}

async function runOp(op: string, payload: unknown) {
  const { handler, messages } = collect();
  await handler({ taskId: "t1", type: "op", op, payload });
  return messages;
}

describe("createWorkerHandler", () => {
  it("computes sha256 inside the worker protocol", async () => {
    const bytes = new TextEncoder().encode("abc");
    const messages = await runOp("sha256", { bytes });
    const done = messages.find((m) => m.type === "done") as
      | { taskId: string; type: "done"; result: WorkerDoneResult }
      | undefined;
    expect(done).toBeTruthy();
    expect(done!.result.warnings[0]).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("performs a merge end-to-end through the dispatch table", async () => {
    const a = await createTextPdf("A", 1);
    const b = await createTextPdf("B", 2);
    const messages = await runOp("merge", {
      files: [
        { name: "a.pdf", bytes: a.bytes },
        { name: "b.pdf", bytes: b.bytes },
      ],
    });
    const done = messages.find((m) => m.type === "done") as unknown as
      | { result: WorkerDoneResult }
      | undefined;
    expect(done).toBeTruthy();
    expect(done!.result.files[0]!.name).toBe("merged.pdf");
    expect(done!.result.files[0]!.bytes.byteLength).toBeGreaterThan(100);
  });

  it("emits progress and accepted events before done", async () => {
    const a = await createTextPdf("A");
    const b = await createTextPdf("B");
    const messages = await runOp("merge", {
      files: [
        { name: "a.pdf", bytes: a.bytes },
        { name: "b.pdf", bytes: b.bytes },
      ],
    });
    expect(messages[0]?.type).toBe("accepted");
    const types = messages.map((m) => m.type);
    expect(types).toContain("progress");
    expect(types[types.length - 1]).toBe("done");
  });

  it("returns structured error codes for invalid payloads", async () => {
    const fixture = await createTextPdf("x", 2);
    const messages = await runOp("split", {
      bytes: fixture.bytes,
      baseName: "d",
      segments: [{ start: 5, end: 9 }],
    });
    const error = messages.find((m) => m.type === "error");
    expect(error).toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects unknown operations with INVALID_INPUT", async () => {
    const messages = await runOp("does-not-exist", {});
    expect(messages.some((m) => m.type === "error" && m.code === "INVALID_INPUT")).toBe(true);
  });

  it("acknowledges cancel requests", async () => {
    const { handler, messages } = collect();
    await handler({ taskId: "t9", type: "cancel" });
    expect(messages.some((m) => m.type === "cancel-ack" && m.taskId === "t9")).toBe(true);
  });
});
