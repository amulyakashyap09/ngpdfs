import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PaperZeroError, suggestOutputName } from "@paperzero/shared";
import type { ConversionGuard, ConversionResult, TextAlignment } from "./types";
import { parseCssColor } from "./utils";
import { localName, parseXml, xmlAttribute, xmlChildren, xmlElements, xmlFirst, xmlText, type XmlNode } from "./xml";

const EMU_PER_POINT = 12_700;

interface SlideRelationship { target: string; external: boolean }
interface FontSet { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont }
interface SlideContext {
  archive: JSZip;
  pdf: PDFDocument;
  page: PDFPage;
  pageHeight: number;
  relationships: Map<string, SlideRelationship>;
  theme: Map<string, [number, number, number]>;
  fonts: FontSet;
  sourceFonts: Set<string>;
  replacements: { count: number };
}

export async function convertPptxToPdf(bytes: Uint8Array, sourceName: string, selectedSlides: string[] | undefined, guard: ConversionGuard): Promise<ConversionResult> {
  if (!sourceName.toLowerCase().endsWith(".pptx")) throw new PaperZeroError("UNSUPPORTED_FILE", "PowerPoint conversion currently supports PPTX only. Macro-enabled and legacy presentations are not advertised.");
  if (bytes.byteLength > 120 * 1024 * 1024) throw new PaperZeroError("MEMORY_LIMIT", "PPTX input is limited to 120 MB to protect browser memory.");
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(bytes);
  } catch {
    throw new PaperZeroError("FILE_CORRUPT", "The PPTX Open XML package could not be opened.");
  }
  const presentationFile = archive.file("ppt/presentation.xml");
  if (!presentationFile) throw new PaperZeroError("FILE_CORRUPT", "The PPTX is missing ppt/presentation.xml.");
  const presentation = parseXml(await presentationFile.async("string"));
  const presentationRelationships = await relationshipsFor(archive, "ppt/_rels/presentation.xml.rels", "ppt");
  const size = xmlFirst(presentation, "sldsz");
  const pageWidth = Number(xmlAttribute(size, "cx")) / EMU_PER_POINT || 720;
  const pageHeight = Number(xmlAttribute(size, "cy")) / EMU_PER_POINT || 540;
  const slidePaths = xmlElements(presentation, "sldid").map((slide, index) => ({
    label: String(index + 1),
    path: presentationRelationships.get(xmlAttribute(slide, "r:id") ?? "")?.target ?? `ppt/slides/slide${index + 1}.xml`,
  }));
  const chosen = selectedSlides?.length ? slidePaths.filter((slide) => selectedSlides.includes(slide.label)) : slidePaths;
  if (!chosen.length) throw new PaperZeroError("INVALID_INPUT", "Select at least one slide.");
  if (chosen.length > 250) throw new PaperZeroError("MEMORY_LIMIT", "At most 250 slides can be converted in one browser job.");
  const theme = await readTheme(archive);
  const pdf = await PDFDocument.create();
  const fonts: FontSet = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const sourceFonts = new Set<string>();
  const replacements = { count: 0 };
  let gradientCount = 0;
  let groupedCount = 0;
  let unsupportedFrames = 0;
  let transitionCount = 0;
  for (let index = 0; index < chosen.length; index++) {
    guard.throwIfCancelled();
    guard.progress({ phase: "pptx-slides", completed: index, total: chosen.length, message: `Rendering slide ${chosen[index]!.label}` });
    const slidePath = chosen[index]!.path;
    const slideFile = archive.file(slidePath);
    if (!slideFile) throw new PaperZeroError("FILE_CORRUPT", `Slide ${chosen[index]!.label} is missing from the PPTX package.`);
    const slideSource = await slideFile.async("string");
    gradientCount += (slideSource.match(/<a:gradFill\b/gi) ?? []).length;
    groupedCount += (slideSource.match(/<p:grpSp\b/gi) ?? []).length;
    unsupportedFrames += (slideSource.match(/<p:graphicFrame\b/gi) ?? []).length;
    transitionCount += (slideSource.match(/<p:transition\b|<p:timing\b/gi) ?? []).length;
    const slide = parseXml(slideSource);
    const page = pdf.addPage([pageWidth, pageHeight]);
    const relationships = await relationshipsFor(archive, slideRelationshipsPath(slidePath), dirnameZip(slidePath));
    const context: SlideContext = { archive, pdf, page, pageHeight, relationships, theme, fonts, sourceFonts, replacements };
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(...(slideBackground(slide, theme) ?? [1, 1, 1])) });
    const tree = xmlFirst(slide, "sptree");
    if (tree) await renderShapeChildren(xmlChildren(tree), context);
    await Promise.resolve();
  }
  pdf.setTitle(sourceName.replace(/\.[^.]+$/, ""));
  pdf.setCreator("PaperZero local PPTX conversion");
  pdf.setProducer("PaperZero");
  const output = await pdf.save({ useObjectStreams: true });
  const validated = await PDFDocument.load(output);
  if (validated.getPageCount() !== chosen.length) throw new PaperZeroError("OUTPUT_INVALID", "PPTX page-count validation failed.");
  const warnings: string[] = [];
  if (sourceFonts.size) warnings.push(`Source fonts (${[...sourceFonts].slice(0, 10).join(", ")}${sourceFonts.size > 10 ? ", …" : ""}) use deterministic Helvetica fallbacks.`);
  if (gradientCount) warnings.push(`${gradientCount} gradient fills were approximated with a representative solid color.`);
  if (groupedCount) warnings.push(`${groupedCount} grouped shape containers were traversed without full group-coordinate transforms.`);
  if (unsupportedFrames) warnings.push(`${unsupportedFrames} chart, SmartArt, or embedded-object frames were omitted.`);
  if (transitionCount) warnings.push("Animations and transitions were intentionally omitted from the static PDF.");
  if (replacements.count) warnings.push(`${replacements.count} characters unsupported by the built-in PDF font were replaced.`);
  return {
    files: [{ name: suggestOutputName({ baseNames: [sourceName], suffix: "converted", extension: "pdf" }), bytes: output }],
    warnings,
    report: {
      format: "pptx",
      preserved: ["slide dimensions", "slide order", "background colors", "positioned text boxes", "basic shapes", "line styles", "PNG/JPEG images", "theme colors", "z-order"],
      approximated: ["gradient fills", "source fonts", "mixed text-run styling", "group transforms", "text autofit"],
      omitted: ["master/layout-only objects", "shape rotation and shadows", "animations", "transitions", "speaker notes", ...(unsupportedFrames ? ["charts, SmartArt, and embedded objects"] : [])],
      warnings,
    },
  };
}

