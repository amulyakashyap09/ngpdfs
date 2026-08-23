# PaperZero

> Private, local-first PDF tools that run in your browser.

PaperZero is a browser-based document toolkit inspired by products such as ihatepdf.cv. The core product principle is simple:

**Your documents stay on your device.**

PDF processing should happen locally in the browser using JavaScript, Web Workers, WebAssembly, and browser storage wherever technically possible. Server-side processing should only be introduced when a feature genuinely requires it.

---

## Product Positioning

### Core promise

- No file uploads for standard PDF operations
- No watermark
- No account required for core tools
- Works offline after assets are cached
- Fast client-side processing
- Privacy-first by architecture, not merely by policy
- Desktop and mobile friendly
- One dedicated SEO landing page per tool

### Suggested tagline

> PDF tools that never see your PDFs.

Alternative:

> Your PDF. Your browser. Your data.

---

# Product Roadmap

The goal is eventual feature parity with ihatepdf.cv while building the product in an order that minimizes technical risk and maximizes the number of useful tools shipped early.

---

# Phase 0 — Product Foundation

## Goal

Build the reusable platform that every PDF tool will use.

## Deliverables

### Application shell

- Next.js
- TypeScript
- React
- Tailwind CSS
- Responsive layout
- Dark/light theme
- Tool search
- Tool categories
- Related-tools navigation
- Mobile-friendly UI

### Shared file experience

Build reusable components:

- File dropzone
- File picker
- Multiple-file picker
- Drag-and-drop ordering
- PDF thumbnail preview
- Page grid
- Progress indicator
- Cancel operation
- Error states
- Download result
- Reset/start-over action

### PDF core package

Suggested structure:

```text
packages/
  pdf-core/
    loader.ts
    renderer.ts
    downloader.ts
    file-validation.ts
    memory-manager.ts
    worker-manager.ts
    storage.ts

  pdf-operations/
    merge.ts
    split.ts
    rotate.ts
    organize.ts
    watermark.ts

  pdf-ui/
    FileDropzone.tsx
    PageThumbnail.tsx
    PageGrid.tsx
    ProcessingProgress.tsx
    DownloadResult.tsx

apps/
  web/
```

### Browser processing layer

Use:

- File API
- ArrayBuffer
- Uint8Array
- Blob
- Object URLs
- IndexedDB
- Web Workers

Avoid converting large PDFs to Base64 unless absolutely necessary.

### Libraries

Initial stack:

- `pdf-lib`
- `pdfjs-dist`
- `idb`
- Web Workers

Later phases:

- MuPDF WASM
- Ghostscript WASM
- OCR engine
- FFmpeg WASM where useful
- WebRTC for peer-to-peer sharing

### Worker architecture

```text
Main Thread
    |
    | postMessage()
    v
PDF Worker
    |
    +-- PDF parsing
    +-- rendering
    +-- manipulation
    +-- WASM execution
    |
    v
processed Uint8Array
    |
    v
Main Thread
    |
    v
Blob -> Download
```

### Offline support

Implement:

- Service worker
- Static asset caching
- WASM caching
- App shell caching
- Offline-compatible tool pages

### Privacy architecture

Core invariant:

```text
PDF bytes
   |
   v
Browser memory / IndexedDB
   |
   +----> Local PDF engine
   |
   X
Server
```

No document bytes should reach analytics, logs, error trackers, or backend APIs for standard tools.

---

# Phase 1 — Essential PDF Tools

## Goal

Launch a genuinely useful MVP with the highest-demand, lowest-risk PDF operations.

## Tools

### 1. Merge PDF

Features:

- Multiple PDF selection
- Drag-and-drop ordering
- Thumbnail preview
- Unlimited page ordering
- Download merged PDF

Engine:

- pdf-lib

---

### 2. Split PDF

Modes:

- Split every page
- Extract selected pages
- Extract page ranges
- Split every N pages

Examples:

```text
1-3
5
8-12
```

Engine:

- pdf-lib

---

### 3. Organize Pages

Features:

- Reorder
- Delete
- Rotate
- Duplicate
- Select multiple pages
- Bulk actions

Engine:

- PDF.js for previews
- pdf-lib for output

---

### 4. Rotate PDF

Features:

- Rotate all pages
- Rotate selected pages
- 90 degrees
- 180 degrees
- 270 degrees

---

### 5. Images to PDF

Input:

- JPG
- JPEG
- PNG
- WebP

Features:

- Reorder images
- Page size
- Orientation
- Margins
- Fit/fill

---

### 6. PDF to JPG / PNG

Features:

- All pages
- Selected pages
- JPG/PNG
- DPI presets

Suggested presets:

- 72 DPI
- 150 DPI
- 300 DPI
- 600 DPI where memory allows

Output:

- Individual images
- ZIP download for multiple pages

---

### 7. Add Watermark

Support:

- Text watermark
- Image watermark
- Opacity
- Rotation
- Position
- Page selection

---

### 8. Add Page Numbers

Options:

- Position
- Starting number
- Prefix
- Suffix
- Font size
- Page range

---

### 9. Extract Text

Features:

- Extract full document
- Page-by-page output
- Copy text
- Download `.txt`
- Download `.md`

---

### 10. Remove Metadata

Strip:

- Author
- Creator
- Producer
- Subject
- Keywords
- Creation date
- Modification metadata where possible

---

## Phase 1 launch criteria

The public launch should happen once these are production-ready:

- Merge
- Split
- Organize
- Rotate
- Images to PDF
- PDF to JPG
- Watermark
- Page numbers

Do not wait for all later tools.

---

# Phase 2 — PDF Editing

## Goal

Move from utility/conversion tools into document editing.

## Tools

### Edit PDF Text

Capabilities:

- Detect text objects
- Click text
- Modify text
- Add text boxes
- Font controls
- Color
- Position
- Delete added elements

This is substantially harder than simple page manipulation because existing PDF text is often composed from positioned glyphs rather than document-like paragraphs.

Recommended approach:

1. Render page with PDF.js
2. Extract text positions
3. Build editable overlay
4. Hide/cover original region where necessary
5. Draw replacement content into the output PDF

---

### Crop PDF

Features:

- Visual crop box
- Apply to one page
- Apply to all pages
- Presets

---

### Resize PDF

Presets:

- A4
- A3
- Letter
- Legal
- Custom dimensions

---

### Headers and Footers

Support:

- Custom text
- Date
- Filename
- Page number
- Different first page
- Position configuration

---

### Create PDF

Browser-based document editor:

- Rich text
- Headings
- Lists
- Images
- Links
- Tables
- Page breaks
- Export PDF

---

# Phase 3 — Security & Privacy

## Goal

Turn privacy into a major product category rather than only a marketing claim.

## Tools

### Encrypt PDF

Requirements:

- Password protection
- Strong encryption
- Permission settings where supported

Possible engine:

- MuPDF WASM
- qpdf WASM
- another audited PDF crypto implementation

---

### Remove PDF Password

Flow:

```text
Password-protected PDF
        |
        v
Enter password locally
        |
        v
Decrypt in browser
        |
        v
Save unencrypted PDF
```

The password must never leave the browser.

---

### Redact PDF

Important:

A black rectangle placed over text is **not sufficient**.

True redaction should:

1. Identify underlying objects
2. Remove/redact those objects
3. Draw the redaction overlay
4. Remove associated text where possible
5. Verify extracted text does not expose it

Features:

- Draw redaction region
- Search-and-redact
- Redact repeated text
- Permanent output

---

### Flatten PDF

Flatten:

- Form fields
- Annotations
- Signatures where appropriate
- Interactive elements

---

### Privacy Risk Scanner

Scan locally for:

- Author metadata
- Creator metadata
- GPS metadata in embedded images
- Hidden annotations
- Attachments
- JavaScript
- Forms
- Embedded files
- Comments
- Document properties

Risk output:

```text
Privacy score: 72 / 100

Found:
- Author name
- Creation software
- 3 comments
- 1 embedded attachment
```

CTA:

**Remove all privacy risks**

---

# Phase 4 — Compression & Performance

## Goal

Add one of the most searched-for PDF features while maintaining browser-only processing.

## Compress PDF

Presets:

### Light

- Minimal visual impact
- Stream cleanup
- Object compression

### Medium

- Moderate image downsampling
- Font optimization

### Heavy

- Aggressive image recompression
- Reduced DPI
- Maximum size reduction

Possible architecture:

```text
PDF
 |
 v
Web Worker
 |
 v
Ghostscript / MuPDF WASM
 |
 +-- image downsampling
 +-- JPEG recompression
 +-- stream compression
 +-- object cleanup
 +-- font optimization
 |
 v
Compressed PDF
```

UI should show:

```text
Original       14.2 MB
Compressed      4.8 MB

Saved          66%
```

### Memory safeguards

Implement:

- Maximum render dimensions
- Worker termination
- Memory estimates
- Mobile-specific limits
- Incremental page processing where possible
- Graceful out-of-memory recovery

---

# Phase 5 — OCR & Scanned Documents

## Goal

Handle image-based PDFs and document scanning.

## OCR PDF

Flow:

```text
PDF
 |
 v
Render page
 |
 v
Image
 |
 v
OCR Worker
 |
 v
Text + coordinates
 |
 v
Invisible searchable text layer
 |
 v
Searchable PDF
```

Features:

- Language selection
- Searchable PDF
- Extracted text
- Confidence score
- Page-level processing status

Potential engines:

- Tesseract.js / WASM
- ONNX Runtime Web
- WebGPU-assisted OCR later

---

## Scan to PDF

Mobile-first.

Features:

- Camera import
- Multiple pages
- Auto crop
- Deskew
- Perspective correction
- Contrast enhancement
- Grayscale
- Black and white mode
- Reorder scans
- Export PDF

---

# Phase 6 — Document Conversion

## Goal

Reach broad converter parity.

## Input to PDF

Build:

- Markdown to PDF
- HTML to PDF
- CSV to PDF
- Excel to PDF
- PowerPoint to PDF
- Word to PDF
- eBook to PDF

---

## PDF to Other Formats

Build:

- PDF to Word
- PDF to Excel
- PDF to PowerPoint
- PDF to HTML
- PDF to EPUB
- PDF to ZIP

### Difficulty warning

High-fidelity:

- PDF -> Word
- PDF -> Excel
- PDF -> PowerPoint
- Word -> PDF
- PowerPoint -> PDF

are significantly harder than page-level PDF manipulation.

PDF stores positioned content, not necessarily logical document structure.

Build these only after the PDF engine is stable.

---

# Phase 7 — Compare & Repair

## Compare PDFs

Initial version:

- Side-by-side pages
- Synchronized scrolling
- Page navigation
- Overlay mode

Advanced version:

- Text diff
- Added text
- Removed text
- Changed text
- Visual pixel diff
- Page alignment

---

## Repair PDF

Recovery pipeline:

```text
Broken PDF
   |
   +--> Normal parser
   |
   +--> Rebuild xref
   |
   +--> Scan object markers
   |
   +--> Recover page tree
   |
   +--> Reconstruct document
```

Possible engine:

- MuPDF WASM

Return a report:

```text
Recovered pages: 38 / 40
Recovered images: 113
Recovered fonts: 7

Warnings:
- Page 17 contained an unreadable image
- Two bookmarks were lost
```

---

# Phase 8 — AI PDF Tools

## Goal

Introduce AI without compromising the privacy story.

## Chat with PDF

Architecture:

```text
PDF
 |
 v
Local text extraction
 |
 v
Chunking
 |
 v
Relevant chunks
 |
 v
AI Gateway
 |
 v
LLM
 |
 v
Answer
```

Only extracted text needed for a query should leave the device when a cloud LLM is used.

Possible providers:

- OpenAI
- Gemini
- Anthropic

Be explicit in the UI:

> Your PDF is processed locally. Relevant extracted text is sent to the selected AI provider to answer your question.

---

## AI PDF Summarizer

Modes:

- Quick summary
- Bullet summary
- Detailed summary
- Executive summary
- Key actions
- Key dates
- Key entities

---

## Local AI Mode

Later differentiation:

Run smaller models locally via:

- WebGPU
- Transformers.js
- ONNX Runtime Web

Possible local tasks:

- Embeddings
- Classification
- Named entity recognition
- PII detection
- Short summaries

---

# Phase 9 — Audio & Accessibility

## PDF to Audio

Features:

- Extract PDF text
- Choose pages
- Voice
- Playback speed
- Chapter navigation
- Export audio where supported

Prefer browser speech capabilities or on-device models where practical.

---

## Audio to PDF

Flow:

```text
Audio
 |
 v
Speech recognition
 |
 v
Transcript
 |
 v
Formatted document
 |
 v
PDF
```

Support:

- MP3
- WAV
- M4A
- other browser-decodable formats

---

# Phase 10 — Sharing & Collaboration

## P2P File Share

Goal:

Transfer PDFs without storing them on your servers.

Architecture:

```text
Browser A
   |
   | WebRTC data channel
   |
Browser B
```

Backend only handles:

- Signaling
- Session setup

It should not store the transferred document.

Features:

- Share code
- QR code
- Expiring session
- Transfer progress
- Encryption
- Connection status

---

## Collaborative Whiteboard

Features:

- Drawing
- Shapes
- Text
- PDF page background
- Multiple participants
- Presence
- Shared pointer
- Export to PDF

Potential technologies:

- WebRTC
- WebSocket signaling
- CRDT/Yjs

---

# Phase 11 — Business Tools

These are adjacent products rather than essential PDF functionality, so they should come later.

## GST Invoice Generator

Features:

- Seller information
- Buyer information
- GSTIN
- Invoice number
- HSN/SAC
- CGST
- SGST
- IGST
- Discounts
- Line items
- PDF export

---

## POS Billing

Features:

- Product catalog
- Cart
- GST
- Discounts
- Receipt
- PDF invoice
- Thermal print layout

---

## PDF Fingerprinting

Purpose:

Generate slightly unique copies of the same document to identify the probable source of leaked documents.

Possible signals:

- Invisible identifiers
- Metadata identifiers
- Subtle object-level changes
- Recipient-specific IDs

Do not claim the system is impossible to remove.

---

# Phase 12 — Differentiation: PDF Workflow Builder

This should become a major differentiator.

Instead of forcing users to download and re-upload between tools:

```text
Upload PDF
   |
   v
Remove metadata
   |
   v
Redact PII
   |
   v
Add watermark
   |
   v
Compress
   |
   v
Encrypt
   |
   v
Download
```

Represent each action as an operation:

```ts
pipeline([
  removeMetadata(),
  redactPII(),
  watermark({
    text: "CONFIDENTIAL"
  }),
  compress({
    level: "medium"
  }),
  encrypt({
    password
  })
])
```

Users could save reusable workflows such as:

### Share confidential document

```text
Privacy scan
-> Remove metadata
-> Redact selected fields
-> Add watermark
-> Compress
-> Encrypt
```

### Publish document

```text
Remove metadata
-> Add page numbers
-> Add footer
-> Compress
```

---

# Phase 13 — Developer SDK & API

Once the browser engine is stable, expose it to developers.

## JavaScript SDK

Example:

```ts
import { PDF } from "@paperzero/sdk";

const result = await PDF.merge([
  fileA,
  fileB
]);

download(result);
```

---

## Browser API

Expose:

```ts
PDF.merge()
PDF.split()
PDF.rotate()
PDF.compress()
PDF.watermark()
PDF.redact()
PDF.extractText()
PDF.toImage()
PDF.encrypt()
```

---

## Server SDK

Optional later product:

- Node.js
- Python
- Go

This is a separate commercial offering because server-side processing introduces infrastructure cost.

---

# SEO Roadmap

SEO should be treated as a product feature.

Create dedicated pages:

```text
/merge-pdf
/split-pdf
/compress-pdf
/pdf-to-jpg
/jpg-to-pdf
/edit-pdf
/rotate-pdf
/organize-pdf
/watermark-pdf
/add-page-numbers
/encrypt-pdf
/unlock-pdf
/redact-pdf
/flatten-pdf
/ocr-pdf
/pdf-to-word
/word-to-pdf
/pdf-to-excel
/excel-to-pdf
/pdf-to-powerpoint
/powerpoint-to-pdf
/markdown-to-pdf
/html-to-pdf
/pdf-to-epub
/pdf-to-audio
/chat-with-pdf
/summarize-pdf
/compare-pdf
/repair-pdf
```

Every page should contain:

1. Clear H1
2. Working tool immediately visible
3. Privacy explanation
4. How it works
5. FAQ
6. Related tools
7. Structured data
8. Canonical URL
9. OpenGraph metadata
10. Search-specific title and description

Example title:

```text
Merge PDF Online Free - No Upload, No Watermark | PaperZero
```

---

# Analytics

Privacy-friendly analytics only.

Track events such as:

```text
tool_opened
file_selected
processing_started
processing_completed
processing_failed
download_clicked
related_tool_clicked
```

Never collect:

- File names unless explicitly anonymized
- File content
- Extracted document text
- PDF metadata
- Passwords

Useful dimensions:

- Tool
- Browser
- Device class
- Approximate size bucket
- Page-count bucket
- Processing duration bucket
- Success/failure reason

---

# Performance Targets

Initial targets:

| Metric | Target |
|---|---:|
| Initial app load | < 2 sec |
| Tool interaction readiness | < 3 sec |
| Merge 10 small PDFs | < 3 sec |
| 20-page preview | < 5 sec |
| UI blocking | < 100 ms chunks |
| Standard tools server uploads | 0 |
| Core-tool availability | 99.9%+ |
| Core processing dependency on backend | None |

---

# Browser Support

Prioritize:

1. Chrome
2. Edge
3. Firefox
4. Safari
5. Mobile Chrome
6. Mobile Safari

Use progressive enhancement for:

- WebAssembly
- Web Workers
- SharedArrayBuffer
- WebGPU
- File System Access API

Do not make the core experience depend on optional browser APIs.

---

# Security

Required controls:

- Strong Content Security Policy
- No arbitrary third-party scripts on document-processing pages
- WASM integrity/version pinning
- Dependency scanning
- No PDF bytes in logs
- Worker isolation
- Strict input validation
- File-type verification
- Malformed PDF handling
- Memory and CPU guards
- Kill long-running workers
- Never execute embedded PDF JavaScript

