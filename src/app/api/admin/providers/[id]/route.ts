import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, requireOwner } from '@/lib/auth';
import { providerUpdateSchema } from '@/lib/validation';
import { encryptSecret, decryptSecret, maskSecret } from '@/lib/crypto';
import { getAdapter, getDefaultModels } from '@/lib/providers';
import { ProviderError } from '@/lib/providers';

export const runtime = 'nodejs';

async function loadProvider(id: string) {
  const provider = await prisma.aIProvider.findUnique({ where: { id } });
  if (!provider) throw new ApiError(404, 'Provider not found');
  return provider;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  const parsed = providerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const provider = await loadProvider(params.id);
    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.baseUrl !== undefined) data.baseUrl = parsed.data.baseUrl || getAdapter(provider.type).defaultBaseUrl;
    if (parsed.data.apiKey !== undefined && parsed.data.apiKey) {
      data.apiKeyEnc = encryptSecret(parsed.data.apiKey);
    }
    if (parsed.data.type !== undefined) data.type = parsed.data.type;
    if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;

    const updated = await prisma.aIProvider.update({ where: { id: provider.id }, data });

    return NextResponse.json({
      ok: true,
      provider: {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        baseUrl: updated.baseUrl,
        enabled: updated.enabled,
        status: updated.status,
        statusMessage: updated.statusMessage,
        hasKey: Boolean(updated.apiKeyEnc),
        maskedKey: updated.apiKeyEnc ? maskSecret(decryptSecret(updated.apiKeyEnc)) : null,
      },
    });
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
  try {
    const provider = await loadProvider(params.id);
    await prisma.aIProvider.delete({ where: { id: provider.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  const action = new URL(req.url).searchParams.get('action');

  try {
    const provider = await loadProvider(params.id);
    if (!provider.apiKeyEnc) {
      return NextResponse.json({ error: 'Provider has no API key configured' }, { status: 400 });
    }
    const apiKey = decryptSecret(provider.apiKeyEnc);
    const adapter = getAdapter(provider.type);

    if (action === 'test') {
      const result = await adapter.testConnection({ baseUrl: provider.baseUrl ?? undefined, apiKey });
      await prisma.aIProvider.update({
        where: { id: provider.id },
        data: { status: result.status, statusMessage: result.message },
      });
      return NextResponse.json(result);
    }

    if (action === 'fetch-models') {
      let models;
      try {
        models = await adapter.fetchModels({ baseUrl: provider.baseUrl ?? undefined, apiKey });
      } catch (err) {
        const e = err as ProviderError;
        await prisma.aIProvider.update({
          where: { id: provider.id },
          data: { status: e.status, statusMessage: e.message },
        });
        return NextResponse.json({ ok: false, status: e.status, message: e.message }, { status: 400 });
      }
      const existing = await prisma.model.findMany({
        where: { providerId: provider.id },
        select: { identifier: true },
      });
      const existingIds = new Set(existing.map((m) => m.identifier));
      const toCreate = models.filter((m) => !existingIds.has(m.identifier));
      if (toCreate.length > 0) {
        await prisma.model.createMany({
          data: toCreate.map((m) => ({
            providerId: provider.id,
            identifier: m.identifier,
            displayName: m.displayName,
          })),
        });
      }
      await prisma.aIProvider.update({
        where: { id: provider.id },
        data: { status: 'CONNECTED', statusMessage: `Fetched ${models.length} models` },
      });
      return NextResponse.json({ ok: true, fetched: models.length, created: toCreate.length });
    }

    if (action === 'add-model') {
      const body = (await req.json()) as { identifier?: string; displayName?: string };
      if (!body.identifier?.trim()) {
        return NextResponse.json({ error: 'Model identifier is required' }, { status: 400 });
      }
      const model = await prisma.model.create({
        data: {
          providerId: provider.id,
          identifier: body.identifier.trim(),
          displayName: body.displayName?.trim() || body.identifier.trim(),
        },
      });
      return NextResponse.json({ ok: true, model }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const action = new URL(req.url).searchParams.get('action');
  if (action === 'toggle') {
    return POST(req, { params });
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
