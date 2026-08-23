export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  const d = i === 0 ? 0 : decimals;
  return `${value.toFixed(d)} ${units[i]}`;
}

export function sizeBucket(bytes: number): string {
  if (bytes < 1024 * 1024) return "<1MB";
  if (bytes < 10 * 1024 * 1024) return "1-10MB";
  if (bytes < 50 * 1024 * 1024) return "10-50MB";
  if (bytes < 100 * 1024 * 1024) return "50-100MB";
  return ">100MB";
}

export function pageCountBucket(pages: number): string {
  if (pages <= 1) return "1";
  if (pages <= 10) return "2-10";
  if (pages <= 50) return "11-50";
  if (pages <= 200) return "51-200";
  return ">200";
}

export function durationBucket(ms: number): string {
  if (ms < 1000) return "<1s";
  if (ms < 5000) return "1-5s";
  if (ms < 15000) return "5-15s";
  if (ms < 60000) return "15-60s";
  return ">60s";
}

export function sanitizeFilename(name: string, fallback = "document"): string {
  const cleaned = name
    .replace(/[/\\?%*:|"<>\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 180) : fallback;
}

export interface OutputNameOptions {
  baseNames: string[];
  suffix?: string;
  extension: string;
}

export function suggestOutputName({ baseNames, suffix, extension }: OutputNameOptions): string {
  const ext = extension.replace(/^\./, "");
  const bases = baseNames
    .map((n) => n.replace(/\.[^.]+$/, ""))
    .map((n) => n.trim())
    .filter(Boolean);
  let stem: string;
  if (bases.length === 0) {
    stem = "document";
  } else if (bases.length === 1) {
    stem = bases[0]!;
  } else if (bases.length <= 3) {
    stem = bases.join("+");
  } else {
    stem = `${bases[0]}+${bases.length - 1}-more`;
  }
  stem = sanitizeFilename(stem);
  const sfx = suffix ? `-${sanitizeFilename(suffix).replace(/\s+/g, "-")}` : "";
  return `${stem}${sfx}.${ext}`;
}
