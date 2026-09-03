import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv, parseCsvRows } from "./csv";
import { parseHtml } from "./html";
import { parseMarkdown } from "./markdown";
import { convertSourceToPdf } from "./worker";
import { convertBinaryToPdf } from "./worker";
import JSZip from "jszip";
import { inspectXlsx } from "./xlsx";
import { formatAudioTimestamp, parseAudioTranscript } from "./audio";
import type { ConversionGuard, ConversionOptions } from "./types";

const options: ConversionOptions = {
  pageSize: "a4",
  orientation: "portrait",
  marginPt: 42,
  theme: "clean",
  fontSize: 11,
  pageNumbers: true,
};

const guard: ConversionGuard = {
  cancelled: false,
  throwIfCancelled() {},
  progress() {},
};

describe("Markdown conversion", () => {
  it("creates portable headings, emphasis, lists, tables, code, and page breaks", () => {
    const parsed = parseMarkdown(`# Title\n\nA **bold** and *italic* paragraph.\n\n- one\n- two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n\`\`\`ts\nconst safe = true;\n\`\`\`\n\n<!-- pagebreak -->`);
    expect(parsed.document.blocks.map((block) => block.kind)).toEqual([
      "heading", "paragraph", "list", "table", "code", "page-break",
    ]);
    const paragraph = parsed.document.blocks[1];
    expect(paragraph?.kind === "paragraph" && paragraph.runs.some((run) => run.bold)).toBe(true);
  });
});

describe("safe HTML conversion", () => {
  it("keeps document content without executing active or remote resources", () => {
    const parsed = parseHtml(`<html><head><title>Safe report</title><style>p{position:fixed}</style></head><body><h1>Hello</h1><script>throw new Error('executed')</script><p onclick="steal()">Local <strong>only</strong></p><iframe src="https://example.com"></iframe><img src="https://example.com/a.png" alt="remote"></body></html>`);
    expect(parsed.document.title).toBe("Safe report");
    expect(parsed.document.blocks.map((block) => block.kind)).toEqual(["heading", "paragraph"]);
    expect(parsed.report.omitted).toContain("scripts and active content");
    expect(parsed.report.omitted).toContain("external images");
    expect(parsed.report.warnings.join(" ")).toContain("removed without execution");
  });
});

describe("bounded CSV conversion", () => {
  it("detects delimiters and parses quoted delimiters and newlines", () => {
    const source = `Name;Note\nAda;"one;two"\nLinus;"line 1\nline 2"`;
    expect(detectDelimiter(source)).toBe(";");
    expect(parseCsvRows(source, ";")).toEqual([
      ["Name", "Note"],
      ["Ada", "one;two"],
      ["Linus", "line 1\nline 2"],
    ]);
  });

  it("splits wide tables into bounded horizontal sections", () => {
    const source = `${Array.from({ length: 22 }, (_, index) => `C${index + 1}`).join(",")}\n${Array.from({ length: 22 }, (_, index) => index).join(",")}`;
    const parsed = parseCsv(source, { delimiter: "auto", headerRow: true });
    expect(parsed.document.blocks.filter((block) => block.kind === "table")).toHaveLength(3);
    expect(parsed.report.warnings.join(" ")).toContain("paginated horizontally");
  });
});

describe("shared PDF pagination", () => {
  it("builds and validates a multipage PDF inside the conversion worker", async () => {
    const longMarkdown = [`# Local conversion`, ...Array.from({ length: 90 }, (_, index) => `Paragraph ${index + 1}: browser-local content with **formatting** and enough words to exercise wrapping and pagination.`)].join("\n\n");
    const result = await convertSourceToPdf({ format: "markdown", source: longMarkdown, sourceName: "fixture.md", options }, guard);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.bytes.slice(0, 5)).toEqual(new Uint8Array([37, 80, 68, 70, 45]));
    const pdf = await PDFDocument.load(result.files[0]!.bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(result.report.preserved).toContain("headings");
  });
});

