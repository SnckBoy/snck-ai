import { NextRequest, NextResponse } from 'next/server';
import { ApiError, requireUser } from '@/lib/auth';
import { getAvailableModels } from '@/lib/models';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
  const models = await getAvailableModels(user);
  return NextResponse.json({
    models: models.map((m) => ({
      id: m.id,
      identifier: m.identifier,
      displayName: m.displayName,
      providerId: m.providerId,
      providerName: m.provider.name,
      providerType: m.provider.type,
    })),
  });
}
