import { describe, expect, it } from "vitest";
import { PaperZeroError, isCancelled, toPaperZeroError } from "./errors";

describe("PaperZeroError", () => {
  it("provides user-safe recovery messages", () => {
    const error = new PaperZeroError("ENCRYPTED_PDF");
    expect(error.userMessage).toContain("password protected");
    expect(error.code).toBe("ENCRYPTED_PDF");
  });

  it("allows custom user messages", () => {
    const error = new PaperZeroError("INVALID_INPUT", "Enter a page range.");
    expect(error.userMessage).toBe("Enter a page range.");
  });
});

describe("isCancelled", () => {
  it("identifies cancellation errors", () => {
    expect(isCancelled(PaperZeroError.cancelled())).toBe(true);
    expect(isCancelled(new PaperZeroError("INVALID_INPUT"))).toBe(false);
    expect(isCancelled(new Error("abort"))).toBe(false);
  });
});

describe("toPaperZeroError", () => {
  it("passes through existing errors", () => {
    const original = new PaperZeroError("FILE_CORRUPT");
    expect(toPaperZeroError(original)).toBe(original);
  });

  it("maps AbortError DOMException to CANCELLED", () => {
    const domError = new DOMException("The operation was aborted.", "AbortError");
    expect(toPaperZeroError(domError).code).toBe("CANCELLED");
  });

  it("maps encrypted library errors", () => {
    expect(toPaperZeroError(new Error("Input document is encrypted")).code).toBe("ENCRYPTED_PDF");
  });

  it("wraps unknown errors without leaking internals in userMessage", () => {
    const mapped = toPaperZeroError(new Error("secret internal stack detail"));
    expect(mapped.code).toBe("UNKNOWN");
    expect(mapped.userMessage).not.toContain("secret internal stack detail");
  });
});
