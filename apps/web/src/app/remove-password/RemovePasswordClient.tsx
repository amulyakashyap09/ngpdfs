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
import { runDecryptStrip } from "@paperzero/pdf-security";
import { getWorkerRunner } from "@/lib/worker-runner";

export function RemovePasswordClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const file = docs.readyEntries[0]?.file;

  const handleRemove = () => {
    if (!file || !password) return;
    void op.start(async (signal, onProgress) => {
      const outcome = await runDecryptStrip(getWorkerRunner(), file, password, { signal, onProgress });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <strong>Processed locally in your browser.</strong>{" "}
        You must know the document password — NGPDFs does not crack passwords. Decryption
        happens entirely on this device and the password is never sent anywhere or stored.
        Removing protection from a signed PDF normally invalidates its existing cryptographic signatures.
      </p>

      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a protected PDF or drop it here"
        hint="One PDF · unlocked locally with your password"
        disabled={op.isProcessing}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />

      {file ? (
        <>
          <Field label="Document password" htmlFor="rp-pw">
            <div className="flex gap-2">
              <TextInput
                id="rp-pw"
                type={showPw ? "text" : "password"}
                value={password}
                autoComplete="off"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRemove()}
              />
              <Button variant="secondary" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? "Hide" : "Show"}
              </Button>
            </div>
          </Field>
          <Button onClick={handleRemove} disabled={op.isProcessing || !password}>
            Remove password & download
          </Button>
        </>
      ) : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Decrypting" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result && op.result.length > 0 ? (
        <>
          <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
            ✓ Password removed. Clearing the field now.
          </p>
          <PasswordWipe trigger={op.status} onClear={() => setPassword("")} />

          <DownloadResult
            toolId="remove-password"
            files={op.result}
            warnings={op.warnings}
            onStartOver={() => {
              op.reset();
              docs.clearAll();
              setPassword("");
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function PasswordWipe({ trigger, onClear }: { trigger: string; onClear: () => void }) {
  useEffect(() => {
    if (trigger === "success") onClear();
  }, [trigger, onClear]);
  return null;
}