async function renderShapeChildren(nodes: XmlNode[], context: SlideContext): Promise<void> {
  for (const node of nodes) {
    const name = localName(node.name);
    if (name === "sp") renderShape(node, context);
    else if (name === "pic") await renderPicture(node, context);
    else if (name === "cxnsp") renderConnector(node, context);
    else if (name === "grpsp") await renderShapeChildren(xmlChildren(node), context);
  }
}

function renderShape(shape: XmlNode, context: SlideContext): void {
  const transform = shapeTransform(shape);
  if (!transform) return;
  const { x, y, width, height } = toPdfRect(transform, context.pageHeight);
  const properties = xmlFirst(shape, "sppr");
  const geometry = xmlAttribute(xmlFirst(properties ?? shape, "prstgeom"), "prst") ?? "rect";
  const fill = solidColor(properties, context.theme) ?? gradientColor(properties, context.theme);
  const line = xmlFirst(properties ?? shape, "ln");
  const lineColor = solidColor(line, context.theme) ?? [0.35, 0.38, 0.42];
  const lineWidth = Math.max(0.5, Number(xmlAttribute(line, "w")) / EMU_PER_POINT || 0.8);
  const noFill = Boolean(properties && xmlFirst(properties, "nofill"));
  const hasText = Boolean(xmlFirst(shape, "txbody"));
  if (geometry === "ellipse") {
    context.page.drawEllipse({ x: x + width / 2, y: y + height / 2, xScale: width / 2, yScale: height / 2, color: noFill ? undefined : rgb(...(fill ?? [0.95, 0.95, 0.95])), borderColor: rgb(...lineColor), borderWidth: lineWidth });
  } else if (!hasText || fill || line) {
    context.page.drawRectangle({ x, y, width, height, color: noFill ? undefined : rgb(...(fill ?? [0.95, 0.95, 0.95])), borderColor: rgb(...lineColor), borderWidth: lineWidth });
  }
  const textBody = xmlFirst(shape, "txbody");
  if (textBody) renderTextBody(textBody, { x, y, width, height }, context);
}

