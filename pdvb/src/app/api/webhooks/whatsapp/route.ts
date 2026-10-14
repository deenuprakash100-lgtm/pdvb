import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyMetaSignature } from '@/lib/signatures';

// Meta webhook verification handshake
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get('hub.mode') === 'subscribe' && u.searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(u.searchParams.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// Delivery receipts: sent -> delivered -> read, or failed
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'), process.env.WHATSAPP_APP_SECRET ?? '')) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  const body = JSON.parse(raw);
  const statuses: { id: string; status: string; errors?: { title?: string; message?: string }[] }[] =
    (body.entry ?? []).flatMap((e: any) => (e.changes ?? []).flatMap((c: any) => c.value?.statuses ?? [])); // eslint-disable-line @typescript-eslint/no-explicit-any

  for (const s of statuses) {
    const job = await db.notificationJob.findUnique({ where: { providerMessageId: s.id } });
    if (!job) continue;
    const map = { delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' } as const;
    const next = map[s.status as keyof typeof map];
    if (!next) continue;
    // Do not downgrade READ back to DELIVERED if events arrive out of order.
    if (job.status === 'READ' && next === 'DELIVERED') continue;
    const err = s.errors?.[0] ? `${s.errors[0].title ?? ''} ${s.errors[0].message ?? ''}`.trim() : null;
    await db.notificationJob.update({ where: { id: job.id }, data: { status: next, lastError: err } });
    await db.notificationLog.create({ data: { jobId: job.id, status: next, detail: err ?? `Provider status: ${s.status}` } });
  }
  return NextResponse.json({ ok: true });
}
