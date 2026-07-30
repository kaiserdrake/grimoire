import fs from 'fs';

// Reads pixel dimensions from an image file's header without decoding it.
// Supports PNG, JPEG, GIF, WebP and BMP. Returns { width, height } or null.
// Results are cached per path — uploaded files are immutable (UUID filenames).

const cache = new Map();

const readBytes = (fd, position, length) => {
  const buf = Buffer.alloc(length);
  const bytesRead = fs.readSync(fd, buf, 0, length, position);
  return bytesRead === length ? buf : null;
};

const parsePng = (fd) => {
  const buf = readBytes(fd, 0, 24);
  if (!buf || buf.readUInt32BE(0) !== 0x89504e47) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

const parseGif = (buf) => ({ width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) });

const parseBmp = (fd) => {
  const buf = readBytes(fd, 0, 26);
  if (!buf) return null;
  return { width: buf.readInt32LE(18), height: Math.abs(buf.readInt32LE(22)) };
};

const parseWebp = (fd) => {
  const buf = readBytes(fd, 0, 30);
  if (!buf || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const format = buf.toString('ascii', 12, 16);
  if (format === 'VP8 ') {
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (format === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (format === 'VP8X') {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  return null;
};

// Walk JPEG segments until a start-of-frame marker carrying the dimensions.
const parseJpeg = (fd, fileSize) => {
  let pos = 2;
  for (let i = 0; i < 1000 && pos + 4 <= fileSize; i++) {
    const head = readBytes(fd, pos, 4);
    if (!head || head[0] !== 0xff) return null;
    const marker = head[1];
    // Standalone markers (RSTn, SOI, EOI, TEM) have no length field
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) { pos += 2; continue; }
    const isSof = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const sof = readBytes(fd, pos, 9);
      if (!sof) return null;
      return { width: sof.readUInt16BE(7), height: sof.readUInt16BE(5) };
    }
    pos += 2 + head.readUInt16BE(2);
  }
  return null;
};

export const getImageSize = (filePath) => {
  if (cache.has(filePath)) return cache.get(filePath);
  let result = null;
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const { size } = fs.fstatSync(fd);
    const head = readBytes(fd, 0, 12);
    if (head) {
      if (head[0] === 0x89 && head[1] === 0x50) result = parsePng(fd);
      else if (head.toString('ascii', 0, 4) === 'GIF8') result = parseGif(head);
      else if (head[0] === 0xff && head[1] === 0xd8) result = parseJpeg(fd, size);
      else if (head.toString('ascii', 0, 4) === 'RIFF') result = parseWebp(fd);
      else if (head[0] === 0x42 && head[1] === 0x4d) result = parseBmp(fd);
    }
    if (result && (!result.width || !result.height)) result = null;
  } catch {
    result = null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  cache.set(filePath, result);
  return result;
};
