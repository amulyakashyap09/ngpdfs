import type { OcrLanguage, OcrLanguageDefinition } from "./types";

export const OCR_LANGUAGES: readonly OcrLanguageDefinition[] = [
  { code: "eng", label: "English", modelBytes: 2_952_873 },
  { code: "spa", label: "Spanish", modelBytes: 2_100_190 },
] as const;

export function isOcrLanguage(value: string): value is OcrLanguage {
  return OCR_LANGUAGES.some((language) => language.code === value);
}