---

# Repository Structure

Recommended monorepo:

```text
paperzero/
  apps/
    web/

  packages/
    pdf-core/
    pdf-worker/
    pdf-operations/
    pdf-renderer/
    pdf-ui/
    ocr/
    wasm/
    analytics/
    shared/

  public/
    wasm/
    workers/
    icons/

  tests/
    fixtures/
    integration/
    e2e/

  docs/
    architecture/
    privacy/
    tools/
```

---

# Technical Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

## PDF

- pdf-lib
- PDF.js
- MuPDF WASM
- Ghostscript WASM where required

## Browser

- Web Workers
- WebAssembly
- IndexedDB
- Service Workers
- File API
- Blob / ArrayBuffer

## OCR / ML

- Tesseract / WASM initially
- ONNX Runtime Web
- WebGPU later

## Optional backend

- Node.js
- Fastify
- PostgreSQL
- Redis only if required
- Cloudflare Workers / CDN

Backend should be used for:

- AI proxy
- billing
- authentication
- feature configuration
- signaling
- anonymous analytics aggregation

It should not be required for core PDF processing.

---

# Deployment

Recommended:

```text
                   Cloudflare CDN
                         |
             +-----------+-----------+
             |                       |
         Next.js                  WASM assets
       static pages                 workers
             |
             |
             X
       PDF processing
             |
             v
      USER'S BROWSER
```

Optional:

```text
Browser
   |
   +------ /api/ai ------ AI Gateway
   |
   +------ analytics ---- Analytics API
   |
   +------ account ------ Auth API
```

---

# Monetization

Keep basic tools free.

Potential paid features:

### PaperZero Pro

- Batch automation
- Saved workflows
- Larger AI context
- Advanced OCR
- Advanced redaction
- Local document search
- More AI models
- Workflow presets

### PaperZero Teams

- Shared workflow templates
- Organization policy presets
- Audit configuration
- Branding
- Team billing

### PaperZero Developer

- SDK
- API
- Server-side processing
- Usage-based billing

Core privacy-first browser PDF utilities should remain free to maximize distribution and SEO.

---

# Launch Sequence

## Milestone 1 — Internal Alpha

Ship:

- Core engine
- PDF preview
- Merge
- Split
- Rotate

---

## Milestone 2 — Public MVP

Ship:

- Merge
- Split
- Organize
- Rotate
- Images to PDF
- PDF to JPG
- Watermark
- Page numbers
- Extract text
- Metadata removal

---

## Milestone 3 — Privacy Suite

Ship:

- Encrypt
- Unlock
- Flatten
- Privacy scanner
- Redaction

---

## Milestone 4 — Heavy WASM

Ship:

- Compression
- OCR
- Scan to PDF
- Repair

---

## Milestone 5 — Conversion Suite

Ship:

- Markdown to PDF
- HTML to PDF
- CSV to PDF
- Word / Excel / PowerPoint conversion
- EPUB
- PDF to Office formats

---

## Milestone 6 — Intelligence

Ship:

- Compare PDFs
- Chat with PDF
- AI summarizer
- Local PII detection

---

## Milestone 7 — Platform

Ship:

- Workflow Builder
- P2P Share
- JavaScript SDK
- Developer API

---

# Feature-Parity Checklist

## Essentials

- [ ] Merge PDF
- [ ] Compress PDF
- [ ] Split PDF
- [ ] PDF to JPG
- [ ] Word to PDF
- [ ] PDF to Word
- [ ] Images to PDF

## Edit & Organize

- [ ] Edit PDF text
- [ ] Organize pages
- [ ] Rotate PDF
- [ ] Crop & resize
- [ ] Add watermark
- [ ] Add page numbers
- [ ] Headers & footers
- [ ] Extract text
- [ ] OCR / searchable PDF

## Security & Privacy

- [ ] Encrypt PDF
- [ ] Remove password
- [ ] Redact PDF
- [ ] Flatten PDF
- [ ] Privacy scanner

## Convert & Export

- [ ] Create PDF
- [ ] Markdown to PDF
- [ ] HTML to PDF
- [ ] Excel to PDF
- [ ] CSV to PDF
- [ ] PowerPoint to PDF
- [ ] PDF to PowerPoint
- [ ] PDF to Excel
- [ ] PDF to HTML
- [ ] PDF to EPUB
- [ ] PDF to audio
- [ ] eBook to PDF
- [ ] Audio to PDF
- [ ] PDF to ZIP
- [ ] Invert PDF colours

## AI

- [ ] Chat with PDF
- [ ] AI PDF summarizer
- [ ] Compare PDFs
- [ ] Repair PDF

## Scan & Share

- [ ] Scan to PDF
- [ ] P2P share
- [ ] Collaborative whiteboard

## Business

- [ ] GST invoice generator
- [ ] POS billing
- [ ] PDF fingerprinting

---

# Product Principles

### 1. Local first

If an operation can reasonably run on-device, run it on-device.

### 2. Privacy by architecture

Do not upload files and then promise to delete them.

Avoid receiving them at all.

### 3. Zero friction

Core tools should work without:

- registration
- email
- payment details

### 4. No watermark

Do not intentionally degrade free output.

### 5. Fast first interaction

Users should reach the file picker immediately.

### 6. One engine, many tools

Do not build 40 isolated applications.

Every tool should compose shared PDF operations.

### 7. Kill workers, not the browser

Heavy processing belongs in workers.

### 8. Be honest about AI

If extracted text is sent to a cloud LLM, say so clearly.

---

# Name

Working product name:

# PaperZero

Why it works:

- "Paper" immediately communicates documents.
- "Zero" reinforces zero uploads, zero watermark, and zero friction.
- Short enough for a product logo.
- Broad enough to expand beyond PDFs.
- Does not imitate the naming of iLovePDF / iHatePDF.

Suggested positioning:

> **PaperZero — PDF tools that never see your PDFs.**

Before committing to the name, verify domain availability, app-store naming conflicts, trademarks, and existing companies/products.

---

# Alternative Names

## 1. PaperZero — Recommended

Best overall brand.

```text
PaperZero
PDF tools that never see your PDFs.
```

## 2. LocalPDF

Extremely clear positioning.

```text
LocalPDF
Your documents stay local.
```

Downside: highly descriptive and therefore potentially harder to own as a brand.

## 3. PrivatePDF

Immediately communicates the privacy benefit.

```text
PrivatePDF
Process documents without uploading them.
```

## 4. PDFLocal

Functional and SEO-friendly.

```text
PDFLocal
Private PDF tools in your browser.
```

## 5. PaperLock

Stronger security positioning.

```text
PaperLock
Private document tools for the browser.
```

## 6. ZeroUpload

Strong privacy statement and expandable beyond PDFs.

```text
ZeroUpload
Tools that work without uploading your files.
```

## 7. DocLocal

Broad enough to cover PDF, Word, spreadsheets, ebooks, and images.

```text
DocLocal
Documents processed on your device.
```

---

# Recommended Brand Direction

Use:

# PaperZero

with the message:

> **PDF tools that never see your PDFs.**

Supporting copy:

> Merge, split, compress, edit, convert, sign, redact and organize PDFs directly in your browser. No uploads. No watermark. No account required.

The architectural moat is not simply having many PDF tools.

It is:

```text
Local processing
      +
Shared PDF engine
      +
WASM
      +
Privacy
      +
SEO distribution
      +
Composable workflows
```

That combination can eventually turn PaperZero from a PDF utility site into a privacy-first document processing platform.

# Detailed Implementation Prompts — Research-Derived Build Specification

> Research snapshot: 2026-08-23
>
> These prompts are intended to be copied into a coding agent one phase at a time. They are **instructions only**. Do not run them automatically. Each phase assumes the previous phases have been completed, tested, and merged.

## Important product-cloning boundary

The goal is **functional parity and comparable UX quality** with the researched reference product, not copying its brand, logo, exact marketing copy, proprietary assets, or distinctive trade dress. Build the same categories of functionality, privacy model, offline behavior, and interaction patterns under the PaperZero brand with original visual design and wording.

## Research basis

The prompts below were built after reviewing the live product homepage, tool pages, and technical architecture documentation. Observed reference URLs include:

- https://www.ihatepdf.cv/
- https://www.ihatepdf.cv/technical-blog
- https://www.ihatepdf.cv/compress-pdf
- https://www.ihatepdf.cv/edit-pdf-text
- https://www.ihatepdf.cv/ocr-pdf
- https://www.ihatepdf.cv/privacy-scanner
- https://www.ihatepdf.cv/repair-pdf
- https://www.ihatepdf.cv/p2p-share
- https://www.ihatepdf.cv/fingerprint-pdf
- https://www.ihatepdf.cv/excel-to-pdf
- https://www.ihatepdf.cv/pptx-to-pdf
- https://www.ihatepdf.cv/pdf-to-excel
- https://www.ihatepdf.cv/summarize-pdf
- https://www.ihatepdf.cv/compare-pdfs
- https://www.ihatepdf.cv/scan-to-pdf
- https://www.ihatepdf.cv/collab-whiteboard
- https://www.ihatepdf.cv/gst-invoice
- https://www.ihatepdf.cv/pos-billing

### Observed product behavior to preserve in PaperZero

1. Core PDF operations are local-first and do not upload document bytes to the application server.
2. The primary promise is no upload, no watermark, no sign-up for standard tools, and offline operation after initial asset caching.
3. The reference architecture uses browser binary APIs, PDF.js, pdf-lib, Web Workers, WebAssembly for heavy operations, IndexedDB for large binary data, localStorage for lightweight metadata, and RAM for active processing.
4. Large-file limits are device-adaptive rather than arbitrary account limits. The reference documentation describes practical targets around 50 MB on phones, 75 MB on tablets, and up to roughly 150 MB on capable desktops, with actual limits dependent on browser memory.
5. PDF rendering and image export use PDF.js and canvas, with DPI-aware scaling and memory safeguards.
6. Compression uses Ghostscript compiled to WebAssembly and exposes Light, Medium, and Heavy presets. The reference also surfaces targeted compression use cases such as 100 KB, 200 KB, and 2 MB outputs.
7. OCR uses Tesseract.js/WebAssembly to add a searchable invisible text layer to scanned PDFs.
8. PDF editing presents click-to-edit text, original-font matching where possible, added text, images, whiteout blocks, and signatures. Scanned pages can fall back to OCR-assisted editing.
9. Privacy tooling includes metadata inspection, redaction, password protection/removal, flattening, automatic PII detection, and cryptographic file fingerprints.
10. Compare PDF is primarily a synchronized side-by-side visual comparison. A sophisticated automatic semantic diff is an optional enhancement, not required for initial parity.
11. Repair PDF attempts multiple recovery strategies for malformed xref tables, missing trailers, truncation, broken page trees, and related structural damage.
12. Office conversion is local where possible. Observed examples include SheetJS/JSZip/jsPDF-style browser processing for spreadsheet and presentation workflows.
13. Scan to PDF uses browser camera APIs, local cropping/deskew/enhancement, multi-page capture, and PDF generation.
14. P2P sharing and collaborative whiteboard use WebRTC with signaling/session coordination but no file/content storage on an application server.
15. Chat-with-PDF extracts text locally and can send text context to an external LLM. The binary PDF itself is not sent. The UI must disclose this clearly.
16. Some AI marketing on the reference product uses phrases such as “on-device AI,” while other pages state that extracted text is sent to an AI API. PaperZero must avoid ambiguous privacy claims and tell the user exactly what leaves the device for each AI mode.
17. Local history is stored in browser storage, with the reference describing recent-file history capped around 50 items.
18. The live search surface has evolved beyond the older 46-tool index. Newer surfaced cards include a workflow builder, standalone signing, PDF-to-handwriting, handwriting-to-PDF, PDF form filling, owner-permission unlocking, auto-redact PII, and GST filing preparation. Treat the full observed superset as the parity target rather than relying on the displayed tool count.

## Full observed parity surface

PaperZero should ultimately cover the following functional families:

### Page management

- Merge PDF
- Compress PDF
- Split PDF
- Organize pages
- Rotate PDF
- Crop and resize
- PDF to ZIP
- PDF Workflow Builder

### Edit and annotate

- Edit PDF text
- Add signature / Sign PDF
- Add text and images
- Whiteout
- PDF to handwriting
- Handwriting to PDF
- Fill PDF form
- Redact PDF
- Add watermark
- Add page numbers
- Headers and footers
- Flatten PDF
- Invert PDF colors

### Convert to PDF

- Word to PDF
- Images to PDF
- Excel to PDF
- PowerPoint to PDF
- HTML to PDF
- Create PDF
- Markdown to PDF
- CSV to PDF
- Audio to PDF
- eBook to PDF

### Convert from PDF

- PDF to Word
- PDF to JPG / PNG
- PDF to Excel
- PDF to PowerPoint
- Extract text
- PDF to HTML
- PDF to Audio
- PDF to EPUB

### Security and privacy

- Encrypt PDF
- Remove password with known password
- Unlock owner restrictions on a document the user is authorized to modify
- Auto-redact PII
- Privacy risk scanner
- Fingerprint/hash generator

### AI and smart tools

- Chat with PDF
- AI PDF summarizer
- OCR/searchable PDF
- Compare PDFs
- Repair PDF

### Scan, collaborate, and share

- Scan to PDF
- P2P file share
- Collaborative whiteboard

### Business

- GST invoice generator
- POS billing
- GST filing preparation

---

# Global Master Prompt for the Coding Agent

Copy this once at the start of the implementation session before giving it any phase-specific prompt.

```text
You are the principal engineer responsible for building PaperZero, a production-quality, privacy-first, browser-based PDF and document toolkit.

Your mission is to achieve functional parity with a modern local-first PDF web application while using original PaperZero branding, original UI design, and original copy. Do not copy logos, trademarks, source code, marketing copy, or proprietary assets from any reference site. Reproduce functionality and interaction quality, not brand identity.

NON-NEGOTIABLE PRODUCT PRINCIPLES

1. LOCAL-FIRST
   - For every standard PDF operation, document bytes must stay inside the user's browser.
   - Do not upload PDFs, images, Office files, OCR inputs, signatures, invoices, audio, or extracted text unless the feature explicitly requires an external AI provider and the user has been clearly informed.
   - Do not send document contents to analytics, logging, error monitoring, APM, session replay, or telemetry services.

2. PRIVACY BY ARCHITECTURE
   - Prefer an architecture where the server cannot access user files rather than relying on a deletion policy.
   - Never claim “nothing leaves your device” for a feature that sends extracted text or other content to a remote provider.
   - Clearly identify remote processing before it occurs.

3. NO WATERMARK FOR CORE TOOLS
   - Do not add product watermarks to exported files.

4. NO ACCOUNT REQUIRED FOR CORE TOOLS
   - Core tools must work anonymously.
   - Authentication may be added later for optional sync/billing features, but it must never be a dependency for basic local tools.

5. OFFLINE-FIRST
   - Once required application assets and WASM bundles have been cached, core local tools should continue to function without network access.
   - Avoid dependencies that silently require a remote CDN at operation time.
   - Self-host production JS/WASM assets where licensing allows.

6. PERFORMANCE
   - Heavy parsing, OCR, rendering, compression, repair, conversion, and hashing must not block the UI thread.
   - Use Web Workers and transferable ArrayBuffers where practical.
   - Explicitly release canvas memory, object URLs, workers, temporary arrays, and large references.

7. LARGE-FILE SAFETY
   - Detect device/browser capabilities.
   - Estimate memory before high-DPI rendering and heavy transformations.
   - Adapt quality, batch size, and concurrency based on device capability.
   - Never allow one giant Promise.all across hundreds of pages.
   - Provide cancellation and graceful failure rather than freezing/crashing.

8. OUTPUT INTEGRITY
   - Never silently return an empty or partially corrupt file as success.
   - Validate output magic bytes, expected page count, and file size where possible.
   - Preserve PDF features such as links, forms, annotations, bookmarks, and vector text when the chosen operation is structurally capable of preserving them.
   - Warn when a rasterizing operation will flatten interactive content.

9. SECURITY
   - Treat every uploaded local file as untrusted input.
   - Never execute embedded PDF JavaScript.
   - Do not render arbitrary HTML with unsafe script execution.
   - Sanitize generated HTML.
   - Add a strict Content Security Policy.
   - Pin and audit dependencies.
   - Avoid third-party scripts on processing pages.

10. ACCESSIBILITY
    - Keyboard operable.
    - Screen-reader labels for file inputs, buttons, progress, errors, page thumbnails, and editor tools.
    - Visible focus styles.
    - Minimum touch target around 44px.
    - Do not rely solely on color to communicate state.

11. RESPONSIVE DESIGN
    - Support desktop, tablet, and mobile.
    - Mobile UX must not simply shrink desktop layouts.
    - Heavy settings should collapse into drawers or bottom sheets where appropriate.

12. TESTING
    - Every operation needs unit tests for core logic and integration tests using real fixture documents.
    - Maintain fixtures for text PDFs, image-only PDFs, forms, annotations, encrypted PDFs, malformed PDFs, RTL text, CJK text, very long files, mixed page sizes, rotated pages, transparency, embedded fonts, and large images.
    - Add E2E tests for the public user workflow.

13. OBSERVABILITY
    - Analytics may record tool name, device category, page-count bucket, size bucket, duration bucket, success/failure category, and feature usage.
    - Never record document names unless explicitly anonymized and justified.
    - Never record document text, binary data, passwords, signature images, invoice details, or user-entered document contents.

14. IMPLEMENTATION STYLE
    - Use TypeScript with strict mode.
    - Keep operations independent from React UI.
    - Use a reusable operation contract.
    - Return typed errors with user-safe messages and internal error codes.
    - Separate rendering, document transformation, storage, UI state, and network adapters.

DEFAULT TECHNOLOGY STACK

- Next.js with App Router
- React
- TypeScript strict mode
- Tailwind CSS
- Accessible headless UI primitives where useful
- pdf-lib for structure-level manipulation where suitable
- PDF.js for rendering and text extraction
- Web Workers
- IndexedDB using a small typed wrapper
- Service Worker / PWA caching
- JSZip for ZIP-oriented formats
- jsPDF where document generation benefits from it
- SheetJS for spreadsheet parsing
- Ghostscript WebAssembly for advanced compression
- Tesseract.js for OCR
- MuPDF WASM or another appropriate local engine for difficult repair/encryption/rendering tasks, subject to licensing review
- Web Crypto API for SHA-256 and other supported cryptographic operations
- WebRTC DataChannel for P2P transfer/collaboration

REPOSITORY RULES

Use a monorepo-oriented structure approximately like:

apps/web
packages/pdf-core
packages/pdf-renderer
packages/pdf-operations
packages/pdf-worker
packages/pdf-editor
packages/ocr
packages/wasm
packages/converters
packages/security
packages/p2p
packages/ui
packages/shared
packages/analytics
packages/testing

Do not put the entire implementation into page components.

OPERATION CONTRACT

Create a generic operation abstraction roughly equivalent to:

interface DocumentOperation<TInput, TOptions, TResult> {
  id: string;
  validate(input: TInput, options: TOptions): Promise<ValidationResult>;
  estimate?(input: TInput, options: TOptions): Promise<ResourceEstimate>;
  execute(
    input: TInput,
    options: TOptions,
    context: OperationContext
  ): Promise<TResult>;
}

OperationContext should provide:
- AbortSignal
- progress callback
- logger that cannot receive document contents
- device capability profile
- temporary storage adapter
- worker pool

WORKER RULES

- Transfer ArrayBuffers instead of cloning when safe.
- Never retain worker copies unnecessarily.
- Report structured progress:
  phase, completed, total, percentage, message.
- Support cancellation via AbortController and worker termination.
- Use bounded concurrency.

STORAGE RULES

RAM:
- Active parsing and transformations only.

IndexedDB:
- Optional local recent-file cache, resumable work, generated preview cache, local workflow state.

localStorage:
- UI preferences and tiny metadata only.
- Never store document binary data, extracted text, passwords, signatures, or sensitive invoice fields by default.

LOCAL HISTORY

Build an optional recent-history feature:
- local-only
- clearly labeled
- maximum 50 recent items by default
- user can clear one item or all items
- incognito/private browsing failure must degrade gracefully
- storage quota errors must not break processing

DOWNLOADS

Implement robust browser download handling:
- Blob + object URL
- revoke object URLs after use
- Safari/iOS fallback behavior
- sensible filenames such as originalname-merged.pdf or originalname-compressed.pdf
- share sheet support where available, but not required for baseline

DEVICE CAPABILITY PROFILE

Create a helper that classifies:
- mobile
- tablet
- desktop
- low-memory
- standard-memory
- high-memory

Use navigator.deviceMemory only as a hint because browser support is incomplete.
Use screen dimensions and conservative defaults.

Suggested starting safety policies, not hard promises:
- phone: warn around 30 MB and keep heavy jobs conservative; target up to ~50 MB when feasible
- tablet: target ~75 MB when feasible
- desktop: target ~150 MB when feasible
- high-DPI exports must clamp maximum canvas dimension
- default maximum render dimension around 16k pixels or lower when browser limits require

ERROR UX

Provide actionable errors:
- unsupported file
- file corrupt
- password required
- wrong password
- memory estimate too high
- browser feature unavailable
- worker failed
- WASM failed to load
- storage quota exceeded
- output validation failed

Always provide recovery advice rather than generic “Something went wrong.”

SEO/ROUTING

Each tool must have a dedicated route with:
- unique title
- unique meta description
- canonical URL
- structured FAQ data when applicable
- tool UI near the top
- privacy explanation
- how-it-works content
- related tools
- accessible breadcrumbs

Do not duplicate the reference site's copy verbatim.

DELIVERY EXPECTATION FOR EACH PHASE

For every phase prompt I provide after this master prompt:
1. Inspect the existing codebase before changing files.
2. Write a concise implementation plan.
3. Implement only that phase.
4. Add/update tests.
5. Run lint, typecheck, unit tests, and relevant E2E tests.
6. Report changed files.
7. Report architectural decisions and trade-offs.
8. Report known limitations honestly.
9. Do not start the next phase unless explicitly instructed.
```

