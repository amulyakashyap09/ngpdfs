import { describe, expect, it } from "vitest";
import { sanitizeEvent } from "./analytics";

describe("sanitizeEvent", () => {
  it("keeps allowed dimensions", () => {
    const { sanitized, droppedKeys } = sanitizeEvent({
      toolId: "merge-pdf",
      eventName: "processing_completed",
      deviceClass: "desktop",
      fileSizeBucket: "1-10MB",
      pageCountBucket: "2-10",
      durationBucket: "1-5s",
      success: true,
    });
    expect(droppedKeys).toEqual([]);
    expect(sanitized.toolId).toBe("merge-pdf");
    expect(sanitized.success).toBe(true);
  });

  it("drops sensitive keys like filenames and passwords", () => {
    const { sanitized, droppedKeys } = sanitizeEvent({
      toolId: "merge-pdf",
      eventName: "file_selected",
      filename: "salary-2026.pdf",
      password: "hunter2",
      fileContent: "binary",
      gstin: "22AAAAA0000A1Z5",
      customerName: "John",
      apiKey: "sk-secret",
      documentText: "extracted text",
    });
    expect(sanitized).toMatchObject({ toolId: "merge-pdf" });
    expect(Object.keys(sanitized)).not.toContain("filename");
    expect(droppedKeys).toEqual(
      expect.arrayContaining([
        "filename",
        "password",
        "fileContent",
        "gstin",
        "customerName",
        "apiKey",
        "documentText",
      ])
    );
  });

  it("drops overlong string values", () => {
    const { sanitized, droppedKeys } = sanitizeEvent({
      toolId: "x".repeat(200),
      eventName: "tool_opened",
    });
    expect(droppedKeys).toContain("toolId");
    expect(sanitized.eventName).toBe("tool_opened");
  });
});
