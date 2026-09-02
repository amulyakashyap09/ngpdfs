import { PDFDocument, PDFName, PDFDict, PDFRawStream, PDFArray } from "@cantoo/pdf-lib";
import { PaperZeroError } from "@paperzero/shared";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { OpProgressContext, NamedBytes } from "./internal";
import { toExactBytes } from "./internal";

export type FindingSeverity = "info" | "low" | "medium" | "high";
export type RemovalSupport = "yes" | "no" | "partial";

export interface PrivacyFinding {
  id: string;
  category: string;
  label: string;
  detail: string;
  severity: FindingSeverity;
  weight: number;
  canRemove: RemovalSupport;
  location?: string;
}

export interface PrivacyReport {
  score: number;
  findings: PrivacyFinding[];
  pageCount: number;
  encrypted: boolean;
}

const WEIGHTS = {
  author: 8,
  subjectKeywords: 8,
  creatorProducer: 5,
  dates: 3,
  title: 2,
  xmp: 10,
  javascript: 15,
  attachments: 12,
  annotations: 6,
  forms: 6,
  signatureFields: 4,
  externalLinks: 4,
  gps: 20,
} as const;

function hasKey(dict: PDFDict | undefined, name: string): boolean {
  if (!dict) return false;
  return dict.has(PDFName.of(name));
}

function lookupDict(dict: PDFDict | undefined, name: string): PDFDict | undefined {
  if (!dict) return undefined;
  const value = dict.lookupMaybe(PDFName.of(name), PDFDict);
  return value ?? undefined;
}

function actionIsJavascript(dict: PDFDict | undefined): boolean {
  return dict?.lookup(PDFName.of("S"))?.toString() === "/JavaScript";
}

function directActionIsJavascript(container: PDFDict, name: string): boolean {
  return actionIsJavascript(lookupDict(container, name));
}

function additionalActionsHaveJavascript(container: PDFDict): boolean {
  const actions = lookupDict(container, "AA");
  if (!actions) return false;
  return actions.keys().some((key) => {
    try {
      return actionIsJavascript(actions.lookupMaybe(key, PDFDict));
    } catch {
      return false;
    }
  });
}

function removeJavascriptActions(container: PDFDict): void {
  const direct = lookupDict(container, "A");
  if (actionIsJavascript(direct)) container.delete(PDFName.of("A"));

  const openAction = lookupDict(container, "OpenAction");
  if (actionIsJavascript(openAction)) container.delete(PDFName.of("OpenAction"));

  const additional = lookupDict(container, "AA");
  if (!additional) return;
  for (const key of additional.keys()) {
    try {
      if (actionIsJavascript(additional.lookupMaybe(key, PDFDict))) additional.delete(key);
    } catch {
      continue;
    }
  }
  if (additional.keys().length === 0) container.delete(PDFName.of("AA"));
}

interface ExifProbeResult {
  hasExif: boolean;
  hasGps: boolean;
}

function probeExifGps(bytes: Uint8Array): ExifProbeResult {
  const result: ExifProbeResult = { hasExif: false, hasGps: false };
  const limit = Math.min(bytes.length - 1, 131072);
  for (let i = 0; i < limit - 6; i++) {
    if (
      bytes[i] === 0x45 && bytes[i + 1] === 0x78 &&
      bytes[i + 2] === 0x69 && bytes[i + 3] === 0x66 &&
      bytes[i + 4] === 0x00 && bytes[i + 5] === 0x00
    ) {
      result.hasExif = true;
      try {
        const tiffStart = i + 6;
        const view = new DataView(bytes.buffer, bytes.byteOffset + tiffStart, bytes.byteLength - tiffStart);
        const little = view.getUint16(0) === 0x4949;
        const ifdOffset = view.getUint32(4, little);
        const ifdStart = tiffStart + ifdOffset;
        const entries = view.getUint16(ifdStart, little);
        for (let e = 0; e < entries; e++) {
          const entryOffset = ifdStart + 2 + e * 12;
          if (entryOffset + 12 > view.byteLength) break;
          const tag = view.getUint16(entryOffset, little);
          if (tag === 0x8825) {
            const gpsOffsetRel = view.getUint32(entryOffset + 8, little);
            const gpsIfdStart = tiffStart + gpsOffsetRel;
            const gpsEntries = view.getUint16(gpsIfdStart, little);
            result.hasGps = gpsEntries > 0;
            break;
          }
        }
      } catch {
        void 0;
      }
      break;
    }
  }
  return result;
}

