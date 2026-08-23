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
    id: "encrypt-pdf",
    slug: "encrypt-pdf",
    name: "Encrypt PDF",
    shortDescription: "Protect a PDF with a password, entirely on-device.",
    longDescription: "Add password protection and permissions to a PDF locally.",
    category: "security",
    outputTypes: ["pdf"],
    tags: ["password", "protect", "lock"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "coming-soon",
    plannedPhase: "Phase 3",
    howItWorks: [],
    faq: [],
    relatedToolIds: [],
  }),
  t({
    id: "redact-pdf",
    slug: "redact-pdf",
    name: "Redact PDF",
    shortDescription: "Permanently remove sensitive text and regions before sharing.",
    longDescription: "True redaction that deletes underlying content, not just black boxes.",
    category: "security",
    outputTypes: ["pdf"],
    tags: ["black out", "hide", "censor", "PII"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "coming-soon",
    plannedPhase: "Phase 3",
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
  t({
    id: "sign-pdf",
    slug: "sign-pdf",
    name: "Sign PDF",
    shortDescription: "Draw, type or upload a signature and place it on a PDF.",
    longDescription: "Add signatures to documents locally; signatures never leave your device.",
    category: "edit",
    outputTypes: ["pdf"],
    tags: ["signature", "initials", "draw"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "coming-soon",
    plannedPhase: "Phase 2",
    howItWorks: [],
    faq: [],
    relatedToolIds: [],
  }),
  t({
    id: "edit-pdf-text",
    slug: "edit-pdf-text",
    name: "Edit PDF Text",
    shortDescription: "Click text in a PDF and rewrite it in place.",
    longDescription: "Point-and-click text editing with overlay-based replacement.",
    category: "edit",
    outputTypes: ["pdf"],
    tags: ["change text", "fix typo"],
    offlineCapable: true,
    remoteProcessingDisclosure: null,
    status: "coming-soon",
    plannedPhase: "Phase 2",
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
