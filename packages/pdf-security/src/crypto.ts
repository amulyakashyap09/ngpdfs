import { PDFDocument, EncryptedPDFError } from "@cantoo/pdf-lib";
import { PaperZeroError } from "@paperzero/shared";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { OpProgressContext, NamedBytes } from "./internal";
import { toExactBytes } from "./internal";


export type EncryptionStatus = "plain" | "password-protected";

export interface UserPermissions {
  printing?: boolean | "lowResolution" | "highResolution";
  modifying?: boolean;
  copying?: boolean;
  annotating?: boolean;
  fillingForms?: boolean;
  contentAccessibility?: boolean;
  documentAssembly?: boolean;
}

export interface EncryptionInfo {
  status: EncryptionStatus;
}

async function loadOrThrow(bytes: Uint8Array, password?: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, {
      password,
      updateMetadata: false,
      throwOnInvalidObject: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/password/i.test(message) && password) {
      throw new PaperZeroError(
        "WRONG_PASSWORD",
        "That password did not unlock this document. Check it and try again.",
        message
      );
    }
    if (error instanceof EncryptedPDFError || /encrypted/i.test(message)) {
      throw new PaperZeroError(
        password ? "WRONG_PASSWORD" : "ENCRYPTED_PDF",
        password
          ? "That password did not unlock this document. Check it and try again."
          : "This PDF is password protected. Enter the password you use to open it.",
        message
      );
    }
    if (/xref|parse|Invalid object|malformed/i.test(message)) {
      throw new PaperZeroError("FILE_CORRUPT", "This PDF appears to be damaged.", message);
    }
    throw new PaperZeroError("UNKNOWN", undefined, message);
  }
}

export async function inspectEncryption(bytes: Uint8Array): Promise<EncryptionInfo> {
  try {
    await PDFDocument.load(bytes, { updateMetadata: false });
    return { status: "plain" };
  } catch (error) {
    if (/encrypted/i.test(error instanceof Error ? error.message : String(error))) {
      return { status: "password-protected" };
    }
    throw new PaperZeroError("FILE_CORRUPT", "This PDF could not be parsed.");
  }
}

export interface EncryptOptionsPayload {
  userPassword: string;
  ownerPassword?: string;
  permissions?: UserPermissions;
}

function hasSignatureFields(doc: PDFDocument): boolean {
  try {
    return doc.getForm().getFields().some((field) => field.constructor.name === "PDFSignature");
  } catch {
    return false;
  }
}

async function verifyEncryptedOutput(bytes: Uint8Array, password: string): Promise<void> {
  try {
    const check = await PDFDocument.load(bytes, { password, updateMetadata: false });
    void check;
  } catch (error) {
    throw new PaperZeroError(
      "OUTPUT_INVALID",
      "The encrypted file failed verification. Nothing was saved - please retry.",
      error instanceof Error ? error.message : undefined
    );
  }
}

export async function encryptPdf(
  bytes: Uint8Array,
  options: EncryptOptionsPayload,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  const user = options.userPassword;
  if (!user || user.length < 4) {
    throw new PaperZeroError("INVALID_INPUT", "Choose a password of at least 4 characters.");
  }
  if (!/[a-zA-Z]/.test(user) || !/\d/.test(user)) {
    throw new PaperZeroError("INVALID_INPUT", "Use a mix of letters and numbers in the password.");
  }

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof EncryptedPDFError || /encrypted|password/i.test(message)) {
      throw new PaperZeroError(
        "ENCRYPTED_PDF",
        "This PDF is already protected. Remove its current password before applying new encryption.",
        message
      );
    }
    throw new PaperZeroError("FILE_CORRUPT", "This PDF could not be parsed.", message);
  }
  const hadSignatures = hasSignatureFields(doc);
  ctx.throwIfCancelled?.();

  ctx.progress?.({ phase: "encrypting", message: "Applying AES-256 encryption" });
  doc.encrypt({
    userPassword: user,
    ownerPassword:
      options.ownerPassword && options.ownerPassword.length > 0 ? options.ownerPassword : user,
    permissions: options.permissions,
    algorithm: "AES-256",
  });

  const outBytes = toExactBytes(await doc.save());
  ctx.progress?.({ phase: "validating", message: "Verifying encrypted output" });
  await verifyEncryptedOutput(outBytes, user);

  return {
    files: [{ name: "encrypted.pdf", bytes: outBytes }],
    warnings: [
      "Encrypted with AES-256, the algorithm ISO 32000-2 recommends. The password cannot be recovered if lost.",
      ...(hadSignatures
        ? ["This input contains signature fields. Re-encrypting the bytes normally invalidates existing cryptographic signatures."]
        : []),
    ],
  };
}

export async function decryptToPlainCopy(
  bytes: Uint8Array,
  password: string,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  if (!password) {
    throw new PaperZeroError("PASSWORD_REQUIRED", "Enter the document password to remove it.");
  }
  ctx.progress?.({ phase: "unlocking", message: "Decrypting with your password" });
  const opened = await loadOrThrow(bytes, password);
  const hadSignatures = hasSignatureFields(opened);
  ctx.throwIfCancelled?.();

  ctx.progress?.({ phase: "rebuilding", message: "Rebuilding an unencrypted copy" });
  const clean = await PDFDocument.create();
  const copied = await clean.copyPages(opened, opened.getPageIndices());
  for (const page of copied) clean.addPage(page);
  clean.setProducer("PaperZero");

  const outBytes = toExactBytes(await clean.save());
  await validateOutputPdf(outBytes, { expectedPageCount: opened.getPageCount() });

  return {
    files: [{ name: "password-removed.pdf", bytes: outBytes }],
    warnings: [
      "Decrypted entirely on this device; the password was never sent anywhere.",
      "Only remove protection from documents you are authorized to modify.",
      ...(hadSignatures
        ? ["This input contains signature fields. Removing encryption normally invalidates existing cryptographic signatures."]
        : []),
    ],
  };
}

export async function stripRestrictions(
  bytes: Uint8Array,
  password: string | undefined,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  ctx.progress?.({
    phase: "opening",
    message: password ? "Unlocking with your password" : "Opening document",
  });
  const opened = await loadOrThrow(bytes, password || undefined);
  const hadSignatures = hasSignatureFields(opened);
  ctx.throwIfCancelled?.();

  ctx.progress?.({ phase: "stripping", message: "Removing permission restrictions" });
  const clean = await PDFDocument.create();
  const copied = await clean.copyPages(opened, opened.getPageIndices());
  for (const page of copied) clean.addPage(page);
  clean.setProducer("PaperZero");

  const outBytes = toExactBytes(await clean.save());
  await validateOutputPdf(outBytes, { expectedPageCount: opened.getPageCount() });

  return {
    files: [{ name: "unrestricted.pdf", bytes: outBytes }],
    warnings: [
      "Permission flags were removed by rebuilding the document without its security handler.",
      "Use only with documents you are authorized to modify.",
      ...(hadSignatures
        ? ["This input contains signature fields. Rebuilding it normally invalidates existing cryptographic signatures."]
        : []),
    ],
  };
}
