# OCR and browser scanning

Status date: 2026-09-03

## OCR engine and assets

Phase 5 uses `tesseract.js` **7.0.0** and `tesseract.js-core` **7.0.0**, both
Apache-2.0. The application pins Tesseract rather than using a range. Lockfile
integrities are:

- `tesseract.js`: `sha512-exPBkd+z+wM1BuMkx/Bjv43OeLBxhL5kKWsz/9JY+DXcXdiBjiAch0V49QR3oAJqCaL5qURE0vx9Eo+G5YE7mA==`
- `tesseract.js-core`: `sha512-WnNH518NzmbSq9zgTPeoF8c+xmilS8rFIl1YKbk/ptuuc7p6cLNELNuPAzcmsYw450ca6bLa8j3t0VAtq435Vw==`

The initial language set is deliberately small:

| Language | Package | Selected model | Download size | Package license |
|---|---|---|---:|---|
| English | `@tesseract.js-data/eng` 1.0.0 | `4.0.0_best_int` | 2,952,873 B | MIT |
| Spanish | `@tesseract.js-data/spa` 1.0.0 | `4.0.0_best_int` | 2,100,190 B | MIT |

`scripts/copy-ocr-assets.mjs` copies the browser worker, three LSTM-only core
variants (baseline, SIMD, relaxed SIMD), and those two compressed models into
`public/ocr` during install. Generated assets are ignored by Git but are part of the
production build. The web prebuild recreates the directory and verifies the exact six-
file manifest and minimum expected sizes, so stale core variants cannot silently enter
a deployment. No OCR file comes from a CDN at runtime. The chosen worker is about
111 KB; each selectable core is about 3.9 MB. Only the device-compatible core and
selected language are fetched.

The service worker uses cache-first handling for `/ocr/`. Tesseract also writes the
trained model to IndexedDB under `paperzero-ocr-v1`. After one successful online model
load, subsequent recognition can run offline. PDF/image contents are never placed in
either cache.

## PDF OCR workflow

`/ocr-pdf` accepts one PDF and an optional page range. For each selected page it:

1. extracts the existing PDF.js text layer;
2. skips pages with at least 40 useful characters unless Force OCR is enabled;
3. renders one page at a time, normally at 220 DPI;
4. optionally preprocesses the temporary OCR bitmap;
5. recognizes text in Tesseract's own Web Worker and retains word boxes/confidence;
6. converts raster coordinates back to PDF points with PDF.js's viewport transform;
7. adds standard non-rendering (`Tr 3`) text to the original page in the PDF worker;
8. validates page count, then extracts a sample page's text with PDF.js.

The original visible page content and dimensions remain intact. Temporary OCR canvases
are zeroed after every page. Recognition is sequential. Cancellation terminates the
Tesseract worker, disposes the active canvas in `finally`, and leaves the original file
selected for retry.

The result view reports per-page status, confidence, editable text review, and
low-confidence warnings. PDF, plain text, and Markdown outputs are available, along
with corrected TXT/Markdown downloads. Corrections do not rewrite the searchable PDF's
word layer because free-form page text no longer has trustworthy source coordinates.
Text-rich pages remain unchanged and contribute their existing text to text output.

### Preprocessing

Preprocessing affects recognition only, never the visible PDF page:

- luminosity grayscale;
- min/max contrast normalization;
- Otsu adaptive thresholding;
- optional 3x3 median noise reduction;
- Tesseract automatic rotation/deskew for recognition.

300 DPI is available for small print, 220 DPI is the balanced default, and 180 DPI is
the mobile option. Every render is still clamped by Phase 0 canvas dimension/pixel
limits.

## Scan-to-PDF pipeline

`/scan-to-pdf` requests `getUserMedia` only after the user presses **Start camera**.
Photo import remains available when camera APIs or permission are unavailable. Manual
capture is used; automatic capture is intentionally not claimed.

The lightweight boundary suggestion downsamples the photo, computes neighboring luma
gradients, and encloses the reliable high-gradient region. It falls back to the entire
image when the score/area is weak. It is not presented as authoritative. Four 44 px
corner handles support pointer dragging and keyboard arrows (Shift for larger steps),
with numeric X/Y percentages as a non-drag alternative.

