// Elabora i file scelti (PDF e/o immagini): pagine da mostrare, testo (PDF o OCR) e riconoscimento.
import { isPdf, processFile } from './files';
import { ocrImage } from './ocr';
import { guessFromText, type Guess } from './parse';
import { findPassengers, findPnr, parseItinerary, type Itinerary } from './itinerary';
import type { Row } from './layout';
import type { StoredFile } from './types';

export interface Analysis {
  stored: StoredFile[];
  thumb?: Blob;
  guess: Guess;
  itinerary: Itinerary;
}

const mimeOf = (f: File) => f.type || (isPdf(f) ? 'application/pdf' : 'application/octet-stream');

export async function analyze(files: File[], known: string[], onProgress?: (msg: string) => void): Promise<Analysis> {
  const stored: StoredFile[] = [];
  const texts: string[] = [];
  const rows: Row[] = [];
  let thumb: Blob | undefined;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const n = files.length > 1 ? ` ${i + 1}/${files.length}` : '';
    onProgress?.(`Lettura${n}…`);
    const p = await processFile(f);
    thumb ??= p.thumb;
    stored.push({ name: f.name || `file-${i + 1}`, mime: mimeOf(f), blob: f, render: p.renders?.[0], renders: p.renders });
    if (isPdf(f)) {
      texts.push(p.text);
      rows.push(...(p.rows ?? []));
    } else {
      onProgress?.(`Riconoscimento testo${n}…`);
      texts.push(await ocrImage(p.renders?.[0] ?? f));
    }
  }
  const all = texts.join('\n');
  const itinerary = parseItinerary(texts);
  itinerary.pnr ??= findPnr(all);
  if (!itinerary.passengers.length) itinerary.passengers = findPassengers(all);
  return { stored, thumb, guess: guessFromText(all, known, rows), itinerary };
}
