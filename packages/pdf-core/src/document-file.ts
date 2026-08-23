import { PaperZeroError } from "@paperzero/shared";

export type FileSource = File | Blob | ArrayBuffer | Uint8Array;

export interface DocumentFileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified?: number;
}

let idCounter = 0;

export class LocalDocumentFile {
  readonly id: string;
  readonly meta: DocumentFileMetadata;
  private source: FileSource;
  private disposed = false;

  constructor(source: FileSource, meta?: Partial<DocumentFileMetadata>) {
    this.id = `doc_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
    this.source = source;
    const name =
      meta?.name ??
      ((source instanceof File && source.name) || "document");
    this.meta = {
      name,
      size:
        meta?.size ??
        (source instanceof Blob
          ? source.size
          : source instanceof ArrayBuffer
            ? source.byteLength
            : source.byteLength),
      type:
        meta?.type ??
        (source instanceof Blob ? source.type : "application/octet-stream"),
      lastModified: meta?.lastModified ?? (source instanceof File ? source.lastModified : undefined),
    };
  }

  async asArrayBuffer(): Promise<ArrayBuffer> {
    this.assertAlive();
    if (this.source instanceof ArrayBuffer) return this.source;
    if (this.source instanceof Uint8Array) {
      return this.source.buffer.slice(
        this.source.byteOffset,
        this.source.byteOffset + this.source.byteLength
      ) as ArrayBuffer;
    }
    return await this.source.arrayBuffer();
  }

  async asUint8Array(): Promise<Uint8Array> {
    this.assertAlive();
    if (this.source instanceof Uint8Array) return this.source;
    const buffer = await this.asArrayBuffer();
    return new Uint8Array(buffer);
  }

  asBlob(type?: string): Blob {
    this.assertAlive();
    if (this.source instanceof Blob) return type ? this.source.slice(0, this.source.size, type) : this.source;
    if (this.source instanceof ArrayBuffer) return new Blob([this.source], { type });
    return new Blob([this.source.slice().buffer as ArrayBuffer], { type });
  }

  get isNativeFile(): boolean {
    return this.source instanceof File;
  }

  dispose(): void {
    this.disposed = true;
    this.source = new Uint8Array(0);
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new PaperZeroError("INVALID_INPUT", "This file reference was released and cannot be used anymore.");
    }
  }
}

export function createDocumentFile(source: FileSource, meta?: Partial<DocumentFileMetadata>): LocalDocumentFile {
  return new LocalDocumentFile(source, meta);
}
