"use client";

import { useEffect, useRef, useState } from "react";
import { loadPdfDocument, renderPageToCanvas } from "@paperzero/pdf-core";
import type { LocalDocumentFile } from "@paperzero/pdf-core";

export interface PageThumbnailProps {
  file: LocalDocumentFile;
  pageNumber: number;
  width?: number;
  className?: string;
}

export function PageThumbnail({ file, pageNumber, width = 150, className = "" }: PageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || rendered || failed) return;
    let cancelled = false;
    (async () => {
      try {
        const pdf = await loadPdfDocument(file);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        await renderPageToCanvas(pdf, pageNumber, {
          canvas,
          targetWidthCss: width,
          devicePixelRatioCap: 1.5,
        });
        if (!cancelled) setRendered(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, rendered, failed, file, pageNumber, width]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Page ${pageNumber} preview`}
        className="w-full rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700"
      />
      {!rendered && !failed ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
        />
      ) : null}
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Preview unavailable
        </div>
      ) : null}
      <span className="mt-1 block text-center text-xs font-medium text-slate-600 dark:text-slate-300">
        {pageNumber}
      </span>
    </div>
  );
}
