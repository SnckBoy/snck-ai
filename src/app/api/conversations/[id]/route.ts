import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { renameConversationSchema } from '@/lib/validation';
import { num } from '@/lib/serialize';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        modelId: conversation.modelId,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messages: conversation.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          modelId: m.modelId,
          inputTokens: num(m.inputTokens),
          outputTokens: num(m.outputTokens),
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    const e = err as { status?: number; message: string };
    return NextResponse.json({ error: e.message || 'Failed' }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const parsed = renameConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { title: parsed.data.title },
    });

    return NextResponse.json({ conversation: updated });
  } catch (err) {
    const e = err as { status?: number; message: string };
    return NextResponse.json({ error: e.message || 'Failed' }, { status: e.status ?? 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    await prisma.conversation.delete({ where: { id: conversation.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { status?: number; message: string };
    return NextResponse.json({ error: e.message || 'Failed' }, { status: e.status ?? 500 });
  }
}