---

# Phase 0 Prompt — Foundation, Local-First Runtime, PWA, Workers, Storage, UI System

```text
Implement Phase 0 of PaperZero: the complete reusable platform foundation for every later PDF/document tool.

GOAL

When this phase is complete, PaperZero must already feel like a real product even though only a developer diagnostic operation may exist. The application must have a production-ready tool shell, local file lifecycle, browser capability detection, worker architecture, local history foundation, offline caching, progress/cancellation primitives, and a reusable design system.

Do not implement Merge/Split/Compression yet except for minimal internal diagnostic functions required to prove the infrastructure works.

A. APPLICATION SHELL

Create the PaperZero website shell with:
- original PaperZero branding
- header with logo/wordmark area
- searchable tool catalog shell
- category navigation
- responsive mobile navigation
- footer with Privacy, How It Works, Offline, Security, and About links/placeholders
- theme support if already planned
- clean neutral visual language suitable for privacy/security software

The home page should be able to render tool cards from a central typed tool registry even if many tools are still marked coming soon in development.

Create a ToolDefinition type with fields similar to:
- id
- slug
- name
- shortDescription
- category
- acceptedFileTypes
- outputTypes
- icon
- tags
- offlineCapable
- remoteProcessingDisclosure
- status
- relatedToolIds

Do not hardcode tool metadata separately into every page.

B. TOOL PAGE SHELL

Create a reusable ToolPageLayout that supports:
- breadcrumb
- H1
- concise description
- privacy chips such as “Local processing”, “No watermark”, “Works offline” only when factually true
- main interactive workspace
- optional settings panel
- progress state
- result/download state
- how-it-works content area
- FAQ area
- related tools

Create a reusable tool state machine:
idle -> filesSelected -> configuring -> processing -> success
and error/cancelled branches.

C. FILE DROPZONE AND VALIDATION

Build a reusable accessible file picker/dropzone:
- click to choose
- drag/drop desktop
- mobile file picker
- multiple or single files based on tool config
- accept filtering
- size display
- type display
- duplicate detection
- validation errors
- remove item
- reorder support hook for later phases

Do not trust filename extension alone.
Inspect magic bytes where practical.
For PDF, validate %PDF signature but allow for legitimate leading bytes if the parser supports them.

D. BINARY DATA MODEL

Define DocumentFile / LocalFileHandle abstraction that can wrap:
- native File
- Blob
- ArrayBuffer
- Uint8Array
- IndexedDB reference

Do not eagerly copy the entire file repeatedly.
Provide helpers:
- asArrayBuffer()
- asUint8Array()
- asBlob()
- getMetadata()
- dispose()

Track ownership so buffers can be released/transferred safely.

E. WORKER INFRASTRUCTURE

Implement a generic WorkerPool / WorkerTask abstraction.
Requirements:
- lazy worker initialization
- bounded concurrency
- task IDs
- progress messages
- structured result/error messages
- cancellation
- timeout support for truly stuck work
- worker teardown
- automatic recreation after crash

Build one diagnostic worker action that receives an ArrayBuffer and returns byte length plus a SHA-256 hash using Web Crypto or equivalent. This proves transferable messaging without implementing a product tool.

F. OPERATION FRAMEWORK

Implement the shared DocumentOperation contract described in the global prompt.
Create:
- OperationRunner
- OperationProgress
- OperationError
- ResourceEstimate
- OperationResult

OperationRunner must:
1. validate
2. estimate resources if supported
3. ask caller for confirmation when estimate exceeds soft safety threshold
4. execute with AbortSignal
5. emit progress
6. validate result
7. clean temporary resources in finally

G. DEVICE CAPABILITY DETECTION

Create a conservative capability detector.
Inputs can include:
- user agent as one signal only
- screen width
- devicePixelRatio
- navigator.deviceMemory if available
- hardwareConcurrency if available
- browser family
- iOS/Safari detection where necessary for compatibility behavior

Return values such as:
- deviceClass: mobile/tablet/desktop
- memoryClass: low/standard/high/unknown
- maxRecommendedFileBytes
- maxRecommendedRenderDPI
- maxPagesPerRenderBatch
- maxWorkerConcurrency
- warnings

Do not present these estimates as guaranteed hardware limits.

H. MEMORY UTILITIES

Implement helpers to estimate render memory.
Use width * height * 4 bytes for RGBA as a baseline and apply safety multipliers.
Account for:
- source file bytes
- parser overhead
- canvas RAM
- possible GPU texture duplication
- output buffers

Create utility to dispose canvases:
- set width/height to 0
- remove references
- revoke object URLs

I. INDEXEDDB

Create a typed IndexedDB layer with stores for:
- recent file metadata
- optional binary history
- preview cache
- workflow drafts
- app settings requiring more than localStorage

Define a versioned migration strategy.
Handle:
- storage unavailable
- quota exceeded
- transaction failure

Never require IndexedDB for the core operation to succeed.

J. LOCAL HISTORY

Implement optional recent local history framework:
- user can enable/disable if you choose to expose that setting
- 50-item maximum default
- metadata view: tool, filename, size, timestamp, output type
- binary persistence optional and clearly labeled
- clear item
- clear all
- storage used indicator if feasible

Do not upload history.

K. SERVICE WORKER / PWA

Implement a production-safe service worker strategy.
Cache:
- app shell
- static tool JS chunks where suitable
- self-hosted PDF.js worker assets later
- self-hosted WASM assets later
- fonts/icons needed offline

Do not blindly cache every network request.
Version caches.
Remove obsolete caches on activate.
Provide an offline fallback page.

Make the app installable as a PWA with:
- manifest
- icons/placeholders under PaperZero branding
- theme/background settings
- standalone display

L. DOWNLOAD MANAGER

Build DownloadManager:
- creates Blob URL
- generates filename
- performs anchor download
- Safari/iOS fallback
- revokes URLs
- optional Web Share support when supported and user initiated

M. PRIVACY-SAFE ANALYTICS ADAPTER

Create an analytics interface with no provider required yet.
Allowed event fields:
- toolId
- eventName
- deviceClass
- fileSizeBucket
- pageCountBucket if known
- durationBucket
- success/errorCode

Disallowed:
- raw filename
- file bytes
- extracted text
- passwords
- document metadata values
- signature contents

Add unit tests proving sensitive keys are rejected/sanitized.

N. SECURITY BASELINE

Configure:
- strict CSP suitable for Web Workers/WASM
- no unsafe remote script dependencies unless technically unavoidable
- Referrer-Policy
- X-Content-Type-Options
- Permissions-Policy, especially camera disabled globally except routes that need it if practical
- robust MIME handling

Do not break Next.js runtime with an impossible CSP; document necessary allowances.

O. ACCESSIBILITY

Implement:
- skip link
- keyboard dropzone activation
- aria-live progress region
- aria-live error region
- focus returned to relevant UI after processing
- no inaccessible custom controls

P. TESTS

Write tests for:
- file validation
- capability detection
- memory estimate
- IndexedDB adapter where test environment supports it
- worker task success
- worker task cancellation
- worker crash recovery
- download filename generation
- privacy-safe analytics sanitization
- tool registry route generation

Add one E2E test:
1. open diagnostic development route
2. select a local fixture
3. run hash diagnostic
4. see progress
5. see result
6. verify no document upload network request is issued

Q. DEFINITION OF DONE

Phase 0 is done only when:
- app builds in production mode
- strict TypeScript passes
- lint passes
- tests pass
- service worker works in production build
- app can operate diagnostic flow offline after first load
- worker tasks do not block the UI
- storage failure degrades gracefully
- no document binary leaves browser during diagnostic operation

At completion, provide:
- architecture summary
- directory tree
- key interfaces
- test results
- security headers used
- known browser limitations
- exact steps to verify offline mode manually

Do not implement Phase 1 tools yet.
```

---

# Phase 1 Prompt — Core Page Management and High-Value MVP Tools

```text
Implement Phase 1 of PaperZero: the first production-ready set of local PDF tools built on the Phase 0 foundation.

TOOLS REQUIRED IN THIS PHASE

1. Merge PDF
2. Split PDF
3. Organize Pages
4. Rotate PDF
5. Images to PDF
6. PDF to JPG / PNG
7. Add Watermark
8. Add Page Numbers
9. Extract Text
10. Remove basic document metadata
11. PDF to ZIP

The main requirement is that these tools are dependable, local-only, responsive, and reusable. Avoid one-off page-specific implementations.

SHARED PDF ENGINE

Create or finalize packages for:
- PDF loading
- PDF.js rendering
- pdf-lib structure manipulation
- page thumbnails
- page selection state
- operation workers
- result validation

Where licensing and technical architecture permit, self-host dependencies/assets required for offline use.

A. MERGE PDF

UX:
- allow multiple PDF selection
- show each source document as a card with filename, size, and page count
- support drag reorder of entire documents
- optionally expand a document into page thumbnails if architecture supports it cleanly
- accessible non-drag reordering via Move Up / Move Down
- Merge button disabled until at least two valid PDFs are loaded
- progress stages: reading, copying pages, saving, validating

Implementation:
- use pdf-lib page copying rather than rasterizing
- preserve page sizes and rotations
- preserve vector content where possible
- preserve forms/annotations/links as supported by library
- warn/document known limitations
- reject unsupported encrypted inputs with a clear path to Remove Password tool later

Output filename:
merged.pdf or a sensible combination-derived name.

Tests:
- portrait + landscape
- different page sizes
- 2, 10, and many source documents
- document with annotations
- mixed rotations

B. SPLIT PDF

Modes:
- extract selected pages
- page range expression
- split every page
- split every N pages
- custom ranges producing multiple output PDFs

Range parser must support:
1-3,5,8-10
and reject:
0, reversed invalid ranges unless normalized intentionally, non-numeric input, pages beyond document count.

UX:
- page thumbnails
- selected page counter
- clear selection
- range input
- output packaging into ZIP when multiple files are produced

Do not rasterize.

C. ORGANIZE PAGES

Build a reusable PageGrid component.
Capabilities:
- reorder
- delete
- rotate individual pages
- multi-select
- select all
- deselect all
- duplicate page if straightforward and safe
- undo/redo for local UI mutations if feasible

Represent edit state as immutable operation metadata until export, e.g. ordered page descriptors. Do not rewrite the PDF after each drag action.

Export only when user clicks Apply/Download.

D. ROTATE PDF

Support:
- all pages
- selected pages
- 90 clockwise
- 90 counter-clockwise
- 180

Use structural page rotation when possible.
Preview rotation immediately without rewriting the full PDF.

E. IMAGES TO PDF

Input:
- JPG/JPEG
- PNG
- WebP where browser decoding supports it

UX:
- multi-image reorder
- preview
- remove
- orientation
- page size: Auto, A4, Letter
- margins: None, Small, Medium, Large
- image fit: contain / cover where appropriate

Handle EXIF orientation correctly.
Avoid silently stretching aspect ratio.
Support one page per image.

F. PDF TO JPG / PNG

Use PDF.js rendering.
Settings:
- output format JPG or PNG
- page selection
- DPI presets: 72/150/300/500/600 where device capability permits
- JPG quality slider/presets

Implementation rules:
- scale = DPI / 72 as baseline
- clamp by safe canvas dimensions
- adapt maximum DPI by device capability
- process in batches
- never render all pages at high DPI concurrently
- release canvas after each encoded blob
- package multi-page output into ZIP

Show user when requested DPI was reduced for memory/browser safety.

G. WATERMARK

Support text and image watermark.
Text settings:
- text
- font size
- font family from safe supported list
- opacity
- rotation
- position presets
- custom x/y if architecture supports it
- page range
- color

Image settings:
- PNG/JPG
- opacity
- scale
- rotation
- position

Preview overlay using the same coordinate abstraction used during final PDF rendering to prevent placement mismatch.

H. PAGE NUMBERS

Settings:
- position: header/footer left/center/right presets
- starting number
- page range
- optional prefix
- optional suffix
- font size
- skip first page option
- format examples: “1”, “Page 1”, “1 / 20”

The total-pages format must calculate based on chosen range semantics clearly.

I. EXTRACT TEXT

Use PDF.js text layer extraction.
Modes:
- all pages
- selected pages

Output:
- on-screen page-separated text
- Copy button
- TXT download
- Markdown download with page headings

Preserve page boundaries.
Do not claim reading order is perfect for multi-column documents.
If no text layer is found, recommend OCR.

J. REMOVE BASIC METADATA

Create a simple local metadata cleaner in this phase.
Remove where supported:
- title
- author
- subject
- keywords
- creator
- producer
- creation/modification date

Do not claim this is a full privacy sanitizer yet; Phase 3 will implement deep privacy scanning.
Clearly label this tool “Remove Metadata” rather than “Complete Privacy Clean” at this stage.

K. PDF TO ZIP

Interpret this as exporting each PDF page as an image and bundling into ZIP.
Provide:
- JPG/PNG
- DPI selector using same renderer as PDF-to-image
- predictable filenames page-001.jpg, page-002.jpg
- ZIP generation with JSZip or equivalent

Do not duplicate rendering logic; call shared rendering services.

L. SHARED PREVIEW CACHE

Generate low-resolution thumbnails once and reuse across Organize, Split, Rotate, Page Numbers, and Watermark where possible.
Use IndexedDB cache only if beneficial and safe; otherwise memory cache is acceptable.
Cache key must not expose sensitive content externally.

M. PROGRESS

Every tool should report meaningful phases.
Examples:
Merge:
- reading 2/5
- copying pages 18/42
- saving

PDF to images:
- rendering page 4/30
- encoding
- packaging ZIP

N. OUTPUT VALIDATION

For PDF results:
- confirm %PDF header
- try opening with parser
- verify expected page count where deterministic

For ZIP:
- ensure expected file count

For images:
- ensure non-zero dimensions and blob size

O. ROUTES

Create dedicated routes:
/merge-pdf
/split-pdf
/organize-pdf
/rotate-pdf
/images-to-pdf
/pdf-to-jpg
/watermark-pdf
/add-page-numbers
/extract-text
/remove-metadata
/pdf-to-zip

Use original PaperZero SEO copy, not reference text.

P. TEST MATRIX

Add fixture PDFs for:
- 1 page
- 100+ pages
- landscape
- mixed page size
- vector-only
- image-heavy
- annotations
- forms
- embedded fonts
- blank page
- malformed but readable

Unit-test range parser thoroughly.
Add E2E tests for Merge, Split, Organize, PDF-to-JPG, Watermark.

Q. PRIVACY VERIFICATION

Add an E2E assertion or development debug mode showing that operations do not issue document upload POST/PUT requests.
Network requests for static assets are allowed before offline cache is populated.

R. DEFINITION OF DONE

All 11 tools work locally in current Chrome, Firefox, Safari, and Edge to the extent browser APIs allow.
Mobile layouts are usable.
No tool freezes the main thread on ordinary documents.
High-DPI jobs adapt to memory limits.
Result downloads are valid.
Tests and production build pass.

At the end report:
- implemented tools
- shared code created
- browser-specific limitations
- fidelity limitations
- performance measurements on at least one small and one large fixture

Do not start PDF text editing, OCR, compression, encryption, or AI yet.
```

