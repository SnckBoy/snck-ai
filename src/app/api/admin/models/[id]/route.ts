import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, requireOwner } from '@/lib/auth';
import { modelUpdateSchema } from '@/lib/validation';

export const runtime = 'nodejs';

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
  const parsed = modelUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const model = await prisma.model.findUnique({ where: { id: params.id } });
    if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName;
    if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
    if (parsed.data.standardAccess !== undefined) data.standardAccess = parsed.data.standardAccess;
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;

    const updated = await prisma.model.update({ where: { id: model.id }, data });
    return NextResponse.json({ ok: true, model: updated });
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
    const model = await prisma.model.findUnique({ where: { id: params.id } });
    if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    await prisma.model.delete({ where: { id: model.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
