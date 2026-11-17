// Dati demo: biglietti finti con un codice fittizio disegnato su canvas. Rimovibili in un tap.
import { allTickets, deleteTickets, putTickets, uid } from './db';
import { toLocalInput } from './dates';
import { makeThumb } from './files';
import type { Ticket, TicketType } from './types';

function at(daysFromNow: number, hh: number, mm: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hh, mm, 0, 0);
  return toLocalInput(d);
}

// PRNG deterministico per il pattern del codice finto.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

async function fakeTicket(title: string, sub: string, seed: number): Promise<Blob> {
  const W = 1240, H = 1754; // A4 a 150 dpi
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#111';
  g.font = '600 56px system-ui, sans-serif';
  g.fillText(title, 100, 170);
  g.font = '400 34px system-ui, sans-serif';
  g.fillText(sub, 100, 230);
  g.fillText('DEMO — biglietto non valido', 100, 290);
  // Codice 2D fittizio: 33×33 moduli con mirino centrale (stile Aztec).
  const N = 33, S = 22, ox = (W - N * S) / 2, oy = 420;
  const r = rng(seed);
  const mid = (N - 1) / 2;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const ring = Math.max(Math.abs(x - mid), Math.abs(y - mid));
      const on = ring <= 5 ? ring % 2 === 0 : r() > 0.5;
      if (on) g.fillRect(ox + x * S, oy + y * S, S, S);
    }
  g.fillRect(100, oy + N * S + 120, W - 200, 2);
  g.font = '400 30px system-ui, sans-serif';
  ['Passeggero  ROSSI / MARIO', 'Classe  2', 'Codice  DEMO' + seed].forEach((l, i) =>
    g.fillText(l, 100, oy + N * S + 200 + i * 56));
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

export async function loadDemo() {
  // tipo, da, a, partenza, arrivo, viaggio, posto, note
  const rows: [TicketType, string, string, string, string | undefined, string | undefined, string | undefined, string?][] = [
    ['treno', 'München Hbf', 'Bologna C.le', at(-10, 7, 28), at(-10, 14, 10), undefined, 'Carrozza 254 · Posto 46', 'ECE 85'],
    ['treno', 'Bologna C.le', 'Cesena', at(2, 9, 47), at(2, 10, 33), 'Natale', 'Carrozza 3 · Posto 12A', 'Regionale 17521'],
    ['treno', 'Cesena', 'Bologna C.le', at(6, 18, 12), at(6, 19, 2), 'Natale', undefined],
    ['evento', 'Concerto di Capodanno', 'Teatro Comunale, Bologna', at(14, 21, 0), undefined, 'Natale', 'Platea · Fila 12 · Posto 7'],
    ['volo', 'MUC', 'FRA', at(21, 7, 5), at(21, 8, 0), 'Messico', 'Posto 12C', 'LH 95 · Scalo a Francoforte'],
    ['volo', 'FRA', 'MEX', at(21, 10, 15), at(21, 15, 20), 'Messico', 'Posto 42K', 'LH 498'],
    ['volo', 'MEX', 'MUC', at(35, 20, 30), at(36, 15, 5), 'Messico', 'Posto 38A', 'LH 499'],
  ];
  const now = Date.now();
  const tickets: Ticket[] = [];
  for (let i = 0; i < rows.length; i++) {
    const [type, from, to, departAt, arriveAt, trip, seat, note] = rows[i];
    const blob = await fakeTicket(type === 'evento' ? from : `${from} → ${to}`, departAt.replace('T', '  '), i + 7);
    tickets.push({
      id: uid(), type, from, to, departAt, arriveAt, trip, seat, note,
      file: { name: `demo-${i + 1}.png`, mime: 'image/png', blob, thumb: await makeThumb(blob) },
      createdAt: now + i, demo: true,
    });
  }
  await putTickets(tickets);
}

export async function removeDemo() {
  const ids = (await allTickets()).filter((t) => t.demo).map((t) => t.id);
  await deleteTickets(ids);
  return ids.length;
}
