"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  LivePagePreview,
  NumberInput,
  ProcessingProgress,
  TextInput,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import type { ResultFile } from "@paperzero/pdf-ui";
import { disposeCanvas, PaperZeroError, toPaperZeroError } from "@paperzero/shared";
import { loadPdfDocument, renderPageToCanvas, canvasToBlob, getPageTextItems } from "@paperzero/pdf-core";
import { findPiiMatches, runRedactBuild, verifyRedactions, DEFAULT_DETECTOR_OPTIONS, type PiiType } from "@paperzero/pdf-security";
import { getWorkerRunner } from "@/lib/worker-runner";

interface Candidate {
  id: string;
  type: PiiType;
  value: string;
  pageIndex: number;
  rect: { x: number; y: number; width: number; height: number };
}

const TYPE_LABELS: Record<PiiType, string> = {
  email: "Email addresses",
  phone: "Phone numbers",
  "credit-card": "Card numbers (Luhn-checked)",
  aadhaar: "Aadhaar-style IDs (Verhoeff-checked)",
  pan: "PAN numbers",
  "ip-address": "IP addresses",
  url: "URLs",
  custom: "Custom patterns",
};

const TYPE_DEFAULT_ON: Record<PiiType, boolean> = {
  email: true,
  phone: true,
  "credit-card": true,
  aadhaar: true,
  pan: true,
  "ip-address": false,
  url: false,
  custom: true,
};

let cid = 0;

