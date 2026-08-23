"use client";

import { useState } from "react";
import {
  Button,
  DownloadResult,
  ErrorAlert,
  FileDropzone,
  PageGrid,
  ProcessingProgress,
  descriptorsFromPages,
  useFileDocuments,
  useOperation,
  type GridPage,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { runOrganize } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

export function OrganizeClient({ allowDelete = true, allowDuplicate = true, toolId = "organize-pdf", label = "Applying changes" }: { allowDelete?: boolean; allowDuplicate?: boolean; toolId?: string; label?: string }) {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [pages, setPages] = useState<GridPage[]>([]);

  const file = docs.readyEntries[0]?.file;

  const handleApply = () => {
    void op.start(async (signal, onProgress) => {
      const outcome = await runOrganize(getWorkerRunner(), file!, descriptorsFromPages(pages), {
        signal,
        onProgress,
      });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · previews render locally"
        disabled={op.isProcessing}
        onFiles={(files) => {
          op.reset();
          setPages([]);
          void docs.addFiles(files);
        }}
        onError={() => undefined}
      />

      {file ? (
        <>
          <PageGrid file={file} onChange={setPages} allowDelete={allowDelete} allowDuplicate={allowDuplicate} />
          <Button onClick={handleApply} disabled={op.isProcessing || pages.length === 0}>
            Apply changes & download ({pages.length} pages)
          </Button>
        </>
      ) : null}

      {op.isProcessing ? (
        <ProcessingProgress progress={op.progress} onCancel={op.cancel} label={label} />
      ) : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId={toolId}
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
            setPages([]);
          }}
        />
      ) : null}
    </div>
  );
}
