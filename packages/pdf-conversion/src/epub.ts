import JSZip from "jszip";
import { PaperZeroError } from "@paperzero/shared";
import { parseHtml } from "./html";
import type { CompatibilityReport, ConversionGuard, PortableDocument } from "./types";
import { decodeTextBytes } from "./utils";
import { parseXml, xmlAttribute, xmlElements, xmlFirst, xmlText } from "./xml";

interface EpubManifestItem {
  id: string;
  href: string;
  mediaType: string;
}

export async function parseEbook(bytes: Uint8Array, sourceName: string, guard: ConversionGuard): Promise<{ document: PortableDocument; report: CompatibilityReport }> {
  if (bytes.byteLength > 100 * 1024 * 1024) throw new PaperZeroError("MEMORY_LIMIT", "eBook input is limited to 100 MB to protect browser memory.");
  const extension = sourceName.toLowerCase().split(".").at(-1);
  if (extension === "txt") return parseTextEbook(bytes, sourceName);
  if (extension === "html" || extension === "htm") {
    const decoded = decodeTextBytes(bytes);
    const parsed = parseHtml(decoded.text, sourceName.replace(/\.[^.]+$/, ""));
    return { ...parsed, report: { ...parsed.report, format: "epub", warnings: [...parsed.report.warnings, ...(decoded.warning ? [decoded.warning] : [])] } };
  }
  if (extension !== "epub") throw new PaperZeroError("UNSUPPORTED_FILE", "Choose an EPUB, TXT, HTML, or HTM ebook. MOBI and AZW3 are not advertised or parsed.");

  guard.progress({ phase: "epub-open", completed: 0, total: 1, message: "Opening EPUB container" });
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(bytes, { checkCRC32: false });
  } catch {
    throw new PaperZeroError("FILE_CORRUPT", "The EPUB ZIP container could not be opened.");
  }
  const containerFile = archive.file("META-INF/container.xml");
  if (!containerFile) throw new PaperZeroError("FILE_CORRUPT", "The EPUB is missing META-INF/container.xml.");
  const container = parseXml(await containerFile.async("string"));
  const opfPath = xmlAttribute(xmlFirst(container, "rootfile"), "full-path");
  if (!opfPath) throw new PaperZeroError("FILE_CORRUPT", "The EPUB container does not identify a package document.");
  const opfFile = archive.file(normalizeArchivePath(opfPath));
  if (!opfFile) throw new PaperZeroError("FILE_CORRUPT", "The EPUB package document is missing.");
  const opf = parseXml(await opfFile.async("string"));
  const base = dirnameArchive(opfPath);
  const manifest = new Map<string, EpubManifestItem>();
  for (const item of xmlElements(opf, "item")) {
    const id = xmlAttribute(item, "id");
    const href = xmlAttribute(item, "href");
    const mediaType = xmlAttribute(item, "media-type") ?? "";
    if (id && href) manifest.set(id, { id, href, mediaType });
  }
  const spineIds = xmlElements(opf, "itemref").map((item) => xmlAttribute(item, "idref")).filter((value): value is string => Boolean(value));
  if (!spineIds.length) throw new PaperZeroError("FILE_CORRUPT", "The EPUB reading-order spine is empty.");
  if (spineIds.length > 300) throw new PaperZeroError("MEMORY_LIMIT", "EPUBs with more than 300 spine items are not processed in one browser job.");

  const title = xmlText(xmlFirst(opf, "title")).trim() || sourceName.replace(/\.[^.]+$/, "");
  const author = xmlText(xmlFirst(opf, "creator")).trim() || undefined;
  const blocks: PortableDocument["blocks"] = [];
  const warnings: string[] = [];
  let chapterCount = 0;
  for (let index = 0; index < spineIds.length; index++) {
    guard.throwIfCancelled();
    guard.progress({ phase: "epub-chapters", completed: index, total: spineIds.length, message: `Reading chapter ${index + 1}` });
    const item = manifest.get(spineIds[index]!);
    if (!item) {
      warnings.push(`Spine item ${spineIds[index]} is missing from the manifest.`);
      continue;
    }
    const chapterPath = resolveArchivePath(base, item.href.split("#")[0]!);
    const chapterFile = archive.file(chapterPath);
    if (!chapterFile) {
      warnings.push(`Chapter resource ${item.href} is missing.`);
      continue;
    }
    const chapterSource = await chapterFile.async("string");
    const withImages = await inlineChapterImages(chapterSource, archive, dirnameArchive(chapterPath), warnings);
    const chapter = parseHtml(withImages, undefined);
    if (chapterCount > 0) blocks.push({ kind: "page-break" });
    blocks.push(...chapter.document.blocks);
    warnings.push(...chapter.report.warnings.map((warning) => `Chapter ${index + 1}: ${warning}`));
    chapterCount++;
    await Promise.resolve();
  }
  if (!blocks.length) throw new PaperZeroError("FILE_CORRUPT", "No printable EPUB chapters were found.");
  return {
    document: { title, author, blocks },
    report: {
      format: "epub",
      preserved: ["OPF spine order", "chapter boundaries", "headings", "paragraphs", "lists", "tables", "local PNG/JPEG images"],
      approximated: ["basic chapter CSS", "ebook fonts", "widows and orphans"],
      omitted: ["scripts", "interactive media", "DRM", "remote resources"],
      warnings,
    },
  };
}

