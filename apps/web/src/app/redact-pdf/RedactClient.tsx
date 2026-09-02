"use client";

import { useMemo, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  ColorInput,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  LivePagePreview,
  NumberInput,
  ProcessingProgress,
  SelectInput,
  TextInput,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import type { ResultFile } from "@paperzero/pdf-ui";
import { loadPdfDocument, renderPageToCanvas, getPageTextItems } from "@paperzero/pdf-core";
import { disposeCanvas, PaperZeroError } from "@paperzero/shared";
import { canvasToBlob } from "@paperzero/pdf-core";
import type { RedactionRect } from "@paperzero/pdf-security";
import { runRedactBuild, verifyRedactions, type VerificationResult } from "@paperzero/pdf-security";
import { getWorkerRunner } from "@/lib/worker-runner";

interface DrawState {
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

export function RedactClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [regionsByPage, setRegionsByPage] = useState<Map<number, RedactionRect[]>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [label, setLabel] = useState("REDACTED");
  const [useLabel, setUseLabel] = useState(true);
  const [dpi, setDpi] = useState(150);
  const [overlayColor, setOverlayColor] = useState("#000000");
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [markedCount, setMarkedCount] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<DrawState | null>(null);
  const [, forcePreview] = useState(0);

  const file = docs.readyEntries[0]?.file;
  const collectedTermsRef = useRef<string[]>([]);
  const registerTerm = (term: string) => {
    const t = term.trim();
    if (t.length >= 3 && !collectedTermsRef.current.includes(t)) collectedTermsRef.current.push(t);
  };
  const pageIndex = pageNumber - 1;
  const totalRegions = useMemo(
    () => [...regionsByPage.values()].reduce((sum, rects) => sum + rects.length, 0),
    [regionsByPage]
  );

  const addRect = (rect: RedactionRect, targetPageIndex = pageIndex) => {
    setRegionsByPage((prev) => {
      const next = new Map(prev);
      const existing = next.get(targetPageIndex) ?? [];
      next.set(targetPageIndex, [...existing, rect]);
      return next;
    });
  };

  const findAndMarkAll = async () => {
    if (!file || !searchTerm.trim()) return;
    setSearchError(null);
    try {
      const pdf = await loadPdfDocument(file);
      const needle = searchTerm.toLowerCase();
      let marked = 0;
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const items = await getPageTextItems(page);
        page.cleanup();
        for (const item of items) {
          const haystack = item.str.toLowerCase();
          let matchIndex = haystack.indexOf(needle);
          while (matchIndex >= 0) {
            const e = item.transform[4] ?? 0;
            const f = item.transform[5] ?? 0;
            const size = Math.abs(item.transform[3] ?? 12) || 12;
            const charWidth =
              item.str.length > 0
                ? (item.width || size * item.str.length * 0.5) / item.str.length
                : size * 0.5;
            addRect({
              x: Math.max(0, e + matchIndex * charWidth - 1),
              y: Math.max(0, f - size * 0.28),
              width: needle.length * charWidth + 2,
              height: size * 1.18,
            }, p - 1);
            marked += 1;
            matchIndex = haystack.indexOf(needle, matchIndex + Math.max(1, needle.length));
          }
        }
      }
      if (marked > 0) {
        registerTerm(searchTerm);
        setSearchTerm("");
        setVerification(null);
      }
      setMarkedCount(marked);
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? `Search could not read this PDF: ${error.message}`
          : "Search could not read this PDF."
      );
    }
  };

  const handleExport = () => {
    if (!file || totalRegions === 0) return;
    setVerification(null);
    void op.start(async (signal, onProgress) => {
      onProgress({ phase: "rendering", message: "Rendering affected pages…" });
      const rasters: Array<{ pageIndex: number; bytes: Uint8Array; widthPt: number; heightPt: number }> = [];
      const pdf = await loadPdfDocument(file);
      const pagesToRasterize = [...regionsByPage.keys()].sort((a, b) => a - b);
      for (const pi of pagesToRasterize) {
        if (signal.aborted) return { data: [], warnings: [] };
        const page = await pdf.getPage(pi + 1);
        const base = page.getViewport({ scale: 1 });
        const scale = dpi / 72;
        const rendered = await renderPageToCanvas(pdf, pi + 1, {
          scale,
          maxDimension: 8192,
          maxPixels: 32 * 1024 * 1024,
        });
        const ctx = rendered.canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = overlayColor;
          const s = rendered.widthPx / base.width;
          for (const rect of regionsByPage.get(pi) ?? []) {
            ctx.fillRect(rect.x * s, (base.height - rect.y - rect.height) * s, rect.width * s, rect.height * s);
          }
        }
        const blob = await canvasToBlob(rendered.canvas, "image/jpeg", 0.95);
        disposeCanvas(rendered.canvas);
        page.cleanup();
        rasters.push({
          pageIndex: pi,
          bytes: new Uint8Array(await blob.arrayBuffer()),
          widthPt: base.width,
          heightPt: base.height,
        });

      }

      onProgress({ phase: "building", message: "Rebuilding redacted document…" });
      const outcome = await runRedactBuild(
        getWorkerRunner(),
        file,
        {
          regions: [...regionsByPage.entries()].map(([p, rects]) => ({ pageIndex: p, rects })),
          rasters,
          label: useLabel ? label : undefined,
          overlayColor,
        },
        { signal, onProgress }
      );

      onProgress({ phase: "verifying", message: "Verifying text removal…" });
      const verifyFile = outcome.files[0]!;
      const { extractTextFromBytes } = await import("@/lib/redact-verify");
      const extracted = await extractTextFromBytes(verifyFile.blob, signal);
      const affectedPageNumbers = new Set(pagesToRasterize.map((index) => index + 1));
      const result = verifyRedactions(
        extracted.filter((page) => affectedPageNumbers.has(page.pageNumber)),
        collectedTermsRef.current
      );
      setVerification(result);
      if (!result.passed) {
        throw new PaperZeroError(
          "OUTPUT_INVALID",
          `Redaction verification found ${result.leftovers.length} marked term${result.leftovers.length === 1 ? "" : "s"} in the output. The result was not offered for download.`
        );
      }

      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  const handleSearchMark = () => {
    if (searchTerm.trim().length >= 3) registerTerm(searchTerm);
    void findAndMarkAll();
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs leading-relaxed text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
        <strong>Processed locally in your browser.</strong>{" "}
        <strong>True redaction:</strong> pages you mark are rebuilt from a rendered image with the
        content permanently removed — not just covered. Text on those pages becomes non-selectable.
        Keep your original file; this cannot be undone.
        Redacting a signed PDF normally invalidates its existing cryptographic signatures.
      </p>

      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · redacted locally"
        disabled={op.isProcessing}
        onFiles={(files) => {
          op.reset();
          setRegionsByPage(new Map());
          setVerification(null);
          collectedTermsRef.current = [];
          void docs.addFiles(files);
        }}
        onError={() => undefined}
      />

      {file ? (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1">
            <LivePagePreview
              file={file}
              pageNumber={pageNumber}
              widthCss={520}
              onInfo={(info) => setPageCount(info.pageCount)}
            >
              {({ scale, heightPt }) => (
                <div
                  ref={overlayRef}
                  className="absolute inset-0 cursor-crosshair"
                  style={{ touchAction: "none" }}
                  role="application"
                  aria-label="Redaction area selector. Drag to mark areas to remove."
                  onPointerDown={(event) => {
                    event.preventDefault();
                    const bounds = overlayRef.current!.getBoundingClientRect();
                    drawRef.current = {
                      startX: (event.clientX - bounds.left) / scale,
                      startY: heightPt - (event.clientY - bounds.top) / scale,
                      curX: 0,
                      curY: 0,
                    };
                    overlayRef.current?.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    const d = drawRef.current;
                    if (!d || !overlayRef.current) return;
                    const bounds = overlayRef.current.getBoundingClientRect();
                    d.curX = (event.clientX - bounds.left) / scale;
                    d.curY = heightPt - (event.clientY - bounds.top) / scale;
                    forcePreview((n) => n + 1);
                  }}
                  onPointerUp={() => {
                    const d = drawRef.current;
                    if (!d) return;
                    drawRef.current = null;
                    forcePreview((n) => n + 1);
                    const x = Math.min(d.startX, d.curX);
                    const y = Math.min(d.startY, d.curY);
                    const width = Math.abs(d.curX - d.startX);
                    const height = Math.abs(d.curY - d.startY);
                    if (width > 4 && height > 3) {
                      addRect({ x, y, width, height });
                      setVerification(null);
                    }
                  }}
                >
                  {(regionsByPage.get(pageIndex) ?? []).map((rect, i) => (
                    <div
                      key={i}
                      className="pointer-events-none absolute border border-black bg-black"
                      aria-hidden="true"
                      style={{
                        left: rect.x * scale,
                        top: (heightPt - rect.y - rect.height) * scale,
                        width: rect.width * scale,
                        height: rect.height * scale,
                        backgroundColor: overlayColor,
                        borderColor: overlayColor,
                      }}
                    />
                  ))}
                  {drawRef.current ? (() => {
                    const d = drawRef.current;
                    const left = Math.min(d.startX, d.curX) * scale;
                    const top = (heightPt - Math.max(d.startY, d.curY)) * scale;
                    return (
                      <div
                        className="pointer-events-none absolute border-2 border-dashed border-red-600 bg-red-600/30"
                        style={{
                          left,
                          top,
                          width: Math.abs(d.curX - d.startX) * scale,
                          height: Math.abs(d.curY - d.startY) * scale,
                        }}
                      />
                    );
                  })() : null}
                </div>
              )}
            </LivePagePreview>
          </div>

          <aside className="w-full shrink-0 lg:w-80" aria-label="Redaction controls">
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Page</span>
                <div className="flex items-center gap-1">
                  <Button variant="secondary" onClick={() => setPageNumber((n) => Math.max(1, n - 1))} disabled={pageNumber === 1} aria-label="Previous page">◀</Button>
                  <NumberInput
                    value={pageNumber}
                    min={1}
                    max={pageCount ?? 9999}
                    onChange={(e) => setPageNumber(Math.max(1, Number(e.target.value)))}
                    className="w-20"
                  />
                  <Button variant="secondary" onClick={() => setPageNumber((n) => Math.min(pageCount ?? 1, n + 1))} disabled={!pageCount || pageNumber >= pageCount} aria-label="Next page">▶</Button>
                </div>
              </div>
              <p role="status" className="text-xs text-slate-500 dark:text-slate-400">
                {totalRegions} region{totalRegions === 1 ? "" : "s"} marked across{" "}
                {regionsByPage.size} page{regionsByPage.size === 1 ? "" : "s"}
                {markedCount !== null && markedCount > 0 ? ` · search matched ${markedCount} occurrence${markedCount === 1 ? "" : "s"}` : ""}
              </p>
              {markedCount === 0 ? (
                <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
                  No exact matches were found in the extractable text layer. Try manual regions;
                  scanned pages require OCR.
                </p>
              ) : null}
              {searchError ? (
                <p role="alert" className="text-xs text-red-700 dark:text-red-300">
                  {searchError}
                </p>
              ) : null}

              <Field label="Search & mark all matches" htmlFor="rd-search" hint="Marks every occurrence across all pages">
                <div className="flex gap-2">
                  <TextInput id="rd-search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="e.g. Aadhaar or salary" />
                  <Button variant="secondary" onClick={handleSearchMark} disabled={!searchTerm.trim()}>Mark</Button>
                </div>
              </Field>

              <Checkbox label="Print REDACTED label inside boxes" checked={useLabel} onChange={setUseLabel} />
              <ColorInput label="Redaction overlay color" value={overlayColor} onChange={setOverlayColor} />
              {useLabel ? (
                <Field label="Label text" htmlFor="rd-label">
                  <TextInput id="rd-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={20} />
                </Field>
              ) : null}

              <Field label="Render DPI for redacted pages" htmlFor="rd-dpi">
                <SelectInput id="rd-dpi" value={String(dpi)} onChange={(e) => setDpi(Number(e.target.value))}>
                  {[110, 150, 220, 300].map((v) => (
                    <option key={v} value={v}>{v} DPI</option>
                  ))}
                </SelectInput>
              </Field>

              {totalRegions > 0 ? (
                <>
                  <Button variant="secondary" onClick={() => { setRegionsByPage(new Map()); collectedTermsRef.current = []; setVerification(null); }}>
                    Clear all regions
                  </Button>
                  <Button onClick={handleExport} disabled={op.isProcessing}>
                    Redact & download ({totalRegions})
                  </Button>
                </>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Drag boxes over content to remove, or search above.
                </p>
              )}

              {verification ? (
                verification.passed ? (
                  <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {verification.checkedTerms.length > 0
                      ? `✓ Verification passed: ${verification.checkedTerms.length} marked term${verification.checkedTerms.length === 1 ? "" : "s"} no longer appear in the output’s extractable text.`
                      : "✓ Affected pages were rebuilt without an extractable text layer. Visual regions were permanently burned into the rasterized pages."}
                  </p>
                ) : (
                  <p role="alert" className="rounded-lg border border-red-400 bg-red-50 p-2 text-xs text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
                    ⚠ Verification found leftovers: {verification.leftovers.join(", ")}. These may live on unmarked pages — search & mark them too.
                  </p>
                )
              ) : null}
            </div>

            {[...regionsByPage.entries()].map(([pi, rects]) => (
              <p key={pi} className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Page {pi + 1}: {rects.length} region{rects.length === 1 ? "" : "s"}
              </p>
            ))}
          </aside>
        </div>
      ) : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Redacting" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result && op.result.length > 0 ? (
        <DownloadResult
          toolId="redact-pdf"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
            setRegionsByPage(new Map());
            setVerification(null);
          }}
        />
      ) : null}
    </div>
  );
}