---

# Phase 2 Prompt — Full PDF Editor, Signatures, Forms, Handwriting, Crop, Headers, Invert

```text
Implement Phase 2 of PaperZero: the editing and annotation suite.

TOOLS REQUIRED

1. Edit PDF Text
2. Add Text
3. Add Image
4. Whiteout
5. Sign PDF
6. Fill PDF Form
7. Crop & Resize PDF
8. Headers & Footers
9. Flatten PDF
10. Invert PDF Colors
11. PDF to Handwriting
12. Handwriting to PDF

This is the first phase where visual fidelity and coordinate systems become extremely important.

A. EDITOR ARCHITECTURE

Create a reusable PDFEditor workspace with:
- page sidebar or thumbnail strip
- central page canvas/view
- zoom controls
- page navigation
- responsive toolbar
- object selection
- property inspector or contextual toolbar
- undo/redo
- keyboard shortcuts that do not conflict with browser basics
- autosaved local draft state where reasonable

Use PDF.js for page rendering.
Maintain a transformation that maps PDF points <-> rendered CSS pixels <-> canvas pixels.
All overlays must use one canonical coordinate model to prevent export drift.

Represent changes as an edit command model instead of mutating the PDF for every mouse event.
Suggested edit types:
- ReplaceText
- AddText
- AddImage
- WhiteoutRegion
- Signature
- FormValue
- CropBox
- HeaderFooter

B. CLICK-TO-EDIT PDF TEXT

Research requirement to emulate functionally:
- user clicks visible PDF text
- original text run characteristics are detected as far as technically possible
- replacement attempts to preserve font, size, color, and position
- unusual embedded fonts fall back gracefully

Implementation approach:
1. PDF.js extracts text items, transforms, approximate font names, dimensions, and positions.
2. Build an invisible/interactive text-hit layer over rendered page.
3. Clicking a text run opens an inline or floating editor.
4. Store replacement intent.
5. On export, remove/cover the old visual region and draw replacement text.

Important limitation:
True mutation of arbitrary existing PDF content streams and embedded subset fonts is complex. Do not pretend fidelity is perfect.

Font strategy:
- map standard fonts to built-in equivalents
- attempt to reuse embedded font only if library/API and licensing allow reliable embedding
- otherwise choose a metric-compatible fallback
- show a subtle warning if exact font cannot be reproduced

Line/paragraph editing:
- initial parity can treat extracted runs/lines as editing units
- avoid uncontrolled paragraph reflow across complex layouts
- allow user to resize replacement bounding box if needed

C. SCANNED PDF EDITING HOOK

If text layer is absent:
- show “This page appears scanned”
- offer “Run OCR to detect text”
- Phase 5 will provide full OCR engine, but design the editor so OCR boxes can later feed into the same text-edit overlay model

If OCR package is already available by implementation order, integrate it lazily. Otherwise provide a disabled/coming-soon hook without breaking the editor.

D. ADD TEXT

Support:
- click placement
- font family
- font size
- bold/italic where supported
- text color
- alignment
- multiline text box
- move/resize
- duplicate/delete

E. ADD IMAGE

Input PNG/JPG/WebP.
Support:
- place
- move
- resize with aspect ratio lock
- rotate if feasible
- opacity
- delete

Decode image locally.
Strip unnecessary metadata from newly embedded image if straightforward.

F. WHITEOUT

Provide a white rectangle tool intended for visual correction, not secure redaction.
The UI must explicitly differentiate:
- Whiteout = visual cover only
- Redact = permanent removal, implemented in Phase 3

Do not label whiteout as redaction.

G. SIGN PDF

Support three signature creation modes:
1. Draw
2. Type
3. Upload/photo image

Draw mode:
- pointer/touch drawing canvas
- undo/clear
- stroke smoothing
- transparent background

Type mode:
- several handwriting-like but properly licensed/local fonts
- size control

Upload/photo mode:
- local image input
- optional background removal or thresholding if implemented safely

Placement:
- drag
- resize
- rotate if needed
- multi-page placement optional

Privacy:
- signature image must never be sent to analytics or server
- avoid persistent signature storage by default
- if “Remember my signature on this device” is offered, require explicit opt-in and store locally with clear delete control

H. FILL PDF FORM

Support AcroForm fields:
- text
- checkbox
- radio
- dropdown
- option list where library support permits

Render field controls aligned with PDF coordinates.
Allow saving while preserving form interactivity where possible.
Provide “Flatten answers” option that writes visible appearances and removes interactivity.

For unsupported XFA forms:
- detect if possible
- show a clear limitation instead of silently failing

I. CROP & RESIZE

Crop:
- visual crop handles
- apply to current page / selected pages / all pages
- preserve content outside crop box in underlying structure if using crop box semantics, and explain that cropping may not permanently delete hidden content

Provide optional “Permanent crop/rasterize” only if implemented and clearly explained.

Resize:
- A4
- A3 if desired
- Letter
- Legal
- custom width/height
- units mm/in/pt
- fit content modes: center, fit, fill

J. HEADERS & FOOTERS

Support:
- left/center/right zones
- text
- page number variable
- total pages variable
- date variable
- filename variable (processed locally)
- page range
- skip first page
- font/size/color
- distance from edge

Reuse page-number engine where appropriate.

K. FLATTEN PDF

Flatten:
- AcroForm values into page appearance where possible
- annotations into page appearance where appropriate
- optionally strip embedded JavaScript/actions

Be careful with digital signatures:
- modifying a cryptographically signed PDF invalidates signatures
- detect existing signatures if possible and warn user before flattening or editing

Do not promise “permanently non-editable”; PDFs can always be modified by sufficiently capable tools. Phrase it as flattening interactive content.

L. INVERT PDF COLORS

Provide modes:
- invert
- grayscale
- sepia
- high contrast
- dark reading mode

Two implementation strategies:
1. structure-preserving color transformation where feasible
2. rasterized page transformation fallback

If rasterization is used:
- warn that selectable text/forms/links may be flattened
- allow DPI choice

Prefer preserving selectable text when technically reasonable.

M. PDF TO HANDWRITING

Define functionally:
- accept typed text or text-based PDF
- render text using locally hosted handwriting-style fonts
- allow paper styles: blank, ruled, grid, optional margin line
- controls for font/handwriting style, line spacing, size, text color, slight deterministic variation
- export PDF

Do not claim generated handwriting is real human handwriting.
Do not facilitate deceptive signature forgery; this tool is for note styling, not identity/signature impersonation.

For PDF input:
- extract text locally
- preserve basic paragraphs/headings if possible
- prioritize readability over exact original layout

N. HANDWRITING TO PDF

Scope:
- accept image or scanned PDF of handwritten notes
- use OCR/handwriting recognition if available locally
- preserve original scan as visual layer
- optionally create a typed-text version or searchable text layer

If reliable handwriting OCR is not available in the selected local engine:
- implement a clear beta workflow
- provide extracted text preview and confidence indication
- allow manual corrections before PDF export

Do not advertise high accuracy beyond measured tests.

O. EDIT COMMAND MODEL

Implement undo/redo through command history.
Commands should be serializable so drafts can be kept in IndexedDB.
Do not store original file indefinitely without clear local history settings.

P. EXPORT PIPELINE

Export should:
1. load original structure
2. apply structural operations where possible
3. draw overlays in PDF coordinate space
4. apply form changes
5. flatten only when requested
6. save
7. re-open result for validation

Q. TESTS

Fixtures:
- standard Helvetica document
- embedded custom font
- subset font
- colored text
- rotated page
- scanned page
- AcroForm
- annotation-heavy PDF
- existing digital signature
- mixed page sizes

Test coordinate fidelity by comparing expected placements within a small tolerance.
E2E:
- replace a date
- add text
- place signature
- fill a form
- crop
- export and reopen

R. DEFINITION OF DONE

The editor must be usable for common resume/CV corrections, simple contract annotations, signatures, image insertion, forms, and layout-safe overlays.
It must not overclaim the ability to semantically reflow arbitrary PDF paragraphs.
No editor action uploads the document or signature.

Report:
- exact text-editing fidelity approach
- font fallback strategy
- form support matrix
- what flattening does
- which invert modes preserve text
- known limitations for scans/handwriting

Do not start secure redaction, encryption, compression, or cloud AI yet.
```

---

# Phase 3 Prompt — Security, Privacy, Encryption, True Redaction, Auto-PII, Fingerprinting

```text
Implement Phase 3 of PaperZero: security and privacy tools.

TOOLS REQUIRED

1. Encrypt PDF
2. Remove Password
3. Unlock Owner Restrictions for Authorized Documents
4. Redact PDF
5. Auto-Redact PII
6. Privacy Risk Scanner
7. Deep Metadata Cleaner
8. Flatten/Sanitize Security Actions integration
9. PDF Fingerprint / Hash Generator

Security claims must be precise. Do not market visual masking as redaction, weak encryption as AES-256, or restriction removal as password cracking.

A. ENCRYPT PDF

Select a PDF engine that genuinely supports modern PDF encryption in-browser.
Confirm license compatibility before implementation.

Desired UX:
- user password
- confirm password
- show/hide password
- password strength guidance
- optional owner/permissions settings only if library supports them reliably
- encryption information shown before processing

Requirements:
- perform encryption locally
- never persist password
- never log password
- never include password in URL, history, analytics, exception payload, or localStorage
- wipe password state after completion/reset as far as JavaScript allows

If AES-256 PDF encryption is not actually supported by the chosen implementation, do not claim it. Either choose another library or state the supported algorithm accurately.

B. REMOVE PASSWORD

This tool is for a PDF when the user knows the legitimate password.
Flow:
- detect encryption
- request password locally
- attempt open
- wrong password gives clear error
- once successfully decrypted, save an unencrypted copy

Do not implement brute-force, dictionary attacks, password cracking, or bypass of unknown user passwords.

C. UNLOCK OWNER RESTRICTIONS

Scope only to documents the user is authorized to modify.
Examples:
- printing disabled
- copying disabled
- editing disabled through PDF permission flags

Do not frame this as defeating DRM or unknown-password protection.
If the PDF requires a password you cannot legitimately open, route to Remove Password and require the user to provide it.

D. TRUE REDACTION

This must be different from Phase 2 whiteout.

Features:
- draw rectangular redaction region
- select extracted text and mark for redaction
- search-and-mark exact text
- page selection
- configurable overlay color, default black
- optional redaction label such as “REDACTED”

Secure implementation goal:
- remove underlying text/vector/image content intersecting redaction regions where the PDF engine supports it
- remove corresponding text from extractable content
- remove annotations/comments in redacted area if required
- draw final redaction appearance

Where precise object-level removal is not reliable:
- use a secure fallback that rasterizes the affected page after applying redaction at adequate resolution, then replaces the page with the redacted raster
- clearly document the consequence: text on that page becomes flattened/non-selectable unless an OCR layer is regenerated deliberately

Do not use a black rectangle overlay while retaining recoverable underlying text.

After export, run redaction verification:
- text extraction must not return marked text
- render result and ensure region is covered
- inspect annotations if applicable

E. AUTO-REDACT PII

Detect locally where possible.
Initial patterns should include:
- emails
- phone numbers
- credit/debit card-like sequences with Luhn validation
- Indian PAN
- Indian Aadhaar-like sequences with validation/check logic where appropriate and privacy-safe implementation
- IP addresses if useful
- URLs if selected
- custom regex entered by user

Important:
- pattern detection produces candidates, not automatic irreversible edits
- show findings grouped by type and page
- user can review/approve/deselect
- highlight candidate region on page

For text-based PDFs:
- use extracted text plus coordinates

For scanned PDFs:
- depend on OCR results when available

Provide confidence/validation status.
Do not send detected PII to a server.

F. PRIVACY RISK SCANNER

Build a local risk report.
Scan categories such as:
- Title/Author/Subject/Keywords
- Creator/Producer
- creation/modification dates
- XMP metadata
- embedded files/attachments
- annotations/comments
- form fields
- JavaScript/actions
- external links
- document info dictionary
- image EXIF metadata where extractable
- GPS coordinates in embedded image metadata where technically detectable
- hidden layers/optional content groups if engine exposes them
- thumbnails
- named actions
- revision/incremental-update indicators where detectable

Do not claim to detect revision history or deleted content if the implementation cannot prove it.
Use a capability-based report:
- Finding
- Severity: Info/Low/Medium/High
- Location
- Explanation
- CanRemove: yes/no/partial

Provide “Clean selected findings” and “Clean safe metadata” actions.

G. DEEP METADATA CLEANER

Remove supported:
- info dictionary fields
- XMP packet
- embedded image metadata where feasible without destroying visual fidelity
- comments/annotations if user selects
- embedded files if user selects
- JavaScript/actions if user selects
- document thumbnails if relevant

Do not silently remove forms/bookmarks/links unless selected or required for safety.

H. PDF FINGERPRINT / HASH

Implement local hashing using Web Crypto.
Required:
- SHA-256 as primary and recommended

Optional compatibility display:
- SHA-1 labeled legacy
- MD5 labeled legacy/non-secure for cryptographic security, if supported by chosen library because Web Crypto does not universally expose MD5

Do not describe MD5 or SHA-1 as secure integrity algorithms for adversarial use.

UX:
- drag PDF
- calculate hash with progress for large files where possible
- copy hash
- save text checksum file
- verify mode: paste known hash and compare

Optional advanced function:
- compute multiple hashes without modifying document

Clarify that this “fingerprint” verifies exact byte identity. It does not embed invisible recipient tracking unless a separate future feature is built.

I. SECURITY SANITIZER

Add a tool/action that combines:
- remove JavaScript/actions
- remove attachments
- remove annotations/comments
- remove metadata
- flatten forms optionally

Call it something like “Sanitize PDF.”
Show exactly what will be removed before processing.

J. EXISTING DIGITAL SIGNATURES

Detect signed PDFs if possible.
Before any edit/redaction/metadata change/encryption change:
- warn that modifying document will normally invalidate existing cryptographic signatures

Do not imply PaperZero can preserve signature validity after changing signed bytes.

K. SECURITY TESTS

Create fixtures:
- password-protected known password
- wrong-password tests
- restricted permissions
- document with visible sensitive text
- hidden text under white rectangle
- annotations
- embedded file
- JavaScript action
- XMP metadata
- image containing EXIF metadata if parser supports inspection

Redaction tests must prove:
- targeted string no longer appears in text extraction
- output opens
- redacted page visually contains final overlay

Privacy scanner tests should use deterministic fixtures with known metadata.
Hash tests should compare against known SHA-256 vectors.

L. UI PRIVACY LANGUAGE

Every security tool needs a short exact disclosure:
- “Processed locally in your browser.”

For Remove Password:
- “You must know the document password. PaperZero does not crack passwords.”

For Redaction:
- “Redaction permanently removes or flattens the selected content. Keep an original copy.”

M. DEFINITION OF DONE

No sensitive content leaves the browser.
True redaction tests pass.
Encryption claims match implementation.
Password is never persisted.
Auto-PII requires user review.
Privacy scanner lists supported and unsupported finding types honestly.

At completion report:
- encryption algorithm/library
- permission support
- redaction strategy and fallback
- PII patterns/validators
- scanner coverage matrix
- signed-document behavior
- hash algorithms and security labeling

Do not implement brute-force password recovery.
Do not start compression, OCR, remote AI, or P2P in this phase.
```

---

# Phase 4 Prompt — Browser Compression with Ghostscript WASM and Target-Size Workflows

