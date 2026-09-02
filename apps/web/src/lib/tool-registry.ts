export type ToolCategory =
  | "page-management"
  | "edit"
  | "convert-to-pdf"
  | "convert-from-pdf"
  | "security";

export type ToolStatus = "available" | "coming-soon";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ToolDefinition {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: ToolCategory;
  acceptedFileTypes?: string;
  outputTypes: string[];
  tags: string[];
  offlineCapable: boolean;
  remoteProcessingDisclosure: string | null;
  status: ToolStatus;
  plannedPhase?: string;
  howItWorks: string[];
  faq: FaqItem[];
  relatedToolIds: string[];
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  "page-management": "Page Management",
  edit: "Edit & Annotate",
  "convert-to-pdf": "Convert to PDF",
  "convert-from-pdf": "Convert from PDF",
  security: "Security & Privacy",
};

const t = (tool: ToolDefinition): ToolDefinition => tool;

export const TOOLS: ToolDefinition[] = [
  t({
    id: "merge-pdf",
    slug: "merge-pdf",
    name: "Merge PDF",
    shortDescription: "Combine multiple PDFs into one document, in any order.",
    longDescription:
      "Combine two or more PDF files into a single document. Reorder files before merging and download the combined result instantly - everything happens inside your browser.",
    category: "page-management",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["combine", "join", "append", "merge documents"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Select or drop two or more PDF files.",
      "Arrange them in the order you want using the arrows.",
      "Click Merge. Pages are copied losslessly into a new document.",
      "Download your merged PDF.",
    ],
    faq: [
      {
        question: "Are my files uploaded to a server?",
        answer:
          "No. Merging runs entirely in your browser with pdf-lib. Your files never leave your device.",
      },
      {
        question: "Will links, forms and annotations survive?",
        answer:
          "Page content is copied structurally. Most annotations and form fields are preserved where the underlying library supports them; heavily encrypted files must be unlocked first.",
      },
      {
        question: "Is there a file size limit?",
        answer:
          "There is no artificial limit. Very large jobs are constrained only by your device's memory, and we warn you before risky operations.",
      },
    ],
    relatedToolIds: ["split-pdf", "organize-pdf", "images-to-pdf"],
  }),
  t({
    id: "split-pdf",
    slug: "split-pdf",
    name: "Split PDF",
    shortDescription: "Extract pages or ranges into separate PDF files.",
    longDescription:
      "Split a PDF by extracting selected pages, page ranges, every single page, or fixed-size chunks like one file per 5 pages. Multiple outputs are packaged as a ZIP.",
    category: "page-management",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf", "zip"],
    tags: ["extract", "separate", "divide", "cut pages"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Select a PDF file.",
      "Pick a split mode: selected pages, ranges like 1-3,8-12, every page, or every N pages.",
      "Click Split. Each range becomes its own PDF without re-rendering.",
      "Download the result as individual PDFs or a ZIP archive.",
    ],
    faq: [
      {
        question: "Does splitting reduce quality?",
        answer:
          "No. Pages are copied as-is, including vectors, fonts and images. Nothing is rasterized.",
      },
      {
        question: "How do I extract non-consecutive pages?",
        answer:
          "Use range syntax like 1-3,5,8-10 in the ranges field, or click pages in the preview grid.",
      },
    ],
    relatedToolIds: ["merge-pdf", "organize-pdf", "pdf-to-jpg"],
  }),
  t({
    id: "organize-pdf",
    slug: "organize-pdf",
    name: "Organize Pages",
    shortDescription: "Reorder, rotate, duplicate or delete pages visually.",
    longDescription:
      "Visually reorganize a PDF: drag pages into a new order, rotate individual pages, duplicate what you need and delete what you don't. The document is rebuilt only when you export.",
    category: "page-management",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["reorder", "rearrange", "delete pages", "duplicate"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF and wait for page previews to load.",
      "Reorder with drag or arrow buttons; select pages to rotate, duplicate or delete in bulk.",
      "Undo/redo freely - nothing is rewritten until you apply.",
      "Apply changes and download the reorganized PDF.",
    ],
    faq: [
      {
        question: "Is editing destructive?",
        answer:
          "No. Your original file stays untouched on disk; edits are metadata until you export a new copy.",
      },
      {
        question: "Can I undo a mistake?",
        answer: "Yes. The grid keeps an undo and redo history for every change.",
      },
    ],
    relatedToolIds: ["rotate-pdf", "split-pdf", "merge-pdf"],
  }),
  t({
    id: "rotate-pdf",
    slug: "rotate-pdf",
    name: "Rotate PDF",
    shortDescription: "Turn pages 90°, 180° or 270° - individually or all at once.",
    longDescription:
      "Fix sideways scans or rotate specific pages of a PDF. Rotation is applied structurally so text stays selectable and sharp at any zoom level.",
    category: "page-management",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["turn", "sideways", "landscape", "orientation"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF and see live page thumbnails.",
      "Rotate everything, or select pages first and rotate just those.",
      "Preview updates instantly without rewriting the file.",
      "Export and download the rotated PDF.",
    ],
    faq: [
      {
        question: "Does rotating affect text quality?",
        answer:
          "No. Structural rotation only changes the /Rotate attribute, so text remains vector-sharp and searchable.",
      },
    ],
    relatedToolIds: ["organize-pdf", "merge-pdf"],
  }),
  t({
    id: "images-to-pdf",
    slug: "images-to-pdf",
    name: "Images to PDF",
    shortDescription: "Turn JPG, PNG and WebP photos into a single PDF.",
    longDescription:
      "Convert images to a PDF document. Reorder photos, choose page size (auto, A4 or Letter), margins, orientation and how each image fits its page. EXIF rotation is handled automatically.",
    category: "convert-to-pdf",
    acceptedFileTypes: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
    outputTypes: ["pdf"],
    tags: ["jpg to pdf", "png to pdf", "photo", "scan pictures"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Add JPG, PNG or WebP images and arrange their order.",
      "Choose page size, orientation, margin and fit (contain or cover).",
      "Images are embedded locally - no quality-killing uploads.",
      "Download the generated PDF.",
    ],
    faq: [
      {
        question: "Are photos compressed?",
        answer:
          "JPEG images are kept as JPEG; PNGs stay PNG. Photos are not recompressed through canvas unless EXIF rotation needs normalizing.",
      },
      {
        question: "What does Auto page size mean?",
        answer:
          "Each page takes the aspect ratio of its image, so nothing is cropped or letterboxed.",
      },
    ],
    relatedToolIds: ["merge-pdf", "pdf-to-jpg"],
  }),
  t({
    id: "pdf-to-jpg",
    slug: "pdf-to-jpg",
    name: "PDF to JPG / PNG",
    shortDescription: "Render PDF pages as high-quality JPG or PNG images.",
    longDescription:
      "Export PDF pages as images at 72-600 DPI with device-aware safety limits. Choose JPG or PNG, pick pages, and download individually or as a ZIP.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["jpg", "png", "zip"],
    tags: ["jpeg", "png", "image", "render", "screenshot"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Select a PDF.",
      "Choose format (JPG or PNG), DPI preset and optional page selection.",
      "Pages are rendered locally with PDF.js, batched to protect memory.",
      "Download images directly or as a ZIP.",
    ],
    faq: [
      {
        question: "Which DPI should I pick?",
        answer:
          "150 DPI is fine for screens, 300 DPI suits printing. Higher DPI means bigger images and more memory; we automatically cap unsafe values on constrained devices.",
      },
      {
        question: "Why was my DPI reduced?",
        answer:
          "Browsers limit total canvas size. If your request would exceed safe limits we lower it and tell you honestly rather than crashing.",
      },
    ],
    relatedToolIds: ["pdf-to-zip", "images-to-pdf", "split-pdf"],
  }),
  t({
    id: "pdf-to-zip",
    slug: "pdf-to-zip",
    name: "PDF to ZIP (page images)",
    shortDescription: "Export every page as an image bundled in a ZIP.",
    longDescription:
      "Convert each PDF page to a numbered JPG or PNG image and package them into a downloadable ZIP archive - handy for uploads that demand one image per page.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["zip"],
    tags: ["archive", "zip", "pages to images"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Select a PDF.",
      "Choose image format and DPI.",
      "Every selected page is rendered locally and named page-001.jpg and so on.",
      "Download the ZIP.",
    ],
    faq: [
      {
        question: "Is this different from PDF to JPG?",
        answer:
          "The rendering engine is shared; PDF to ZIP always packages multi-page output into one archive.",
      },
    ],
    relatedToolIds: ["pdf-to-jpg", "split-pdf"],
  }),
  t({
    id: "watermark-pdf",
    slug: "watermark-pdf",
    name: "Watermark PDF",
    shortDescription: "Stamp text or an image over selected pages with live preview.",
    longDescription:
      "Add a text or image watermark with full control over size, color, opacity, rotation and position. A live preview shows exact placement before you export.",
    category: "edit",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["stamp", "confidential", "draft", "logo"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF.",
      "Choose a text or image watermark and tune position, opacity, rotation and style.",
      "Check the live preview - it uses the same placement math as the final export.",
      "Apply to all or selected pages and download.",
    ],
    faq: [
      {
        question: "Can I use my company logo?",
        answer:
          "Yes. Switch to Image mode and add a PNG or JPG; scale and position it anywhere on the page.",
      },
      {
        question: "Does the watermark appear under or over content?",
        answer:
          "It is drawn over existing page content. Use low opacity if you need body text to remain readable.",
      },
    ],
    relatedToolIds: ["add-page-numbers", "remove-metadata"],
  }),
  t({
    id: "add-page-numbers",
    slug: "add-page-numbers",
    name: "Add Page Numbers",
    shortDescription: "Insert page numbers in headers or footers with custom formats.",
    longDescription:
      "Number pages exactly how you want: header or footer, left/center/right, starting number, prefix and suffix, formats like '1', 'Page 1' or '1 / 20', and skip-first-page support.",
    category: "edit",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["numbering", "footer", "header", "pagination"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF.",
      "Configure position, format, starting number and font size.",
      "Watch the live preview update as you type.",
      "Apply and download the numbered PDF.",
    ],
    faq: [
      {
        question: "Can numbering start on page 2?",
        answer:
          "Yes. Enable 'Skip first page' and set the starting number - useful when a cover page shouldn't be counted visibly.",
      },
    ],
    relatedToolIds: ["watermark-pdf", "merge-pdf"],
  }),
  t({
    id: "extract-text",
    slug: "extract-text",
    name: "Extract Text",
    shortDescription: "Pull text out of a PDF page by page; copy or download TXT/MD.",
    longDescription:
      "Extract the text layer of any PDF with page boundaries preserved. Review it on screen, copy to clipboard, or download as .txt or .md with page headings.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["txt", "md"],
    tags: ["copy text", "txt", "markdown", "scrape"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Select a PDF.",
      "Optionally limit extraction to specific pages.",
      "Text is read locally via PDF.js - line grouping approximates reading order.",
      "Copy to clipboard or download TXT/Markdown.",
    ],
    faq: [
      {
        question: "My PDF is scanned and returns no text?",
        answer:
          "Scanned pages are images without a text layer. OCR support (planned) will make those searchable.",
      },
      {
        question: "Is reading order perfect for two-column papers?",
        answer:
          "Not always. Extraction follows the internal text order with heuristics; complex layouts may need cleanup.",
      },
    ],
    relatedToolIds: ["pdf-to-jpg", "remove-metadata"],
  }),
  t({
    id: "remove-metadata",
    slug: "remove-metadata",
    name: "Remove Metadata",
    shortDescription: "Strip author, software and date properties from a PDF.",
    longDescription:
      "Remove common identifying document properties such as Author, Creator, Producer, Title, Subject, Keywords and timestamps - before you share a file.",
    category: "security",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["privacy", "clean", "author", "properties"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Select a PDF and review the metadata found locally.",
      "Confirm removal - fields are cleared and dates zeroed out.",
      "Download the cleaned copy. Your original stays untouched.",
    ],
    faq: [
      {
        question: "Does this remove every privacy trace?",
        answer:
          "This removes standard info-dictionary properties. Deeper cleaning (XMP packets, attachments, JavaScript) is planned for the Privacy Suite.",
      },
    ],
    relatedToolIds: ["watermark-pdf", "extract-text"],
  }),
  t({
    id: "pdf-fingerprint",
    slug: "pdf-fingerprint",
    name: "PDF Fingerprint (SHA-256)",
    shortDescription: "Compute a cryptographic SHA-256 hash of any local file.",
    longDescription:
      "Generate a SHA-256 fingerprint to verify that a document's bytes are identical across copies, or to prove integrity after transfer. Computed locally with the Web Crypto API.",
    category: "security",
    outputTypes: ["txt"],
    tags: ["hash", "checksum", "sha256", "verify", "integrity"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Drop any file (not just PDFs).",
      "Bytes are hashed inside a Web Worker using SHA-256.",
      "Compare against a known hash or save the checksum.",
    ],
    faq: [
      {
        question: "Is this the same as watermark fingerprinting?",
        answer:
          "No. This computes a byte-exact digest for integrity verification. Invisible per-recipient tracking marks are a separate planned feature.",
      },
    ],
    relatedToolIds: ["remove-metadata"],
  }),

  t({
    id: "edit-pdf",
    slug: "edit-pdf",
    name: "Edit PDF",
    shortDescription: "Click any text to rewrite it; add text boxes, images and whiteout.",
    longDescription:
      "A full visual PDF editor: click-to-edit existing text with automatic cover-and-redraw, add styled text boxes anywhere, whiteout visual mistakes, place images, drag to reposition everything, undo/redo freely - then export a validated PDF locally.",
    category: "edit",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["change text", "fix typo", "add textbox", "white out", "editor"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF and pick a tool from the editor toolbar.",
      "\u201cEdit text\u201d highlights every text run - click one to rewrite it in place.",
      "Add text boxes, whiteout areas or images; drag to move, panel to style.",
      "Export rebuilds your edits into a validated PDF - nothing was uploaded.",
    ],
    faq: [
      {
        question: "How does click-to-edit work?",
        answer:
          "We map each visible text run to its exact position, cover that region and draw your replacement on top using matching size and color. Complex embedded fonts fall back to Helvetica equivalents, which we note honestly.",
      },
      {
        question: "Is Whiteout secure like redaction?",
        answer:
          "No. Whiteout visually covers content. True redaction (permanently removing content) is planned for our Privacy Suite phase.",
      },
      {
        question: "Can I edit scanned pages?",
        answer:
          "Scanned pages have no selectable text yet. OCR-assisted editing is planned; you can still whiteout and add text over them today.",
      },
    ],
    relatedToolIds: ["watermark-pdf", "flatten-pdf", "crop-resize-pdf"],
  }),
  t({
    id: "sign-pdf",
    slug: "sign-pdf",
    name: "Sign PDF",
    shortDescription: "Draw, type or upload a signature and place it on any page.",
    longDescription:
      "Sign documents without printing: create a signature by drawing with mouse/finger, typing your name in a handwriting style, or uploading a photo (with optional background removal). Place it on any page, resize and export. Your signature never leaves this device and is never stored.",
    category: "edit",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["signature", "initials", "draw", "sign document"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open the document you need to sign.",
      "Create a signature: draw it, type your name, or upload an image.",
      "Click where the signature belongs; switch pages to sign again.",
      "Download the signed file instantly.",
    ],
    faq: [
      {
        question: "Is this a certified digital signature?",
        answer:
          "No. It places an image of your signature - perfect for everyday approvals. Cryptographic certificate signing is a different product category.",
      },
      {
        question: "Do you store my signature?",
        answer:
          "Never. It exists only in this browser tab's memory until you close or reset the page.",
      },
    ],
    relatedToolIds: ["edit-pdf", "fill-form-pdf"],
  }),
  t({
    id: "fill-form-pdf",
    slug: "fill-form-pdf",
    name: "Fill PDF Form",
    shortDescription: "Complete AcroForm fields and optionally flatten answers.",
    longDescription:
      "Fill interactive PDF forms entirely offline. Text fields, checkboxes, radio groups and dropdowns are detected automatically, listed for quick entry and highlighted on a live page preview. Save with editable fields preserved or flattened.",
    category: "edit",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["form", "acroform", "fillable", "tax form", "application"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a fillable PDF - fields are detected automatically.",
      "Type answers in the side list or click highlighted boxes on the preview.",
      "Choose to keep fields editable or flatten answers into the page.",
      "Save your completed form locally.",
    ],
    faq: [
      {
        question: "Which field types are supported?",
        answer:
          "Text fields, checkboxes, radio groups, dropdowns and option lists. XFA forms and digital signature fields are not supported and reported honestly when detected.",
      },
      {
        question: "What does flatten do?",
        answer:
          "It bakes your answers into the page appearance so the values cannot be changed by ordinary viewers.",
      },
    ],
    relatedToolIds: ["sign-pdf", "flatten-pdf"],
  }),
  t({
    id: "crop-resize-pdf",
    slug: "crop-resize-pdf",
    name: "Crop & Resize PDF",
    shortDescription: "Trim margins visually or convert pages between A4/Letter/Legal and more.",
    longDescription:
      "Crop pages by drawing the exact area to keep (single page or all pages), or resize whole documents to A3/A4/Letter/Legal/custom dimensions in mm/in/pt with center, fit or fill scaling. Cropping uses structural CropBoxes; resizing rebuilds pages as sharp vector layers.",
    category: "page-management",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["trim", "margins", "a4", "letter", "scale pages"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF and choose Crop or Resize.",
      "Crop: drag the keep-area on the live preview, apply to one or all pages.",
      "Resize: pick target preset or custom dimensions plus fit mode.",
      "Download the adjusted document.",
    ],
    faq: [
      {
        question: "Does cropping permanently delete hidden content?",
        answer:
          "No - cropping hides content via the CropBox. Sensitive content outside the box remains in the file; use redaction (coming soon) for permanent removal.",
      },
      {
        question: "Will resized text stay sharp?",
        answer:
          "Yes. Pages are embedded as vector drawings, not screenshots.",
      },
    ],
    relatedToolIds: ["organize-pdf", "rotate-pdf"],
  }),
  t({
    id: "headers-footers",
    slug: "headers-footers",
    name: "Headers & Footers",
    shortDescription: "Stamp custom headers/footers with {n}, {date} and {filename} variables.",
    longDescription:
      "Add professional headers and footers to any PDF: independent left/center/right zones per band, template variables for page numbers, totals, dates and the processed filename, adjustable font, size, color, edge distance and page ranges - with a live preview that matches the output exactly.",
    category: "edit",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["header", "footer", "date stamp", "file name", "bates"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF.",
      "Enable header/footer zones and type templates using variables like {n} or {date}.",
      "Tune font, color and distance from the page edge.",
      "Watch the live preview, then apply and download.",
    ],
    faq: [
      {
        question: "What variables can I use?",
        answer:
          "{n} = current page number, {total} = numbered total, {date} = today (your clock, never sent anywhere), {filename} = the processed file name.",
      },
      {
        question: "Different first page?",
        answer:
          "Enable \u2018Skip first page\u2019 to leave covers unnumbered while numbering continues correctly on page two.",
      },
    ],
    relatedToolIds: ["add-page-numbers", "watermark-pdf"],
  }),
  t({
    id: "flatten-pdf",
    slug: "flatten-pdf",
    name: "Flatten PDF",
    shortDescription: "Bake form answers into fixed page content.",
    longDescription:
      "Convert fillable form fields into static page appearances so completed forms can no longer be edited by ordinary viewers. Signature-field presence is detected and disclosed before processing.",
    category: "security",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["flatten form", "static", "non-editable", "lock answers"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a filled PDF form.",
      "Review what will be flattened (field count and signature warnings).",
      "Flatten and download - answers become part of the page.",
    ],
    faq: [
      {
        question: "Is flattening permanent?",
        answer:
          "Fields stop being editable in normal viewers, but no PDF is truly immutable - capable tools can still modify files.",
      },
      {
        question: "What about digital signatures?",
        answer:
          "If signature fields exist we warn first: modifying signed files invalidates their cryptographic signatures.",
      },
    ],
    relatedToolIds: ["fill-form-pdf", "remove-metadata"],
  }),
  t({
    id: "invert-colors",
    slug: "invert-colors",
    name: "Invert PDF Colors",
    shortDescription: "Invert, grayscale, sepia, high-contrast or dark reading modes.",
    longDescription:
      "Restyle any PDF for comfortable reading: full color inversion, grayscale, sepia, boosted high-contrast black & white, or a dark-reading mode for night-time. Pages render at your chosen DPI with honest disclosure that text becomes rasterized.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["dark mode", "night reading", "negative", "grayscale", "contrast"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF.",
      "Pick a mode: invert, grayscale, sepia, high contrast or dark reading.",
      "Choose render DPI (memory-safe caps applied automatically).",
      "Download the restyled document.",
    ],
    faq: [
      {
        question: "Why is text no longer selectable?",
        answer:
          "Color transforms require re-rendering pages as images. We say this up front rather than pretending otherwise - keep the original file for archival.",
      },
    ],
    relatedToolIds: ["compress-pdf", "extract-text"],
  }),
  t({
    id: "pdf-to-handwriting",
    slug: "pdf-to-handwriting",
    name: "PDF to Handwriting",
    shortDescription: "Restyle typed notes as handwriting on ruled, grid or blank paper.",
    longDescription:
      "Turn pasted or extracted text into natural-looking handwritten-style pages: choose paper styles (blank, ruled, grid, margin line), ink color, letter size and line spacing. Rendered locally with your device's handwriting fonts onto print-ready A4 pages.",
    category: "edit",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["handwriting", "notes", "study", "styled text"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Paste your text or extract it from an uploaded PDF.",
      "Pick paper style, writing style, ink color and spacing.",
      "Pages render locally at print resolution.",
      "Download the styled PDF.",
    ],
    faq: [
      {
        question: "Is this real handwriting?",
        answer:
          "No. It is your system's handwriting-style fonts rendered onto paper backgrounds. Please don't use it to misrepresent authorship.",
      },
    ],
    relatedToolIds: ["extract-text", "handwriting-to-pdf"],
  }),
  t({
    id: "handwriting-to-pdf",
    slug: "handwriting-to-pdf",
    name: "Handwriting to PDF",
    shortDescription: "Combine note photos and scans into one PDF with optional transcription.",
    longDescription:
      "Digitize handwritten notes: import photos or scanned PDFs, arrange them in order, and optionally append a typed transcription page. Automatic handwriting recognition arrives with our OCR engine - until then we label this workflow Beta honestly.",
    category: "edit",
    outputTypes: ["pdf"],
    acceptedFileTypes: "application/pdf,image/jpeg,image/png,image/webp",
    tags: ["notes", "scan", "digitize", "transcription"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Add scans (PDF) and/or photos of notes and arrange their order.",
      "Optionally write a typed transcription to append.",
      "Build one combined PDF locally.",
    ],
    faq: [
      {
        question: "Does it read my handwriting automatically?",
        answer:
          "Not yet. Handwriting OCR ships with our OCR engine later; today you can attach a manually typed transcription page.",
      },
    ],
    relatedToolIds: ["images-to-pdf", "merge-pdf", "pdf-to-handwriting"],
  }),

  t({
    id: "encrypt-pdf",
    slug: "encrypt-pdf",
    name: "Encrypt PDF",
    shortDescription: "Protect a PDF with AES-256 password encryption, on-device.",
    longDescription:
      "Add real password protection using AES-256 - the only cipher ISO 32000-2 still recommends. Set an open password, optionally separate owner permissions for printing and copying. Everything happens in this browser; the password is never sent or stored.",
    category: "security",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["password", "protect", "lock", "aes-256", "secure"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF.",
      "Choose a strong password and confirm it.",
      "Optionally adjust reader permissions like printing or copying.",
      "Download the encrypted file - the password cannot be recovered later.",
    ],
    faq: [
      {
        question: "How strong is this encryption?",
        answer:
          "AES-256 with revision 6 security handler, exactly what the PDF standard recommends. There is no backdoor and no recovery if you lose the password.",
      },
      {
        question: "What do permissions control?",
        answer:
          "Whether viewers allow printing, copying text, editing or commenting. Note that permission flags are advisory - a determined user with tools can bypass them; the open password is the real protection.",
      },
    ],
    relatedToolIds: ["remove-password", "privacy-scanner", "sanitize-pdf"],
  }),
  t({
    id: "remove-password",
    slug: "remove-password",
    name: "Remove Password",
    shortDescription: "Decrypt a PDF you know the password to, entirely on-device.",
    longDescription:
      "Remove password protection from a PDF by decrypting it locally with the password you already know. The document is rebuilt as an unencrypted copy without ever sending your password anywhere. PaperZero does not crack unknown passwords.",
    category: "security",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["decrypt", "unlock", "password", "no password"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open the protected PDF.",
      "Enter the password you use to open it.",
      "The file is decrypted on this device and rebuilt without protection.",
      "Download the unrestricted copy.",
    ],
    faq: [
      {
        question: "Can you remove a password I don't know?",
        answer:
          "No - that would be cracking, which PaperZero will never do. You must supply the legitimate password.",
      },
      {
        question: "Where does my password go?",
        answer:
          "Nowhere. It exists only in this browser tab's memory for the decryption step and is cleared afterwards.",
      },
    ],
    relatedToolIds: ["encrypt-pdf", "unlock-pdf"],
  }),
  t({
    id: "unlock-pdf",
    slug: "unlock-pdf",
    name: "Unlock PDF Permissions",
    shortDescription: "Strip print/copy/edit restrictions from documents you may modify.",
    longDescription:
      "Rebuild a permission-restricted PDF without its security handler so printing, copying and annotation work again. Intended strictly for documents you are authorized to modify. Files that require an opening password ask for it first - no cracking.",
    category: "security",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["restrictions", "owner password", "enable printing", "enable copying"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open the restricted document.",
      "If it needs an opening password, provide it.",
      "The file is rebuilt locally without permission flags.",
      "Download the unrestricted copy.",
    ],
    faq: [
      {
        question: "Is bypassing restrictions legal?",
        answer:
          "Rules vary by jurisdiction. Only use this on documents you own or are authorized to modify - e.g. re-enabling printing on files you created yourself.",
      },
    ],
    relatedToolIds: ["remove-password", "flatten-pdf"],
  }),
  t({
    id: "redact-pdf",
    slug: "redact-pdf",
    name: "Redact PDF",
    shortDescription: "Permanently remove sensitive content - not just cover it.",
    longDescription:
      "True redaction: mark areas visually or search for terms across all pages, then affected pages are rebuilt from rendered images with black vector overlays - the underlying text is gone, not hidden. Every export is verified against extractable text so you know the redaction held.",
    category: "security",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["black out", "censor", "hide text", "confidential", "permanent"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF and drag boxes over sensitive areas, or search terms to mark every match.",
      "Review marked regions per page.",
      "Export rebuilds affected pages with content permanently removed.",
      "Automatic verification confirms the removed text can no longer be extracted.",
    ],
    faq: [
      {
        question: "Why is this different from whiteout or a black rectangle?",
        answer:
          "Covering leaves the text intact underneath where anyone with tools can copy it. Redaction rebuilds the page itself so the data physically no longer exists.",
      },
      {
        question: "Why does redacted page text become non-selectable?",
        answer:
          "Secure removal requires replacing the page with its rendered image. This is the honest trade-off; we verify removal rather than pretend otherwise.",
      },
    ],
    relatedToolIds: ["auto-redact-pii", "whiteout note in edit-pdf", "privacy-scanner"],
  }),
  t({
    id: "auto-redact-pii",
    slug: "auto-redact-pii",
    name: "Auto-Redact PII",
    shortDescription: "Detect emails, cards, PAN, Aadhaar-style IDs & more - review before redacting.",
    longDescription:
      "Local PII detection finds email addresses, phone numbers, credit-card numbers (Luhn-validated), Indian PAN numbers, Aadhaar-style IDs (Verhoeff-validated), IP addresses and custom regexes. Every finding is a suggestion: review, deselect, then redact permanently with verification.",
    category: "security",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["PII", "personal data", "GDPR", "auto redact", "sensitive info"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF - detection runs locally over every page.",
      "Review findings grouped by type with validation status.",
      "Select what should be removed (URLs and IPs default off).",
      "Redact permanently with automatic verification.",
    ],
    faq: [
      {
        question: "Does detection send my text anywhere?",
        answer:
          "No. All scanning happens in this browser tab using local pattern matching and checksum validators.",
      },
      {
        question: "Can it miss things?",
        answer:
          "Yes - detection covers common patterns only. Review carefully; scanned pages need OCR (planned) since they have no text layer.",
      },
    ],
    relatedToolIds: ["redact-pdf", "privacy-scanner"],
  }),
  t({
    id: "privacy-scanner",
    slug: "privacy-scanner",
    name: "Privacy Risk Scanner",
    shortDescription: "Score your PDF's privacy risks and clean them in one click.",
    longDescription:
      "A local risk report for any PDF: author identity, software traces, timestamps, XMP packets, embedded JavaScript, attachments, comments, form values, external links and even GPS coordinates inside embedded photos (best-effort EXIF scan). Get a 0-100 score, then remove removable risks instantly.",
    category: "security",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["metadata check", "risk report", "hidden data", "clean", "score"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF - analysis runs locally.",
      "Read the score and severity-ranked findings.",
      "Click once to remove everything removable.",
      "See the improved re-scan score of the cleaned file.",
    ],
    faq: [
      {
        question: "What lowers the score most?",
        answer:
          "Embedded JavaScript, attachments, GPS traces in photos, author names and XMP packets carry the highest weights.",
      },
      {
        question: "Does it catch everything?",
        answer:
          "It covers common categories honestly labeled above. Exotic hidden structures may exist; we avoid overclaiming.",
      },
    ],
    relatedToolIds: ["sanitize-pdf", "remove-metadata"],
  }),
  t({
    id: "sanitize-pdf",
    slug: "sanitize-pdf",
    name: "Sanitize PDF",
    shortDescription: "Strip properties, XMP, JavaScript, attachments and comments in one pass.",
    longDescription:
      "A precise cleaning pass where you choose exactly what to remove: document properties, XMP metadata, JavaScript actions, embedded attachments, comment annotations and/or flatten form answers. Shown up front, processed locally, verified afterwards.",
    category: "security",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["clean", "strip metadata", "safe to share", "remove js"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF.",
      "Tick exactly what should be removed - shown before processing.",
      "Sanitize and download the cleaned file.",
    ],
    faq: [
      {
        question: "Difference vs Privacy Scanner?",
        answer:
          "The scanner diagnoses and scores; Sanitize is the surgical cleaning step with explicit toggles. They work great together.",
      },
    ],
    relatedToolIds: ["privacy-scanner", "encrypt-pdf"],
  }),

  t({
    id: "compress-pdf",
    slug: "compress-pdf",
    name: "Compress PDF",
    shortDescription: "Shrink PDF file size while keeping documents readable.",
    longDescription: "Reduce PDF size with Light, Medium and Heavy presets plus target-size workflows.",
    category: "page-management",
    outputTypes: ["pdf"],
    tags: ["reduce size", "smaller", "optimize"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "coming-soon",
    plannedPhase: "Phase 4",
    howItWorks: [],
    faq: [],
    relatedToolIds: [],
  }),
  t({
    id: "ocr-pdf",
    slug: "ocr-pdf",
    name: "OCR PDF",
    shortDescription: "Make scanned PDFs searchable with an invisible text layer.",
    longDescription: "Run on-device OCR (Tesseract WASM) to add searchable text to scanned pages.",
    category: "convert-from-pdf",
    outputTypes: ["pdf", "txt"],
    tags: ["searchable", "scan", "recognize text"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "coming-soon",
    plannedPhase: "Phase 5",
    howItWorks: [],
    faq: [],
    relatedToolIds: [],
  }),
];

export function getTool(slug: string): ToolDefinition {
  const tool = TOOLS.find((tool_) => tool_.slug === slug);
  if (!tool) throw new Error(`Unknown tool slug: ${slug}`);
  return tool;
}

export function getAvailableTools(): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.status === "available");
}

export function toolsByCategory(category: ToolCategory): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.category === category);
}

export function getRelatedTools(tool: ToolDefinition): Array<{
  name: string;
  slug: string;
  shortDescription: string;
}> {
  return tool.relatedToolIds
    .map((id) => TOOLS.find((tool_) => tool_.id === id))
    .filter((related): related is ToolDefinition => Boolean(related && related.status === "available"))
    .map((related) => ({ name: related.name, slug: related.slug, shortDescription: related.shortDescription }));
}

export function searchTools(query: string): ToolDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return TOOLS;
  return TOOLS.filter((tool) => {
    const haystack = [
      tool.name,
      tool.shortDescription,
      ...tool.tags,
      CATEGORY_LABELS[tool.category],
    ]
      .join(" ")
      .toLowerCase();
    return q.split(/\s+/).every((word) => haystack.includes(word));
  });
}
