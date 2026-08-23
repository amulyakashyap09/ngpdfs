import { describe, expect, it } from "vitest";
import { runOperation } from "./runner";
import type { DocumentOperation, OperationContext } from "./contract";
import { PaperZeroError } from "@paperzero/shared";

describe("runOperation", () => {
  const makeOp = (): DocumentOperation<number, void, string> => ({
    id: "test-op",
    title: "Test",
    validate: async (input: number) => {
      if (input < 0) throw new PaperZeroError("INVALID_INPUT", "Input must be positive.");
    },
    execute: async (input: number, _options: void, context: OperationContext) => {
      context.onProgress({ phase: "working" });
      return {
        data: `result-${input}`,
        warnings: [],
        stats: { durationMs: 5, inputBytes: input },
      };
    },
  });

  it("validates then executes", async () => {
    const result = await runOperation(makeOp(), 42, undefined as never, {});
    expect(result.data).toBe("result-42");
  });

  it("surfaces validation errors with codes", async () => {
    await expect(runOperation(makeOp(), -1, undefined as never, {})).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("rejects immediately when signal already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runOperation(makeOp(), 1, undefined as never, { signal: controller.signal })
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("aborts mid-flight via external signal", async () => {
    const controller = new AbortController();
    const op: DocumentOperation<number, void, string> = {
      id: "abortable",
      title: "Abortable",
      validate: async () => undefined,
      execute: async (_input: number, _options: void, context: OperationContext) => {
        controller.abort();
        if (context.signal.aborted) throw new DOMException("aborted", "AbortError");
        return { data: "nope", warnings: [], stats: { durationMs: 1, inputBytes: 0 } };
      },
    };
    await expect(
      runOperation(op, 1, undefined as never, { signal: controller.signal })
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });
});
