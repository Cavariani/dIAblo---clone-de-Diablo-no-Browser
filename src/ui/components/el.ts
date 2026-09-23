// Tiny typed hyperscript helper for the DOM UI (no framework, see DECISIONS D-003).
//
//   el('div', { class: 'panel', onclick: () => ... }, 'texto', el('span', {}, 'filho'))
//   div('hud-orb is-low', child1, child2)
//
// Props: any writable property of the element (onclick, title, disabled, value...), plus
//   class      string | string[] | Record<string, boolean>
//   style      string | Partial<CSSStyleDeclaration> (custom properties via `vars`)
//   vars       Record<'--name', string | number> (CSS custom properties)
//   dataset    Record<string, string>
//   attrs      Record<string, string | number | boolean> (setAttribute; false = omitted)
//   html       raw innerHTML (trusted content only)
//   ref        (el) => void

export type Child = Node | string | number | null | undefined | false | Child[];

type EventProps = {
  [K in keyof HTMLElementEventMap as `on${K}`]?: (ev: HTMLElementEventMap[K]) => void;
};

export type ElProps<E extends HTMLElement = HTMLElement> = Partial<
  Omit<E, 'style' | 'className' | 'dataset' | 'children' | keyof EventProps | 'classList'>
> &
  EventProps & {
    class?: string | (string | false | null | undefined)[] | Record<string, boolean>;
    style?: string | Partial<CSSStyleDeclaration>;
    vars?: Record<string, string | number>;
    dataset?: Record<string, string>;
    attrs?: Record<string, string | number | boolean | null | undefined>;
    html?: string;
    ref?: (el: E) => void;
  };

export function classNames(c: ElProps['class']): string {
  if (!c) return '';
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.filter(Boolean).join(' ');
  let out = '';
  for (const k in c) if (c[k]) out += (out ? ' ' : '') + k;
  return out;
}

export function append(parent: Node, child: Child): void {
  if (child === null || child === undefined || child === false) return;
  if (Array.isArray(child)) {
    for (const c of child) append(parent, c);
    return;
  }
  if (typeof child === 'string' || typeof child === 'number') {
    parent.appendChild(document.createTextNode(String(child)));
    return;
  }
  parent.appendChild(child);
}

function isProps(v: unknown): v is ElProps {
  return typeof v === 'object' && v !== null && !(v instanceof Node) && !Array.isArray(v);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElProps<HTMLElementTagNameMap[K]> | Child,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (isProps(props)) {
    applyProps(node, props as ElProps<HTMLElementTagNameMap[K]>);
  } else if (props !== undefined) {
    append(node, props as Child);
  }
  for (const c of children) append(node, c);
  return node;
}

export function applyProps<E extends HTMLElement>(node: E, props: ElProps<E>): void {
  for (const key in props) {
    const v = (props as Record<string, unknown>)[key];
    if (v === undefined) continue;
    switch (key) {
      case 'class':
        node.className = classNames(v as ElProps['class']);
        break;
      case 'style':
        if (typeof v === 'string') node.style.cssText = v;
        else Object.assign(node.style, v);
        break;
      case 'vars':
        for (const [k, val] of Object.entries(v as Record<string, string | number>)) node.style.setProperty(k, String(val));
        break;
      case 'dataset':
        for (const [k, val] of Object.entries(v as Record<string, string>)) node.dataset[k] = val;
        break;
      case 'attrs':
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
          if (val === false || val === null || val === undefined) continue;
          node.setAttribute(k, val === true ? '' : String(val));
        }
        break;
      case 'html':
        node.innerHTML = v as string;
        break;
      case 'ref':
        break;
      default:
        if (key.startsWith('on') && typeof v === 'function') {
          node.addEventListener(key.slice(2), v as EventListener);
        } else {
          (node as unknown as Record<string, unknown>)[key] = v;
        }
    }
  }
  props.ref?.(node);
}

/** Shorthand: `div('a b', ...children)`. */
export function div(cls: string, ...children: Child[]): HTMLDivElement {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  for (const c of children) append(d, c);
  return d;
}

export function span(cls: string, ...children: Child[]): HTMLSpanElement {
  const s = document.createElement('span');
  if (cls) s.className = cls;
  for (const c of children) append(s, c);
  return s;
}

/** Inline SVG from markup (trusted, static strings only). */
export function svg(markup: string, cls = ''): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  const s = t.content.firstElementChild as SVGSVGElement;
  if (cls) s.setAttribute('class', cls);
  return s;
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Write text only when it changed (HUD hot path). */
export function setText(node: Node & { __t?: string }, text: string): void {
  if (node.__t === text) return;
  node.__t = text;
  node.textContent = text;
}

/** Set a CSS custom property only when its value changed. */
export function setVar(node: HTMLElement & { __v?: Record<string, string> }, name: string, value: string | number): void {
  const s = typeof value === 'number' ? (Math.round(value * 1000) / 1000).toString() : value;
  const cache = node.__v ?? (node.__v = {});
  if (cache[name] === s) return;
  cache[name] = s;
  node.style.setProperty(name, s);
}

/** Toggle a class only when it changed. */
export function setClass(node: HTMLElement, cls: string, on: boolean): void {
  if (node.classList.contains(cls) !== on) node.classList.toggle(cls, on);
}

/** Restart a CSS animation class (remove, reflow, add). */
export function replayClass(node: HTMLElement, cls: string): void {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
