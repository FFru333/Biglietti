import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { useTickets, reload } from '../store';
import { back, go, href } from '../router';
import { legsOf } from '../sort';
import { deleteTicket, putTicket } from '../db';
import { isPdf, processFile } from '../files';
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

  const shown = t?.file.render ?? (t && t.file.mime.startsWith('image/') ? t.file.blob : undefined);
  const url = useMemo(() => (shown ? URL.createObjectURL(shown) : ''), [shown]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  // Anteprima mancante (es. elaborazione interrotta): la generiamo ora e la salviamo.
  useEffect(() => {
    if (!t || t.file.render || !isPdf({ type: t.file.mime, name: t.file.name })) return;
    let alive = true;
    processFile(new File([t.file.blob], t.file.name, { type: t.file.mime }), 30_000).then(async (p) => {
      if (!alive || !p.render) return;
      await putTicket({ ...t, file: { ...t.file, render: p.render } });
      await reload();
    });
    return () => void (alive = false);
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
    const file = new File([t.file.blob], t.file.name, { type: t.file.mime });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    // In modalità standalone su iOS l'apertura di blob: è inaffidabile; il foglio di
    // condivisione offre anteprima, "Salva su File" e "Apri in…".
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone && nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file] }); } catch { /* annullato */ }
      return;
    }
    const u = URL.createObjectURL(file);
    window.open(u, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(u), 60_000);
  };

  const remove = async () => {
    await deleteTicket(t.id);
    await reload();
    go(href.home, true);
  };

  return (
    <main class="page view">
      <header class="bar view-bar">
        <button class="icon-btn" aria-label="Chiudi" onClick={back}><BackIcon /></button>
        {legs.length > 1 && (
          <div class="legs num" aria-label={`Tratta ${i + 1} di ${legs.length}`}>
            <button class="icon-btn small flip" aria-label="Tratta precedente" disabled={i <= 0} onClick={() => step(-1)}><ChevronIcon /></button>
            <span>{i + 1} / {legs.length}</span>
            <button class="icon-btn small" aria-label="Tratta successiva" disabled={i >= legs.length - 1} onClick={() => step(1)}><ChevronIcon /></button>
          </div>
        )}
        <span class="countdown num">{countdown(t.departAt)}</span>
      </header>

      <div class="stage">
        {url ? (
          <Zoom src={url} alt={`Biglietto ${t.from} – ${t.to}`} onSwipe={legs.length > 1 ? step : undefined} />
        ) : (
          <div class="stage-empty">
            <p>{isPdf({ type: t.file.mime, name: t.file.name }) ? 'Preparazione anteprima…' : 'Anteprima non disponibile.'}</p>
            <button class="text-btn" onClick={openOriginal}>Apri il file originale</button>
          </div>
        )}
      </div>

      <section class="details">
        <Tag t={t} />
        <h1 class="view-route"><Route t={t} /></h1>
        <dl class="facts num">
          <div><dt>Data</dt><dd>{formatLong(t.departAt)}</dd></div>
          <div class="pair">
            <div><dt>Partenza</dt><dd class="big">{formatTime(t.departAt)}</dd></div>
            {t.arriveAt && (
              <div><dt>Arrivo</dt><dd class="big">{formatTime(t.arriveAt)}
                {plusDays(t) > 0 && <sup class="plus-day">+{plusDays(t)}</sup>}
              </dd></div>
            )}
          </div>
          {t.note && <div><dt>Note</dt><dd class="note">{t.note}</dd></div>}
        </dl>

        <div class="actions">
          <a class="action" href={href.edit(t.id)}>Modifica</a>
          <button class="action" onClick={openOriginal}>File originale</button>
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
