import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { analyzePdfLayout } from "./analysis";
import { buildPdfExport } from "./output";
import { pageReadingText } from "./text-export";
import type { BuildGuard, PositionedTextItem, RawLayoutPage } from "./types";

const guard: BuildGuard = { cancelled: false, throwIfCancelled() {}, progress() {} };

function item(pageNumber: number, index: number, text: string, x: number, y: number, width: number, fontSize = 10, bold = false): PositionedTextItem {
  return { id: `p${pageNumber}-i${index}`, pageNumber, text, x, y, width, height: fontSize, fontName: bold ? "Fixture-Bold" : "Fixture-Regular", fontFamily: "Fixture", fontSize, rotation: 0, bold, italic: false, direction: "ltr" };
}

function fixturePages(): RawLayoutPage[] {
  return [
    {
      pageNumber: 1, width: 600, height: 800, links: [], items: [
        item(1, 0, "Quarterly report", 40, 18, 100, 9),
        item(1, 1, "Layout analysis", 160, 62, 280, 22, true),
        item(1, 2, "Left column first line", 45, 130, 190),
        item(1, 3, "Right column first line", 330, 130, 190),
        item(1, 4, "Left column second line", 45, 152, 190),
        item(1, 5, "Right column second line", 330, 152, 190),
        item(1, 6, "Page 1", 280, 770, 40, 9),
      ],
    },
    {
      pageNumber: 2, width: 600, height: 800, links: [], items: [
        item(2, 0, "Quarterly report", 40, 18, 100, 9),
        item(2, 1, "Account", 50, 110, 65, 10, true), item(2, 2, "Amount", 220, 110, 55, 10, true), item(2, 3, "Status", 390, 110, 50, 10, true),
        item(2, 4, "Cash", 50, 134, 40), item(2, 5, "1200.50", 220, 134, 55), item(2, 6, "Verified", 390, 134, 55),
        item(2, 7, "Savings", 50, 158, 50), item(2, 8, "940.25", 220, 158, 50), item(2, 9, "Pending", 390, 158, 50),
        item(2, 10, "Total", 50, 182, 40), item(2, 11, "2140.75", 220, 182, 55), item(2, 12, "Review", 390, 182, 45),
        item(2, 13, "Page 2", 280, 770, 40, 9),
      ],
    },
  ];
}

function tableFixture(title: string, headers: string[], rows: string[][]): RawLayoutPage {
  const items = [item(1, 0, title, 40, 35, 260, 20, true)];
  const x = headers.map((_, index) => 45 + index * 155);
  [headers, ...rows].forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    items.push(item(1, items.length, value, x[columnIndex]!, 95 + rowIndex * 24, Math.max(35, value.length * 7), 10, rowIndex === 0));
  }));
  return { pageNumber: 1, width: 600, height: 800, links: [], items };
}

describe("shared PDF layout analysis", () => {
  it("orders columns, removes repeated margins, and confidence-scores tables", () => {
    const document = analyzePdfLayout(fixturePages(), "Fixture", { readingOrder: "columns", removeRepeatedHeadersFooters: true });
    expect(document.removedHeadersFooters).toContain("quarterly report");
    expect(document.removedHeadersFooters).toContain("page #");
    expect(document.pages[0]!.columnCount).toBe(2);
    const ordered = document.pages[0]!.lines.map((line) => line.text);
    expect(ordered.indexOf("Left column second line")).toBeLessThan(ordered.indexOf("Right column first line"));
    expect(pageReadingText(document.pages[0]!)).toContain("Left column first line Left column second line\n\nRight column first line Right column second line");
    expect(document.pages[0]!.tables).toHaveLength(0);
    const table = document.pages[1]!.tables[0];
    expect(table?.confidence).toBeGreaterThanOrEqual(0.68);
    expect(table?.rows[1]).toEqual(["Cash", "1200.50", "Verified"]);
    expect(document.pages[1]!.blocks.some((block) => block.kind === "table")).toBe(true);
  });

  it("preserves CJK joins, RTL direction, and scanned-page warnings", () => {
    const cjk = analyzePdfLayout([{ pageNumber: 1, width: 300, height: 400, links: [], items: [
      item(1, 0, "私", 20, 40, 12), item(1, 1, "は", 35, 40, 12), item(1, 2, "学生", 50, 40, 25),
    ] }]);
    expect(cjk.pages[0]!.lines[0]!.text).toBe("私は学生");

    const rtlItems = [item(1, 0, "مرحبا", 210, 40, 45), item(1, 1, "بالعالم", 145, 40, 55)].map((value) => ({ ...value, direction: "rtl" as const }));
    const rtl = analyzePdfLayout([{ pageNumber: 1, width: 300, height: 400, links: [], items: rtlItems }]);
    expect(rtl.pages[0]!.lines[0]!.direction).toBe("rtl");
    expect(rtl.pages[0]!.lines[0]!.text).toContain("مرحبا");

    const scanned = analyzePdfLayout([{ pageNumber: 7, width: 300, height: 400, links: [], items: [] }]);
    expect(scanned.pages[0]!.scanned).toBe(true);
    expect(scanned.warnings.join(" ")).toContain("local OCR");
  });

  it("handles single-column report and resume structures without inventing grids", () => {
    const report = analyzePdfLayout([{ pageNumber: 1, width: 600, height: 800, links: [], items: [
      item(1, 0, "Research summary", 45, 45, 220, 21, true),
      item(1, 1, "This report has a conventional single-column reading order.", 45, 100, 390),
      item(1, 2, "Its second line should join the same reconstructed paragraph.", 45, 119, 390),
    ] }]);
    expect(report.pages[0]!.columnCount).toBe(1);
    expect(report.pages[0]!.tables).toHaveLength(0);
    expect(pageReadingText(report.pages[0]!)).toContain("conventional single-column reading order. Its second line");

    const resume = analyzePdfLayout([{ pageNumber: 1, width: 600, height: 800, links: [], items: [
      item(1, 0, "Alex Example", 45, 45, 180, 23, true),
      item(1, 1, "Experience", 45, 100, 120, 15, true),
      item(1, 2, "• Built accessible document tools", 45, 135, 260),
      item(1, 3, "• Shipped local-first processing", 45, 158, 250),
    ] }]);
    expect(resume.pages[0]!.blocks.some((block) => block.kind === "heading")).toBe(true);
    expect(resume.pages[0]!.blocks.some((block) => block.kind === "list" && block.items.length === 2)).toBe(true);
  });

  it("places invoice, annual-report, and OCR-like scanned table cells objectively", () => {
    const fixtures = [
      tableFixture("Invoice", ["Item", "Qty", "Amount"], [["Consulting", "2", "1200.00"], ["Hosting", "1", "85.50"], ["Total", "—", "1285.50"]]),
      tableFixture("Annual report", ["Year", "Revenue", "Margin"], [["2023", "4200", "18%"], ["2024", "5100", "21%"], ["2025", "5900", "24%"]]),
      tableFixture("Scanned statement OCR", ["Date", "Reference", "Debit"], [["01/02", "ATM-104", "40.00"], ["01/03", "CARD-22", "16.25"], ["01/04", "FEE", "2.00"]]),
    ];
    for (const fixture of fixtures) {
      const table = analyzePdfLayout([fixture]).pages[0]!.tables[0];
      expect(table?.confidence).toBeGreaterThanOrEqual(0.68);
      expect(table?.rows).toHaveLength(4);
      expect(table?.rows.every((row) => row.length === 3)).toBe(true);
    }
  });
});

