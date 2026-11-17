import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { formatLong, formatTime, parseLocal } from '../dates';
import { airportList } from '../places';
import { Arrow } from '../icons';
import type { Segment, Ticket } from '../types';

const city = (code: string) => airportList().get(code) ?? '';
const mins = (a: string, b: string) => Math.round((+parseLocal(b) - +parseLocal(a)) / 60000);
export const dur = (m?: number) => (m == null || m < 0 ? '' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);
const dayDiff = (a: string, b: string) => {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(b) - d(a)) / 86400000);
};

/** Durata totale: voli (se noti) + coincidenze. */
export function totalDuration(segs: Segment[]) {
  if (segs.some((s) => s.durationMin == null)) return undefined;
  let t = 0;
  segs.forEach((s, i) => {
    t += s.durationMin!;
    if (i + 1 < segs.length) t += mins(s.arriveAt, segs[i + 1].departAt);
  });
  return t;
}

export const stopsLabel = (segs: Segment[]) =>
  segs.length === 1 ? 'Diretto' : `${segs.length - 1} ${segs.length === 2 ? 'scalo' : 'scali'} · ${segs.slice(0, -1).map((s) => s.to).join(', ')}`;

export function FlightHeader({ t }: { t: Ticket }) {
  const segs = t.segments!;
  const first = segs[0], last = segs[segs.length - 1];
  const total = totalDuration(segs);
  return (
    <section class="fl-hero">
      <p class="fl-date">{formatLong(first.departAt)}</p>
      <h1 class="fl-codes">
        <span>{first.from}</span>
        <Arrow />
        <span>{last.to}</span>
      </h1>
      <p class="fl-cities">{city(first.from)}{city(first.from) && city(last.to) ? ' → ' : ''}{city(last.to)}</p>
      <p class="fl-meta num">
        <span>{stopsLabel(segs)}</span>
        {total != null && <span>Totale {dur(total)}</span>}
      </p>
    </section>
  );
}

export function Booking({ t }: { t: Ticket }) {
  const [copied, setCopied] = useState(false);
  const pax = t.passengers ?? [];
  if (!t.pnr && !pax.length) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(t.pnr!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard non disponibile */ }
  };
  return (
    <section class="fl-booking">
      {t.pnr && (
        <button class="fl-pnr" onClick={copy} aria-label={`Copia il codice di prenotazione ${t.pnr}`}>
          <span class="fl-label">Codice prenotazione</span>
          <span class="fl-pnr-code num">{t.pnr}</span>
          <span class="fl-copy">{copied ? 'Copiato' : 'Copia'}</span>
        </button>
      )}
      {pax.length > 0 && (
        <div class="fl-pax">
          <span class="fl-label">{pax.length === 1 ? '1 passeggero' : `${pax.length} passeggeri`}</span>
          <ul>{pax.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

export function Timeline({ segs }: { segs: Segment[] }) {
  const d0 = segs[0].departAt;
  const plus = (s: string) => {
    const n = dayDiff(d0, s);
    return n > 0 ? <sup class="plus-day">+{n}</sup> : null;
  };
  return (
    <ol class="tl">
      {segs.map((s, k) => (
        <Fragment key={k}>
          <li class="tl-stop">
            <time class="tl-time num">{formatTime(s.departAt)}{plus(s.departAt)}</time>
            <div class="tl-place"><b>{s.from}</b> <span>{city(s.from)}</span></div>
          </li>
          <li class="tl-leg">
            <span class="tl-flight num">{s.flight ?? 'Volo'}</span>
            <span class="tl-info num">{[dur(s.durationMin), s.carrier, s.aircraft, s.cabin].filter(Boolean).join(' · ')}</span>
          </li>
          <li class="tl-stop">
            <time class="tl-time num">{s.arriveAt ? formatTime(s.arriveAt) : '—'}{s.arriveAt && plus(s.arriveAt)}</time>
            <div class="tl-place"><b>{s.to}</b> <span>{city(s.to)}</span></div>
          </li>
          {k + 1 < segs.length && (
            <li class="tl-transfer num">
              Coincidenza{s.arriveAt ? ` ${dur(mins(s.arriveAt, segs[k + 1].departAt))}` : ''}
              {segs[k + 1].from !== s.to && ` · cambio aeroporto ${s.to} → ${segs[k + 1].from}`}
            </li>
          )}
        </Fragment>
      ))}
    </ol>
  );
}
