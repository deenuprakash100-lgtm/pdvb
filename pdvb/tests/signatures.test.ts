import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyCheckoutSignature, verifyWebhookSignature, verifyMetaSignature } from '@/lib/signatures';

const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');

describe('Razorpay checkout signature', () => {
  const secret = 'test_secret';
  it('accepts a valid signature', () => expect(verifyCheckoutSignature('order_1', 'pay_1', hmac(secret, 'order_1|pay_1'), secret)).toBe(true));
  it('rejects a tampered payment id', () => expect(verifyCheckoutSignature('order_1', 'pay_2', hmac(secret, 'order_1|pay_1'), secret)).toBe(false));
  it('rejects wrong secret and empty values', () => {
    expect(verifyCheckoutSignature('order_1', 'pay_1', hmac('other', 'order_1|pay_1'), secret)).toBe(false);
    expect(verifyCheckoutSignature('order_1', 'pay_1', '', secret)).toBe(false);
  });
});
describe('Razorpay webhook signature', () => {
  it('verifies raw body only', () => {
    const body = '{"event":"payment.captured"}';
    expect(verifyWebhookSignature(body, hmac('wh', body), 'wh')).toBe(true);
    expect(verifyWebhookSignature(body + ' ', hmac('wh', body), 'wh')).toBe(false);
    expect(verifyWebhookSignature(body, null, 'wh')).toBe(false);
  });
});
describe('Meta signature', () => {
  it('requires sha256= prefix', () => {
    const body = '{}';
    expect(verifyMetaSignature(body, `sha256=${hmac('app', body)}`, 'app')).toBe(true);
    expect(verifyMetaSignature(body, hmac('app', body), 'app')).toBe(false);
  });
});
