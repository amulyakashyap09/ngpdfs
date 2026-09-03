import type { InlineRun, TextAlignment } from "./types";

export function collapseWhitespace(value: string): string {
  return value.replace(/[\t\r\n ]+/g, " ").trim();
}

export function mergeRuns(runs: InlineRun[]): InlineRun[] {
  const merged: InlineRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const previous = merged.at(-1);
    if (previous && sameStyle(previous, run)) previous.text += run.text;
    else merged.push({ ...run });
  }
  return merged;
}

function sameStyle(left: InlineRun, right: InlineRun): boolean {
  return left.bold === right.bold &&
    left.italic === right.italic &&
    left.underline === right.underline &&
    left.code === right.code &&
    left.href === right.href &&
    JSON.stringify(left.color) === JSON.stringify(right.color);
}

export function safeHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : undefined;
}

export function parseAlignment(value: string | null | undefined): TextAlignment | undefined {
  const normalized = value?.toLowerCase().trim();
  return normalized === "left" || normalized === "center" || normalized === "right"
    ? normalized
    : undefined;
}

export function parseCssColor(value: string | undefined): [number, number, number] | undefined {
  if (!value) return undefined;
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 3 ? [...hex].map((part) => part + part).join("") : hex;
    return [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16) / 255) as [number, number, number];
  }
  const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!rgb) return undefined;
  return [rgb[1], rgb[2], rgb[3]].map((part) => Math.min(255, Number(part)) / 255) as [number, number, number];
}

export function decodeDataImage(source: string): { bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" } | null {
  const match = source.match(/^data:(image\/(?:png|jpeg));base64,([a-z\d+/=\s]+)$/i);
  if (!match) return null;
  const binary = atob(match[2]!.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return { bytes, mimeType: match[1]!.toLowerCase() as "image/png" | "image/jpeg" };
}

export function textFromRuns(runs: InlineRun[]): string {
  return runs.map((run) => run.text).join("");
}

export function decodeTextBytes(bytes: Uint8Array): { text: string; encoding: "utf-8" | "windows-1252"; warning?: string } {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(bytes),
      encoding: "windows-1252",
      warning: "The file was not valid UTF-8, so Windows-1252 fallback decoding was used. Review accented characters before export.",
    };
  }
}
