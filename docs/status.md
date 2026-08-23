# Parity status vs. spec (README(2).md)

Status date: 2026-08-23

## Phase 0 — Foundation: COMPLETE

| Requirement | Status |
|---|---|
| Next.js + TS strict + Tailwind app shell, responsive, dark/light | Complete |
| Searchable typed tool catalog + categories + related tools | Complete |
| Tool page shell (breadcrumbs, chips, how-it-works, FAQ, related) | Complete |
| Accessible dropzone (click/drag/keyboard), validation errors | Complete |
| Magic-byte PDF/image validation | Complete |
| DocumentFile abstraction (File/Blob/ArrayBuffer/Uint8Array) + dispose | Complete |
| WorkerPool: lazy spawn, bounded concurrency, progress, cancel, timeout, crash recovery | Complete |
| Diagnostic SHA-256 worker op proving transferables (`/diagnostics/hash`) | Complete |
| Operation contract + runner (validate → execute → validate output) | Complete |
| Device capability profile + render memory estimation + canvas disposal | Complete |
| Typed IndexedDB layer + 50-item local history with clear controls | Complete (storage + recording; UI surface = storage layer) |
| Service worker/PWA (versioned caches, offline fallback, manifest) | Complete |
| Download manager (Blob URL revoke, Safari delay, ZIP packaging) | Complete |
| Privacy-safe analytics adapter + sanitizer tests | Complete |
| Security headers (CSP/nosniff/referrer/permissions-policy) | Complete |
| Accessibility (skip link, aria-live progress/errors, focus states, 44px targets) | Complete |
| Tests incl. fake-worker cancel/timeout/crash cases | Complete |

## Phase 1 — Core MVP tools: COMPLETE (11 tools) + fingerprint bonus

| Tool | Route | Engine | Notes |
|---|---|---|---|
| Merge | /merge-pdf | pdf-lib in worker | lossless copy; mixed sizes preserved; encrypted rejected w/ code |
| Split | /split-pdf | pdf-lib in worker | ranges `1-3,5` parser fully unit-tested; every-page/every-N; ZIP for multi-output |
| Organize | /organize-pdf | pdf-lib in worker | drag+button reorder, rotate, duplicate, delete, undo/redo, export-on-apply |
| Rotate | /rotate-pdf | same engine | structural /Rotate only |
| Images to PDF | /images-to-pdf | canvas normalize + pdf-lib | EXIF orientation matrix, auto/A4/Letter, margins, contain/cover, WebP→canvas |
| PDF to JPG/PNG | /pdf-to-jpg | PDF.js renderer | DPI presets clamped by capability profile, batched, warnings when reduced |
| PDF to ZIP | /pdf-to-zip | shared renderer | page-001 naming, JSZip STORE |
| Watermark | /watermark-pdf | pdf-lib in worker | text+image, 9 positions, rotation, opacity, color, page ranges, live preview sharing placement math |
| Page numbers | /add-page-numbers | pdf-lib in worker | header/footer × l/c/r, formats, start number, prefix/suffix, skip-first, live preview |
| Extract text | /extract-text | PDF.js text layer | line grouping heuristic, TXT/MD export, honest scanned/no-text warnings |
| Remove metadata | /remove-metadata | pdf-lib in worker | labeled "basic"; XMP limitation disclosed in UI + docs |
| Fingerprint | /pdf-fingerprint | Web Crypto in worker | SHA-256, verify mode, checksum file |

SEO: every tool has unique title/description/canonical/OpenGraph, FAQ JSON-LD,
WebApplication JSON-LD, how-it-works steps, related tools, breadcrumbs.
Sitemap + robots generated from the registry.

## Deliberately not built yet (per spec phase order)

Phase 2 editor/sign/forms · Phase 3 encryption/redaction/privacy scanner ·
Phase 4 Ghostscript-WASM compression · Phase 5 OCR/scan · Phase 6–7 office conversion ·
Phase 8 compare/repair · Phase 9 AI · Phase 10 P2P/whiteboard · Phase 11 GST/POS ·
Phase 12 workflow builder · Phase 13 SDK · Phase 14 hardening.

These appear as "coming soon" cards with planned phase labels — no dead links.

## Known limitations (honest)

1. Playwright E2E suites are specified in the README but not included here; verification
   is via 134 vitest tests (incl. real pdf-lib round-trips and the full worker protocol)
   plus a production-build smoke check of all routes.
2. Extract-text reading order is a heuristic; complex multi-column layouts may need cleanup.
3. Remove Metadata does not strip XMP packets (disclosed).
4. Heavy rendering (PDF→image) runs on the main thread with yields rather than in a
   worker (OffscreenCanvas path is future work); DPI clamps keep it within budget.
5. CSP allows `unsafe-inline` scripts/styles because Next.js hydration requires it
   without nonce middleware (documented trade-off permitted by the spec).
