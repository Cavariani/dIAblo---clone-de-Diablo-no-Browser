// Icon access for the DOM UI. By default resolves through the AssetManager singleton
// (`assets.iconStyle(ref, size)` from src/render/assets/AssetManager.ts). The dev UI test and
// tools can inject another resolver with setIconResolver().

import type { IconRef } from '../data/schema';
import type { AssetManagerAPI, IconStyle } from '../render/assets/types';

export type IconResolver = (ref: IconRef, size: number) => IconStyle | null;

// Soft dependency: the AssetManager module is owned by the render agent. Using an eager glob keeps
// the UI compiling (and the dev harness running) even before that module exists.
const assetModules = import.meta.glob<{ assets?: AssetManagerAPI }>('../render/assets/AssetManager.ts', { eager: true });

function defaultResolver(ref: IconRef, size: number): IconStyle | null {
  for (const key in assetModules) {
    const am = assetModules[key]?.assets;
    if (!am) continue;
    try {
      return am.iconStyle(ref, size);
    } catch {
      return null;
    }
  }
  return null;
}

let resolver: IconResolver = defaultResolver;
let resolverSerial = 0;

/** Replace the icon source (null = AssetManager). Already-rendered icons refresh on next apply. */
export function setIconResolver(r: IconResolver | null): void {
  resolver = r ?? defaultResolver;
  resolverSerial++;
}

export function resolveIcon(ref: IconRef | undefined | null, size: number): IconStyle | null {
  if (ref === undefined || ref === null || ref === '') return null;
  try {
    return resolver(ref, size);
  } catch {
    return null;
  }
}

const EM_BASE = 100;
const PX_RE = /(-?\d+(?:\.\d+)?)px/g;
const pxToEm = (v: string): string => v.replace(PX_RE, (_m, n: string) => `${Number(n) / EM_BASE}em`);

type IconNode = HTMLElement & { __icon?: string };

/**
 * Applies an icon as CSS background on `node`, expressed in em units: the node must be 1em x 1em
 * (class `ico`) and its font-size sets the displayed size, so icons scale with the UI.
 * Returns false (and adds `ico--missing` + data-glyph for a CSS fallback) when unresolved.
 * Cheap to call every frame: it is a no-op when the ref did not change.
 */
export function applyIcon(node: IconNode, ref: IconRef | undefined | null, fallbackGlyph = '✦'): boolean {
  const key = `${resolverSerial}|${ref ?? ''}`;
  if (node.__icon === key) return !node.classList.contains('ico--missing');
  node.__icon = key;
  const st = resolveIcon(ref, EM_BASE);
  if (!st) {
    node.style.backgroundImage = '';
    node.classList.add('ico--missing');
    node.dataset.glyph = fallbackGlyph;
    return false;
  }
  node.classList.remove('ico--missing');
  node.style.backgroundImage = st.backgroundImage;
  node.style.backgroundPosition = pxToEm(st.backgroundPosition);
  node.style.backgroundSize = pxToEm(st.backgroundSize);
  node.style.backgroundRepeat = 'no-repeat';
  return true;
}

/** Creates a `<span class="ico">` showing an icon (size it with font-size). */
export function iconEl(ref: IconRef | undefined | null, cls = '', fallbackGlyph = '✦'): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = `ico ${cls}`.trim();
  applyIcon(s, ref, fallbackGlyph);
  return s;
}
