import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { PermanentError } from '../utils/errors.js';

const require = createRequire(import.meta.url);

// Language data and PDF fonts are loaded from node_modules, so OCR works fully offline.
const LANG_PATH = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');
// pdf.js requires a trailing "/" (not "\" on Windows), so use forward slashes throughout.
const PDF_FONTS = `${path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts').replace(/\\/g, '/')}/`;

// ---------------------------------------------------------------- Tesseract worker pool
const pool = [];
let nextWorker = 0;

async function getWorker() {
  if (pool.length < Math.max(1, env.jobConcurrency)) {
    await fs.mkdir(env.ocrCacheDir, { recursive: true });
    const worker = createWorker(env.ocrLanguage, 1, {
      langPath: LANG_PATH, cachePath: env.ocrCacheDir, gzip: true, logger: () => {},
    });
    pool.push(worker);
  }
  const worker = pool[nextWorker % pool.length];
  nextWorker += 1;
  return worker;
}

export async function shutdownOcr() {
  const workers = pool.splice(0);
  await Promise.all(workers.map(async (w) => (await w).terminate().catch(() => {})));
}

// ---------------------------------------------------------------- Image pre-processing
/**
 * Prepares an image for OCR: applies EXIF rotation, converts to grayscale,
 * upscales small images, normalises contrast and sharpens. With threshold=true
 * it also converts to pure black and white, which helps faint or noisy scans.
 */
export async function preprocessImage(buffer, { threshold = false } = {}) {
  let img = sharp(buffer, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' }).grayscale();
  const meta = await img.metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  if (width && width < 1500) img = img.resize({ width: 2000, kernel: 'lanczos3' });
  else if (width > 4000) img = img.resize({ width: 3500 });
  img = img.normalise().sharpen();
  if (threshold) img = img.threshold(160);
  return img.png().toBuffer();
}

async function recognize(buffer) {
  const worker = await getWorker();
  // rotateAuto corrects small skew angles detected by Tesseract.
  const { data } = await worker.recognize(buffer, { rotateAuto: true });
  return { text: data.text || '', confidence: Number(data.confidence) || 0 };
}

/** OCRs an image; retries with thresholding when the first pass has low confidence. */
async function ocrImage(buffer) {
  const first = await recognize(await preprocessImage(buffer));
  if (first.confidence >= env.ocrLowConfidence && first.text.trim().length > 20) return first;
  const second = await recognize(await preprocessImage(buffer, { threshold: true }));
  return second.confidence > first.confidence ? second : first;
}

// ---------------------------------------------------------------- PDF handling
async function loadPdf(buffer) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer), standardFontDataUrl: PDF_FONTS, verbosity: 0, isEvalSupported: false,
  });
  try {
    return { pdf: await task.promise, task };
  } catch (err) {
    await task.destroy().catch(() => {});
    throw new PermanentError(`Could not open PDF: ${err.message}`, { cause: err });
  }
}

async function pageText(page) {
  const content = await page.getTextContent();
  let text = '';
  for (const item of content.items) {
    if (!('str' in item)) continue;
    text += item.str;
    text += item.hasEOL ? '\n' : ' ';
  }
  return text.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
}

async function renderPage(page, scale = 2) {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toBuffer('image/png');
}

/**
 * Extracts text from a PDF. Pages with an embedded text layer are read directly;
 * pages without one (scans) are rendered to an image and OCR'd.
 */
async function extractPdf(buffer) {
  const { pdf, task } = await loadPdf(buffer);
  try {
    return await readPdfPages(pdf);
  } finally {
    await task.destroy().catch(() => {});
  }
}

async function readPdfPages(pdf) {
  const pageCount = pdf.numPages;
  const pagesToRead = Math.min(pageCount, env.pdfMaxPages);
  const texts = [];
  const ocrConfidences = [];
  let usedOcr = false;

  for (let i = 1; i <= pagesToRead; i += 1) {
    const page = await pdf.getPage(i);
    const layer = await pageText(page);
    if (layer.replace(/\s/g, '').length >= env.pdfMinTextCharsPerPage) {
      texts.push(layer);
    } else {
      usedOcr = true;
      const png = await renderPage(page);
      const result = await ocrImage(png);
      texts.push(result.text.trim());
      ocrConfidences.push(result.confidence);
    }
    page.cleanup();
  }

  const confidence = ocrConfidences.length
    ? ocrConfidences.reduce((a, b) => a + b, 0) / ocrConfidences.length
    : null;
  return {
    text: texts.map((t, i) => (pagesToRead > 1 ? `--- Page ${i + 1} ---\n${t}` : t)).join('\n\n'),
    method: usedOcr ? 'ocr' : 'text_layer',
    confidence,
    pageCount,
    truncatedPages: pageCount > pagesToRead ? pageCount - pagesToRead : 0,
  };
}

/**
 * Extracts text from a stored document.
 * @returns {{ text: string, method: 'text_layer'|'ocr', confidence: number|null, pageCount: number }}
 */
export async function extractText(filePath, mimeType) {
  const buffer = await fs.readFile(filePath);
  const started = Date.now();
  let result;
  if (mimeType === 'application/pdf') {
    result = await extractPdf(buffer);
  } else if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
    try {
      const ocr = await ocrImage(buffer);
      result = { text: ocr.text.trim(), method: 'ocr', confidence: ocr.confidence, pageCount: 1, truncatedPages: 0 };
    } catch (err) {
      throw new PermanentError(`Could not read image: ${err.message}`, { cause: err });
    }
  } else {
    throw new PermanentError(`Unsupported file type: ${mimeType}`);
  }
  logger.debug('Text extracted', { method: result.method, pages: result.pageCount, ms: Date.now() - started });
  return result;
}

/** Cleans OCR text and trims it to the LLM input limit (data minimisation). */
export function prepareTextForLlm(text, maxChars = env.llmMaxInputChars) {
  const cleaned = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l && /[A-Za-z0-9]/.test(l)) // drop lines that are only symbols/noise
    .join('\n');
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars) : cleaned;
}
