// Copia nel public/ gli asset statici di pdf.js (font standard e decoder wasm),
// così il rendering dei PDF non fa mai richieste di rete fuori dall'app.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const src = 'node_modules/pdfjs-dist';
const dst = 'public/pdfjs';
rmSync(dst, { recursive: true, force: true });
mkdirSync(`${dst}/wasm`, { recursive: true });
cpSync(`${src}/standard_fonts`, `${dst}/standard_fonts`, { recursive: true });
for (const f of ['jbig2.wasm', 'openjpeg.wasm', 'qcms_bg.wasm']) cpSync(`${src}/wasm/${f}`, `${dst}/wasm/${f}`);

// OCR offline (Tesseract): worker, motore LSTM con SIMD (iOS 16.4+) e modello inglese compatto.
const ocr = 'public/ocr';
rmSync(ocr, { recursive: true, force: true });
mkdirSync(ocr, { recursive: true });
cpSync('node_modules/tesseract.js/dist/worker.min.js', `${ocr}/worker.min.js`);
for (const f of ['tesseract-core-simd-lstm']) {
  cpSync(`node_modules/tesseract.js-core/${f}.js`, `${ocr}/${f}.js`);
  cpSync(`node_modules/tesseract.js-core/${f}.wasm`, `${ocr}/${f}.wasm`);
}
cpSync('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', `${ocr}/eng.traineddata.gz`);
