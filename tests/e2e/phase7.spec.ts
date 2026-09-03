import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";

test("reconstructs a local text PDF into a valid editable DOCX", async ({ page }) => {
  const source = await PDFDocument.create();
  const font = await source.embedFont(StandardFonts.Helvetica);
  const bold = await source.embedFont(StandardFonts.HelveticaBold);
  const first = source.addPage([612, 792]);
  first.drawText("Phase 7 conversion fixture", { x: 54, y: 720, size: 22, font: bold });
  first.drawText("This paragraph is reconstructed locally into editable Word content.", { x: 54, y: 680, size: 11, font });
  const second = source.addPage([612, 792]);
  second.drawText("Second page", { x: 54, y: 720, size: 18, font: bold });
  second.drawText("No upload endpoint is involved.", { x: 54, y: 680, size: 11, font });
  const bytes = await source.save();

  await page.goto("/pdf-to-word");
  await expect(page.getByRole("heading", { name: "PDF to Word", exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "phase-7-fixture.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes),
  });
  const convert = page.getByRole("button", { name: "Reconstruct editable Word document" });
  await expect(convert).toBeEnabled();
  await convert.click();

  await expect(page.getByRole("heading", { name: "Done — your file is ready" })).toBeVisible();
  await expect(page.getByText(/Analyzed 2 pages/)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  if (stream) for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const docx = await JSZip.loadAsync(Buffer.concat(chunks));
  const documentXml = await docx.file("word/document.xml")?.async("string");
  expect(documentXml).toContain("Phase 7 conversion fixture");
  expect(documentXml).toContain("editable Word content");
  expect(docx.file("word/styles.xml")).toBeTruthy();
});