function parseTextEbook(bytes: Uint8Array, sourceName: string): { document: PortableDocument; report: CompatibilityReport } {
  const decoded = decodeTextBytes(bytes);
  const blocks: PortableDocument["blocks"] = decoded.text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph) => ({ kind: "paragraph" as const, runs: [{ text: paragraph }] }));
  return {
    document: { title: sourceName.replace(/\.[^.]+$/, ""), blocks },
    report: {
      format: "epub",
      preserved: ["plain text paragraphs", "line breaks"],
      approximated: ["chapter structure inferred from blank lines"],
      omitted: [],
      warnings: decoded.warning ? [decoded.warning] : [],
    },
  };
}

async function inlineChapterImages(source: string, archive: JSZip, base: string, warnings: string[]): Promise<string> {
  const matches = [...source.matchAll(/<img\b([^>]*?)\bsrc\s*=\s*(["'])(.*?)\2([^>]*)>/gi)];
  let result = source;
  for (const match of matches.reverse()) {
    const href = match[3]!;
    if (/^data:image\/(?:png|jpeg);base64,/i.test(href)) continue;
    if (/^[a-z][a-z\d+.-]*:/i.test(href)) {
      warnings.push(`Blocked external image ${href.slice(0, 100)}.`);
      continue;
    }
    const resourcePath = resolveArchivePath(base, href.split("#")[0]!);
    const resource = archive.file(resourcePath);
    const mime = /\.png$/i.test(resourcePath) ? "image/png" : /\.(?:jpe?g)$/i.test(resourcePath) ? "image/jpeg" : null;
    if (!resource || !mime) {
      warnings.push(`Unsupported or missing chapter image ${href}.`);
      continue;
    }
    const data = await resource.async("uint8array");
    if (data.byteLength > 12 * 1024 * 1024) {
      warnings.push(`Skipped image ${href} because it exceeds 12 MB.`);
      continue;
    }
    const replacement = `${match[0]!.slice(0, match[0]!.indexOf(href))}data:${mime};base64,${bytesToBase64(data)}${match[0]!.slice(match[0]!.indexOf(href) + href.length)}`;
    result = result.slice(0, match.index) + replacement + result.slice((match.index ?? 0) + match[0]!.length);
  }
  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function dirnameArchive(path: string): string {
  const normalized = normalizeArchivePath(path);
  return normalized.includes("/") ? normalized.slice(0, normalized.lastIndexOf("/")) : "";
}

function resolveArchivePath(base: string, relative: string): string {
  const decoded = decodeURIComponent(relative.replace(/\\/g, "/"));
  return normalizeArchivePath(`${base}/${decoded}`);
}

function normalizeArchivePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/^\/+/, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}
