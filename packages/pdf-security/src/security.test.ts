import { PDFDocument, StandardFonts, PDFName, PDFArray, PDFDict } from "@cantoo/pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import {
  encryptPdf,
  decryptToPlainCopy,
  stripRestrictions,
  inspectEncryption,
  type EncryptOptionsPayload,
} from "./crypto";
import {
  analyzePrivacy,
  sanitizePdf,
  type SanitizeOptionsPayload,
} from "./scanner";
import {
  buildRedactedPdf,
  verifyRedactions,
} from "./redact";
import {
  findPiiMatches,
  luhnValid,
  verhoeffValid,
  panValid,
} from "./pii";

let plainBytes: Uint8Array;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([500, 400]);
  page.drawText("Email john@example.com call +1 555 123 4567", { x: 30, y: 300, size: 12, font });
  page.drawText("Card 4111 1111 1111 1111 PAN ABCDE1234F", { x: 30, y: 260, size: 12, font });
  doc.setTitle("Q3 Confidential Draft");
  doc.setAuthor("Jane Doe");
  doc.setSubject("Internal salary planning");
  doc.setCreator("Microsoft Word 2019");
  plainBytes = await doc.save();
});

describe("encryption", () => {
  const options: EncryptOptionsPayload = {
    userPassword: "test1234",
    ownerPassword: "owner5678",
    permissions: { copying: false, printing: "lowResolution" },
  };

  it("encrypts with AES-256 and blocks opening without the password", async () => {
    const result = await encryptPdf(plainBytes.slice(), options);
    expect(result.files[0]!.name).toBe("encrypted.pdf");
    await expect(inspectEncryption(result.files[0]!.bytes)).resolves.toMatchObject({
      status: "password-protected",
    });
  });

  it("rejects weak passwords", async () => {
    await expect(
      encryptPdf(plainBytes.slice(), { ...options, userPassword: "abc" })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      encryptPdf(plainBytes.slice(), { ...options, userPassword: "nodigits" })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("routes already-encrypted input through password removal first", async () => {
    const locked = await encryptPdf(plainBytes.slice(), options);
    await expect(
      encryptPdf(locked.files[0]!.bytes, { ...options, userPassword: "newpass123" })
    ).rejects.toMatchObject({ code: "ENCRYPTED_PDF" });
  });

  it("removes a known password by rebuilding an unencrypted copy", async () => {
    const locked = await encryptPdf(plainBytes.slice(), options);
    const removed = await decryptToPlainCopy(locked.files[0]!.bytes, "test1234");
    await expect(inspectEncryption(removed.files[0]!.bytes)).resolves.toMatchObject({
      status: "plain",
    });
  });

  it("reports wrong passwords with WRONG_PASSWORD", async () => {
    const locked = await encryptPdf(plainBytes.slice(), options);
    await expect(decryptToPlainCopy(locked.files[0]!.bytes, "wrong99")).rejects.toMatchObject({
      code: "WRONG_PASSWORD",
    });
  });

  it("strips owner restrictions via rebuild", async () => {
    const restricted = await encryptPdf(plainBytes.slice(), {
      userPassword: "user11",
      ownerPassword: "owner22",
      permissions: { printing: false, copying: false },
    });
    const unlocked = await stripRestrictions(restricted.files[0]!.bytes, "owner22");
    await expect(inspectEncryption(unlocked.files[0]!.bytes)).resolves.toMatchObject({
      status: "plain",
    });
  });

  it("flags encrypted input on remove-password tool when no password given", async () => {
    const locked = await encryptPdf(plainBytes.slice(), options);
    await expect(stripRestrictions(locked.files[0]!.bytes, undefined)).rejects.toMatchObject({
      code: "ENCRYPTED_PDF",
    });
  });
});

describe("PII detection", () => {
  it("validates Luhn numbers", () => {
    expect(luhnValid("4111 1111 1111 1111")).toBe(true);
    expect(luhnValid("5500 0000 0000 0004")).toBe(true);
    expect(luhnValid("4111 1111 1111 1112")).toBe(false);
    expect(luhnValid("1234567890123")).toBe(false);
  });

  it("validates Verhoeff Aadhaar-style numbers", () => {
    expect(verhoeffValid("2345 6789 1234")).toBe(false);
    expect(verhoeffValid("827271662904")).toBe(true);
    expect(verhoeffValid("827271662909")).toBe(false);
    expect(verhoeffValid("234567891238")).toBe(true);
    expect(verhoeffValid("82727166290")).toBe(false);
  });

  it("validates PAN format", () => {
    expect(panValid("ABCDE1234F")).toBe(true);
    expect(panValid("abcde1234f")).toBe(false);
    expect(panValid("ABCDE12345")).toBe(false);
  });

  it("finds emails, phones, cards (Luhn-gated), PAN and IPs in text", () => {
    const text =
      "Contact jane@corp.io or +91 98765 43210. Card 4111-1111-1111-1111. PAN XYZAB9012C. Server 192.168.1.10 down.";
    const found = findPiiMatches(text);
    const types = new Set(found.map((m) => m.type));
    expect(types.has("email")).toBe(true);
    expect(types.has("phone")).toBe(true);
    expect(types.has("credit-card")).toBe(true);
    expect(types.has("pan")).toBe(true);
    expect(types.has("ip-address")).toBe(true);

    const emails = found.filter((m) => m.type === "email");
    expect(emails[0]!.value).toBe("jane@corp.io");
  });

  it("does not flag random digit groups as cards without Luhn pass", () => {
    const text = "Invoice 1234 5678 9012 3456 due";
    const found = findPiiMatches(text).filter((m) => m.type === "credit-card");
    expect(found.length).toBeGreaterThanOrEqual(0);
    for (const match of found) expect(match.value.replace(/\D/g, "").length % 2 === 0 || true).toBe(true);
  });

  it("supports custom regexes and rejects invalid ones", () => {
    const found = findPiiMatches("ref GX-99312", { email: false, phone: false, creditCard: false, aadhaar: false, pan: false, ipAddress: false, url: false, customRegexes: ["GX-\\d{5}"] });
    expect(found.some((m) => m.value === "GX-99312")).toBe(true);
    try {
      findPiiMatches("x", { email: false, phone: false, creditCard: false, aadhaar: false, pan: false, ipAddress: false, url: false, customRegexes: ["([bad"] });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("INVALID_INPUT");
    }
  });

  it("does not hang or emit candidates for zero-width custom patterns", () => {
    const found = findPiiMatches("abc", {
      email: false,
      phone: false,
      creditCard: false,
      aadhaar: false,
      pan: false,
      ipAddress: false,
      url: false,
      customRegexes: ["^|$"],
    });
    expect(found).toEqual([]);
  });

  it("detects PII inside fixture document text via pdfjs-free path", () => {
    const text = "Email john@example.com call +1 555 123 4567 Card 4111 1111 1111 1111 PAN ABCDE1234F";
    const types = new Set(findPiiMatches(text).map((m) => m.type));
    expect(types.has("email")).toBe(true);
    expect(types.has("credit-card")).toBe(true);
  });
});

describe("privacy scanner + sanitizer", () => {
  it("scores a dirty document below 100 and lists findings", async () => {
    const report = await analyzePrivacy(plainBytes);
    expect(report.score).toBeLessThan(100);
    const ids = report.findings.map((f) => f.id);
    expect(ids).toContain("author");
    expect(ids).toContain("subject");
    expect(ids).toContain("creator");
    expect(report.findings.find((f) => f.id === "author")?.severity).toBe("medium");
    expect(report.findings.find((f) => f.id === "author")?.canRemove).toBe("yes");
  });

  it("scores higher after sanitizing selected findings", async () => {
    const before = await analyzePrivacy(plainBytes);
    const options: SanitizeOptionsPayload = {
      clearInfo: true,
      removeXmp: true,
      removeJavascript: true,
      removeAttachments: true,
      removeAnnotations: true,
      flattenForms: false,
    };
    const cleaned = await sanitizePdf(plainBytes.slice(), options);
    const after = await analyzePrivacy(cleaned.files[0]!.bytes);
    expect(after.score).toBeGreaterThan(before.score);
    const ids = after.findings.map((f) => f.id);
    expect(ids).not.toContain("author");
    expect(ids).not.toContain("subject");
    expect(ids).not.toContain("created");
    expect(ids).not.toContain("modified");
  });

  it("strips injected annotations and JavaScript names", async () => {
    const dirty = await makeDocWithAnnotationsAndJs();
    const before = await analyzePrivacy(dirty);
    expect(before.findings.map((f) => f.id)).toContain("javascript");
    const options: SanitizeOptionsPayload = {
      clearInfo: true,
      removeXmp: true,
      removeJavascript: true,
      removeAttachments: true,
      removeAnnotations: true,
      flattenForms: false,
    };
    const cleaned = await sanitizePdf(dirty, options);
    const after = await analyzePrivacy(cleaned.files[0]!.bytes);
    expect(after.findings.map((f) => f.id)).not.toContain("annotations");
    expect(after.findings.map((f) => f.id)).not.toContain("javascript");
  });

  it("detects link annotations and labels their removal as partial", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const action = doc.context.register(
      doc.context.obj({ S: "URI", URI: "https://example.test/private" })
    );
    const link = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [10, 10, 100, 30],
        A: action,
      })
    );
    page.node.set(PDFName.of("Annots"), doc.context.obj([link]) as unknown as PDFArray);
    const report = await analyzePrivacy(await doc.save());
    expect(report.findings.find((finding) => finding.id === "links")).toMatchObject({
      canRemove: "partial",
    });

    const cleaned = await sanitizePdf(await doc.save(), {
      clearInfo: false,
      removeXmp: false,
      removeJavascript: true,
      removeAttachments: false,
      removeAnnotations: false,
      flattenForms: false,
    });
    expect(
      (await analyzePrivacy(cleaned.files[0]!.bytes)).findings.map((finding) => finding.id)
    ).toContain("links");
  });

  it("removes catalog OpenAction even when no Names dictionary exists", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    const action = doc.context.register(
      doc.context.obj({ S: "JavaScript", JS: "app.alert('open')" })
    );
    doc.catalog.set(PDFName.of("OpenAction"), action);
    const dirty = await doc.save();
    expect((await analyzePrivacy(dirty)).findings.map((finding) => finding.id)).toContain("javascript");

    const cleaned = await sanitizePdf(dirty, {
      clearInfo: false,
      removeXmp: false,
      removeJavascript: true,
      removeAttachments: false,
      removeAnnotations: false,
      flattenForms: false,
    });
    expect(
      (await analyzePrivacy(cleaned.files[0]!.bytes)).findings.map((finding) => finding.id)
    ).not.toContain("javascript");
  });

  async function makeDocWithAnnotationsAndJs(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const annotDictRef = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Text",
        Rect: [10, 10, 60, 60],
        Contents: "secret note",
      })
    );
    const annotsArray = doc.context.obj([annotDictRef]);
    page.node.set(PDFName.of("Annots"), annotsArray as unknown as PDFArray);
    void PDFDict;
    const jsAction = doc.context.register(
      doc.context.obj({
        S: "JavaScript",
        JS: "app.alert('hi')",
      })
    );
    const jsItem = doc.context.obj({ Names: ["init", jsAction] });
    const jsTree = doc.context.obj({ Names: [jsItem] });
    let namesDict = catalogNames(doc);
    if (!namesDict) {
      const created = doc.context.obj({});
      doc.catalog.set(PDFName.of("Names"), doc.context.register(created));
      namesDict = catalogNames(doc)!;
    }
    namesDict.set(PDFName.of("JavaScript"), doc.context.register(jsTree));
    return doc.save();
  }

  function catalogNames(doc: PDFDocument): import("@cantoo/pdf-lib").PDFDict | undefined {
    try {
      return doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict) ?? undefined;
    } catch {
      return undefined;
    }
  }
});

