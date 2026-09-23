// pt-BR number/text formatting shared by the whole UI.

const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dec1Fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2Fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

/** 12345 -> "12.345" */
export const fmtInt = (n: number): string => intFmt.format(Math.round(n));
/** 1.25 -> "1,3" */
export const fmtDec1 = (n: number): string => dec1Fmt.format(n);
export const fmtDec = (n: number): string => dec2Fmt.format(n);
/** 1234567 -> "1,2 mi" (only above 100k; below uses full digits). */
export const fmtCompact = (n: number): string => (Math.abs(n) >= 100_000 ? compactFmt.format(n) : fmtInt(n));
/** Fraction -> percent: 0.05 -> "5%", 0.125 -> "12,5%". */
export const fmtPct = (f: number, digits = 1): string => {
  const v = f * 100;
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return `${Number.isInteger(r) ? fmtInt(r) : r.toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;
};

/** Format by affix/power format code. */
export function fmtByFormat(v: number, format: 'int' | 'dec1' | 'pct' | 'pct1'): string {
  switch (format) {
    case 'int':
      return fmtInt(v);
    case 'dec1':
      return fmtDec1(v);
    case 'pct':
      return fmtInt(v * 100);
    case 'pct1':
      return (Math.round(v * 1000) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }
}

/** Cooldown text: "12", "3", "0,4". */
export function fmtCooldown(s: number): string {
  if (s >= 1) return String(Math.ceil(s));
  return dec1Fmt.format(Math.max(0.1, s));
}

/** Seconds -> "m:ss" or "h:mm:ss". */
export function fmtClock(s: number): string {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = sec < 10 ? `0${sec}` : String(sec);
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${ss}`;
  return `${m}:${ss}`;
}

/** Play time: "3h 12min" / "45min". */
export function fmtPlayTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

/** Short buff duration: "12s", "1m". */
export function fmtShortDuration(s: number): string {
  if (s >= 60) return `${Math.floor(s / 60)}m`;
  if (s >= 10) return `${Math.floor(s)}s`;
  return `${Math.max(0, Math.ceil(s))}s`;
}

/** 0xRRGGBB -> "#rrggbb". */
export const hex = (c: number): string => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;

/** 0xRRGGBB -> "r, g, b" for rgba(). */
export const rgbTriplet = (c: number): string => `${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}`;

/** Multiply brightness of a 0xRRGGBB color. */
export function shade(c: number, f: number): number {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}

/** Mix two colors (t=0 -> a). */
export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round((((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t)) & 255;
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Replace {key} placeholders in a template. */
export function fillTemplate(tpl: string, values: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}
