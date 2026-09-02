export { analyzePdfForCompression } from "./analysis";
export { COMPRESSION_PRESETS, buildTargetProfiles, ghostscriptArgs } from "./presets";
export { runCompression, runCompressionAnalysis, type CompressionRunner } from "./client";
export type {
  CompressionPreset,
  Compressibility,
  CompressionMemoryRisk,
  CompressionTimeClass,
  PdfContentKind,
  CompressionProfile,
  CompressionAnalysis,
  CompressionOptions,
  CompressionAttemptResult,
  CompressionStats,
  CompressionWorkerResult,
  CompressionClientResult,
} from "./types";
