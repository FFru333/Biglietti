import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useTickets, reload, pendingFile, setPendingFile, distinct } from '../store';
import { back, go, href } from '../router';
import { putTicket, uid } from '../db';
import { processFile, isPdf } from '../files';
import { guessFromText } from '../parse';
import { SwapIcon, TypeIcon } from '../icons';
import { ACCEPT } from './Home';
import { TYPES, TYPE_LABEL, type Ticket, type TicketType } from '../types';

type Fields = { type: TicketType; from: string; to: string; departAt: string; arriveAt: string; trip: string; seat: string; note: string };
const EMPTY: Fields = { type: 'treno', from: '', to: '', departAt: '', arriveAt: '', trip: '', seat: '', note: '' };

export function TicketForm({ id }: { id?: string }) {
  const all = useTickets();
  const existing = id ? all?.find((t) => t.id === id) : undefined;
  const [f, setF] = useState<Fields>(EMPTY);
  const [file, setFile] = useState<File | null>(id ? null : pendingFile);
  const [processed, setProcessed] = useState<{ renders?: Blob[]; thumb?: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const touched = useRef(new Set<keyof Fields>());
  const replaceInput = useRef<HTMLInputElement>(null);

  // Nuovo senza file (es. ricarica della pagina): torna alla home.
  useEffect(() => {
    if (!id && !pendingFile) go(href.home, true);
  }, []);

  // Modifica: carica i valori esistenti.
  useEffect(() => {
    if (existing) {
      setF({
        type: existing.type, from: existing.from, to: existing.to, departAt: existing.departAt,
        arriveAt: existing.arriveAt ?? '', trip: existing.trip ?? '', seat: existing.seat ?? '', note: existing.note ?? '',
      });
    }
  }, [existing?.id]);

  const places = useMemo(() => (all ? distinct(all, (t) => [t.from, t.to]) : []), [all]);
  const trips = useMemo(() => (all ? distinct(all, (t) => [t.trip]) : []), [all]);

  // Elabora il file appena scelto: render + prefill best-effort (solo campi non toccati).
  useEffect(() => {
    if (!file) return;
    let alive = true;
    setReading(true);
    setProcessed(null);
    processFile(file)
      .then((p) => {
        if (!alive) return;
        setProcessed({ renders: p.renders, thumb: p.thumb });
        if (id) return; // in modifica non sovrascriviamo i dati
        const g = guessFromText(p.text, places, p.rows);
        const keys = (Object.keys(g) as (keyof typeof g)[]).filter((k) => g[k] && !touched.current.has(k));
        if (keys.length) {
          setF((cur) => {
            const n = { ...cur };
            keys.forEach((k) => ((n as Record<string, string>)[k] = g[k] as string));
            return n;
          });
          setPrefilled(keys.some((k) => k !== 'type' && k !== 'note'));
        }
      })
      .catch(() => alive && setProcessed({}))
      .finally(() => alive && setReading(false));
    return () => void (alive = false);
  }, [file]);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    touched.current.add(k);
    setF((cur) => ({ ...cur, [k]: v }));
  };

  const ev = f.type === 'evento';
  // Basta la data: se la tratta non è stata letta, il biglietto si salva lo stesso (titolo = nome del file).
  const valid = f.departAt && (file || existing) && !reading;

  const save = async (e: Event) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      const fileData: Ticket['file'] = file
        ? {
            name: file.name || 'biglietto',
            mime: file.type || (isPdf(file) ? 'application/pdf' : 'application/octet-stream'),
            blob: file,
            render: processed?.renders?.[0],
            renders: processed?.renders,
            thumb: processed?.thumb,
          }
        : existing!.file;
      const t: Ticket = {
        id: existing?.id ?? uid(),
        createdAt: existing?.createdAt ?? Date.now(),
        type: f.type,
        from: f.from.trim(),
        to: f.to.trim(),
        departAt: f.departAt,
        arriveAt: f.arriveAt || undefined,
        trip: f.trip.trim() || undefined,
        seat: f.seat.trim() || undefined,
        note: f.note.trim() || undefined,
        file: fileData,
      };
      await putTicket(t);
      setPendingFile(null);
      await reload();
      go(href.view(t.id), true);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setPendingFile(null);
    back();
  };

  const swap = () => {
    touched.current.add('from').add('to');
    setF((c) => ({ ...c, from: c.to, to: c.from }));
  };

  if (id && all && !existing) return <main class="page"><p class="empty">Biglietto non trovato.</p></main>;
  const fileName = file?.name ?? existing?.file.name ?? '';

  return (
    <main class="page form-page">
      <form onSubmit={save} novalidate>
        <header class="bar">
          <button type="button" class="text-btn" onClick={cancel}>Annulla</button>
          <h1 class="bar-title">{id ? 'Modifica' : 'Nuovo biglietto'}</h1>
          <button type="submit" class="text-btn strong" disabled={!valid || busy}>Salva</button>
        </header>

        <div class="file-row">
          <span class="file-name">{fileName}</span>
          <span class="file-state">
            {reading ? 'Lettura…' : prefilled ? 'Campi letti dal file: controlla' : ''}
          </span>
          {id && (
            <>
              <button type="button" class="text-btn small" onClick={() => replaceInput.current?.click()}>Sostituisci</button>
              <input ref={replaceInput} type="file" accept={ACCEPT} hidden
                onChange={(e) => { const x = (e.target as HTMLInputElement).files?.[0]; if (x) setFile(x); }} />
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
              placeholder="Numero treno o volo, codice prenotazione" />
          </label>
        </div>
      </form>
    </main>
  );
}
