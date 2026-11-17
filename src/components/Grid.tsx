import { useEffect, useMemo, useState } from 'preact/hooks';
import { countdown, formatTime, parseLocal } from '../dates';
import { href } from '../router';
import { TypeIcon } from '../icons';
import { pagesOf, type Ticket } from '../types';
import { Extra, Route } from './Card';

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

function useObjectUrl(b?: Blob) {
  const url = useMemo(() => (b ? URL.createObjectURL(b) : ''), [b]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

function Tile({ t, past, showTrip }: { t: Ticket; past?: boolean; showTrip?: boolean }) {
  const src = useObjectUrl(t.file.thumb ?? pagesOf(t)[0]);
  const d = parseLocal(t.departAt);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return (
    <a class={`tile${past ? ' is-past' : ''}`} href={href.view(t.id)}>
      <div class="tile-thumb">
        {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <TypeIcon type={t.type} size={28} />}
      </div>
      <div class="tile-date num">
        <span class="tile-day">{d.getDate()}</span>
        <span class="tile-month">
          <span>{MESI[d.getMonth()]}{year}</span>
          <span>{GIORNI[d.getDay()]} · {formatTime(t.departAt)}</span>
        </span>
      </div>
      <div class="tile-route"><Route t={t} /></div>
      <Extra t={t} />
      <div class="tile-foot">
        <span class="tag"><TypeIcon type={t.type} size={13} />{showTrip && t.trip && <span>{t.trip}</span>}</span>
        {!past && <span class="countdown num">{countdown(t.departAt)}</span>}
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
