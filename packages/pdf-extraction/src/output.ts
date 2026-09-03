import JSZip from "jszip";
import { PaperZeroError, suggestOutputName } from "@paperzero/shared";
import type { AnalyzedPdf, BuildGuard, BuiltOutput, DetectedTable, LayoutBlock, PageRaster, PdfExportPayload } from "./types";

export async function buildPdfExport(payload: PdfExportPayload, guard: BuildGuard): Promise<BuiltOutput> {
  guard.throwIfCancelled();
  switch (payload.format) {
    case "docx": return buildDocx(payload.document, payload.sourceName, payload.includePageBreaks, guard);
    case "xlsx": return buildXlsx(payload.document, payload.sourceName, payload.selectedTableIds, guard);
    case "pptx": return buildPptx(payload.document, payload.sourceName, payload.rasters, guard);
    case "html": return buildHtml(payload.document, payload.sourceName, payload.mode);
    case "epub": return buildEpub(payload.document, payload.sourceName, payload.pagesPerChapter, guard);
  }
}

async function buildDocx(document: AnalyzedPdf, sourceName: string, includePageBreaks: boolean, guard: BuildGuard): Promise<BuiltOutput> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", xml(`
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
      <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
      <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
    </Types>`));
  zip.file("_rels/.rels", xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`));
  zip.file("docProps/core.xml", xml(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(document.title ?? baseName(sourceName))}</dc:title><dc:creator>PaperZero local conversion</dc:creator></cp:coreProperties>`));
  zip.file("word/_rels/document.xml.rels", xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`));
  zip.file("word/styles.xml", docxStyles());
  zip.file("word/numbering.xml", docxNumbering());
  const body: string[] = [];
  for (let pageIndex = 0; pageIndex < document.pages.length; pageIndex++) {
    guard.throwIfCancelled();
    const page = document.pages[pageIndex]!;
    guard.progress({ phase: "docx", completed: pageIndex, total: document.pages.length, message: `Writing editable page ${page.pageNumber}` });
    if (includePageBreaks && pageIndex > 0) body.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    body.push(...semanticBlocks(page.blocks, page.tables).map(docxBlock));
  }
  body.push(`<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr>`);
  zip.file("word/document.xml", xml(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}</w:body></w:document>`));
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  await validateZip(bytes, ["[Content_Types].xml", "word/document.xml", "word/styles.xml", "word/numbering.xml"]);
  const warnings = [...document.warnings, "Flowing mode reconstructs editable semantics; it does not reproduce exact PDF pagination, fonts, or graphics."];
  return output(sourceName, "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes, {
    format: "docx", mode: "flowing editable", preserved: ["recognized paragraphs", "heuristic headings", "basic lists", "high-confidence tables", ...(includePageBreaks ? ["source page breaks"] : [])], approximated: ["reading order", "paragraph boundaries", "heading levels", "table structure"], omitted: ["exact page layout", "source fonts", "vector graphics", "embedded images", "annotations", "PDF JavaScript"], warnings,
  });
}

async function buildXlsx(document: AnalyzedPdf, sourceName: string, selectedTableIds: string[], guard: BuildGuard): Promise<BuiltOutput> {
  const available = document.pages.flatMap((page) => page.tables);
  const tables = available.filter((table) => selectedTableIds.includes(table.id) && table.confidence >= 0.68);
  if (!tables.length) throw new PaperZeroError("INVALID_INPUT", "Select at least one table with 68% or higher detection confidence to export.");
  if (tables.length > 100) throw new PaperZeroError("MEMORY_LIMIT", "At most 100 detected tables can be exported at once.");
  const zip = new JSZip();
  const sheetNames = uniqueSheetNames(tables);
  const overrides = tables.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  zip.file("[Content_Types].xml", xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`));
  zip.file("_rels/.rels", xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`));
  zip.file("xl/workbook.xml", xml(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tables.map((_, index) => `<sheet name="${escapeXml(sheetNames[index]!)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`));
  zip.file("xl/_rels/workbook.xml.rels", xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${tables.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`));
  zip.file("xl/styles.xml", xlsxStyles());
  tables.forEach((table, index) => {
    guard.throwIfCancelled();
    guard.progress({ phase: "xlsx", completed: index, total: tables.length, message: `Writing table ${index + 1}` });
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, xlsxSheet(table));
  });
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  await validateZip(bytes, ["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", ...tables.map((_, index) => `xl/worksheets/sheet${index + 1}.xml`)]);
  const warnings = [...document.warnings, "Table extraction is heuristic. Verify dates, account numbers, totals, and wrapped cells against the source PDF."];
  return output(sourceName, "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes, {
    format: "xlsx", mode: "detected tables", preserved: ["selected table cells", "separate worksheet per table", "text values", "header-row emphasis"], approximated: ["row grouping", "column boundaries", "wrapped-cell merging", "header inference"], omitted: ["prose outside selected tables", "source formulas", "cell types", "images", "charts", "PDF JavaScript"], warnings,
  });
}

async function buildPptx(document: AnalyzedPdf, sourceName: string, rasters: PageRaster[], guard: BuildGuard): Promise<BuiltOutput> {
  if (!rasters.length) throw new PaperZeroError("INVALID_INPUT", "Render at least one PDF page for visual PowerPoint export.");
  if (rasters.length > 250) throw new PaperZeroError("MEMORY_LIMIT", "Visual PowerPoint export is limited to 250 slides.");
  const firstPage = document.pages.find((page) => page.pageNumber === rasters[0]!.pageNumber);
  const slideWidth = Math.round((firstPage?.width ?? 720) * 12_700);
  const slideHeight = Math.round((firstPage?.height ?? 540) * 12_700);
  const zip = new JSZip();
  zip.file("[Content_Types].xml", pptxContentTypes(rasters));
  zip.file("_rels/.rels", xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`));
  zip.file("ppt/presentation.xml", pptxPresentation(rasters.length, slideWidth, slideHeight));
  zip.file("ppt/_rels/presentation.xml.rels", pptxPresentationRels(rasters.length));
  zip.file("ppt/slideMasters/slideMaster1.xml", pptxMaster());
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`));
  zip.file("ppt/slideLayouts/slideLayout1.xml", pptxLayout());
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`));
  zip.file("ppt/theme/theme1.xml", pptxTheme());
  rasters.forEach((raster, index) => {
    guard.throwIfCancelled();
    guard.progress({ phase: "pptx", completed: index, total: rasters.length, message: `Packaging visual slide ${index + 1}` });
    const extension = raster.mimeType === "image/png" ? "png" : "jpg";
    const fitted = containRect(raster.widthPx, raster.heightPx, slideWidth, slideHeight);
    zip.file(`ppt/media/page${index + 1}.${extension}`, raster.bytes);
    zip.file(`ppt/slides/slide${index + 1}.xml`, pptxSlide(fitted.x, fitted.y, fitted.width, fitted.height));
    zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/page${index + 1}.${extension}"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`));
  });
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  await validateZip(bytes, ["[Content_Types].xml", "ppt/presentation.xml", "ppt/slideMasters/slideMaster1.xml", ...rasters.map((_, index) => `ppt/slides/slide${index + 1}.xml`)]);
  const warnings = [...document.warnings, "Each slide is a flattened page image. It is editable only as a slide-level image, not as text or shapes."];
  return output(sourceName, "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", bytes, {
    format: "pptx", mode: "visual fidelity (flattened)", preserved: ["one slide per selected page", "visual page appearance", "page order", "source aspect ratio"], approximated: ["raster resolution", "mixed-size PDF pages within one slide size"], omitted: ["element-level text editing", "separate vector shapes", "PDF links", "PDF JavaScript"], warnings,
  });
}