export function AutoRedactClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [verification, setVerification] = useState<{ passed: boolean; leftovers: string[] } | null>(null);
  const [customRegex, setCustomRegex] = useState("");
  const [scanError, setScanError] = useState<PaperZeroError | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);

  const file = docs.readyEntries[0]?.file;

  const grouped = useMemo(() => {
    if (!candidates) return [];
    const groups = new Map<PiiType, Candidate[]>();
    for (const c of candidates) {
      groups.set(c.type, [...(groups.get(c.type) ?? []), c]);
    }
    return [...groups.entries()];
  }, [candidates]);

  const handleScan = () => {
    if (!file) return;
    setScanning(true);
    setCandidates(null);
    setVerification(null);
    setScanError(null);
    void (async () => {
      try {
        const pdf = await loadPdfDocument(file);
        setPageCount(pdf.numPages);
        const found: Candidate[] = [];
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const items = await getPageTextItems(page);
          page.cleanup();
          for (const item of items) {
            if (!item.str.trim()) continue;
            const matches = findPiiMatches(item.str, {
              ...DEFAULT_DETECTOR_OPTIONS,
              customRegexes: customRegex.trim() ? [customRegex.trim()] : [],
            });
            if (matches.length === 0) continue;
            const e = item.transform[4] ?? 0;
            const f = item.transform[5] ?? 0;
            const size = Math.abs(item.transform[3] ?? 12) || 12;
            for (const match of matches) {
              cid += 1;
              const charRatio = item.str.length > 0 ? (item.width || size * item.str.length * 0.5) / item.str.length : size * 0.5;
              found.push({
                id: `c_${cid}`,
                type: match.type,
                value: match.value,
                pageIndex: p - 1,
                rect: {
                  x: Math.max(0, e + match.start * charRatio - 1),
                  y: Math.max(0, f - size * 0.28),
                  width: Math.max(6, (match.end - match.start) * charRatio + 2),
                  height: size * 1.18,
                },
              });
            }
          }
          await new Promise((r) => setTimeout(r, 0));
        }
        setCandidates(found);
        setSelected(new Set(found.filter((c) => TYPE_DEFAULT_ON[c.type]).map((c) => c.id)));
      } catch (error) {
        setScanError(toPaperZeroError(error));
      } finally {
        setScanning(false);
      }
    })();
  };

  const toggleType = (type: PiiType, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of candidates ?? []) {
        if (c.type !== type) continue;
        if (on) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });
  };

  const toggleCandidate = (candidate: Candidate) => {
    setPreviewPage(candidate.pageIndex + 1);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(candidate.id)) next.delete(candidate.id);
      else next.add(candidate.id);
      return next;
    });
  };

  const handleRedact = () => {
    if (!file || !candidates) return;
    setVerification(null);
    const chosen = candidates.filter((c) => selected.has(c.id));
    if (chosen.length === 0) return;
    void op.start(async (signal, onProgress) => {
      onProgress({ phase: "rendering", message: "Rendering affected pages…" });
      const byPage = new Map<number, { x: number; y: number; width: number; height: number }[]>();
      for (const c of chosen) {
        byPage.set(c.pageIndex, [...(byPage.get(c.pageIndex) ?? []), c.rect]);
      }
      const pdf = await loadPdfDocument(file);
      const rasters = [];
      for (const pi of [...byPage.keys()].sort((a, b) => a - b)) {
        const page = await pdf.getPage(pi + 1);
        const base = page.getViewport({ scale: 1 });
        const rendered = await renderPageToCanvas(pdf, pi + 1, {
          scale: dpiFor(base.width),
          maxDimension: 8192,
          maxPixels: 32 * 1024 * 1024,
        });
        const ctx = rendered.canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#000000";
          const s = rendered.widthPx / base.width;
          for (const r of byPage.get(pi)!) {
            ctx.fillRect(r.x * s, (base.height - r.y - r.height) * s, r.width * s, r.height * s);
          }
        }
        const blob = await canvasToBlob(rendered.canvas, "image/jpeg", 0.95);
        disposeCanvas(rendered.canvas);
        page.cleanup();
        rasters.push({ pageIndex: pi, bytes: new Uint8Array(await blob.arrayBuffer()), widthPt: base.width, heightPt: base.height });
        onProgress({
          phase: "rendering",
          completed: rasters.length,
          total: byPage.size,
          message: `Page ${pi + 1}`,
        });
      }

      onProgress({ phase: "building", message: "Rebuilding document…" });
      const outcome = await runRedactBuild(
        getWorkerRunner(),
        file,
        {
          regions: [...byPage.entries()].map(([pageIndex, rects]) => ({ pageIndex, rects })),
          rasters,
        },
        { signal, onProgress }
      );

      onProgress({ phase: "verifying", message: "Verifying…" });
      const verifyFile = outcome.files[0]!;
      const { extractTextFromBytes } = await import("@/lib/redact-verify");
      const extracted = await extractTextFromBytes(verifyFile.blob, signal);
      const terms = [...new Set(chosen.map((c) => c.value))];
      const affectedPageNumbers = new Set([...byPage.keys()].map((index) => index + 1));
      const result = verifyRedactions(
        extracted.filter((page) => affectedPageNumbers.has(page.pageNumber)),
        terms
      );
      setVerification(result);
      if (!result.passed) {
        throw new PaperZeroError(
          "OUTPUT_INVALID",
          `PII redaction verification found ${result.leftovers.length} selected value${result.leftovers.length === 1 ? "" : "s"} in the output. The result was not offered for download.`
        );
      }
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <strong>Processed locally in your browser.</strong>{" "}
        Detection runs entirely on this device. Candidates are <strong>suggestions</strong> — nothing
        is redacted until you review and confirm. Card numbers must pass the Luhn checksum;
        Aadhaar-style IDs must pass Verhoeff.
      </p>

      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · scanned locally"
        disabled={op.isProcessing}
        onFiles={(files) => {
          op.reset();
          setCandidates(null);
          setSelected(new Set());
          setVerification(null);
          void docs.addFiles(files);
        }}
        onError={() => undefined}
      />

      {file ? (
        <div className="flex flex-col gap-3">
          <Field
            label="Custom pattern (optional)"
            htmlFor="pii-custom-regex"
            hint="JavaScript regular expression, for example: EMP-\\d{6}. Invalid patterns are rejected before redaction."
          >
            <TextInput
              id="pii-custom-regex"
              value={customRegex}
              onChange={(event) => setCustomRegex(event.target.value)}
              placeholder="EMP-\\d{6}"
            />
          </Field>
          <Button variant={candidates ? "secondary" : "primary"} onClick={handleScan} disabled={scanning}>
            {scanning ? "Scanning…" : candidates ? `Re-scan (${candidates.length} found)` : "Scan document for PII"}
          </Button>
        </div>
      ) : null}

      {scanning ? (
        <ProcessingProgress progress={{ phase: "scanning", message: "Analyzing text…" }} label="Scanning" />
      ) : null}
      {scanError ? <ErrorAlert error={scanError} onRetry={() => setScanError(null)} /> : null}

      {candidates && candidates.length === 0 ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
          No PII patterns detected in this document&rsquo;s text layer.
        </p>
      ) : null}

      {grouped.length > 0 ? (
        <>
          <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
            Review the findings below, then redact the selected ones permanently.
          </p>
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="min-w-0 flex-1">
              <LivePagePreview file={file!} pageNumber={previewPage} widthCss={520}>
                {({ scale, heightPt }) => (
                  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                    {(candidates ?? [])
                      .filter((candidate) => candidate.pageIndex === previewPage - 1)
                      .map((candidate) => (
                        <div
                          key={candidate.id}
                          className={`absolute border-2 ${
                            selected.has(candidate.id)
                              ? "border-red-600 bg-red-500/30"
                              : "border-amber-500 bg-amber-400/20"
                          }`}
                          style={{
                            left: candidate.rect.x * scale,
                            top: (heightPt - candidate.rect.y - candidate.rect.height) * scale,
                            width: candidate.rect.width * scale,
                            height: candidate.rect.height * scale,
                          }}
                        />
                      ))}
                  </div>
                )}
              </LivePagePreview>
            </div>
            <div className="flex items-center justify-center gap-2 lg:w-52 lg:flex-col">
              <span className="text-xs font-semibold text-slate-500">Preview page</span>
              <NumberInput
                value={previewPage}
                min={1}
                max={Math.max(1, pageCount)}
                onChange={(event) =>
                  setPreviewPage(Math.min(Math.max(1, Number(event.target.value)), Math.max(1, pageCount)))
                }
                className="w-24"
              />
              <span className="text-xs text-slate-400">of {pageCount}</span>
            </div>
          </div>
          {grouped.map(([type, items]) => {
            const allOn = items.every((c) => selected.has(c.id));
            return (
              <section key={type} aria-label={TYPE_LABELS[type]} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <Checkbox
                    label={`${TYPE_LABELS[type]} · ${items.length} found`}
                    checked={allOn}
                    onChange={(checked) => toggleType(type, checked)}
                  />
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {items.slice(0, 24).map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-pressed={selected.has(c.id)}
                        onClick={() => toggleCandidate(c)}
                        className={`min-h-8 rounded-full px-2 py-0.5 font-mono text-xs ${selected.has(c.id) ? "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200" : "bg-slate-100 text-slate-500 line-through dark:bg-slate-800"}`}
                        title={`Page ${c.pageIndex + 1} · click to ${selected.has(c.id) ? "exclude" : "include"}`}
                      >
                        {c.value.length > 18 ? `${c.value.slice(0, 15)}…` : c.value} · p.{c.pageIndex + 1}
                      </button>
                    </li>
                  ))}
                  {items.length > 24 ? <li className="px-2 py-0.5 text-xs text-slate-400">+{items.length - 24} more</li> : null}
                </ul>
              </section>
            );
          })}

          <Button onClick={handleRedact} disabled={op.isProcessing || selected.size === 0}>
            Redact {selected.size} selected finding{selected.size === 1 ? "" : "s"} & download
          </Button>

          {verification ? (
            verification.passed ? (
              <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                ✓ Verification passed: none of the {new Set(selected).size} selected values remain in extractable text.
              </p>
            ) : (
              <p role="alert" className="rounded-lg border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
                ⚠ Leftover values detected: {verification.leftovers.join(", ")}
              </p>
            )
          ) : null}
        </>
      ) : null}

      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Redacting" /> : null}
      {op.status === "success" && op.result && op.result.length > 0 ? (
        <DownloadResult
          toolId="auto-redact-pii"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
            setCandidates(null);
          }}
        />
      ) : null}
    </div>
  );
}

function dpiFor(pageWidthPt: number): number {
  void pageWidthPt;
  return 165 / 72;
}
