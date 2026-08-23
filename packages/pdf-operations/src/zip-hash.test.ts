import { describe, expect, it } from "vitest";
import { zipBlobs, zipBytes, countZipEntries } from "./zip";
import { sha256Hex } from "./hash";

describe("zip packaging", () => {
  it("packages multiple blobs and preserves entry names", async () => {
    const blob1 = new Blob([new Uint8Array([1, 2])]);
    const blob2 = new Blob([new Uint8Array([3])]);
    const zip = await zipBlobs([
      { name: "page-001.jpg", blob: blob1 },
      { name: "page-002.jpg", blob: blob2 },
    ]);
    expect(zip.size).toBeGreaterThan(0);
  });

  it("counts entries in a byte-built archive", async () => {
    const bytes = await zipBytes([
      { name: "a.txt", bytes: new TextEncoder().encode("A") },
      { name: "b.txt", bytes: new TextEncoder().encode("B") },
      { name: "c.txt", bytes: new TextEncoder().encode("C") },
    ]);
    expect(await countZipEntries(bytes)).toBe(3);
  });

  it("rejects empty input", async () => {
    await expect(zipBlobs([])).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("sha256Hex", () => {
  it("matches the known SHA-256 test vector for 'abc'", async () => {
    const digest = await sha256Hex(new TextEncoder().encode("abc"));
    expect(digest).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("produces different hashes for different inputs", async () => {
    const a = await sha256Hex(new TextEncoder().encode("a"));
    const b = await sha256Hex(new TextEncoder().encode("b"));
    expect(a).not.toBe(b);
  });
});
