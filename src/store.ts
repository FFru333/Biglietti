import { useEffect, useState } from 'preact/hooks';
import { allTickets } from './db';
import type { Ticket } from './types';

// Stato minimo condiviso: lista biglietti in memoria + file in attesa di essere salvato.
let tickets: Ticket[] | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export async function reload() {
  tickets = await allTickets();
  emit();
}

export function useTickets(): Ticket[] | null {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((n) => n + 1);
    subs.add(f);
    if (!tickets) reload();
    return () => void subs.delete(f);
  }, []);
  return tickets;
}

export let pendingFiles: File[] = [];
export const setPendingFiles = (f: File[]) => (pendingFiles = f);

/** Valori distinti già usati (per autocomplete), dal più frequente. */
export function distinct(list: Ticket[], pick: (t: Ticket) => (string | undefined)[]) {
  const m = new Map<string, number>();
  list.forEach((t) => pick(t).forEach((v) => v && m.set(v.trim(), (m.get(v.trim()) ?? 0) + 1)));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}