async function scanEmbeddedImageExif(doc: PDFDocument): Promise<{ imagesChecked: number; withExif: number; withGps: number }> {
  let imagesChecked = 0;
  let withExif = 0;
  let withGps = 0;
  for (const page of doc.getPages()) {
    let resources: PDFDict | undefined;
    try {
      resources = page.node.Resources();
    } catch {
      continue;
    }
    const xobjects = lookupDict(resources, "XObject");
    if (!xobjects) continue;
    for (const [, ref] of xobjects.entries()) {
      try {
        const stream = doc.context.lookup(ref) as unknown as
          | (PDFRawStream & { dict: import("@cantoo/pdf-lib").PDFDict })
          | undefined;
        if (!stream || !stream.dict) continue;
        const subtype = stream.dict.lookup(PDFName.of("Subtype"));
        if (!subtype || subtype.toString() !== "/Image") continue;
        const filter = stream.dict.lookup(PDFName.of("Filter"));
        const filterName = filter instanceof PDFArray ? filter.toString() : String(filter ?? "");
        if (!filterName.includes("DCTDecode")) continue;
        imagesChecked += 1;
        const contents = stream.getContents();
        const probe = probeExifGps(contents);
        if (probe.hasExif) withExif += 1;
        if (probe.hasGps) withGps += 1;
      } catch {
        continue;
      }
    }
  }
  return { imagesChecked, withExif, withGps };
}

