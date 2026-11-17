import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useTickets, reload, pendingFiles, setPendingFiles, distinct } from '../store';
import { back, go, href } from '../router';
import { putTickets, uid } from '../db';
import { analyze } from '../analyze';
import { airportList } from '../places';
import { SwapIcon, TypeIcon } from '../icons';
import { ACCEPT } from './Home';
import { TYPES, TYPE_LABEL, filesOf, type Segment, type StoredFile, type Ticket, type TicketType } from '../types';

type Fields = { type: TicketType; from: string; to: string; departAt: string; arriveAt: string; trip: string; seat: string; note: string; pnr: string };
const EMPTY: Fields = { type: 'treno', from: '', to: '', departAt: '', arriveAt: '', trip: '', seat: '', note: '', pnr: '' };
type Pax = { first: string; last: string };
/** "Mario De Rossi" → nome "Mario", cognome "De Rossi" (le particelle restano col cognome). */
const splitName = (full: string): Pax => {
  const w = full.trim().split(/\s+/).filter(Boolean);
  if (w.length < 2) return { first: w[0] ?? '', last: '' };
  let k = w.length - 1;
  while (k > 1 && /^(de|di|da|del|della|dello|dei|degli|lo|la|van|von|der|le|du|dos|das|mc)$/i.test(w[k - 1])) k--;
  return { first: w.slice(0, k).join(' '), last: w.slice(k).join(' ') };
};
const emptySeg = (): Segment => ({ from: '', to: '', departAt: '', arriveAt: '' });

/** Città dell'aeroporto (per il nome del viaggio proposto): "CUN" → "Cancún". */
const cityOf = (code: string) => airportList().get(code)?.replace(/\s+(?:Malpensa|Linate|Fiumicino|Ciampino|Orly|Gatwick|Stansted|Luton|City|Narita|Haneda|Daxing|LaGuardia|Sabiha)$/, '') ?? code;

