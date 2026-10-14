import { randomBytes } from 'node:crypto';

export function newOrderNumber(now = new Date()): string {
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = randomBytes(4).toString('hex').slice(0, 5).toUpperCase();
  return `PDVB-${ymd}-${rand}`;
}
export const newAccessToken = () => randomBytes(24).toString('hex');
