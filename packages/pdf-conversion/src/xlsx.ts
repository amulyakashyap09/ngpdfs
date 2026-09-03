import JSZip from "jszip";
import { PaperZeroError } from "@paperzero/shared";
import type { CompatibilityReport, ConversionGuard, DocumentBlock, PortableDocument, TableCell, TextAlignment } from "./types";
import { parseCssColor } from "./utils";
import { parseXml, xmlAttribute, xmlChildren, xmlElements, xmlFirst, xmlText, type XmlNode } from "./xml";

interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  color?: [number, number, number];
  fill?: [number, number, number];
  align?: TextAlignment;
  numberFormat?: string;
}

interface WorkbookSheet {
  name: string;
  path: string;
}

const BUILTIN_FORMATS: Record<number, string> = {
  1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%",
  14: "m/d/yy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm AM/PM",
  19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss", 22: "m/d/yy h:mm",
};

export async function inspectXlsx(bytes: Uint8Array): Promise<string[]> {
  const archive = await openWorkbook(bytes);
  return (await workbookSheets(archive)).map((sheet) => sheet.name);
}

export async function parseXlsx(bytes: Uint8Array, sourceName: string, selectedSheets: string[] | undefined, guard: ConversionGuard): Promise<{ document: PortableDocument; report: CompatibilityReport }> {
  const extension = sourceName.toLowerCase().split(".").at(-1);
  if (extension === "xls") throw new PaperZeroError("UNSUPPORTED_FILE", "Legacy binary .xls is not supported by this local OOXML parser. Use XLSX, or XLSM for displayed values only.");
  if (extension !== "xlsx" && extension !== "xlsm") throw new PaperZeroError("UNSUPPORTED_FILE", "Choose an XLSX workbook, or XLSM for displayed values and styles only.");
  if (bytes.byteLength > 100 * 1024 * 1024) throw new PaperZeroError("MEMORY_LIMIT", "Workbook input is limited to 100 MB to protect browser memory.");
  const archive = await openWorkbook(bytes);
  const allSheets = await workbookSheets(archive);
  const selected = selectedSheets?.length ? allSheets.filter((sheet) => selectedSheets.includes(sheet.name)) : allSheets;
  if (!selected.length) throw new PaperZeroError("INVALID_INPUT", "Select at least one worksheet.");
  if (selected.length > 50) throw new PaperZeroError("MEMORY_LIMIT", "At most 50 worksheets can be converted in one browser job.");
  const strings = await sharedStrings(archive);
  const styles = await workbookStyles(archive);
  const blocks: DocumentBlock[] = [];
  const warnings: string[] = [];
  let formulaCount = 0;
  let missingFormulaCache = 0;
  let mergedCount = 0;
  let truncatedRows = 0;
  let truncatedColumns = 0;
  for (let sheetIndex = 0; sheetIndex < selected.length; sheetIndex++) {
    guard.throwIfCancelled();
    const sheet = selected[sheetIndex]!;
    guard.progress({ phase: "xlsx-sheets", completed: sheetIndex, total: selected.length, message: `Reading worksheet ${sheet.name}` });
    const file = archive.file(sheet.path);
    if (!file) {
      warnings.push(`Worksheet ${sheet.name} is missing from the package.`);
      continue;
    }
    const root = parseXml(await file.async("string"));
    const parsed = parseWorksheet(root, strings, styles);
    formulaCount += parsed.formulaCount;
    missingFormulaCache += parsed.missingFormulaCache;
    mergedCount += parsed.mergedCount;
    truncatedRows += parsed.truncatedRows;
    truncatedColumns += parsed.truncatedColumns;
    if (blocks.length) blocks.push({ kind: "page-break" });
    blocks.push({ kind: "heading", level: 2, runs: [{ text: sheet.name }] });
    const sections = columnSections(parsed.rows, 10);
    sections.forEach((section, index) => {
      if (index > 0) blocks.push({ kind: "page-break" }, { kind: "heading", level: 3, runs: [{ text: `${sheet.name} · columns ${section.start + 1}–${section.end}` }] });
      blocks.push({ kind: "table", rows: section.rows, headerRows: parsed.rows.length > 1 ? 1 : 0, striped: false });
    });
    if (sections.length > 1) warnings.push(`${sheet.name} was split into ${sections.length} horizontal column sections.`);
    await Promise.resolve();
  }
  if (!blocks.length) throw new PaperZeroError("FILE_CORRUPT", "No printable worksheet data was found.");
  if (formulaCount) warnings.push(`${formulaCount} formula cells used cached displayed values; formulas were never executed.`);
  if (missingFormulaCache) warnings.push(`${missingFormulaCache} formula cells lacked cached values and are labeled with their formula text.`);
  if (mergedCount) warnings.push(`${mergedCount} merged ranges retain their top-left value while covered cells remain blank.`);
  if (truncatedRows) warnings.push(`${truncatedRows} rows beyond the 10,000-row-per-sheet limit were omitted.`);
  if (truncatedColumns) warnings.push(`${truncatedColumns} columns beyond column 40 were omitted.`);
  const hasMacros = Boolean(archive.file(/vbaProject\.bin$/i).length);
  if (hasMacros) warnings.push("The XLSM contains VBA. Macros were ignored and never executed.");
  const hasCharts = archive.file(/^xl\/charts\//).length > 0;
  const hasImages = archive.file(/^xl\/media\//).length > 0;
  if (hasCharts) warnings.push("Chart objects were detected but are not rendered by this table-first converter.");
  if (hasImages) warnings.push("Worksheet drawing images were detected but are not anchored by this initial table renderer.");
  return {
    document: { title: sourceName.replace(/\.[^.]+$/, ""), blocks },
    report: {
      format: "xlsx",
      preserved: ["cell displayed values", "cached formula values", "basic number/date formats", "font emphasis/colors", "cell fills", "alignment", "multiple worksheets"],
      approximated: ["column widths", "row heights", "merged ranges", "fit-to-width pagination"],
      omitted: ["formula recalculation", "cell border styling", "macro execution", ...(hasCharts ? ["charts"] : []), ...(hasImages ? ["worksheet images"] : []), "pivot interactions"],
      warnings,
    },
  };
}

async function openWorkbook(bytes: Uint8Array): Promise<JSZip> {
  try {
    const archive = await JSZip.loadAsync(bytes);
    if (!archive.file("xl/workbook.xml")) throw new Error("missing workbook");
    return archive;
  } catch {
    throw new PaperZeroError("FILE_CORRUPT", "The XLSX/XLSM Open XML package could not be opened.");
  }
}

async function workbookSheets(archive: JSZip): Promise<WorkbookSheet[]> {
  const workbookFile = archive.file("xl/workbook.xml");
  if (!workbookFile) return [];
  const root = parseXml(await workbookFile.async("string"));
  const relFile = archive.file("xl/_rels/workbook.xml.rels");
  const relationships = new Map<string, string>();
  if (relFile) {
    const rels = parseXml(await relFile.async("string"));
    for (const relation of xmlElements(rels, "relationship")) {
      const id = xmlAttribute(relation, "Id");
      const target = xmlAttribute(relation, "Target");
      if (id && target) relationships.set(id, normalizeXlPath(target));
    }
  }
  return xmlElements(root, "sheet").map((sheet, index) => {
    const name = xmlAttribute(sheet, "name") ?? "Worksheet";
    const relationId = xmlAttribute(sheet, "r:id") ?? "";
    return { name, path: relationships.get(relationId) ?? `xl/worksheets/sheet${index + 1}.xml` };
  });
}

async function sharedStrings(archive: JSZip): Promise<string[]> {
  const file = archive.file("xl/sharedStrings.xml");
  if (!file) return [];
  const root = parseXml(await file.async("string"));
  return xmlElements(root, "si").map((item) => xmlElements(item, "t").map(xmlText).join(""));
}

async function workbookStyles(archive: JSZip): Promise<CellStyle[]> {
  const file = archive.file("xl/styles.xml");
  if (!file) return [];
  const root = parseXml(await file.async("string"));
  const customFormats = new Map<number, string>();
  for (const format of xmlElements(root, "numfmt")) {
    const id = Number(xmlAttribute(format, "numFmtId"));
    const code = xmlAttribute(format, "formatCode");
    if (Number.isFinite(id) && code) customFormats.set(id, code);
  }
  const fontsRoot = xmlFirst(root, "fonts");
  const fonts = fontsRoot ? xmlChildren(fontsRoot, "font").map((font) => ({
    bold: Boolean(xmlFirst(font, "b")),
    italic: Boolean(xmlFirst(font, "i")),
    color: excelColor(xmlFirst(font, "color")),
  })) : [];
  const fillsRoot = xmlFirst(root, "fills");
  const fills = fillsRoot ? xmlChildren(fillsRoot, "fill").map((fill) => excelColor(xmlFirst(fill, "fgcolor"))) : [];
  const xfsRoot = xmlFirst(root, "cellxfs");
  return xfsRoot ? xmlChildren(xfsRoot, "xf").map((xf) => {
    const font = fonts[Number(xmlAttribute(xf, "fontId") ?? 0)] ?? {};
    const fill = fills[Number(xmlAttribute(xf, "fillId") ?? 0)];
    const formatId = Number(xmlAttribute(xf, "numFmtId") ?? 0);
    const alignment = xmlFirst(xf, "alignment");
    return { ...font, fill, numberFormat: customFormats.get(formatId) ?? BUILTIN_FORMATS[formatId], align: spreadsheetAlignment(xmlAttribute(alignment, "horizontal")) };
  }) : [];
}

function parseWorksheet(root: XmlNode, strings: string[], styles: CellStyle[]): {
  rows: TableCell[][];
  formulaCount: number;
  missingFormulaCache: number;
  mergedCount: number;
  truncatedRows: number;
  truncatedColumns: number;
} {
  const sourceRows = xmlElements(xmlFirst(root, "sheetdata") ?? root, "row");
  const rows: TableCell[][] = [];
  let formulaCount = 0;
  let missingFormulaCache = 0;
  let truncatedColumns = 0;
  for (const row of sourceRows.slice(0, 10_000)) {
    const cells: TableCell[] = [];
    for (const cell of xmlChildren(row, "c")) {
      const column = cellColumn(xmlAttribute(cell, "r") ?? "A1");
      if (column >= 40) {
        truncatedColumns++;
        continue;
      }
      while (cells.length < column) cells.push({ runs: [{ text: "" }] });
      const style = styles[Number(xmlAttribute(cell, "s") ?? 0)] ?? {};
      const formula = xmlFirst(cell, "f");
      const raw = xmlText(xmlFirst(cell, "v"));
      if (formula) formulaCount++;
      if (formula && !raw) missingFormulaCache++;
      const text = cellText(cell, raw, strings, style.numberFormat, formula ? xmlText(formula) : undefined);
      cells[column] = { runs: [{ text, bold: style.bold, italic: style.italic, color: style.color }], fill: style.fill, align: style.align };
    }
    rows.push(cells.length ? cells : [{ runs: [{ text: "" }] }]);
  }
  const width = Math.min(40, Math.max(1, ...rows.map((row) => row.length)));
  rows.forEach((row) => { while (row.length < width) row.push({ runs: [{ text: "" }] }); });
  return {
    rows,
    formulaCount,
    missingFormulaCache,
    mergedCount: xmlElements(root, "mergecell").length,
    truncatedRows: Math.max(0, sourceRows.length - 10_000),
    truncatedColumns,
  };
}

function cellText(cell: XmlNode, raw: string, strings: string[], format: string | undefined, formula: string | undefined): string {
  const type = xmlAttribute(cell, "t");
  if (type === "s") return strings[Number(raw)] ?? "";
  if (type === "inlineStr") return xmlElements(cell, "t").map(xmlText).join("");
  if (type === "b") return raw === "1" ? "TRUE" : "FALSE";
  if (type === "e") return raw || "#ERROR";
  if (!raw && formula) return `=${formula}`;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || !format) return raw;
  if (/[%]/.test(format)) return `${(numeric * 100).toFixed(format.includes(".00") ? 2 : 0)}%`;
  if (/[ymdhis]/i.test(format.replace(/\[[^\]]*]/g, ""))) return excelDate(numeric, /[his]/i.test(format));
  if (format.includes("#,##0")) return numeric.toLocaleString("en-US", { minimumFractionDigits: format.includes(".00") ? 2 : 0, maximumFractionDigits: format.includes(".00") ? 2 : 0 });
  return raw;
}

