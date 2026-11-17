import { Arrow, TypeIcon } from '../icons';
import { countdown, formatShort, formatTime } from '../dates';
import { href } from '../router';
import { TYPE_LABEL, isEvent, type Ticket } from '../types';

/** Giorni di differenza tra arrivo e partenza (0 se stesso giorno). */
export function plusDays(t: Ticket) {
  if (!t.arriveAt) return 0;
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(t.arriveAt) - d(t.departAt)) / 86400000);
}

export function Route({ t }: { t: Ticket }) {
  if (isEvent(t)) return <span class="route">{t.from}</span>;
  return (
    <span class="route">
      <span>{t.from}</span>
      <Arrow />
      <span>{t.to}</span>
    </span>
  );
}

export function When({ t }: { t: Ticket }) {
  return (
    <span class="when num">
      {formatShort(t.departAt)}
      {t.arriveAt && <> – {formatTime(t.arriveAt)}{plusDays(t) > 0 && <sup class="plus-day">+{plusDays(t)}</sup>}</>}
    </span>
  );
}

/** Riga secondaria: luogo (eventi) e posto. */
export function Extra({ t }: { t: Ticket }) {
  const bits = [isEvent(t) ? t.to : '', t.seat].filter(Boolean);
  if (!bits.length) return null;
  return <span class="extra num">{bits.join(' · ')}</span>;
}

export function Tag({ t, showTrip = true }: { t: Ticket; showTrip?: boolean }) {
  return (
    <span class="tag">
      <TypeIcon type={t.type} size={15} />
      <span>{TYPE_LABEL[t.type]}</span>
      {showTrip && t.trip && <><span class="sep">/</span><span>{t.trip}</span></>}
    </span>
  );
}

export function Card({ t, past, showTrip }: { t: Ticket; past?: boolean; showTrip?: boolean }) {
  return (
    <a class={`card${past ? ' is-past' : ''}`} href={href.view(t.id)}>
      <div class="card-top">
        <Tag t={t} showTrip={showTrip} />
        {!past && <span class="countdown num">{countdown(t.departAt)}</span>}
      </div>
      <h3 class="card-route"><Route t={t} /></h3>
      <When t={t} />
      <Extra t={t} />
    </a>
  );
}

export function NextCard({ t, showTrip }: { t: Ticket; showTrip?: boolean }) {
  return (
    <a class="next" href={href.view(t.id)}>
      <div class="card-top">
        <span class="next-label">Prossimo</span>
        <span class="countdown num">{countdown(t.departAt)}</span>
      </div>
      <h2 class="next-route"><Route t={t} /></h2>
      <div class="next-meta">
        <When t={t} />
        <Tag t={t} showTrip={showTrip} />
      </div>
      <Extra t={t} />
    </a>
  );
}
