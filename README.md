# PaperZero

> PDF tools that never see your PDFs.

PaperZero is a local-first, privacy-first PDF toolkit that runs entirely in the browser.
Documents are opened, processed, rendered and validated on-device using Web Workers,
pdf-lib and PDF.js — no uploads, no watermarks, no accounts.

This repository currently implements **Phases 0–7** of the product roadmap in
`README(2).md`: foundation, core tools, editing, security/privacy, compression,
OCR/scanning, and browser-local conversion into and out of PDF.

## Quick start

```bash
npm install        # also copies the PDF.js worker into apps/web/public
npm run dev        # http://localhost:3000
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

## Available tools (each with a dedicated SEO route)

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
| `/word-to-pdf`, `/excel-to-pdf`, `/powerpoint-to-pdf` | Local Office Open XML conversion with compatibility reports |
| `/html-to-pdf`, `/markdown-to-pdf`, `/csv-to-pdf` | Safe source parsing through the shared paginator |
| `/ebook-to-pdf`, `/audio-to-pdf` | Sanitized eBooks and conservative local transcript workflow |
| `/create-pdf` | Rich-text composer with a browser-only draft |
| `/pdf-to-word`, `/pdf-to-excel` | Editable DOCX reconstruction and reviewed table-to-XLSX export |
| `/pdf-to-powerpoint` | Visual-fidelity PPTX with one flattened slide per PDF page |
| `/pdf-to-html`, `/pdf-to-epub` | Semantic/layout HTML and reflowable EPUB 3 |
| `/pdf-to-audio` | Read aloud with browser voices explicitly marked as local |

Plus `/diagnostics/hash`, a developer route proving the transferable-worker pipeline.

Later-phase tools remain listed in the home catalog with their planned phase and no
fake links. See [docs/status.md](docs/status.md) for the exact parity matrix.

## Architecture principles

- **Local-first**: document bytes never leave the browser. There is no upload endpoint.
- **Workers**: all pdf-lib manipulation runs in a pooled module worker with structured
  progress, cancellation (AbortSignal), timeouts, crash recovery and bounded concurrency.
- **Device-adaptive safety**: capability profile (mobile/tablet/desktop, memory class) drives
  DPI caps, canvas-dimension clamps, batch sizes and file-size warnings.
- **Output validation**: every produced PDF is re-parsed; expected page counts are enforced.
- **PWA**: versioned service worker caches the app shell + engines; offline fallback page;
  installable manifest. Security headers ship from `next.config.mjs`.

See [docs/architecture.md](docs/architecture.md), [docs/privacy.md](docs/privacy.md),
and [docs/conversion-to-pdf.md](docs/conversion-to-pdf.md) plus
[docs/conversion-from-pdf.md](docs/conversion-from-pdf.md).

## Testing

`npm run test` covers: range parser, analytics sanitizer (sensitive-key denylist),
capability detection, memory estimates, error mapping, DocumentFile lifecycle,
magic-byte validation, output validation, WorkerPool (fake-worker harness: success,
progress, cancel, timeout, crash recovery, queueing), and real pdf-lib round-trips for
merge/split/organize/watermark/page-numbers/metadata/images-to-PDF, ZIP packaging,
SHA-256 vectors, EXIF parsing, text-line grouping and the full worker dispatch protocol.

## Roadmap

Later phases of `README(2).md` (compare/repair, AI, P2P,
GST tools, workflow builder, SDK, and hardening) plug into the operation contract and
worker infrastructure defined here.
