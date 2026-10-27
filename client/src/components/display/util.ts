import type { SessionPublicState } from '../../../../shared/protocol';

/** Pick a font-size class by text length so long questions/choices still fit on screen. */
export function fitClass(text: string | undefined | null, scale: 'question' | 'choice' = 'question'): string {
  const len = (text ?? '').length;
  if (scale === 'choice') {
    if (len <= 18) return 'fit-xl';
    if (len <= 40) return 'fit-l';
    if (len <= 80) return 'fit-m';
    return 'fit-s';
  }
  if (len <= 50) return 'fit-xl';
  if (len <= 100) return 'fit-l';
  if (len <= 180) return 'fit-m';
  return 'fit-s';
}

/** Hostname (plus path if not root) from the join URL, for "go to <host>" copy. */
export function joinHost(joinUrl: string | undefined | null): string {
  if (!joinUrl) return '';
  try {
    const u = new URL(joinUrl);
    const path = u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : '';
    return `${u.host}${path}`;
  } catch {
    return joinUrl.replace(/^https?:\/\//, '').split(/[?#]/)[0];
  }
}

/** 1-based number of the current question, tolerant of missing data. */
export function questionNumber(state: SessionPublicState): number {
  const idx = state.question?.index ?? state.currentIndex;
  return typeof idx === 'number' && idx >= 0 ? idx + 1 : 0;
}

export function safeArray<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function formatScore(n: number | undefined | null): string {
  return Number.isFinite(n as number) ? Math.round(n as number).toLocaleString() : '0';
}