```text
Implement Phase 4 of PaperZero: production-grade browser PDF compression.

PRIMARY TOOL

Compress PDF

SECONDARY LANDING/WORKFLOW PRESETS

- Compress PDF to ~100 KB where realistically achievable
- Compress PDF to ~200 KB
- Compress PDF to ~1 MB / 2 MB
- Compress PDF for email
- Compress PDF for job portals/government upload limits

These can share one engine and should not become duplicate implementations.

A. COMPRESSION ENGINE

Use Ghostscript compiled to WebAssembly or another browser-local engine with comparable full-PDF optimization capabilities.

Before shipping:
- document the exact library/build source
- check its license and redistribution requirements
- self-host production WASM/assets if permitted
- pin version/checksum
- lazy-load only on compression routes

Run compression in a dedicated Web Worker.
Do not execute Ghostscript on the React/main thread.

B. PRESETS

Expose user-friendly presets rather than raw Ghostscript flags.
Suggested product levels:

Light:
- prioritize print/readability
- conservative image downsampling
- high JPEG quality
- preserve more detail

Medium:
- balance email/sharing quality and size
- moderate downsampling

Heavy:
- prioritize smallest practical output
- stronger downsampling/recompression

Internally map these to carefully tested Ghostscript settings.
Do not promise an exact 20-30%, 40-50%, or 60-70% reduction for every PDF. You can show these as typical ranges only if your benchmarks support them.

C. WHAT COMPRESSION SHOULD OPTIMIZE

Where engine supports it:
- image downsampling
- JPEG recompression
- duplicate object cleanup
- stream compression
- unused object removal
- font subsetting/optimization
- metadata cleanup when safe

Preserve vector text quality as much as possible.
Avoid rasterizing entire text-based PDFs just to reduce size unless user explicitly chooses an aggressive fallback.

D. INPUT ANALYSIS

Before compression, inspect:
- file size
- page count
- image-heavy vs text-heavy estimate if feasible
- encrypted state
- existing optimization hints

If password protected:
- route user to Remove Password or support password entry locally if engine can open it safely

Provide preflight estimate:
- likely low/moderate/high compressibility
- expected memory risk
- estimated time class, not a false exact ETA

E. WORKER AND VIRTUAL FILESYSTEM

Ghostscript WASM often needs a virtual filesystem.
Design a worker wrapper with:
- input file mount/write
- config generation
- stdout/stderr capture
- progress approximation
- output read
- cleanup
- worker termination

Never leave multiple full input/output copies in memory longer than necessary.
Transfer ArrayBuffers when possible.

F. TARGET-SIZE MODE

Implement a target-size helper for use cases such as 100 KB, 200 KB, 1 MB, and 2 MB.

Important:
A PDF cannot always be compressed under an arbitrary threshold without severe degradation. Do not claim guaranteed target size.

Algorithm:
1. Run initial analysis.
2. Choose a starting preset based on source size/target ratio.
3. Compress.
4. Measure actual output.
5. If above target and retry budget remains, lower image DPI/JPEG quality in bounded steps.
6. Stop after a maximum number of passes such as 3-4 to prevent runaway CPU use.
7. Return best result and state whether target was met.

Never endlessly loop trying to hit a target.

G. RESULTS UI

Show:
- original size
- compressed size
- bytes saved
- percentage saved
- level used
- whether target size was reached

If output is larger than original:
- do not silently call it success
- tell user the source is already highly optimized
- offer original file or only provide output if there is another beneficial transformation

H. QUALITY PREVIEW

For image-heavy PDFs, optionally show a small before/after preview on one representative page.
Avoid rendering every page twice.

I. DEVICE ADAPTATION

Heavy compression can use large memory.
Use Phase 0 capability profile to:
- reduce concurrent work
- warn on very large input
- recommend desktop for high-memory jobs
- avoid loading compression WASM until user starts/needs tool

On mobile:
- conservative presets
- possibly disable expensive iterative target-size retry if memory is too constrained
- explain why rather than crashing

J. OFFLINE SUPPORT

Once Ghostscript WASM is cached, compression should operate offline.
Test this explicitly in production PWA mode.

K. PROGRESS/CANCEL

Compression progress from Ghostscript may not map cleanly to page percentage.
Provide honest stage-based progress:
- loading engine
- preparing document
- compressing
- reading output
- validating

If true progress can be parsed from engine output, expose it.
Otherwise do not fake precise percentages.

Cancellation:
- terminate worker
- free virtual FS references
- revoke temporary URLs
- reset UI cleanly

L. OUTPUT VALIDATION

After compression:
- verify non-zero output
- parse output with PDF.js/pdf-lib/MuPDF
- verify page count matches input unless engine reports repair-related changes
- render first/selected sample page to ensure readable result

M. BENCHMARK SUITE

Create a local benchmark fixture set:
1. text-only report
2. high-resolution scanned document
3. presentation with photographs
4. vector-heavy brochure
5. already-optimized PDF
6. large 100+ page PDF

Record:
- source size
- Light/Medium/Heavy result size
- runtime
- peak memory if measurable
- visual notes

Do not put sensitive real customer documents into repository fixtures.

N. SEO ROUTES

Implement one core tool route and optional intent pages that feed the same app:
/compress-pdf
/compress-pdf-to-100kb
/compress-pdf-to-200kb
/compress-pdf-to-2mb

Intent pages should configure the same shared compressor; do not duplicate code.
Use original content.

O. TESTS

Unit:
- preset mapping
- target-size retry strategy
- size calculations
- retry bounds

Integration:
- actual WASM compression against fixtures
- worker cancellation
- malformed PDF failure
- encrypted PDF behavior

E2E:
- upload
- choose Medium
- compress
- result size summary
- download
- offline repeat after cached assets

P. DEFINITION OF DONE

Compression runs fully in-browser.
UI remains responsive.
Presets produce measurable trade-offs.
Target-size mode is bounded and honest.
Large files fail gracefully instead of crashing.
Output validates and opens.
Offline mode works after caching.

At completion report:
- Ghostscript/WASM version/license notes
- preset configuration
- benchmark table
- target-size algorithm
- mobile limitations
- known PDFs the engine cannot handle

Do not start OCR or Office conversion in this phase.
```

---

# Phase 5 Prompt — OCR, Searchable PDFs, Scan-to-PDF, Handwriting Recognition Foundation

```text
Implement Phase 5 of PaperZero: scanned-document intelligence and browser document scanning.

TOOLS REQUIRED

1. OCR / Searchable PDF
2. Image OCR helper used internally
3. Scan to PDF
4. Handwriting-to-PDF OCR integration from Phase 2
5. OCR hook for scanned PDF editing

A. OCR ENGINE

Use Tesseract.js or another browser-local OCR engine with appropriate licensing.
Run OCR in Web Workers.
Lazy-load language assets/models.
Cache language assets for offline reuse subject to storage constraints.

B. OCR WORKFLOW

Input:
- scanned/image-only PDF
- mixed PDF with some pages already having text

Flow:
1. Load PDF locally.
2. For each selected page, determine whether useful text layer already exists.
3. Skip OCR for text-rich pages unless user forces OCR.
4. Render page to an OCR-appropriate bitmap.
5. Preprocess if enabled.
6. Run OCR.
7. Capture recognized text, bounding boxes, confidence, line/word hierarchy.
8. Build searchable PDF by retaining original visual page and adding an invisible text layer aligned to the source.
9. Validate searchability by extracting resulting text.

C. LANGUAGE SUPPORT

UI:
- primary language selector
- optionally multiple languages where OCR engine supports it
- show model download/storage size when meaningful

Start with commonly used languages based on product priorities.
Do not ship every language pack in the initial application bundle.

D. PREPROCESSING

Provide optional local image preprocessing:
- grayscale
- contrast normalization
- thresholding/binarization
- deskew
- noise reduction if feasible

Keep original PDF page appearance unchanged in final searchable PDF unless user specifically chooses “enhance scan.”
OCR preprocessing image can differ from displayed page.

E. SEARCHABLE TEXT LAYER

The text layer should:
- be invisible/non-printing visually unless standard searchable PDF conventions require otherwise
- roughly align words/lines with original positions
- use appropriate text orientation
- preserve page size

Be careful with coordinate conversion between raster pixels and PDF points.

F. OCR RESULTS REVIEW

Show:
- page-level status
- average confidence
- extracted text preview
- warnings for low-confidence pages

Allow:
- download searchable PDF
- download TXT
- download Markdown

Optional:
- user corrections before embedding text layer

G. PERFORMANCE

OCR is CPU-heavy.
Rules:
- process pages sequentially or with very small bounded concurrency
- default concurrency based on hardwareConcurrency and memory class
- avoid retaining page bitmaps after OCR
- explicit canvas disposal
- pause/yield between batches on constrained devices

H. OCR CANCELLATION

User can cancel mid-document.
On cancel:
- terminate OCR workers
- dispose language worker state if appropriate
- clean page images
- preserve original file selection so user can retry with different settings

I. SCAN TO PDF

Build a mobile-first route using browser camera APIs.

Camera permission must be requested only after explicit user action.
Provide file/photo import fallback when camera access is unavailable or denied.

Flow:
1. Start scanning.
2. Show live camera preview.
3. Capture page manually; automatic capture is optional and should not block initial shipping.
4. Detect document boundary if computer-vision implementation is reliable.
5. Let user adjust four corners manually.
6. Perspective-correct image.
7. Enhance.
8. Add page to scan stack.
9. Reorder/delete/rotate pages.
10. Export multi-page PDF.

J. EDGE DETECTION / DESKEW

Use a local computer-vision approach such as OpenCV.js/WASM if licensing/bundle size is acceptable, or implement a smaller custom pipeline.

Suggested pipeline:
- downscale preview image
- grayscale
- blur
- edge detection
- contour detection
- find largest plausible quadrilateral
- score by area/aspect/border proximity

Never trust automatic border detection blindly.
Always let the user adjust corners.

K. PERSPECTIVE CORRECTION

Use four-point homography/perspective transform.
Produce a corrected rectangle at suitable resolution.
Avoid excessive resolution that crashes mobile Safari.

L. SCAN ENHANCEMENT MODES

- Original color
- Auto enhance
- Grayscale
- Black & white

Optional sliders:
- brightness
- contrast

Preview changes on a downscaled version; apply full-quality transform only at export.

M. MULTI-PAGE SCAN STACK

Use the PageGrid interaction from Phase 1.
Each scan stores:
- source image reference
- crop corners
- rotation
- enhancement mode
- page size decision

Do not encode a full PDF after every capture.

N. OCR AFTER SCAN

Offer optional:
“Make text searchable”

If selected:
- run OCR on corrected page images
- embed invisible text layer in generated PDF

This should be opt-in because OCR increases time/battery use.

O. HANDWRITING RECOGNITION

Integrate Phase 2 Handwriting-to-PDF with OCR.
Typed OCR and handwriting OCR are different tasks.
If Tesseract accuracy on handwriting is poor:
- label handwriting recognition Beta
- show confidence
- support manual correction
- never silently replace original handwritten page

The final PDF can include:
- original handwriting scan
- optional searchable/corrected text layer
- optional typed transcription pages

P. EDITOR OCR INTEGRATION

Expose OCR bounding boxes to Phase 2 editor.
For a scanned PDF page:
- run OCR
- create selectable hit regions
- when user edits recognized text, use whiteout + text overlay unless a secure reconstruction method exists
- tell the user that OCR-assisted edits are overlay-based

Q. ACCESSIBILITY

OCR progress must be announced.
Camera UI needs labels and fallback.
Manual crop handles must be large/touch-friendly.
Provide non-drag crop coordinate controls only if needed for accessibility; at minimum support keyboard movement of selected handles where practical.

R. OFFLINE

After OCR language and CV assets have been cached, OCR/scan processing must work offline.
Camera access itself does not require network.

S. TESTS

OCR fixtures:
- 300 DPI clean scan
- low contrast
- skewed
- rotated
- two-column
- mixed text/image
- already-searchable PDF
- multilingual sample

Measure character/word accuracy on synthetic known text fixtures.
Do not claim broad accuracy from one sample.

Scan tests:
- imported photo can exercise crop/perspective logic in automated tests
- camera path can be mocked for E2E

T. DEFINITION OF DONE

Searchable output is valid and selectable.
Original visual page remains intact.
OCR page memory is released.
Scan workflow is usable on iOS Safari and Android Chrome as far as browser support permits.
Offline mode works after assets are cached.

At completion report:
- OCR engine/version
- language strategy
- typical OCR DPI
- preprocessing pipeline
- scan edge-detection algorithm
- mobile memory limits
- handwriting limitations

Do not start remote AI chat in this phase.
```

---

# Phase 6 Prompt — Convert to PDF: Word, Excel, PowerPoint, HTML, Markdown, CSV, eBook, Audio, Create PDF

```text
Implement Phase 6 of PaperZero: browser-local conversion INTO PDF.

TOOLS REQUIRED

1. Word to PDF
2. Excel to PDF
3. PowerPoint to PDF
4. Images to PDF improvements if needed from Phase 1
5. HTML to PDF
6. Markdown to PDF
7. CSV to PDF
8. eBook to PDF
9. Audio to PDF transcript
10. Create PDF rich-text editor

This phase contains fidelity-heavy format parsing. Do not claim “perfect formatting” until verified with a substantial fixture suite.

GENERAL RULE

Conversion must run locally whenever possible.
If a format cannot be safely/fairly rendered with adequate fidelity in-browser, state the limitation rather than uploading it to a hidden backend.

A. WORD TO PDF

Input targets:
- DOCX is primary
- DOC legacy only if a reliable local parser exists; otherwise explicitly support DOCX first

Potential approach:
- unzip DOCX using JSZip
- parse OOXML relationships/styles/theme/fonts/media
- use a document renderer such as docx-preview or another local library after licensing review
- render to paginated HTML/canvas/SVG
- generate PDF

Preserve where feasible:
- paragraphs
- headings
- bold/italic/underline
- fonts with fallback
- font size/color
- lists
- tables
- images
- page breaks
- margins
- headers/footers
- hyperlinks

Hard problems:
- exact Word pagination
- floating objects
- text boxes
- advanced fields
- equations
- SmartArt
- tracked changes
- missing fonts

Build a compatibility report when unsupported constructs are detected if feasible.
Do not imply pixel-perfect Word compatibility.

B. EXCEL TO PDF

Primary formats:
- XLSX
- XLS
- XLSM for displayed values/styles only; never execute macros
- CSV can route to CSV tool

Use SheetJS/JSZip or appropriate local parsers.

Preserve:
- cell values
- calculated cached values
- number/date formatting
- cell colors
- text colors
- bold/italic
- borders
- alignment
- merged cells
- row heights/column widths where available
- multiple worksheets
- images where extractable
- charts if you can render them accurately; otherwise disclose support level

Do not execute workbook macros.

Settings:
- portrait/landscape
- A4/Letter
- margins
- fit sheet to width
- one sheet per section
- optional sheet selection
- repeat header rows if feasible

Wide sheet algorithm:
- calculate printable width
- determine column widths
- scale within minimum readable font threshold
- optionally paginate horizontally instead of making text microscopic

C. POWERPOINT TO PDF

Primary format:
- PPTX

Use JSZip to parse OOXML.
Render each slide locally.

Preserve where feasible:
- slide dimensions
- background
- solid/gradient fills
- images
- text boxes
- font family/size/color
- basic shapes
- line styles
- theme colors
- grouping/z-order

Do not execute macros.
Animations/transitions are not representable in static PDF and should be intentionally omitted.
Speaker notes are excluded by default.

Missing fonts:
- use deterministic fallback
- optionally warn user

D. HTML TO PDF

Support two modes:
1. Upload local HTML file/package constraints
2. Paste raw HTML/CSS

Security:
- sanitize scripts
- never execute arbitrary JavaScript from uploaded HTML
- block network fetches by default or explicitly ask before loading external resources
- strip iframes
- CSP sandbox if previewing untrusted content

Render safe HTML/CSS to PDF.
Explain CSS support boundaries.

E. MARKDOWN TO PDF

Features:
- paste Markdown
- upload .md
- live preview
- headings
- lists
- code blocks
- blockquotes
- tables
- images with local or user-approved sources
- links
- syntax highlighting if implemented locally

Themes:
- clean document
- academic
- technical
- minimal

Export paginated PDF with sensible widows/orphans where possible.

F. CSV TO PDF

Features:
- delimiter auto-detection with manual override
- encoding detection/fallback
- header row toggle
- column alignment
- landscape mode for wide tables
- repeat header on each page
- page numbers
- row striping optional

Never load huge CSV entirely into DOM if it has hundreds of thousands of rows.
Use streaming/chunk parsing if practical and enforce a safe output row/page limit with explanation.

G. EBOOK TO PDF

Primary support:
- EPUB
- TXT
- HTML-based ebook content

MOBI/AZW3 only if a reliable local parser with compatible license is available.
Do not advertise formats you cannot actually parse.

EPUB:
- unzip container
- parse OPF manifest/spine
- resolve internal resources
- sanitize HTML
- concatenate chapters with page breaks
- embed local images
- preserve headings/basic CSS
- generate PDF

Do not execute embedded scripts.

H. AUDIO TO PDF

Goal:
- user provides MP3/WAV/M4A or browser-decodable audio
- transcribe locally when feasible
- format transcript into PDF

Preferred privacy architecture:
- on-device Whisper model via WASM/WebGPU/transformers runtime if practical for supported devices

Because models are large:
- show model download size
- lazy download
- cache with clear storage controls
- capability-check WebGPU/WASM
- provide conservative fallback or explain unsupported device

Do not silently upload audio to a cloud speech API.
If a cloud optional mode is ever added, it must require explicit opt-in and disclosure.

Transcript options:
- plain transcript
- timestamps
- speaker labels only if diarization actually exists
- title/date fields
- editable transcript preview before export

I. CREATE PDF

Build a local rich-text document composer.
Features:
- headings
- paragraphs
- bold/italic/underline
- ordered/unordered lists
- links
- images
- tables
- horizontal rule
- page break
- alignment
- print margins/page size

Use a well-tested editor framework only if bundle/license is acceptable.
Store draft locally.
Export to PDF with pagination.

J. SHARED PAGINATION ENGINE

HTML/Markdown/Create PDF/eBook can share a pagination/render pipeline.
Avoid maintaining four independent PDF generators.

K. FONT POLICY

Do not bundle fonts without appropriate licenses.
Provide:
- a small set of redistributable fonts
- system font fallbacks
- user warning when source font cannot be reproduced

L. IMAGES

All embedded images should remain local.
Normalize unsupported formats through canvas when needed.
Respect orientation.
Clamp dimensions to avoid huge canvas memory.

M. TEST FIXTURES

DOCX:
- basic resume
- tables
- images
- headers/footer
- custom fonts

XLSX:
- styles
- merged cells
- formulas with cached values
- multiple sheets
- images
- charts if supported

PPTX:
- text
- shapes
- images
- theme colors
- missing font

HTML/Markdown:
- long content
- code
- tables
- page breaks

EPUB:
- multi-chapter with images

Audio:
- short known transcript fixture

N. DEFINITION OF DONE

All conversion tools are local-first.
Unsupported constructs are disclosed.
No macro/script execution.
Output opens and pagination is reasonable.
Large inputs do not freeze the main thread.

At completion provide a compatibility matrix by format and feature, plus known fidelity gaps.

Do not start PDF-to-Office conversions yet.
```

---

# Phase 7 Prompt — Convert from PDF: Word, Excel, PowerPoint, HTML, EPUB, Audio, High-Fidelity Extraction

