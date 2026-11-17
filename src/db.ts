import { openDB, type IDBPDatabase } from 'idb';
import type { Ticket } from './types';

let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  dbp ??= openDB('biglietti', 1, {
    upgrade(d) {
      d.createObjectStore('tickets', { keyPath: 'id' });
      d.createObjectStore('meta');
    },
  });
  return dbp;
}

export async function allTickets(): Promise<Ticket[]> {
  return (await db()).getAll('tickets');
}
export async function getTicket(id: string): Promise<Ticket | undefined> {
  return (await db()).get('tickets', id);
}
export async function putTicket(t: Ticket) {
  await (await db()).put('tickets', t);
}
export async function putTickets(ts: Ticket[]) {
  const tx = (await db()).transaction('tickets', 'readwrite');
  await Promise.all([...ts.map((t) => tx.store.put(t)), tx.done]);
}
export async function deleteTicket(id: string) {
  await (await db()).delete('tickets', id);
}
export async function deleteTickets(ids: string[]) {
  const tx = (await db()).transaction('tickets', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db()).get('meta', key);
}
export async function setMeta(key: string, value: unknown) {
  await (await db()).put('meta', value, key);
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
