import { NextResponse } from 'next/server';
import { processDueJobs } from '@/lib/notify';

/** Call every minute from a cron service: curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/notifications/process */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const processed = await processDueJobs(50);
  return NextResponse.json({ processed });
}
