/** Money is always integer paise. Format only at the edge (UI / messages). */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  const whole = Number.isInteger(rupees);
  return '₹' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function rupeesToPaise(input: string | number): number {
  const n = typeof input === 'number' ? input : parseFloat(input);
  if (!Number.isFinite(n) || n < 0) throw new Error('Invalid amount');
  return Math.round(n * 100);
}

export function discountPercent(pricePaise: number, mrpPaise?: number | null): number {
  if (!mrpPaise || mrpPaise <= pricePaise) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}
