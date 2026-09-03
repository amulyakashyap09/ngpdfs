# Conversion from PDF

Phase 7 turns PDF pages into editable or alternate local formats without presenting a
PDF as if it contained the original Word, Excel, PowerPoint, or ebook structure. A PDF
normally stores positioned drawing instructions; headings, paragraphs, columns, and
tables must therefore be reconstructed heuristically and reviewed.

## Shared extraction and layout model

PDF.js supplies each selected page's text, transform, width, height, font reference,
writing direction, and link annotations. PaperZero normalizes that data into page-point
coordinates and records text bounding boxes, font family/name, size, rotation, bold and
italic hints, and direction. Empty text-layer pages can be rendered sequentially and
recognized by the existing self-hosted Tesseract worker before re-analysis.

The analyzer then:

1. clusters glyph runs into row bands using a font-relative vertical tolerance;
2. splits widely separated row segments and joins close LTR, RTL, and CJK runs;
3. detects two-column layouts and reads each column around wide/centered dividers;
4. removes normalized top/bottom lines repeated on at least 60% of selected pages;
5. groups remaining lines into headings, paragraphs, lists, and eligible tables.

Table confidence is deliberately explainable. Boundary alignment contributes 40%,
consistent column count 20%, row density 4%, first-row emphasis 20%, and numeric-cell
evidence 16%. A candidate requires at least three nearby multi-cell rows. Candidates
below 68% remain prose and cannot be selected for XLSX export. Ruling lines are not yet
read from vector drawing operators, so border-only or irregular tables may be missed.

## Output behavior and fidelity

| Output | Preserved | Approximation / deliberate limit |
|---|---|---|
| DOCX | editable headings, paragraphs, lists, tables, page breaks | flowing document; exact coordinates, embedded fonts, decorative vectors, and most images omitted |
| XLSX | user-approved table cells, one sheet per table, visible strings | table-only; numeric-looking cells remain strings for verification; no formula invention |
| PPTX | page order, source aspect ratio, visual appearance | each slide is a flattened JPEG/PNG; text and shapes are not separately editable |
| semantic HTML | headings, paragraphs, lists, tables, safe links | reflows; source fonts/images/vector art are limited |
| layout HTML | page boxes and absolute text positions | font matching and rendering can vary by browser; no PDF script or active content |
| EPUB 3 | semantic chapters, navigation, headings/lists/tables | reflow changes pagination; equations and visual layouts require review |
| TXT/Markdown/JSON | reconstructed reading order and page divisions | JSON additionally retains bbox/font/rotation/direction; all structure remains heuristic |
| Audio | local read-aloud controls and reconstructed text | listen only; local voices only; no downloadable audio file |

Generated HTML contains no script and embeds a restrictive content security policy.
PPTX uses full-page rasters because Phase 7 requires visual fidelity first and must not
claim editable slide elements. Every route displays a format-specific compatibility
report before processing.

## Package validation

The writers use deterministic Open Packaging Convention parts rather than a server-side
office suite. DOCX, XLSX, and PPTX ZIPs are reopened and checked for content types,
root relationships, and format-specific document/workbook/presentation parts. PPTX also
checks that each requested slide and media relationship exists. EPUB checks the stored
`mimetype`, container, OPF package, navigation document, and every generated chapter.
HTML is scanned for scripts and required CSP/page structure before download.

## Fixture coverage

Synthetic fixtures cover a two-column report with a spanning heading, repeated
headers/numbered footers, an invoice/bank-style numeric table, plain text that must not
become a table, CJK joins, RTL direction, and an empty scanned page warning. Package
tests reopen DOCX, XLSX, PPTX, and EPUB outputs and inspect semantic and layout HTML.
The browser integration test uploads a generated text PDF and opens a worker-built DOCX.

These controlled fixtures prove regression behavior, not general document accuracy.
Dense scientific papers, mathematical notation, rotated tables, nested layouts,
handwriting, unusual encodings, and low-quality OCR should always be reviewed.

## Libraries and licenses

| Component | Version policy | License | Use |
|---|---|---|---|
| PDF.js (`pdfjs-dist`) | workspace-pinned | Apache-2.0 | local PDF text, metadata, annotations, and raster rendering |
| Tesseract.js/core | workspace-pinned 7.0.0 assets | Apache-2.0 | optional local OCR for text-free pages |
| JSZip | workspace-pinned 3.10.1 | MIT (used under MIT) | package construction and validation |
| PaperZero writers | repository source | project license | minimal DOCX/XLSX/PPTX/EPUB/HTML serialization |

No LibreOffice process, cloud converter, remote font/image fetch, browser speech
recognition, or remote text-to-speech service is used.
