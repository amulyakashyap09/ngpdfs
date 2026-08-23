export interface ExtractedTextItem {
  str: string;
  x: number;
  y: number;
  height: number;
  width: number;
}

export interface ExtractedLine {
  y: number;
  items: ExtractedTextItem[];
  text: string;
}

const SPACE_THRESHOLD = 0.28;

export function groupItemsIntoLines(items: ExtractedTextItem[]): ExtractedLine[] {
  const usable = items.filter((item) => item.str !== "");
  if (usable.length === 0) return [];
  const heights = usable.map((i) => Math.abs(i.height)).filter((h) => h > 0);
  const medianHeight = median(heights) || 10;
  const tolerance = Math.max(2, medianHeight * 0.5);

  const sorted = [...usable].sort((a, b) => b.y - a.y);
  const lines: ExtractedLine[] = [];
  let current: ExtractedTextItem[] = [];
  let currentY = sorted[0]!.y;

  const flush = () => {
    if (current.length === 0) return;
    current.sort((a, b) => a.x - b.x);
    lines.push({ y: currentY, items: current, text: joinLine(current, medianHeight) });
    current = [];
  };

  for (const item of sorted) {
    if (Math.abs(item.y - currentY) <= tolerance) {
      current.push(item);
      currentY = (currentY * (current.length - 1) + item.y) / current.length;
    } else {
      flush();
      current = [item];
      currentY = item.y;
    }
  }
  flush();
  return lines;
}

function joinLine(items: ExtractedTextItem[], fontSize: number): string {
  let text = "";
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (i > 0) {
      const prev = items[i - 1]!;
      const gap = item.x - (prev.x + prev.width);
      const spaceWidth = fontSize * SPACE_THRESHOLD;
      const needsSpace =
        gap > spaceWidth && !/\s$/.test(text) && !/^\s/.test(item.str);
      if (needsSpace) text += " ";
    }
    text += item.str;
  }
  return text.replace(/[ \t]{2,}/g, " ").trimEnd();
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function buildMarkdown(pages: Array<{ pageNumber: number; lines: string[] }>): string {
  const sections = pages.map(
    (page) => `## Page ${page.pageNumber}\n\n${page.lines.join("\n\n")}`
  );
  return `# Extracted Text\n\n${sections.join("\n\n")}\n`;
}

export function buildPlainText(pages: Array<{ pageNumber: number; lines: string[] }>): string {
  return pages
    .map((page) => `--- Page ${page.pageNumber} ---\n\n${page.lines.join("\n\n")}`)
    .join("\n\n\n")
    .concat("\n");
}
