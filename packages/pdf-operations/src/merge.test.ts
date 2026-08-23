import { describe, expect, it } from "vitest";
import { countPages, createMixedSizePdf, createTextPdf } from "./test-fixtures";
import { mergePdfBytes } from "./ops/merge";

describe("mergePdfBytes", () => {
  it("merges two documents preserving page counts", async () => {
    const a = await createTextPdf("Document A", 2);
    const b = await createTextPdf("Document B", 3);
    const result = await mergePdfBytes([
      { name: "a.pdf", bytes: a.bytes },
      { name: "b.pdf", bytes: b.bytes },
    ]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.name).toBe("merged.pdf");
    expect(await countPages(result.files[0]!.bytes)).toBe(5);
  });

  it("preserves mixed page sizes and rotations", async () => {
    const mixed = await createMixedSizePdf();
    const plain = await createTextPdf("plain", 1);
    const result = await mergePdfBytes([
      { name: "mixed.pdf", bytes: mixed.bytes },
      { name: "plain.pdf", bytes: plain.bytes },
    ]);
    expect(await countPages(result.files[0]!.bytes)).toBe(4);
  });

  it("rejects fewer than two inputs", async () => {
    const single = await createTextPdf("only");
    await expect(
      mergePdfBytes([{ name: "a.pdf", bytes: single.bytes }])
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects encrypted inputs with ENCRYPTED_PDF code", async () => {
    const plain = await createTextPdf("plain");
    const fakeEncrypted = new TextEncoder().encode(
      "%PDF-1.4 this claims to be encrypted but is really garbage"
    );
    await expect(
      mergePdfBytes([
        { name: "e.pdf", bytes: fakeEncrypted },
        { name: "ok.pdf", bytes: plain.bytes },
      ])
    ).rejects.toMatchObject({ code: "FILE_CORRUPT" });
  });

  it("handles ten source documents", async () => {
    const inputs = [];
    for (let i = 0; i < 10; i++) {
      const fixture = await createTextPdf(`Doc ${i}`, 2);
      inputs.push({ name: `d${i}.pdf`, bytes: fixture.bytes });
    }
    const result = await mergePdfBytes(inputs);
    expect(await countPages(result.files[0]!.bytes)).toBe(20);
  });

  it("reports progress phases", async () => {
    const a = await createTextPdf("A");
    const b = await createTextPdf("B");
    const phases: string[] = [];
    await mergePdfBytes(
      [
        { name: "a.pdf", bytes: a.bytes },
        { name: "b.pdf", bytes: b.bytes },
      ],
      {
        progress: (p) => phases.push(p.phase),
      }
    );
    expect(phases).toContain("reading");
    expect(phases).toContain("saving");
    expect(phases).toContain("validating");
  });
});