```text
Implement Phase 7 of PaperZero: conversion FROM PDF into editable or alternate formats.

TOOLS REQUIRED

1. PDF to Word
2. PDF to Excel
3. PDF to PowerPoint
4. PDF to HTML
5. PDF to EPUB
6. PDF to Audio
7. Extract Text enhancements
8. PDF to JPG/PNG improvements if needed

GENERAL REALITY

A PDF is a page-description format. It usually does not contain semantic paragraphs, tables, or slide objects in the way Word/Excel/PowerPoint do.
Therefore the converter must reconstruct structure heuristically.
Do not claim perfect editability.

Build shared document-layout analysis rather than separate naive extraction for each tool.

A. LAYOUT ANALYSIS ENGINE

From PDF.js/MuPDF extraction gather per text item:
- text
- x/y
- width/height
- font name
- font size estimate
- transform/rotation
- page number

Also gather:
- images if extractable
- vector lines/rectangles where useful for table detection
- links

Normalize coordinates.
Cluster into:
- words
- lines
- blocks
- columns

Heuristics:
- y proximity for lines
- x gaps for word spacing
- consistent x boundaries for columns/tables
- font size/weight for headings
- paragraph spacing

B. PDF TO WORD

Output DOCX generated locally.
Use an OOXML/docx library that can run browser-side.

Reconstruct:
- paragraphs
- headings
- basic lists when inferable
- tables when table detector is confident
- images
- page breaks optionally

Modes:
1. Flowing editable document — prioritize semantics and editing
2. Layout-preserving mode — optional, uses positioned text boxes and is less pleasant to edit

Clearly explain trade-off.

For scanned PDFs:
- route through OCR first or offer integrated OCR

C. PDF TO EXCEL

This tool is table extraction, not arbitrary page conversion.

Pipeline:
1. extract positioned text
2. identify candidate table regions
3. infer rows from y coordinates
4. infer columns from recurring x boundaries
5. consider ruling lines where available
6. merge wrapped text cells
7. infer headers
8. output XLSX

UX:
- page range selector
- show detected tables
- preview table grid
- allow selecting which tables to export
- optional edit of column boundaries before download for difficult tables

Output:
- separate worksheet per detected table or logical group

For scanned tables:
- require/offer OCR
- warn users to verify numeric values

D. TABLE DETECTION CONFIDENCE

Assign confidence based on:
- row alignment consistency
- column boundary consistency
- ruling lines
- density
- header separation

Do not force prose into an Excel grid when confidence is low.

E. PDF TO POWERPOINT

Offer two modes:

1. Visual fidelity mode — required for initial parity
   - render each PDF page at high quality
   - create one PPTX slide per page
   - place page image as full-slide background
   - result looks nearly identical but is not element-editable

2. Experimental editable mode — optional
   - reconstruct text boxes and images from PDF coordinates
   - shapes/complex vectors may remain as image background

Do not call visual-fidelity mode “fully editable.”
The file is editable at slide level but its flattened page is an image.

F. PDF TO HTML

Provide two modes:

Semantic mode:
- extract headings/paragraphs/lists heuristically
- responsive HTML
- searchable/selectable
- better accessibility
- may not preserve exact layout

Pixel/layout mode:
- use positioned HTML/SVG/canvas background and text layers
- closer visual fidelity
- less responsive/semantic

Security:
- output must not include executable PDF JavaScript
- sanitize links/HTML

Package images/assets into ZIP if required for standalone HTML.

G. PDF TO EPUB

Use semantic extraction.
Pipeline:
- detect document title if available
- split into chapters using heading heuristics or page groups
- extract text/images
- create XHTML chapter files
- build OPF/nav/container
- ZIP using EPUB mimetype rules

Do not use fixed-page screenshots as default EPUB unless user selects fixed-layout EPUB.

For complex documents, warn that reading order can require cleanup.

H. PDF TO AUDIO

Local browser speech path:
- extract text locally
- display reading text
- use SpeechSynthesis for immediate playback when available
- controls: play/pause/stop, speed, voice, page/chapter

If exporting an actual audio file is required:
- browser SpeechSynthesis often cannot directly produce an audio Blob
- only offer export if a local TTS model/runtime can generate PCM/audio bytes
- otherwise clearly distinguish “Listen in browser” from “Download audio.”

Do not fake downloadable TTS.

Reading order:
- use layout analysis for columns
- allow page range
- skip repetitive headers/footers if heuristic is reliable and optional

I. EXTRACT TEXT V2

Enhance Phase 1:
- preserve paragraphs where possible
- optional reading-order mode
- remove repeated headers/footers
- export TXT/MD/JSON
- JSON can include page and bounding boxes for developer/debug use

J. IMAGE EXTRACTION

Where useful for Word/HTML/EPUB:
- extract embedded images when API supports it
- deduplicate by hash
- fallback to cropped page render for complex image/vector regions

K. SCANNED PDF PATH

For PDF-to-Word/Excel/HTML/EPUB:
- detect missing text layer
- offer OCR first
- user should not need to leave the route manually
- reuse Phase 5 OCR service

L. MEMORY/PERFORMANCE

Do not render every page unless output mode actually needs rasterization.
Text/layout extraction should avoid high-DPI canvases.
Batch long documents.

M. TEST FIXTURES

- simple single-column report
- two-column paper
- resume
- invoice
- bank-like table
- annual report table
- presentation PDF
- scanned table
- RTL sample
- CJK sample

Define objective checks where possible:
- text recall
- table cell placement
- page count
- resulting Office file opens

N. DEFINITION OF DONE

Generated DOCX/XLSX/PPTX/HTML/EPUB files open in common viewers.
The UI states whether conversion prioritizes semantics or visual fidelity.
Scanned files integrate OCR.
No file upload occurs.

At completion report:
- layout heuristics
- confidence approach
- output library choices/licenses
- format fidelity matrix
- known difficult PDF classes

Do not start AI chat or collaboration yet.
```

---

# Phase 8 Prompt — Compare PDF and Forensic Repair Engine

```text
Implement Phase 8 of PaperZero: document comparison and damaged-PDF recovery.

TOOLS REQUIRED

1. Compare PDFs
2. Repair PDF

The initial Compare feature should match the proven high-value UX of synchronized side-by-side visual comparison. Automatic diff highlighting is an enhancement after the reliable baseline exists.

A. COMPARE PDF — BASELINE UX

Input exactly two PDFs:
- Original / Left
- Revised / Right

Workspace:
- two side-by-side viewers on desktop
- stacked/toggle view on narrow mobile layouts
- synchronized scrolling toggle on by default
- page number indicators for each file
- zoom synchronized by default with unlock option if useful
- fit-width / fit-page
- swap left/right
- replace either file

Use PDF.js rendering locally.

B. SYNCHRONIZED SCROLLING

Do not simply copy raw scrollTop pixels because pages can differ in size/page count.
Implement normalized or page-aware sync:
- determine active page and intra-page fractional position in source pane
- map to corresponding page/fraction in target pane
- avoid feedback loops when programmatically scrolling the opposite pane

If documents have different page counts:
- sync common page numbers
- let extra pages scroll normally at end

C. SIDE-BY-SIDE PERFORMANCE

Render only visible/near-visible pages using virtualization/intersection observers.
Use low-resolution thumbnails/page placeholders until needed.
Do not eagerly render two 500-page documents at full resolution.

D. OPTIONAL OVERLAY MODE

Add an overlay comparison mode after baseline works:
- render same page from A and B to canvases
- opacity slider
- blink A/B mode

This helps detect visual displacement without building semantic diff.

E. AUTOMATIC VISUAL DIFF — OPTIONAL ENHANCEMENT

If implementing:
- render corresponding pages at controlled resolution
- compare pixel data
- ignore small anti-aliasing differences using threshold
- create diff heatmap/regions
- report changed-page list

Do not run full-resolution pixel diff on hundreds of pages concurrently.

F. TEXT DIFF — OPTIONAL ENHANCEMENT

Extract text per page, normalize whitespace, and compute line/token diff.
Show:
- added text
- removed text
- changed numbers

Caveat:
PDF text extraction reading order can differ even when visible content is similar.
Label automatic text diff as assistive, not authoritative for legal review.

G. REPAIR PDF — PURPOSE

Recover as much content as possible from malformed PDFs without uploading them.
Target issues:
- broken/missing xref table
- malformed xref offsets
- missing or damaged trailer
- missing %%EOF
- truncated tail
- incorrect stream length
- damaged page tree
- parseable objects stranded outside normal references

Use a robust local engine such as MuPDF WASM, qpdf WASM if available/licensed, or a carefully implemented recovery pipeline.
Do not write a fragile regex-only “repair” and claim forensic recovery.

H. REPAIR STRATEGY PIPELINE

Implement multiple bounded strategies, stopping when a valid sufficient result is recovered.
Suggested sequence:

Strategy 1 — Standard tolerant parse
- try primary parser with recovery/tolerant flags
- rewrite normalized output if successful

Strategy 2 — Xref reconstruction
- scan byte stream for indirect object declarations
- reconstruct object offsets
- locate trailer/root candidates

Strategy 3 — Trailer/catalog recovery
- search recoverable Catalog objects
- identify Pages root
- rebuild minimal trailer/xref

Strategy 4 — Page-tree salvage
- locate Page objects directly
- reconstruct a new Pages tree from readable page dictionaries
- preserve referenced resources where resolvable

Strategy 5 — Content salvage fallback
- recover renderable pages/images/text individually into a new PDF
- this may lose metadata, bookmarks, forms, or interactivity but can rescue visible content

Use an established PDF engine wherever possible instead of manually reimplementing the full PDF spec.

I. REPAIR RESULT REPORT

Show:
- strategy that succeeded
- input file size
- pages detected/recovered
- pages lost if known
- warnings
- features potentially lost: bookmarks, forms, attachments, signatures, metadata

Never state “100% repaired” unless validation proves complete equivalence, which is rarely possible.

J. TRUNCATED FILE HANDLING

If the file ends mid-stream or mid-object:
- salvage complete prior objects/pages
- do not attempt to invent missing content
- report partial recovery

K. ENCRYPTED FILES

If encrypted and parser requires password:
- prompt for known password locally
- do not attempt cracking

L. REPAIR VALIDATION

After building repaired output:
- parse with at least one independent parser if feasible
- count pages
- render sample/each page at thumbnail resolution
- ensure no fatal parser errors
- ensure output has valid trailer/xref as generated by chosen writer

M. TEST FIXTURES

Generate deterministic corrupted fixtures from valid PDFs:
- remove EOF
- corrupt startxref
- change xref offsets
- truncate final N bytes
- damage stream length
- remove trailer reference
- damage page-tree count/reference

Keep original expected source for comparison.

Tests should verify:
- tool does not crash
- recoverable cases return valid PDF
- unrecoverable cases return an honest error/report
- page salvage count is correct where expected

N. ROUTES

/compare-pdfs
/repair-pdf

O. DEFINITION OF DONE

Compare PDF handles long documents smoothly with synchronized navigation.
Repair PDF uses multiple genuine recovery paths and clearly distinguishes full vs partial recovery.
All processing is local.

At completion report:
- compare sync algorithm
- virtualization strategy
- whether visual/text diff shipped
- repair engine/library
- five strategy definitions
- corruption fixture results
- content types commonly lost during salvage

Do not start remote AI or P2P yet.
```

---

# Phase 9 Prompt — AI Chat, Summarizer, Local/Remote Privacy Modes

```text
Implement Phase 9 of PaperZero: AI-assisted PDF understanding with explicit privacy boundaries.

TOOLS REQUIRED

1. Chat with PDF
2. AI PDF Summarizer
3. Shared document chunking/retrieval layer
4. Optional local-AI mode where technically practical

CRITICAL PRIVACY RULE

PaperZero must never say “nothing leaves your device” on a cloud-AI workflow if extracted document text is sent to an external model.
The binary PDF should remain local by default.

Before the first cloud request for each session/document, show an understandable disclosure such as:
“Your PDF file stays on this device. To answer this question, PaperZero will send relevant extracted text and your question to the selected AI provider.”

Require an explicit action/consent before first send.

A. LOCAL DOCUMENT INGESTION

Use existing PDF text extraction and OCR services.
For each document:
- extract text locally
- preserve page boundaries
- store source metadata locally
- if page has no text, offer OCR

Support multiple PDFs in one chat session.
Each chunk must retain:
- document ID/name for display only locally
- page number
- chunk index
- text

Do not send raw filename to remote provider unless it is needed and user understands; use neutral document labels by default.

B. CHUNKING

Implement token/character-aware chunking with overlap.
Avoid splitting in the middle of sentences when practical.
Suggested metadata:
- sourceDocumentId
- pageStart/pageEnd
- chunkText
- tokenEstimate

Do not concatenate an unlimited 500-page document into every prompt.

C. RETRIEVAL

MVP retrieval can use local lexical search/BM25-like scoring.
Better mode can use local embeddings if model size/performance is acceptable.

Preferred architecture:
question
-> local query processing
-> retrieve top relevant chunks locally
-> send only selected chunks + question to cloud LLM

This materially improves privacy and cost compared with sending full document every turn.

Provide a “Send full extracted text” mode only if necessary for very small documents and disclose it.

D. OPTIONAL LOCAL EMBEDDINGS

Use Transformers.js, ONNX Runtime Web, or similar.
Requirements:
- lazy model download
- show model size
- cache locally
- allow clearing model cache
- WebGPU if supported, WASM fallback if acceptable

If local embeddings make first-use bundle too heavy, start with lexical retrieval and design interface for later embeddings.

E. PROVIDER ABSTRACTION

Create a provider interface rather than hardcoding Gemini directly into UI.
Example:
AIProvider {
  id
  capabilities
  streamChat(request)
  summarize(request)
  validateCredential()
}

Initial provider can be Gemini or another chosen provider.
If user supplies their own API key:
- store in memory by default
- if “remember on this device” exists, explicit opt-in and encrypted local storage is preferable, but browser-side encryption without a separate secret has limitations; document that honestly
- never send key to PaperZero backend if direct browser-to-provider mode is used

If PaperZero backend proxies model requests:
- explain server sees text context
- do not log request content
- implement rate limiting without content logging

F. STREAMING CHAT

Support SSE/fetch streaming where provider allows.
UX:
- streaming answer
- stop generation
- retry
- copy answer
- clear conversation
- citations to local page numbers/chunks

Citations:
The answer should cite sources like:
[Document A, p. 4]
[Document B, p. 9]

Citations come from local chunk metadata.
Do not claim factual page support if model response cannot be connected to retrieved context.

G. PROMPT CONSTRUCTION

System instructions should tell model:
- answer from supplied context
- say when context is insufficient
- do not invent page references
- distinguish multiple documents

User prompt injection inside PDF text is untrusted content.
The system prompt must explicitly instruct model to treat document text as data, not instructions.

Do not expose secrets/system prompt in context.

H. CHAT SESSION

Keep chat session in memory by default.
Optional IndexedDB save should be user-controlled because chat contains document-derived information.
If saved locally:
- clear button
- per-session delete

I. SUMMARIZER

Provide modes:
- Quick overview
- Bullet points
- Detailed summary
- Executive summary
- Key actions
- Key dates/entities where relevant

For long documents:
- map-reduce/hierarchical summarization
- summarize chunks locally through provider calls
- combine summaries
- respect provider token limits

Do not cut off the document silently because it exceeds context.
Show coverage such as:
“Summarized 84 of 84 pages.”

J. LOCAL SUMMARIZER MODE — OPTIONAL

If a capable local small model can run acceptably:
- offer “Local AI (Beta)”
- no extracted text leaves device
- show model download size and approximate capability limitations

Do not label cloud mode “on-device.”

K. PII / SENSITIVE CONTENT WARNING

Because users may process highly sensitive documents:
- show provider disclosure prominently
- optionally let users run local PII scanner before AI send
- provide toggle to redact detected PII from outgoing context

Implement a context transform pipeline:
retrieved chunk -> optional PII masking -> remote request

L. TOKEN/COST CONTROL

Estimate tokens locally.
Cap retrieved context.
For user-owned API key, show approximate token usage if feasible.
Do not make inaccurate cost promises.

M. NETWORK FAILURE

AI tools require internet in cloud mode.
Offline:
- local extraction/retrieval can still work
- cloud answer button should explain offline status
- local AI mode may still work if model is cached

N. SECURITY

Treat remote output as untrusted Markdown.
Sanitize rendered Markdown/HTML.
No arbitrary scripts/links.

O. TESTS

Unit:
- chunking
- retrieval ranking
- prompt injection isolation
- source citation mapping
- provider streaming parser
- PII masking
- token budget truncation

Integration:
- mock provider
- long document hierarchical summary
- multi-document retrieval

E2E:
- upload local PDF
- confirm privacy disclosure
- ask question
- verify only mocked extracted context is sent, never binary PDF
- receive streaming response
- click cited page and navigate local viewer

P. DEFINITION OF DONE

PDF binary never goes to cloud AI provider in default architecture.
Remote text transfer is disclosed and consented to.
Retrieval sends relevant chunks rather than entire long PDFs by default.
Answers include local page citations.
Chat supports multiple PDFs.
Summaries handle long documents without silent truncation.

At completion report:
- provider architecture
- exact remote data flow
- default retention behavior
- retrieval method
- context/token limits
- prompt-injection mitigations
- local mode status

Do not claim cloud AI is fully local.
```

---

# Phase 10 Prompt — P2P File Share and Collaborative Whiteboard with WebRTC

