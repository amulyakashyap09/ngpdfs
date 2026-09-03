# Architecture

## Layers

```text
apps/web (Next.js)
  pages = thin wrappers: metadata + <ToolPage> + tool client component
  lib/tool-registry.ts   single typed source of truth for tools, SEO, FAQ, related links
  src/workers/pdf.worker.ts  worker entry wiring the operations dispatch handler
  src/workers/compression.worker.ts  isolated, lazy Ghostscript-WASM compression entry

packages/pdf-ui      React components + hooks (useFileDocuments, useOperation)
packages/pdf-operations  pure PDF functions (pdf-lib), worker handler, client facades
packages/pdf-security    encryption, authorized decryption, PII detection, privacy
                         inspection/sanitizing, raster-redaction assembly/verification
packages/pdf-compression preflight, pinned Ghostscript-WASM profiles, bounded targets,
                         output validation, worker protocol and browser client
packages/pdf-conversion safe HTML/Markdown/CSV/audio-transcript adapters, EPUB and
                        custom Office Open XML readers, portable document blocks,
                        shared pagination, PPTX slide drawing, compatibility reports
packages/pdf-extraction positioned PDF.js text model, reading-order and semantic
                        analysis, table confidence, DOCX/XLSX/PPTX/HTML/EPUB writers
packages/pdf-ocr       Tesseract browser session, explicit languages, preprocessing,
                       perspective scan math, searchable-layer assembly/client
packages/pdf-core        file model, validation, pdfjs loader/renderer, WorkerPool,
                         IndexedDB, history, downloader, operation contract/runner
packages/shared          errors, capabilities, memory math, parsing, analytics sanitizer
```

Dependencies point strictly downward. Operations are framework-free; UI never touches
pdf-lib directly.

## Operation flow (example: Merge)

```text
MergeClient
  -> useFileDocuments('pdf')            validation via magic bytes
  -> runMerge(workerRunner, files)      reads bytes once, transfers buffers
     -> WorkerPool.run('merge', payload, {transfer})
        -> pdf.worker.ts -> createWorkerHandler -> mergePdfBytes()
           load each doc (encrypted => ENCRYPTED_PDF error code)
           copyPages into new document
           save (object streams)
           validateOutputPdf: re-parse + expected page count
        progress messages bubble back per phase/file
  -> useOperation state machine: processing -> success | error | cancelled
  -> DownloadResult -> Downloader (Blob URL + revoke, ZIP when multiple outputs)
```

## Worker pool guarantees

- Lazy spawn up to `min(cores-1, 4)` workers; queued overflow.
- Transferables for all payload/result bytes (zero-copy handoff).
- Cancellation: AbortSignal posts a cancel message; a grace timer terminates the
  worker if the cooperative check has not fired, then rejects with CANCELLED.
- Timeouts terminate stuck workers and reject with TIMEOUT.
- `onerror` fails in-flight tasks and recreates the worker on next dispatch.

Compression has its own one-worker pool because the engine carries a 15.5 MB WASM
artifact and a synchronous native pass. It loads only from a compression route. Target
passes share one module within a job; cancellation's grace timeout terminates the worker
if Ghostscript cannot cooperatively return.

Tesseract.js owns a separate OCR worker so recognition never runs on React's thread.
PDF.js rendering remains main-thread/canvas-bound and sequential; the transferable PDF
worker performs invisible-text assembly. Cancelling terminates the OCR worker rather
than waiting for a recognition job to return.

Phase 6 source/EPUB/DOCX/XLSX conversion runs in the transferable PDF worker through
one shared portable-document paginator. PPTX uses the same worker but draws directly at
the source slide dimensions. HTML/XML parsers treat imported content as data: active
elements and remote resources are removed, and macros are never evaluated. See
`docs/conversion-to-pdf.md` for the complete fidelity matrix and safety limits.

Phase 7 first extracts page-normalized PDF.js positions on the main thread, where
PDF.js canvas and font APIs are available. `packages/pdf-extraction` converts those
positions into ordered lines, semantic blocks, repeated-margin findings, links, and
confidence-scored table candidates. Optional scan pages pass through the existing
Tesseract session before the same analyzer runs again. Serializable analysis and any
required page rasters then cross the existing transferable worker boundary to custom,
validated Open XML/HTML/EPUB writers. See `docs/conversion-from-pdf.md`.

## Rendering path

PDF.js runs on the main thread (canvas requirement) but is bounded:

- thumbnails render lazily via IntersectionObserver at capped DPR;
- exports render sequentially with `await yield` between pages;
- DPI is clamped by `maxCanvasDimension` / `maxCanvasPixels` from the capability
  profile (iOS/Safari clamped hardest), and the user is warned when reduced.

## Coordinate system

Watermark and page-number placement share one resolver (`positions.ts`) used by both
the live preview overlay (converted to CSS px) and the final pdf-lib draw calls, so the
preview matches export by construction.

## Storage

- RAM: active parse/render buffers only; canvases zeroed after encode.
- IndexedDB (`paperzero` v1): history metadata (capped 50), preview cache, drafts,
  settings — every call degrades gracefully when unavailable (private mode).
- localStorage: theme + history opt-out flag only.

## Offline / PWA

`public/sw.js`: precaches shell + `/pdf.worker.min.mjs`; runtime caches navigations;
cache-first for hashed static chunks (including the compression worker and Ghostscript
WASM after first use) and `/ocr/` worker/core/language assets; old versions purged on
activate. Registered only in production builds.

## Security headers

CSP (`default-src 'self'`, `worker-src 'self' blob:`, no remote origins), nosniff,
DENY framing, strict referrer, camera/mic/geolocation disabled globally. Next.js
requires `'unsafe-inline'` scripts/styles without nonce middleware — documented trade-off.