export function TicketForm({ id }: { id?: string }) {
  const all = useTickets();
  const existing = id ? all?.find((t) => t.id === id) : undefined;
  const [f, setF] = useState<Fields>(EMPTY);
  const [pax, setPax] = useState<Pax[]>([]);
  const paxTouched = useRef(false);
  const [journeys, setJourneys] = useState<Segment[][]>([]);
  const [files, setFiles] = useState<File[]>(id ? [] : pendingFiles);
  const [stored, setStored] = useState<{ list: StoredFile[]; thumb?: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [prefilled, setPrefilled] = useState(false);
  const touched = useRef(new Set<keyof Fields>());
  const replaceInput = useRef<HTMLInputElement>(null);
  const reading = !!progress;

  // Nuovo senza file (es. ricarica della pagina): torna alla home.
  useEffect(() => {
    if (!id && !pendingFiles.length) go(href.home, true);
  }, []);

  // Modifica: carica i valori esistenti.
  useEffect(() => {
    if (!existing) return;
    setF({
      type: existing.type, from: existing.from, to: existing.to, departAt: existing.departAt,
      arriveAt: existing.arriveAt ?? '', trip: existing.trip ?? '', seat: existing.seat ?? '', note: existing.note ?? '',
      pnr: existing.pnr ?? '',
    });
    setPax((existing.passengers ?? []).map(splitName));
    setJourneys(existing.segments?.length ? [existing.segments] : []);
  }, [existing?.id]);

  const places = useMemo(() => (all ? distinct(all, (t) => [t.from, t.to]) : []), [all]);
  const trips = useMemo(() => (all ? distinct(all, (t) => [t.trip]) : []), [all]);

  /** Analizza i file e compila i campi. `overwrite`: sostituisce anche i campi già scritti. */
  const run = async (list: File[], overwrite: boolean) => {
    setProgress('Lettura…');
    try {
      const a = await analyze(list, places, setProgress);
      setStored({ list: a.stored, thumb: a.thumb });
      const it = a.itinerary;
      const fill: Partial<Fields> = {};
      if (it.journeys.length) {
        // Volo: l'itinerario sostituisce partenza/arrivo singoli.
        // In modifica si aggiorna solo il viaggio di questo biglietto (il ritorno ha già il suo).
        setJourneys(existing
          ? [it.journeys.find((js) => js[0].from === existing.from) ?? it.journeys[0]]
          : it.journeys);
        fill.type = 'volo';
        const last = it.journeys[0][it.journeys[0].length - 1];
        fill.trip = cityOf(last.to);
      } else {
        const g = a.guess;
        Object.assign(fill, g);
      }
      if (it.pnr) fill.pnr = it.pnr;
      if (it.passengers.length && (overwrite || !paxTouched.current)) setPax(it.passengers.map(splitName));
      const keys = (Object.keys(fill) as (keyof Fields)[]).filter((k) => fill[k] && (overwrite || !touched.current.has(k)));
      // Il nome del viaggio proposto non sovrascrive mai quello scelto.
      const keep = (k: keyof Fields) => k === 'trip' && (f.trip || touched.current.has('trip'));
      setF((cur) => {
        const n = { ...cur };
        keys.forEach((k) => { if (!keep(k)) (n as Record<string, string>)[k] = fill[k] as string; });
        return n;
      });
      setPrefilled(it.journeys.length > 0 || keys.some((k) => k !== 'type' && k !== 'note'));
    } finally {
      setProgress('');
    }
  };

  // Elabora i file appena scelti.
  useEffect(() => {
    if (files.length) run(files, !!id);
  }, [files]);

  // Modifica: rilegge i file già salvati (PDF e screenshot, con OCR).
  const reread = () => {
    if (!existing || reading) return;
    run(filesOf(existing).map((x) => new File([x.blob], x.name, { type: x.mime })), true);
  };

  const editPax = (next: Pax[]) => {
    paxTouched.current = true;
    setPax(next);
  };

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    touched.current.add(k);
    setF((cur) => ({ ...cur, [k]: v }));
  };

  // ——— Itinerario ———
  const flight = f.type === 'volo' && journeys.length > 0;
  const setSeg = (j: number, s: number, patch: Partial<Segment>) =>
    setJourneys((js) => js.map((segs, jj) => (jj !== j ? segs : segs.map((x, ss) => (ss === s ? { ...x, ...patch } : x)))));
  const addSeg = (j: number) =>
    setJourneys((js) => js.map((segs, jj) => {
      if (jj !== j) return segs;
      const last = segs[segs.length - 1];
      return [...segs, { ...emptySeg(), from: last?.to ?? '' }];
    }));
  const removeSeg = (j: number, s: number) =>
    setJourneys((js) => js.map((segs, jj) => (jj === j ? segs.filter((_, ss) => ss !== s) : segs)).filter((segs) => segs.length));
  const startItinerary = () => setJourneys([[{ ...emptySeg(), from: f.from, to: f.to, departAt: f.departAt, arriveAt: f.arriveAt }]]);

  const ev = f.type === 'evento';
  const segsOk = journeys.every((segs) => segs.every((x) => x.from.trim() && x.to.trim() && x.departAt));
  const valid = (flight ? segsOk : !!f.departAt) && (files.length || existing) && !reading;

  const save = async (e: Event) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      const list = stored?.list.length ? stored.list : existing ? filesOf(existing) : [];
      const fileData: Ticket['file'] = files.length && stored ? { ...list[0], thumb: stored.thumb } : existing!.file;
      const more = files.length && stored ? list.slice(1) : existing?.more;
      const passengers = pax.map((p) => `${p.first.trim()} ${p.last.trim()}`.trim()).filter(Boolean);
      const common = {
        trip: f.trip.trim() || undefined,
        seat: f.seat.trim() || undefined,
        note: f.note.trim() || undefined,
        pnr: f.pnr.trim().toUpperCase() || undefined,
        passengers: passengers.length ? passengers : undefined,
        file: fileData,
        more: more?.length ? more : undefined,
      };
      const now = Date.now();
      const tickets: Ticket[] = flight
        ? journeys.map((segs, j) => {
            const clean = segs.map((x) => ({ ...x, from: x.from.trim().toUpperCase(), to: x.to.trim().toUpperCase(), flight: x.flight?.trim() || undefined }));
            return {
              ...common,
              id: j === 0 && existing ? existing.id : uid(),
              createdAt: j === 0 && existing ? existing.createdAt : now + j,
              type: 'volo' as const,
              from: clean[0].from,
              to: clean[clean.length - 1].to,
              departAt: clean[0].departAt,
              arriveAt: clean[clean.length - 1].arriveAt || undefined,
              segments: clean,
            };
          })
        : [{
            ...common,
            id: existing?.id ?? uid(),
            createdAt: existing?.createdAt ?? now,
            type: f.type,
            from: f.from.trim(),
            to: f.to.trim(),
            departAt: f.departAt,
            arriveAt: f.arriveAt || undefined,
            segments: undefined,
          }];
      await putTickets(tickets);
      setPendingFiles([]);
      await reload();
      go(href.view(tickets[0].id), true);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setPendingFiles([]);
    back();
  };

  const swap = () => {
    touched.current.add('from').add('to');
    setF((c) => ({ ...c, from: c.to, to: c.from }));
  };

  if (id && all && !existing) return <main class="page"><p class="empty">Biglietto non trovato.</p></main>;
  const names = files.length ? files.map((x) => x.name) : existing ? filesOf(existing).map((x) => x.name) : [];
  const fileLabel = names.length > 1 ? `${names.length} file` : names[0] ?? '';
  const journeyLabel = (j: number) => (journeys.length === 2 ? (j === 0 ? 'Andata' : 'Ritorno') : journeys.length > 2 ? `Viaggio ${j + 1}` : 'Itinerario');

  return (
    <main class="page form-page">
      <form onSubmit={save} novalidate>
        <header class="bar">
          <button type="button" class="text-btn" onClick={cancel}>Annulla</button>
          <h1 class="bar-title">{id ? 'Modifica' : 'Nuovo biglietto'}</h1>
          <button type="submit" class="text-btn strong" disabled={!valid || busy}>Salva</button>
        </header>

        <div class="file-row">
          <span class="file-name">{fileLabel}</span>
          <span class="file-state">
            {progress || (prefilled ? 'Campi letti dal file: controlla' : '')}
          </span>
          {id && (
            <>
              {!files.length && (
                <button type="button" class="text-btn small" onClick={reread} disabled={reading}>Rileggi dal file</button>
              )}
              <button type="button" class="text-btn small" onClick={() => replaceInput.current?.click()}>Sostituisci</button>
              <input ref={replaceInput} type="file" accept={ACCEPT} multiple hidden
                onChange={(e) => { const x = [...((e.target as HTMLInputElement).files ?? [])]; if (x.length) setFiles(x); }} />
            </>
          )}
        </div>

        <div class="segmented" role="radiogroup" aria-label="Tipo">
          {TYPES.map((ty) => (
            <button type="button" role="radio" key={ty} aria-checked={f.type === ty} onClick={() => set('type', ty)}>
              <TypeIcon type={ty} size={16} /> {TYPE_LABEL[ty]}
            </button>
          ))}
        </div>

        <div class="fields">
          {flight ? (
            journeys.map((segs, j) => (
              <section class="itin-edit" key={j}>
                <h2 class="label">{journeyLabel(j)}</h2>
                {segs.map((x, s) => (
                  <div class="seg-edit" key={s}>
                    <div class="seg-row">
                      <input class="code" value={x.from} maxLength={3} autocapitalize="characters" placeholder="BLQ" aria-label="Da (codice aeroporto)"
                        onInput={(e) => setSeg(j, s, { from: e.currentTarget.value.toUpperCase() })} />
                      <span class="seg-arrow" aria-hidden="true">→</span>
                      <input class="code" value={x.to} maxLength={3} autocapitalize="characters" placeholder="AMS" aria-label="A (codice aeroporto)"
                        onInput={(e) => setSeg(j, s, { to: e.currentTarget.value.toUpperCase() })} />
                      <input class="flight" value={x.flight ?? ''} autocapitalize="characters" placeholder="KL 1660" aria-label="Volo"
                        onInput={(e) => setSeg(j, s, { flight: e.currentTarget.value.toUpperCase() })} />
                      <button type="button" class="seg-del" aria-label="Rimuovi tratta" onClick={() => removeSeg(j, s)}>×</button>
                    </div>
                    <div class="seg-row times">
                      <input type="datetime-local" class="num" value={x.departAt} aria-label="Partenza"
                        onInput={(e) => setSeg(j, s, { departAt: e.currentTarget.value })} />
                      <input type="datetime-local" class="num" value={x.arriveAt} min={x.departAt || undefined} aria-label="Arrivo"
                        onInput={(e) => setSeg(j, s, { arriveAt: e.currentTarget.value })} />
                    </div>
                  </div>
                ))}
                <button type="button" class="text-btn small" onClick={() => addSeg(j)}>+ Aggiungi tratta</button>
              </section>
            ))
          ) : (
            <>
              <div class="route-fields">
                <label class="field">
                  <span class="label">{ev ? 'Evento' : 'Da'}</span>
                  <input value={f.from} onInput={(e) => set('from', e.currentTarget.value)} list="places"
                    autocomplete="off" autocapitalize="words" placeholder={ev ? 'Concerto, mostra, partita…' : 'München Hbf'} />
                </label>
                {!ev && <button type="button" class="swap" aria-label="Inverti partenza e arrivo" onClick={swap}><SwapIcon /></button>}
                <label class="field">
                  <span class="label">{ev ? <>Luogo <i>facoltativo</i></> : 'A'}</span>
                  <input value={f.to} onInput={(e) => set('to', e.currentTarget.value)} list="places"
                    autocomplete="off" autocapitalize="words" placeholder={ev ? 'Unipol Arena' : 'Bologna C.le'} />
                </label>
              </div>
              <datalist id="places">{places.map((p) => <option key={p} value={p} />)}</datalist>

              <div class="pair-fields">
                <label class="field">
                  <span class="label">{ev ? 'Inizio' : 'Partenza'}</span>
                  <input type="datetime-local" class="num" value={f.departAt} required
                    onInput={(e) => set('departAt', e.currentTarget.value)} />
                </label>
                <label class="field">
                  <span class="label">{ev ? 'Fine' : 'Arrivo'} <i>facoltativo</i></span>
                  <input type="datetime-local" class="num" value={f.arriveAt} min={f.departAt || undefined}
                    onInput={(e) => set('arriveAt', e.currentTarget.value)} />
                </label>
              </div>
              {f.type === 'volo' && (
                <button type="button" class="text-btn small" onClick={startItinerary}>+ Itinerario con scali</button>
              )}
            </>
          )}

          <label class="field">
            <span class="label">Codice prenotazione <i>facoltativo</i></span>
            <input value={f.pnr} onInput={(e) => set('pnr', e.currentTarget.value.toUpperCase())} autocomplete="off"
              autocapitalize="characters" class="num" placeholder="XM2GIK" />
          </label>

<div class="pax-edit" role="group" aria-labelledby="pax-label">
            <div class="pax-head">
              <span class="label" id="pax-label">Passeggeri <i>{pax.length ? '' : 'facoltativo'}</i></span>
              <div class="pax-count" role="group" aria-label="Numero di passeggeri">
                <button type="button" aria-label="Un passeggero in meno" disabled={!pax.length} onClick={() => editPax(pax.slice(0, -1))}>−</button>
                <output class="num" aria-live="polite">{pax.length}</output>
                <button type="button" aria-label="Un passeggero in più" disabled={pax.length >= 9} onClick={() => editPax([...pax, { first: '', last: '' }])}>+</button>
              </div>
            </div>
            {pax.length > 0 && (
              <div class="pax-row pax-cols" aria-hidden="true"><span /><span class="label">Nome</span><span class="label">Cognome</span></div>
            )}
            {pax.map((p, k) => (
              <div class="pax-row" key={k}>
                <span class="pax-no num">{k + 1}</span>
                <label class="field">
                  <input aria-label={`Nome passeggero ${k + 1}`} value={p.first} autocapitalize="words" autocomplete="off" enterkeyhint="next"
                    onInput={(e) => editPax(pax.map((x, i) => (i === k ? { ...x, first: e.currentTarget.value } : x)))} />
                </label>
                <label class="field">
                  <input aria-label={`Cognome passeggero ${k + 1}`} value={p.last} autocapitalize="words" autocomplete="off" enterkeyhint="next"
                    onInput={(e) => editPax(pax.map((x, i) => (i === k ? { ...x, last: e.currentTarget.value } : x)))} />
                </label>
              </div>
            ))}
          </div>

          <label class="field">
            <span class="label">Posto <i>facoltativo</i></span>
            <input value={f.seat} onInput={(e) => set('seat', e.currentTarget.value)} autocomplete="off"
              placeholder={f.type === 'treno' ? 'Carrozza 5 · Posto 12A' : f.type === 'volo' ? 'Posto 42K' : 'Settore B · Fila 12 · Posto 7'} />
          </label>

          <label class="field">
            <span class="label">Viaggio <i>facoltativo</i></span>
            <input value={f.trip} onInput={(e) => set('trip', e.currentTarget.value)} list="trips"
              autocomplete="off" autocapitalize="words" placeholder="Messico" />
          </label>
          <datalist id="trips">{trips.map((p) => <option key={p} value={p} />)}</datalist>

          <label class="field">
            <span class="label">Note <i>facoltativo</i></span>
            <textarea rows={2} value={f.note} onInput={(e) => set('note', e.currentTarget.value)}
              placeholder="Numero treno o volo, bagaglio…" />
          </label>
        </div>
      </form>
    </main>
  );
}
