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
    shortDescription: "Recover paragraphs and reading order; export TXT, Markdown, or positioned JSON.",
    longDescription:
      "Extract positioned PDF text into paragraphs, headings, lists, and detected tables. Choose visual or two-column reading order, remove repeated headers and footers, run optional local OCR on scanned pages, and download TXT, Markdown, or JSON with bounding boxes and font metadata.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["txt", "md", "json"],
    tags: ["copy text", "txt", "markdown", "json", "bounding boxes", "reading order"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Select a PDF.",
      "Optionally limit extraction to specific pages.",
      "Choose visual or column-aware reading order and whether repeated margins should be removed.",
      "PDF.js geometry is grouped into lines and semantic blocks; text-free pages can use local OCR.",
      "Review the reconstructed text, then copy it or download TXT, Markdown, or positioned JSON.",
    ],
    faq: [
      {
        question: "My PDF is scanned and returns no text?",
        answer:
          "Enable local OCR in this tool to include scanned pages in the export. Use OCR PDF when you also need a searchable PDF copy.",
      },
      {
        question: "Is reading order perfect for two-column papers?",
        answer:
          "No heuristic is perfect, but column-aware mode reads the left column before the right and treats centered or wide headings as dividers. Preview the result before export.",
      },
      { question: "What is included in JSON?", answer: "JSON includes page dimensions, semantic blocks, table candidates, links, and every text item with its bounding box, font, size, rotation, style, and direction." },
    ],
    relatedToolIds: ["pdf-to-word", "pdf-to-html", "ocr-pdf"],
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
          "Yes, with the OCR-assisted editing action. Recognized words become selectable regions, and edits use a disclosed whiteout-plus-text overlay rather than reconstructing hidden source content.",
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
      "Digitize handwritten notes: import photos or scanned PDFs, arrange them, optionally append your own typed transcription, or run Beta local handwriting recognition to add searchable text while retaining every original page.",
    category: "edit",
    outputTypes: ["pdf", "txt"],
    acceptedFileTypes: "application/pdf,image/jpeg,image/png,image/webp",
    tags: ["notes", "scan", "digitize", "transcription"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Add scans (PDF) and/or photos of notes and arrange their order.",
      "Optionally write a typed transcription to append.",
      "Optionally run Beta handwriting OCR and review confidence warnings.",
      "Build one combined PDF locally, preserving the original handwritten pages.",
    ],
    faq: [
      {
        question: "Does it read my handwriting automatically?",
        answer:
          "Optionally. Tesseract is optimized for printed text, so handwriting mode is Beta, reports low confidence, preserves the original scan, and also exports recognized text for manual correction.",
      },
    ],
    relatedToolIds: ["scan-to-pdf", "ocr-pdf", "pdf-to-handwriting"],
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
      "Remove password protection from a PDF by decrypting it locally with the password you already know. The document is rebuilt as an unencrypted copy without ever sending your password anywhere. NGPDFs does not crack unknown passwords.",
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
          "No - that would be cracking, which NGPDFs will never do. You must supply the legitimate password.",
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
          "Yes - detection covers common patterns only. Review carefully; run OCR PDF on scanned pages first because image-only pages have no text layer to inspect.",
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
    shortDescription: "Shrink PDF files locally with honest quality and target-size controls.",
    longDescription:
      "Compress PDFs in a dedicated browser worker with Ghostscript WebAssembly. Choose Light, Medium or Heavy image optimization, or make a bounded best-effort attempt at a target size. Vector text stays vector where Ghostscript supports it, outputs are parsed and sample-rendered, and larger results are never presented as an improvement.",
    category: "page-management",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["reduce size", "smaller", "optimize", "email", "ghostscript"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF and review the local preflight estimate.",
      "Choose a quality preset or a best-effort target size.",
      "Ghostscript compresses the document inside a dedicated WebAssembly worker.",
      "NGPDFs validates page count and renders a sample before offering the smaller result.",
    ],
    faq: [
      {
        question: "Can every PDF become much smaller?",
        answer:
          "No. Text-only and already-optimized PDFs may have little to save. If the result is larger, NGPDFs reports that honestly and does not offer it as a replacement.",
      },
      {
        question: "Are target sizes guaranteed?",
        answer:
          "No. Target mode makes at most four progressively stronger attempts (two on constrained devices), then returns the smallest validated result and states whether the target was reached.",
      },
      {
        question: "Does compression rasterize my text?",
        answer:
          "The Ghostscript pdfwrite pipeline preserves vector text where supported while downsampling and recompressing images. Some unusual PDF features may be rewritten or unsupported, so review important output before sharing.",
      },
    ],
    relatedToolIds: ["split-pdf", "remove-metadata", "compress-pdf-to-200kb"],
  }),
  t({
    id: "compress-pdf-to-100kb",
    slug: "compress-pdf-to-100kb",
    name: "Compress PDF to 100 KB",
    shortDescription: "Make a bounded best-effort attempt to reduce a PDF to about 100 KB.",
    longDescription:
      "Try to compress a PDF below 100 KB locally for strict upload portals. The shared Ghostscript engine performs at most four validated passes and clearly reports when 100 KB is unrealistic rather than silently destroying readability.",
    category: "page-management",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["100kb", "target size", "job portal", "government upload"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF and review its likely compressibility.",
      "The target starts at 100 KB and can be adjusted.",
      "A bounded sequence of increasingly aggressive image settings runs locally.",
      "Download the smallest validated result and check whether the target was reached.",
    ],
    faq: [{ question: "Why might 100 KB be impossible?", answer: "Every PDF needs structural overhead, fonts and page content. Long or image-heavy documents may become unreadable before reaching 100 KB, so NGPDFs stops after a bounded retry budget." }],
    relatedToolIds: ["compress-pdf", "compress-pdf-to-200kb", "split-pdf"],
  }),
  t({
    id: "compress-pdf-to-200kb",
    slug: "compress-pdf-to-200kb",
    name: "Compress PDF to 200 KB",
    shortDescription: "Try to reduce a PDF to about 200 KB without uploading it.",
    longDescription:
      "Use the same local Ghostscript compressor with a 200 KB starting target for forms, email attachments and application portals. Attempts are bounded, page count is validated, and success is measured from the actual output—not promised in advance.",
    category: "page-management",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["200kb", "target size", "email", "application form"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF and inspect its local preflight report.",
      "Keep or adjust the 200 KB target.",
      "NGPDFs runs a bounded set of local compression passes.",
      "Review the achieved size and download only a smaller validated result.",
    ],
    faq: [{ question: "Will it keep trying until it reaches 200 KB?", answer: "No. It stops after at most four attempts, or two on constrained devices, to protect battery, memory and legibility." }],
    relatedToolIds: ["compress-pdf", "compress-pdf-to-100kb", "compress-pdf-to-2mb"],
  }),
  t({
    id: "compress-pdf-to-2mb",
    slug: "compress-pdf-to-2mb",
    name: "Compress PDF to 2 MB",
    shortDescription: "Optimize a PDF toward a practical 2 MB email or portal limit.",
    longDescription:
      "Compress a PDF toward 2 MB entirely in your browser. This workflow preserves more quality when the source-to-target ratio allows it, escalates settings only when necessary, and reports honestly if the target remains out of reach.",
    category: "page-management",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf"],
    tags: ["2mb", "target size", "email attachment", "upload limit"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF and review its size and content estimate.",
      "The shared compressor starts with a 2 MB target.",
      "Quality is reduced only through a bounded progression when needed.",
      "Validate the achieved result before submitting it to a portal.",
    ],
    faq: [{ question: "Is 2 MB guaranteed?", answer: "No. The achievable size depends on page count, images and fonts. NGPDFs returns the best validated result within its retry limit." }],
    relatedToolIds: ["compress-pdf", "compress-pdf-to-200kb", "split-pdf"],
  }),
  t({
    id: "markdown-to-pdf",
    slug: "markdown-to-pdf",
    name: "Markdown to PDF",
    shortDescription: "Turn Markdown into a themed, paginated PDF without uploading it.",
    longDescription:
      "Paste or import Markdown and export a locally paginated PDF with headings, emphasis, lists, code blocks, quotes, tables, links, data images, and explicit page breaks. Choose a clean, academic, technical, or minimal theme while reviewing the safe structural preview.",
    category: "convert-to-pdf",
    acceptedFileTypes: "text/markdown,text/plain,.md,.markdown,.txt",
    outputTypes: ["pdf"],
    tags: ["md", "commonmark", "gfm", "code", "document"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Paste Markdown or import an MD/TXT file using UTF-8 or the disclosed fallback decoder.",
      "Review the safe structural preview and compatibility report.",
      "Choose page size, orientation, margins, typography, and theme.",
      "The shared worker paginator builds and validates the PDF locally.",
    ],
    faq: [
      { question: "Does Markdown HTML execute?", answer: "No. Markdown is tokenized directly, not injected into the page. Raw HTML is omitted except for an explicit page-break marker." },
      { question: "Are external images downloaded?", answer: "No. Initial support embeds PNG/JPEG data images only; remote image URLs are represented or omitted with a compatibility warning." },
      { question: "Will code and tables span pages?", answer: "Yes, within the shared paginator's browser-safe layout rules. Very wide tables may be scaled or sectioned rather than made unreadably small." },
    ],
    relatedToolIds: ["html-to-pdf", "create-pdf", "csv-to-pdf"],
  }),
  t({
    id: "word-to-pdf",
    slug: "word-to-pdf",
    name: "Word to PDF",
    shortDescription: "Convert DOCX documents locally with an honest compatibility report.",
    longDescription:
      "Parse DOCX Open XML directly in the browser and preserve core document structure—paragraphs, headings, emphasis, lists, tables, inline PNG/JPEG images, page breaks, and hyperlink appearance—without executing macros or uploading the file. Word-specific fidelity gaps are reported before and after conversion.",
    category: "convert-to-pdf",
    acceptedFileTypes: "application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx",
    outputTypes: ["pdf"],
    tags: ["docx", "microsoft word", "office", "document conversion"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Choose a DOCX document; legacy DOC is intentionally not advertised.",
      "The worker unpacks OOXML relationships, styles, numbering, tables, media, headers, and footers locally.",
      "Review preserved, approximated, and unsupported Word constructs.",
      "Export through the shared paginator and validate the generated PDF.",
    ],
    faq: [
      { question: "Will it look exactly like Microsoft Word?", answer: "No. Exact Word pagination, floating objects, equations, SmartArt, advanced fields, and missing proprietary fonts cannot be reproduced reliably by this browser renderer; the compatibility report states detected gaps." },
      { question: "Do you support old .doc files?", answer: "Not in this phase. DOCX is supported first because its Open XML package can be parsed safely and locally. The route rejects rather than pretending to support legacy DOC." },
      { question: "Are macros or tracked changes executed?", answer: "No macros or scripts execute. Inserted text is read as document content; tracked deletions and comments are omitted and disclosed when detected." },
    ],
    relatedToolIds: ["create-pdf", "markdown-to-pdf", "ebook-to-pdf"],
  }),
  t({
    id: "excel-to-pdf",
    slug: "excel-to-pdf",
    name: "Excel to PDF",
    shortDescription: "Convert selected XLSX/XLSM worksheets into bounded PDF tables.",
    longDescription:
      "Inspect and select worksheets locally, then convert displayed cell values, cached formula results, basic number/date formats, emphasis, colors, fills, and alignment into readable PDF tables. Wide sheets are divided into labeled column sections instead of shrinking text to illegibility, and workbook macros never execute.",
    category: "convert-to-pdf",
    acceptedFileTypes: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,.xlsx,.xlsm",
    outputTypes: ["pdf"],
    tags: ["xlsx", "xlsm", "spreadsheet", "worksheet", "table"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Choose an XLSX or XLSM workbook; legacy XLS is intentionally not advertised.",
      "Select one or more worksheet names found inside the local package.",
      "The worker reads displayed/cached values and supported styles without calculating formulas or running VBA.",
      "Wide tables paginate into readable column sections and the PDF is validated before download.",
    ],
    faq: [
      { question: "Are formulas recalculated?", answer: "No. NGPDFs never runs workbook logic. It uses the cached displayed value stored by the spreadsheet application; cells without one are labeled with their formula text." },
      { question: "What happens to XLSM macros?", answer: "VBA is detected, ignored, and never executed. Only displayed values and supported styles are converted." },
      { question: "Do charts and worksheet images render?", answer: "Not in this table-first adapter. They are detected and disclosed in the compatibility report rather than silently represented inaccurately." },
    ],
    relatedToolIds: ["csv-to-pdf", "word-to-pdf", "create-pdf"],
  }),
  t({
    id: "powerpoint-to-pdf",
    slug: "powerpoint-to-pdf",
    name: "PowerPoint to PDF",
    shortDescription: "Render PPTX slides into a local PDF while retaining slide dimensions.",
    longDescription:
      "Convert PPTX presentations entirely in the browser with one PDF page per slide. NGPDFs preserves source slide dimensions, order, backgrounds, positioned text, basic shapes, connectors, PNG/JPEG images, theme colors, and z-order while clearly reporting font, gradient, group-transform, animation, chart, and SmartArt limitations.",
    category: "convert-to-pdf",
    acceptedFileTypes: "application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx",
    outputTypes: ["pdf"],
    tags: ["pptx", "presentation", "slides", "microsoft powerpoint", "deck"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Choose a PPTX presentation; legacy PPT and macro-enabled files are intentionally not advertised.",
      "The worker reads slide order, dimensions, theme colors, drawing positions, text, shapes, connectors, and local media without running active content.",
      "Each source slide becomes one PDF page at the original slide size.",
      "Detected fidelity gaps are disclosed and the page count is validated before download.",
    ],
    faq: [
      { question: "Will animations and transitions appear?", answer: "No. PDF pages are static, so animations and transitions are intentionally omitted and disclosed." },
      { question: "Does it exactly match PowerPoint?", answer: "Not always. Proprietary fonts use deterministic fallbacks, gradients and grouped transforms are approximated, and charts, SmartArt, speaker notes, and embedded objects are not rendered in this first local adapter." },
      { question: "Can presentation code run?", answer: "No. Only PPTX Open XML content and supported local image media are read; scripts and macros are never executed." },
    ],
    relatedToolIds: ["word-to-pdf", "images-to-pdf", "create-pdf"],
  }),
  t({
    id: "html-to-pdf",
    slug: "html-to-pdf",
    name: "HTML to PDF",
    shortDescription: "Convert safe local HTML structure into PDF without executing scripts.",
    longDescription:
      "Paste HTML or import an HTML file. NGPDFs parses it as inert structure, strips scripts, frames, forms, event handlers, and other active content, blocks external resources, and converts supported typography, lists, tables, links, page breaks, and embedded data images into a paginated PDF.",
    category: "convert-to-pdf",
    acceptedFileTypes: "text/html,.html,.htm",
    outputTypes: ["pdf"],
    tags: ["webpage", "html file", "safe html", "css", "print"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Paste HTML or open a local HTML file.",
      "The inert parser removes active content and refuses network resource loading.",
      "Review the safe preview plus preserved, approximated, and omitted features.",
      "Export through the shared local pagination worker.",
    ],
    faq: [
      { question: "Can uploaded JavaScript run?", answer: "No. Source HTML is parsed as data and script-capable elements are discarded without execution." },
      { question: "Does it reproduce every CSS layout?", answer: "No. This first local renderer supports document structure and a safe inline typography/page-break subset, not browser screenshots, flex/grid, or pixel-perfect print CSS." },
      { question: "Will it fetch web fonts or remote images?", answer: "No. Network resources are blocked by design. Embedded PNG/JPEG data images are supported." },
    ],
    relatedToolIds: ["markdown-to-pdf", "create-pdf", "images-to-pdf"],
  }),
  t({
    id: "csv-to-pdf",
    slug: "csv-to-pdf",
    name: "CSV to PDF",
    shortDescription: "Paginate delimited data into readable local PDF tables.",
    longDescription:
      "Import or paste CSV/TSV data with delimiter detection, a manual delimiter override, quoted-field parsing, UTF-8 and Windows-1252 decoding, repeating headers, row striping, landscape output, and bounded horizontal pagination for wide tables.",
    category: "convert-to-pdf",
    acceptedFileTypes: "text/csv,text/plain,.csv,.tsv",
    outputTypes: ["pdf"],
    tags: ["spreadsheet", "table", "tsv", "delimiter", "print data"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Paste delimited data or import CSV/TSV up to the local safety limit.",
      "Confirm the detected delimiter, header row, striping, and maximum rows.",
      "Review the first bounded section and choose portrait or landscape layout.",
      "Wide columns are split into labeled sections and exported locally.",
    ],
    faq: [
      { question: "How are very wide tables handled?", answer: "NGPDFs paginates at most ten columns per horizontal section instead of shrinking text below a readable threshold." },
      { question: "Can it process hundreds of thousands of rows?", answer: "No. Export is explicitly capped at 10,000 rows and 40 columns to prevent a browser tab from freezing; the chosen lower limit is shown before conversion." },
      { question: "Does it handle commas inside values?", answer: "Yes. The bounded parser handles quoted delimiters, escaped quotes, and quoted line breaks." },
    ],
    relatedToolIds: ["markdown-to-pdf", "html-to-pdf", "create-pdf"],
  }),
  t({
    id: "create-pdf",
    slug: "create-pdf",
    name: "Create PDF",
    shortDescription: "Compose a rich-text document and export it locally as PDF.",
    longDescription:
      "Write a document with headings, paragraphs, bold, italic, underline, lists, links, alignment, PNG/JPEG images, tables, rules, and page breaks. The draft is stored only in this browser and the same safe structural paginator used by HTML and Markdown produces the PDF.",
    category: "convert-to-pdf",
    outputTypes: ["pdf"],
    tags: ["writer", "rich text", "document editor", "compose", "new pdf"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Compose and format content in the local rich-text editor.",
      "Insert links, data-backed local images, tables, rules, and page breaks.",
      "Review the structural preview and choose print settings.",
      "Export a validated PDF; clear the browser-only draft whenever you want.",
    ],
    faq: [
      { question: "Where is my draft stored?", answer: "Only in this browser's localStorage. If storage is unavailable, editing and export still work for the current tab." },
      { question: "Can I add images?", answer: "Yes. PNG and JPEG files up to 8 MB are embedded as local data and never uploaded." },
      { question: "Does this use an online editor?", answer: "No. Composition, safe HTML parsing, pagination, and PDF generation are browser-local." },
    ],
    relatedToolIds: ["markdown-to-pdf", "html-to-pdf", "images-to-pdf"],
  }),
  t({
    id: "ebook-to-pdf",
    slug: "ebook-to-pdf",
    name: "eBook to PDF",
    shortDescription: "Convert EPUB, TXT, or HTML ebooks into a paginated local PDF.",
    longDescription:
      "Open EPUB, plain-text, or HTML ebooks locally. EPUB packages are read in OPF spine order, chapter resources are sanitized without script execution, supported local PNG/JPEG images are embedded, and chapters are joined with page breaks through the shared PDF paginator.",
    category: "convert-to-pdf",
    acceptedFileTypes: "application/epub+zip,text/plain,text/html,.epub,.txt,.html,.htm",
    outputTypes: ["pdf"],
    tags: ["epub", "book", "novel", "txt ebook", "reader"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Choose an EPUB, TXT, HTML, or HTM ebook up to the browser safety limit.",
      "EPUB metadata, manifest, spine, chapters, and supported local images are parsed in the PDF worker.",
      "Active content and network resources are removed; compatibility gaps are reported.",
      "Choose book typography and download the locally generated PDF.",
    ],
    faq: [
      { question: "Do you support MOBI or AZW3?", answer: "No. NGPDFs advertises only formats it can parse locally with a reviewed implementation: EPUB, TXT, and HTML in this phase." },
      { question: "Can EPUB scripts or remote trackers run?", answer: "No. Chapters are parsed as inert document structure. Scripts, frames, interactive media, and remote resources are omitted." },
      { question: "What about DRM-protected books?", answer: "DRM is not bypassed. Only unencrypted EPUB packages you are authorized to convert are supported." },
    ],
    relatedToolIds: ["markdown-to-pdf", "html-to-pdf", "create-pdf"],
  }),
  t({
    id: "audio-to-pdf",
    slug: "audio-to-pdf",
    name: "Audio Transcript to PDF",
    shortDescription: "Review audio locally and turn its editable transcript into PDF.",
    longDescription:
      "Open a browser-decodable audio recording without uploading it, listen in the local player, paste or type a reviewed transcript, insert timestamps from the real playback position, and export a paginated PDF. Automatic speech recognition is deliberately not bundled in this build and no cloud speech service is contacted.",
    category: "convert-to-pdf",
    acceptedFileTypes: "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.webm,.flac",
    outputTypes: ["pdf"],
    tags: ["audio", "transcript", "mp3", "wav", "m4a", "timestamps"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Choose an MP3, WAV, M4A, or other browser-decodable recording; it stays in the current tab.",
      "Listen with the local media player and paste or type a transcript you have reviewed.",
      "Optionally insert the current playback time as a real transcript timestamp and add title/date fields.",
      "The shared worker paginator creates and validates the transcript PDF without embedding or uploading the audio.",
    ],
    faq: [
      { question: "Does NGPDFs automatically transcribe my audio?", answer: "Not in this build. A suitable on-device Whisper package would add roughly 100 MB and substantial device requirements, so this route provides the phase's conservative editable fallback and says so before file selection." },
      { question: "Is my audio sent to a speech API?", answer: "No. The recording is played from a temporary browser object URL. No browser or cloud speech-recognition service is called." },
      { question: "Are speakers identified automatically?", answer: "No. Speaker labels are not claimed because diarization is not implemented. You can type labels into the reviewed transcript yourself." },
    ],
    relatedToolIds: ["create-pdf", "markdown-to-pdf", "ebook-to-pdf"],
  }),
  t({
    id: "pdf-to-word",
    slug: "pdf-to-word",
    name: "PDF to Word",
    shortDescription: "Reconstruct PDF text as a flowing, editable Word document.",
    longDescription:
      "Turn positioned PDF text into a local DOCX with editable headings, paragraphs, lists, and confidently detected tables. Column-aware reading order, repeated-margin cleanup, page selection, and optional on-device OCR help produce a practical flowing document while clearly reporting fidelity limits.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["docx"],
    tags: ["word", "docx", "editable document", "pdf text", "ocr"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open one PDF and optionally choose pages and column-aware reading order.",
      "PDF.js geometry is grouped into headings, paragraphs, lists, and high-confidence tables; scanned pages can use local OCR.",
      "Choose whether each source page starts on a new Word page and review the compatibility report.",
      "A validated DOCX Open XML package is built locally for download.",
    ],
    faq: [
      { question: "Will the Word file look exactly like the PDF?", answer: "No. This first mode prioritizes editable, flowing content. Precise coordinates, decorative vectors, embedded fonts, and complex image placement are omitted or approximated and disclosed before export." },
      { question: "Are tables editable?", answer: "High-confidence detected tables become native Word tables. Uncertain candidates remain prose so an incorrect grid is not silently invented." },
      { question: "Can it convert a scanned PDF?", answer: "Yes. Enable integrated OCR to recognize text-free pages on-device. OCR text and reading order should still be reviewed." },
    ],
    relatedToolIds: ["extract-text", "pdf-to-html", "ocr-pdf"],
  }),
  t({
    id: "pdf-to-excel",
    slug: "pdf-to-excel",
    name: "PDF to Excel",
    shortDescription: "Detect PDF tables, review confidence, and export selected grids to XLSX.",
    longDescription:
      "Find table-shaped text geometry in a PDF, preview every candidate with an explainable confidence score, and export only approved high-confidence tables. Each selection becomes an editable Excel worksheet; numeric-looking values stay visible for review instead of being silently reinterpreted.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["xlsx"],
    tags: ["excel", "xlsx", "table extraction", "spreadsheet", "invoice", "statement"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF, select pages, and optionally enable OCR for scans.",
      "Local layout analysis scores repeated rows using column alignment, consistency, header emphasis, density, and numeric signals.",
      "Preview candidates and select only tables meeting the export threshold.",
      "Download a validated XLSX with one worksheet per selected table.",
    ],
    faq: [
      { question: "Why can’t I select a low-confidence table?", answer: "NGPDFs requires at least 68% confidence to avoid quietly turning parallel prose or irregular layouts into misleading spreadsheet cells." },
      { question: "Are numbers recalculated?", answer: "No. Values are exported as displayed strings so leading zeros, separators, signs, and currency marks remain available for human verification." },
      { question: "Does it extract every page into a sheet?", answer: "No. This tool exports detected tables only. Use Extract Text or PDF to Word for narrative content." },
    ],
    relatedToolIds: ["extract-text", "pdf-to-word", "ocr-pdf"],
  }),
  t({
    id: "pdf-to-powerpoint",
    slug: "pdf-to-powerpoint",
    name: "PDF to PowerPoint",
    shortDescription: "Create one visually faithful, flattened PowerPoint slide per PDF page.",
    longDescription:
      "Convert selected PDF pages into a local PPTX by rendering each page as a high-quality full-slide image. This required first mode preserves visual appearance and page order, while clearly disclosing that text, tables, and shapes are flattened rather than element-editable.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pptx"],
    tags: ["powerpoint", "pptx", "slides", "presentation", "visual fidelity"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open one PDF and select the pages to turn into slides.",
      "Choose compact, balanced, or high raster quality for the visual result.",
      "Pages render sequentially within device limits and become one contained image per slide.",
      "A validated PPTX Open XML package is built locally with matching slide order.",
    ],
    faq: [
      { question: "Can I edit the text in PowerPoint?", answer: "No. This mode deliberately creates flattened slides for visual fidelity. The compatibility report makes that limitation visible before conversion." },
      { question: "What happens when PDF pages have different sizes?", answer: "The presentation uses one shared slide size. Each rendered page is contained without cropping, so differently shaped pages may have margins." },
      { question: "Does higher DPI always help?", answer: "It improves raster detail but consumes more memory and produces a larger deck. Rendering remains bounded by the detected device capability." },
    ],
    relatedToolIds: ["pdf-to-jpg", "pdf-to-word", "extract-text"],
  }),
  t({
    id: "pdf-to-html",
    slug: "pdf-to-html",
    name: "PDF to HTML",
    shortDescription: "Export safe semantic or layout-preserving HTML from a PDF.",
    longDescription:
      "Convert selected PDF pages into a standalone local HTML file. Semantic mode creates accessible headings, paragraphs, lists, and tables; layout mode positions text at reconstructed page coordinates. Both outputs include a restrictive content security policy and no PDF JavaScript.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["html"],
    tags: ["html", "web page", "semantic", "positioned layout", "accessible"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF and choose pages, reading order, repeated-margin cleanup, and optional local OCR.",
      "Select semantic reflow for accessible content or positioned layout for closer page geometry.",
      "Review which structure is preserved, approximated, or omitted.",
      "Download a standalone inert HTML document with no active PDF content.",
    ],
    faq: [
      { question: "Which mode should I choose?", answer: "Semantic mode is better for accessibility, responsive reading, and editing. Layout mode is better when approximate PDF coordinates matter, but it is less reflowable." },
      { question: "Can PDF scripts execute in the HTML?", answer: "No. PDF JavaScript is never extracted. The generated file contains no scripts and includes a restrictive content security policy." },
      { question: "Are fonts and images embedded?", answer: "Not in this first semantic exporter. Font attributes are approximated in layout mode; embedded fonts, arbitrary vector art, and most source images are disclosed as omitted." },
    ],
    relatedToolIds: ["pdf-to-word", "extract-text", "pdf-to-epub"],
  }),
  t({
    id: "pdf-to-epub",
    slug: "pdf-to-epub",
    name: "PDF to EPUB",
    shortDescription: "Turn PDF reading order into a reflowable EPUB 3 ebook.",
    longDescription:
      "Reconstruct selected PDF text into semantic EPUB 3 chapters with a navigation document, package metadata, headings, paragraphs, lists, and confidently detected tables. Integrated local OCR can include scans, while the compatibility report calls out reflow and image limitations.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["epub"],
    tags: ["epub", "ebook", "reflow", "chapters", "reader"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF and configure page selection, reading order, margin cleanup, and optional OCR.",
      "Choose how many source pages to group into each reflowable chapter.",
      "Semantic blocks become XHTML chapters with a generated EPUB navigation document.",
      "The EPUB package is validated for required files before local download.",
    ],
    faq: [
      { question: "Will each ebook page match the PDF page?", answer: "No. EPUB is intentionally reflowable, so pagination changes with reader size and typography. Source page grouping controls chapters, not fixed screens." },
      { question: "Does it include a table of contents?", answer: "Yes. A standards-based EPUB navigation document links every generated chapter." },
      { question: "What content may be missing?", answer: "Decorative vectors, embedded fonts, complex image placement, forms, and interactive PDF content are omitted and reported. Review converted equations and unusual reading orders." },
    ],
    relatedToolIds: ["pdf-to-html", "pdf-to-word", "ebook-to-pdf"],
  }),
  t({
    id: "pdf-to-audio",
    slug: "pdf-to-audio",
    name: "PDF to Audio",
    shortDescription: "Listen to reconstructed PDF text with an on-device browser voice.",
    longDescription:
      "Extract readable PDF paragraphs, optionally recognize scanned pages locally, and listen through a voice explicitly reported by the browser as local. Control voice and speed in the current tab. This tool does not upload text and does not pretend that browser speech can create a downloadable audio file.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: [],
    tags: ["listen", "text to speech", "speech synthesis", "accessibility", "read aloud"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a PDF, choose pages and reading order, and optionally recognize scans locally.",
      "Review the reconstructed text before it is spoken.",
      "Choose a voice that the browser explicitly marks as local and set playback speed.",
      "Play, pause, resume, or stop speech in the current tab; no audio file is generated.",
    ],
    faq: [
      { question: "Can I download an MP3?", answer: "No. The browser SpeechSynthesis API provides playback, not a trustworthy local audio encoder, so this tool makes no downloadable-audio claim." },
      { question: "Why are no voices available?", answer: "NGPDFs only lists voices the browser marks as local. If none are exposed, the extracted text remains available to read but is not sent to an online voice." },
      { question: "Does my document text leave the browser?", answer: "No. Extraction and optional OCR are local, and voices not explicitly marked local are excluded from playback." },
    ],
    relatedToolIds: ["extract-text", "ocr-pdf", "pdf-to-epub"],
  }),
  t({
    id: "ocr-pdf",
    slug: "ocr-pdf",
    name: "OCR PDF",
    shortDescription: "Make scanned PDFs searchable with private, on-device OCR.",
    longDescription:
      "Recognize English or Spanish text with Tesseract WebAssembly, skip pages that are already searchable, and add an aligned invisible text layer while preserving every original visual page. Review page confidence and export PDF, TXT, or Markdown without uploading the document.",
    category: "convert-from-pdf",
    acceptedFileTypes: "application/pdf,.pdf",
    outputTypes: ["pdf", "txt", "md"],
    tags: ["searchable", "scan", "recognize text", "tesseract", "offline ocr"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Open a scanned or mixed PDF and choose pages and a recognition language.",
      "NGPDFs skips text-rich pages unless you explicitly force OCR.",
      "Selected pages are rendered and preprocessed one at a time before local recognition.",
      "An invisible text layer is aligned over the unchanged visual pages and verified before download.",
    ],
    faq: [
      {
        question: "Does OCR change how my PDF looks?",
        answer: "No. Preprocessing is used only for recognition. The searchable PDF retains each original visual page and adds non-rendering text behind it.",
      },
      {
        question: "Why are only English and Spanish available initially?",
        answer: "Language models are several megabytes each. NGPDFs starts with two explicitly pinned, self-hosted models instead of silently downloading a large catalog; more languages can be added after fixture validation.",
      },
      {
        question: "Is handwriting recognition accurate?",
        answer: "Tesseract is designed primarily for printed text. Handwriting recognition is labeled Beta and always preserves the original handwritten page for manual review.",
      },
    ],
    relatedToolIds: ["scan-to-pdf", "extract-text", "handwriting-to-pdf"],
  }),
  t({
    id: "scan-to-pdf",
    slug: "scan-to-pdf",
    name: "Scan to PDF",
    shortDescription: "Capture or import document photos and correct them into a multi-page PDF.",
    longDescription:
      "Use an explicitly activated device camera or imported photos to build a local scan stack. Review every detected boundary, adjust four corners with touch-sized keyboard-accessible handles or numeric controls, apply perspective correction and enhancement, reorder pages, and optionally make the result searchable.",
    category: "convert-to-pdf",
    acceptedFileTypes: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
    outputTypes: ["pdf", "txt"],
    tags: ["camera", "document scanner", "perspective", "mobile scan", "searchable scan"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "available",
    howItWorks: [
      "Start the camera explicitly or import existing document photos.",
      "Review the suggested boundary and adjust all four corners for each page.",
      "Reorder, rotate, and choose color, auto, grayscale, or black-and-white enhancement.",
      "Export a multi-page PDF, optionally adding local OCR searchable text.",
    ],
    faq: [
      { question: "When is camera permission requested?", answer: "Only after you press Start camera. If permission is unavailable or denied, photo import remains fully usable." },
      { question: "Is automatic edge detection final?", answer: "No. It is a lightweight local suggestion and can be wrong. NGPDFs always exposes all four corners for review and adjustment." },
      { question: "Are captured pages uploaded?", answer: "No. Camera frames, crop coordinates, corrected images, OCR, and PDF assembly remain in browser memory." },
    ],
    relatedToolIds: ["ocr-pdf", "images-to-pdf", "handwriting-to-pdf"],
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
