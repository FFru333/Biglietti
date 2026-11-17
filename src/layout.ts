// Ricostruzione del testo di una pagina PDF a partire dalle posizioni dei frammenti.
// pdf.js restituisce pezzi di testo in ordine di disegno, spesso spezzati e senza a capo
// affidabili: qui li ordiniamo per riga (y) e colonna (x) e li uniamo in "segmenti",
// così le tabelle dei biglietti (Partenza | Arrivo …) restano leggibili.

export interface Seg { text: string; x: number; x2: number }
export type Row = Seg[];

interface Item { str?: string; transform?: number[]; width?: number; height?: number }

export function buildRows(items: unknown[]): Row[] {
  const its = (items as Item[])
    .filter((i) => i.str && i.str.trim() && i.transform)
    .map((i) => {
      const t = i.transform!;
      const h = Math.abs(t[3]) || Math.abs(t[0]) || i.height || 10;
      return { str: i.str!, x: t[4], y: t[5], w: i.width ?? i.str!.length * h * 0.5, h };
    })
    .sort((a, b) => b.y - a.y || a.x - b.x);

  // Raggruppa per riga: stessa linea di base entro metà altezza.
  const lines: (typeof its)[] = [];
  for (const it of its) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - it.y) <= Math.max(2, line[0].h * 0.45)) line.push(it);
    else lines.push([it]);
  }

  return lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    const segs: Seg[] = [];
    for (const it of line) {
      const last = segs[segs.length - 1];
      const gap = last ? it.x - last.x2 : Infinity;
      // Spazio tra parole ~0.25–0.5 em; uno stacco più ampio è una nuova colonna.
      if (last && gap < it.h * 1.2) {
        const needsSpace = gap > it.h * 0.12 && !last.text.endsWith(' ') && !it.str.startsWith(' ');
        last.text += (needsSpace ? ' ' : '') + it.str;
        last.x2 = Math.max(last.x2, it.x + it.w);
      } else {
        segs.push({ text: it.str, x: it.x, x2: it.x + it.w });
      }
    }
    return segs
      .map((s) => ({ ...s, text: s.text.replace(/\s+/g, ' ').trim() }))
      .filter((s) => s.text);
  }).filter((r) => r.length);
}

/** Testo leggibile: colonne separate da tre spazi, righe da a capo. */
export const rowsToText = (rows: Row[]) => rows.map((r) => r.map((s) => s.text).join('   ')).join('\n');