describe("EPUB conversion", () => {
  it("follows the package spine and preserves local chapter images", async () => {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip");
    zip.file("META-INF/container.xml", `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    zip.file("OEBPS/content.opf", `<?xml version="1.0"?><package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Fixture Book</dc:title><dc:creator>PaperZero</dc:creator></metadata><manifest><item id="one" href="chapter-1.xhtml" media-type="application/xhtml+xml"/><item id="two" href="chapter-2.xhtml" media-type="application/xhtml+xml"/><item id="cover" href="cover.png" media-type="image/png"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>`);
    zip.file("OEBPS/chapter-1.xhtml", `<html><body><h1>First</h1><p>Chapter one.</p><img src="cover.png" alt="cover"><script>never()</script></body></html>`);
    zip.file("OEBPS/chapter-2.xhtml", `<html><body><h1>Second</h1><p>Chapter two.</p></body></html>`);
    zip.file("OEBPS/cover.png", Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const result = await convertBinaryToPdf({ format: "epub", bytes, sourceName: "fixture.epub", options }, guard);
    expect(result.report.preserved).toContain("OPF spine order");
    expect(result.report.omitted).toContain("scripts");
    const pdf = await PDFDocument.load(result.files[0]!.bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});

describe("DOCX conversion", () => {
  it("preserves core OOXML blocks and reports unsupported constructs", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="w" xmlns:r="r" xmlns:a="a"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="224488"/><w:rFonts w:ascii="Fixture Sans" w:hAnsi="Fixture Sans"/></w:rPr><w:t>Resume</w:t></w:r></w:p><w:p><w:r><w:t>Local paragraph</w:t></w:r><w:hyperlink r:id="rLink"><w:r><w:t> Example</w:t></w:r></w:hyperlink></w:p><w:p><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>First item</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing><a:blip r:embed="rImage"/></w:drawing></w:r></w:p><m:oMath xmlns:m="m"/></w:body></w:document>`);
    zip.file("word/styles.xml", `<?xml version="1.0"?><w:styles xmlns:w="w"><w:style w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style></w:styles>`);
    zip.file("word/numbering.xml", `<?xml version="1.0"?><w:numbering xmlns:w="w"><w:abstractNum w:abstractNumId="0"><w:lvl><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`);
    zip.file("word/_rels/document.xml.rels", `<?xml version="1.0"?><Relationships><Relationship Id="rLink" Type="hyperlink" Target="https://example.com" TargetMode="External"/><Relationship Id="rImage" Type="image" Target="media/pixel.png"/><Relationship Id="rHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
    zip.file("word/header1.xml", `<?xml version="1.0"?><w:hdr xmlns:w="w"><w:p><w:r><w:t>Fixture header</w:t></w:r></w:p></w:hdr>`);
    zip.file("word/footer1.xml", `<?xml version="1.0"?><w:ftr xmlns:w="w"><w:p><w:r><w:t>Fixture footer</w:t></w:r></w:p></w:ftr>`);
    zip.file("word/media/pixel.png", Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const result = await convertBinaryToPdf({ format: "docx", bytes, sourceName: "resume.docx", options }, guard);
    expect(result.report.preserved).toContain("tables");
    expect(result.report.omitted).toContain("equations");
    expect(result.report.approximated).toContain("Word pagination");
    expect(result.report.approximated).toContain("header/footer placement");
    expect(result.warnings.join(" ")).toContain("Fixture Sans");
    const pdf = await PDFDocument.load(result.files[0]!.bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
  });
});

describe("XLSX conversion", () => {
  it("reads multiple sheets, cached formulas, styles, and merge disclosures", async () => {
    const zip = new JSZip();
    zip.file("xl/workbook.xml", `<?xml version="1.0"?><workbook xmlns:r="r"><sheets><sheet name="Summary" sheetId="1" r:id="r1"/><sheet name="Data" sheetId="2" r:id="r2"/></sheets></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0"?><Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Target="worksheets/sheet2.xml"/></Relationships>`);
    zip.file("xl/sharedStrings.xml", `<?xml version="1.0"?><sst><si><t>Name</t></si><si><t>Value</t></si><si><t>PaperZero</t></si></sst>`);
    zip.file("xl/styles.xml", `<?xml version="1.0"?><styleSheet><fonts count="2"><font/><font><b/><color rgb="FF224488"/></font></fonts><fills count="2"><fill/><fill><patternFill><fgColor rgb="FFF0F4FF"/></patternFill></fill></fills><cellXfs count="2"><xf fontId="0" fillId="0" numFmtId="0"/><xf fontId="1" fillId="1" numFmtId="4"><alignment horizontal="right"/></xf></cellXfs></styleSheet>`);
    zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="1"><f>SUM(40,2)</f><v>42</v></c></row></sheetData><mergeCells><mergeCell ref="A3:B3"/></mergeCells></worksheet>`);
    zip.file("xl/worksheets/sheet2.xml", `<?xml version="1.0"?><worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Second sheet</t></is></c></row></sheetData></worksheet>`);
    zip.file("xl/charts/chart1.xml", `<chart/>`);
    zip.file("xl/media/image1.png", Uint8Array.from([1, 2, 3]));
    zip.file("xl/vbaProject.bin", Uint8Array.from([4, 5, 6]));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    expect(await inspectXlsx(bytes)).toEqual(["Summary", "Data"]);
    const result = await convertBinaryToPdf({ format: "xlsx", bytes, sourceName: "book.xlsm", selectedSections: ["Summary"], options: { ...options, orientation: "landscape" } }, guard);
    expect(result.report.preserved).toContain("cached formula values");
    expect(result.warnings.join(" ")).toContain("formula cells used cached");
    expect(result.warnings.join(" ")).toContain("merged ranges");
    expect(result.warnings.join(" ")).toContain("Macros were ignored");
    expect(result.report.omitted).toContain("charts");
    expect(result.report.omitted).toContain("worksheet images");
    expect(await PDFDocument.load(result.files[0]!.bytes)).toBeTruthy();
  });
});

describe("PPTX conversion", () => {
  it("keeps slide dimensions while rendering text, shapes, and local images", async () => {
    const zip = new JSZip();
    zip.file("ppt/presentation.xml", `<?xml version="1.0"?><p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`);
    zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/></Relationships>`);
    zip.file("ppt/theme/theme1.xml", `<?xml version="1.0"?><a:theme xmlns:a="a"><a:themeElements><a:clrScheme><a:dk1><a:srgbClr val="111827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:accent1><a:srgbClr val="2563EB"/></a:accent1></a:clrScheme></a:themeElements></a:theme>`);
    zip.file("ppt/slides/slide1.xml", `<?xml version="1.0"?><p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill></p:bgPr></p:bg><p:spTree><p:sp><p:spPr><a:xfrm><a:off x="635000" y="635000"/><a:ext cx="5080000" cy="1270000"/></a:xfrm><a:prstGeom prst="rect"/><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="2800" b="1"><a:latin typeface="Aptos"/><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>Private presentation</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:spPr><a:xfrm><a:off x="635000" y="2540000"/><a:ext cx="1270000" cy="1270000"/></a:xfrm><a:prstGeom prst="ellipse"/><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></p:spPr></p:sp><p:pic><p:spPr><a:xfrm><a:off x="6350000" y="635000"/><a:ext cx="1270000" cy="1270000"/></a:xfrm></p:spPr><p:blipFill><a:blip r:embed="rImage"/></p:blipFill></p:pic><p:graphicFrame/></p:spTree></p:cSld><p:transition/></p:sld>`);
    zip.file("ppt/slides/_rels/slide1.xml.rels", `<?xml version="1.0"?><Relationships><Relationship Id="rImage" Target="../media/pixel.png"/></Relationships>`);
    zip.file("ppt/media/pixel.png", Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const result = await convertBinaryToPdf({ format: "pptx", bytes, sourceName: "deck.pptx", options }, guard);
    const pdf = await PDFDocument.load(result.files[0]!.bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(720, 2);
    expect(pdf.getPage(0).getSize().height).toBeCloseTo(540, 2);
    expect(result.report.preserved).toContain("positioned text boxes");
    expect(result.report.omitted).toContain("charts, SmartArt, and embedded objects");
    expect(result.warnings.join(" ")).toContain("Animations and transitions");
  });
});

describe("audio transcript conversion", () => {
  it("keeps reviewed text and real user timestamps without claiming diarization", async () => {
    expect(formatAudioTimestamp(65.9)).toBe("01:05");
    expect(formatAudioTimestamp(3661)).toBe("01:01:01");
    const parsed = parseAudioTranscript("[00:03] Known fixture words.\n\nA reviewed second paragraph.", "Interview", "2026-09-03");
    expect(parsed.report.preserved).toContain("user-inserted timestamps");
    expect(parsed.report.omitted).toContain("speaker diarization");
    const result = await convertSourceToPdf({
      format: "audio",
      source: "[00:03] Known fixture words.\n\nA reviewed second paragraph.",
      sourceName: "fixture.wav",
      options: { ...options, title: "Interview", audio: { date: "2026-09-03" } },
    }, guard);
    expect((await PDFDocument.load(result.files[0]!.bytes)).getPageCount()).toBe(1);
    expect(result.warnings.join(" ")).toContain("Automatic speech recognition is not bundled");
  });
});
