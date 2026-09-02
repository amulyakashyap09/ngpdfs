export type OcrLanguage = "eng" | "spa";

export interface OcrLanguageDefinition {
  code: OcrLanguage;
  label: string;
  modelBytes: number;
}

export interface OcrPreprocessOptions {
  grayscale: boolean;
  normalizeContrast: boolean;
  threshold: boolean;
  denoise: boolean;
  deskew: boolean;
}

export interface OcrPixelWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface OcrRecognitionResult {
  text: string;
  confidence: number;
  words: OcrPixelWord[];
  imageWidth: number;
  imageHeight: number;
}

export interface OcrPdfWord {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrPageResult {
  pageNumber: number;
  status: "recognized" | "existing-text" | "empty" | "failed";
  text: string;
  confidence?: number;
  words: OcrPdfWord[];
  warning?: string;
}

export interface SearchablePdfPayload {
  bytes: Uint8Array;
  pages: OcrPageResult[];
}