```text
Implement Phase 10 of PaperZero: privacy-first peer-to-peer sharing and real-time collaboration.

TOOLS REQUIRED

1. P2P File Share
2. Collaborative Whiteboard

The application server may coordinate connection setup/signaling, but it must not store or proxy document bytes/drawing history in the normal P2P path.

A. WEBRTC ARCHITECTURE

Use:
- RTCPeerConnection
- RTCDataChannel
- STUN servers for connectivity discovery
- TURN fallback if you choose to support difficult NAT/firewall cases

Important privacy nuance:
A TURN relay carries encrypted WebRTC traffic through a relay server when a direct path is unavailable. It does not need to persist file content, but calling every TURN-assisted transfer “direct browser-to-browser with no server in between” would be inaccurate.

UI should state connection type:
- Direct P2P
- Relayed P2P (TURN), encrypted

B. SIGNALING

Implement a minimal signaling service for:
- session creation
- short share/join code
- SDP offer/answer exchange
- ICE candidate exchange
- expiry

Do not store file bytes.
Expire signaling sessions quickly, e.g. 10-30 minutes.
Rate-limit abuse.
Use random high-entropy session tokens behind human-friendly short code mapping if necessary.

C. P2P FILE SHARE UX

Sender:
1. select file
2. create session
3. receive share code/link
4. wait for receiver
5. confirm connection
6. transfer

Receiver:
1. enter code/open link
2. see sender-supplied file metadata: name, size, type
3. accept/reject
4. receive stream
5. download/save

Do not auto-download before user accepts.

D. FILE CHUNKING

Do not send a 2 GB file as one ArrayBuffer.
Use chunks, e.g. 64 KB to 256 KB based on tested DataChannel behavior.

Protocol messages:
- HELLO
- FILE_META
- ACCEPT/REJECT
- CHUNK
- ACK or flow-control state
- COMPLETE
- CANCEL
- ERROR

Use DataChannel bufferedAmount and bufferedAmountLowThreshold for backpressure.
Do not enqueue unlimited chunks.

E. INTEGRITY

Compute SHA-256 locally on sender.
After receive, compute SHA-256 and compare.
Show:
- Verified
or
- Integrity check failed

For enormous files, consider incremental hashing library because Web Crypto digest may require entire data buffer depending on API.

F. RESUME

Optional enhancement:
- track chunk offsets in memory/IndexedDB
- allow reconnect/resume within session

Do not block baseline release on complex resume if not reliable.

G. CONNECTION UX

Show:
- connecting
- direct/relay state
- transfer speed
- bytes transferred
- percentage
- cancel

Avoid exact “time remaining” unless sufficiently smoothed and labeled estimate.

H. P2P SECURITY

WebRTC media/data channels are encrypted.
Additionally:
- session tokens must be unguessable
- validate signaling messages
- impose maximum metadata sizes
- sanitize filenames
- receiver chooses final download

Do not expose private IP details in application UI/logs unnecessarily.

I. COLLABORATIVE WHITEBOARD

Create a separate board route.
Capabilities:
- pen
- eraser
- line
- rectangle
- ellipse
- text
- color
- stroke width
- clear board with confirmation
- undo own last operation or shared undo model if designed carefully
- export PNG
- export PDF

Responsive canvas must work with mouse, touch, and pen pointer events.

J. WHITEBOARD DATA MODEL

Do not synchronize raw bitmap frames.
Synchronize vector operations/strokes:
{
  id,
  actorId,
  tool,
  points,
  color,
  width,
  timestamp/logicalClock
}

For text/shapes, send structured objects.

K. MULTI-PARTICIPANT MODEL

Simple mesh WebRTC works for small groups.
Set a conservative participant limit such as 4-6 if using mesh.
For larger rooms, architecture would require SFU/server routing, which conflicts with simple no-server-content design.

Be honest about supported room size.

L. STATE SYNC

When a new peer joins:
- existing participant sends current vector object state
- chunk sync if large
- then stream new operations

Use deterministic IDs to deduplicate.

If concurrent editing becomes complex, consider Yjs/CRDT locally with a WebRTC transport, after licensing review.

M. OPTIONAL PDF BACKGROUND

Allow user to load a PDF locally as a personal/shared whiteboard background only if implementation can share required rendered page data or peers load the same file.
Privacy-friendly options:
- each participant independently selects same file
- sender explicitly chooses to share a rendered page image P2P

Do not upload PDF to server.

N. EXPORT

PNG:
- render vector state to canvas

PDF:
- generate locally
- one board per page or current canvas as a PDF page

O. SIGNALING/PRIVACY DISCLOSURE

Clearly state:
- signaling metadata may pass through PaperZero service
- file/drawing content uses encrypted WebRTC channel
- TURN relay may carry encrypted traffic if direct connection fails
- PaperZero does not persist transferred file bytes in normal architecture

P. OFFLINE LIMITATION

P2P over different devices generally requires networking/signaling and is not a fully offline feature.
Do not show the generic “Works offline” badge on it unless both peers can connect and signaling is locally available.

Q. TESTS

Use two browser contexts in Playwright.
Test:
- session creation/join
- file transfer
- integrity hash
- cancel
- receiver reject
- dropped connection
- whiteboard stroke synchronization
- shape/text synchronization
- late join state sync

Test TURN/direct labeling if environment supports it.

R. DEFINITION OF DONE

File bytes are never persisted by signaling server.
Transfers use chunked backpressure.
Integrity is verified.
Whiteboard updates in real time for supported small room sizes.
Privacy wording is technically correct for TURN cases.

At completion report:
- signaling architecture
- STUN/TURN configuration strategy
- chunk size/backpressure
- max tested file size
- supported participant count
- integrity method
- exact server metadata retained and TTL
```

---

# Phase 11 Prompt — GST Invoice, POS Billing, GST Filing Preparation

```text
Implement Phase 11 of PaperZero: local-first business utilities, initially focused on Indian GST workflows.

TOOLS REQUIRED

1. GST Invoice Generator
2. POS Billing
3. GST Filing Preparation PDF utility

These tools must remain local-first. They should not become a cloud accounting platform in this phase.

LEGAL/PRODUCT BOUNDARY

Build document-generation and calculation utilities, not tax/legal advice.
GST rules can change. Put tax constants/configuration behind a versioned configuration layer and include a “Verify current requirements” disclaimer.
Do not claim government certification unless actually obtained.

A. GST INVOICE GENERATOR — DOCUMENT TYPES

Support configurable templates for:
- Tax Invoice
- Bill of Supply
- Debit Note
- Credit Note
- Export Invoice if requirements are validated

Start with Tax Invoice as fully tested primary mode.

B. SELLER FIELDS

- business name
- address
- GSTIN
- state/state code
- phone/email optional
- logo optional local image
- bank/payment details optional
- invoice prefix/number
- invoice date

Store reusable seller profile locally only with user consent.

C. BUYER FIELDS

- customer/business name
- billing address
- shipping address optional
- GSTIN optional
- state/state code
- place of supply

D. GSTIN VALIDATION

Implement format validation.
If checksum validation is implemented, test it thoroughly.
Do not call an external verification API silently.
Label local format validation as format/checksum validation, not proof that registration is active.

E. LINE ITEMS

Each item:
- name/description
- HSN/SAC
- quantity
- unit
- rate
- discount optional
- taxable value
- GST rate
- cess optional if supported

Common rate presets:
0, 5, 12, 18, 28
but allow configuration in case categories/rules evolve.

F. TAX CALCULATION

Determine intra-state vs inter-state from supplier state and place of supply.

Intra-state:
- CGST = half applicable GST rate
- SGST/UTGST = half

Inter-state:
- IGST = full applicable rate

Use decimal arithmetic library or integer paise arithmetic to avoid floating-point money errors.
Define rounding rules explicitly.

Calculate:
- subtotal
- item discount
- taxable subtotal
- CGST
- SGST
- IGST
- cess if supported
- round-off
- grand total

G. HSN/SAC SUMMARY

Create grouped tax summary:
- HSN/SAC
- taxable value
- tax rate
- CGST/SGST/IGST amounts

H. INVOICE NUMBERING

Provide local helper for sequences.
Do not guarantee legal compliance without current validation.
Support user-controlled format and counter.
If locally auto-incrementing:
- store on device
- allow correction
- warn that clearing browser storage loses sequence state
- do not silently reuse numbers

I. PDF OUTPUT

Generate professional printable PDF locally.
Include:
- seller/buyer
- invoice metadata
- item table
- tax summary
- total in numbers
- total in words if implemented reliably for INR
- place of supply
- reverse charge indicator if supported
- signature field/space

Original PaperZero design; do not copy reference template exactly.

J. LOCAL INVOICE HISTORY — OPTIONAL

If implemented:
- local only
- IndexedDB
- searchable by invoice number/customer locally
- export JSON/CSV backup
- import backup
- clear data

Strongly warn that browser data deletion can erase history.

K. POS BILLING

Scope:
Single-device/single-counter browser POS.

Features:
- store profile
- product catalog
- product search
- SKU optional
- HSN
- price
- GST rate
- add to cart
- quantity
- line discount
- bill discount if rules allow
- subtotal/tax/total
- cash/card/UPI payment label only; do not process payments in this phase
- generate receipt
- print
- PDF receipt
- local bill history

L. PRODUCT CATALOG STORAGE

Use IndexedDB rather than localStorage for robust structured data.
Support:
- add/edit/delete
- CSV import/export
- backup/restore

No cloud sync.

M. THERMAL PRINTING

Create print CSS/templates for:
- 58mm
- 80mm

Use browser print dialog.
Do not claim direct USB printer support unless WebUSB/native integration is intentionally implemented.

N. POS OFFLINE MODE

After page assets are cached, POS must continue during internet outage.
No transaction requires backend.

O. POS LIMITATIONS

Display somewhere in settings/help:
- single device
- no central stock sync
- no multi-branch reporting
- no staff accounts
- local data can be lost if browser storage is cleared

P. GST FILING PREPARATION

Scope this as PDF preparation for filing portals, not tax-return submission.

Use cases:
- combine supporting documents
- split by size/page ranges
- compress below portal file-size limits
- reorder attachments
- generate index/cover sheet if user requests

Create workflow presets such as:
- SCN response packet
- appeal attachment packet
- generic GST upload bundle

Because portal requirements can change:
- make size targets configurable
- put default limits in versioned config
- display “Check current portal requirements”

Do not automatically submit documents to government portals.

Q. PRIVACY

Invoice/customer/catalog data must never enter analytics.
Events may say “invoice_generated” but not include GSTIN, customer name, amount, item names, or invoice number.

R. TESTS

Money calculation unit tests:
- intra-state
- inter-state
- mixed GST rates
- discounts
- rounding
- zero-rated

Invoice validation:
- GSTIN format
- required fields
- state logic

POS E2E:
- create product
- add cart
- change quantity
- generate receipt
- reload offline
- catalog persists locally

GST prep:
- combine + compress + split workflow using shared PDF operations

S. DEFINITION OF DONE

GST math is deterministic and tested.
Invoice/receipt PDFs are printable and valid.
POS works offline on one device.
All commercial data remains local.
GST filing prep composes existing PDF operations instead of duplicating them.

At completion report:
- tax calculation rules implemented
- configuration/version strategy
- rounding approach
- local data model
- backup format
- print support
- legal/compliance disclaimers
```

---

# Phase 12 Prompt — PDF Workflow Builder and Composable Operation Pipeline

```text
Implement Phase 12 of PaperZero: the PDF Workflow Builder.

This is a major product feature and should reuse existing operations rather than becoming a new collection of duplicated tool code.

PRODUCT GOAL

A user uploads a PDF once, then chains multiple local operations and downloads the final result once.

Example:
Upload
-> Remove Metadata
-> Redact selected PII
-> Add Watermark
-> Add Page Numbers
-> Compress
-> Encrypt
-> Download

A. OPERATION PIPELINE MODEL

Build a typed workflow definition.
Conceptually:

interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  operationId: string;
  options: unknown;
  enabled: boolean;
}

Each operation must declare workflow metadata:
- canRunInWorkflow
- accepted input MIME/type
- output type
- mutates page count?
- requires user interaction after start?
- supports deterministic headless execution?
- resource cost class
- incompatible predecessors/successors

B. FIRST SUPPORTED WORKFLOW OPERATIONS

Start with deterministic non-interactive operations:
- remove metadata
- rotate pages using preset selection
- add watermark
- add page numbers
- headers/footers
- flatten
- compress
- encrypt
- invert colors where safe

Then add conditionally interactive operations:
- split/extract
- redaction
- auto-redact PII with review
- crop

Do not pretend a step can run unattended if it needs visual user review.

C. WORKFLOW UI

Desktop:
- left: available operations palette
- center: ordered pipeline
- right: selected-step settings

Mobile:
- operation picker drawer
- step list
- settings bottom sheet/page

Capabilities:
- add step
- remove step
- reorder step
- enable/disable
- duplicate step
- reset
- name workflow
- save locally
- load preset

Provide non-drag reordering buttons for accessibility.

D. TYPE COMPATIBILITY

Validate workflow before execution.
Examples:
- PDF -> watermark -> PDF valid
- PDF -> PDF-to-JPG -> encrypt invalid because output is images

Initially constrain workflow builder to PDF-in/PDF-out operations to simplify compatibility.
Do not expose conversions that break the pipeline unless output contracts support them explicitly.

E. ORDERING WARNINGS

Some steps are logically order-sensitive.
Examples:
- Compress before adding high-resolution watermark may change final size.
- Encrypt should usually be last because later operations may need document access.
- OCR before redaction may be necessary for scans.
- Flatten before form filling is invalid/unhelpful.
- Secure redaction should occur before encryption.

Create advisory rules:
- error for impossible order
- warning for suboptimal order
- auto-fix suggestion where safe

Do not silently reorder user's workflow without consent.

F. RESOURCE PLANNING

Before running:
- estimate cumulative resource load
- show heavy steps
- identify WASM/model assets that must be loaded
- warn low-memory devices

Do not keep every intermediate version simultaneously in RAM.
Pipeline should dispose previous intermediate once next step succeeds unless undo/recovery requires local persistence.

G. INTERMEDIATE DATA STRATEGY

Use a bounded approach:
- current input buffer
- current output buffer
- optional checkpoint in IndexedDB for long/heavy workflows

For very large workflows, allow checkpoints after expensive stages.
If a step fails:
- show failed step
- preserve last valid checkpoint where possible
- allow retry from failed step

H. PROGRESS

Show both:
- overall workflow progress
- current step progress

Example:
Step 3 of 6 — Compress PDF
Compressing...

Do not simply average percentages if steps have radically different cost unless weighted estimates exist.
Stage-based progress is acceptable.

I. CANCELLATION

Cancel should:
- abort current operation
- terminate relevant worker if needed
- stop future steps
- preserve original input
- optionally preserve last successful checkpoint

J. SAVED WORKFLOWS

Save locally in IndexedDB/local structured storage.
No account required.

Store only:
- workflow name
- step IDs
- options

Do not store document content inside a saved workflow definition.

Provide export/import workflow JSON.
Version schema.
Validate imported JSON strictly.

K. PRESETS

Ship useful presets:

Share Confidentially:
- privacy clean
- watermark
- optional auto-PII scan/review
- compress
- encrypt

Publish PDF:
- remove metadata
- page numbers
- footer
- compress

Job Application:
- remove metadata optional
- compress to target size

Archive Scan:
- OCR
- metadata clean
- compression light/medium

GST Upload Packet:
- merge
- page numbers/index if supported
- compress to configured target

Presets should be original PaperZero naming/copy.

L. AUTO-PII INTERACTIVE STEP

Because PII findings require human confirmation:
- pause workflow at review checkpoint
- display findings
- user approves redactions
- resume pipeline

Model step state:
pending -> requiresInput -> running -> complete.

M. ENCRYPTION STEP

Passwords must not be saved inside reusable workflow definitions by default.
When workflow reaches encryption:
- prompt at run time
or
- allow per-run ephemeral secret input before start

Never serialize password in exported workflow JSON.

N. WORKFLOW EXECUTION ENGINE

Implement a pipeline runner independent from React.
Pseudo-flow:

validateWorkflow()
prepareAssets()
for step in enabledSteps:
  ensureCompatible()
  if requiresInput: await userCheckpoint
  result = await operationRunner.run(...)
  validate result
  dispose previous input
return final

Emit structured events:
- workflowStarted
- stepStarted
- stepProgress
- stepRequiresInput
- stepCompleted
- stepFailed
- workflowCompleted
- workflowCancelled

O. TESTS

Unit:
- schema validation
- compatibility rules
- ordering warnings
- secret exclusion from serialization
- error recovery/checkpoint behavior

Integration workflows:
1. watermark -> page numbers -> compress
2. remove metadata -> compress -> encrypt
3. OCR -> PII review -> redact -> compress
4. invalid flatten -> fill form ordering warning

E2E:
- create workflow
- reorder steps
- save locally
- reload
- run on fixture
- download valid final PDF

P. PRIVACY

All pipeline steps maintain the privacy contract of their individual tools.
If any future cloud step is added:
- workflow must visually mark it as “Sends data externally”
- user must explicitly accept before run

Q. DEFINITION OF DONE

A PDF is uploaded/selected once and can pass through multiple local operations.
Pipeline handles failures without losing the original.
Saved workflow definitions contain no document data or passwords.
Heavy intermediates are disposed.
Core presets work.

At completion report:
- workflow schema
- compatibility matrix
- ordering rules
- checkpoint strategy
- secret-handling design
- preset definitions
- test results
```

---

# Phase 13 Prompt — Developer SDK, Shared Engine Packaging, Optional Server API Boundary

