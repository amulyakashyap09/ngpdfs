export type CompressionPreset = "light" | "medium" | "heavy";
export type Compressibility = "low" | "moderate" | "high";
export type CompressionMemoryRisk = "low" | "moderate" | "high";
export type CompressionTimeClass = "quick" | "moderate" | "long";
export type PdfContentKind = "text-vector" | "mixed" | "image-heavy";

export interface CompressionProfile {
  id: string;
  label: string;
  basePreset: CompressionPreset;
  colorDpi: number;
  grayDpi: number;
  monoDpi: number;
  jpegQuality: number;
}

export interface CompressionAnalysis {
  inputBytes: number;
  pageCount: number;
  imageCount: number;
  contentKind: PdfContentKind;
  compressibility: Compressibility;
  memoryRisk: CompressionMemoryRisk;
  timeClass: CompressionTimeClass;
  alreadyOptimized: boolean;
  hasSignatureFields: boolean;
  hasObjectStreams: boolean;
  hasCompressedStreams: boolean;
}

export interface CompressionOptions {
  preset: CompressionPreset;
  targetBytes?: number;
  maxAttempts?: number;
}

export interface CompressionAttemptResult {
  profileId: string;
  label: string;
  colorDpi: number;
  jpegQuality: number;
  outputBytes: number;
}

export interface CompressionStats {
  originalBytes: number;
  compressedBytes: number;
  bytesSaved: number;
  percentSaved: number;
  beneficial: boolean;
  targetBytes?: number;
  targetReached?: boolean;
  profileUsed: string;
  attempts: number;
}

export interface CompressionWorkerResult {
  file?: { name: string; bytes: Uint8Array };
  warnings: string[];
  analysis: CompressionAnalysis;
  attempts: CompressionAttemptResult[];
  stats: CompressionStats;
}

export interface CompressionClientResult extends Omit<CompressionWorkerResult, "file"> {
  file?: { name: string; blob: Blob };
}
