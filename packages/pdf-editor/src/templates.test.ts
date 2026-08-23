import { describe, expect, it } from "vitest";
import { expandTemplate, sanitizeTokenText, zoneX, zoneY } from "./templates";

describe("expandTemplate", () => {
  const vars = {
    n: 7,
    total: 42,
    date: new Date("2026-08-23T12:00:00Z"),
    filename: "quarterly-report.pdf",
  };

  it("expands every supported token", () => {
    expect(expandTemplate("{n}", vars)).toBe("7");
    expect(expandTemplate("Page {n} of {total}", vars)).toBe("Page 7 of 42");
    expect(expandTemplate("{date}", vars)).toBe("2026-08-23");
    expect(expandTemplate("{filename}", vars)).toBe("quarterly-report.pdf");
  });

  it("handles combined templates", () => {
    expect(expandTemplate("Report {filename} - page {n}/{total} ({date})", vars)).toBe(
      "Report quarterly-report.pdf - page 7/42 (2026-08-23)"
    );
  });

  it("defaults date and filename when omitted", () => {
    const result = expandTemplate("{date}|{filename}", { n: 1, total: 1 });
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}\|document$/);
  });
});

describe("sanitizeTokenText", () => {
  it("strips newlines and truncates long values", () => {
    expect(sanitizeTokenText("line1\nline2\r\nline3")).toBe("line1 line2 line3");
    expect(sanitizeTokenText("x".repeat(500)).length).toBe(120);
  });
});

describe("zone placement", () => {
  it("places left/center/right zones inside the page", () => {
    const pageWidth = 595.28;
    const textWidth = 100;
    const margin = 28;
    expect(zoneX("left", pageWidth, textWidth, margin)).toBe(margin);
    expect(zoneX("center", pageWidth, textWidth, margin)).toBeCloseTo((pageWidth - textWidth) / 2);
    expect(zoneX("right", pageWidth, textWidth, margin)).toBeCloseTo(pageWidth - textWidth - margin);
  });

  it("keeps right-aligned text inside the page for very long strings", () => {
    expect(zoneX("right", 200, 400, 20)).toBe(20);
  });

  it("computes header/footer baselines", () => {
    expect(zoneY("header", 842, 10, 30)).toBe(812);
    expect(zoneY("footer", 842, 10, 30)).toBe(30);
  });
});
