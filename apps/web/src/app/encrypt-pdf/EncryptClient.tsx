"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
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
import { runEncrypt } from "@paperzero/pdf-security";
import { getWorkerRunner } from "@/lib/worker-runner";

type PermissionKey = "printing" | "copying" | "modifying" | "annotating";

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  printing: "Allow printing",
  copying: "Allow copying text",
  modifying: "Allow content changes",
  annotating: "Allow comments",
};

export function EncryptClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [separateOwnerPassword, setSeparateOwnerPassword] = useState(false);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>({
    printing: true,
    copying: false,
    modifying: false,
    annotating: true,
  });

  const file = docs.readyEntries[0]?.file;
  const strength =
    password.length >= 12 && /[a-zA-Z]/.test(password) && /\d/.test(password) && /[^a-zA-Z0-9]/.test(password)
      ? "Strong"
      : password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password)
        ? "Good"
        : password.length >= 4
          ? "Weak"
          : "";

  const handleEncrypt = () => {
    if (!file) return;
    if (password !== confirm) {
      op.start(async () => ({ data: [], warnings: [] }));
      setPasswordError("Passwords do not match.");
      return;
    }
    setPasswordError(null);
    void op.start(async (signal, onProgress) => {
      const outcome = await runEncrypt(
        getWorkerRunner(),
        file,
        {
          userPassword: password,
          ownerPassword: separateOwnerPassword ? ownerPassword : undefined,
          permissions: {
            printing: permissions.printing ? "highResolution" : false,
            copying: permissions.copying,
            modifying: permissions.modifying,
            annotating: permissions.annotating,
          },
        },
        { signal, onProgress }
      );
      setPassword("");
      setConfirm("");
      setOwnerPassword("");
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  const [passwordError, setPasswordError] = useState<string | null>(null);

  const resetAll = () => {
    op.reset();
    docs.clearAll();
    setPassword("");
    setConfirm("");
    setOwnerPassword("");
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <strong>Processed locally in your browser.</strong>{" "}
        Encrypted with <strong>AES-256</strong>, the algorithm ISO 32000-2 recommends. Your password
        is used only inside this browser tab — it is never sent anywhere or stored. Re-encrypting a
        signed PDF normally invalidates its existing cryptographic signatures.
      </p>

      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · encrypted locally"
        disabled={op.isProcessing}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />

      {file ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password (min 4 chars)" htmlFor="enc-pw">
              <div className="flex gap-2">
                <TextInput
                  id="enc-pw"
                  type={showPw ? "text" : "password"}
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button variant="secondary" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? "Hide" : "Show"}
                </Button>
              </div>
              {strength ? (
                <p className={`mt-1 text-xs ${strength === "Strong" ? "text-emerald-600" : strength === "Good" ? "text-blue-600" : "text-amber-600"}`} role="status">
                  Strength: {strength}
                </p>
              ) : null}
            </Field>
            <Field label="Confirm password" htmlFor="enc-pw2">
              <TextInput
                id="enc-pw2"
                type={showPw ? "text" : "password"}
                value={confirm}
                autoComplete="new-password"
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          </div>

          {passwordError ? (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{passwordError}</p>
          ) : null}

          <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Reader permissions (best-effort per viewer)</legend>
            <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
              {(Object.keys(PERMISSION_LABELS) as PermissionKey[]).map((key) => (
                <Checkbox
                  key={key}
                  label={PERMISSION_LABELS[key]}
                  checked={permissions[key]}
                  onChange={(checked) => setPermissions((prev) => ({ ...prev, [key]: checked }))}
                />
              ))}
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
              <Checkbox
                label="Use a separate owner password"
                checked={separateOwnerPassword}
                onChange={(checked) => {
                  setSeparateOwnerPassword(checked);
                  if (!checked) setOwnerPassword("");
                }}
              />
              {separateOwnerPassword ? (
                <Field
                  label="Owner password"
                  htmlFor="enc-owner-pw"
                  hint="Used to manage permission flags; keep it different from the open password."
                >
                  <TextInput
                    id="enc-owner-pw"
                    type={showPw ? "text" : "password"}
                    value={ownerPassword}
                    autoComplete="new-password"
                    onChange={(e) => setOwnerPassword(e.target.value)}
                  />
                </Field>
              ) : null}
            </div>
          </fieldset>

          <Button
            onClick={handleEncrypt}
            disabled={
              op.isProcessing ||
              password.length < 4 ||
              password !== confirm ||
              (separateOwnerPassword && ownerPassword.length < 4)
            }
          >
            Encrypt PDF & download
          </Button>
        </>
      ) : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Encrypting" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result && op.result.length > 0 ? (
        <DownloadResult
          toolId="encrypt-pdf"
          files={op.result}
          warnings={[...op.warnings]}
          onStartOver={resetAll}
        />
      ) : null}
    </div>
  );
}
