"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  DownloadResult,
  ErrorAlert,
  FileDropzone,
  ProcessingProgress,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import type { ResultFile } from "@paperzero/pdf-ui";
import { analyzePrivacy, runSanitize, type PrivacyReport, type FindingSeverity } from "@paperzero/pdf-security";
import { getWorkerRunner } from "@/lib/worker-runner";
import { PaperZeroError, toPaperZeroError } from "@paperzero/shared";

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  info: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const REMOVABLE_DEFAULT_ON = new Set([
  "author",
  "subject",
  "keywords",
  "creator",
  "producer",
  "created",
  "modified",
  "title",
  "xmp",
  "javascript",
  "attachments",
  "annotations",
  "forms",
  "signature-fields",
]);

const SAFE_METADATA_IDS = new Set([
  "author",
  "subject",
  "keywords",
  "creator",
  "producer",
  "created",
  "modified",
  "title",
  "xmp",
]);

function sanitizeOptionsFor(selected: Set<string>): Parameters<typeof runSanitize>[2] {
  return {
    clearInfo: [...SAFE_METADATA_IDS].some((id) => id !== "xmp" && selected.has(id)),
    removeXmp: selected.has("xmp"),
    removeJavascript: selected.has("javascript"),
    removeAttachments: selected.has("attachments"),
    removeAnnotations: selected.has("annotations"),
    flattenForms: selected.has("forms") || selected.has("signature-fields"),
  };
}

export function PrivacyScannerClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [report, setReport] = useState<PrivacyReport | null>(null);
  const [afterReport, setAfterReport] = useState<PrivacyReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanError, setScanError] = useState<PaperZeroError | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const file = docs.readyEntries[0]?.file;

  const handleScan = () => {
    if (!file) return;
    setAnalyzing(true);
    setReport(null);
    setAfterReport(null);
    setScanError(null);
    void (async () => {
      try {
        const bytes = await file.asUint8Array();
        const nextReport = await analyzePrivacy(bytes.slice());
        setReport(nextReport);
        setSelected(
          new Set(
            nextReport.findings
              .filter((finding) => REMOVABLE_DEFAULT_ON.has(finding.id))
              .map((finding) => finding.id)
          )
        );
      } catch (error) {
        setScanError(toPaperZeroError(error));
      } finally {
        setAnalyzing(false);
      }
    })();
  };

  const handleClean = (ids = selected) => {
    if (!file || !report) return;
    void op.start(async (signal, onProgress) => {
      const outcome = await runSanitize(getWorkerRunner(), file, sanitizeOptionsFor(ids), { signal, onProgress });
      const cleanedBytes = await outcome.files[0]!.blob.arrayBuffer();
      try {
        setAfterReport(await analyzePrivacy(new Uint8Array(cleanedBytes)));
      } catch {
        setAfterReport(null);
      }
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <strong>Processed locally in your browser.</strong> Supported inspection covers the Info
        dictionary, XMP presence, common JavaScript/actions, name-tree attachments, annotations,
        external links, AcroForm/signature fields, and best-effort JPEG EXIF/GPS. It does not claim
        to prove deleted content, revision history, hidden layers, thumbnails, exotic action chains,
        or metadata in every image encoding.
      </p>
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · scanned locally, nothing uploaded"
        disabled={op.isProcessing || analyzing}
        onFiles={(files) => {
          op.reset();
          setReport(null);
          setAfterReport(null);
          setSelected(new Set());
          setScanError(null);
          void docs.addFiles(files);
        }}
        onError={() => undefined}
      />

      {file ? (
        <Button onClick={handleScan} disabled={analyzing}>
          {report ? "Re-scan document" : "Scan for privacy risks"}
        </Button>
      ) : null}

      {analyzing ? <ProcessingProgress progress={{ phase: "scanning", message: "Inspecting structure & metadata…" }} label="Scanning" /> : null}
      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Cleaning" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {scanError ? <ErrorAlert error={scanError} onRetry={() => setScanError(null)} /> : null}

      {report ? (
        <>
          <section aria-label="Privacy score" className="rounded-xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Privacy score</p>
            <p
              className={`mt-1 text-5xl font-black tabular-nums ${
                report.score >= 80 ? "text-emerald-600" : report.score >= 50 ? "text-amber-500" : "text-red-600"
              }`}
              role="status"
            >
              {report.score}
              <span className="text-xl font-semibold text-slate-400"> / 100</span>
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={`h-full rounded-full ${report.score >= 80 ? "bg-emerald-500" : report.score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${report.score}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {report.pageCount} page{report.pageCount === 1 ? "" : "s"} ·{" "}
              {report.findings.length === 0
                ? "no risks found"
                : `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"}`}
            </p>
          </section>

          {report.findings.length > 0 ? (
            <>
              <section aria-label="Findings">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Found</h2>
                <ul className="flex flex-col gap-2">
                  {report.findings.map((finding) => (
                    <li key={finding.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                      {REMOVABLE_DEFAULT_ON.has(finding.id) ? (
                        <Checkbox
                          label="Include"
                          checked={selected.has(finding.id)}
                          onChange={(checked) =>
                            setSelected((previous) => {
                              const next = new Set(previous);
                              if (checked) next.add(finding.id);
                              else next.delete(finding.id);
                              return next;
                            })
                          }
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{finding.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{finding.detail}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                          {finding.category} · {finding.location ?? "Document"} · Can remove: {finding.canRemove}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_STYLES[finding.severity]}`}>
                        {finding.severity}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => handleClean()} disabled={op.isProcessing || selected.size === 0}>
                  Clean {selected.size} selected finding{selected.size === 1 ? "" : "s"} & download
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleClean(new Set(report.findings.filter((finding) => SAFE_METADATA_IDS.has(finding.id)).map((finding) => finding.id)))}
                  disabled={op.isProcessing || !report.findings.some((finding) => SAFE_METADATA_IDS.has(finding.id))}
                >
                  Clean safe metadata only
                </Button>
              </div>

              {afterReport ? (
                <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                  ✓ Re-scan of the cleaned file: score improved {report.score} → {afterReport.score}.
                </p>
              ) : null}
            </>
          ) : (
            <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              This document looks clean — no removable privacy risks were detected.
            </p>
          )}
        </>
      ) : null}

      {op.status === "success" && op.result && op.result.length > 0 ? (
        <DownloadResult
          toolId="privacy-scanner"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
            setReport(null);
            setAfterReport(null);
            setSelected(new Set());
          }}
        />
      ) : null}
    </div>
  );
}
