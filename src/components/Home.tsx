import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useTickets, setPendingFile, distinct } from '../store';
import { go, href } from '../router';
import { split } from '../sort';
import { GridIcon, ListIcon, PlusIcon } from '../icons';
import { Grid } from './Grid';
import { upgradeAll } from '../upgrade';
import { reload } from '../store';
import { Card, NextCard } from './Card';
import { TYPES, TYPE_SECTION, type Ticket } from '../types';

export const ACCEPT = 'application/pdf,.pdf,image/*,.heic,.heif';

export function Home() {
  const all = useTickets();
  const [trip, setTrip] = useState<string | null>(() => sessionStorage.getItem('trip'));
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'list' | 'grid'>(() => {
    try { return localStorage.getItem('view') === 'grid' ? 'grid' : 'list'; } catch { return 'list'; }
  });
  const pickMode = (m: 'list' | 'grid') => {
    setMode(m);
    try { localStorage.setItem('view', m); } catch { /* */ }
  };
  // Completa in background pagine e miniature mancanti (biglietti salvati con versioni precedenti).
  useEffect(() => {
    if (all?.length) upgradeAll(all).then((changed) => { if (changed) reload(); });
  }, [all]);
  // Aggiorna i countdown ogni minuto.
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  const trips = useMemo(() => (all ? distinct(all, (t) => [t.trip]).sort((a, b) => a.localeCompare(b, 'it')) : []), [all]);
  const activeTrip = trip && trips.includes(trip) ? trip : null;
  const list = (all ?? []).filter((t) => !activeTrip || t.trip === activeTrip);
  const { future, past } = split(list);
  const next = future[0];

  const pickTrip = (t: string | null) => {
    setTrip(t);
    try { t ? sessionStorage.setItem('trip', t) : sessionStorage.removeItem('trip'); } catch { /* */ }
  };

  const onFile = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    setPendingFile(f);
    go(href.new);
  };

  return (
    <main class="page home">
      <header class="bar">
        <h1 class="wordmark">Biglietti</h1>
        <div class="bar-actions">
          {all && all.length > 0 && (
            <button class="icon-btn" aria-label={mode === 'grid' ? 'Mostra elenco' : 'Mostra anteprime'}
              onClick={() => pickMode(mode === 'grid' ? 'list' : 'grid')}>
              {mode === 'grid' ? <ListIcon /> : <GridIcon />}
            </button>
          )}
          <button class="icon-btn" aria-label="Aggiungi biglietto" onClick={() => input.current?.click()}>
            <PlusIcon />
          </button>
        </div>
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={onFile} />
      </header>

      {trips.length > 0 && (
        <nav class="chips" aria-label="Filtra per viaggio">
          <button class="chip" aria-pressed={!activeTrip} onClick={() => pickTrip(null)}>Tutti</button>
          {trips.map((t) => (
            <button key={t} class="chip" aria-pressed={activeTrip === t} onClick={() => pickTrip(t)}>{t}</button>
          ))}
        </nav>
      )}

      {all && all.length === 0 && (
        <p class="empty">Nessun biglietto. Tocca + per aggiungere un PDF o una foto.</p>
      )}

      {mode === 'grid' && <Grid future={future} past={past} showTrip={!activeTrip} />}

      {mode === 'list' && next && <NextCard t={next} showTrip={!activeTrip} />}

      {mode === 'list' && TYPES.map((type) => {
        const fut = future.filter((t) => t.type === type && t !== next);
        const pst = past.filter((t) => t.type === type);
        if (!fut.length && !pst.length) return null;
        const isOpen = !!open[type];
        return (
          <section class="section" key={type}>
            <h2 class="section-title">{TYPE_SECTION[type]}</h2>
            {fut.map((t: Ticket) => <Card key={t.id} t={t} showTrip={!activeTrip} />)}
            {pst.length > 0 && (
              <>
                <button class="past-toggle" aria-expanded={isOpen}
                  onClick={() => setOpen({ ...open, [type]: !isOpen })}>
                  <span>Passati <span class="num">({pst.length})</span></span>
                  <span class="past-sign" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && pst.map((t) => <Card key={t.id} t={t} past showTrip={!activeTrip} />)}
              </>
            )}
          </section>
        );
      })}

      <footer class="foot">
        <a href={href.settings} class="foot-link">Impostazioni e backup</a>
      </footer>
    </main>
  );
}
