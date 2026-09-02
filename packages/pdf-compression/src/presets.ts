import type { CompressionPreset, CompressionProfile } from "./types";

export const COMPRESSION_PRESETS: Record<CompressionPreset, CompressionProfile> = {
  light: {
    id: "light",
    label: "Light · print quality",
    basePreset: "light",
    colorDpi: 220,
    grayDpi: 220,
    monoDpi: 400,
    jpegQuality: 88,
  },
  medium: {
    id: "medium",
    label: "Medium · balanced",
    basePreset: "medium",
    colorDpi: 150,
    grayDpi: 150,
    monoDpi: 300,
    jpegQuality: 80,
  },
  heavy: {
    id: "heavy",
    label: "Heavy · smallest practical file",
    basePreset: "heavy",
    colorDpi: 96,
    grayDpi: 96,
    monoDpi: 200,
    jpegQuality: 65,
  },
};

const TARGET_FALLBACKS: CompressionProfile[] = [
  {
    id: "target-72",
    label: "Target retry · 72 DPI",
    basePreset: "heavy",
    colorDpi: 72,
    grayDpi: 72,
    monoDpi: 150,
    jpegQuality: 52,
  },
  {
    id: "target-56",
    label: "Target retry · 56 DPI",
    basePreset: "heavy",
    colorDpi: 56,
    grayDpi: 56,
    monoDpi: 120,
    jpegQuality: 42,
  },
];

export function buildTargetProfiles(
  inputBytes: number,
  targetBytes: number,
  maxAttempts = 4
): CompressionProfile[] {
  if (!Number.isFinite(targetBytes) || targetBytes <= 0) return [];
  const boundedAttempts = Math.max(1, Math.min(4, Math.floor(maxAttempts)));
  const ratio = targetBytes / Math.max(1, inputBytes);
  const start: CompressionPreset = ratio >= 0.65 ? "light" : ratio >= 0.3 ? "medium" : "heavy";
  const order: CompressionProfile[] =
    start === "light"
      ? [COMPRESSION_PRESETS.light, COMPRESSION_PRESETS.medium, COMPRESSION_PRESETS.heavy]
      : start === "medium"
        ? [COMPRESSION_PRESETS.medium, COMPRESSION_PRESETS.heavy]
        : [COMPRESSION_PRESETS.heavy];
  return [...order, ...TARGET_FALLBACKS].slice(0, boundedAttempts);
}

export function ghostscriptArgs(
  profile: CompressionProfile,
  inputPath = "/input.pdf",
  outputPath = "/output.pdf"
): string[] {
  return [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.7",
    "-dSAFER",
    "-dBATCH",
    "-dNOPAUSE",
    "-dQUIET",
    "-dDetectDuplicateImages=true",
    "-dCompressFonts=true",
    "-dSubsetFonts=true",
    "-dEmbedAllFonts=true",
    "-dAutoRotatePages=/None",
    "-dPreserveAnnots=true",
    "-dDownsampleColorImages=true",
    "-dDownsampleGrayImages=true",
    "-dDownsampleMonoImages=true",
    "-dColorImageDownsampleType=/Bicubic",
    "-dGrayImageDownsampleType=/Bicubic",
    "-dMonoImageDownsampleType=/Subsample",
    "-dColorImageDownsampleThreshold=1.0",
    "-dGrayImageDownsampleThreshold=1.0",
    "-dMonoImageDownsampleThreshold=1.0",
    `-dColorImageResolution=${profile.colorDpi}`,
    `-dGrayImageResolution=${profile.grayDpi}`,
    `-dMonoImageResolution=${profile.monoDpi}`,
    "-dAutoFilterColorImages=false",
    "-dAutoFilterGrayImages=false",
    "-dColorImageFilter=/DCTEncode",
    "-dGrayImageFilter=/DCTEncode",
    "-dPassThroughJPEGImages=false",
    `-dJPEGQ=${profile.jpegQuality}`,
    `-sOutputFile=${outputPath}`,
    inputPath,
  ];
}
