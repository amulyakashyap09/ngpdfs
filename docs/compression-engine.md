# PDF compression engine

Status date: 2026-09-02

## Engine and supply chain

PaperZero Phase 4 uses `@okathira/ghostpdl-wasm` **1.1.0**, pinned exactly in
`packages/pdf-compression/package.json` and `package-lock.json`. The npm artifact:

- is built from `okathira/ghostpdl-wasm` commit
  `a62b7d686b21cf88f6425b3e989d1062b9af4256` with npm provenance;
- contains GhostPDL commit `2d6e764c1f4a73520ed6de6dd3fa78ad30cd6a63`;
- reports Ghostscript **10.06.0** (`GS_REVISIONDATE=20250909`);
- has lockfile integrity
  `sha512-BX0Y8B0G/c0nsf7pZGHPQTZ8IiT4w0IEbZGDnziN4pkcmxU1eEaWI/LA0bfE5Y+uSP3Qj1oZ6JhITOJbJsyE0w==`;
- was built with Emscripten 4.0.13, a virtual filesystem, `callMain`, and growing
  WebAssembly memory.

The production build emits the 15,533,045-byte engine as a hashed, self-hosted
`/_next/static/media/gs.*.wasm` asset. It is not fetched from a CDN. The compression
route and dedicated worker are lazy-loaded, so other tools do not pay this download
cost. The service worker's cache-first static-asset rule stores the hashed worker and
WASM after their first successful load, enabling later compression runs offline.

### License gate

Both this wrapper package and GhostPDL/Ghostscript are licensed
**AGPL-3.0-or-later**. This repository is currently marked `UNLICENSED`; that does not
override or satisfy the engine's license. A public or network-accessible deployment
must comply with all applicable AGPL source-and-notice obligations, or obtain an
appropriate commercial Ghostscript license from Artifex. This is an explicit release
gate, not legal advice. The engine must not be distributed from a closed-source build
until that choice has been reviewed and completed.

## Execution model

`compression.worker.ts` is separate from the general PDF worker. The UI transfers the
input buffer to it, the worker analyzes and compresses the PDF, and only the validated
output buffer is transferred back. Cancellation sends the normal cooperative message;
because a synchronous Ghostscript pass cannot process messages while running, the
existing worker-pool grace timer forcibly terminates and recreates that dedicated
worker. A ten-minute hard timeout handles stuck jobs.

A fresh Emscripten module is initialized for each top-level compression job. Reusing
the same module across many documents caused unstable native state in stress testing;
one module is still reused safely for the bounded passes within a single target-size
job.

## Presets

All presets use `pdfwrite`, PDF 1.7, duplicate-image detection, font compression and
subsetting, annotation preservation, bicubic color/gray downsampling, and explicit
JPEG recompression. Each pass starts from the original input, never from the previous
lossy output.

| Preset | Color / gray | Monochrome | JPEG quality | Intended use |
|---|---:|---:|---:|---|
| Light | 220 DPI | 400 DPI | 88 | Print or small reductions |
| Medium | 150 DPI | 300 DPI | 80 | Balanced default |
| Heavy | 96 DPI | 200 DPI | 65 | Stronger image reduction |
| Target fallback 1 | 72 DPI | 150 DPI | 52 | Aggressive target retry |
| Target fallback 2 | 56 DPI | 120 DPI | 42 | Last bounded retry |

## Preflight and target-size workflow

Preflight reports input bytes, page count, unique top-level page images, a content
classification, optimization hints, estimated compressibility, memory risk, and time
class. These are deliberately coarse risk models, not measured peak memory or runtime
promises. Encrypted PDFs are routed to password removal before the engine loads.
Signature fields trigger a warning because rewriting a signed PDF normally invalidates
its digital signature.

Target mode chooses its first preset from `target / input` and then moves through
progressively stronger profiles. It stops when the target is reached or after four
passes; phones and low-memory devices cap this at two. Every candidate is reparsed and
must preserve the page count. The smallest valid candidate is retained. If none is
smaller than the source, PaperZero reports that fact and creates no download. A target
is always best-effort because content sets a practical lower bound.

Before download, the browser also renders page 1 of the winning PDF with PDF.js. This
catches outputs that parse structurally but fail the application's rendering path.

## Synthetic benchmark

The benchmark is deterministic and contains no user files. Run it with:

```sh
PAPERZERO_COMPRESSION_BENCHMARK=1 npm exec vitest run packages/pdf-compression/src/benchmark.test.ts
```

Results below are from the 2026-09-02 development machine. Times are wall-clock
samples, not product performance claims. Randomized synthetic images compress more
dramatically than many real photographs, so percentages must not be generalized.

| Fixture | Source | Light | Medium | Heavy |
|---|---:|---:|---:|---:|
| 3-page text report | 5,508 B | 4,378 B (20.5%, 127 ms) | 4,378 B (20.5%, 45 ms) | 4,376 B (20.6%, 41 ms) |
| High-resolution scan | 7,443,010 B | 629,395 B (91.5%, 160 ms) | 390,362 B (94.8%, 131 ms) | 111,939 B (98.5%, 100 ms) |
| 3-slide photo presentation | 7,197,306 B | 614,141 B (91.5%, 157 ms) | 614,141 B (91.5%, 124 ms) | 256,089 B (96.4%, 117 ms) |
| Vector brochure | 6,307 B | 7,726 B (0%, 45 ms) | 7,726 B (0%, 41 ms) | 7,724 B (0%, 40 ms) |
| Already-optimized blank PDF | 677 B | 3,267 B (0%, 33 ms) | 3,267 B (0%, 31 ms) | 3,265 B (0%, 34 ms) |
| 105-page text document | 43,780 B | 39,033 B (10.8%, 123 ms) | 39,033 B (10.8%, 112 ms) | 39,029 B (10.9%, 107 ms) |

For rows where the engine output grew, savings are reported as zero and no replacement
file is offered. First-page sample renders were inspected for the text, scan, and
presentation fixtures: text remained readable and the image fixtures retained their
layout and color structure, while Heavy visibly removed fine image noise as expected.
The Node/V8 harness cannot reliably attribute peak process memory to the WebAssembly
instance, so no fabricated peak-memory number is reported.

## Known unsupported and lossy cases

- Password-protected PDFs must be unlocked first; PaperZero never attempts cracking.
- Existing digital signatures will normally become invalid after a rewrite.
- Image downsampling and JPEG recompression are lossy, especially at 72/56 DPI.
- Malformed or exotic PDFs may be rejected even when another viewer opens them.
- The selected WASM build disables fontconfig. Embedded fonts are requested and
  subsetted, but unusual unembedded fonts can be substituted.
- Some advanced interactive features, incremental revisions, metadata, and producer-
  specific structures may be normalized by `pdfwrite`; users should compare important
  documents before replacing an original.
- Very large/image-heavy PDFs can exceed browser memory. Per-device input limits and
  reduced mobile retries lower that risk but cannot eliminate it.