describe("editable and alternate output packages", () => {
  const document = analyzePdfLayout(fixturePages(), "Fixture", { removeRepeatedHeadersFooters: true });

  it("builds DOCX and XLSX packages that reopen with their required parts", async () => {
    const docx = await buildPdfExport({ format: "docx", document, sourceName: "fixture.pdf", includePageBreaks: true }, guard);
    const docxZip = await JSZip.loadAsync(docx.files[0]!.bytes);
    expect(docxZip.file("word/document.xml")).toBeTruthy();
    expect(await docxZip.file("word/document.xml")!.async("string")).toContain("Layout analysis");
    const table = document.pages[1]!.tables[0]!;
    const xlsx = await buildPdfExport({ format: "xlsx", document, sourceName: "fixture.pdf", selectedTableIds: [table.id] }, guard);
    const xlsxZip = await JSZip.loadAsync(xlsx.files[0]!.bytes);
    expect(xlsxZip.file("xl/worksheets/sheet1.xml")).toBeTruthy();
    expect(await xlsxZip.file("xl/worksheets/sheet1.xml")!.async("string")).toContain("2140.75");
  });

  it("refuses to export table candidates below the confidence gate", async () => {
    const candidate = document.pages[1]!.tables[0]!;
    const unsafe = { ...document, pages: document.pages.map((page) => page.pageNumber === candidate.pageNumber ? { ...page, tables: page.tables.map((table) => table.id === candidate.id ? { ...table, confidence: 0.67 } : table) } : page) };
    await expect(buildPdfExport({ format: "xlsx", document: unsafe, sourceName: "fixture.pdf", selectedTableIds: [candidate.id] }, guard)).rejects.toThrow("68%");
  });

  it("builds inert semantic/layout HTML and a reflowable EPUB", async () => {
    const semantic = await buildPdfExport({ format: "html", document, sourceName: "fixture.pdf", mode: "semantic" }, guard);
    const semanticText = new TextDecoder().decode(semantic.files[0]!.bytes);
    expect(semanticText).toContain("Content-Security-Policy");
    expect(semanticText).not.toContain("<script");
    const layout = await buildPdfExport({ format: "html", document, sourceName: "fixture.pdf", mode: "layout" }, guard);
    expect(new TextDecoder().decode(layout.files[0]!.bytes)).toContain("position:absolute");
    const epub = await buildPdfExport({ format: "epub", document, sourceName: "fixture.pdf", pagesPerChapter: 1 }, guard);
    const epubZip = await JSZip.loadAsync(epub.files[0]!.bytes);
    expect(await epubZip.file("mimetype")!.async("string")).toBe("application/epub+zip");
    expect(epubZip.file("EPUB/chapter-2.xhtml")).toBeTruthy();
  });

  it("builds a visual-fidelity PPTX with one flattened image per slide", async () => {
    const pixel = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
    const pptx = await buildPdfExport({ format: "pptx", document, sourceName: "fixture.pdf", rasters: document.pages.map((page) => ({ pageNumber: page.pageNumber, bytes: pixel, mimeType: "image/png", widthPx: 600, heightPx: 800 })) }, guard);
    const zip = await JSZip.loadAsync(pptx.files[0]!.bytes);
    expect(zip.file("ppt/slides/slide1.xml")).toBeTruthy();
    expect(zip.file("ppt/slides/slide2.xml")).toBeTruthy();
    expect(pptx.compatibility.mode).toContain("flattened");
  });
});
