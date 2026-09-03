import JSZip from "jszip";
import { PaperZeroError } from "@paperzero/shared";
import type { CompatibilityReport, ConversionGuard, DocumentBlock, InlineRun, PortableDocument, TableCell, TextAlignment } from "./types";
import { mergeRuns, parseCssColor, safeHref } from "./utils";
import { localName, parseXml, xmlAttribute, xmlChildren, xmlElements, xmlFirst, xmlText, type XmlNode } from "./xml";

interface DocxRelationship {
  target: string;
  external: boolean;
  type: string;
}

interface ParagraphResult {
  block?: DocumentBlock;
  images: DocumentBlock[];
  pageBreakAfter: boolean;
  pageBreakBefore: boolean;
  list?: { ordered: boolean; runs: InlineRun[] };
}

export async function parseDocx(bytes: Uint8Array, sourceName: string, guard: ConversionGuard): Promise<{ document: PortableDocument; report: CompatibilityReport }> {
  if (bytes.byteLength > 100 * 1024 * 1024) throw new PaperZeroError("MEMORY_LIMIT", "DOCX input is limited to 100 MB to protect browser memory.");
  if (!sourceName.toLowerCase().endsWith(".docx")) throw new PaperZeroError("UNSUPPORTED_FILE", "Word conversion currently supports DOCX only. Legacy .doc files need a different local parser and are not advertised.");
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(bytes);
  } catch {
    throw new PaperZeroError("FILE_CORRUPT", "The DOCX ZIP container could not be opened.");
  }
  const documentFile = archive.file("word/document.xml");
  if (!documentFile) throw new PaperZeroError("FILE_CORRUPT", "The DOCX is missing word/document.xml.");
  const documentSource = await documentFile.async("string");
  const root = parseXml(documentSource);
  const relationships = await readRelationships(archive, "word/_rels/document.xml.rels");
  const styles = await readStyles(archive);
  const numbering = await readNumbering(archive);
  const blocks: DocumentBlock[] = [];
  const body = xmlFirst(root, "body");
  if (!body) throw new PaperZeroError("FILE_CORRUPT", "The DOCX document body is missing.");
  const bodyChildren = xmlChildren(body);
  let listBuffer: Extract<DocumentBlock, { kind: "list" }> | null = null;
  const flushList = () => {
    if (listBuffer) blocks.push(listBuffer);
    listBuffer = null;
  };
  for (let index = 0; index < bodyChildren.length; index++) {
    guard.throwIfCancelled();
    guard.progress({ phase: "docx-content", completed: index, total: bodyChildren.length, message: `Reading Word section ${index + 1}` });
    const child = bodyChildren[index]!;
    const name = localName(child.name);
    if (name === "p") {
      const result = await parseParagraph(child, archive, relationships, styles, numbering);
      if (result.pageBreakBefore) {
        flushList();
        blocks.push({ kind: "page-break" });
      }
      if (result.list) {
        if (!listBuffer || listBuffer.ordered !== result.list.ordered) flushList();
        listBuffer ??= { kind: "list", ordered: result.list.ordered, items: [] };
        listBuffer.items.push(result.list.runs);
      } else {
        flushList();
        if (result.block) blocks.push(result.block);
      }
      blocks.push(...result.images);
      if (result.pageBreakAfter) blocks.push({ kind: "page-break" });
    } else if (name === "tbl") {
      flushList();
      const table = parseDocxTable(child, relationships);
      if (table.rows.length) blocks.push(table);
    }
    if (index % 40 === 0) await Promise.resolve();
  }
  flushList();

  const headerFooter = await extractHeaderFooterText(archive, relationships);
  if (headerFooter.headers.length) blocks.unshift({ kind: "quote", runs: [{ text: `Header: ${headerFooter.headers.join(" · ")}`, italic: true }] });
  if (headerFooter.footers.length) blocks.push({ kind: "quote", runs: [{ text: `Footer: ${headerFooter.footers.join(" · ")}`, italic: true }] });

  const unsupported: string[] = [];
  if (/<w:(?:txbxContent|pict)\b/i.test(documentSource)) unsupported.push("floating text boxes and legacy drawing objects");
  if (/<m:oMath\b|<m:oMathPara\b/i.test(documentSource)) unsupported.push("equations");
  if (/<w:(?:smartTag|sdt)\b/i.test(documentSource)) unsupported.push("advanced fields and content controls");
  if (/<w:del\b/i.test(documentSource)) unsupported.push("tracked deletions");
  if (/<w:commentReference\b/i.test(documentSource)) unsupported.push("comments");
  const fonts = new Set(xmlElements(root, "rfonts").flatMap((node) => [xmlAttribute(node, "ascii"), xmlAttribute(node, "hAnsi")]).filter((value): value is string => Boolean(value)));
  const warnings: string[] = [];
  if (fonts.size) warnings.push(`Source fonts (${[...fonts].slice(0, 8).join(", ")}${fonts.size > 8 ? ", …" : ""}) use deterministic Times/Helvetica fallbacks.`);
  if (headerFooter.headers.length || headerFooter.footers.length) warnings.push("Header/footer text is preserved once as labeled content; exact repeated Word positioning is not reproduced.");
  if (!blocks.length) warnings.push("The DOCX contained no supported printable blocks.");
  return {
    document: { title: sourceName.replace(/\.[^.]+$/, ""), blocks },
    report: {
      format: "docx",
      preserved: ["paragraphs", "headings", "bold/italic/underline", "lists", "tables", "inline PNG/JPEG images", "page breaks", "hyperlink appearance"],
      approximated: ["Word pagination", "source fonts and run sizes", "margins", "inline image sizing", ...(headerFooter.headers.length || headerFooter.footers.length ? ["header/footer placement"] : [])],
      omitted: ["table border styling", ...unsupported],
      warnings,
    },
  };
}

