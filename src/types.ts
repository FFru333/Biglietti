export type TicketType = 'volo' | 'treno' | 'altro';

export interface Ticket {
  id: string;
  type: TicketType;
  from: string;
  to: string;
  /** Data/ora locale "come stampata": "YYYY-MM-DDTHH:mm", nessuna conversione di fuso. */
  departAt: string;
  arriveAt?: string;
  trip?: string;
  note?: string;
  file: {
    name: string;
    mime: string;
    /** File originale (PDF o immagine). */
    blob: Blob;
    /** Prima pagina renderizzata (PNG) — quella che si mostra a schermo. */
    render?: Blob;
  };
  createdAt: number;
  demo?: boolean;
}

export type TicketDraft = Omit<Ticket, 'id' | 'createdAt'> & { id?: string; createdAt?: number };

export const TYPE_LABEL: Record<TicketType, string> = { volo: 'Volo', treno: 'Treno', altro: 'Altro' };
export const TYPE_SECTION: Record<TicketType, string> = { volo: 'Voli', treno: 'Treni', altro: 'Altro' };
export const TYPES: TicketType[] = ['volo', 'treno', 'altro'];
