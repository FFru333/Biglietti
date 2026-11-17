export type TicketType = 'volo' | 'treno' | 'evento' | 'altro';

export interface StoredFile {
  name: string;
  mime: string;
  /** File originale (PDF o immagine). */
  blob: Blob;
  /** Prima pagina renderizzata (PNG). Per compatibilità: coincide con renders[0]. */
  render?: Blob;
  /** Tutte le pagine renderizzate (PDF) o l'immagine convertita (HEIC). */
  renders?: Blob[];
}

/** Una tratta di volo. Orari locali "come stampati" negli aeroporti di partenza e arrivo. */
export interface Segment {
  from: string;       // codice IATA
  to: string;
  departAt: string;   // "YYYY-MM-DDTHH:mm"
  arriveAt: string;
  flight?: string;    // "KL 1660"
  durationMin?: number;
  carrier?: string;   // "KLM Cityhopper"
  aircraft?: string;  // "Embraer 190"
  cabin?: string;     // "Economy"
}

export interface Ticket {
  id: string;
  type: TicketType;
  from: string;
  to: string;
  /** Data/ora locale "come stampata": "YYYY-MM-DDTHH:mm", nessuna conversione di fuso. */
  departAt: string;
  arriveAt?: string;
  trip?: string;
  /** Voli: tutte le tratte del viaggio (scali compresi), in ordine. */
  segments?: Segment[];
  /** Codice di prenotazione (PNR). */
  pnr?: string;
  /** Nomi dei passeggeri. */
  passengers?: string[];
  /** Posto in forma leggibile: "Carrozza 5 · Posto 12A", "Settore B · Fila 12 · Posto 7". */
  seat?: string;
  note?: string;
  file: StoredFile & {
    /** Miniatura JPEG (non più mostrata in griglia, tenuta per compatibilità). */
    thumb?: Blob;
  };
  /** Altri file dello stesso biglietto (es. più screenshot). */
  more?: StoredFile[];
  createdAt: number;
  demo?: boolean;
}

export type TicketDraft = Omit<Ticket, 'id' | 'createdAt'> & { id?: string; createdAt?: number };

export const TYPE_LABEL: Record<TicketType, string> = { volo: 'Volo', treno: 'Treno', evento: 'Evento', altro: 'Altro' };
export const TYPE_SECTION: Record<TicketType, string> = { volo: 'Voli', treno: 'Treni', evento: 'Eventi', altro: 'Altro' };
export const TYPES: TicketType[] = ['volo', 'treno', 'evento', 'altro'];

/** Gli eventi hanno titolo + luogo invece di partenza → arrivo. */
export const isEvent = (t: { type: TicketType }) => t.type === 'evento';

const pagesOfFile = (f: StoredFile): Blob[] =>
  f.renders?.length ? f.renders : f.render ? [f.render] : f.mime.startsWith('image/') ? [f.blob] : [];

/** Pagine da mostrare: tutte quelle di tutti i file del biglietto. */
export function pagesOf(t: Ticket): Blob[] {
  return [t.file, ...(t.more ?? [])].flatMap(pagesOfFile);
}

/** Tutti i file originali del biglietto. */
export const filesOf = (t: Ticket): StoredFile[] => [t.file, ...(t.more ?? [])];
