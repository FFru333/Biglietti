// Itinerari di volo da testo (OCR degli screenshot o PDF di prenotazione).
// Pensato per pagine tipo "My Trip" / "Gestisci prenotazione": una sequenza di eventi
// "orario + aeroporto", con il numero di volo tra partenza e arrivo. Più screenshot che si
// sovrappongono vengono uniti; le tratte che si concatenano (BLQ→AMS→CUN) formano un viaggio.
import { findDates, type DateHit } from './parse';
import { airportList } from './places';
import type { Segment } from './types';

export interface Itinerary {
  journeys: Segment[][];
  pnr?: string;
  passengers: string[];
}

interface Ev { line: number; off: number; h: number; m: number; code: string }
interface Cand {
  from: string; to: string; dep: [number, number]; arr: [number, number];
  date?: DateHit; flight?: string; durationMin?: number; carrier?: string; aircraft?: string; cabin?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const TIME = /(?<![\d:.])([01]?\d|2[0-3])[:.]([0-5]\d)(?![\d:])/;
const FLIGHT = /(?<![A-Z0-9])([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})(?![\d-])/;

function eventsOf(lines: string[], offs: number[]): Ev[] {
  const airports = airportList();
  const evs: Ev[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = TIME.exec(lines[i]);
    if (!t) continue;
    // Il codice aeroporto sta sulla stessa riga o nelle successive, prima del prossimo orario.
    for (let j = i; j < Math.min(lines.length, i + 7); j++) {
      if (j > i && TIME.test(lines[j])) break;
      const txt = j === i ? lines[j].slice(t.index + t[0].length) : lines[j];
      const paren = /\(([A-Z]{3})\)/.exec(txt);
      const bare = /(?:^|\s)([A-Z]{3})(?=\s|$|[^A-Za-z])/.exec(txt.trim());
      const code = paren?.[1] ?? (bare && airports.has(bare[1]) ? bare[1] : undefined);
      if (code) {
        evs.push({ line: i, off: offs[i], h: +t[1], m: +t[2], code });
        break;
      }
    }
  }
  return evs;
}

function candidates(text: string): Cand[] {
  const lines = text.split('\n').map((l) => l.trim());
  const offs: number[] = [];
  lines.reduce((o, l) => (offs.push(o), o + l.length + 1), 0);
  const evs = eventsOf(lines, offs);
  const dates = findDates(text);
  const out: Cand[] = [];
  let lastArrOff = -1;
  for (let k = 0; k + 1 < evs.length; k++) {
    const a = evs[k], b = evs[k + 1];
    const between = lines.slice(a.line + 1, b.line).join('\n');
    if (/transfer|coincidenza|scalo|umstieg|layover|connection/i.test(between) && !FLIGHT.test(between)) continue;
    const f = FLIGHT.exec(between.replace(/\([A-Z]{3}\)/g, ''));
    if (!f || a.code === b.code) continue;
    const dur = /(?:duration|durata|dauer|flight time|tempo di volo|flugzeit)\s*:?\s*(\d{1,2})\s*h?\s*(\d{2})/i.exec(between);
    // La data vale solo per la prima tratta dopo di essa: le successive si ricavano concatenando.
    const prevEnd = out.length ? lastArrOff : -1;
    const date = [...dates].reverse().find((d) => d.idx <= a.off && d.idx > prevEnd);
    lastArrOff = b.off;
    out.push({
      from: a.code, to: b.code, dep: [a.h, a.m], arr: [b.h, b.m], date,
      flight: `${f[1]} ${f[2]}`,
      durationMin: dur ? +dur[1] * 60 + +dur[2] : undefined,
      carrier: /operated by\s+([^,\n]+)/i.exec(between)?.[1]?.trim(),
      aircraft: /\b((?:boeing|airbus|embraer|bombardier|atr)\s*[\w-]+)/i.exec(between)?.[1],
      cabin: /\b(premium economy|economy|business|first)\b/i.exec(between)?.[1],
    });
  }
  return out;
}

// "KLM CITYHOPPER" → "KLM Cityhopper": le sigle brevi (≤ 3 lettere) restano maiuscole.
const cap = (s?: string) => s?.split(/(\s+)/).map((w) => (/^[A-Z0-9]{2,3}$/.test(w) ? w : w.toLowerCase().replace(/^\p{L}/u, (c) => c.toUpperCase()))).join('');

function abs(d: { y: number; m: number; d: number }, t: [number, number]) {
  return new Date(d.y, d.m - 1, d.d, t[0], t[1]);
}
const ymd = (x: Date) => ({ y: x.getFullYear(), m: x.getMonth() + 1, d: x.getDate() });
const fmt = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;

/** Arrivo: stesso giorno, o giorni dopo se l'orario è "prima" della partenza o la durata lo dice. */
function arrival(dep: Date, c: Cand) {
  const a = new Date(dep.getFullYear(), dep.getMonth(), dep.getDate(), c.arr[0], c.arr[1]);
  while (a <= dep) a.setDate(a.getDate() + 1);
  if (c.durationMin && c.durationMin > 26 * 60) a.setDate(a.getDate() + Math.floor(c.durationMin / (24 * 60)));
  return a;
}

export function parseItinerary(texts: string[]): Itinerary {
  const all = texts.join('\n');
  // 1. Tratte da ogni immagine, unite senza doppioni (stesso volo dallo stesso aeroporto).
  const merged = new Map<string, Cand>();
  for (const t of texts) {
    for (const c of candidates(t)) {
      const key = `${c.flight?.replace(' ', '')}|${c.from}`;
      const prev = merged.get(key);
      if (!prev) merged.set(key, c);
      else for (const k of Object.keys(c) as (keyof Cand)[]) (prev as any)[k] ??= c[k];
    }
  }
  // Data di riserva: la più vicina nel tempo tra quelle con l'anno scritto (altrimenti tra tutte).
  const dated = texts.flatMap((t) => findDates(t).map((d) => ({ d, y: /\d{4}/.test(t.slice(d.idx, d.idx + 30)) })));
  const pool = dated.some((x) => x.y) ? dated.filter((x) => x.y) : dated;
  const fallback = pool.map((x) => x.d).sort((a, b) => +abs(a, [0, 0]) - +abs(b, [0, 0]))[0];
  const when = (c: Cand) => { const d = c.date ?? fallback; return d ? +abs(d, c.dep) : Infinity; };

  // 2. Concatena: la tratta successiva parte da dove arriva la precedente, entro 24 ore.
  const rest = [...merged.values()];
  const journeys: Segment[][] = [];
  while (rest.length) {
    rest.sort((a, b) => when(a) - when(b));
    // Inizio: la prima (nel tempo) che non prosegue da un'altra tratta rimasta; con un giro chiuso, la prima in assoluto.
    const start = rest.find((c) => !rest.some((o) => o !== c && o.to === c.from)) ?? rest[0];
    rest.splice(rest.indexOf(start), 1);
    const d0 = start.date ?? fallback;
    if (!d0) continue;
    let dep = abs(d0, start.dep);
    let arr = arrival(dep, start);
    const chain: Segment[] = [toSeg(start, dep, arr)];
    for (;;) {
      let best: { c: Cand; dep: Date } | undefined;
      for (const c of rest) {
        if (c.from !== chain[chain.length - 1].to) continue;
        let d = c.date ? abs(c.date, c.dep) : abs(ymd(arr), c.dep);
        if (!c.date && d <= arr) d = new Date(+d + 86400000);
        const gap = +d - +arr;
        if (gap > 0 && gap <= 24 * 3600000 && (!best || +d < +best.dep)) best = { c, dep: d };
      }
      if (!best) break;
      rest.splice(rest.indexOf(best.c), 1);
      dep = best.dep;
      arr = arrival(dep, best.c);
      chain.push(toSeg(best.c, dep, arr));
    }
    journeys.push(chain);
  }
  journeys.sort((a, b) => a[0].departAt.localeCompare(b[0].departAt));
  return { journeys, pnr: findPnr(all), passengers: findPassengers(all) };
}

function toSeg(c: Cand, dep: Date, arr: Date): Segment {
  return {
    from: c.from, to: c.to, departAt: fmt(dep), arriveAt: fmt(arr),
    flight: c.flight, durationMin: c.durationMin,
    carrier: cap(c.carrier), aircraft: c.aircraft, cabin: cap(c.cabin),
  };
}

// ——— Codice di prenotazione ———
const PNR_LABEL = /(?:booking\s*(?:code|reference|ref\.?)|confirmation\s*(?:code|number)?|reservation\s*(?:code|number)|record\s*locator|codice\s*(?:di\s*)?prenotazione|prenotazione|buchungs(?:code|nummer)|buchung|pnr|localizador)\s*[:#]?\s*([A-Z0-9]{6})\b/i;
export function findPnr(text: string): string | undefined {
  const m = PNR_LABEL.exec(text);
  if (m && /[A-Z]/.test(m[1]) && /^[A-Z0-9]{6}$/.test(m[1].toUpperCase())) return m[1].toUpperCase();
  return undefined;
}

// ——— Passeggeri ———
const TITLE = /\b(?:MR|MRS|MS|MISS|MSTR|SIG\.?|SIG\.RA|SIGRA|HERR|FRAU)\.?\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]+){1,3})/g;
const SLASH = /\b([A-Z][A-Z'-]+)\/([A-Z][A-Z' -]+?)\s*(?:MR|MRS|MS|MISS|MSTR)?\b(?=\s|$)/g;
const HEADER = /^(?:passengers?|passeggeri|passeggero|travell?ers?|reisende|viaggiatori|guests?|ospiti)\b/i;
const NAME_LINE = /^[A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]+){1,3}$/;

export function findPassengers(text: string): string[] {
  const names = new Set<string>();
  const add = (n: string) => {
    const t = cap(n.replace(/\s+/g, ' ').trim())!;
    if (t.length >= 5 && !/airport|airlines|amsterdam|scheduled|economy|business/i.test(t)) names.add(t);
  };
  let m: RegExpExecArray | null;
  while ((m = TITLE.exec(text))) add(m[1]);
  while ((m = SLASH.exec(text))) add(`${m[2]} ${m[1]}`);
  // Nomi elencati sotto un'intestazione "Passengers" / "Passeggeri".
  const lines = text.split('\n').map((l) => l.trim());
  lines.forEach((l, i) => {
    if (!HEADER.test(l)) return;
    for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
      const v = lines[j].replace(/^\d+[.)]\s*/, '').replace(/\s*\((?:adult|adulto|child|bambino|infant)[^)]*\)\s*$/i, '');
      if (!v) continue;
      if (NAME_LINE.test(v)) add(v);
      else if (names.size) break;
    }
  });
  return [...names];
}
