# PaperZero

> PDF tools that never see your PDFs.

PaperZero is a local-first, privacy-first PDF toolkit that runs entirely in the browser.
Documents are opened, processed, rendered and validated on-device using Web Workers,
pdf-lib and PDF.js — no uploads, no watermarks, no accounts.

This repository currently implements **Phase 0 (platform foundation) + Phase 1 (core MVP tools)**
of the product roadmap in `README(2).md`, which corresponds to the spec's *Milestone 2 — Public MVP*.

## Quick start

```bash
npm install        # also copies the PDF.js worker into apps/web/public
npm run dev        # http://localhost:3000
```

Other commands:

```bash
npm run build      # production build (statically prerendered)
npm run start      # serve the production build
npm run test       # vitest unit + integration suite (134 tests)
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
| `/extract-text` | Page-separated text; copy, TXT and Markdown download |
| `/remove-metadata` | Strip author/creator/dates etc. (basic cleaner, honestly labeled) |
| `/pdf-fingerprint` | SHA-256 hash computed inside a Web Worker, with verify mode |

Plus `/diagnostics/hash`, a developer route proving the transferable-worker pipeline.

Coming-soon tools (compress, encrypt, redact, OCR, edit, sign …) are listed in the home
catalog with their planned phase and no route yet — no fake links.

## Architecture principles

- **Local-first**: document bytes never leave the browser. There is no upload endpoint.
- **Workers**: all pdf-lib manipulation runs in a pooled module worker with structured
  progress, cancellation (AbortSignal), timeouts, crash recovery and bounded concurrency.
- **Device-adaptive safety**: capability profile (mobile/tablet/desktop, memory class) drives
  DPI caps, canvas-dimension clamps, batch sizes and file-size warnings.
- **Output validation**: every produced PDF is re-parsed; expected page counts are enforced.
- **PWA**: versioned service worker caches the app shell + engines; offline fallback page;
  installable manifest. Security headers ship from `next.config.mjs`.

See [docs/architecture.md](docs/architecture.md) and [docs/privacy.md](docs/privacy.md).

## Testing

`npm run test` covers: range parser, analytics sanitizer (sensitive-key denylist),
capability detection, memory estimates, error mapping, DocumentFile lifecycle,
magic-byte validation, output validation, WorkerPool (fake-worker harness: success,
progress, cancel, timeout, crash recovery, queueing), and real pdf-lib round-trips for
merge/split/organize/watermark/page-numbers/metadata/images-to-PDF, ZIP packaging,
SHA-256 vectors, EXIF parsing, text-line grouping and the full worker dispatch protocol.

## Roadmap

Later phases of `README(2).md` (editor, encryption/redaction, Ghostscript-WASM compression,
OCR/scan, office conversion, compare/repair, AI, P2P, GST tools, workflow builder, SDK)
plug into the operation contract and worker infrastructure defined here.
