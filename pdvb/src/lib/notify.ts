import { db } from './db';
import { getSettings, type SiteSettings } from './settings';
import { buildOrderText, buildTemplateParams, type MessageOrder } from './notify-message';
import type { Prisma } from '@prisma/client';

const MAX_ATTEMPTS = 5;

export type NotifyKind = 'ORDER_PAID' | 'ORDER_COD';

/** Call INSIDE the same transaction that confirms the order so the job is never lost. dedupeKey blocks duplicates. */
export async function enqueueWhatsApp(tx: Prisma.TransactionClient, orderId: string, kind: NotifyKind) {
  const dedupeKey = `${orderId}:${kind}:WHATSAPP`;
  await tx.notificationJob.upsert({
    where: { dedupeKey },
    create: { orderId, kind, channel: 'WHATSAPP', dedupeKey },
    update: {},
  });
}

type Config =
  | { mode: 'live'; token: string; phoneNumberId: string; recipient: string; template: string; lang: string; version: string }
  | { mode: 'demo'; reason: string };

export function resolveWhatsAppConfig(s: SiteSettings): Config {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (process.env.WHATSAPP_MODE !== 'live') return { mode: 'demo', reason: 'WHATSAPP_MODE is not "live"' };
  if (!token) return { mode: 'demo', reason: 'WHATSAPP_ACCESS_TOKEN is missing' };
  if (!s.whatsappPhoneNumberId) return { mode: 'demo', reason: 'Phone number ID is not set in Admin > Settings' };
  if (!s.whatsappBusinessRecipient) return { mode: 'demo', reason: 'Recipient number is not set in Admin > Settings' };
  return {
    mode: 'live', token, phoneNumberId: s.whatsappPhoneNumberId, recipient: s.whatsappBusinessRecipient.replace(/\D/g, ''),
    template: s.whatsappTemplateName, lang: s.whatsappTemplateLang, version: s.whatsappApiVersion,
  };
}

async function sendTemplate(cfg: Extract<Config, { mode: 'live' }>, params: string[]): Promise<string> {
  const res = await fetch(`https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: cfg.recipient,
      type: 'template',
      template: {
        name: cfg.template,
        language: { code: cfg.lang },
        components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
      },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
  if (!res.ok || !body.messages?.[0]?.id) {
    // Never include the token in stored errors.
    throw new Error(`WhatsApp API ${res.status}: ${body.error?.message ?? 'unknown error'} (code ${body.error?.code ?? '-'})`);
  }
  return body.messages[0].id;
}

async function log(jobId: string, status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'DEMO', detail?: string) {
  await db.notificationLog.create({ data: { jobId, status, detail } });
}

export async function processJob(jobId: string): Promise<void> {
  // Claim the job atomically so two workers never send the same message.
  const claimed = await db.notificationJob.updateMany({
    where: { id: jobId, status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 5 * 60_000) },
  });
  if (claimed.count === 0) return;

  const job = await db.notificationJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { order: { include: { items: true, payment: true } } },
  });
  const order = job.order as unknown as MessageOrder;
  const kind = job.kind as NotifyKind;
  const text = buildOrderText(order, kind);
  const settings = await getSettings();
  const cfg = resolveWhatsAppConfig(settings);

  try {
    if (cfg.mode === 'demo') {
      await db.notificationJob.update({ where: { id: jobId }, data: { status: 'DEMO', messagePreview: text, sentAt: new Date(), lastError: null } });
      await log(jobId, 'DEMO', `Not sent (${cfg.reason}). Message stored for preview only.`);
      return;
    }
    const messageId = await sendTemplate(cfg, buildTemplateParams(order, kind));
    await db.notificationJob.update({ where: { id: jobId }, data: { status: 'SENT', providerMessageId: messageId, messagePreview: text, sentAt: new Date(), lastError: null } });
    await log(jobId, 'SENT', `Accepted by WhatsApp API: ${messageId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const attempts = job.attempts;
    const giveUp = attempts >= MAX_ATTEMPTS;
    const backoffMin = Math.min(60, 2 ** attempts); // 2,4,8,16,32 minutes
    await db.notificationJob.update({
      where: { id: jobId },
      data: { status: giveUp ? 'FAILED' : 'PENDING', lastError: message, nextAttemptAt: new Date(Date.now() + backoffMin * 60_000), messagePreview: text },
    });
    await log(jobId, giveUp ? 'FAILED' : 'PENDING', `Attempt ${attempts} failed: ${message}`);
  }
}

export async function processDueJobs(limit = 20): Promise<number> {
  const due = await db.notificationJob.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });
  for (const j of due) await processJob(j.id);
  return due.length;
}

/** Admin retry: puts a FAILED/DEMO job back in the queue. Same job row, so no duplicate message record. */
export async function requeueJob(jobId: string) {
  await db.notificationJob.updateMany({
    where: { id: jobId, status: { in: ['FAILED', 'DEMO', 'PENDING'] } },
    data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
  await processJob(jobId);
}

/** Click-to-chat fallback. Opens WhatsApp with text prefilled; the user must still press Send. */
export function clickToChatUrl(recipientDigits: string, text: string) {
  return `https://wa.me/${recipientDigits.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}
