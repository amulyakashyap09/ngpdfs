import { expect, test, type Browser, type Page } from "@playwright/test";

declare global {
  interface Window {
    __paperzeroCameraCalls?: number;
  }
}

const OCR_ASSETS = [
  "/ocr/worker.min.js",
  "/ocr/core/tesseract-core-lstm.wasm.js",
  "/ocr/core/tesseract-core-simd-lstm.wasm.js",
  "/ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "/ocr/lang/eng.traineddata.gz",
  "/ocr/lang/spa.traineddata.gz",
];

async function countCameraRequests(page: Page) {
  await page.addInitScript(() => {
    window.__paperzeroCameraCalls = 0;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (...constraints: Parameters<MediaDevices["getUserMedia"]>) => {
        window.__paperzeroCameraCalls = (window.__paperzeroCameraCalls ?? 0) + 1;
        return original(...constraints);
      },
    });
  });
}

test.describe("Phase 5 camera workflow", () => {
  test("requests a mocked camera only after explicit action and captures a page", async ({ browser }) => {
    const context = await browser.newContext({ permissions: ["camera"] });
    const page = await context.newPage();
    await countCameraRequests(page);

    const response = await page.goto("/scan-to-pdf");
    expect(response?.headers()["permissions-policy"]).toContain("camera=(self)");
    await expect(page.getByRole("heading", { name: "Scan to PDF", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__paperzeroCameraCalls)).toBe(0);

    await page.getByRole("button", { name: "Start camera" }).click();
    await expect(page.getByLabel("Live document camera preview")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__paperzeroCameraCalls)).toBe(1);
    await page.waitForFunction(() => {
      const video = document.querySelector("video");
      return video instanceof HTMLVideoElement && video.videoWidth > 0 && video.readyState >= 2;
    });

    await page.getByRole("button", { name: "Capture page" }).click();
    await expect(page.getByRole("heading", { name: "Page stack" })).toBeVisible();
    await expect(page.getByText(/^Page 1 · scan-1\.jpg$/)).toBeVisible();
    await context.close();
  });

  test("shows photo import when a mocked camera request is denied", async ({ browser }) => {
    const context = await deniedCameraContext(browser);
    const page = await context.newPage();
    const response = await page.goto("/scan-to-pdf");
    expect(response?.headers()["permissions-policy"]).toContain("camera=(self)");

    await page.getByRole("button", { name: "Start camera" }).click();
    await expect(page.getByText(
      "Camera permission was denied or the camera is busy. You can import photos below.",
      { exact: true }
    )).toBeVisible();
    await expect(page.getByText("Or import document photos")).toBeVisible();
    expect(await page.evaluate(() => window.__paperzeroCameraCalls)).toBe(1);
    await context.close();
  });
});

test("serves the OCR route and all pinned OCR assets after going offline", async ({ page, context }) => {
  const response = await page.goto("/ocr-pdf");
  expect(response?.headers()["permissions-policy"]).toContain("camera=()");
  await expect(page.getByRole("heading", { name: "OCR PDF", exact: true })).toBeVisible();
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  // Reload once under service-worker control so the navigation and hydrated
  // application chunks are all represented in the versioned caches.
  await page.reload({ waitUntil: "networkidle" });
  const onlineSizes = await fetchAssetSizes(page);
  expect(onlineSizes.every((size) => size > 100_000)).toBe(true);
  await expect.poll(() => cachedAssetCount(page)).toBe(OCR_ASSETS.length);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "OCR PDF", exact: true })).toBeVisible();
  const offlineSizes = await fetchAssetSizes(page);
  expect(offlineSizes).toEqual(onlineSizes);
});

async function deniedCameraContext(browser: Browser) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__paperzeroCameraCalls = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        window.__paperzeroCameraCalls = (window.__paperzeroCameraCalls ?? 0) + 1;
        throw new DOMException("Permission denied", "NotAllowedError");
      },
    });
  });
  return context;
}

async function fetchAssetSizes(page: Page) {
  return page.evaluate(async (assets) => Promise.all(assets.map(async (asset) => {
    const response = await fetch(asset);
    if (!response.ok) throw new Error(`${asset} returned ${response.status}`);
    return (await response.arrayBuffer()).byteLength;
  })), OCR_ASSETS);
}

async function cachedAssetCount(page: Page) {
  return page.evaluate(async (assets) => {
    const results = await Promise.all(assets.map((asset) => caches.match(asset)));
    return results.filter(Boolean).length;
  }, OCR_ASSETS);
}