async function parseParagraph(
  paragraph: XmlNode,
  archive: JSZip,
  relationships: Map<string, DocxRelationship>,
  styles: Map<string, { name: string; heading?: number }>,
  numbering: Map<string, boolean>
): Promise<ParagraphResult> {
  const properties = xmlChildren(paragraph, "ppr")[0];
  const styleId = xmlAttribute(xmlFirst(properties ?? paragraph, "pstyle"), "val");
  const style = styleId ? styles.get(styleId) : undefined;
  const directRuns = collectParagraphRuns(paragraph, relationships);
  const images: DocumentBlock[] = [];
  for (const blip of xmlElements(paragraph, "blip")) {
    const relationship = relationships.get(xmlAttribute(blip, "embed") ?? "");
    if (!relationship || relationship.external) continue;
    const path = normalizeZipPath(`word/${relationship.target}`);
    const file = archive.file(path);
    const mimeType = /\.png$/i.test(path) ? "image/png" : /\.(?:jpe?g)$/i.test(path) ? "image/jpeg" : null;
    if (!file || !mimeType) continue;
    const imageBytes = await file.async("uint8array");
    if (imageBytes.byteLength <= 12 * 1024 * 1024) images.push({ kind: "image", bytes: imageBytes, mimeType, alt: "Word document image" });
  }
  const pageBreak = xmlElements(paragraph, "br").some((node) => xmlAttribute(node, "type") === "page");
  const pageBreakBefore = Boolean(properties && xmlFirst(properties, "pagebreakbefore"));
  const align = alignmentFromWord(xmlAttribute(xmlFirst(properties ?? paragraph, "jc"), "val"));
  const numberingProperties = properties ? xmlFirst(properties, "numpr") : undefined;
  if (numberingProperties) {
    const numId = xmlAttribute(xmlFirst(numberingProperties, "numid"), "val") ?? "";
    return { images, pageBreakAfter: pageBreak, pageBreakBefore, list: { ordered: numbering.get(numId) ?? false, runs: directRuns } };
  }
  if (!directRuns.some((run) => run.text.trim()) && !images.length) return { images, pageBreakAfter: pageBreak, pageBreakBefore };
  const headingLevel = style?.heading ?? headingFromStyle(style?.name ?? styleId ?? "");
  const block: DocumentBlock | undefined = directRuns.length
    ? headingLevel
      ? { kind: "heading", level: headingLevel as 1 | 2 | 3 | 4 | 5 | 6, runs: directRuns, align }
      : { kind: "paragraph", runs: directRuns, align }
    : undefined;
  return { block, images, pageBreakAfter: pageBreak, pageBreakBefore };
}

function collectParagraphRuns(paragraph: XmlNode, relationships: Map<string, DocxRelationship>): InlineRun[] {
  const runs: InlineRun[] = [];
  const visit = (node: XmlNode, inheritedHref?: string) => {
    for (const child of node.children ?? []) {
      const name = localName(child.name);
      if (name === "del") continue;
      if (name === "hyperlink") {
        const relationship = relationships.get(xmlAttribute(child, "id") ?? "");
        visit(child, relationship?.external ? safeHref(relationship.target) : inheritedHref);
      } else if (name === "r") runs.push(...wordRun(child, inheritedHref));
      else if (["ins", "smarttag", "sdt", "sdtcontent"].includes(name)) visit(child, inheritedHref);
    }
  };
  visit(paragraph);
  return mergeRuns(runs);
}

