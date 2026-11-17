import type { Row } from './layout';
import { findAirports, findGenericStations, findStations, stationByAlias } from './places';
// Prefill "best effort" dal testo del PDF. Euristiche semplici, nessuna rete.
// Ogni funzione è tollerante: se qualcosa non torna restituisce meno campi, mai un errore.
import type { TicketType } from './types';

export interface Guess {
  type?: TicketType;
  from?: string;
  to?: string;
  departAt?: string;
  arriveAt?: string;
  seat?: string;
  note?: string;
}

const MONTHS: Record<string, number> = {};
const monthNames: string[][] = [
  ['gen', 'gennaio', 'jan', 'january', 'januar', 'jän', 'janvier', 'ene', 'enero'],
  ['feb', 'febbraio', 'february', 'februar', 'février', 'fev', 'febrero'],
  ['mar', 'marzo', 'march', 'märz', 'mär', 'mars'],
  ['apr', 'aprile', 'april', 'avril', 'abr', 'abril'],
  ['mag', 'maggio', 'may', 'mai', 'mayo'],
  ['giu', 'giugno', 'jun', 'june', 'juni', 'juin', 'junio'],
  ['lug', 'luglio', 'jul', 'july', 'juli', 'juillet', 'julio'],
  ['ago', 'agosto', 'aug', 'august', 'août', 'aout'],
  ['set', 'settembre', 'sep', 'sept', 'september', 'septembre', 'septiembre'],
  ['ott', 'ottobre', 'oct', 'october', 'okt', 'oktober', 'octobre', 'octubre'],
  ['nov', 'novembre', 'november', 'noviembre'],
  ['dic', 'dicembre', 'dec', 'december', 'dez', 'dezember', 'décembre', 'dic', 'diciembre'],
];
monthNames.forEach((names, i) => names.forEach((n) => (MONTHS[n] = i + 1)));
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

const pad = (n: number) => String(n).padStart(2, '0');

interface Hit { idx: number; y: number; m: number; d: number }

function findDates(text: string): Hit[] {
  const hits: Hit[] = [];
  const thisYear = new Date().getFullYear();
  const push = (idx: number, y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= thisYear - 2 && y <= thisYear + 3) hits.push({ idx, y, m, d });
  };
  let r: RegExpExecArray | null;
  const re1 = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/g; // 08/12/2026, 8.12.26
  while ((r = re1.exec(text))) push(r.index, +r[3], +r[2], +r[1]);
  const re2 = /\b(\d{4})-(\d{2})-(\d{2})\b/g; // 2026-12-08
  while ((r = re2.exec(text))) push(r.index, +r[1], +r[2], +r[3]);
  const re3 = new RegExp(`\\b(\\d{1,2})\\.?\\s*(${MONTH_RE})\\.?,?(?:\\s*(\\d{4}|\\d{2})(?![:.\\d]))?\\b`, 'gi'); // 8 dicembre 2026, 08DEC26
  while ((r = re3.exec(text))) {
    const y = r[3] ? +r[3] : inferYear(+MONTHS[r[2].toLowerCase()], +r[1]);
    push(r.index, y, MONTHS[r[2].toLowerCase()], +r[1]);
  }
  const re4 = new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi'); // Dec 8, 2026
  while ((r = re4.exec(text))) push(r.index, +r[3], MONTHS[r[1].toLowerCase()], +r[2]);
  return hits.sort((a, b) => a.idx - b.idx);
}

/** Senza anno: il prossimo giorno con quella data. */
function inferYear(m: number, d: number) {
  const now = new Date();
  const y = now.getFullYear();
  return new Date(y, m - 1, d + 1) < now ? y + 1 : y;
}

