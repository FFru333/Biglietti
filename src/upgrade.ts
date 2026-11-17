// Completa i biglietti salvati con versioni precedenti (o con elaborazione interrotta):
// tutte le pagine renderizzate e la miniatura. Silenzioso: se fallisce, riprova la prossima volta.
import { putTicket } from './db';
import { isPdf, makeThumb, processFile } from './files';
import { pagesOf, type Ticket } from './types';

const running = new Set<string>();

export const needsUpgrade = (t: Ticket) =>
  (isPdf({ type: t.file.mime, name: t.file.name }) && !t.file.renders) || !t.file.thumb;

export async function upgradeTicket(t: Ticket): Promise<boolean> {
  if (!needsUpgrade(t) || running.has(t.id)) return false;
  running.add(t.id);
  try {
    const file = { ...t.file };
    if (isPdf({ type: t.file.mime, name: t.file.name }) && !file.renders) {
      const p = await processFile(new File([t.file.blob], t.file.name, { type: t.file.mime }), 45_000);
      if (!p.renders?.length) return false;
      file.renders = p.renders;
      file.render = p.renders[0];
      file.thumb ??= p.thumb;
    }
    if (!file.thumb) {
      const src = pagesOf({ ...t, file })[0];
      if (src) file.thumb = await makeThumb(src);
      if (!file.thumb) return false;
    }
    await putTicket({ ...t, file });
    return true;
  } catch {
    return false;
  } finally {
    running.delete(t.id);
  }
}

/** Aggiorna in sequenza tutti i biglietti che ne hanno bisogno. */
export async function upgradeAll(list: Ticket[]): Promise<boolean> {
  let changed = false;
  for (const t of list) if (await upgradeTicket(t)) changed = true;
  return changed;
}
