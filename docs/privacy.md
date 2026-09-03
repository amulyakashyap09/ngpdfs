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

The homepage has one explicit exception for project sponsorship: it loads the Bondin
support web component from `https://bondin.io`. The homepage CSP permits only that exact
script and frame origin; PDF tool routes retain the self-only script policy and block all
frames. The current widget opens its cross-origin checkout frame after user interaction.
No PDF/document bytes are present in the widget integration or sent to Bondin, although
normal request metadata such as IP address and user agent is visible to that third party.

## Per-tool data flow matrix

| Tool | File uploaded? | Content to third party? | Internet required? | Local persistence |
|---|---|---|---|---|
| Merge / Split / Organize / Rotate | No | No | No after first load | Optional metadata history |
| Images to PDF | No | No | No after first load | Optional metadata history |
| PDF to JPG/PNG/ZIP | No | No | No after first load | Optional metadata history |
| Watermark / Page numbers | No | No | No after first load | Optional metadata history |
| Extract text / PDF to Word, Excel, HTML, EPUB | No | No | No after optional OCR model is cached | Optional metadata history; extracted text stays in tab/worker memory |
| PDF to PowerPoint | No | No | No after first load | Optional metadata history; page rasters stay in tab/worker memory |
| PDF to Audio | No | No; only browser voices marked local are offered | No after optional OCR model is cached | No audio or text persistence beyond optional metadata history |
| Remove metadata | No | No | No after first load | Optional metadata history |
| Fingerprint (SHA-256) | No | No | No after first load | Optional metadata history |
| Encrypt / Remove password / Unlock permissions | No | No | No after first load | Optional metadata history only; passwords never persist |
| Redact / Auto-redact PII | No | No | No after first load | Optional metadata history; marked text and PII never persist |
| Privacy scanner / Sanitize | No | No | No after first load | Optional metadata history; findings are held in tab memory only |
| Compress / target-size compression | No | No | No after the engine's first load | Optional metadata history; PDF bytes remain in tab/worker memory only |
| OCR / searchable PDF | No | No | No after selected model is cached | Language model in IndexedDB/cache; PDF pixels and text stay in tab/worker memory |
| Scan to PDF | No | No | No after optional OCR model is cached | Captures remain in tab memory; optional metadata history only |
| Word / Excel / PowerPoint to PDF | No | No | No after first load | Office bytes and extracted media stay in tab/worker memory only |
| HTML / Markdown / CSV / eBook to PDF | No | No | No after first load | Source stays in tab/worker memory; remote resources are blocked |
| Create PDF | No | No | No after first load | Draft HTML in this browser's localStorage; clearable in the editor |
| Audio Transcript to PDF | No | No | No after first load | Audio object URL and transcript stay in the tab; no speech API/model cache |

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
- Audio Transcript to PDF deliberately ships the conservative manual-review fallback:
  it plays a local object URL, never contacts a cloud/browser speech service, and does
  not claim speaker diarization. Automatic on-device recognition is not bundled.
- PDF to Audio uses `speechSynthesis` for listen-only playback and filters out every
  voice not explicitly exposed with `localService === true`. Browsers that expose no
  local voice get readable extracted text but no speech fallback and no fake MP3 export.
- Phase 7 semantic conversions can optionally invoke the same self-hosted Tesseract
  assets as OCR PDF. Generated HTML is script-free with a restrictive embedded CSP;
  PDF JavaScript and active annotations are never copied into alternate formats.
