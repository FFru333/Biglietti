import { useState } from 'preact/hooks';
import { countdown, formatTime, parseLocal } from '../dates';
import { href } from '../router';
import { TypeIcon } from '../icons';
import type { Ticket } from '../types';
import { Extra, Route } from './Card';

function Tile({ t, past, showTrip }: { t: Ticket; past?: boolean; showTrip?: boolean }) {
  const d = parseLocal(t.departAt);
  const date = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  const day = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][d.getDay()];
  return (
    <a class={`ticket${past ? ' is-past' : ''}`} href={href.view(t.id)} aria-label={`${date}, apri il biglietto`}>
      <div class="ticket-stub">
        <span class="ticket-date num">{date}</span>
      </div>
      <div class="ticket-perf" aria-hidden="true" />
      <div class="ticket-body">
        <div class="ticket-route"><Route t={t} /></div>
        <div class="ticket-time num">
          {day} · <b>{formatTime(t.departAt)}</b>
          {t.arriveAt && <> – <b>{formatTime(t.arriveAt)}</b></>}
        </div>
        <Extra t={t} />
        <div class="ticket-foot">
          <span class="tag">
            <TypeIcon type={t.type} size={13} />
            {showTrip && t.trip && <span>{t.trip}</span>}
          </span>
          {!past && <span class="ticket-count num">{countdown(t.departAt)}</span>}
        </div>
      </div>
    </a>
  );
}

export function Grid({ future, past, showTrip }: { future: Ticket[]; past: Ticket[]; showTrip?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {future.length > 0 && (
        <div class="grid">{future.map((t) => <Tile key={t.id} t={t} showTrip={showTrip} />)}</div>
      )}
      {past.length > 0 && (
        <section class="section grid-past">
          <button class="past-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span>Passati <span class="num">({past.length})</span></span>
            <span class="past-sign" aria-hidden="true">{open ? '−' : '+'}</span>
          </button>
          {open && <div class="grid">{past.map((t) => <Tile key={t.id} t={t} past showTrip={showTrip} />)}</div>}
        </section>
      )}
    </>
  );
}