function wordRun(run: XmlNode, href?: string): InlineRun[] {
  const properties = xmlChildren(run, "rpr")[0];
  const bold = Boolean(properties && xmlFirst(properties, "b"));
  const italic = Boolean(properties && xmlFirst(properties, "i"));
  const underlineNode = properties ? xmlFirst(properties, "u") : undefined;
  const underline = Boolean(underlineNode && xmlAttribute(underlineNode, "val") !== "none");
  const colorValue = properties ? xmlAttribute(xmlFirst(properties, "color"), "val") : undefined;
  const color = colorValue && /^[\da-f]{6}$/i.test(colorValue) ? parseCssColor(`#${colorValue}`) : undefined;
  let text = "";
  for (const child of run.children ?? []) {
    const name = localName(child.name);
    if (name === "t" || name === "instrtext") text += xmlText(child);
    else if (name === "tab") text += "\t";
    else if (name === "br" && xmlAttribute(child, "type") !== "page") text += "\n";
  }
  return text ? [{ text, bold, italic, underline: underline || Boolean(href), color: href ? [0.1, 0.3, 0.75] : color, href }] : [];
}

function parseDocxTable(table: XmlNode, relationships: Map<string, DocxRelationship>): Extract<DocumentBlock, { kind: "table" }> {
  const rows = xmlChildren(table, "tr").map((row) => xmlChildren(row, "tc").map<TableCell>((cell) => {
    const paragraphs = xmlChildren(cell, "p");
    const runs = paragraphs.flatMap((paragraph, index) => [...(index ? [{ text: "\n" }] : []), ...collectParagraphRuns(paragraph, relationships)]);
    const shading = xmlAttribute(xmlFirst(cell, "shd"), "fill");
    return { runs, fill: shading && /^[\da-f]{6}$/i.test(shading) ? parseCssColor(`#${shading}`) : undefined };
  }));
  return { kind: "table", rows, headerRows: 0, striped: false };
}

async function readRelationships(archive: JSZip, path: string): Promise<Map<string, DocxRelationship>> {
  const file = archive.file(path);
  const map = new Map<string, DocxRelationship>();
  if (!file) return map;
  const root = parseXml(await file.async("string"));
  for (const relation of xmlElements(root, "relationship")) {
    const id = xmlAttribute(relation, "Id");
    const target = xmlAttribute(relation, "Target");
    if (id && target) map.set(id, { target, external: (xmlAttribute(relation, "TargetMode") ?? "").toLowerCase() === "external", type: xmlAttribute(relation, "Type") ?? "" });
  }
  return map;
}

async function readStyles(archive: JSZip): Promise<Map<string, { name: string; heading?: number }>> {
  const file = archive.file("word/styles.xml");
  const map = new Map<string, { name: string; heading?: number }>();
  if (!file) return map;
  const root = parseXml(await file.async("string"));
  for (const style of xmlElements(root, "style")) {
    const id = xmlAttribute(style, "styleId");
    if (!id) continue;
    const name = xmlAttribute(xmlFirst(style, "name"), "val") ?? id;
    map.set(id, { name, heading: headingFromStyle(name) });
  }
  return map;
}

async function readNumbering(archive: JSZip): Promise<Map<string, boolean>> {
  const file = archive.file("word/numbering.xml");
  const result = new Map<string, boolean>();
  if (!file) return result;
  const root = parseXml(await file.async("string"));
  const abstract = new Map<string, boolean>();
  for (const definition of xmlElements(root, "abstractnum")) {
    const id = xmlAttribute(definition, "abstractNumId") ?? "";
    const format = xmlAttribute(xmlFirst(definition, "numfmt"), "val") ?? "bullet";
    abstract.set(id, format !== "bullet" && format !== "none");
  }
  for (const num of xmlElements(root, "num")) {
    const id = xmlAttribute(num, "numId");
    const abstractId = xmlAttribute(xmlFirst(num, "abstractnumid"), "val") ?? "";
    if (id) result.set(id, abstract.get(abstractId) ?? false);
  }
  return result;
}

async function extractHeaderFooterText(archive: JSZip, relationships: Map<string, DocxRelationship>): Promise<{ headers: string[]; footers: string[] }> {
  const headers: string[] = [];
  const footers: string[] = [];
  for (const relation of relationships.values()) {
    const target = relation.type.endsWith("/header") ? headers : relation.type.endsWith("/footer") ? footers : null;
    if (!target || relation.external) continue;
    const file = archive.file(normalizeZipPath(`word/${relation.target}`));
    if (!file) continue;
    const root = parseXml(await file.async("string"));
    const text = xmlElements(root, "p").map((paragraph) => collectParagraphRuns(paragraph, relationships).map((run) => run.text).join("")).join(" ").trim();
    if (text) target.push(text);
  }
  return { headers, footers };
}

function headingFromStyle(value: string): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  const match = value.match(/heading\s*([1-6])/i);
  return match ? Number(match[1]) as 1 | 2 | 3 | 4 | 5 | 6 : undefined;
}

function alignmentFromWord(value: string | undefined): TextAlignment | undefined {
  if (value === "center") return "center";
  if (value === "right" || value === "end") return "right";
  if (value === "left" || value === "start") return "left";
  return undefined;
}

function normalizeZipPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}
