import { describe, expect, it } from "vitest";
import { durationBucket, formatBytes, pageCountBucket, sanitizeFilename, sizeBucket, suggestOutputName } from "./format";

describe("formatBytes", () => {
  it("formats common sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536 * 1024)).toBe("1.5 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });

  it("handles invalid input", () => {
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});

describe("buckets", () => {
  it("size buckets", () => {
    expect(sizeBucket(500 * 1024)).toBe("<1MB");
    expect(sizeBucket(5 * 1024 * 1024)).toBe("1-10MB");
    expect(sizeBucket(30 * 1024 * 1024)).toBe("10-50MB");
    expect(sizeBucket(80 * 1024 * 1024)).toBe("50-100MB");
    expect(sizeBucket(200 * 1024 * 1024)).toBe(">100MB");
  });

  it("page buckets", () => {
    expect(pageCountBucket(1)).toBe("1");
    expect(pageCountBucket(7)).toBe("2-10");
    expect(pageCountBucket(40)).toBe("11-50");
    expect(pageCountBucket(120)).toBe("51-200");
    expect(pageCountBucket(900)).toBe(">200");
  });

  it("duration buckets", () => {
    expect(durationBucket(400)).toBe("<1s");
    expect(durationBucket(3000)).toBe("1-5s");
    expect(durationBucket(9000)).toBe("5-15s");
    expect(durationBucket(30000)).toBe("15-60s");
    expect(durationBucket(90000)).toBe(">60s");
  });
});

describe("sanitizeFilename", () => {
  it("removes path separators and control characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("....etcpasswd");
    expect(sanitizeFilename("report:\u0000 final?.pdf")).toBe("report final.pdf");
  });

  it("falls back for empty names", () => {
    expect(sanitizeFilename("")).toBe("document");
    expect(sanitizeFilename("///")).toBe("document");
  });
});

describe("suggestOutputName", () => {
  it("builds merged names from multiple bases", () => {
    expect(
      suggestOutputName({ baseNames: ["a.pdf", "b.pdf"], suffix: "merged", extension: "pdf" })
    ).toBe("a+b-merged.pdf");
  });

  it("compacts long lists", () => {
    const name = suggestOutputName({
      baseNames: ["1.pdf", "2.pdf", "3.pdf", "4.pdf"],
      suffix: "merged",
      extension: "pdf",
    });
    expect(name).toBe("1+3-more-merged.pdf");
  });

  it("strips original extension and sanitizes", () => {
    expect(
      suggestOutputName({ baseNames: ["my report:final.PDF"], suffix: "compressed", extension: "pdf" })
    ).toBe("my reportfinal-compressed.pdf");
  });

  it("falls back to document when empty", () => {
    expect(suggestOutputName({ baseNames: [], suffix: "out", extension: "zip" })).toBe("document-out.zip");
  });
});