export async function analyzePrivacy(bytes: Uint8Array): Promise<PrivacyReport> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false });
  } catch (error) {
    if (/encrypted/i.test(error instanceof Error ? error.message : String(error))) {
      throw new PaperZeroError(
        "ENCRYPTED_PDF",
        "This document is password protected. Remove the password first to scan it."
      );
    }
    throw new PaperZeroError("FILE_CORRUPT", "This PDF could not be parsed.");
  }
  const encrypted = doc.isEncrypted;

  const findings: PrivacyFinding[] = [];
  const add = (f: PrivacyFinding) => findings.push(f);

  const info: Record<string, string | undefined> = {};
  try {
    info.title = doc.getTitle() || undefined;
    info.author = doc.getAuthor() || undefined;
    info.subject = doc.getSubject() || undefined;
    info.keywords = doc.getKeywords() || undefined;
    info.creator = doc.getCreator() || undefined;
    info.producer = doc.getProducer() || undefined;
    info.created = doc.getCreationDate()?.toISOString();
    info.modified = doc.getModificationDate()?.toISOString();
  } catch {
    void 0;
  }

  if (info.author) add({ id: "author", category: "Document properties", label: `Author name: ${info.author}`, detail: "The Author field can identify you or your organisation.", severity: "medium", weight: WEIGHTS.author, canRemove: "yes", location: "Document Info dictionary" });
  if (info.subject) add({ id: "subject", category: "Document properties", label: `Subject: ${info.subject}`, detail: "Subject text may leak context about the document.", severity: "low", weight: WEIGHTS.subjectKeywords, canRemove: "yes", location: "Document Info dictionary" });
  if (info.keywords) add({ id: "keywords", category: "Document properties", label: `Keywords: ${info.keywords}`, detail: "Keyword lists can reveal internal tagging.", severity: "low", weight: WEIGHTS.subjectKeywords, canRemove: "yes", location: "Document Info dictionary" });
  if (info.creator) add({ id: "creator", category: "Software traces", label: `Creator application: ${info.creator}`, detail: "Shows which application produced the file.", severity: "low", weight: WEIGHTS.creatorProducer, canRemove: "yes", location: "Document Info dictionary" });
  if (info.producer && !/paperzero/i.test(info.producer)) add({ id: "producer", category: "Software traces", label: `Producer library: ${info.producer}`, detail: "Shows the last tool that wrote the file.", severity: "low", weight: WEIGHTS.creatorProducer, canRemove: "yes", location: "Document Info dictionary" });
  if (info.created) add({ id: "created", category: "Timestamps", label: `Created ${info.created.slice(0, 19).replace("T", " ")}`, detail: "Creation timestamp reveals when you worked on the file.", severity: "low", weight: WEIGHTS.dates, canRemove: "yes", location: "Document Info dictionary" });
  if (info.modified) add({ id: "modified", category: "Timestamps", label: `Modified ${info.modified.slice(0, 19).replace("T", " ")}`, detail: "Modification timestamp reveals when the file was last written.", severity: "low", weight: WEIGHTS.dates, canRemove: "yes", location: "Document Info dictionary" });
  if (info.title) add({ id: "title", category: "Document properties", label: `Title: ${info.title}`, detail: "Titles often contain draft names.", severity: "info", weight: WEIGHTS.title, canRemove: "yes", location: "Document Info dictionary" });

  const catalog = doc.catalog;
  if (hasKey(catalog, "Metadata")) {
    add({ id: "xmp", category: "Hidden data", label: "XMP metadata packet present", detail: "XMP can hold richer history than the visible properties dialog.", severity: "medium", weight: WEIGHTS.xmp, canRemove: "yes", location: "Catalog /Metadata" });
  }
  let javascriptFound =
    hasKey(lookupDict(catalog, "Names"), "JavaScript") ||
    directActionIsJavascript(catalog, "OpenAction") ||
    additionalActionsHaveJavascript(catalog);
  if (hasKey(lookupDict(catalog, "Names"), "EmbeddedFiles")) {
    add({ id: "attachments", category: "Hidden data", label: "Embedded file attachments present", detail: "Attached files travel inside this PDF.", severity: "high", weight: WEIGHTS.attachments, canRemove: "yes", location: "Catalog /Names /EmbeddedFiles" });
  }

  let annotCount = 0;
  let linkCount = 0;
  for (const page of doc.getPages()) {
    try {
      if (additionalActionsHaveJavascript(page.node)) javascriptFound = true;
      const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      if (!annots) continue;
      annotCount += annots.size();
      for (let i = 0; i < annots.size(); i++) {
        const annot = annots.lookup(i, PDFDict);
        const action = lookupDict(annot, "A");
        const subtype = annot.lookup(PDFName.of("Subtype"));
        const actionType = action?.lookup(PDFName.of("S"));
        if (subtype?.toString() === "/Link" && actionType?.toString() === "/URI") linkCount += 1;
        if (actionType?.toString() === "/JavaScript" || additionalActionsHaveJavascript(annot)) {
          javascriptFound = true;
        }
      }
    } catch {
      continue;
    }
  }
  if (javascriptFound) {
    add({ id: "javascript", category: "Active content", label: "Embedded JavaScript / automatic actions", detail: "Scripts can run when the document is opened. PaperZero never executes them.", severity: "high", weight: WEIGHTS.javascript, canRemove: "partial", location: "Catalog, page, or annotation actions" });
  }
  if (annotCount > 0) add({ id: "annotations", category: "Comments & markup", label: `${annotCount} annotation${annotCount === 1 ? "" : "s"} (comments/highlights)`, detail: "Reviewer comments and markup may contain sensitive notes.", severity: annotCount > 5 ? "medium" : "low", weight: Math.min(WEIGHTS.annotations * 2, WEIGHTS.annotations + annotCount), canRemove: "yes", location: "Page annotation arrays" });
  if (linkCount > 0) add({ id: "links", category: "External references", label: `${linkCount} external hyperlink${linkCount === 1 ? "" : "s"}`, detail: "Links can reveal browsing intent or internal systems. They are removed only when all annotations are removed.", severity: "info", weight: Math.min(8, linkCount), canRemove: "partial", location: "Page link annotations" });

  let formFieldCount = 0;
  let signatureCount = 0;
  try {
    const form = doc.getForm();
    formFieldCount = form.getFields().length;
    signatureCount = form.getFields().filter((f) => f.constructor.name === "PDFSignature").length;
  } catch {
    void 0;
  }
  if (formFieldCount > 0) add({ id: "forms", category: "Interactive content", label: `${formFieldCount} form field${formFieldCount === 1 ? "" : "s"} (may hold typed values)`, detail: "Saved form values can contain personal information. Flattening preserves appearances but removes interactivity.", severity: "medium", weight: WEIGHTS.forms, canRemove: "partial", location: "AcroForm field tree" });
  if (signatureCount > 0) add({ id: "signature-fields", category: "Interactive content", label: `${signatureCount} digital signature field${signatureCount === 1 ? "" : "s"}`, detail: "Signature fields identify signers; any document rewrite normally invalidates cryptographic signatures.", severity: "info", weight: WEIGHTS.signatureFields, canRemove: "partial", location: "AcroForm signature fields" });

  try {
    const exifScan = await scanEmbeddedImageExif(doc);
    if (exifScan.withGps > 0) {
      add({ id: "gps", category: "Location data", label: `GPS coordinates found in ${exifScan.withGps} embedded image${exifScan.withGps === 1 ? "" : "s"}`, detail: "Photo location can pinpoint where scans/photos were taken. Detection is best-effort; the current sanitizer does not rewrite embedded images.", severity: "high", weight: WEIGHTS.gps, canRemove: "no", location: "Embedded JPEG EXIF" });
    } else if (exifScan.withExif > 0) {
      add({ id: "exif", category: "Location data", label: `EXIF metadata in ${exifScan.withExif} embedded image${exifScan.withExif === 1 ? "" : "s"} (no GPS detected)`, detail: "Camera/model metadata is present. The current sanitizer does not rewrite embedded images.", severity: "info", weight: 2, canRemove: "no", location: "Embedded JPEG EXIF" });
    }
  } catch {
    void 0;
  }

  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  const score = Math.max(0, 100 - totalWeight);

  return {
    score,
    findings: findings.sort((a, b) => b.weight - a.weight),
    pageCount: doc.getPageCount(),
    encrypted,
  };
}

