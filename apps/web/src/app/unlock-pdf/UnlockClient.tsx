"use client";

import { useEffect, useState } from "react";
import {
  Button,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  ProcessingProgress,
  TextInput,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import type { ResultFile } from "@paperzero/pdf-ui";
import { inspectEncryption, runStripRestrictions } from "@paperzero/pdf-security";
import { getWorkerRunner } from "@/lib/worker-runner";

export function UnlockClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);

  const file = docs.readyEntries[0]?.file;

  useEffect(() => {
    let active = true;
    if (!file) {
      setStatus(null);
      setNeedsPassword(false);
      return () => {
        active = false;
      };
    }
    setStatus("checking");
    void (async () => {
      try {
        const bytes = await file.asUint8Array();
        const info = await inspectEncryption(bytes.slice());
        if (!active) return;
        if (info.status === "plain") {
          setStatus("plain");
          setNeedsPassword(false);
        } else {
          setNeedsPassword(true);
          setStatus("locked");
        }
      } catch {
        if (active) setStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [file]);

  useEffect(() => {
    if (op.status === "success") setPassword("");
  }, [op.status]);

  const handleUnlock = () => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      const outcome = await runStripRestrictions(
        getWorkerRunner(),
        file,
        needsPassword && password ? password : undefined,
        { signal, onProgress }
      );
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <strong>Processed locally in your browser.</strong>{" "}
        This tool removes <strong>permission restrictions</strong> (blocked printing/copying/editing
        flags) from documents you are authorized to modify. If the file itself requires a password to
        open, you will be asked for it — NGPDFs never cracks unknown passwords.
        Rebuilding a signed PDF normally invalidates its existing cryptographic signatures.
      </p>

      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a restricted PDF or drop it here"
        hint="One PDF · rebuilt locally without permission flags"
        disabled={op.isProcessing}
        onFiles={(files) => {
          op.reset();
          setStatus(null);
          setNeedsPassword(false);
          setPassword("");
          void docs.addFiles(files);
        }}
        onError={() => undefined}
      />

      {status === "plain" ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Document opens freely — proceed to strip any permission flags.
        </p>
      ) : null}
      {status === "checking" ? (
        <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
          Checking document protection…
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          This document&rsquo;s protection status could not be read.
        </p>
      ) : null}
      {status === "locked" ? (
        <Field label="Opening password" htmlFor="ul-pw" hint="Required because this file cannot open without it.">
          <TextInput
            id="ul-pw"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      ) : null}

      {file ? (
        <Button onClick={handleUnlock} disabled={op.isProcessing || status === "checking" || status === "error" || (needsPassword && !password)}>
          Unlock & download
        </Button>
      ) : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Unlocking" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result && op.result.length > 0 ? (
        <DownloadResult
          toolId="unlock-pdf"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => {
            op.reset();
            docs.clearAll();
            setStatus(null);
            setPassword("");
          }}
        />
      ) : null}
    </div>
  );
}
