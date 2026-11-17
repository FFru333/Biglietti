// Elaborazione dei file allegati: render della prima pagina dei PDF e normalizzazione immagini.
// pdf.js viene caricato solo quando serve (import dinamico), ma resta nel precache del service worker.

type PdfJs = typeof import('pdfjs-dist');
let pdfjsP: Promise<PdfJs> | null = null;

function pdfjs(): Promise<PdfJs> {
  pdfjsP ??= (async () => {
    const [lib, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.min.mjs') as unknown as Promise<PdfJs>,
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })();
  return pdfjsP;
}

const assetBase = () => new URL(`${import.meta.env.BASE_URL}pdfjs/`, location.href).href;

export const isPdf = (f: { type: string; name: string }) =>
  f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

export interface Processed {
  render?: Blob;
  text: string;
}

/** Elabora il file: per i PDF render della prima pagina + testo; per le immagini un PNG se serve. */
export async function processFile(file: Blob & { name?: string }, timeoutMs = 20_000): Promise<Processed> {
  const name = file.name ?? '';
  const work = isPdf({ type: file.type, name })
    ? processPdf(file)
    : normalizeImage(file).then((render) => ({ render, text: '' }));
  // Mai bloccare il form: dopo il timeout si salva senza anteprima (verrà generata all'apertura).
  const timeout = new Promise<Processed>((res) => setTimeout(() => res({ text: '' }), timeoutMs));
  return Promise.race([work.catch(() => ({ text: '' })), timeout]);
}

async function processPdf(file: Blob): Promise<Processed> {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = lib.getDocument({
    data,
    standardFontDataUrl: `${assetBase()}standard_fonts/`,
    wasmUrl: `${assetBase()}wasm/`,
    isEvalSupported: false,
    enableXfa: false,
  } as Parameters<PdfJs['getDocument']>[0]);
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    let text = '';
    try {
      const tc = await page.getTextContent();
      // Riga per riga: pdf.js segnala gli a capo con hasEOL.
      text = tc.items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join('');
      // Le pagine successive possono contenere i dettagli del viaggio (prime 3).
      for (let p = 2; p <= Math.min(doc.numPages, 3); p++) {
        const tc2 = await (await doc.getPage(p)).getTextContent();
        text += '\n' + tc2.items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join('');
      }
    } catch {
      /* testo non disponibile: va bene così */
    }
    const base = page.getViewport({ scale: 1 });
    // ~2200px di larghezza: abbastanza per QR/Aztec nitidi anche con zoom.
    // Limite di area del canvas su iOS (~16 Mpx): restiamo sotto i 14.
    const scale = Math.min(4, 2200 / base.width, Math.sqrt(14e6 / (base.width * base.height)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // intent 'print': render sincrono senza requestAnimationFrame (non si ferma se l'app va in background).
    await page.render({ canvas, canvasContext: ctx, viewport, intent: 'print' } as unknown as Parameters<typeof page.render>[0]).promise;
    const render = await toBlob(trimWhite(canvas));
    canvas.width = canvas.height = 0;
    return { render, text };
  } finally {
    task.destroy();
  }
}

/** Le immagini che il browser sa già mostrare restano così; le altre (HEIC) vengono convertite se possibile. */
async function normalizeImage(file: Blob): Promise<Blob | undefined> {
  if (/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return undefined;
  try {
    const bmp = await createImageBitmap(file);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d')!.drawImage(bmp, 0, 0);
    return await toBlob(c);
  } catch {
    return undefined;
  }
}

/** Ritaglia i margini bianchi della pagina: il codice diventa più grande a parità di schermo. */
function trimWhite(c: HTMLCanvasElement): HTMLCanvasElement {
  try {
    const { width: w, height: h } = c;
    const d = c.getContext('2d')!.getImageData(0, 0, w, h).data;
    const ink = (i: number) => d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235;
    let top = 0, bottom = h - 1, left = w, right = 0;
    const rowHas = (y: number) => { for (let x = 0; x < w; x += 2) if (ink((y * w + x) * 4)) return true; return false; };
    while (top < h && !rowHas(top)) top++;
    while (bottom > top && !rowHas(bottom)) bottom--;
    if (top >= bottom) return c;
    for (let y = top; y <= bottom; y += 2)
      for (let x = 0; x < w; x++) if (ink((y * w + x) * 4)) { if (x < left) left = x; if (x > right) right = x; }
    const m = Math.round(w * 0.03); // margine di respiro
    const x0 = Math.max(0, left - m), y0 = Math.max(0, top - m);
    const x1 = Math.min(w, right + m), y1 = Math.min(h, bottom + m);
    if (x1 - x0 > w * 0.95 && y1 - y0 > h * 0.95) return c;
    const out = document.createElement('canvas');
    out.width = x1 - x0;
    out.height = y1 - y0;
    out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  } catch {
    return c;
  }
}

function toBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('render'))), 'image/png'));
}
