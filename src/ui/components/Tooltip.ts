// Global tooltip layer: follows the cursor or anchors to an element, clamps to the viewport.
let layer: HTMLDivElement | null = null;
let wrap: HTMLDivElement | null = null;
let anchor: { x: number; y: number; w: number; h: number } | null = null;
let followMouse = false;
let mx = 0;
let my = 0;

export function initTooltips(root: HTMLElement): void {
  layer = document.createElement('div');
  layer.className = 'tooltip-layer';
  root.appendChild(layer);
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (followMouse) position();
  });
}

function position(): void {
  if (!wrap) return;
  const r = wrap.getBoundingClientRect();
  const W = window.innerWidth;
  const H = window.innerHeight;
  let x: number;
  let y: number;
  if (anchor && !followMouse) {
    x = anchor.x + anchor.w + 10;
    if (x + r.width > W - 8) x = anchor.x - r.width - 10;
    y = anchor.y;
  } else {
    x = mx + 18;
    y = my + 18;
    if (x + r.width > W - 8) x = mx - r.width - 18;
  }
  if (y + r.height > H - 8) y = H - r.height - 8;
  x = Math.max(8, x);
  y = Math.max(8, y);
  wrap.style.left = `${x}px`;
  wrap.style.top = `${y}px`;
}

/** Shows one or more tooltip cards (e.g. [item, equipped]). */
export function showTooltip(cards: HTMLElement[], at?: HTMLElement | null): void {
  if (!layer) return;
  hideTooltip();
  wrap = document.createElement('div');
  wrap.className = 'tt-wrap';
  for (const c of cards) wrap.appendChild(c);
  layer.appendChild(wrap);
  if (at) {
    const b = at.getBoundingClientRect();
    anchor = { x: b.left, y: b.top, w: b.width, h: b.height };
    followMouse = false;
  } else {
    anchor = null;
    followMouse = true;
  }
  position();
}

export function hideTooltip(): void {
  wrap?.remove();
  wrap = null;
}

/** Simple text tooltip helper: attaches hover handlers to an element. */
export function simpleTip(elm: HTMLElement, content: () => HTMLElement | string): void {
  elm.addEventListener('pointerenter', () => {
    const c = content();
    let card: HTMLElement;
    if (typeof c === 'string') {
      card = document.createElement('div');
      card.className = 'tt tt--simple';
      card.innerHTML = c;
    } else card = c;
    showTooltip([card], elm);
  });
  elm.addEventListener('pointerleave', hideTooltip);
}