function buildHtml(document: AnalyzedPdf, sourceName: string, mode: "semantic" | "layout"): BuiltOutput {
  const title = escapeXml(document.title ?? baseName(sourceName));
  const body = mode === "semantic" ? semanticHtml(document) : layoutHtml(document);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>${title}</title><style>${mode === "semantic" ? semanticCss() : layoutCss()}</style></head><body>${body}</body></html>`;
  const bytes = new TextEncoder().encode(html);
  const warnings = [...document.warnings, mode === "semantic" ? "Semantic HTML prioritizes reading order and responsiveness over exact page geometry." : "Layout HTML uses absolutely positioned text and is less responsive and accessible."];
  return output(sourceName, "html", "text/html;charset=utf-8", bytes, {
    format: "html", mode, preserved: mode === "semantic" ? ["searchable text", "heuristic headings", "paragraphs", "lists", "high-confidence tables", "responsive structure"] : ["page dimensions", "positioned searchable text", "font size and weight", "rotation"], approximated: ["reading order", "fonts", ...(mode === "layout" ? ["glyph placement"] : ["semantic structure"])], omitted: ["embedded images", "complex vectors", "forms", "annotations", "executable PDF JavaScript"], warnings,
  });
}

async function buildEpub(document: AnalyzedPdf, sourceName: string, pagesPerChapter: number, guard: BuildGuard): Promise<BuiltOutput> {
  const span = Math.max(1, Math.min(25, Math.floor(pagesPerChapter || 5)));
  const chapters = [];
  for (let start = 0; start < document.pages.length; start += span) chapters.push(document.pages.slice(start, start + span));
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", xml(`<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`));
  const title = escapeXml(document.title ?? baseName(sourceName));
  zip.file("EPUB/content.opf", xml(`<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:paperzero:${escapeXml(baseName(sourceName))}</dc:identifier><dc:title>${title}</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-09-03T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${chapters.map((_, index) => `<item id="c${index + 1}" href="chapter-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("")}</manifest><spine>${chapters.map((_, index) => `<itemref idref="c${index + 1}"/>`).join("")}</spine></package>`));
  zip.file("EPUB/nav.xhtml", xhtml(title, `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${chapters.map((chapter, index) => `<li><a href="chapter-${index + 1}.xhtml">Pages ${chapter[0]!.pageNumber}–${chapter.at(-1)!.pageNumber}</a></li>`).join("")}</ol></nav>`, `xmlns:epub="http://www.idpf.org/2007/ops"`));
  chapters.forEach((chapter, index) => {
    guard.throwIfCancelled();
    guard.progress({ phase: "epub", completed: index, total: chapters.length, message: `Writing chapter ${index + 1}` });
    const content = chapter.map((page) => `<section><h2>Page ${page.pageNumber}</h2>${semanticBlocks(page.blocks, page.tables).map(htmlBlock).join("")}</section>`).join("");
    zip.file(`EPUB/chapter-${index + 1}.xhtml`, xhtml(`${title} — Chapter ${index + 1}`, content));
  });
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  await validateZip(bytes, ["mimetype", "META-INF/container.xml", "EPUB/content.opf", "EPUB/nav.xhtml", ...chapters.map((_, index) => `EPUB/chapter-${index + 1}.xhtml`)]);
  const warnings = [...document.warnings, "EPUB reading order and chapter boundaries are heuristic and may require editorial cleanup."];
  return output(sourceName, "epub", "application/epub+zip", bytes, {
    format: "epub", mode: "semantic reflow", preserved: ["searchable text", "heuristic headings", "paragraphs", "lists", "high-confidence tables", "navigation document"], approximated: ["reading order", "chapter grouping", "heading hierarchy"], omitted: ["fixed page appearance", "embedded images", "complex vectors", "forms", "PDF JavaScript"], warnings,
  });
}

