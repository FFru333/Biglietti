// Backup: un unico file JSON con metadati e allegati (base64). Leggibile, portabile, senza dipendenze.
import { allTickets, putTickets, setMeta, getMeta } from './db';
import type { StoredFile, Ticket } from './types';

type JsonFile = { name: string; mime: string; data: string; render?: string; renders?: string[]; thumb?: string };

async function fileOut(f: StoredFile & { thumb?: Blob }): Promise<JsonFile> {
  return {
    name: f.name,
    mime: f.mime,
    data: await blobToDataURL(f.blob),
    // render coincide con renders[0]: non lo duplichiamo nel file.
    render: f.render && !f.renders ? await blobToDataURL(f.render) : undefined,
    renders: f.renders ? await Promise.all(f.renders.map(blobToDataURL)) : undefined,
    thumb: f.thumb ? await blobToDataURL(f.thumb) : undefined,
  };
}

async function fileIn(f: JsonFile): Promise<StoredFile & { thumb?: Blob }> {
  const renders = Array.isArray(f.renders) ? await Promise.all(f.renders.map(dataURLToBlob)) : undefined;
  return {
    name: f.name,
    mime: f.mime,
    blob: await dataURLToBlob(f.data),
    render: f.render ? await dataURLToBlob(f.render) : renders?.[0],
    renders,
    thumb: f.thumb ? await dataURLToBlob(f.thumb) : undefined,
  };
}

const FORMAT = 'biglietti-backup';

const blobToDataURL = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

async function dataURLToBlob(u: string): Promise<Blob> {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(u);
  if (!m) throw new Error('allegato non valido');
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] || 'application/octet-stream' });
}

export async function exportBackup(): Promise<File> {
  const tickets = (await allTickets()).filter((t) => !t.demo);
  const out = [];
  for (const t of tickets) {
    out.push({
      ...t,
      file: await fileOut(t.file),
      more: t.more ? await Promise.all(t.more.map(fileOut)) : undefined,
    });
  }
  const now = new Date();
  const json = JSON.stringify({ format: FORMAT, version: 1, exportedAt: now.toISOString(), tickets: out });
  const day = now.toISOString().slice(0, 10);
  return new File([json], `biglietti-backup-${day}.json`, { type: 'application/json' });
}

/** Condivide (iOS: "Salva su File") o scarica il backup, poi registra la data. */
export async function saveBackup(file: File) {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  let done = false;
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      done = true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
    }
  }
  if (!done) {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  await setMeta('lastBackup', Date.now());
  return true;
}

export async function importBackup(file: Blob): Promise<number> {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Questo file non è un backup di Biglietti.');
  }
  if (data?.format !== FORMAT || !Array.isArray(data.tickets)) throw new Error('File di backup non riconosciuto.');
  const tickets: Ticket[] = [];
  for (const t of data.tickets) {
    if (!t?.id || !t?.file?.data) continue;
    tickets.push({
      ...t,
      file: await fileIn(t.file),
      more: Array.isArray(t.more) ? await Promise.all(t.more.map(fileIn)) : undefined,
    });
  }
  await putTickets(tickets);
  return tickets.length;
}

export const lastBackup = () => getMeta<number>('lastBackup');