export interface SanitizeOptionsPayload {
  clearInfo: boolean;
  removeXmp: boolean;
  removeJavascript: boolean;
  removeAttachments: boolean;
  removeAnnotations: boolean;
  flattenForms: boolean;
}

export async function sanitizePdf(
  bytes: Uint8Array,
  options: SanitizeOptionsPayload,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false });
  const warnings: string[] = [];
  let hadSignatures = false;
  try {
    hadSignatures = doc.getForm().getFields().some((field) => field.constructor.name === "PDFSignature");
  } catch {
    void 0;
  }

  if (options.flattenForms) {
    try {
      const form = doc.getForm();
      if (form.getFields().length > 0) {
        form.updateFieldAppearances();
        form.flatten();
        warnings.push("Form answers were flattened into the pages.");
      }
    } catch {
      warnings.push("Forms could not be flattened and were left unchanged.");
    }
  }

  ctx.progress?.({ phase: "cleaning", message: "Removing selected categories" });
  const catalog = doc.catalog;

  if (options.clearInfo) {
    const info = doc.context.lookupMaybe(doc.context.trailerInfo.Info, PDFDict);
    if (info) {
      for (const key of ["Title", "Author", "Subject", "Keywords", "Creator", "Producer", "CreationDate", "ModDate", "Trapped"]) {
        info.delete(PDFName.of(key));
      }
    }
  }

  if (options.removeXmp && catalog.has(PDFName.of("Metadata"))) {
    catalog.delete(PDFName.of("Metadata"));
  }

  const namesDict = lookupSafe(catalog, "Names");
  if (options.removeJavascript) {
    if (namesDict) {
      namesDict.delete(PDFName.of("JavaScript"));
    }
    removeJavascriptActions(catalog);
    for (const page of doc.getPages()) {
      removeJavascriptActions(page.node);
      const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      if (!annots) continue;
      for (let i = 0; i < annots.size(); i++) {
        try {
          const annot = annots.lookup(i, PDFDict);
          removeJavascriptActions(annot);
        } catch {
          continue;
        }
      }
    }
  }
  if (namesDict) {
    if (options.removeAttachments && namesDict.has(PDFName.of("EmbeddedFiles"))) {
      namesDict.delete(PDFName.of("EmbeddedFiles"));
    }
  }

  if (options.removeAnnotations) {
    let removed = 0;
    for (const page of doc.getPages()) {
      try {
        if (page.node.has(PDFName.of("Annots"))) {
          page.node.delete(PDFName.of("Annots"));
          removed += 1;
        }
      } catch {
        continue;
      }
    }
    if (removed > 0) warnings.push(`Removed comment/markup annotations from ${removed} page(s).`);
  }

  warnings.push("Basic property fields, XMP and name-tree removal covers common traces; exotic hidden structures may remain.");
  if (hadSignatures) {
    warnings.push("This input contains signature fields. Sanitizing it normally invalidates existing cryptographic signatures.");
  }

  if (!options.clearInfo) doc.setProducer("PaperZero");
  const outBytes = toExactBytes(await doc.save());
  await validateOutputPdf(outBytes, { expectedPageCount: doc.getPageCount() });

  return { files: [{ name: "sanitized.pdf", bytes: outBytes }], warnings };
}

function lookupSafe(dict: import("@cantoo/pdf-lib").PDFDict, name: string): import("@cantoo/pdf-lib").PDFDict | undefined {
  try {
    return dict.lookupMaybe(PDFName.of(name), PDFDict) ?? undefined;
  } catch {
    return undefined;
  }
}