type SemanticBlock = Exclude<LayoutBlock, { kind: "table" }> | { kind: "resolved-table"; table: DetectedTable };

function semanticBlocks(blocks: LayoutBlock[], tables: DetectedTable[]): SemanticBlock[] {
  const resolved: SemanticBlock[] = [];
  for (const block of blocks) {
    if (block.kind !== "table") resolved.push(block);
    else {
      const table = tables.find((candidate) => candidate.id === block.tableId);
      if (table) resolved.push({ kind: "resolved-table", table });
    }
  }
  return resolved;
}

function docxBlock(block: SemanticBlock): string {
  if (block.kind === "resolved-table") return `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B7C3D0"/><w:left w:val="single" w:sz="4" w:color="B7C3D0"/><w:bottom w:val="single" w:sz="4" w:color="B7C3D0"/><w:right w:val="single" w:sz="4" w:color="B7C3D0"/><w:insideH w:val="single" w:sz="4" w:color="D5DCE4"/><w:insideV w:val="single" w:sz="4" w:color="D5DCE4"/></w:tblBorders></w:tblPr>${block.table.rows.map((row) => `<w:tr>${row.map((cell) => `<w:tc>${docxParagraph(cell)}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  if (block.kind === "heading") return `<w:p><w:pPr><w:pStyle w:val="Heading${block.level}"/></w:pPr>${docxRun(block.text)}</w:p>`;
  if (block.kind === "list") return block.items.map((item) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${block.ordered ? 2 : 1}"/></w:numPr></w:pPr>${docxRun(item)}</w:p>`).join("");
  return docxParagraph(block.text);
}

function docxParagraph(text: string): string { return `<w:p>${docxRun(text)}</w:p>`; }
function docxRun(text: string): string { return `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`; }
function docxStyles(): string { return xml(`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style>${[1,2,3].map((level) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="${level === 1 ? 34 : level === 2 ? 30 : 26}"/></w:rPr></w:style>`).join("")}</w:styles>`); }
function docxNumbering(): string { return xml(`<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`); }

function xlsxSheet(table: DetectedTable): string {
  const widths = Array.from({ length: Math.max(...table.rows.map((row) => row.length)) }, (_, column) => Math.min(60, Math.max(10, ...table.rows.map((row) => (row[column] ?? "").length + 2))));
  return xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>${table.rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, column) => `<c r="${columnName(column)}${rowIndex + 1}" t="inlineStr"${rowIndex === 0 ? ` s="1"` : ""}><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`);
}
function xlsxStyles(): string { return xml(`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`); }

function pptxContentTypes(rasters: PageRaster[]): string { return xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${rasters.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>`); }
function pptxPresentation(count: number, width: number, height: number): string { return xml(`<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${Array.from({ length: count }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${width}" cy="${height}"/><p:notesSz cx="${height}" cy="${width}"/></p:presentation>`); }
function pptxPresentationRels(count: number): string { return xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${Array.from({ length: count }, (_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("")}</Relationships>`); }
function pptxSlide(x: number, y: number, width: number, height: number): string { return xml(`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="Flattened PDF page"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`); }
function pptxMaster(): string { return xml(`<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`); }
function pptxLayout(): string { return xml(`<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`); }
function pptxTheme(): string {
  const color = `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>`;
  const line = (width: number) => `<a:ln w="${width}">${color}<a:prstDash val="solid"/></a:ln>`;
  const effect = `<a:effectStyle><a:effectLst/></a:effectStyle>`;
  return xml(`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="PaperZero"><a:themeElements><a:clrScheme name="PaperZero"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>${["2563EB","DC2626","16A34A","9333EA","0891B2","EA580C"].map((value, index) => `<a:accent${index + 1}><a:srgbClr val="${value}"/></a:accent${index + 1}>`).join("")}<a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme><a:fontScheme name="PaperZero"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="PaperZero"><a:fillStyleLst>${color}${color}<a:solidFill><a:srgbClr val="F1F5F9"/></a:solidFill></a:fillStyleLst><a:lnStyleLst>${line(6350)}${line(12700)}${line(19050)}</a:lnStyleLst><a:effectStyleLst>${effect}${effect}${effect}</a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
}

function semanticHtml(document: AnalyzedPdf): string { return `<main><h1>${escapeXml(document.title ?? "Converted document")}</h1>${document.pages.map((page) => `<section data-page="${page.pageNumber}"><h2 class="page-label">Page ${page.pageNumber}</h2>${semanticBlocks(page.blocks, page.tables).map(htmlBlock).join("")}</section>`).join("")}</main>`; }
function htmlBlock(block: SemanticBlock): string { if (block.kind === "resolved-table") return `<table>${block.table.rows.map((row, rowIndex) => `<tr>${row.map((cell) => rowIndex === 0 ? `<th>${escapeXml(cell)}</th>` : `<td>${escapeXml(cell)}</td>`).join("")}</tr>`).join("")}</table>`; if (block.kind === "heading") return `<h${Math.min(6, block.level + 1)}>${escapeXml(block.text)}</h${Math.min(6, block.level + 1)}>`; if (block.kind === "list") return `<${block.ordered ? "ol" : "ul"}>${block.items.map((item) => `<li>${escapeXml(item)}</li>`).join("")}</${block.ordered ? "ol" : "ul"}>`; return `<p>${escapeXml(block.text)}</p>`; }
function layoutHtml(document: AnalyzedPdf): string { return `<main>${document.pages.map((page) => `<section class="page" aria-label="Page ${page.pageNumber}" style="width:${round(page.width)}pt;height:${round(page.height)}pt">${page.items.map((item) => `<span dir="${item.direction}" style="left:${round(item.x)}pt;top:${round(item.y)}pt;width:${round(item.width)}pt;font-size:${round(item.fontSize)}pt;font-weight:${item.bold ? 700 : 400};font-style:${item.italic ? "italic" : "normal"};transform:rotate(${round(item.rotation)}deg)">${escapeXml(item.text)}</span>`).join("")}</section>`).join("")}</main>`; }
function semanticCss(): string { return `:root{font-family:system-ui,sans-serif;color:#172033;background:#fff}body{margin:0}main{max-width:52rem;margin:auto;padding:2rem;line-height:1.55}section{margin:2rem 0}.page-label{font-size:.75rem;color:#64748b;border-bottom:1px solid #cbd5e1}table{border-collapse:collapse;width:100%;overflow-wrap:anywhere}th,td{border:1px solid #cbd5e1;padding:.4rem;text-align:left}th{background:#f1f5f9}@media(max-width:40rem){main{padding:1rem}}`; }
function layoutCss(): string { return `body{margin:0;background:#e2e8f0}.page{position:relative;margin:1rem auto;background:white;box-shadow:0 1px 6px #64748b;overflow:hidden}.page span{position:absolute;display:block;white-space:pre;transform-origin:left top;font-family:Arial,sans-serif;line-height:1}`; }
function xhtml(title: string, body: string, extra = ""): string { return xml(`<html xmlns="http://www.w3.org/1999/xhtml" ${extra}><head><title>${title}</title><meta charset="utf-8"/><style>body{font-family:serif;line-height:1.5}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:.3em}</style></head><body>${body}</body></html>`); }

function output(sourceName: string, extension: string, mimeType: string, bytes: Uint8Array, compatibility: BuiltOutput["compatibility"]): BuiltOutput { return { files: [{ name: suggestOutputName({ baseNames: [sourceName], suffix: "converted", extension }), bytes, mimeType }], warnings: compatibility.warnings, compatibility }; }
async function validateZip(bytes: Uint8Array, required: string[]): Promise<void> { let zip: JSZip; try { zip = await JSZip.loadAsync(bytes); } catch { throw new PaperZeroError("OUTPUT_INVALID", "Generated package could not be reopened."); } const missing = required.filter((path) => !zip.file(path)); if (missing.length) throw new PaperZeroError("OUTPUT_INVALID", `Generated package is missing ${missing[0]}.`); }
function uniqueSheetNames(tables: DetectedTable[]): string[] { const used = new Set<string>(); return tables.map((table) => { const base = `Page ${table.pageNumber} Table`.slice(0, 31); let name = base; let index = 2; while (used.has(name)) name = `${base.slice(0, 27)} ${index++}`; used.add(name); return name; }); }
function containRect(width: number, height: number, maxWidth: number, maxHeight: number) { const scale = Math.min(maxWidth / width, maxHeight / height); const drawWidth = Math.round(width * scale); const drawHeight = Math.round(height * scale); return { x: Math.round((maxWidth - drawWidth) / 2), y: Math.round((maxHeight - drawHeight) / 2), width: drawWidth, height: drawHeight }; }
function columnName(index: number): string { let result = ""; for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + ((value - 1) % 26)) + result; return result; }
function baseName(name: string): string { return name.replace(/\.[^.]+$/, "") || "document"; }
function escapeXml(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function xml(value: string): string { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${value.replace(/>\s+</g, "><").trim()}`; }
function round(value: number): string { return (Math.round(value * 100) / 100).toString(); }
