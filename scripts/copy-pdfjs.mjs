// Copia nel public/ gli asset statici di pdf.js (font standard e decoder wasm),
// così il rendering dei PDF non fa mai richieste di rete fuori dall'app.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const src = 'node_modules/pdfjs-dist';
const dst = 'public/pdfjs';
rmSync(dst, { recursive: true, force: true });
mkdirSync(`${dst}/wasm`, { recursive: true });
cpSync(`${src}/standard_fonts`, `${dst}/standard_fonts`, { recursive: true });
for (const f of ['jbig2.wasm', 'openjpeg.wasm', 'qcms_bg.wasm']) cpSync(`${src}/wasm/${f}`, `${dst}/wasm/${f}`);
