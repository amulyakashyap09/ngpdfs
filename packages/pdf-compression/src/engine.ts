import loadGhostscript, {
  type GhostscriptModule,
} from "@okathira/ghostpdl-wasm";
import { validateOutputPdf } from "@paperzero/pdf-core";
import { PaperZeroError, type ProgressUpdate } from "@paperzero/shared";
import { analyzePdfForCompression } from "./analysis";
import { buildTargetProfiles, COMPRESSION_PRESETS, ghostscriptArgs } from "./presets";
import type {
  CompressionAttemptResult,
  CompressionOptions,
  CompressionProfile,
  CompressionWorkerResult,
} from "./types";

interface CompressionContext {
  progress?: (update: ProgressUpdate) => void;
  throwIfCancelled?: () => void;
}

let activeLogs: string[] | null = null;

function rememberLog(value: unknown): void {
  if (!activeLogs) return;
  const line = String(value).trim();
  if (!line) return;
  activeLogs.push(line.slice(0, 500));
  if (activeLogs.length > 40) activeLogs.shift();
}

async function getGhostscript(): Promise<GhostscriptModule> {
  try {
    return await loadGhostscript({
      print: rememberLog,
      printErr: rememberLog,
    });
  } catch (error) {
    throw new PaperZeroError(
      "WASM_LOAD_FAILED",
      "The local compression engine could not be loaded. Reload and try again.",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function safeUnlink(engine: GhostscriptModule, path: string): void {
  try {
    engine.FS.unlink(path);
  } catch {
    void 0;
  }
}

async function runAttempt(
  engine: GhostscriptModule,
  profile: CompressionProfile,
  inputPath: string,
  outputPath: string
): Promise<Uint8Array> {
  safeUnlink(engine, outputPath);
  activeLogs = [];
  try {
    const exitCode = engine.callMain(ghostscriptArgs(profile, inputPath, outputPath));
    if (exitCode !== 0) {
      throw new Error(`Ghostscript exited with status ${exitCode}.`);
    }
    const output = engine.FS.readFile(outputPath, { encoding: "binary" });
    return new Uint8Array(output).slice();
  } catch (error) {
    const logSummary = activeLogs.slice(-6).join(" | ");
    const message = `${error instanceof Error ? error.message : String(error)}${logSummary ? ` | ${logSummary}` : ""}`;
    if (/password|encrypted|invalidfileaccess/i.test(message)) {
      throw new PaperZeroError(
        "ENCRYPTED_PDF",
        "Ghostscript could not open this protected PDF. Remove its password first.",
        message
      );
    }
    throw new PaperZeroError(
      "WORKER_FAILED",
      "The local compression engine could not process this PDF. The original file is unchanged.",
      message
    );
  } finally {
    activeLogs = null;
    safeUnlink(engine, outputPath);
  }
}

function profilesFor(bytes: Uint8Array, options: CompressionOptions): CompressionProfile[] {
  if (options.targetBytes !== undefined) {
    return buildTargetProfiles(
      bytes.byteLength,
      options.targetBytes,
      options.maxAttempts ?? 4
    );
  }
  return [COMPRESSION_PRESETS[options.preset]];
}

export async function compressPdfWithGhostscript(
  bytes: Uint8Array,
  options: CompressionOptions,
  context: CompressionContext = {}
): Promise<CompressionWorkerResult> {
  if (bytes.byteLength === 0) {
    throw new PaperZeroError("INVALID_INPUT", "Choose a non-empty PDF to compress.");
  }
  if (options.targetBytes !== undefined && options.targetBytes < 20 * 1024) {
    throw new PaperZeroError("INVALID_INPUT", "Choose a target size of at least 20 KB.");
  }

  context.progress?.({ phase: "analyzing", message: "Inspecting document structure" });
  const analysis = await analyzePdfForCompression(bytes);
  const profiles = profilesFor(bytes, options);
  if (profiles.length === 0) {
    throw new PaperZeroError("INVALID_INPUT", "No valid compression attempts were configured.");
  }
  context.throwIfCancelled?.();

  context.progress?.({ phase: "loading-engine", message: "Loading the local Ghostscript engine" });
  const engine = await getGhostscript();
  context.throwIfCancelled?.();

  const inputPath = "/paperzero-input.pdf";
  engine.FS.writeFile(inputPath, bytes);
  let best: Uint8Array | undefined;
  let bestProfile: CompressionProfile | undefined;
  const attempts: CompressionAttemptResult[] = [];

  try {
    for (let index = 0; index < profiles.length; index++) {
      context.throwIfCancelled?.();
      const profile = profiles[index]!;
      context.progress?.({
        phase: "compressing",
        completed: index,
        total: profiles.length,
        message: options.targetBytes
          ? `Compression pass ${index + 1} of at most ${profiles.length}`
          : `Applying ${profile.label}`,
      });
      const candidate = await runAttempt(
        engine,
        profile,
        inputPath,
        `/paperzero-output-${index}.pdf`
      );
      context.progress?.({ phase: "validating", message: `Validating pass ${index + 1}` });
      await validateOutputPdf(candidate, { expectedPageCount: analysis.pageCount });
      attempts.push({
        profileId: profile.id,
        label: profile.label,
        colorDpi: profile.colorDpi,
        jpegQuality: profile.jpegQuality,
        outputBytes: candidate.byteLength,
      });
      if (!best || candidate.byteLength < best.byteLength) {
        best = candidate;
        bestProfile = profile;
      }
      if (options.targetBytes !== undefined && candidate.byteLength <= options.targetBytes) break;
    }
  } finally {
    safeUnlink(engine, inputPath);
  }

  if (!best || !bestProfile) {
    throw new PaperZeroError("OUTPUT_INVALID", "Compression did not produce a valid PDF.");
  }
  const beneficial = best.byteLength < bytes.byteLength;
  const bytesSaved = Math.max(0, bytes.byteLength - best.byteLength);
  const percentSaved = bytes.byteLength > 0 ? Math.round((bytesSaved / bytes.byteLength) * 1000) / 10 : 0;
  const targetReached = options.targetBytes === undefined ? undefined : best.byteLength <= options.targetBytes;
  const warnings: string[] = [];
  if (!beneficial) {
    warnings.push("The source was already optimized; Ghostscript did not produce a smaller file, so no replacement download was created.");
  }
  if (options.targetBytes !== undefined && !targetReached) {
    warnings.push("The requested target could not be reached within the bounded retry limit. The smallest validated result is reported instead.");
  }
  if (bestProfile.colorDpi <= 72) {
    warnings.push("The selected target required very aggressive image downsampling. Review readability before sharing.");
  }

  return {
    file: beneficial ? { name: "compressed.pdf", bytes: best } : undefined,
    warnings,
    analysis,
    attempts,
    stats: {
      originalBytes: bytes.byteLength,
      compressedBytes: best.byteLength,
      bytesSaved,
      percentSaved,
      beneficial,
      targetBytes: options.targetBytes,
      targetReached,
      profileUsed: bestProfile.label,
      attempts: attempts.length,
    },
  };
}
