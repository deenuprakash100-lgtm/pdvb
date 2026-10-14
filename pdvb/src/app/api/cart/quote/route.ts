import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildQuote } from '@/lib/quote';
import { clientIp, rateLimit } from '@/lib/ratelimit';

const schema = z.object({
  items: z.array(z.object({ variantId: z.string().min(1), qty: z.number().int().min(1).max(20) })).max(50),
  couponCode: z.string().max(30).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  paymentMethod: z.enum(['ONLINE', 'COD']).optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`quote:${clientIp(req)}`, 120, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  if (parsed.data.items.length === 0) return NextResponse.json({ lines: [], totals: null, errors: [], codAllowed: false });
  const q = await buildQuote(parsed.data);
  return NextResponse.json(q);
}
