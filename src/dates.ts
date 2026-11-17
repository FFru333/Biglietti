// Le date sono stringhe locali "YYYY-MM-DDTHH:mm" (come stampate sul biglietto).
// Per countdown e ordinamento le interpretiamo nel fuso del dispositivo: è un'approssimazione
// voluta (vedi README).

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export function parseLocal(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s);
  if (!m) return new Date(NaN);
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
}

export const ts = (s: string) => parseLocal(s).getTime();

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n: number) => String(n).padStart(2, '0');

/** "Mar 8 dic · 14:32" (anno aggiunto se diverso dall'attuale). */
export function formatShort(s: string, now = new Date()): string {
  const d = parseLocal(s);
  if (isNaN(+d)) return '';
  const year = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${cap(GIORNI[d.getDay()])} ${d.getDate()} ${MESI[d.getMonth()]}${year} · ${formatTime(s)}`;
}

/** "Martedì 8 dicembre 2026" */
export function formatLong(s: string): string {
  const d = parseLocal(s);
  if (isNaN(+d)) return '';
  const g = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'][d.getDay()];
  return `${cap(g)} ${d.getDate()} ${MESI_LUNGHI[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(s: string): string {
  const d = parseLocal(s);
  return isNaN(+d) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Numero di giorni di calendario tra due date (b - a). */
function dayDiff(a: Date, b: Date) {
  const A = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const B = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B - A) / 86400000);
}

/** "tra 2 h", "oggi", "domani", "tra 3 giorni", "partito" … */
export function countdown(s: string, now = new Date()): string {
  const d = parseLocal(s);
  if (isNaN(+d)) return '';
  const ms = +d - +now;
  const days = dayDiff(now, d);
  if (ms < 0) {
    if (ms > -3 * 3600_000) return 'in corso';
    return days === 0 ? 'oggi' : days === -1 ? 'ieri' : `${-days} giorni fa`;
  }
  const min = Math.round(ms / 60000);
  if (min < 60) return min <= 1 ? 'ora' : `tra ${min} min`;
  const h = Math.round(ms / 3600_000);
  if (h < 12) return `tra ${h} h`;
  if (days === 0) return 'oggi';
  if (days === 1) return 'domani';
  if (days < 60) return `tra ${days} giorni`;
  const months = Math.round(days / 30.4);
  return `tra ${months} mesi`;
}

/** Un biglietto è "passato" tre ore dopo la partenza (o all'arrivo, se indicato). */
export function isPast(t: { departAt: string; arriveAt?: string }, now = Date.now()) {
  const end = t.arriveAt ? ts(t.arriveAt) : ts(t.departAt) + 3 * 3600_000;
  return end < now;
}

export function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
