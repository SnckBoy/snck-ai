import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, requireOwner } from '@/lib/auth';
import { providerSchema } from '@/lib/validation';
import { encryptSecret, maskSecret, decryptSecret } from '@/lib/crypto';
import { getAdapter, getDefaultModels } from '@/lib/providers';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  const providers = await prisma.aIProvider.findMany({
    include: {
      models: { orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }] },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    providers: providers.map((p) => {
      let masked: string | null = null;
      if (p.apiKeyEnc) {
        try {
          masked = maskSecret(decryptSecret(p.apiKeyEnc));
        } catch {
          masked = null;
        }
      }
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        baseUrl: p.baseUrl,
        enabled: p.enabled,
        status: p.status,
        statusMessage: p.statusMessage,
        hasKey: Boolean(p.apiKeyEnc),
        maskedKey: masked,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        models: p.models.map((m) => ({
          id: m.id,
          identifier: m.identifier,
          displayName: m.displayName,
          enabled: m.enabled,
          standardAccess: m.standardAccess,
          sortOrder: m.sortOrder,
        })),
      };
    }),
  });
}

export async function POST(req: NextRequest) {
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
  const parsed = providerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const { name, type, baseUrl, apiKey } = parsed.data;

  // Validate API key format where possible.
  if (type === 'GEMINI' && !/^[A-Za-z0-9_-]{10,}$/.test(apiKey)) {
    return NextResponse.json({ error: 'This does not look like a valid Gemini API key' }, { status: 400 });
  }

  const provider = await prisma.aIProvider.create({
    data: {
      name,
      type,
      baseUrl: baseUrl || getAdapter(type).defaultBaseUrl,
      apiKeyEnc: encryptSecret(apiKey),
      enabled: true,
      status: 'UNTESTED',
    },
  });

  const defaults = getDefaultModels(type);
  await prisma.model.createMany({
    data: defaults.map((m, i) => ({
      providerId: provider.id,
      identifier: m.identifier,
      displayName: m.displayName,
      enabled: true,
      sortOrder: i,
    })),
  });

  return NextResponse.json({ provider: { id: provider.id } }, { status: 201 });
}
