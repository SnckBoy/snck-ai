import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, requireUser } from '@/lib/auth';
import { chatRequestSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { resolveModelForUser } from '@/lib/models';
import { checkUsageAllowed } from '@/lib/usage';
import { buildChatStream } from '@/lib/chat-stream';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  const limited = rateLimit({ keyPrefix: 'chat', max: 20 })(req, user.id);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const { modelId, content, conversationId, title } = parsed.data;

  try {
    const { model, provider } = await resolveModelForUser(modelId, user);
    await checkUsageAllowed(user.id);

    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
      });
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    } else {
      const autoTitle = (title?.trim() || content.trim().slice(0, 60)) || 'New Chat';
      conversation = await prisma.conversation.create({
        data: { userId: user.id, title: autoTitle, modelId },
      });
    }

    // Persist the user message before streaming.
    await prisma.message.create({
      data: { conversationId: conversation.id, role: 'user', content, modelId },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        modelId,
        ...(conversation.title === 'New Chat' ? { title: content.trim().slice(0, 60) || 'New Chat' } : {}),
      },
    });

    const { stream } = buildChatStream({
      user,
      model,
      provider,
      conversationId: conversation.id,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json(
      { error: e.message || 'Failed to send message' },
      { status: e.status ?? 500 },
    );
  }
}