async function renderPicture(picture: XmlNode, context: SlideContext): Promise<void> {
  const transform = shapeTransform(picture);
  const embed = xmlAttribute(xmlFirst(picture, "blip"), "embed");
  const relationship = embed ? context.relationships.get(embed) : undefined;
  if (!transform || !relationship || relationship.external) return;
  const file = context.archive.file(relationship.target);
  if (!file) return;
  const bytes = await file.async("uint8array");
  let image;
  try {
    image = /\.png$/i.test(relationship.target) ? await context.pdf.embedPng(bytes) : /\.(?:jpe?g)$/i.test(relationship.target) ? await context.pdf.embedJpg(bytes) : null;
  } catch {
    return;
  }
  if (!image) return;
  context.page.drawImage(image, toPdfRect(transform, context.pageHeight));
}

function renderConnector(connector: XmlNode, context: SlideContext): void {
  const transform = shapeTransform(connector);
  if (!transform) return;
  const rect = toPdfRect(transform, context.pageHeight);
  const properties = xmlFirst(connector, "sppr");
  const line = xmlFirst(properties ?? connector, "ln");
  const color = solidColor(line, context.theme) ?? [0.25, 0.28, 0.32];
  const width = Math.max(0.5, Number(xmlAttribute(line, "w")) / EMU_PER_POINT || 1);
  context.page.drawLine({ start: { x: rect.x, y: rect.y + rect.height }, end: { x: rect.x + rect.width, y: rect.y }, color: rgb(...color), thickness: width });
}

function renderTextBody(body: XmlNode, rect: { x: number; y: number; width: number; height: number }, context: SlideContext): void {
  let cursorY = rect.y + rect.height - 8;
  for (const paragraph of xmlChildren(body, "p")) {
    const props = xmlChildren(paragraph, "ppr")[0];
    const align = powerpointAlignment(xmlAttribute(props, "algn"));
    const runs = xmlChildren(paragraph).filter((node) => ["r", "fld"].includes(localName(node.name)));
    const paragraphText = runs.length ? runs.map((run) => xmlText(run)).join("") : xmlText(paragraph);
    if (!paragraphText.trim()) { cursorY -= 10; continue; }
    const firstProperties = runs.length ? xmlFirst(runs[0]!, "rpr") : xmlFirst(paragraph, "endpararpr");
    const size = Math.max(6, Math.min(72, Number(xmlAttribute(firstProperties, "sz")) / 100 || 18));
    const bold = xmlAttribute(firstProperties, "b") === "1";
    const italic = xmlAttribute(firstProperties, "i") === "1";
    const font = bold && italic ? context.fonts.boldItalic : bold ? context.fonts.bold : italic ? context.fonts.italic : context.fonts.regular;
    const typeface = xmlAttribute(xmlFirst(firstProperties ?? paragraph, "latin"), "typeface");
    if (typeface && !typeface.startsWith("+")) context.sourceFonts.add(typeface);
    const color = solidColor(firstProperties, context.theme) ?? [0.1, 0.12, 0.16];
    const safe = safeSlideText(paragraphText, font, size);
    context.replacements.count += safe.replacements;
    for (const lineText of wrapSlideText(safe.text, font, size, Math.max(10, rect.width - 12))) {
      const lineHeight = size * 1.18;
      if (cursorY - lineHeight < rect.y) return;
      const lineWidth = font.widthOfTextAtSize(lineText, size);
      let x = rect.x + 6;
      if (align === "center") x = rect.x + (rect.width - lineWidth) / 2;
      if (align === "right") x = rect.x + rect.width - lineWidth - 6;
      context.page.drawText(lineText, { x, y: cursorY - size, size, font, color: rgb(...color), maxWidth: rect.width - 12 });
      cursorY -= lineHeight;
    }
  }
}

function shapeTransform(node: XmlNode): { x: number; y: number; width: number; height: number } | null {
  const transform = xmlFirst(node, "xfrm");
  const offset = xmlFirst(transform ?? node, "off");
  const extent = xmlFirst(transform ?? node, "ext");
  if (!offset || !extent) return null;
  return { x: Number(xmlAttribute(offset, "x")) / EMU_PER_POINT, y: Number(xmlAttribute(offset, "y")) / EMU_PER_POINT, width: Number(xmlAttribute(extent, "cx")) / EMU_PER_POINT, height: Number(xmlAttribute(extent, "cy")) / EMU_PER_POINT };
}

