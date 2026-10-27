import { timingSafeEqual } from 'node:crypto';

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cbc-admin';
export const IS_DEFAULT_ADMIN_PASSWORD = !process.env.ADMIN_PASSWORD;

/** Constant-time string comparison (length leaks are acceptable for this use). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
