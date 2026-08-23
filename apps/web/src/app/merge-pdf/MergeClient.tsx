"use client";

import {
  Button,
  DownloadResult,
  ErrorAlert,
  FileCardList,
  FileDropzone,
  ProcessingProgress,
  useFileDocuments,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { runMerge } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

export function MergeClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();

  const canMerge = docs.readyEntries.length >= 2;

  const handleMerge = () => {
    const files = docs.readyEntries.map((entry) => entry.file);
    void op.start(async (signal, onProgress) => {
      const outcome = await runMerge(getWorkerRunner(), files, { signal, onProgress });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        multiple
        label="Choose PDF files or drop them here"
        hint="Select 2 or more PDFs · processed locally"
        disabled={op.isProcessing}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />
      <FileCardList
        entries={docs.entries}
        reorderable
        onRemove={docs.removeEntry}
        onMove={docs.moveEntry}
      />
      {canMerge && !op.isProcessing && op.status !== "success" ? (
        <Button onClick={handleMerge}>Merge {docs.readyEntries.length} PDFs</Button>
      ) : null}
      {op.isProcessing ? (
        <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Merging PDFs" />
      ) : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId="merge-pdf"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
          }}
        />
      ) : null}
    </div>
  );
}
