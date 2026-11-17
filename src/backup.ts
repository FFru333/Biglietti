// Backup: un unico file JSON con metadati e allegati (base64). Leggibile, portabile, senza dipendenze.
import { allTickets, putTickets, setMeta, getMeta } from './db';
import type { Ticket } from './types';

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
      file: {
        name: t.file.name,
        mime: t.file.mime,
        data: await blobToDataURL(t.file.blob),
        // render coincide con renders[0]: non lo duplichiamo nel file.
        render: t.file.render && !t.file.renders ? await blobToDataURL(t.file.render) : undefined,
        renders: t.file.renders ? await Promise.all(t.file.renders.map(blobToDataURL)) : undefined,
        thumb: t.file.thumb ? await blobToDataURL(t.file.thumb) : undefined,
      },
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
  const data = JSON.parse(await file.text());
  if (data?.format !== FORMAT || !Array.isArray(data.tickets)) throw new Error('File di backup non riconosciuto.');
  const tickets: Ticket[] = [];
  for (const t of data.tickets) {
    if (!t?.id || !t?.file?.data) continue;
    tickets.push({
      ...t,
      file: {
        name: t.file.name,
        mime: t.file.mime,
        blob: await dataURLToBlob(t.file.data),
        render: t.file.render ? await dataURLToBlob(t.file.render) : undefined,
        renders: Array.isArray(t.file.renders) ? await Promise.all(t.file.renders.map(dataURLToBlob)) : undefined,
        thumb: t.file.thumb ? await dataURLToBlob(t.file.thumb) : undefined,
      },
    });
  }
  tickets.forEach((t) => { if (!t.file.render && t.file.renders?.length) t.file.render = t.file.renders[0]; });
  await putTickets(tickets);
  return tickets.length;
}

export const lastBackup = () => getMeta<number>('lastBackup');
