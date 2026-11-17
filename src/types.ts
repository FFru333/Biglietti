export type TicketType = 'volo' | 'treno' | 'evento' | 'altro';

export interface Ticket {
  id: string;
  type: TicketType;
  from: string;
  to: string;
  /** Data/ora locale "come stampata": "YYYY-MM-DDTHH:mm", nessuna conversione di fuso. */
  departAt: string;
  arriveAt?: string;
  trip?: string;
  /** Posto in forma leggibile: "Carrozza 5 · Posto 12A", "Settore B · Fila 12 · Posto 7". */
  seat?: string;
  note?: string;
  file: {
    name: string;
    mime: string;
    /** File originale (PDF o immagine). */
    blob: Blob;
    /** Prima pagina renderizzata (PNG). Mantenuta per compatibilità: coincide con renders[0]. */
    render?: Blob;
    /** Tutte le pagine renderizzate (PDF), nell'ordine. */
    renders?: Blob[];
    /** Miniatura JPEG per la vista "Anteprime". */
    thumb?: Blob;
  };
  createdAt: number;
  demo?: boolean;
}

export type TicketDraft = Omit<Ticket, 'id' | 'createdAt'> & { id?: string; createdAt?: number };

export const TYPE_LABEL: Record<TicketType, string> = { volo: 'Volo', treno: 'Treno', evento: 'Evento', altro: 'Altro' };
export const TYPE_SECTION: Record<TicketType, string> = { volo: 'Voli', treno: 'Treni', evento: 'Eventi', altro: 'Altro' };
export const TYPES: TicketType[] = ['volo', 'treno', 'evento', 'altro'];

/** Gli eventi hanno titolo + luogo invece di partenza → arrivo. */
export const isEvent = (t: { type: TicketType }) => t.type === 'evento';

/** Pagine da mostrare: tutte quelle renderizzate, o l'immagine originale. */
export function pagesOf(t: Ticket): Blob[] {
  if (t.file.renders?.length) return t.file.renders;
  if (t.file.render) return [t.file.render];
  if (t.file.mime.startsWith('image/')) return [t.file.blob];
  return [];
}
