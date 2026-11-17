import { useEffect, useRef, useState } from 'preact/hooks';
import { useTickets, reload } from '../store';
import { back } from '../router';
import { exportBackup, importBackup, lastBackup, saveBackup } from '../backup';
import { loadDemo, removeDemo } from '../demo';
import { requestPersistence } from '../db';
import { BackIcon } from '../icons';

const fmtDate = (n: number) =>
  new Date(n).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1).replace('.', ',')} MB` : `${Math.round(b / 1e3)} kB`);

export function Settings() {
  const all = useTickets();
  const [last, setLast] = useState<number | undefined>();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLast(await lastBackup());
    setPersisted(await requestPersistence());
    try { setUsage((await navigator.storage?.estimate?.())?.usage ?? null); } catch { /* */ }
  };
  useEffect(() => void refresh(), []);

  const run = async (fn: () => Promise<string | void>) => {
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      const m = await fn();
      if (m) setMsg(m);
      await reload();
      await refresh();
    } catch (e) {
      setMsg((e as Error).message || 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  const real = (all ?? []).filter((t) => !t.demo).length;
  const demo = (all ?? []).filter((t) => t.demo).length;

  return (
    <main class="page settings">
      <header class="bar">
        <button class="icon-btn" aria-label="Indietro" onClick={back}><BackIcon /></button>
        <h1 class="bar-title">Impostazioni</h1>
        <span class="icon-btn" aria-hidden="true" />
      </header>

      <section class="group">
        <h2 class="section-title">Backup</h2>
        <p class="line num">
          <span>Ultimo backup</span>
          <span>{last ? fmtDate(last) : 'mai'}</span>
        </p>
        <p class="hint">Un solo file con biglietti e allegati. Conservalo in File o iCloud Drive.</p>
        <div class="buttons">
          <button class="btn" disabled={busy || real === 0}
            onClick={() => run(async () => { const ok = await saveBackup(await exportBackup()); return ok ? `Esportat${real === 1 ? 'o 1 biglietto' : `i ${real} biglietti`}.` : ''; })}>
            Esporta
          </button>
          <button class="btn" disabled={busy} onClick={() => importInput.current?.click()}>Importa</button>
          <input ref={importInput} type="file" accept="application/json,.json" hidden
            onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              (e.target as HTMLInputElement).value = '';
              if (f) run(async () => { const n = await importBackup(f); return n === 1 ? 'Importato 1 biglietto.' : `Importati ${n} biglietti.`; });
            }} />
        </div>
      </section>

      <section class="group">
        <h2 class="section-title">Dati demo</h2>
        <p class="hint">Biglietti finti (treni, un concerto, voli con scalo) per provare il layout. Non finiscono nel backup.</p>
        <div class="buttons">
          {demo === 0 ? (
            <button class="btn" disabled={busy} onClick={() => run(async () => { await loadDemo(); return 'Dati demo caricati.'; })}>Carica demo</button>
          ) : (
            <button class="btn" disabled={busy} onClick={() => run(async () => { await removeDemo(); return 'Dati demo rimossi.'; })}>Rimuovi demo</button>
          )}
        </div>
      </section>

      <section class="group">
        <h2 class="section-title">Archivio</h2>
        <p class="line num"><span>Biglietti</span><span>{real}</span></p>
        {usage !== null && <p class="line num"><span>Spazio usato</span><span>{fmtSize(usage)}</span></p>}
        <p class="line"><span>Archiviazione persistente</span><span>{persisted === null ? '…' : persisted ? 'attiva' : 'non concessa'}</span></p>
        <p class="hint">I dati restano solo su questo dispositivo. Nessun account, nessuna rete.</p>
      </section>

      <p class="status" role="status" aria-live="polite">{msg}</p>
    </main>
  );
}
