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
  const re3 = new RegExp(`\\b(\\d{1,2})\\.?\\s*(${MONTH_RE})\\.?,?\\s*(\\d{4}|\\d{2})?\\b`, 'gi'); // 8 dicembre 2026, 08DEC26
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
  const re = /(?<![\d.:/])([01]?\d|2[0-3])[:.h]([0-5]\d)(?![\d.:/])/g;
  let r: RegExpExecArray | null;
  while ((r = re.exec(text))) out.push({ idx: r.index, h: +r[1], min: +r[2] });
  return out;
}

const AIRLINE = /\b(boarding|imbarco|gate|flight|volo|flug|abflug|flugnummer|vuelo|airline|airways|lufthansa|ita airways|alitalia|ryanair|easyjet|aeromexico|aeroméxico|condor|eurowings|klm|air france|iberia|swiss|austrian|bordkarte|boarding pass|carta d'imbarco)/i;
const RAIL = /\b(trenitalia|italo|frecciarossa|frecciargento|intercity|regionale|treno|train|zug|bahn|fahrkarte|reservierung|hbf|db fernverkehr|deutsche bahn|öbb|oebb|railjet|sbb|cff|ffs|sncf|renfe|eurostar|nightjet|carrozza|wagen|coach\s*\d|binario|gleis|ICE\s?\d|ECE?\s?\d)/i;
const EVENT = /\b(concert|concerto|konzert|festival|teatro|theater|theatre|stadio|stadion|stadium|arena|palazzetto|ingresso|eintritt|einlass|admission|ticketone|ticketmaster|eventim|vivaticket|dice\.fm|tour 20\d\d|spettacolo|show|museo|museum|mostra|ausstellung)/i;

// IATA: parole di tre lettere maiuscole da non scambiare per aeroporti.
const NOT_IATA = new Set('THE AND FOR EUR USD MXN PNR REF VAT IVA TAX NON PER DEL DIE DER DAS UND VON NACH ORE ORA GATE SEQ PAX MRS MRS MR MS ECO BUS FLY YES OUT SEAT ADT CHD INF DOC NUM CAB BAG KG OK'.split(' '));

function findRoute(text: string, known: string[]): { from?: string; to?: string } {
  // 1. Etichette esplicite su righe separate.
  const lab = (re: RegExp) => {
    const m = re.exec(text);
    return m?.[1]?.trim().replace(/\s{2,}.*/, '').slice(0, 40);
  };
  const from = lab(/(?:^|\n)\s*(?:da|from|von|partenza|departure|abfahrt|départ|origin|origine)\s*[:\-]?\s*([^\n\d]{3,40})/i);
  const to = lab(/(?:^|\n)\s*(?:a|to|nach|arrivo|arrival|ankunft|arrivée|destination|destinazione)\s*[:\-]\s*([^\n\d]{3,40})/i);
  if (from && to && from !== to) return { from: tidy(from), to: tidy(to) };

  // 1b. "von X nach Y" / "from X to Y" nella stessa riga.
  const inline = /\b(?:von|from)\s+([A-ZÀ-Ý][\p{L} .'’()-]{1,30}?)\s+(?:nach|to)\s+([A-ZÀ-Ý][\p{L} .'’()-]{1,30}?)(?=\s{2,}|\s*[\n,;(]|\s+\d|$)/u.exec(text);
  if (inline) return { from: tidy(inline[1]), to: tidy(inline[2]) };

  // 2. "X → Y" / "X - Y" / "X > Y" su una riga (anche dopo "Hinfahrt:", "Andata:" …).
  const arrow = /(?:^|\n)\s*(?:(?:[Hh]infahrt|[Rr]ückfahrt|[Aa]ndata|[Rr]itorno|[Oo]utbound|[Rr]eturn|[Ss]trecke|[Tt]ratta|[Rr]oute|[Pp]ercorso)\s*:?\s*)?([A-ZÀ-Ý][\p{L} .'’()-]{1,30}?)\s*(?:→|›|»|>|–|—| - | to | nach )\s*([A-ZÀ-Ý][\p{L} .'’()-]{1,30}?)\s*(?:\n|$)/u.exec(text);
  if (arrow) return { from: tidy(arrow[1]), to: tidy(arrow[2]) };

  // 3. Codici IATA (MUC MEX, MUC-MEX, MUC/MEX).
  const iata = /\b([A-Z]{3})\s*(?:-|–|→|\/|>|\s)\s*([A-Z]{3})\b/g;
  let r: RegExpExecArray | null;
  while ((r = iata.exec(text))) {
    if (!NOT_IATA.has(r[1]) && !NOT_IATA.has(r[2]) && r[1] !== r[2]) return { from: r[1], to: r[2] };
  }

  // 3b. "MUNICH MUC  FRANKFURT FRA" (carte d'imbarco).
  const cityCode = /\b[A-Z][A-Z .-]{2,20}?\s\(?([A-Z]{3})\)?\s+(?:→|-|–|>|TO\s)?\s*[A-Z][A-Z .-]{2,20}?\s\(?([A-Z]{3})\)?(?=\s|$)/.exec(text);
  if (cityCode && !NOT_IATA.has(cityCode[1]) && !NOT_IATA.has(cityCode[2]) && cityCode[1] !== cityCode[2])
    return { from: cityCode[1], to: cityCode[2] };

  // 4. Luoghi già usati, nell'ordine in cui compaiono nel testo.
  const lower = text.toLowerCase();
  const found = known
    .map((k) => ({ k, i: lower.indexOf(k.toLowerCase()) }))
    .filter((x) => x.k.length >= 3 && x.i >= 0)
    .sort((a, b) => a.i - b.i);
  if (found.length >= 2 && found[0].k !== found[1].k) return { from: found[0].k, to: found[1].k };
  return {};
}

const tidy = (s: string) =>
  s.replace(/\s+/g, ' ').replace(/[\s,:;.\-–]+$/, '').trim().replace(/\b(\p{L})(\p{L}*)/gu, (_, a: string, b: string) =>
    s === s.toUpperCase() ? a + b.toLowerCase() : a + b);

export function guessFromText(text: string, known: string[] = []): Guess {
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
      const route = findRoute(text, known);
      if (route.from) g.from = route.from;
      if (route.to) g.to = route.to;
    }
    const seat = findSeat(text);
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
      const dep = (ev
        ? labeled(new RegExp(String.raw`(?:inizio|beginn|start|show|ore)` + T, 'i')) ??
          labeled(new RegExp(String.raw`(?:apertura porte|doors|einlass)` + T, 'i'))
        : labeled(new RegExp(String.raw`(?:partenza|part\.|departure|departs?|dep\.|abfahrt|abflug|ab\b|départ|salida)` + T, 'i'))) ?? near[0];
      const arr = labeled(new RegExp(String.raw`(?:arrivo|arr\.|arrival|arrives?|ankunft|an\b|arrivée|llegada|fine|ende)` + T, 'i'));
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
  ['Carrozza', /(?:carrozza|carr\.|wagen|wg\.|coach|voiture|vagón|coche)\s*(?:nr\.?|n\.|no\.?)?\s*[:.]?\s*(\d{1,3}[A-Z]?)\b/i],
  ['Settore', /(?:settore|sector|sektor|block|blocco|tribuna|tribüne|ingresso|eingang)\s*[:.]?\s*([A-Z0-9]{1,4})\b/i],
  ['Fila', /(?:fila|row|reihe|rang)\s*[:.]?\s*([A-Z0-9]{1,3})\b/i],
  ['Posto', /(?:posto|posti|sitzplatz|platz|plätze|pl\.|seat|sitz|siège|place|asiento)\s*(?:nr\.?|n\.|no\.?)?\s*[:.]?\s*(\d{1,3}[A-K]?(?:\s*[,/+-]\s*\d{1,3}[A-K]?)*)\b/i],
];

export function findSeat(text: string): string | undefined {
  const parts: string[] = [];
  for (const [label, re] of SEAT_PARTS) {
    const m = re.exec(text);
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
