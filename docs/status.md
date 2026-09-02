# Parity status vs. spec (README(2).md)

Status date: 2026-09-03

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

## Phase 2 — Editing suite: COMPLETE

| Tool | Route | Engine | Notes |
|---|---|---|---|
| Edit PDF | /edit-pdf | pdf-editor overlay engine in worker | click-to-edit text runs (cover+redraw w/ size fitting), add styled text boxes, whiteout (clearly NOT redaction), image placement, drag-move, zoom, undo/redo, keyboard shortcuts |
| Sign PDF | /sign-pdf | same editor restricted to image placements | draw/type/upload signature modal; optional white-background removal; never persisted |
| Fill PDF Form | /fill-form-pdf | pdf-lib AcroForm API in worker | text/checkbox/radio/dropdown/optionlist; widget-rect highlights on live preview; flatten-answers option; XFA unsupported disclosed via empty-field path |
| Crop & Resize | /crop-resize-pdf | setCropBox + embedPage vector rebuild in worker | visual drag crop (one/all pages, hidden-content warning); A3/A4/Letter/Legal/custom mm/in/pt with center/fit/fill |
| Headers & Footers | /headers-footers | worker op sharing zone math with preview | {n}/{total}/{date}/{filename} variables, 3 zones per band, margin/size/color/skip-first/ranges |
| Flatten | /flatten-pdf | form.flatten() after appearance generation | signature-field detection warning; annotation-rasterize & JS-strip honestly out of scope for this pass |
| Invert Colors | /invert-colors | main-thread batched raster + pixel transforms | invert/grayscale/sepia/high-contrast/dark-reading; exact original page sizes preserved; rasterization disclosed |
| PDF to Handwriting | /pdf-to-handwriting | canvas render w/ system handwriting fonts -> images-to-PDF | paper styles blank/ruled/grid/margin; deterministic jitter; anti-deception disclaimer |
| Handwriting to PDF | /handwriting-to-pdf | merge plus optional Tesseract OCR | Original pages preserved; Beta handwriting confidence warnings; searchable PDF + TXT |

Editor architecture: one canonical coordinate model (PDF pt <-> CSS px), serializable
command objects ({text, whiteout, image, replace-text}), export = pure function over
commands validated by output re-parse. 34 new tests cover templates, geometry,
editor-export round-trips, crop box readback, resize targets, AcroForm fill/inspect/
flatten and text pagination.

## Phase 3 — Security & Privacy suite: COMPLETE

| Tool | Route | Engine | Notes |
|---|---|---|---|
| Encrypt PDF | /encrypt-pdf | @cantoo/pdf-lib 2.9.1 (MIT) `encrypt()` — AES-256 / R6 in worker | user+optional separate owner passwords, best-effort permission flags; output verified by re-opening with the user password; password state wiped after success/reset and never persisted/logged |
| Remove Password | /remove-password | load-with-password → copy-pages rebuild strips security handler | wrong password maps to WRONG_PASSWORD code; no cracking, ever |
| Unlock Permissions | /unlock-pdf | same strip path | owner-only files demand their password first (honest routing per spec); authorized-use framing |
| Redact PDF | /redact-pdf | rasterize-affected-pages fallback + vector overlay in worker | drag regions OR search-and-mark-all with correct per-page placement; optional REDACTED label; DPI choice; post-export verification extracts text and checks marked terms |
| Auto-Redact PII | /auto-redact-pii | pure detectors over per-item text mapped to glyph rects | email/phone/card(Luhn)/PAN/Aadhaar(Verhoeff)/IP/URL/custom regex; per-candidate review and page highlights; affected pages rendered at 165 DPI; same verification pipeline |
| Privacy Scanner | /privacy-scanner | catalog/page-node inspection via @cantoo/pdf-lib | info/XMP, JavaScript/actions, EmbeddedFiles, annotations/external links, form/signature fields, best-effort JPEG EXIF/GPS detection; reports yes/no/partial removal capability and offers selected vs safe-metadata cleaning |
| Sanitize PDF | /sanitize-pdf | explicit-toggle cleaner op | properties/XMP/JS/attachments/annotations/form-flatten shown BEFORE processing |

Fingerprint tool shipped earlier covers the remaining Phase 3 item.

New package packages/pdf-security (@cantoo/pdf-lib MIT). 23 security tests: AES-256
round-trips incl. wrong-password mapping, Luhn/Verhoeff/PAN vectors, PII grouping,
scanner score improvement after sanitize, annotation/link/JS injection and removal,
redact-build page-count preservation and verification logic.

