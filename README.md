# PaperZero

> PDF tools that never see your PDFs.

PaperZero is a local-first, privacy-first PDF toolkit that runs entirely in the browser.
Documents are opened, processed, rendered and validated on-device using Web Workers,
pdf-lib and PDF.js — no uploads, no watermarks, no accounts.

This repository currently implements **Phases 0–7** of the product roadmap in
`README(2).md`: foundation, core tools, editing, security/privacy, compression,
OCR/scanning, and browser-local conversion into and out of PDF.

## Implementation status

| Phase | Area | Shipped scope |
|---|---|---|
| 0 | Foundation | Strict Next.js/TypeScript app, typed SEO registry, reusable UI, transferable worker pool, cancellation/timeouts, local history, device limits, PWA/offline shell, CSP and privacy-safe analytics |
| 1 | Core PDF tools | Merge, split, organize, rotate, images to PDF, PDF to image/ZIP, watermark, page numbers, text extraction, metadata removal and SHA-256 fingerprints |
| 2 | Editing | Overlay editor, signatures, AcroForm filling, crop/resize, headers/footers, flattening, color transforms and handwriting workflows |
| 3 | Security and privacy | AES-256 encryption, authorized password/permission removal, irreversible raster redaction, reviewed PII detection, privacy scanning and sanitization |
| 4 | Compression | General compression plus best-effort 100 KB, 200 KB and 2 MB targets using bounded, self-hosted Ghostscript WebAssembly |
| 5 | OCR and scanning | Local Tesseract OCR, searchable PDFs, camera/photo scanning, perspective correction, handwriting Beta and editor OCR integration |
| 6 | Convert to PDF | Word, Excel, PowerPoint, HTML, Markdown, CSV, EPUB/TXT/HTML ebooks, reviewed audio transcripts and a rich-text composer |
| 7 | Convert from PDF | Word, Excel, PowerPoint, HTML, EPUB, browser read-aloud and high-fidelity Extract Text V2 through a shared layout-analysis engine |

## Quick start

```bash
npm install        # copies pinned PDF.js and OCR runtime assets into apps/web/public
npm run dev        # open http://localhost:3000
```

Other commands:

```bash
npm run build      # production build (statically prerendered)
npm run start      # serve the production build
npm run test       # Vitest unit + integration suite
npm run lint       # eslint (flat config)
npm run typecheck  # strict TypeScript across all workspaces
```

## Monorepo layout

```text
apps/
  web/                     Next.js 15 App Router UI + PWA (manifest, service worker)
packages/
  shared/                  errors, capability detection, memory math, range parser,
                           privacy-safe analytics sanitizer, filename/format utils
  pdf-core/                DocumentFile model, magic-byte validation, PDF.js loader &
                           renderer, WorkerPool, IndexedDB storage + history, downloader,
                           operation contract & runner
  pdf-operations/          merge / split / organize / rotate / watermark / page numbers /
                           images-to-PDF / extract-text / remove-metadata / zip / sha256,
                           plus the worker dispatch handler
  pdf-conversion/          safe source/eBook/Office adapters, portable document model,
                           pagination, PPTX renderer, compatibility reporting
  pdf-extraction/          positioned text/layout analysis, table confidence, local
                           DOCX/XLSX/PPTX/HTML/EPUB writers and text export formats
  pdf-compression/         bounded Ghostscript-WASM compression and validation
  pdf-editor/              overlay editing, forms, crop/resize, rich PDF operations
  pdf-ocr/                 Tesseract sessions, preprocessing, scan geometry, assembly
  pdf-security/            encryption, authorized unlock, redaction, privacy scanning
  pdf-ui/                  FileDropzone, FileCardList, PageThumbnail, PageGrid, progress,
                           download result, live preview, tool page layout, hooks
tests/                     (fixtures are co-located per package under src/*.test.ts)
docs/                      architecture & privacy notes
scripts/copy-pdf-worker.mjs  pins the pdfjs worker asset for offline/self-hosted use
```