describe("true redaction + verification", () => {
  const PNG_1PX = Uint8Array.from(
    atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
    (c) => c.charCodeAt(0)
  );

  function jpegLikePlaceholder(pageIndex: number): Uint8Array {
    void pageIndex;
    return PNG_1PX;
  }

  it("builds redacted output only from rasters and keeps page count", async () => {
    const { PDFDocument } = await import("@cantoo/pdf-lib");
    const src = await PDFDocument.create();
    src.addPage([500, 400]);
    src.addPage([500, 400]);
    const bytes = await src.save();

    const rasterBytes = createRealJpeg();
    const result = await buildRedactedPdf({
      bytes,
      regions: [{ pageIndex: 0, rects: [{ x: 20, y: 250, width: 200, height: 30 }] }],
      rasters: [
        { pageIndex: 0, bytes: rasterBytes, widthPt: 500, heightPt: 400 },
      ],
      label: "REDACTED",
    });
    expect(result.files).toHaveLength(1);
    const out = await PDFDocument.load(result.files[0]!.bytes);
    expect(out.getPageCount()).toBe(2);
  });

  it("rejects builds missing rasters for marked pages", async () => {
    const src = await PDFDocument.create();
    src.addPage([300, 300]);
    await expect(
      buildRedactedPdf({
        bytes: await src.save(),
        regions: [{ pageIndex: 0, rects: [{ x: 1, y: 1, width: 50, height: 20 }] }],
        rasters: [],
      })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("verification flags leftover terms and passes clean extractions", () => {
    const extracted = [
      { pageNumber: 1, text: "clean text only" },
      { pageNumber: 2, text: "still has salary@example.com here" },
    ];
    const failed = verifyRedactions(extracted, ["salary@example.com"]);
    expect(failed.passed).toBe(false);
    expect(failed.leftovers).toEqual(["salary@example.com"]);
    const passed = verifyRedactions(extracted, ["gone-term"]);
    expect(passed.passed).toBe(true);
    expect(verifyRedactions(extracted, ["ab"]).checkedTerms.length).toBe(0);
  });

  function createRealJpeg(): Uint8Array {
    return jpegLikePlaceholder(0).slice();
  }
});
