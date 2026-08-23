"use client";

import { useCallback, useRef, useState } from "react";
import { PaperZeroError, formatBytes } from "@paperzero/shared";
import { LocalDocumentFile, validatePdfFile, loadPdfDocument, renderPageToCanvas } from "@paperzero/pdf-core";
import { disposeCanvas } from "@paperzero/shared";
import type { ImageKind } from "@paperzero/pdf-core";
import { sniffImageType } from "@paperzero/pdf-core";

export interface DocumentEntry {
  id: string;
  file: LocalDocumentFile;
  name: string;
  size: number;
  kind: "pdf" | "image";
  imageKind?: ImageKind;
  status: "validating" | "ready" | "error";
  error?: string;
  thumbUrl?: string;
  pageCount?: number;
}

export interface UseFileDocumentsResult {
  entries: DocumentEntry[];
  addFiles: (files: File[]) => Promise<void>;
  removeEntry: (id: string) => void;
  moveEntry: (fromIndex: number, toIndex: number) => void;
  clearAll: () => void;
  readyEntries: DocumentEntry[];
  isBusy: boolean;
}

async function generateThumbnail(file: LocalDocumentFile): Promise<{ url?: string; pageCount?: number }> {
  try {
    const pdf = await loadPdfDocument(file);
    const rendered = await renderPageToCanvas(pdf, 1, { targetWidthCss: 120, devicePixelRatioCap: 1 });
    const url = rendered.canvas.toDataURL("image/jpeg", 0.6);
    disposeCanvas(rendered.canvas);
    return { url, pageCount: pdf.numPages };
  } catch {
    return {};
  }
}

async function imagePreviewUrl(file: LocalDocumentFile): Promise<string | undefined> {
  try {
    const blob = file.asBlob();
    return URL.createObjectURL(blob);
  } catch {
    return undefined;
  }
}

export function useFileDocuments(mode: "pdf" | "image"): UseFileDocumentsResult {
  const [entries, setEntries] = useState<DocumentEntry[]>([]);
  const [isBusy, setBusy] = useState(false);
  const urlsRef = useRef<string[]>([]);

  const addFiles = useCallback(
    async (files: File[]) => {
      setBusy(true);
      for (const f of files) {
        const doc = new LocalDocumentFile(f);
        const entryId = doc.id;
        const entry: DocumentEntry = {
          id: entryId,
          file: doc,
          name: doc.meta.name,
          size: doc.meta.size,
          kind: mode === "pdf" ? "pdf" : "image",
          status: "validating",
        };
        setEntries((prev) => [...prev, entry]);
        try {
          if (mode === "pdf") {
            await validatePdfFile(doc);
            const { url, pageCount } = await generateThumbnail(doc);
            setEntries((prev) =>
              prev.map((e) =>
                e.id === entryId
                  ? { ...e, status: "ready", thumbUrl: url, pageCount }
                  : e
              )
            );
          } else {
            const kind = await sniffImageType(f);
            const url = await imagePreviewUrl(doc);
            if (url) urlsRef.current.push(url);
            setEntries((prev) =>
              prev.map((e) =>
                e.id === entryId ? { ...e, status: "ready", imageKind: kind, thumbUrl: url } : e
              )
            );
          }
        } catch (error) {
          const message =
            error instanceof PaperZeroError
              ? error.userMessage
              : "This file could not be validated.";
          setEntries((prev) =>
            prev.map((e) => (e.id === entryId ? { ...e, status: "error", error: message } : e))
          );
        }
      }
      setBusy(false);
    },
    [mode]
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const target = prev.find((e) => e.id === id);
      target?.file.dispose();
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const moveEntry = useCallback((fromIndex: number, toIndex: number) => {
    setEntries((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item!);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setEntries((prev) => {
      for (const entry of prev) entry.file.dispose();
      return [];
    });
  }, []);

  return {
    entries,
    addFiles,
    removeEntry,
    moveEntry,
    clearAll,
    readyEntries: entries.filter((e) => e.status === "ready"),
    isBusy,
  };
}

export { formatBytes };
