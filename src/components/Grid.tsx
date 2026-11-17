import { useState } from 'preact/hooks';
import { countdown, formatTime, parseLocal } from '../dates';
import { href } from '../router';
import { TypeIcon } from '../icons';
import { TYPE_LABEL, type Ticket } from '../types';
import { Route } from './Card';

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function Tile({ t, past, showTrip }: { t: Ticket; past?: boolean; showTrip?: boolean }) {
  const d = parseLocal(t.departAt);
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return (
    <a class={`ticket${past ? ' is-past' : ''}`} href={href.view(t.id)}
      aria-label={`${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}, apri il biglietto`}>
      <div class="ticket-stub">
        <span class="ticket-date num">{d.getDate()}/{d.getMonth() + 1}</span>
        <span class="ticket-day">{GIORNI[d.getDay()]}{thisYear ? '' : ` ${d.getFullYear()}`}</span>
      </div>
      <div class="ticket-perf" aria-hidden="true" />
      <div class="ticket-body">
        <div class="ticket-route"><Route t={t} /></div>
        <div class="ticket-time num">
          <span>{formatTime(t.departAt)}</span>
          {t.arriveAt && <><span class="ticket-dash">—</span><span>{formatTime(t.arriveAt)}</span></>}
        </div>
        {(t.seat || (t.type === 'evento' && t.to)) && (
          <div class="ticket-meta">{[t.type === 'evento' ? t.to : '', t.seat].filter(Boolean).join(' · ')}</div>
        )}
        <div class="ticket-foot">
          <span class="ticket-kind">
            <TypeIcon type={t.type} size={12} />
            <span>{showTrip && t.trip ? t.trip : TYPE_LABEL[t.type]}</span>
          </span>
          {!past && <span class="ticket-count num">{countdown(t.departAt)}</span>}
        </div>
      </div>
    </a>
  );
}

/** Raggruppa per mese di partenza (in ordine), con l'anno solo se diverso dall'attuale. */
function byMonth(list: Ticket[]) {
  const groups: { key: string; label: string; items: Ticket[] }[] = [];
  const now = new Date().getFullYear();
  for (const t of list) {
    const d = parseLocal(t.departAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: MESI[d.getMonth()] + (d.getFullYear() !== now ? ` ${d.getFullYear()}` : ''), items: [] };
      groups.push(g);
    }
    g.items.push(t);
  }
  return groups;
}

function Months({ list, past, showTrip }: { list: Ticket[]; past?: boolean; showTrip?: boolean }) {
  return (
    <>
      {byMonth(list).map((g) => (
        <section class="month" key={g.key} aria-label={g.label}>
          <h2 class="month-label">{g.label}</h2>
          <div class="grid">{g.items.map((t) => <Tile key={t.id} t={t} past={past} showTrip={showTrip} />)}</div>
        </section>
      ))}
    </>
  );
}

export function Grid({ future, past, showTrip }: { future: Ticket[]; past: Ticket[]; showTrip?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Months list={future} showTrip={showTrip} />
      {past.length > 0 && (
        <section class="section grid-past">
          <button class="past-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span>Passati <span class="num">({past.length})</span></span>
            <span class="past-sign" aria-hidden="true">{open ? '−' : '+'}</span>
          </button>
          {open && <Months list={past} past showTrip={showTrip} />}
        </section>
      )}
    </>
  );
}
