# Privacy

## The core invariant

For every shipped tool:

```text
PDF bytes -> browser memory -> local engine -> validated output -> download
                                   X
                               server
```

There is no upload endpoint in this codebase. `connect-src 'self'` in the CSP blocks any
accidental exfiltration at the browser level.

## Per-tool data flow matrix

| Tool | File uploaded? | Content to third party? | Internet required? | Local persistence |
|---|---|---|---|---|
| Merge / Split / Organize / Rotate | No | No | No after first load | Optional metadata history |
| Images to PDF | No | No | No after first load | Optional metadata history |
| PDF to JPG/PNG/ZIP | No | No | No after first load | Optional metadata history |
| Watermark / Page numbers | No | No | No after first load | Optional metadata history |
| Extract text | No | No | No after first load | Optional metadata history |
| Remove metadata | No | No | No after first load | Optional metadata history |
| Fingerprint (SHA-256) | No | No | No after first load | Optional metadata history |
| Encrypt / Remove password / Unlock permissions | No | No | No after first load | Optional metadata history only; passwords never persist |
| Redact / Auto-redact PII | No | No | No after first load | Optional metadata history; marked text and PII never persist |
| Privacy scanner / Sanitize | No | No | No after first load | Optional metadata history; findings are held in tab memory only |
| Compress / target-size compression | No | No | No after the engine's first load | Optional metadata history; PDF bytes remain in tab/worker memory only |
| OCR / searchable PDF | No | No | No after selected model is cached | Language model in IndexedDB/cache; PDF pixels and text stay in tab/worker memory |
| Scan to PDF | No | No | No after optional OCR model is cached | Captures remain in tab memory; optional metadata history only |

## Analytics

Whitelist-based sanitizer (`packages/shared/src/analytics.ts`): only tool id, event name,
device class, size/page/duration buckets, success and error codes can pass. Filenames,
text, passwords and arbitrary keys are dropped, with unit tests enforcing it. No provider
is wired; the default adapter is a no-op.

## Local history

Optional, on by default for convenience, stored only in IndexedDB: tool id, filename,
size, timestamp (max 50 entries). Never synced. Clearable per item or entirely.
Storage failures never break processing.

## Known honest limitations

- "Remove Metadata" clears info-dictionary fields; embedded XMP packets may survive.
  The UI says so explicitly.
- Future cloud-AI or P2P features must disclose exactly what leaves the device before
  first use — enforced as a product rule in the spec and registry schema
  (`remoteProcessingDisclosure`).
- EXIF/GPS detection inside embedded JPEGs is best-effort. The scanner labels these
  findings as not currently removable because the sanitizer does not rewrite images.
- Auto-PII works on PDFs with an extractable text layer. Scanned documents need the
  OCR PDF tool before pattern detection can inspect them.
- Compression uses a self-hosted Ghostscript WebAssembly binary in a dedicated worker.
  Its hashed worker and WASM assets are cached after first use; PDFs are never placed in
  the service-worker cache.
- Camera permission is requested only after the Scan to PDF user action. The response
  policy permits camera requests only on `/scan-to-pdf`; every other route receives
  `camera=()`. Denial leaves photo import available. Camera frames, crop geometry, OCR
  text, and generated PDFs are not persisted by the service worker.
