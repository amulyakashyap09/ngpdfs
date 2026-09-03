# Phase 6 — Browser-local conversion into PDF

Status date: 2026-09-03

Phase 6 uses a shared portable-document model and paginator for text-like formats, plus
a direct slide renderer for PPTX. Inputs are read in browser memory and conversion runs
inside PaperZero's existing PDF worker. Every generated PDF is reopened before it is
offered for download. There is no upload endpoint and imported HTML, eBook scripts, and
Office macros are never executed.

## Compatibility matrix

| Input | Advertised formats | Preserved | Approximated | Intentionally unsupported or omitted |
|---|---|---|---|---|
| Word | DOCX | Paragraphs, headings, emphasis, colors, lists, tables, inline PNG/JPEG, page breaks, link appearance | Word pagination, margins, source fonts/run sizes, image sizing; headers/footers become labeled content | Legacy DOC, table border styling, exact pagination, equations, SmartArt, floating text boxes, advanced fields, comments, tracked deletions, macro execution |
| Excel | XLSX, XLSM displayed values | Cell values, cached formula results, basic number/date formats, emphasis/colors/fills/alignment, selected worksheets | Column/row sizing, merged ranges, fit-to-width; wide sheets become ten-column sections | Legacy XLS, formula calculation, cell border styling, VBA, charts, drawing images, pivot interaction |
| PowerPoint | PPTX | Slide order and dimensions, direct backgrounds, positioned text, solid fills, basic shapes/connectors, PNG/JPEG, theme colors, z-order | Gradients, proprietary fonts, mixed-run styling, grouped transforms, text autofit | Legacy PPT/PPTM, master/layout-only objects, shape rotation/shadows, animations, transitions, speaker notes, charts, SmartArt, embedded objects, macros |
| Images | JPG, PNG, WebP | Source order and supported image data; EXIF orientation | Canvas normalization when required | Unsupported codecs; oversized canvases are clamped by device limits |
| HTML | HTML/HTM source or paste | Safe headings, paragraphs, emphasis, links, lists, quotes, code, tables, rules, page breaks, data PNG/JPEG | Small allowlisted inline typography/alignment subset | Scripts, frames, forms, SVG/canvas/media, external resources, flex/grid, full print CSS |
| Markdown | MD/Markdown/TXT or paste | Headings, emphasis, lists, quotes, code, GFM tables, links, page breaks, data PNG/JPEG | Widows/orphans and very wide tables | Raw active HTML, remote images, syntax highlighting |
| CSV | CSV/TSV or paste | Quoted fields/newlines, delimiter override, header repetition, alignment, striping, page numbers | Encoding falls back from UTF-8 to Windows-1252; wide data is horizontally sectioned | More than 10,000 rows or 40 columns per export |
| eBook | EPUB, TXT, HTML/HTM | EPUB metadata/spine order, chapters, headings, basic structure, local PNG/JPEG | Basic CSS, book fonts, widows/orphans | DRM bypass, MOBI/AZW3, scripts, remote resources, interactive media |
| Audio transcript | Browser-decodable audio plus reviewed text | Editable transcript, title/date, paragraphs, user-inserted playback timestamps | None | Automatic recognition in this build, diarization, audio embedding, cloud speech APIs |
| Create PDF | Local rich text | Headings, paragraphs, emphasis, lists, links, images, tables, rules, alignment, page breaks | Browser editing commands and shared pagination | Arbitrary HTML/script, remote assets, collaborative/cloud drafts |

The Audio Transcript route is the conservative fallback allowed by the Phase 6
specification. A practical English Whisper-tiny browser deployment currently requires
roughly 100 MB of model/tokenizer assets plus device-dependent inference memory. This
build does not weaken the self-only CSP or silently call a cloud/browser speech service.
The local player and timestamp insertion still let a user prepare and export a reviewed
transcript. Automatic on-device transcription remains a separately disclosed fidelity
upgrade, not a hidden network feature.

## Shared pagination and safety bounds

- A4 and Letter, portrait/landscape, 18–120 pt margins, 7–24 pt body text, four themes,
  explicit page breaks, repeated table headers, row striping, and optional page numbers.
- Text input: 20 MB in the UI and 25 MB at the worker boundary; transcript text: 2 MB.
- DOCX/XLSX/XLSM/EPUB: 100 MB; PPTX: 120 MB; audio retained in the tab: 250 MB.
- XLSX: 50 selected sheets, 10,000 rows per sheet, 40 columns; PPTX: 250 slides;
  EPUB: 300 spine items and 12 MB per embedded supported image.
- Long parsers yield periodically and report progress. Binary inputs are transferred to
  the worker, cancellation is cooperative with worker termination as the hard fallback.
- Built-in PDF fonts provide deterministic output. Unsupported characters are replaced
  and counted; source Office font names are reported when fallback occurs.

## Parser and dependency policy

| Component | Version | License used for this project | Role |
|---|---:|---|---|
| Marked | 15.0.12 | MIT | Markdown tokenization; tokens become safe document blocks, never injected HTML |
| htmlparser2 | 10.0.0 | MIT | Inert HTML/XML parsing for sanitized HTML, EPUB, and custom OOXML adapters |
| JSZip | 3.10.1 | MIT option | Reads EPUB and Office Open XML packages locally |
| pdf-lib | 1.17.1 | MIT | Shared pagination, direct PPTX drawing, metadata, save, and output re-open validation |

DOCX, XLSX/XLSM, and PPTX parsing is implemented in `packages/pdf-conversion` rather
than claiming a full desktop-Office layout engine. This keeps support boundaries
inspectable and makes the compatibility report part of every conversion result.

## Fixture coverage

Deterministic in-memory fixtures cover Markdown structure and long pagination, hostile
HTML, quoted/wide CSV, multi-chapter EPUB with a local image, DOCX styles/lists/table/
image/link plus an unsupported equation, XLSX multiple sheets/styles/cached formula/
merge disclosure, PPTX text/shapes/theme/image/missing-font fallback and static-feature
omissions, and a known transcript with a timestamp. Production Playwright coverage
also runs Markdown through the actual module worker and validates the downloadable PDF
signature in the browser.

These fixtures establish supported behavior; they do not justify a claim of pixel-perfect
Office fidelity. Real-world Office and mobile-browser smoke testing remains a release task.
