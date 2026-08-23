"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  NumberInput,
  PageThumbnail,
  ProcessingProgress,
  SelectInput,
  TextInput,
  useFileDocuments,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { everyNPages, parsePageRanges, parseSelectedPages, singlePageSegments, PaperZeroError } from "@paperzero/shared";
import { runSplit } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

type Mode = "selected" | "ranges" | "every-page" | "every-n";

export function SplitClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [mode, setMode] = useState<Mode>("ranges");
  const [rangesText, setRangesText] = useState("1-3");
  const [chunkSize, setChunkSize] = useState(2);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const file = docs.readyEntries[0]?.file;

  const resolveSegments = (): ReturnType<typeof parsePageRanges>["segments"] => {
    if (!file || pageCount === null) throw new PaperZeroError("INVALID_INPUT", "Select a PDF first.");
    switch (mode) {
      case "every-page":
        return singlePageSegments(pageCount);
      case "every-n":
        return everyNPages(pageCount, chunkSize);
      case "selected": {
        if (selectedPages.length === 0) {
          throw new PaperZeroError("INVALID_INPUT", "Select at least one page from the grid.");
        }
        return parseSelectedPages(selectedPages, pageCount);
      }
      case "ranges":
      default:
        return parsePageRanges(rangesText, pageCount).segments;
    }
  };

  const handleSplit = () => {
    setRangeError(null);
    void op.start(async (signal, onProgress) => {
      let segments;
      try {
        segments = resolveSegments();
      } catch (error) {
        const message = error instanceof PaperZeroError ? error.userMessage : "Invalid page selection.";
        setRangeError(message);
        throw error;
      }
      const outcome = await runSplit(getWorkerRunner(), file!, segments, { signal, onProgress });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · processed locally"
        disabled={op.isProcessing}
        onFiles={(files) => {
          setSelectedPages([]);
          setPageCount(null);
          void docs.addFiles(files).then(() => {
            void (async () => {
              const entry = docs.entries[docs.entries.length - 1];
              if (!entry) return;
              try {
                const { loadPdfDocument } = await import("@paperzero/pdf-core");
                const pdf = await loadPdfDocument(entry.file);
                setPageCount(pdf.numPages);
              } catch {
                setPageCount(null);
              }
            })();
          });
        }}
        onError={() => undefined}
      />

      {docs.entries.length > 0 ? (
        <Field label="Split mode" htmlFor="split-mode">
          <SelectInput
            id="split-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
          >
            <option value="ranges">Extract page ranges</option>
            <option value="selected">Extract selected pages</option>
            <option value="every-page">Split every page</option>
            <option value="every-n">Split every N pages</option>
          </SelectInput>
        </Field>
      ) : null}

      {mode === "ranges" ? (
        <div className="flex flex-col gap-1">
          <Field label="Page ranges" htmlFor="ranges" hint='Example: 1-3,5,8-12'>
            <TextInput
              id="ranges"
              value={rangesText}
              onChange={(e) => setRangesText(e.target.value)}
              placeholder="1-3,5,8-12"
            />
          </Field>
        </div>
      ) : null}

      {mode === "every-n" ? (
        <Field label="Pages per file" htmlFor="chunk-size">
          <NumberInput
            id="chunk-size"
            min={1}
            max={Math.max(1, pageCount ?? 9999)}
            value={chunkSize}
            onChange={(e) => setChunkSize(Math.max(1, Number(e.target.value)))}
          />
        </Field>
      ) : null}

      {mode === "selected" && file && pageCount ? (
        <section aria-label="Select pages">
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-300" role="status">
            {selectedPages.length} of {pageCount} pages selected
          </p>
          <ol className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNumber) => (
              <li key={pageNumber}>
                <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Checkbox
                    label={`Page ${pageNumber}`}
                    checked={selectedPages.includes(pageNumber)}
                    onChange={(checked) =>
                      setSelectedPages((prev) =>
                        checked ? [...prev, pageNumber] : prev.filter((p) => p !== pageNumber)
                      )
                    }
                  />
                  <PageThumbnail file={file} pageNumber={pageNumber} width={120} className="w-full" />
                </label>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {rangeError ? <ErrorAlert error={new PaperZeroError("INVALID_INPUT", rangeError)} /> : null}

      {file ? (
        <Button onClick={handleSplit} disabled={op.isProcessing}>
          Split PDF
        </Button>
      ) : null}

      {op.isProcessing ? (
        <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Splitting" />
      ) : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId="split-pdf"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
            setPageCount(null);
            setSelectedPages([]);
          }}
        />
      ) : null}
    </div>
  );
}