## Available tools

Every public tool has a dedicated route with unique metadata, FAQ structured data,
instructions, related tools, and an explicit local/remote-processing disclosure.

### Core and editing (Phases 1–2)

| Route | Tool |
|---|---|
| `/merge-pdf` | Merge multiple PDFs with reordering |
| `/split-pdf` | Split by ranges (`1-3,5`), selection, every page, every N pages |
| `/organize-pdf` | Visual page grid: reorder / rotate / duplicate / delete + undo-redo |
| `/rotate-pdf` | Structural rotation (90/180/270), all or selected pages |
| `/images-to-pdf` | JPG/PNG/WebP → PDF with EXIF orientation, size/margin/fit options |
| `/pdf-to-jpg` | PDF → JPG/PNG at 72–600 DPI with device-aware clamping |
| `/pdf-to-zip` | All pages → numbered images in a ZIP |
| `/watermark-pdf` | Text/image watermark with live placement preview |
| `/add-page-numbers` | Header/footer numbering with formats `1`, `Page 1`, `1 / N` |
| `/extract-text` | Semantic/column-aware extraction; TXT, Markdown and positioned JSON |
| `/remove-metadata` | Strip author/creator/dates etc. (basic cleaner, honestly labeled) |
| `/pdf-fingerprint` | SHA-256 hash computed inside a Web Worker, with verify mode |
| `/edit-pdf` | Replace visible text runs; add/move text, images and whiteout overlays with undo/redo |
| `/sign-pdf` | Draw, type or import a signature without retaining it |
| `/fill-form-pdf` | Fill supported AcroForm fields and optionally flatten answers |
| `/crop-resize-pdf` | Visual crop plus A3/A4/Letter/Legal/custom page resizing |
| `/headers-footers` | Three-zone headers and footers with page/date/file variables |
| `/flatten-pdf` | Flatten form fields with disclosed annotation limitations |
| `/invert-colors` | Invert, grayscale, sepia, high-contrast or dark-reading raster output |
| `/pdf-to-handwriting` | Render typed PDF content in configurable handwriting styles |
| `/handwriting-to-pdf` | Preserve handwritten pages with optional Beta OCR/searchable text |

### Security, compression and scanning (Phases 3–5)

| Route | Tool |
|---|---|
| `/encrypt-pdf` | AES-256 password protection with user/owner controls |
| `/remove-password` | Authorized password removal; no cracking workflow |
| `/unlock-pdf` | Authorized permission-handler removal |
| `/redact-pdf` | Manual or text-search redaction with rasterized affected pages and verification |
| `/auto-redact-pii` | Review email, phone, card, PAN, Aadhaar, IP, URL or custom-regex findings |
| `/privacy-scanner` | Inspect metadata, scripts, attachments, links, forms and best-effort image EXIF |
| `/sanitize-pdf` | Apply explicitly selected metadata and active-content cleanup |
| `/compress-pdf` | Light, medium or heavy bounded Ghostscript-WASM compression |
| `/compress-pdf-to-100kb`, `/compress-pdf-to-200kb`, `/compress-pdf-to-2mb` | Best-effort target-size compression with retained smallest valid candidate |
| `/ocr-pdf` | English/Spanish on-device OCR with searchable PDF, TXT and Markdown output |
| `/scan-to-pdf` | Explicit camera/photo capture, boundary suggestion, perspective correction and optional OCR |

### Convert into PDF (Phase 6)

| Route | Tool |
|---|---|
| `/word-to-pdf`, `/excel-to-pdf`, `/powerpoint-to-pdf` | Local Office Open XML conversion with compatibility reports |
| `/html-to-pdf`, `/markdown-to-pdf`, `/csv-to-pdf` | Safe source parsing through the shared paginator |
| `/ebook-to-pdf`, `/audio-to-pdf` | Sanitized eBooks and conservative local transcript workflow |
| `/create-pdf` | Rich-text composer with a browser-only draft |

