import type { TicketType } from './types';

type P = { size?: number; class?: string };
const svg = (size: number, cls: string | undefined, children: preact.ComponentChildren) => (
  <svg class={cls} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const PlaneIcon = ({ size = 16, class: c }: P) =>
  svg(size, c, (
    <path transform="rotate(45 12 12)"
      d="M12 2.5c.7 0 1.1.6 1.1 1.4V9l7.9 4.6v1.7l-7.9-2.3v5.2l2.4 1.8v1.4L12 20.6l-3.5.8V20l2.4-1.8V13L3 15.3v-1.7L10.9 9V3.9c0-.8.4-1.4 1.1-1.4Z" />
  ));

export const TrainIcon = ({ size = 16, class: c }: P) =>
  svg(size, c, (
    <>
      <rect x="6" y="2.75" width="12" height="13.5" rx="3" />
      <path d="M6 9.5h12" />
      <path d="M9 13.1h.01M15 13.1h.01" stroke-width="2" />
      <path d="M8.5 16.25 6.5 21M15.5 16.25l2 4.75M7.6 18.6h8.8" />
    </>
  ));

export const TicketIcon = ({ size = 16, class: c }: P) =>
  svg(size, c, (
    <>
      <path d="M3.5 6.5h17v3.25a2.25 2.25 0 0 0 0 4.5v3.25h-17v-3.25a2.25 2.25 0 0 0 0-4.5Z" />
      <path d="M14.5 7.5v1.5M14.5 11.25v1.5M14.5 15v1.5" />
    </>
  ));

export const TypeIcon = ({ type, size, class: c }: P & { type: TicketType }) =>
  type === 'volo' ? <PlaneIcon size={size} class={c} /> : type === 'treno' ? <TrainIcon size={size} class={c} /> : <TicketIcon size={size} class={c} />;

export const PlusIcon = ({ size = 22 }: P) => svg(size, undefined, <path d="M12 4.5v15M4.5 12h15" />);
export const BackIcon = ({ size = 22 }: P) => svg(size, undefined, <path d="M14.5 5.5 8 12l6.5 6.5" />);
export const ChevronIcon = ({ size = 16, class: c }: P) => svg(size, c, <path d="M9.5 6l6 6-6 6" />);

/** Freccia "→" disegnata: il sottoinsieme latin del font non include U+2192. */
export const Arrow = () => (
  <svg class="arrow" viewBox="0 0 20 12" aria-label="→" role="img" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter">
    <path d="M1 6h17M13 1.5 18 6l-5 4.5" />
  </svg>
);

export const SwapIcon = ({ size = 18 }: P) =>
  svg(size, undefined, <path d="M8 4v16M8 4 4.5 7.5M8 4l3.5 3.5M16 20V4M16 20l-3.5-3.5M16 20l3.5-3.5" />);