Export solves an eight-parameter homography from the selected quadrilateral to a
rectangle, inverse-maps pixels with bilinear sampling, applies rotation and one of four
enhancements (original, auto contrast, grayscale, black-and-white), then builds the PDF
once for the whole stack. Pages can be reordered, rotated, or deleted without repeatedly
encoding PDFs. Corrected dimensions are capped at 3,200 px on desktop and 2,200 px on
other device classes.

“Make text searchable” is opt-in because it costs time and battery. It recognizes the
already-corrected page images sequentially and uses the same invisible-layer assembly.

## Handwriting and editor integration

Handwriting recognition is explicitly **Beta**. Tesseract is trained primarily for
printed text; PaperZero retains each original handwriting page, reports low-confidence
pages, and exports recognized TXT for manual correction. It never silently substitutes
recognized text for the original scan.

The Phase 2 editor can now request English OCR for image-only pages. OCR word boxes are
fed into the existing Edit text hit-region path. Choosing a word creates the same
disclosed whiteout-plus-text overlay as other editor replacements; it is not secure
reconstruction or redaction.

## Verification and limitations

Unit coverage includes preprocessing, thresholding, perspective identity, dimension
caps, weak-edge fallback, initial language policy, and searchable-PDF structural
round-trip. A real Tesseract integration test loads the pinned local English model and
recognizes a deterministic bitmap fixture. That deliberately crude synthetic font is an
engine smoke test, not an accuracy claim.

The gated eight-category benchmark runs with
`PAPERZERO_OCR_BENCHMARK=1 npx vitest run packages/pdf-ocr/src/ocr-benchmark.test.ts`.
These 5x7 bitmap fixtures exercise paths deterministically but are intentionally unlike
normal typography, so the low figures below are regression baselines—not broad OCR
accuracy claims. The 2026-09-02 development run recorded:

| Fixture | Character accuracy | Confidence | Runtime |
|---|---:|---:|---:|
| Clean synthetic scan | 42.9% | 37% | 42 ms |
| Low contrast | 42.9% | 18% | 18 ms |
| Skewed glyphs | 57.1% | 55% | 22 ms |
| Rotated 90° | 0% | 53% | 42 ms |
| Two-column approximation | 58.6% | 33% | 32 ms |
| Mixed text/color block | 78.6% | 47% | 17 ms |
| Already-searchable text | skipped correctly | 100% | 0 ms |
| Spanish model | 100% | 80% | 12 ms |

The rotated regression confirms why users must review OCR rather than trust automatic
orientation blindly. Future acceptance thresholds should use licensed or project-owned
realistic print fixtures, not tune production behavior to this toy font.

Production browser coverage runs with `npm run test:e2e`. Playwright starts the
optimized application and verifies that `getUserMedia` is never invoked before explicit
user action, captures a page from Chromium's fake camera, and exercises denied-camera
photo fallback. It also confirms the scan route receives `camera=(self)` while other
routes receive `camera=()`. The offline test waits for service-worker control, warms all
six pinned OCR assets, switches the browser network fully offline, reloads `/ocr-pdf`,
and byte-checks every asset from cache.

Known limitations:

- Only English and Spanish are enabled initially. Adding a language requires a pinned,
  licensed model, storage disclosure, fixtures, and invisible-font validation.
- The initial invisible layer uses a built-in Latin font. Characters outside its
  encoding are skipped with a warning rather than corrupting the output.
- Two-column reading order follows Tesseract hierarchy and may need cleanup.
- Deskew improves recognition but does not visually rotate/alter the original PDF.
- Edge detection is a conservative rectangular envelope, not a semantic document AI;
  perspective corners always require review.
- Browser camera behavior varies by HTTPS context, iOS Safari, Android Chrome, device
  orientation, and camera hardware. Photo import is the supported fallback.
- Very large photos can still pressure memory before the canvas cap is applied during
  decode. Mobile users should capture/import one page at a time where possible.
- General OCR provides page-text correction for TXT/Markdown. Correcting individual
  searchable-PDF word boxes still uses overlay editing in Edit PDF.
- Automated camera tests use Chromium's deterministic fake video device. Physical iOS
  Safari and Android Chrome remain part of release-device smoke testing because their
  permission UI, camera orientation, and memory behavior cannot be reproduced exactly
  by desktop browser automation.
