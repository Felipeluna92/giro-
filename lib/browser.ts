'use client';

const pending = new Map<string, Promise<void>>();

export function loadScript(src: string) {
  if (pending.has(src)) return pending.get(src)!;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      pending.delete(src);
      script.remove();
      reject(new Error('Não foi possível carregar este recurso. Confira sua conexão e tente novamente.'));
    };
    document.head.appendChild(script);
  });
  pending.set(src, promise);
  return promise;
}

type OCRData = { text: string; confidence: number };
type OCRImage = File | HTMLCanvasElement;

export type OCRWorker = {
  recognize: (image: OCRImage) => Promise<{ data: OCRData }>;
  setParameters: (parameters: Record<string, string>) => Promise<void>;
  terminate: () => Promise<void>;
};

type TesseractWindow = Window & {
  Tesseract: {
    createWorker: (language: string, engine: number, options: unknown) => Promise<OCRWorker>;
  };
};

export async function makeOCR(logger: (message: { status: string; progress: number }) => void): Promise<OCRWorker> {
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  const worker = await (window as unknown as TesseractWindow).Tesseract.createWorker('por', 1, { logger });
  await worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' });
  return worker;
}

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

export async function prepareReceiptForAI(file: File) {
  const decoded = await decodeImage(file);
  try {
    const scale = Math.min(1, 2048 / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não conseguiu preparar a foto.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Não foi possível preparar a foto para leitura.');
    return blob;
  } finally {
    decoded.close();
  }
}

function percentile(histogram: Uint32Array, total: number, fraction: number) {
  const target = total * fraction;
  let accumulated = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    accumulated += histogram[value];
    if (accumulated >= target) return value;
  }
  return 255;
}

async function prepareReceipt(file: File) {
  const decoded = await decodeImage(file);
  try {
    const longest = Math.max(decoded.width, decoded.height);
    const shortest = Math.min(decoded.width, decoded.height);
    const scaleDown = Math.min(1, 2800 / longest);
    const scaleUp = Math.max(1, Math.min(2, 1500 / Math.max(1, shortest)));
    const scale = scaleDown < 1 ? scaleDown : scaleUp;
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Seu navegador não conseguiu preparar a foto.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded.source, 0, 0, width, height);

    const image = context.getImageData(0, 0, width, height);
    const histogram = new Uint32Array(256);
    const gray = new Uint8Array(width * height);
    for (let pixel = 0, offset = 0; pixel < gray.length; pixel += 1, offset += 4) {
      const value = Math.round(image.data[offset] * 0.299 + image.data[offset + 1] * 0.587 + image.data[offset + 2] * 0.114);
      gray[pixel] = value;
      histogram[value] += 1;
    }

    const dark = percentile(histogram, gray.length, 0.03);
    const light = Math.max(dark + 35, percentile(histogram, gray.length, 0.97));
    const range = light - dark;
    for (let pixel = 0, offset = 0; pixel < gray.length; pixel += 1, offset += 4) {
      const stretched = Math.max(0, Math.min(255, Math.round(((gray[pixel] - dark) * 255) / range)));
      const value = stretched < 128 ? Math.round(stretched * 0.88) : Math.round(255 - (255 - stretched) * 0.88);
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
      gray[pixel] = value;
    }
    context.putImageData(image, 0, 0);
    return { enhanced: canvas, gray, width, height };
  } finally {
    decoded.close();
  }
}

function adaptiveThreshold(gray: Uint8Array, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Seu navegador não conseguiu melhorar a foto.');
  const output = context.createImageData(width, height);
  const integralWidth = width + 1;
  const integral = new Float64Array(integralWidth * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= width; x += 1) {
      rowSum += gray[(y - 1) * width + x - 1];
      integral[y * integralWidth + x] = integral[(y - 1) * integralWidth + x] + rowSum;
    }
  }
  const radius = Math.max(12, Math.round(Math.min(width, height) / 70));
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      const area = (right - left + 1) * (bottom - top + 1);
      const sum = integral[(bottom + 1) * integralWidth + right + 1]
        - integral[top * integralWidth + right + 1]
        - integral[(bottom + 1) * integralWidth + left]
        + integral[top * integralWidth + left];
      const value = gray[y * width + x] < sum / area - 12 ? 0 : 255;
      const offset = (y * width + x) * 4;
      output.data[offset] = value;
      output.data[offset + 1] = value;
      output.data[offset + 2] = value;
      output.data[offset + 3] = 255;
    }
  }
  context.putImageData(output, 0, 0);
  return canvas;
}

function receiptScore(result: OCRData) {
  const text = result.text.normalize('NFC');
  const useful = (text.match(/[\p{L}\p{N}]/gu) || []).length;
  const labels = (text.match(/cliente|nome|endere[cç]o|rua|avenida|telefone|pedido|comanda|taxa|entrega|total|observa[cç][aã]o/gi) || []).length;
  const phones = /(?:\d[\s().-]*){10,13}/.test(text) ? 1 : 0;
  const money = /(?:R\$\s*)?\d+[.,]\d{2}/i.test(text) ? 1 : 0;
  return result.confidence + Math.min(30, labels * 5) + phones * 8 + money * 8 + Math.min(12, useful / 20);
}

export async function recognizeReceipt(
  worker: OCRWorker,
  file: File,
  onStage?: (stage: 'preparing' | 'first-pass' | 'second-pass') => void,
) {
  onStage?.('preparing');
  const prepared = await prepareReceipt(file);
  onStage?.('first-pass');
  const first = (await worker.recognize(prepared.enhanced)).data;
  const firstScore = receiptScore(first);
  if (first.confidence >= 68 && firstScore >= 92 && first.text.trim().length >= 35) {
    return { ...first, lowConfidence: false, usedSecondPass: false };
  }
  onStage?.('second-pass');
  const second = (await worker.recognize(adaptiveThreshold(prepared.gray, prepared.width, prepared.height))).data;
  const secondScore = receiptScore(second);
  const best = secondScore > firstScore ? second : first;
  const score = Math.max(firstScore, secondScore);
  return { ...best, lowConfidence: best.confidence < 50 || score < 72 || best.text.trim().length < 25, usedSecondPass: true };
}
