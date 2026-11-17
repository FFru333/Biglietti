import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { useTickets, reload } from '../store';
import { back, go, href } from '../router';
import { legsOf } from '../sort';
import { deleteTicket } from '../db';
import { isPdf } from '../files';
import { needsUpgrade, upgradeTicket } from '../upgrade';
import { filesOf, isEvent, pagesOf } from '../types';
import { Booking, FlightHeader, Timeline } from './Flight';
import { countdown, formatLong, formatTime } from '../dates';
import { useWakeLock } from '../wakelock';
import { BackIcon, ChevronIcon } from '../icons';
import { Route, Tag, plusDays } from './Card';
import { Zoom } from './Zoom';

export function TicketView({ id }: { id: string }) {
  const all = useTickets();
  const t = all?.find((x) => x.id === id);
  const legs = useMemo(() => (t && all ? legsOf(t, all) : []), [t, all]);
  const i = legs.findIndex((x) => x.id === id);
  const [confirm, setConfirm] = useState(false);
  useWakeLock();

  const pages = useMemo(() => (t ? pagesOf(t) : []), [t]);
  const urls = useMemo(() => pages.map((b) => URL.createObjectURL(b)), [pages]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  // Pagine o miniatura mancanti (biglietti salvati prima, o elaborazione interrotta): le generiamo ora.
  useEffect(() => {
    if (t && needsUpgrade(t)) upgradeTicket(t).then((ok) => { if (ok) reload(); });
  }, [t?.id]);

  const step = useCallback((dir: 1 | -1) => {
    const n = legs[i + dir];
    if (n) go(href.view(n.id), true);
  }, [legs, i]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'Escape') back();
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [step]);

  if (!all) return <main class="page view" />;
  if (!t) {
    return (
      <main class="page view">
        <header class="bar"><button class="icon-btn" aria-label="Indietro" onClick={() => go(href.home, true)}><BackIcon /></button></header>
        <p class="empty">Biglietto non trovato.</p>
      </main>
    );
  }

  const openOriginal = async () => {
    const all = filesOf(t).map((x) => new File([x.blob], x.name, { type: x.mime }));
    const file = all[0];
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    // In modalità standalone su iOS l'apertura di blob: è inaffidabile; il foglio di
    // condivisione offre anteprima, "Salva su File" e "Apri in…".
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone && nav.canShare?.({ files: all })) {
      try { await nav.share({ files: all }); } catch { /* annullato */ }
      return;
    }
    const u = URL.createObjectURL(file);
    window.open(u, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(u), 60_000);
  };

  const isFlight = !!t.segments?.length;

  const remove = async () => {
    await deleteTicket(t.id);
    await reload();
    go(href.home, true);
  };

  return (
    <main class="page view">
      <header class="bar view-bar">
        <button class="icon-btn" aria-label="Chiudi" onClick={back}><BackIcon /></button>
        {legs.length > 1 ? (
          <div class="legs num" aria-label={`Tratta ${i + 1} di ${legs.length}`}>
            <button class="icon-btn small flip" aria-label="Tratta precedente" disabled={i <= 0} onClick={() => step(-1)}><ChevronIcon /></button>
            <span>{i + 1} / {legs.length}</span>
            <button class="icon-btn small" aria-label="Tratta successiva" disabled={i >= legs.length - 1} onClick={() => step(1)}><ChevronIcon /></button>
          </div>
        ) : <span />}
        <span class="countdown num">{countdown(t.departAt)}</span>
      </header>

      {isFlight && (
        <>
          <FlightHeader t={t} />
          <Booking t={t} />
          <Timeline segs={t.segments!} />
          {t.seat && <p class="fl-seat num"><span class="fl-label">Posto</span>{t.seat}</p>}
          {t.note && <p class="fl-note">{t.note}</p>}
          <button class="fl-source" onClick={openOriginal}>
            <span class="fl-label">Documento originale</span>
            <span class="fl-source-name">{t.file.name}{t.more?.length ? ` + ${t.more.length}` : ''}</span>
            <span class="fl-source-open" aria-hidden="true">Apri</span>
          </button>
        </>
      )}

      {!isFlight && t.seat && <p class="seat-strip num">{t.seat}</p>}

      {!isFlight && <div class="stage">
        {urls.length ? (
          urls.map((u, n) => (
            <div class="sheet" key={u}>
              {urls.length > 1 && <span class="sheet-no num">{n + 1} / {urls.length}</span>}
              <Zoom src={u} alt={`Biglietto ${t.from}${t.to ? ` – ${t.to}` : ''}, pagina ${n + 1}`} onSwipe={legs.length > 1 ? step : undefined} />
            </div>
          ))
        ) : (
          <div class="stage-empty">
            <p>{isPdf({ type: t.file.mime, name: t.file.name }) ? 'Preparazione del biglietto…' : 'Anteprima non disponibile.'}</p>
            <button class="text-btn" onClick={openOriginal}>Apri il file originale</button>
          </div>
        )}
      </div>}

      <section class="details">
        {!isFlight && <>
        <Tag t={t} />
        <h1 class="view-route"><Route t={t} /></h1>
        <dl class="facts num">
          <div><dt>Data</dt><dd>{formatLong(t.departAt)}</dd></div>
          {isEvent(t) && t.to && <div><dt>Luogo</dt><dd>{t.to}</dd></div>}
          <div class="pair">
            <div><dt>{isEvent(t) ? 'Inizio' : 'Partenza'}</dt><dd class="big">{formatTime(t.departAt)}</dd></div>
            {t.arriveAt && (
              <div><dt>{isEvent(t) ? 'Fine' : 'Arrivo'}</dt><dd class="big">{formatTime(t.arriveAt)}
                {plusDays(t) > 0 && <sup class="plus-day">+{plusDays(t)}</sup>}
              </dd></div>
            )}
          </div>
          {t.seat && <div><dt>Posto</dt><dd class="big seat">{t.seat}</dd></div>}
          {t.note && <div><dt>Note</dt><dd class="note">{t.note}</dd></div>}
          {t.pnr && <div><dt>Codice prenotazione</dt><dd class="big">{t.pnr}</dd></div>}
          {!!t.passengers?.length && <div><dt>Passeggeri</dt><dd class="note">{t.passengers.join('\n')}</dd></div>}
        </dl>
        </>}

        <div class="actions">
          <a class="action" href={href.edit(t.id)}>Modifica</a>
          {!isFlight && <button class="action" onClick={openOriginal}>File originale</button>}
          {confirm ? (
            <span class="confirm">
              <button class="action danger" onClick={remove}>Elimina davvero</button>
              <button class="action" onClick={() => setConfirm(false)}>Annulla</button>
            </span>
          ) : (
            <button class="action" onClick={() => setConfirm(true)}>Elimina</button>
          )}
        </div>
      </section>
    </main>
  );
}