function findTimes(text: string) {
  const out: { idx: number; h: number; min: number }[] = [];
  // Prima gli orari con i due punti (14:32). Quelli col punto (14.32) sono ambigui con le date
  // senza anno ("20.11"), quindi solo se non ce ne sono altri, o se seguiti da "Uhr"/"h".
  const scan = (re: RegExp) => {
    let r: RegExpExecArray | null;
    while ((r = re.exec(text))) out.push({ idx: r.index, h: +r[1], min: +r[2] });
  };
  scan(/(?<![\d.:/])([01]?\d|2[0-3]):([0-5]\d)(?![\d.:/])/g);
  if (!out.length) scan(/(?<![\d.:/])([01]?\d|2[0-3])[.h]([0-5]\d)(?![\d.:/])/g);
  else scan(/(?<![\d.:/])([01]?\d|2[0-3])\.([0-5]\d)(?=\s*(?:uhr|h)\b)/gi);
  return out.sort((a, b) => a.idx - b.idx);
}

const AIRLINE = /\b(boarding|imbarco|gate|flight|volo|flug|abflug|flugnummer|vuelo|airline|airways|lufthansa|ita airways|alitalia|ryanair|easyjet|aeromexico|aeroméxico|condor|eurowings|klm|air france|iberia|swiss|austrian|bordkarte|boarding pass|carta d'imbarco)/i;
const RAIL = /\b(trenitalia|italo|frecciarossa|frecciargento|intercity|regionale|treno|train|zug|bahn|fahrkarte|reservierung|hbf|db fernverkehr|deutsche bahn|öbb|oebb|railjet|sbb|cff|ffs|sncf|renfe|eurostar|nightjet|carrozza|wagen|coach\s*\d|binario|gleis|ICE\s?\d|ECE?\s?\d)/i;
const EVENT = /\b(concert|concerto|konzert|festival|teatro|theater|theatre|stadio|stadion|stadium|arena|palazzetto|ingresso|eintritt|einlass|admission|ticketone|ticketmaster|eventim|vivaticket|dice\.fm|tour 20\d\d|spettacolo|show|museo|museum|mostra|ausstellung)/i;

// IATA: parole di tre lettere maiuscole da non scambiare per aeroporti.
const NOT_IATA = new Set('THE AND FOR EUR USD MXN PNR REF VAT IVA TAX NON PER DEL DIE DER DAS UND VON NACH ORE ORA GATE SEQ PAX MRS MRS MR MS ECO BUS FLY YES OUT SEAT ADT CHD INF DOC NUM CAB BAG KG OK'.split(' '));

// ——— Partenza e arrivo ———

const DEP_LABEL = /^(?:stazione di partenza|partenza|partenze|da|from|von|abfahrt|ab|departure|departs?|depart|départ|origine|origin|salida|abflug|abfahrtsort|start(?:bahnhof)?)\s*[:.]?(?=\s|$)/i;
const ARR_LABEL = /^(?:stazione di arrivo|arrivo|arrivi|a|to|nach|ankunft|an|arrival|arrives?|arrivée|destinazione|destination|llegada|ankunftsort|ziel(?:bahnhof)?)\s*[:.]?(?=\s|$)/i;
// Parole che stanno nelle tabelle ma non sono luoghi.
const NOT_PLACE = /^(?:data|datum|date|ora|orario|zeit|time|uhrzeit|gleis|binario|platform|bin\.?|treno|train|zug|produkte?|carrozza|wagen|coach|posto|platz|seat|classe|klasse|class|prezzo|preis|price|totale|gesamt|total|passeggero|reisender|passenger|nome|name|halt|fermata|stop|durata|dauer|duration|cambi|umstieg|changes|tariffa|tarif|fare|codice|code|pnr|ticket|biglietto|fahrkarte|via|über|ueber|hinfahrt|rückfahrt|andata|ritorno|volo|flight|flug|gate|terminal|boarding|imbarco|sitz|reihe|fila|row)$/i;

const stripTail = (v: string) =>
  v.replace(/\s+(?:ab|an|dep|arr)\.?\s*$/i, '')
    // via orari, date, binari e numeri in coda: "Bologna C.le 14:32 Bin. 5" → "Bologna C.le"
    .replace(/\s+(?:\d{1,2}[:.]\d{2}\b.*|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b.*|(?:bin|gleis|binario|platform)\b.*)$/i, '')
    .replace(/[\s,:;.\-–(]+$/, '')
    .trim();

function placey(v: string): boolean {
  if (!v || v.length < 3 || v.length > 45) return false;
  if ((v.match(/\p{L}/gu)?.length ?? 0) < 3) return false;
  if (/\d{3,}|@|€|\$|eur\b|www\.|https?:|:/i.test(v)) return false;
  if (DEP_LABEL.test(v) || ARR_LABEL.test(v) || NOT_PLACE.test(v.replace(/[:.]$/, ''))) return false;
  return true;
}

interface Pick { from?: string; to?: string }

/** Il segmento della riga più allineato (per inizio colonna) a quello dato, se si sovrappone. */
function nearestBelow(row: Row, seg: { x: number; x2: number }) {
  let best: Row[number] | undefined, bestD = Infinity;
  for (const b of row) {
    if (b.x > seg.x2 + 20 || b.x2 < seg.x - 20) continue;
    const d = Math.abs(b.x - seg.x);
    if (d < bestD) { best = b; bestD = d; }
  }
  return best;
}

/** Tabelle e etichette: valore a destra dell'etichetta, o sotto nella stessa colonna. */
function fromRows(rows: Row[]): Pick {
  const out: Pick = {};
  const valueFor = (ri: number, si: number, re: RegExp): string | undefined => {
    const seg = rows[ri][si];
    // "Da: Bologna Centrale" nello stesso segmento.
    const rest = stripTail(seg.text.replace(re, '').trim());
    if (rest && placey(rest)) return rest;
    // Segmento subito a destra.
    const right = rows[ri][si + 1];
    if (right) {
      const v = stripTail(right.text);
      if (placey(v)) return v;
    }
    // Sotto, nella stessa colonna (fino a 4 righe).
    for (let j = ri + 1; j < Math.min(rows.length, ri + 5); j++) {
      const below = nearestBelow(rows[j], seg);
      if (!below) continue;
      const v = stripTail(below.text);
      if (placey(v)) return v;
      if (DEP_LABEL.test(below.text) || ARR_LABEL.test(below.text)) break;
    }
    return undefined;
  };
  for (let i = 0; i < rows.length && !(out.from && out.to); i++) {
    rows[i].forEach((seg, si) => {
      if (seg.text.length > 48) return;
      if (!out.from && DEP_LABEL.test(seg.text)) out.from = valueFor(i, si, DEP_LABEL);
      else if (!out.to && ARR_LABEL.test(seg.text)) out.to = valueFor(i, si, ARR_LABEL);
    });
  }
  if (out.from && out.to && out.from !== out.to) return out;

  // Righe tipo orario DB: "München Hbf | 08.12. | ab 07:28" / "Bologna C.le | 08.12. | an 14:10".
  const res: Pick = {};
  for (const r of rows) {
    const joined = r.map((x) => x.text).join(' ');
    const first = r.map((x) => stripTail(x.text)).find(placey);
    if (!first) continue;
    if (!res.from && /(?:^|\s)(?:ab|dep\.?|partenza|p\.)\s*\d{1,2}[:.]\d{2}(?![.\d])/i.test(joined)) res.from = first;
    else if (res.from && !res.to && /(?:^|\s)(?:an|arr\.?|arrivo|a\.)\s*\d{1,2}[:.]\d{2}(?![.\d])/i.test(joined)) res.to = first;
  }
  if (res.from && res.to && res.from !== res.to) return res;
  return {};
}

/** Valore associato a un'etichetta di tabella: nello stesso segmento, a destra o sotto nella stessa colonna. */
function lookup(rows: Row[], label: RegExp, accept: (v: string) => string | undefined): string | undefined {
  for (let i = 0; i < rows.length; i++) {
    for (let si = 0; si < rows[i].length; si++) {
      const seg = rows[i][si];
      if (seg.text.length > 40 || !label.test(seg.text)) continue;
      const rest = seg.text.replace(label, '').replace(/^\s*[:.]?\s*/, '');
      const cands = [rest, rows[i][si + 1]?.text ?? ''];
      for (let j = i + 1; j < Math.min(rows.length, i + 4); j++) {
        const below = nearestBelow(rows[j], seg);
        if (below) { cands.push(below.text); break; }
      }
      for (const c of cands) {
        const v = c && accept(c.trim());
        if (v) return v;
      }
    }
  }
  return undefined;
}

const timeOf = (v: string) => {
  const m = /^(?:[a-z.]+\s*)?([01]?\d|2[0-3])[:.]([0-5]\d)(?![.\d])/i.exec(v);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined;
};

function timesFromRows(rows: Row[]) {
  return {
    dep: lookup(rows, /^(?:ora (?:di )?partenza|orario (?:di )?partenza|partenza|departure|departs?|dep\.?|abfahrt|abflug|départ|salida)\b/i, timeOf),
    arr: lookup(rows, /^(?:ora (?:di )?arrivo|orario (?:di )?arrivo|arrivo|arrival|arrives?|arr\.?|ankunft|arrivée|llegada)\b/i, timeOf),
  };
}

function seatFromRows(rows: Row[]): string | undefined {
  const num = (re: RegExp) => (v: string) => (re.test(v) ? v.replace(/\s+/g, '') : undefined);
  const parts: [string, string | undefined][] = [
    ['Carrozza', lookup(rows, /^(?:carrozza|carr\.|wagen|wg\.|coach|voiture|coche)\s*$/i, num(/^\d{1,3}[A-Z]?$/))],
    ['Settore', lookup(rows, /^(?:settore|sector|sektor|block|blocco)\s*$/i, num(/^[A-Z0-9]{1,4}$/))],
    ['Fila', lookup(rows, /^(?:fila|row|reihe)\s*$/i, num(/^[A-Z0-9]{1,3}$/))],
    ['Posto', lookup(rows, /^(?:posto|posti|platz|plätze|sitzplatz|seat|sitz|siège|asiento)\s*$/i, num(/^\d{1,3}[A-K]?(?:\s*[,/+-]\s*\d{1,3}[A-K]?)*$/))],
  ];
  if (!parts[3][1]) return undefined;
  return parts.filter(([, v]) => v).map(([l, v]) => `${l} ${v}`).join(' · ');
}

/** Se il valore è esattamente il nome di una stazione nota ("MUENCHEN", "BOLOGNA"), usa il nome completo. */
function canon(v: string): string {
  return stationByAlias(v) ?? tidy(v);
}

function findRoute(text: string, known: string[], rows: Row[] = [], type?: string): Pick {
  // 1. Etichette e tabelle (con le posizioni ricostruite dal PDF).
  if (rows.length) {
    // Frecce attaccate alle intestazioni o ai valori ("-> NACH", "-> BOLOGNA").
    const clean = rows
      .map((r) => r.map((sg) => ({ ...sg, text: sg.text.replace(/^(?:-+>|=>|→|›|»)\s*/, '') })).filter((sg) => sg.text))
      .filter((r) => r.length);
    const r = fromRows(clean);
    const c = (v: string) => (type === 'volo' ? tidy(v) : canon(v));
    if (r.from && r.to) return { from: c(r.from), to: c(r.to) };
  }

  // 1b. Etichette nel testo semplice ("Da: X" / "A: Y").
  const lab = (re: RegExp) => {
    const m = re.exec(text);
    const v = m?.[1] ? stripTail(m[1].replace(/\s{2,}.*/, '')) : undefined;
    return v && placey(v) ? v : undefined;
  };
  const from = lab(/(?:^|\n)\s*(?:da|from|von|partenza|departure|abfahrt|départ|origin|origine)\s*[:\-]\s*([^\n]{3,60})/i);
  const to = lab(/(?:^|\n)\s*(?:a|to|nach|arrivo|arrival|ankunft|arrivée|destination|destinazione)\s*[:\-]\s*([^\n]{3,60})/i);
  if (from && to && from !== to) return { from: tidy(from), to: tidy(to) };

  // 2. "von X nach Y" / "from X to Y" nella stessa riga.
  const inline = /\b(?:von|from)\s+([A-ZÀ-Ý][\p{L} .'’()-]{1,30}?)\s+(?:nach|to)\s+([A-ZÀ-Ý][\p{L} .'’()-]{1,30}?)(?=\s{2,}|\s*[\n,;(]|\s+\d|$)/u.exec(text);
  if (inline && placey(inline[1]) && placey(inline[2])) return { from: tidy(inline[1]), to: tidy(inline[2]) };

  // 3. "X → Y" su una riga (anche dopo "Hinfahrt:", "Andata:" …).
  const arrow = /(?:^|\n)\s*(?:(?:[Hh]infahrt|[Rr]ückfahrt|[Aa]ndata|[Rr]itorno|[Oo]utbound|[Rr]eturn|[Ss]trecke|[Tt]ratta|[Rr]oute|[Pp]ercorso)\s*:?\s*)?([A-ZÀ-Ý][\p{L} .'’()-]{1,30}?)\s*(?:→|->|›|»|>|–|—| - )\s*([A-ZÀ-Ý][\p{L} .'’()-]{1,30}?)\s*(?:\n|\s{3}|$)/u.exec(text);
  if (arrow && placey(stripTail(arrow[1])) && placey(stripTail(arrow[2]))) return { from: tidy(stripTail(arrow[1])), to: tidy(stripTail(arrow[2])) };

  // 4. Aeroporti: codici IATA noti nell'ordine in cui compaiono.
  const air = findAirports(text);
  if (air.length >= 2 && (type === 'volo' || type === undefined)) return { from: air[0].name, to: air[1].name };

  // 5. Stazioni note, nomi "… Hbf / Centrale" e luoghi già usati, nell'ordine del testo.
  const lower = text.toLowerCase();
  const knownHits = known
    .filter((k) => k.length >= 3)
    .map((k) => ({ name: k, idx: lower.indexOf(k.toLowerCase()) }))
    .filter((h) => h.idx >= 0);
  const merged = [...findStations(text), ...findGenericStations(text), ...knownHits].sort((a, b) => a.idx - b.idx);
  const names: string[] = [];
  for (const h of merged) {
    // Evita doppioni dello stesso luogo con nomi diversi ("Bologna" e "Bologna Centrale").
    const key = h.name.toLowerCase().split(/[\s(]/)[0];
    if (!names.some((n) => n.toLowerCase().split(/[\s(]/)[0] === key)) names.push(h.name);
  }
  if (names.length >= 2) return { from: names[0], to: names[1] };

  // 6. Coppie di codici a tre lettere (MUC-MEX) anche fuori elenco.
  const iata = /\b([A-Z]{3})\s*(?:-|–|→|\/|>)\s*([A-Z]{3})\b/g;
  let r: RegExpExecArray | null;
  while ((r = iata.exec(text))) {
    if (!NOT_IATA.has(r[1]) && !NOT_IATA.has(r[2]) && r[1] !== r[2]) return { from: r[1], to: r[2] };
  }
  if (air.length >= 2) return { from: air[0].name, to: air[1].name };

  // Mezzo risultato è meglio di niente: almeno la partenza o l'arrivo.
  return { from: from ? tidy(from) : names[0], to: to ? tidy(to) : undefined };
}

const tidy = (s: string) =>
  s.replace(/\s+/g, ' ').replace(/[\s,:;.\-–]+$/, '').trim().replace(/\b(\p{L})(\p{L}*)/gu, (_, a: string, b: string) =>
    s === s.toUpperCase() ? a + b.toLowerCase() : a + b);

export function guessFromText(text: string, known: string[] = [], rows: Row[] = []): Guess {
  const g: Guess = {};
  try {
    if (!text || text.trim().length < 10) return g;
    if (AIRLINE.test(text)) g.type = 'volo';
    else if (RAIL.test(text)) g.type = 'treno';
    else if (EVENT.test(text)) g.type = 'evento';

    if (g.type === 'evento') {
      // Luogo: la riga che nomina arena/teatro/stadio…, fino alla prima virgola.
      const venue = /(?:^|\n)\s*([^\n]*?\b(?:arena|teatro|theater|theatre|stadio|stadion|stadium|palazzetto|forum|auditorium|halle|hall|club|museo|museum|piazza|parco|ippodromo|palasport)\b[^\n,]*)/i.exec(text);
      if (venue) g.to = tidy(venue[1]).slice(0, 50);
    } else {
      const route = findRoute(text, known, rows, g.type);
      if (route.from) g.from = route.from;
      if (route.to) g.to = route.to;
    }
    const seat = findSeat(text) ?? (rows.length ? seatFromRows(rows) : undefined) ?? findSeat(text, true);
    if (seat) g.seat = seat;
    const num = findNumber(text, g.type);
    if (num) g.note = num;

    const dates = findDates(text);
    const times = findTimes(text);
    if (dates.length) {
      // Prima data futura (o la prima in assoluto).
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = dates.find((x) => new Date(x.y, x.m - 1, x.d) >= today) ?? dates[0];
      const day = `${d.y}-${pad(d.m)}-${pad(d.d)}`;
      // Orari dopo la data (entro ~400 caratteri), altrimenti i primi del documento.
      let near = times.filter((t) => t.idx > d.idx && t.idx - d.idx < 400);
      if (!near.length) near = times;
      // Orari etichettati hanno la precedenza (l'orario d'imbarco non è la partenza).
      const labeled = (re: RegExp) => {
        const m = re.exec(text);
        return m ? { idx: m.index, h: +m[1], min: +m[2] } : undefined;
      };
      // (?![\d.]) evita di leggere "08.12.2026" come orario 08:12.
      const T = String.raw`[^\d\n]{0,20}([01]?\d|2[0-3])[:.]([0-5]\d)(?![\d.])`;
      const ev = g.type === 'evento';
      const colT: { dep?: string; arr?: string } = rows.length ? timesFromRows(rows) : {};
      const asHit = (t?: string) => (t ? { idx: d.idx + 1, h: +t.slice(0, 2), min: +t.slice(3) } : undefined);
      const dep = (ev ? undefined : asHit(colT.dep)) ?? (ev
        ? labeled(new RegExp(String.raw`(?:inizio|beginn|start|show|ore)` + T, 'i')) ??
          labeled(new RegExp(String.raw`(?:apertura porte|doors|einlass)` + T, 'i'))
        : labeled(new RegExp(String.raw`(?:partenza|part\.|departure|departs?|dep\.|abfahrt|abflug|ab\b|départ|salida)` + T, 'i'))) ?? near[0];
      const arr = (ev ? undefined : asHit(colT.arr)) ?? labeled(new RegExp(String.raw`(?:arrivo|arr\.|arrival|arrives?|ankunft|an\b|arrivée|llegada|fine|ende)` + T, 'i'));
      if (dep) {
        g.departAt = `${day}T${pad(dep.h)}:${pad(dep.min)}`;
        const depMin = dep.h * 60 + dep.min;
        // Senza etichetta accettiamo solo un orario successivo nello stesso giorno.
        const a = arr ?? (ev ? undefined : near.find((t) => t.idx > dep.idx && t.h * 60 + t.min > depMin));
        if (a && a.h * 60 + a.min !== depMin) {
          // Se l'arrivo è "prima" della partenza, è il giorno dopo.
          const next = a.h * 60 + a.min < depMin;
          const ad = next ? new Date(d.y, d.m - 1, d.d + 1) : new Date(d.y, d.m - 1, d.d);
          g.arriveAt = `${ad.getFullYear()}-${pad(ad.getMonth() + 1)}-${pad(ad.getDate())}T${pad(a.h)}:${pad(a.min)}`;
        }
      } else {
        g.departAt = `${day}T00:00`;
      }
    }
  } catch {
    /* mai bloccare */
  }
  return g;
}

// ——— Posto ———
// Riconosce carrozza/posto (IT, DE, EN, FR, ES) e settore/fila/posto per gli eventi.
// Restituisce sempre etichette in italiano: "Carrozza 254 · Posto 46".
const SEAT_PARTS: [string, RegExp][] = [
  ['Carrozza', /(?<![A-Za-zÀ-ÿ])(?:carrozza|carr\.|wagen|wg\.|coach|voiture|vagón|coche)\s*(?:nr\.?|n\.|no\.?)?\s*[:.]?\s*(\d{1,3}[A-Z]?)\b/i],
  ['Settore', /(?:settore|sector|sektor|block|blocco|tribuna|tribüne|ingresso|eingang)\s*[:.]?\s*([A-Z0-9]{1,4})\b/i],
  ['Fila', /(?:fila|row|reihe|rang)\s*[:.]?\s*([A-Z0-9]{1,3})\b/i],
  ['Posto', /(?<![A-Za-zÀ-ÿ])(?:posto|posti|sitzplatz|platz|plätze|pl\.|seat|sitz|siège|place|asiento)\s*(?:nr\.?|n\.|no\.?)?\s*[:.]?\s*(\d{1,3}[A-K]?(?:\s*[,/+-]\s*\d{1,3}[A-K]?)*)\b/i],
];

// Riserva per il posto: il numero può stare una o due parole dopo ("Sitzplatz / FENSTER / 101").
const SEAT_LOOSE = /(?<![A-Za-zÀ-ÿ])(?:posto|sitzplatz|platz|seat|sitz)(?![A-Za-zÀ-ÿ])[\s.:]*(?:[A-Za-zÀ-ÿ]+[\s.:]+){0,2}?(\d{1,3}[A-K]?)\b(?![,.]\d)/i;

export function findSeat(text: string, loose = false): string | undefined {
  const parts: string[] = [];
  for (const [label, re] of SEAT_PARTS) {
    let m = re.exec(text);
    if (!m && loose && label === 'Posto') m = SEAT_LOOSE.exec(text);
    if (m) parts.push(`${label} ${m[1].replace(/\s+/g, '')}`);
  }
  // Senza "Posto" il resto (es. solo un ingresso) non basta.
  return parts.some((p) => p.startsWith('Posto')) ? parts.join(' · ') : undefined;
}

/** Numero di treno o volo, per le note: "ECE 85", "LH 498". */
function findNumber(text: string, type?: string): string | undefined {
  if (type === 'treno') {
    const m = /\b(ICE|IC|ECE|EC|RJX?|NJ|EN|FR|FA|FB|ITA|IR|IRE|RE|RB|TGV|TER|AVE|EST)\s?(\d{1,5})\b/.exec(text);
    if (m) return `${m[1]} ${m[2]}`;
  }
  if (type === 'volo') {
    const m = /(?:flight|flug(?:nummer)?|volo|vuelo|vol)\s*(?:no\.?|nr\.?|n\.)?\s*[:.]?\s*([A-Z0-9]{2})\s?(\d{1,4})\b/i.exec(text);
    if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  }
  return undefined;
}
