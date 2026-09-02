"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  NumberInput,
  ProcessingProgress,
  SelectInput,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import {
  BrowserOcrSession,
  OCR_LANGUAGES,
  correctedDimensions,
  enhanceScanRgba,
  estimateDocumentCorners,
  runSearchablePdfAssembly,
  warpPerspectiveRgba,
  type OcrLanguage,
  type OcrPageResult,
  type ScanCorners,
  type ScanEnhancement,
} from "@paperzero/pdf-ocr";
import { createDocumentFile } from "@paperzero/pdf-core";
import { runImagesToPdf } from "@paperzero/pdf-operations";
import { detectCapabilities, disposeCanvas, PaperZeroError, suggestOutputName } from "@paperzero/shared";
import { getWorkerRunner } from "@/lib/worker-runner";

interface ScanPage {
  id: string;
  name: string;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  corners: ScanCorners;
  rotation: 0 | 90 | 180 | 270;
  enhancement: ScanEnhancement;
}

interface ScanResult {
  files: ResultFile[];
  pageCount: number;
}

export function ScanToPdfClient() {
  const operation = useOperation<ScanResult>();
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [makeSearchable, setMakeSearchable] = useState(false);
  const [language, setLanguage] = useState<OcrLanguage>("eng");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pagesRef = useRef<ScanPage[]>([]);
  const capabilities = useMemo(() => detectCapabilities(), []);
  const selected = pages.find((page) => page.id === selectedId) ?? pages[0];

  const stopCamera = () => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => () => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    for (const page of pagesRef.current) URL.revokeObjectURL(page.previewUrl);
  }, []);

  const addFiles = async (files: File[]) => {
    for (const file of files) {
      try {
        const page = await prepareScanPage(file);
        setPages((current) => [...current, page]);
        setSelectedId((current) => current ?? page.id);
      } catch (error) {
        setCameraError(error instanceof Error ? error.message : `Could not decode ${file.name}`);
      }
    }
  };

  const startCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is unavailable in this browser. Import photos instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError("Camera permission was denied or the camera is busy. You can import photos below.");
      stopCamera();
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth < 1) return;
    const max = capabilities.deviceClass === "desktop" ? 3200 : 2200;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas, "image/jpeg", 0.94);
    disposeCanvas(canvas);
    await addFiles([new File([blob], `scan-${pages.length + 1}.jpg`, { type: "image/jpeg" })]);
  };

  const updateSelected = (update: (page: ScanPage) => ScanPage) => {
    if (!selected) return;
    setPages((current) => current.map((page) => page.id === selected.id ? update(page) : page));
  };

  const move = (id: string, direction: -1 | 1) => {
    setPages((current) => {
      const index = current.findIndex((page) => page.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const remove = (page: ScanPage) => {
    URL.revokeObjectURL(page.previewUrl);
    setPages((current) => current.filter((item) => item.id !== page.id));
    if (selectedId === page.id) setSelectedId(null);
  };

  const handleExport = () => {
    if (pages.length === 0) return;
    void operation.start(async (signal, onProgress) => {
      const corrected: Array<{ name: string; bytes: Uint8Array; type: "jpeg"; widthPx: number; heightPx: number; blob: Blob }> = [];
      for (let index = 0; index < pages.length; index++) {
        if (signal.aborted) throw PaperZeroError.cancelled();
        onProgress({ phase: "perspective-correction", completed: index, total: pages.length, message: `Correcting page ${index + 1}` });
        corrected.push(await correctScanPage(pages[index]!, capabilities.deviceClass === "desktop" ? 3200 : 2200));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const built = await runImagesToPdf(
        getWorkerRunner(),
        corrected.map((image) => ({
          name: image.name,
          bytes: image.bytes,
          type: image.type,
          widthPx: image.widthPx,
          heightPx: image.heightPx,
        })),
        { pageSize: "auto", orientation: "portrait", marginPt: 0, fit: "contain" },
        { signal, onProgress }
      );
      let pdf = built.files[0];
      if (!pdf) throw new PaperZeroError("OUTPUT_INVALID", "The scan stack produced no PDF.");
      const warnings = [...built.warnings];
      let recognizedText = "";

      if (makeSearchable) {
        const session = new BrowserOcrSession(language, onProgress);
        const cancel = () => void session.terminate();
        signal.addEventListener("abort", cancel, { once: true });
        try {
          await session.initialize();
          const results: OcrPageResult[] = [];
          for (let index = 0; index < corrected.length; index++) {
            if (signal.aborted) throw PaperZeroError.cancelled();
            const image = corrected[index]!;
            onProgress({ phase: "recognizing-scan", completed: index, total: corrected.length, message: `Recognizing scan ${index + 1}` });
            const result = await session.recognize(image.blob, { width: image.widthPx, height: image.heightPx }, { deskew: true });
            results.push({
              pageNumber: index + 1,
              status: result.text ? "recognized" : "empty",
              text: result.text,
              confidence: result.confidence,
              words: result.words.map((word) => ({
                text: word.text,
                confidence: word.confidence,
                x: word.bbox.x0,
                y: image.heightPx - word.bbox.y1,
                width: word.bbox.x1 - word.bbox.x0,
                height: word.bbox.y1 - word.bbox.y0,
              })),
            });
          }
          recognizedText = results.map((result) => `Page ${result.pageNumber}\n${result.text}`).join("\n\n");
          if (results.some((result) => result.status === "recognized")) {
            const localPdf = createDocumentFile(pdf.blob, { name: pdf.name, type: "application/pdf" });
            try {
              const assembled = await runSearchablePdfAssembly(getWorkerRunner(), localPdf, results, { signal, onProgress });
              pdf = assembled.files[0] ?? pdf;
              warnings.push(...assembled.warnings);
            } finally {
              localPdf.dispose();
            }
          } else {
            warnings.push("OCR did not recognize text in the corrected scan pages.");
          }
        } finally {
          signal.removeEventListener("abort", cancel);
          await session.terminate();
        }
      }

      const files: ResultFile[] = [{
        name: suggestOutputName({ baseNames: ["scan"], suffix: makeSearchable ? "searchable" : undefined, extension: "pdf" }),
        blob: pdf.blob,
      }];
      if (recognizedText) files.push({ name: "scan-ocr.txt", blob: new Blob([recognizedText], { type: "text/plain" }) });
      return { data: { files, pageCount: pages.length }, warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Camera capture">
        <h2 className="font-bold text-slate-900 dark:text-slate-100">Capture pages</h2>
        <p className="mt-1 text-xs text-slate-500">Camera permission is requested only when you press Start camera.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!cameraActive ? <Button onClick={() => void startCamera()}>Start camera</Button> : <Button variant="secondary" onClick={stopCamera}>Stop camera</Button>}
          {cameraActive ? <Button onClick={() => void capture()}>Capture page</Button> : null}
        </div>
        {cameraActive ? <video ref={videoRef} playsInline muted className="mt-3 max-h-[55vh] w-full rounded-xl bg-black object-contain" aria-label="Live document camera preview" /> : null}
        {cameraError ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{cameraError}</p> : null}
      </section>

      <FileDropzone
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple
        label="Or import document photos"
        hint="JPG · PNG · WebP · works when camera access is unavailable"
        disabled={operation.isProcessing}
        onFiles={(files) => void addFiles(files)}
        onError={() => undefined}
      />

      {pages.length > 0 ? (
        <section aria-label="Scan page stack">
          <h2 className="mb-3 font-bold text-slate-900 dark:text-slate-100">Page stack</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page, index) => (
              <article key={page.id} className={`rounded-xl border p-3 ${selected?.id === page.id ? "border-blue-500" : "border-slate-200 dark:border-slate-700"}`}>
                <button type="button" onClick={() => setSelectedId(page.id)} className="w-full">
                  {/* User-created blob URLs cannot use Next's build-time image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.previewUrl} alt={`Scan page ${index + 1}`} className="h-40 w-full rounded-lg object-contain" />
                </button>
                <p className="mt-2 truncate text-sm font-semibold">Page {index + 1} · {page.name}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button variant="secondary" onClick={() => move(page.id, -1)} disabled={index === 0}>↑</Button>
                  <Button variant="secondary" onClick={() => move(page.id, 1)} disabled={index === pages.length - 1}>↓</Button>
                  <Button variant="secondary" onClick={() => setPages((current) => current.map((item) => item.id === page.id ? { ...item, rotation: ((item.rotation + 90) % 360) as ScanPage["rotation"] } : item))}>Rotate</Button>
                  <Button variant="secondary" onClick={() => remove(page)}>Delete</Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {selected ? <CropEditor page={selected} onChange={(page) => updateSelected(() => page)} /> : null}

      {pages.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <Checkbox label="Make text searchable after scanning" checked={makeSearchable} onChange={setMakeSearchable} />
          {makeSearchable ? (
            <Field label="OCR language" htmlFor="scan-ocr-language">
              <SelectInput id="scan-ocr-language" value={language} onChange={(event) => setLanguage(event.target.value as OcrLanguage)}>
                {OCR_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </SelectInput>
            </Field>
          ) : null}
          <Button onClick={handleExport} disabled={operation.isProcessing}>Export {pages.length}-page PDF</Button>
        </section>
      ) : null}

      {operation.isProcessing ? <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label="Building scan" /> : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}
      {operation.status === "success" && operation.result ? (
        <DownloadResult toolId="scan-to-pdf" files={operation.result.files} warnings={operation.warnings} onStartOver={() => operation.reset()} />
      ) : null}
    </div>
  );
}

function CropEditor({ page, onChange }: { page: ScanPage; onChange: (page: ScanPage) => void }) {
  const labels = ["Top left", "Top right", "Bottom right", "Bottom left"];
  const updateCorner = (index: number, axis: "x" | "y", percent: number) => {
    const corners = page.corners.map((corner) => ({ ...corner })) as ScanCorners;
    corners[index]![axis] = Math.max(0, Math.min(axis === "x" ? page.width - 1 : page.height - 1, percent / 100 * (axis === "x" ? page.width : page.height)));
    onChange({ ...page, corners });
  };
  const updateCornerPosition = (index: number, xPercent: number, yPercent: number) => {
    const corners = page.corners.map((corner) => ({ ...corner })) as ScanCorners;
    corners[index]!.x = Math.max(0, Math.min(page.width - 1, xPercent / 100 * page.width));
    corners[index]!.y = Math.max(0, Math.min(page.height - 1, yPercent / 100 * page.height));
    onChange({ ...page, corners });
  };
  return (
    <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Manual crop and enhancement">
      <h2 className="font-bold text-slate-900 dark:text-slate-100">Adjust page boundary</h2>
      <p className="mt-1 text-xs text-slate-500">Automatic detection is only a starting point. Adjust all four corners before export.</p>
      <div className="relative mx-auto mt-4 max-w-xl">
        {/* User-created blob URLs cannot use Next's build-time image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.previewUrl} alt="Selected scan crop preview" className="w-full rounded-lg" />
        {page.corners.map((corner, index) => (
          <button
            key={labels[index]}
            type="button"
            aria-label={`${labels[index]} crop handle`}
            className="absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-blue-600 shadow"
            style={{ left: `${corner.x / page.width * 100}%`, top: `${corner.y / page.height * 100}%` }}
            onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
              if (!bounds) return;
              updateCornerPosition(
                index,
                (event.clientX - bounds.left) / bounds.width * 100,
                (event.clientY - bounds.top) / bounds.height * 100
              );
            }}
            onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
            onKeyDown={(event) => {
              const delta = event.shiftKey ? 10 : 2;
              if (event.key === "ArrowLeft") updateCorner(index, "x", corner.x / page.width * 100 - delta / page.width * 100);
              if (event.key === "ArrowRight") updateCorner(index, "x", corner.x / page.width * 100 + delta / page.width * 100);
              if (event.key === "ArrowUp") updateCorner(index, "y", corner.y / page.height * 100 - delta / page.height * 100);
              if (event.key === "ArrowDown") updateCorner(index, "y", corner.y / page.height * 100 + delta / page.height * 100);
            }}
          />
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {page.corners.map((corner, index) => (
          <fieldset key={labels[index]} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <legend className="px-1 text-xs font-semibold">{labels[index]}</legend>
            <Field label="X %" htmlFor={`corner-${index}-x`}><NumberInput id={`corner-${index}-x`} min={0} max={100} value={Math.round(corner.x / page.width * 100)} onChange={(event) => updateCorner(index, "x", Number(event.target.value))} /></Field>
            <Field label="Y %" htmlFor={`corner-${index}-y`}><NumberInput id={`corner-${index}-y`} min={0} max={100} value={Math.round(corner.y / page.height * 100)} onChange={(event) => updateCorner(index, "y", Number(event.target.value))} /></Field>
          </fieldset>
        ))}
      </div>
      <div className="mt-4 max-w-sm">
        <Field label="Enhancement" htmlFor="scan-enhancement">
          <SelectInput id="scan-enhancement" value={page.enhancement} onChange={(event) => onChange({ ...page, enhancement: event.target.value as ScanEnhancement })}>
            <option value="original">Original color</option>
            <option value="auto">Auto enhance</option>
            <option value="grayscale">Grayscale</option>
            <option value="black-white">Black &amp; white</option>
          </SelectInput>
        </Field>
      </div>
    </section>
  );
}

async function prepareScanPage(file: File): Promise<ScanPage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new PaperZeroError("BROWSER_UNSUPPORTED", "Canvas is unavailable.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const estimated = estimateDocumentCorners(pixels, canvas.width, canvas.height);
    disposeCanvas(canvas);
    const corners = estimated.map((point) => ({ x: point.x / scale, y: point.y / scale })) as ScanCorners;
    const blob = file.slice(0, file.size, file.type || "image/jpeg");
    return {
      id: crypto.randomUUID(),
      name: file.name,
      blob,
      previewUrl: URL.createObjectURL(blob),
      width: bitmap.width,
      height: bitmap.height,
      corners,
      rotation: 0,
      enhancement: "auto",
    };
  } finally {
    bitmap.close();
  }
}

async function correctScanPage(page: ScanPage, maxDimension: number) {
  const bitmap = await createImageBitmap(page.blob);
  const sourceScale = Math.min(1, (maxDimension * 1.5) / Math.max(bitmap.width, bitmap.height));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = Math.max(1, Math.round(bitmap.width * sourceScale));
  sourceCanvas.height = Math.max(1, Math.round(bitmap.height * sourceScale));
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new PaperZeroError("BROWSER_UNSUPPORTED", "Canvas is unavailable.");
  sourceContext.drawImage(bitmap, 0, 0, sourceCanvas.width, sourceCanvas.height);
  bitmap.close();
  const source = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
  const scaledCorners = page.corners.map((point) => ({
    x: point.x * sourceScale,
    y: point.y * sourceScale,
  })) as ScanCorners;
  const dimensions = correctedDimensions(scaledCorners, maxDimension);
  const warped = warpPerspectiveRgba(source, sourceCanvas.width, sourceCanvas.height, scaledCorners, dimensions.width, dimensions.height);
  disposeCanvas(sourceCanvas);
  const enhanced = enhanceScanRgba(warped, dimensions.width, dimensions.height, page.enhancement);
  const correctedCanvas = document.createElement("canvas");
  correctedCanvas.width = dimensions.width;
  correctedCanvas.height = dimensions.height;
  const correctedContext = correctedCanvas.getContext("2d");
  if (!correctedContext) throw new PaperZeroError("BROWSER_UNSUPPORTED", "Canvas is unavailable.");
  const imageBuffer = new ArrayBuffer(enhanced.byteLength);
  const imagePixels = new Uint8ClampedArray(imageBuffer);
  imagePixels.set(enhanced);
  correctedContext.putImageData(new ImageData(imagePixels, dimensions.width, dimensions.height), 0, 0);
  const finalCanvas = rotateCanvas(correctedCanvas, page.rotation);
  if (finalCanvas !== correctedCanvas) disposeCanvas(correctedCanvas);
  const blob = await canvasBlob(finalCanvas, "image/jpeg", 0.92);
  const result = {
    name: `${page.name.replace(/\.[^.]+$/, "")}-corrected.jpg`,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    type: "jpeg" as const,
    widthPx: finalCanvas.width,
    heightPx: finalCanvas.height,
    blob,
  };
  disposeCanvas(finalCanvas);
  return result;
}

function rotateCanvas(source: HTMLCanvasElement, rotation: ScanPage["rotation"]): HTMLCanvasElement {
  if (rotation === 0) return source;
  const canvas = document.createElement("canvas");
  const swaps = rotation === 90 || rotation === 270;
  canvas.width = swaps ? source.height : source.width;
  canvas.height = swaps ? source.width : source.height;
  const context = canvas.getContext("2d")!;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(rotation * Math.PI / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new PaperZeroError("OUTPUT_INVALID", "Image encoding failed.")), type, quality));
}
