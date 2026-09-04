import { NextRequest, NextResponse } from 'next/server';
import { ApiError, requireOwner } from '@/lib/auth';
import { getPlatformLimits, savePlatformLimits } from '@/lib/usage';
import { platformSettingsSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
  const limits = await getPlatformLimits();
  return NextResponse.json({ settings: limits });
}

export async function PUT(req: NextRequest) {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parsed = platformSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await savePlatformLimits({
    defaultDailyTokenLimit: parsed.data.defaultDailyTokenLimit === undefined ? undefined : parsed.data.defaultDailyTokenLimit,
    defaultMonthlyTokenLimit: parsed.data.defaultMonthlyTokenLimit === undefined ? undefined : parsed.data.defaultMonthlyTokenLimit,
    defaultTotalTokenLimit: parsed.data.defaultTotalTokenLimit === undefined ? undefined : parsed.data.defaultTotalTokenLimit,
    defaultUnlimited: parsed.data.defaultUnlimited,
  });

  return NextResponse.json({ ok: true });
}
