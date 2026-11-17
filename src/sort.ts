import { isPast, ts } from './dates';
import type { Ticket } from './types';

export const byDepart = (a: Ticket, b: Ticket) => ts(a.departAt) - ts(b.departAt);

export function split(list: Ticket[], now = Date.now()) {
  const future = list.filter((t) => !isPast(t, now)).sort(byDepart);
  const past = list.filter((t) => isPast(t, now)).sort((a, b) => byDepart(b, a));
  return { future, past };
}

/** Tratte dello stesso viaggio in ordine cronologico (o solo il biglietto, se senza viaggio). */
export function legsOf(t: Ticket, list: Ticket[]) {
  if (!t.trip) return [t];
  return list.filter((x) => x.trip === t.trip).sort(byDepart);
}
