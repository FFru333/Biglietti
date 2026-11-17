import { useEffect } from 'preact/hooks';

/** Tiene lo schermo acceso finché il componente è montato (Screen Wake Lock API). */
export function useWakeLock() {
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (!wl) return;
    let lock: { release(): Promise<void> } | null = null;
    let alive = true;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        const l = await wl.request('screen');
        if (alive) lock = l; else l.release();
      } catch { /* non supportato o negato: pazienza */ }
    };
    const onVis = () => document.visibilityState === 'visible' && acquire();
    acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, []);
}
