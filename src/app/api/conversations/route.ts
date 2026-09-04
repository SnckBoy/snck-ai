import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { createConversationSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get('q')?.trim() ?? '';
    const limit = Math.min(Number(searchParams.get('limit') ?? 100), 200);

    const conversations = await prisma.conversation.findMany({
      where: {
        userId: user.id,
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        modelId: c.modelId,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        messageCount: c._count.messages,
        preview: c.messages[0]?.content?.slice(0, 120) ?? '',
      })),
    });
  } catch (err) {
    const e = err as { status?: number; message: string };
    return NextResponse.json({ error: e.message || 'Failed' }, { status: e.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: parsed.data.title ?? 'New Chat',
        modelId: parsed.data.modelId,
      },
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err) {
    const e = err as { status?: number; message: string };
    return NextResponse.json({ error: e.message || 'Failed' }, { status: e.status ?? 500 });
  }
}
