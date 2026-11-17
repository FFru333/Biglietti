import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'home' }
  | { name: 'view'; id: string }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'settings' };

export function parse(hash = location.hash): Route {
  const [, a, b] = hash.replace(/^#\/?/, '/').split('/');
  if (a === 'b' && b) return { name: 'view', id: decodeURIComponent(b) };
  if (a === 'nuovo') return { name: 'new' };
  if (a === 'modifica' && b) return { name: 'edit', id: decodeURIComponent(b) };
  if (a === 'impostazioni') return { name: 'settings' };
  return { name: 'home' };
}

export const href = {
  home: '#/',
  view: (id: string) => `#/b/${encodeURIComponent(id)}`,
  new: '#/nuovo',
  edit: (id: string) => `#/modifica/${encodeURIComponent(id)}`,
  settings: '#/impostazioni',
};

export function go(h: string, replace = false) {
  if (replace) location.replace(h);
  else location.hash = h;
}

/** Torna indietro se c'è storia interna, altrimenti alla home. */
export function back() {
  if (history.length > 1 && sessionStorage.getItem('nav')) history.back();
  else go(href.home, true);
}

export function useRoute() {
  const [r, set] = useState(parse);
  useEffect(() => {
    const f = () => {
      try { sessionStorage.setItem('nav', '1'); } catch { /* */ }
      set(parse());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}
