export type HeaderFooterZone = "left" | "center" | "right";

export interface ZoneConfig {
  enabled: boolean;
  template: string;
}

export interface HeaderFooterOptions {
  header: ZoneConfig;
  footer: ZoneConfig;
  fontSize: number;
  color: [number, number, number];
  marginPt: number;
  skipFirst: boolean;
  pages: number[];
  fileName: string;
}

export const TEMPLATE_TOKENS = ["{n}", "{total}", "{date}", "{filename}"] as const;

export function expandTemplate(
  template: string,
  vars: { n: number; total: number; date?: Date; filename?: string }
): string {
  const date = vars.date ?? new Date();
  return template
    .replace(/\{n\}/g, String(vars.n))
    .replace(/\{total\}/g, String(vars.total))
    .replace(/\{date\}/g, date.toISOString().slice(0, 10))
    .replace(/\{filename\}/g, sanitizeTokenText(vars.filename ?? "document"));
}

export function sanitizeTokenText(text: string): string {
  return text.replace(/[\r\n]+/g, " ").slice(0, 120);
}

export function zoneX(
  zone: HeaderFooterZone,
  pageWidth: number,
  textWidth: number,
  marginPt: number
): number {
  if (zone === "left") return marginPt;
  if (zone === "right") return Math.max(marginPt, pageWidth - textWidth - marginPt);
  return Math.max(0, (pageWidth - textWidth) / 2);
}

export function zoneY(
  band: "header" | "footer",
  pageHeight: number,
  fontSize: number,
  marginPt: number
): number {
  return band === "header" ? pageHeight - marginPt : marginPt;
}
