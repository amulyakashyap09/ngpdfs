import { expect, test } from "@playwright/test";

test("converts Markdown through the production PDF worker and downloads a valid PDF", async ({ page }) => {
  await page.goto("/markdown-to-pdf");
  await expect(page.getByRole("heading", { name: "Markdown to PDF", exact: true })).toBeVisible();

  await page.getByLabel("Markdown source").fill([
    "# Phase 6 fixture",
    "",
    "A **private**, browser-local document.",
    "",
    "| Feature | Result |",
    "|---|---|",
    "| Worker conversion | Pass |",
    "",
    "```text",
    "No upload endpoint is involved.",
    "```",
  ].join("\n"));
  await page.getByLabel("Document title").fill("Worker conversion fixture");
  await page.getByRole("button", { name: "Convert to PDF" }).click();

  await expect(page.getByRole("heading", { name: "Done — your file is ready" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  if (stream) for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).subarray(0, 5).toString("ascii")).toBe("%PDF-");
});
