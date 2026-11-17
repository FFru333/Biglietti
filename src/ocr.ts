// Riconoscimento del testo negli screenshot, interamente sul dispositivo (Tesseract, WebAssembly).
// Tutti i file stanno in /ocr e sono nel precache del service worker: funziona anche offline.
import type { Worker } from 'tesseract.js';

let wp: Promise<Worker> | null = null;
const base = () => new URL(`${import.meta.env.BASE_URL}ocr/`, location.href).href;

// Rilevamento WebAssembly SIMD (stesso modulo di prova usato da wasm-feature-detect).
const simd = () => {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch {
    return false;
  }
};

function worker(): Promise<Worker> {
  // Senza SIMD (iOS < 16.4) niente OCR: si compila a mano.
  if (!simd()) return Promise.reject(new Error('no simd'));
  wp ??= import('tesseract.js').then(({ createWorker }) =>
    createWorker('eng', 1, {
      workerPath: `${base()}worker.min.js`,
      corePath: `${base()}tesseract-core-simd-lstm.js`,
      langPath: base().replace(/\/$/, ''),
      gzip: true,
      cacheMethod: 'none',
      workerBlobURL: false,
    }),
  ).catch((e) => { wp = null; throw e; });
  return wp;
}

/** Testo riconosciuto nell'immagine ('' se l'OCR non è disponibile o fallisce). */
export async function ocrImage(img: Blob, timeoutMs = 60_000): Promise<string> {
  try {
    const w = await worker();
    const job = w.recognize(img).then((r) => r.data.text);
    return await Promise.race([job, new Promise<string>((res) => setTimeout(() => res(''), timeoutMs))]);
  } catch {
    return '';
  }
}