## Phase 4 — Compression & Performance: COMPLETE

| Tool | Route | Engine | Notes |
|---|---|---|---|
| Compress PDF | /compress-pdf | Ghostscript 10.06.0 via pinned @okathira/ghostpdl-wasm 1.1.0 in dedicated worker | Light/Medium/Heavy, preflight risk analysis, larger-output guard, structural + sample-render validation |
| Compress to ~100 KB | /compress-pdf-to-100kb | same engine and shared UI | Best-effort bounded target workflow; up to 4 passes desktop / 2 constrained device |
| Compress to ~200 KB | /compress-pdf-to-200kb | same engine and shared UI | Unique route metadata/FAQ; smallest valid candidate retained |
| Compress to ~2 MB | /compress-pdf-to-2mb | same engine and shared UI | Same honest target semantics; no guaranteed byte size |

The 15.5 MB WASM artifact is self-hosted, route-lazy, and runtime-cached for offline
reuse. Engine version/commits/integrity, AGPL/commercial-license release gate, complete
arguments, synthetic six-fixture benchmark, visual checks, mobile adaptations, and
known limitations are recorded in `docs/compression-engine.md`.

## Phase 5 — OCR & Scan: COMPLETE

| Tool/integration | Route | Status |
|---|---|---|
| OCR / Searchable PDF | /ocr-pdf | Available: skip text-rich pages, page ranges, English/Spanish, preprocessing, aligned invisible layer, PDF/TXT/MD review |
| Scan to PDF | /scan-to-pdf | Available: explicit camera action + photo fallback, boundary suggestion, four-corner perspective correction, enhancements, stack controls, opt-in OCR |
| Handwriting OCR | /handwriting-to-pdf | Available as Beta: preserved original, confidence warnings, searchable layer and TXT |
| Editor OCR hook | /edit-pdf | Available: scanned-word hit regions feed disclosed whiteout/text overlay editing |

Engine: pinned Tesseract.js/core 7.0.0 (Apache-2.0), with pinned self-hosted English
and Spanish models. Details, asset sizes, language policy, DPI/preprocessing, scan
algorithm, mobile caps, verification, and limitations are in `docs/ocr-and-scan.md`.

The production Playwright suite proves that camera access is not requested before the
explicit button action, exercises successful fake-camera capture and denied-permission
fallback, verifies camera is permitted only on the scan route, then warms the versioned
service-worker caches and reloads `/ocr-pdf` with all six pinned OCR assets while the
browser is offline. The eight-category synthetic OCR benchmark is implemented and
recorded with explicit non-generalization warnings.

## Deliberately not built yet (per spec phase order)

Phase 6–7 office conversion ·
Phase 8 compare/repair · Phase 9 AI · Phase 10 P2P/whiteboard · Phase 11 GST/POS ·
Phase 12 workflow builder · Phase 13 SDK · Phase 14 hardening.

These appear as "coming soon" cards with planned phase labels — no dead links.

## Known limitations (honest)

1. Automated verification comprises 210 passing Vitest tests (including real
   Ghostscript-WASM, Tesseract, pdf-lib round-trips, and worker protocol tests), three
   production Playwright tests, dedicated compression/OCR benchmarks, and an optimized
   build check of all routes. Physical iOS and Android camera behavior still requires
   release-device smoke testing.
2. Extract-text reading order is a heuristic; complex multi-column layouts may need cleanup.
3. Remove Metadata does not strip XMP packets (disclosed).
4. Heavy rendering (PDF→image) runs on the main thread with yields rather than in a
   worker (OffscreenCanvas path is future work); DPI clamps keep it within budget.
5. CSP allows `unsafe-inline` scripts/styles because Next.js hydration requires it
   without nonce middleware (documented trade-off permitted by the spec).
6. PII matching currently depends on an existing text layer. Scanned PDFs require the
   Phase 5 OCR engine. Search-and-redact matches within extracted PDF.js text items;
   terms split across separate glyph runs may need manual region marking.
7. Embedded JPEG EXIF/GPS scanning is best-effort. Detection is reported, but the
   sanitizer does not yet rewrite embedded images and labels those findings non-removable.
8. Compression is a lossy `pdfwrite` rewrite for image content and normally invalidates
   existing digital signatures. Target sizes are best-effort. Public deployment must
   clear the documented AGPL-3.0-or-later or commercial-license release gate.
