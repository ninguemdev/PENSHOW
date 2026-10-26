// Adapted from Comicle's PNG header checker, MIT. See THIRD_PARTY_NOTICES.md.
import { crc32, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export const ART_SIZE = 1024;
export const MAX_ART_BYTES = 100 * 1024;

function paeth(left, up, diagonal) {
  const prediction = left + up - diagonal;
  const a = Math.abs(prediction - left),
    b = Math.abs(prediction - up),
    c = Math.abs(prediction - diagonal);
  return a <= b && a <= c ? left : b <= c ? up : diagonal;
}

/** Restricted PNG profile: indexed 4/8-bit or RGBA 8-bit, non-interlaced, with real transparency. */
export function inspectPng(input) {
  const bytes = Buffer.from(input);
  if (bytes.length > MAX_ART_BYTES) throw new Error('arquivo maior que 100 KB');
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error('não é PNG');
  let header,
    palette,
    transparency,
    ended = false,
    imageEnded = false;
  const image = [];
  let offset = 8;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('chunk truncado');
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error('chunk truncado');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, end - 4);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4))
      throw new Error('CRC inválido');
    if (!header && type !== 'IHDR') throw new Error('IHDR precisa ser o primeiro chunk');
    if (image.length && type !== 'IDAT') imageEnded = true;
    if (type === 'IHDR') {
      if (header || length !== 13) throw new Error('IHDR inválido');
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        color: data[9],
      };
      if (header.width !== ART_SIZE || header.height !== ART_SIZE)
        throw new Error('dimensões devem ser 1024 × 1024');
      if (data[10] || data[11] || data[12])
        throw new Error('compressão, filtro ou entrelaçamento não suportado');
      if (
        !(header.color === 3 && [4, 8].includes(header.depth)) &&
        !(header.color === 6 && header.depth === 8)
      )
        throw new Error('formato de cor não suportado');
    } else if (type === 'PLTE') {
      if (palette || image.length || length === 0 || length % 3 || length > 768)
        throw new Error('paleta inválida');
      palette = data;
    } else if (type === 'tRNS') {
      if (
        transparency ||
        image.length ||
        !palette ||
        header.color !== 3 ||
        !length ||
        length > palette.length / 3
      )
        throw new Error('transparência inválida');
      transparency = data;
    } else if (type === 'IDAT') {
      if (imageEnded || (header.color === 3 && !palette))
        throw new Error('sequência IDAT inválida');
      image.push(data);
    } else if (type === 'IEND') {
      if (length || !image.length || end !== bytes.length)
        throw new Error('IEND inválido ou conteúdo após o fim');
      ended = true;
    } else if (!['sRGB', 'gAMA', 'cHRM', 'pHYs'].includes(type)) {
      throw new Error(`chunk não permitido: ${type}`);
    }
    offset = end;
  }
  if (!ended || !header) throw new Error('PNG incompleto');
  const stride = header.color === 6 ? ART_SIZE * 4 : (ART_SIZE * header.depth) / 8;
  const channels = header.color === 6 ? 4 : 1;
  const expected = (stride + 1) * ART_SIZE;
  const scanlines = inflateSync(Buffer.concat(image), { maxOutputLength: expected });
  if (scanlines.length !== expected) throw new Error('dados de imagem incompletos');
  let previous = new Uint8Array(stride),
    hasTransparency = false,
    hasVisiblePixel = false;
  const bounds = { left: ART_SIZE, top: ART_SIZE, right: 0, bottom: 0 };
  for (let row = 0; row < ART_SIZE; row++) {
    const filter = scanlines[row * (stride + 1)];
    if (filter > 4) throw new Error('filtro inválido');
    const decoded = new Uint8Array(stride);
    for (let column = 0; column < stride; column++) {
      const left = decoded[column - channels] ?? 0;
      const up = previous[column];
      const diagonal = previous[column - channels] ?? 0;
      const prediction =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? Math.floor((left + up) / 2)
              : filter === 4
                ? paeth(left, up, diagonal)
                : 0;
      decoded[column] = (scanlines[row * (stride + 1) + column + 1] + prediction) & 255;
    }
    for (let pixel = 0; pixel < ART_SIZE; pixel++) {
      let alpha;
      if (header.color === 6) {
        alpha = decoded[pixel * 4 + 3];
        hasTransparency ||= decoded[pixel * 4 + 3] < 255;
        hasVisiblePixel ||= decoded[pixel * 4 + 3] > 0;
      } else {
        const value = decoded[header.depth === 8 ? pixel : Math.floor(pixel / 2)];
        const index = header.depth === 8 ? value : pixel % 2 === 0 ? value >> 4 : value & 15;
        if (index >= palette.length / 3) throw new Error('índice fora da paleta');
        alpha = transparency?.[index] ?? 255;
        hasTransparency ||= (transparency?.[index] ?? 255) < 255;
        hasVisiblePixel ||= (transparency?.[index] ?? 255) > 0;
      }
      if (alpha > 0) {
        bounds.left = Math.min(bounds.left, pixel);
        bounds.right = Math.max(bounds.right, pixel + 1);
        bounds.top = Math.min(bounds.top, row);
        bounds.bottom = Math.max(bounds.bottom, row + 1);
      }
    }
    previous = decoded;
  }
  if (!hasTransparency) throw new Error('imagem sem pixels transparentes');
  if (!hasVisiblePixel) throw new Error('imagem completamente transparente');
  return { ...header, bounds };
}