```text
Implement Phase 13 of PaperZero: package the mature local document engine as a developer-facing SDK and define an optional server-processing product boundary.

This phase is an extension beyond end-user parity. Do not compromise the consumer product's local-first architecture to build it.

A. BROWSER SDK GOAL

Expose the same battle-tested operation packages used by PaperZero UI through a documented TypeScript/JavaScript SDK.

Proposed package:
@paperzero/sdk

Example desired usage:

import { PaperZero } from '@paperzero/sdk';

const result = await PaperZero.merge({ files });
await result.download('merged.pdf');

B. SDK PRINCIPLES

- framework agnostic
- browser first
- TypeScript declarations
- tree-shakable operation modules
- no React dependency
- explicit WASM asset configuration
- worker-friendly
- AbortSignal support
- progress callbacks
- typed errors

C. API SURFACE

Expose stable operations only.
Candidate namespace:

PaperZero.pdf.merge
PaperZero.pdf.split
PaperZero.pdf.rotate
PaperZero.pdf.organize
PaperZero.pdf.watermark
PaperZero.pdf.pageNumbers
PaperZero.pdf.extractText
PaperZero.pdf.toImages
PaperZero.pdf.compress
PaperZero.pdf.ocr
PaperZero.pdf.encrypt
PaperZero.pdf.decryptWithPassword
PaperZero.pdf.redact
PaperZero.pdf.sanitize
PaperZero.pdf.hash

Do not expose experimental editor internals as stable API until their contracts are reliable.

D. DATA TYPES

Accept:
- File
- Blob
- ArrayBuffer
- Uint8Array

Return a Result object that can provide:
- bytes
- blob
- mimeType
- metadata
- warnings
- download helper optional

Avoid unnecessary copies.

E. WASM ASSET LOADING

SDK users need a predictable way to host heavy assets.
Provide configuration:

PaperZero.configure({
  assetBaseUrl,
  workerBaseUrl
});

Also support bundler-aware defaults where feasible.

Document CSP requirements.

F. WORKER CONFIGURATION

Allow:
- internal worker pool default
- worker concurrency override
- no-worker/debug mode only if safe for tests

Never default heavy compression/OCR to the main thread.

G. ERROR MODEL

Stable error codes such as:
- INVALID_INPUT
- UNSUPPORTED_FILE
- ENCRYPTED_PDF
- PASSWORD_REQUIRED
- WRONG_PASSWORD
- MEMORY_LIMIT
- WORKER_FAILED
- WASM_LOAD_FAILED
- OUTPUT_INVALID
- CANCELLED

Do not require developers to parse human strings.

H. DOCUMENTATION

Create:
- Getting Started
- Browser setup
- Next.js example
- Vite example
- React example without coupling core API to React
- Offline/PWA notes
- CSP notes
- WASM hosting
- large-file guidance
- privacy guarantees
- operation API reference

I. EXAMPLE APPS

Add small examples:
examples/vanilla
examples/react

No production secrets.

J. VERSIONING

Use semantic versioning.
Mark experimental APIs explicitly.
Document breaking-change policy.

K. NPM PACKAGE SECURITY

- package provenance/signing if available
- lockfile
- dependency audit
- no postinstall script that downloads unexpected binaries
- include license notices for bundled components

L. OPTIONAL SERVER SDK/API

Treat server processing as a separate commercial/architectural product.
Do not route consumer browser files through it automatically.

If defining it now, create only interface/spec or isolated service.
Possible server APIs:
POST /v1/pdf/merge
POST /v1/pdf/compress
etc.

But server mode requires:
- explicit upload
- retention/deletion policy
- encryption in transit/at rest
- malware/input isolation
- quotas
- workers
- storage lifecycle
- billing
- compliance posture

Do not claim the same “files never leave your device” guarantee for server API.

M. API AUTH/BILLING — OPTIONAL

If server API is implemented:
- API keys
- hashed credentials at rest
- rate limiting
- usage metering
- no document content logs
- short retention by default

This is optional and should not block browser SDK release.

N. SDK TESTS

- package build
- type tests
- browser tests
- worker path tests
- asset URL override
- AbortSignal
- progress
- operation smoke tests
- tree-shaking/bundle analysis

O. DEFINITION OF DONE

PaperZero web app can consume the SDK packages without duplicated logic.
A third-party browser app can merge/split/compress a PDF using documented APIs.
Core privacy guarantees are documented accurately.
Optional server processing is isolated and clearly different.

At completion report:
- public API
- bundle sizes by operation
- WASM asset sizes
- supported browsers
- license inventory
- semantic versioning policy
- what remains experimental
```

---

# Phase 14 Prompt — Full Product Parity, SEO, Guides, Offline Hardening, QA, Launch Readiness

```text
Implement Phase 14 of PaperZero: parity hardening and public launch readiness.

This phase is not about adding random new features. It is about ensuring the full product feels coherent, discoverable, trustworthy, fast, accessible, and maintainable.

A. PARITY AUDIT

Create a product matrix for every observed target capability.
Status values:
- Complete
- Complete with limitation
- Beta
- Not implemented

Audit at minimum:

PAGE MANAGEMENT
- Merge
- Compress
- Split
- Organize
- Rotate
- Crop/Resize
- PDF to ZIP
- Workflow Builder

EDIT/ANNOTATE
- Edit PDF Text
- Sign PDF
- Add text/image/whiteout
- PDF to Handwriting
- Handwriting to PDF
- Fill PDF Form
- Redact
- Watermark
- Page Numbers
- Headers/Footers
- Flatten
- Invert Colors

CONVERT TO PDF
- Word
- Images
- Excel
- PowerPoint
- HTML
- Create PDF
- Markdown
- CSV
- Audio
- eBook

CONVERT FROM PDF
- Word
- JPG/PNG
- Excel
- PowerPoint
- Extract Text
- HTML
- Audio/listen
- EPUB

SECURITY
- Encrypt
- Remove Password
- Authorized Owner Restriction Unlock
- Auto-Redact PII
- Privacy Scanner
- Fingerprint/Hash

SMART
- Chat
- Summarizer
- OCR
- Compare
- Repair

SCAN/SHARE
- Scan
- P2P Share
- Whiteboard

BUSINESS
- GST Invoice
- POS Billing
- GST Filing Prep

Do not hide missing features behind vague wording.

B. HOME PAGE

Build a polished tool directory.
Requirements:
- prominent search
- category sections
- keyboard-accessible search/filter
- fast first paint
- no loading the heavy PDF/WASM engines on the home page
- tool cards generated from registry
- privacy explanation
- offline explanation
- no-sign-up/no-watermark claims only if still true

Do not copy the reference layout or text pixel-for-pixel.

C. TOOL SEARCH

Search fields:
- name
- synonyms
- tags
- input/output types

Examples:
“jpg” -> PDF to JPG and Images to PDF
“password” -> Encrypt / Remove Password
“scan” -> Scan / OCR
“invoice” -> GST invoice

No server search required.

D. SEO ROUTE AUDIT

Every tool needs a canonical dedicated URL.
Build unique:
- title
- meta description
- H1
- introductory explanation
- how-to steps
- FAQ
- related tools

Generate metadata from typed route config plus original per-tool content.
Do not create thin doorway pages with duplicated text.

E. GUIDE/TUTORIAL SYSTEM

Create a guides section with original articles for key user intents.
Examples:
- How to merge PDFs privately
- How to compress a PDF without uploading
- How secure PDF redaction works
- OCR scanned PDFs locally
- How to sign a PDF in your browser
- How to remove metadata before sharing
- How local PDF processing works

Guides should link contextually to tools.
Do not copy reference articles.

F. TECHNICAL TRANSPARENCY PAGE

Create an original “How PaperZero Works” engineering page explaining:
- local file lifecycle
- JavaScript vs WASM roles
- workers
- memory handling
- IndexedDB
- offline caching
- compression engine
- OCR engine
- AI data flow
- P2P data flow

Include a data-flow diagram.
Be precise about exceptions where network is required.

G. PRIVACY CENTER

Create a privacy matrix by tool:
Columns:
- Tool
- File uploaded to PaperZero server?
- Content sent to third party?
- Internet required?
- Local persistence?

Examples:
Merge: No / No / No after cache / optional local history
Chat cloud mode: PDF binary No / relevant extracted text Yes / Yes / optional local chat
P2P: No persistent file upload / encrypted peer or TURN traffic / Yes / no server file storage

This matrix is more trustworthy than a blanket claim.

H. OFFLINE AUDIT

Test every local tool after:
1. load once online
2. ensure required assets cached
3. enable browser offline mode
4. reload
5. process fixture

Maintain an automated/offline smoke suite where feasible.

Cloud AI, P2P signaling, and first-time model/asset downloads are exceptions and must be labeled.

I. BUNDLE PERFORMANCE

Analyze JS/WASM bundle sizes.
Rules:
- home page should not download Ghostscript, OCR models, Office parsers, or AI models
- lazy load by tool
- split vendor chunks reasonably
- preload only lightweight critical assets

Create bundle-size budgets.

J. CORE WEB VITALS

Optimize:
- LCP
- INP
- CLS

Processing-heavy routes should remain interactive because work is off-main-thread.

K. MOBILE QA

Test current iPhone Safari and Android Chrome for:
- file picker
- drag alternatives
- downloads
- share sheet fallback
- 50 MB-ish practical limits with graceful warning
- high-DPI clamp
- signature drawing
- camera scanning
- PDF editor gestures

Do not assume desktop behavior maps directly.

L. SAFARI QA

Specifically test:
- PDF.js workers
- WASM loading
- Blob downloads
- IndexedDB quota/error handling
- service worker
- camera
- WebRTC

Implement fallbacks where practical.

M. ACCESSIBILITY AUDIT

Target WCAG 2.2 AA where practical.
Run automated accessibility checks plus manual keyboard review.

Check:
- file dropzone
- page grid reorder alternatives
- editor toolbar
- signature canvas instructions
- progress announcements
- dialogs
- compare viewer
- workflow builder
- POS controls

N. LOCAL HISTORY UX

Polish recent local files/history:
- maximum 50 by default
- local-only badge
- clear individual/all
- storage warning
- optional disable
- no confusing implication of cloud account sync

If binary results are not persisted, label history as metadata/recent activity accordingly.

O. RATINGS/FEEDBACK

If adding per-tool ratings:
- send only tool ID + rating, not file/content metadata
- rate-limit spam
- no account required if desired

Feedback form must never attach active document automatically.

P. SECURITY REVIEW

Perform:
- dependency audit
- CSP audit
- malicious PDF fixture tests
- HTML sanitizer tests
- archive decompression bomb protections
- max uncompressed size safeguards for ZIP/DOCX/PPTX/XLSX/EPUB
- path traversal prevention for archive extraction
- worker denial-of-service timeouts
- URL sanitization
- prompt injection tests for AI
- P2P signaling abuse controls

Q. ARCHIVE SAFETY

OOXML/EPUB are ZIP containers.
Implement zip-bomb safeguards:
- maximum entries
- maximum total uncompressed bytes
- maximum compression ratio warning/block
- sanitize ../ paths
- reject absolute paths

R. ERROR COPY

Audit every failure state.
Replace generic errors with actionable messages.
Examples:
- “This PDF is password protected. Enter the password or open Remove Password.”
- “600 DPI would likely exceed this device's memory. Try 300 DPI.”
- “This scanned PDF has no text layer. Run OCR first.”
- “We recovered 18 of 23 pages. Five pages were too damaged to reconstruct.”

S. PRIVACY CLAIM TEST

Search entire codebase and product copy for statements such as:
- never leaves device
- 100% local
- works offline

Verify each placement is true for that exact feature.
Remove or qualify inaccurate global claims on AI/P2P/network-dependent pages.

T. ANALYTICS REVIEW

Inspect emitted analytics payloads in tests.
Add denylist for fields resembling:
- filename
- text/content
- password
- gstin
- customer
- invoiceNumber
- signature
- apiKey

U. PRODUCTION OBSERVABILITY

Track only non-sensitive operational signals:
- route/tool load failures
- WASM asset load failures
- worker crash code
- browser family/version bucket
- operation duration bucket
- generic error code

No session replay on document-processing workspaces unless you can guarantee complete exclusion of document/canvas/input content; safest default is no replay.

V. BROWSER SUPPORT MATRIX

Publish internally and optionally externally:
- Chrome
- Edge
- Firefox
- Safari
- iOS Safari
- Android Chrome

For each advanced feature:
- full
- partial
- unsupported

W. TEST SUITE

Create a release suite covering at least one E2E flow per tool family.

Run:
- lint
- typecheck
- unit
- integration
- E2E
- accessibility smoke
- offline smoke
- production build

Add regression fixtures for every serious bug found.

X. LAUNCH CHECKLIST

Before launch confirm:
- original PaperZero branding/assets
- legal/privacy pages
- open-source license notices
- WASM licenses
- no copied competitor text/assets
- sitemap
- robots.txt
- canonical URLs
- structured data valid
- PWA install
- offline behavior
- security headers
- error monitoring privacy-safe
- backup/failure behavior documented

Y. DEFINITION OF DONE

PaperZero offers the full planned local-first product surface or labels any remaining item Beta/unsupported honestly.
The site is fast before heavy tools load.
Core local tools work offline after caching.
Privacy claims match actual network behavior.
Mobile/Safari workflows have been tested.
SEO pages are useful rather than duplicated boilerplate.
Security review is complete.

At completion produce a final launch report containing:
1. parity matrix
2. browser support matrix
3. known limitations
4. bundle-size table
5. security findings resolved/open
6. performance benchmarks
7. offline test results
8. privacy data-flow matrix
9. license inventory
10. launch checklist status
```

---

# Recommended Prompt Execution Order

Do **not** give all prompts to a coding agent in one giant request. Execute them sequentially and require the agent to finish tests before moving on.

```text
Global Master Prompt
        |
        v
Phase 0  Foundation
        |
        v
Phase 1  Core PDF MVP
        |
        v
Phase 2  Editor / Sign / Forms
        |
        v
Phase 3  Security / Redaction
        |
        v
Phase 4  Compression WASM
        |
        v
Phase 5  OCR / Scan
        |
        v
Phase 6  Convert -> PDF
        |
        v
Phase 7  PDF -> Other Formats
        |
        v
Phase 8  Compare / Repair
        |
        v
Phase 9  AI
        |
        v
Phase 10 P2P / Whiteboard
        |
        v
Phase 11 GST / POS
        |
        v
Phase 12 Workflow Builder
        |
        v
Phase 13 SDK (optional extension)
        |
        v
Phase 14 Launch / Parity Hardening
```

## Checkpoint prompt to use between phases

Use this after each coding phase before starting the next one:

```text
Do not implement the next phase yet.

Audit the phase you just completed as if you are reviewing a production pull request.

1. List every requirement from the phase prompt and mark it Complete, Partial, Missing, or Not Applicable.
2. Run TypeScript typecheck, lint, unit tests, integration tests, and relevant E2E tests.
3. Run a production build.
4. Identify any code that processes document data on the main thread unnecessarily.
5. Identify any network request that could contain file bytes, extracted document text, passwords, signatures, invoice/customer data, or other sensitive content.
6. Inspect memory cleanup for ArrayBuffers, canvases, object URLs, workers, WASM virtual filesystems, and IndexedDB temporary objects.
7. Check mobile and Safari compatibility concerns.
8. Check accessibility for all new controls.
9. Check whether marketing/privacy wording accurately matches actual behavior.
10. List known limitations and concrete follow-up fixes.
11. Fix all Severity 1 / blocking issues found by this audit.
12. Re-run affected tests.
13. Give me a final phase-completion report and stop. Do not begin the next phase.
```

---

# Final Product Acceptance Criteria

PaperZero should not be considered feature-parity complete until all of the following are true:

## Local-first core

- [ ] Standard PDF tools do not upload files.
- [ ] Heavy processing runs off the main UI thread.
- [ ] Core assets can be cached for offline use.
- [ ] Files can be downloaded reliably on Chrome, Firefox, Edge, Safari, iOS Safari, and Android Chrome within browser limitations.
- [ ] Large jobs are device-adaptive.
- [ ] Cancelling work releases resources.

## Editing

- [ ] Common text edits preserve position/appearance reasonably.
- [ ] Signatures support draw/type/image.
- [ ] Whiteout is clearly distinguished from true redaction.
- [ ] Forms can be filled and optionally flattened.
- [ ] Crop/resize/header/footer/invert work.
- [ ] Scanned editor pages can route through OCR.

## Security

- [ ] Encryption algorithm claims are accurate.
- [ ] Known-password removal works locally.
- [ ] No password cracking exists.
- [ ] Redaction verification proves text is not recoverable through normal extraction.
- [ ] Auto-PII is review-first.
- [ ] Privacy scanner has a documented coverage matrix.
- [ ] SHA-256 integrity fingerprint is available.

## Compression

- [ ] Light/Medium/Heavy produce real measurable differences.
- [ ] Target-size mode is bounded and honest.
- [ ] Already optimized PDFs are handled gracefully.
- [ ] Compression works offline after WASM cache.

## OCR and scan

- [ ] Scanned PDFs become searchable/selectable.
- [ ] OCR language packs are lazy-loaded/cached.
- [ ] Scan-to-PDF supports multi-page crop/deskew/enhancement.
- [ ] OCR/scan works without uploading images.

## Conversion

- [ ] Conversion formats have honest compatibility matrices.
- [ ] No Office macros execute.
- [ ] Archive parsing has zip-bomb/path-traversal defenses.
- [ ] PDF-to-Office distinguishes semantic vs visual-fidelity output where relevant.

## AI

- [ ] PDF binary stays local by default.
- [ ] Cloud AI text transfer is disclosed.
- [ ] User explicitly initiates/accepts external AI use.
- [ ] Relevant chunks are sent rather than whole long documents by default.
- [ ] Answers can link back to local source pages.
- [ ] Prompt-injection defenses treat document text as untrusted data.

## P2P

- [ ] File transfer uses WebRTC DataChannel.
- [ ] No file is persisted on signaling server.
- [ ] TURN relay use is labeled accurately.
- [ ] SHA-256 verifies received file.
- [ ] Whiteboard state sync works for supported small groups.

## Business

- [ ] GST calculations use decimal-safe arithmetic.
- [ ] GST/POS data remains local.
- [ ] POS works during internet outage after cache.
- [ ] GST filing prep does not claim to submit tax filings.

## Workflow builder

- [ ] One input can pass through multiple operations.
- [ ] Invalid operation order/type is caught before execution.
- [ ] Passwords are not serialized in saved workflows.
- [ ] Failed workflows can recover from last safe state where possible.

## Launch

- [ ] Original brand and copy.
- [ ] Dedicated route for every tool.
- [ ] Useful original guides.
- [ ] Privacy matrix by feature.
- [ ] Technical architecture page.
- [ ] PWA installable.
- [ ] Accessibility audit completed.
- [ ] Security audit completed.
- [ ] Browser support matrix published internally.
- [ ] License inventory completed.
- [ ] Production build and full regression suite green.

---

# Important Instruction When Using These Prompts

These prompts intentionally specify **what to build, how to validate it, and where the privacy/security boundaries are**. They do not require a coding agent to use the exact internal implementation of the reference product. When a researched implementation detail is unsuitable because of licensing, browser compatibility, library changes, or security concerns, the coding agent should select an equivalent approach and document the trade-off.

The quality bar is:

> **Functional parity, local-first privacy, excellent browser UX, and independently implemented PaperZero code — not a source-code or branding copy of ihatepdf.cv.**