function toPdfRect(rect: { x: number; y: number; width: number; height: number }, pageHeight: number) {
  return { x: rect.x, y: pageHeight - rect.y - rect.height, width: rect.width, height: rect.height };
}

function slideBackground(slide: XmlNode, theme: Map<string, [number, number, number]>): [number, number, number] | undefined {
  return solidColor(xmlFirst(slide, "bgpr"), theme) ?? gradientColor(xmlFirst(slide, "bgpr"), theme);
}

function solidColor(node: XmlNode | undefined, theme: Map<string, [number, number, number]>): [number, number, number] | undefined {
  if (!node) return undefined;
  const solid = localName(node.name) === "solidfill" ? node : xmlFirst(node, "solidfill");
  if (!solid) return undefined;
  const value = xmlAttribute(xmlFirst(solid, "srgbclr"), "val");
  if (value && /^[\da-f]{6}$/i.test(value)) return parseCssColor(`#${value}`);
  const scheme = xmlAttribute(xmlFirst(solid, "schemeclr"), "val")?.toLowerCase();
  return scheme ? theme.get(scheme) : undefined;
}

function gradientColor(node: XmlNode | undefined, theme: Map<string, [number, number, number]>): [number, number, number] | undefined {
  const gradient = node ? xmlFirst(node, "gradfill") : undefined;
  return gradient ? solidColor(xmlFirst(gradient, "gs") ?? gradient, theme) : undefined;
}

async function readTheme(archive: JSZip): Promise<Map<string, [number, number, number]>> {
  const theme = new Map<string, [number, number, number]>([
    ["dk1", [0, 0, 0]], ["lt1", [1, 1, 1]], ["accent1", [0.18, 0.33, 0.58]],
    ["accent2", [0.75, 0.25, 0.22]], ["accent3", [0.61, 0.73, 0.35]], ["accent4", [0.5, 0.38, 0.66]],
  ]);
  const file = archive.file("ppt/theme/theme1.xml");
  if (!file) return theme;
  const root = parseXml(await file.async("string"));
  const scheme = xmlFirst(root, "clrscheme");
  for (const child of xmlChildren(scheme ?? root)) {
    const name = localName(child.name);
    const colorNode = xmlFirst(child, "srgbclr") ?? xmlFirst(child, "sysclr");
    const value = xmlAttribute(colorNode, "val") ?? xmlAttribute(colorNode, "lastClr");
    const color = value && /^[\da-f]{6}$/i.test(value) ? parseCssColor(`#${value}`) : undefined;
    if (color) theme.set(name, color);
  }
  return theme;
}

async function relationshipsFor(archive: JSZip, path: string, base: string): Promise<Map<string, SlideRelationship>> {
  const result = new Map<string, SlideRelationship>();
  const file = archive.file(path);
  if (!file) return result;
  const root = parseXml(await file.async("string"));
  for (const relation of xmlElements(root, "relationship")) {
    const id = xmlAttribute(relation, "Id");
    const target = xmlAttribute(relation, "Target");
    const external = (xmlAttribute(relation, "TargetMode") ?? "").toLowerCase() === "external";
    if (id && target) result.set(id, { target: external ? target : resolveZipPath(base, target), external });
  }
  return result;
}

function slideRelationshipsPath(slidePath: string): string {
  const base = dirnameZip(slidePath);
  return `${base}/_rels/${slidePath.split("/").at(-1)!}.rels`;
}

function dirnameZip(path: string): string { return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "" }

function resolveZipPath(base: string, target: string): string {
  const parts: string[] = [];
  const raw = target.startsWith("/") ? target.slice(1) : `${base}/${target}`;
  for (const part of raw.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function powerpointAlignment(value: string | undefined): TextAlignment {
  if (value === "ctr") return "center";
  if (value === "r") return "right";
  return "left";
}

function wrapSlideText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const explicit of text.split(/\r?\n/)) {
    let line = "";
    for (const word of explicit.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

function safeSlideText(text: string, font: PDFFont, size: number): { text: string; replacements: number } {
  let safe = "";
  let replacements = 0;
  for (const char of text) {
    try { font.widthOfTextAtSize(char, size); safe += char; }
    catch { safe += "?"; replacements++; }
  }
  return { text: safe, replacements };
}
