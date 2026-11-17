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
  /** Pagine renderizzate (PDF) o immagine convertita (HEIC). */
  renders?: Blob[];
  thumb?: Blob;
  text: string;
}

const MAX_PAGES = 8;

/** Elabora il file: per i PDF render di tutte le pagine + testo; per le immagini conversione se serve. Sempre una miniatura. */
export async function processFile(file: Blob & { name?: string }, timeoutMs = 30_000): Promise<Processed> {
  const name = file.name ?? '';
  const work = (async (): Promise<Processed> => {
    const p: Processed = isPdf({ type: file.type, name })
      ? await processPdf(file)
      : { renders: await normalizeImage(file).then((r) => (r ? [r] : undefined)), text: '' };
    p.thumb = await makeThumb(p.renders?.[0] ?? file);
    return p;
  })();
  // Mai bloccare il form: dopo il timeout si salva senza anteprima (verrà generata all'apertura).
  const timeout = new Promise<Processed>((res) => setTimeout(() => res({ text: '' }), timeoutMs));
  return Promise.race([work.catch(() => ({ text: '' })), timeout]);
}

const pageText = (tc: { items: unknown[] }) =>
  // Riga per riga: pdf.js segnala gli a capo con hasEOL.
  (tc.items as { str?: string; hasEOL?: boolean }[]).map((i) => (i.str !== undefined ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join('');

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
    const renders: Blob[] = [];
    const texts: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      try { texts.push(pageText(await page.getTextContent())); } catch { /* testo non disponibile */ }
      const base = page.getViewport({ scale: 1 });
      // ~2000px di larghezza: QR/Aztec nitidi anche con zoom.
      // Limite di area del canvas su iOS (~16 Mpx): restiamo sotto i 12.
      const scale = Math.min(4, 2000 / base.width, Math.sqrt(12e6 / (base.width * base.height)));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // intent 'print': render senza requestAnimationFrame (non si ferma se l'app va in background).
      await page.render({ canvas, canvasContext: ctx, viewport, intent: 'print' } as unknown as Parameters<typeof page.render>[0]).promise;
      // Prima pagina: ritaglio completo (il codice sta lì). Le altre: solo sopra/sotto, a larghezza piena.
      const trimmed = trimWhite(canvas, n > 1);
      // Pagine completamente bianche (retro vuoti) non servono.
      if (trimmed !== null) renders.push(await toBlob(trimmed));
      canvas.width = canvas.height = 0;
      page.cleanup();
    }
    return { renders, text: texts.join('\n') };
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

/** Miniatura JPEG larga 480px (parte alta del biglietto), per la griglia "Anteprime". */
export async function makeThumb(src: Blob): Promise<Blob | undefined> {
  try {
    const bmp = await createImageBitmap(src);
    const w = 480;
    const h = Math.min(Math.round((bmp.height / bmp.width) * w), Math.round(w * 1.5));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.imageSmoothingQuality = 'high';
    // Ritaglia dall'alto se la pagina è molto lunga: l'intestazione e il codice stanno lì.
    const srcH = (h / w) * bmp.width;
    g.drawImage(bmp, 0, 0, bmp.width, srcH, 0, 0, w, h);
    bmp.close?.();
    return await new Promise((res) => c.toBlob((b) => res(b ?? undefined), 'image/jpeg', 0.82));
  } catch {
    return undefined;
  }
}

/** Ritaglia i margini bianchi della pagina: il codice diventa più grande a parità di schermo. */
function trimWhite(c: HTMLCanvasElement, verticalOnly = false): HTMLCanvasElement | null {
  try {
    const { width: w, height: h } = c;
    const d = c.getContext('2d')!.getImageData(0, 0, w, h).data;
    const ink = (i: number) => d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235;
    let top = 0, bottom = h - 1, left = w, right = 0;
    const rowHas = (y: number) => { for (let x = 0; x < w; x += 2) if (ink((y * w + x) * 4)) return true; return false; };
    while (top < h && !rowHas(top)) top++;
    while (bottom > top && !rowHas(bottom)) bottom--;
    if (top >= bottom) return null; // pagina bianca
    for (let y = top; y <= bottom; y += 2)
      for (let x = 0; x < w; x++) if (ink((y * w + x) * 4)) { if (x < left) left = x; if (x > right) right = x; }
    const m = Math.round(w * 0.03); // margine di respiro
    const x0 = verticalOnly ? 0 : Math.max(0, left - m), y0 = Math.max(0, top - m);
    const x1 = verticalOnly ? w : Math.min(w, right + m), y1 = Math.min(h, bottom + m);
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
