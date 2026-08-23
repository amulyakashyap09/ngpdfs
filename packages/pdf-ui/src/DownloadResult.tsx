"use client";

import { useState } from "react";
import { formatBytes } from "@paperzero/shared";
import { triggerDownload } from "@paperzero/pdf-core";
import { zipBlobs, type ZipEntry } from "@paperzero/pdf-operations";
import { Button } from "./primitives";
import { WarningsList } from "./ErrorAlert";

export interface ResultFile {
  name: string;
  blob: Blob;
}

export interface DownloadResultProps {
  files: ResultFile[];
  warnings?: string[];
  onStartOver?: () => void;
  toolId: string;
}

export function DownloadResult({ files, warnings = [], onStartOver, toolId }: DownloadResultProps) {
  const [zipping, setZipping] = useState(false);
  if (files.length === 0) return null;

  const totalBytes = files.reduce((sum, f) => sum + f.blob.size, 0);

  const downloadSingle = (file: ResultFile) => {
    trackDownload();
    triggerDownload({ blob: file.blob, filename: file.name });
  };

  const downloadZip = async () => {
    setZipping(true);
    try {
      trackDownload();
      const entries: ZipEntry[] = files.map((f) => ({ name: f.name, blob: f.blob }));
      const zip = await zipBlobs(entries);
      const baseName = files[0]!.name.replace(/\.[^.]+$/, "");
      triggerDownload({ blob: zip, filename: `${baseName}-files.zip` });
    } finally {
      setZipping(false);
    }
  };

  const trackDownload = () => {
    void toolId;
  };

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-700 dark:bg-emerald-950/40"
    >
      <div className="flex items-start gap-3">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Done — your file is ready</h3>
          <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
            {files.length === 1
              ? `${files[0]!.name} · ${formatBytes(files[0]!.blob.size)}`
              : `${files.length} files · ${formatBytes(totalBytes)} total`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {files.length === 1 ? (
              <Button onClick={() => downloadSingle(files[0]!)}>Download</Button>
            ) : (
              <Button onClick={downloadZip} disabled={zipping}>
                {zipping ? "Packaging…" : `Download all (${files.length})`}
              </Button>
            )}
            {onStartOver ? (
              <Button variant="secondary" onClick={onStartOver}>
                Start over
              </Button>
            ) : null}
          </div>
          {files.length > 1 ? (
            <details className="mt-3 text-xs text-emerald-800 dark:text-emerald-200">
              <summary className="cursor-pointer font-medium">Show individual files</summary>
              <ul className="mt-2 space-y-1">
                {files.map((file) => (
                  <li key={file.name} className="flex items-center justify-between gap-2">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => downloadSingle(file)}
                      className="min-h-[32px] rounded px-2 font-medium underline hover:no-underline"
                    >
                      Save
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </div>
      {warnings.length > 0 ? (
        <div className="mt-4">
          <WarningsList warnings={warnings} />
        </div>
      ) : null}
    </section>
  );
}
