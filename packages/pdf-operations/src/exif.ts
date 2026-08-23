export function readExifOrientation(jpegBytes: Uint8Array): number {
  if (jpegBytes.length < 4 || jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) return 1;
  let offset = 2;
  const view = new DataView(jpegBytes.buffer, jpegBytes.byteOffset, jpegBytes.byteLength);
  while (offset + 4 <= jpegBytes.length) {
    if (jpegBytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = jpegBytes[offset + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (marker === 0xe1 && offset + 10 < jpegBytes.length) {
      const tag = String.fromCharCode(
        jpegBytes[offset + 4]!,
        jpegBytes[offset + 5]!,
        jpegBytes[offset + 6]!,
        jpegBytes[offset + 7]!
      );
      if (tag === "Exif") {
        const tiffStart = offset + 10;
        return parseOrientation(view, tiffStart);
      }
    }
    if (length < 2) break;
    offset += 2 + length;
  }
  return 1;
}

function parseOrientation(view: DataView, tiffStart: number): number {
  try {
    const little = view.getUint16(tiffStart) === 0x4949;
    const getU16 = little ? view.getUint16.bind(view) : ((o: number, be: boolean) => view.getUint16(o, !be)) as (o: number, le: boolean) => number;
    const read16 = (offset: number) => view.getUint16(offset, little);
    void getU16;
    const magic = read16(tiffStart + 2);
    if (magic !== 0x002a && magic !== 0x2a00) return 1;
    const ifdOffset = view.getUint32(tiffStart + 4, little);
    const ifdStart = tiffStart + ifdOffset;
    const entryCount = read16(ifdStart);
    for (let i = 0; i < entryCount; i++) {
      const entryOffset = ifdStart + 2 + i * 12;
      const tag = read16(entryOffset);
      if (tag === 0x0112) {
        return read16(entryOffset + 8);
      }
    }
  } catch {
    return 1;
  }
  return 1;
}

export function orientationSwapsDimensions(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8;
}