function excelDate(serial: number, includeTime: boolean): string {
  const milliseconds = Math.round((serial - 25569) * 86_400_000);
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime())) return String(serial);
  const datePart = date.toISOString().slice(0, 10);
  return includeTime ? `${datePart} ${date.toISOString().slice(11, 19)}` : datePart;
}

function columnSections(rows: TableCell[][], size: number): Array<{ start: number; end: number; rows: TableCell[][] }> {
  const width = rows[0]?.length ?? 0;
  const sections = [];
  for (let start = 0; start < width; start += size) {
    const end = Math.min(width, start + size);
    sections.push({ start, end, rows: rows.map((row) => row.slice(start, end)) });
  }
  return sections.length ? sections : [{ start: 0, end: 1, rows: [[{ runs: [{ text: "" }] }]] }];
}

function cellColumn(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

function excelColor(node: XmlNode | undefined): [number, number, number] | undefined {
  const value = xmlAttribute(node, "rgb");
  if (!value) return undefined;
  const hex = value.length === 8 ? value.slice(2) : value;
  return /^[\da-f]{6}$/i.test(hex) ? parseCssColor(`#${hex}`) : undefined;
}

function spreadsheetAlignment(value: string | undefined): TextAlignment | undefined {
  if (value === "center") return "center";
  if (value === "right") return "right";
  if (value === "left") return "left";
  return undefined;
}

function normalizeXlPath(target: string): string {
  const parts: string[] = [];
  const path = target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target}`;
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}