### Convert from PDF (Phase 7)

| Route | Tool and fidelity mode |
|---|---|
| `/pdf-to-word`, `/pdf-to-excel` | Editable DOCX reconstruction and reviewed table-to-XLSX export |
| `/pdf-to-powerpoint` | Visual-fidelity PPTX with one flattened slide per PDF page |
| `/pdf-to-html`, `/pdf-to-epub` | Semantic/layout HTML and reflowable EPUB 3 |
| `/pdf-to-audio` | Read aloud with browser voices explicitly marked as local |
| `/extract-text` | Extract Text V2: paragraphs, column order, repeated-margin cleanup, OCR, TXT/Markdown/positioned JSON |

Phase 7 first collects positioned PDF.js text with coordinates, font hints, rotation,
direction, page number, and safe links. The shared analyzer reconstructs rows, lines,
columns, headings, paragraphs, lists, and table candidates. Scanned pages can invoke the
Phase 5 OCR service inside Word, Excel, HTML, EPUB, audio and extraction routes.

Table export is confidence-gated: alignment, recurring column boundaries, row density,
header emphasis and numeric evidence are reported to the user, and candidates below 68%
cannot be exported to Excel. DOCX prioritizes flowing editability; PPTX prioritizes visual
fidelity and clearly remains flattened; HTML offers semantic and positioned modes; EPUB
is intentionally reflowable; browser speech is listen-only and never claims an MP3/WAV
download.

Plus `/diagnostics/hash`, a developer route proving the transferable-worker pipeline.

Later-phase tools remain listed in the home catalog with their planned phase and no
fake links. See [docs/status.md](docs/status.md) for the exact parity matrix.

## Architecture principles

- **Local-first**: document bytes never leave the browser. There is no upload endpoint.
- **Workers**: all pdf-lib manipulation runs in a pooled module worker with structured
  progress, cancellation (AbortSignal), timeouts, crash recovery and bounded concurrency.
- **Device-adaptive safety**: capability profile (mobile/tablet/desktop, memory class) drives
  DPI caps, canvas-dimension clamps, batch sizes and file-size warnings.
- **Output validation**: produced PDFs are re-parsed with expected page counts enforced;
  Office/EPUB packages are reopened and checked for required relationships and parts.
- **PWA**: versioned service worker caches the app shell + engines; offline fallback page;
  installable manifest. Security headers ship from `next.config.mjs`.

Detailed implementation and fidelity notes:

- [Architecture](docs/architecture.md)
- [Privacy and per-tool data flow](docs/privacy.md)
- [Exact Phase 0–7 parity status](docs/status.md)
- [Compression engine, profiles, benchmarks and licensing](docs/compression-engine.md)
- [OCR, scan pipeline, assets and benchmark policy](docs/ocr-and-scan.md)
- [Conversion into PDF](docs/conversion-to-pdf.md)
- [Conversion from PDF](docs/conversion-from-pdf.md)

## Testing

The current verification baseline is **228 passing Vitest tests**, with two heavyweight
benchmarks intentionally opt-in, plus **5 passing production Playwright tests**. The
optimized Next.js build statically prerenders all **59 routes**.

Coverage includes parsers and coordinate math, privacy sanitization, device/memory
limits, file lifecycle and magic bytes, cancellation/timeouts/crash recovery, real
pdf-lib and Ghostscript/Tesseract integrations, security round-trips, worker dispatch,
layout fixtures for reports/resumes/tables/RTL/CJK/scans, and reopening generated
DOCX/XLSX/PPTX/EPUB packages. Browser tests exercise camera consent/fallback, offline OCR
assets, Markdown-to-PDF output and PDF-to-DOCX through the production worker.

## Roadmap

Phases 8–14 of `README(2).md` remain deliberately unimplemented: compare/repair, AI,
P2P/whiteboard, GST/POS, workflow builder, SDK and final hardening. They remain visible
as planned catalog entries without dead tool links or premature capability claims.
