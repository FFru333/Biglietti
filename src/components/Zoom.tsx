import { useEffect, useRef } from 'preact/hooks';

// Immagine con pinch-zoom, pan e doppio tap per tornare al fit.
// A zoom 1 i gesti orizzontali sono passati a onSwipe (navigazione fra tratte).

interface Props {
  src: string;
  alt: string;
  onSwipe?: (dir: 1 | -1) => void;
}

export function Zoom({ src, alt, onSwipe }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = box.current!;
    const im = img.current!;
    let s = 1, x = 0, y = 0; // scala e traslazione
    let start: { s: number; x: number; y: number; d: number; cx: number; cy: number } | null = null;
    let pan: { x: number; y: number; px: number; py: number; t: number } | null = null;
    let lastTap = 0;
    let swipeDx = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const clamp = () => {
      const w = el.clientWidth, h = im.offsetHeight;
      const mx = (w * (s - 1)) / 2, my = (h * (s - 1)) / 2;
      x = Math.max(-mx, Math.min(mx, x));
      y = Math.max(-my, Math.min(my, y));
    };
    const apply = (anim = false) => {
      im.style.transition = anim && !reduced ? 'transform 180ms ease-out' : 'none';
      im.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
      el.style.touchAction = s > 1 ? 'none' : 'pan-y';
      el.classList.toggle('is-zoomed', s > 1);
    };
    const center = (t: TouchList) => {
      const r = el.getBoundingClientRect();
      return { cx: (t[0].clientX + t[1].clientX) / 2 - r.left - r.width / 2, cy: (t[0].clientY + t[1].clientY) / 2 - r.top - r.height / 2 };
    };
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pan = null;
        start = { s, x, y, d: dist(e.touches), ...center(e.touches) };
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        pan = { x, y, px: t.clientX, py: t.clientY, t: Date.now() };
        swipeDx = 0;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (start && e.touches.length === 2) {
        e.preventDefault();
        const ns = Math.max(1, Math.min(6, (start.s * dist(e.touches)) / start.d));
        const c = center(e.touches);
        // Mantiene fermo il punto sotto le dita.
        x = c.cx - ((start.cx - start.x) * ns) / start.s;
        y = c.cy - ((start.cy - start.y) * ns) / start.s;
        s = ns;
        clamp();
        apply();
      } else if (pan && e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - pan.px, dy = t.clientY - pan.py;
        if (s > 1) {
          e.preventDefault();
          x = pan.x + dx;
          y = pan.y + dy;
          clamp();
          apply();
        } else if (onSwipe && Math.abs(dx) > Math.abs(dy) * 1.2) {
          e.preventDefault();
          swipeDx = dx;
          im.style.transition = 'none';
          im.style.transform = `translate3d(${dx * 0.35}px,0,0)`;
        }
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (start && e.touches.length < 2) {
        start = null;
        if (s < 1.05) { s = 1; x = 0; y = 0; apply(true); }
        return;
      }
      if (pan && e.touches.length === 0) {
        const quick = Date.now() - pan.t < 250;
        const moved = Math.abs(swipeDx) > 8;
        pan = null;
        if (s === 1 && Math.abs(swipeDx) > 60) {
          onSwipe?.(swipeDx < 0 ? 1 : -1);
        }
        if (s === 1 && moved) apply(true);
        swipeDx = 0;
        if (quick && !moved) {
          const now = Date.now();
          if (now - lastTap < 300) {
            e.preventDefault();
            if (s > 1) { s = 1; x = 0; y = 0; }
            else {
              // Doppio tap a zoom 1: ingrandisce 2.5× sul punto toccato.
              const r = el.getBoundingClientRect();
              const t = e.changedTouches[0];
              const cx = t.clientX - r.left - r.width / 2, cy = t.clientY - r.top - r.height / 2;
              s = 2.5; x = -cx * (s - 1); y = -cy * (s - 1);
              clamp();
            }
            apply(true);
            lastTap = 0;
          } else lastTap = now;
        }
      }
    };
    const noGesture = (e: Event) => e.preventDefault();

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: false });
    el.addEventListener('touchcancel', onEnd, { passive: false });
    el.addEventListener('gesturestart', noGesture);
    // Desktop: doppio click per zoom/fit (utile anche per i test).
    const onDbl = (e: MouseEvent) => {
      if (s > 1) { s = 1; x = 0; y = 0; }
      else {
        const r = el.getBoundingClientRect();
        s = 2.5;
        x = -(e.clientX - r.left - r.width / 2) * (s - 1);
        y = -(e.clientY - r.top - r.height / 2) * (s - 1);
        clamp();
      }
      apply(true);
    };
    el.addEventListener('dblclick', onDbl);
    apply();
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('gesturestart', noGesture);
      el.removeEventListener('dblclick', onDbl);
    };
  }, [src, onSwipe]);

  return (
    <div class="zoom" ref={box}>
      <img ref={img} src={src} alt={alt} draggable={false} />
    </div>
  );
}
