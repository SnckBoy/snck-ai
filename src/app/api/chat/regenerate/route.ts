import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, requireUser } from '@/lib/auth';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { resolveModelForUser } from '@/lib/models';
import { checkUsageAllowed } from '@/lib/usage';
import { buildChatStream } from '@/lib/chat-stream';

export const runtime = 'nodejs';

const schema = z.object({
  conversationId: z.string().min(1),
  modelId: z.string().min(1),
});

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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { conversationId, modelId } = parsed.data;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: user.id },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { model, provider } = await resolveModelForUser(modelId, user);
    await checkUsageAllowed(user.id);

    // Remove the last assistant message so the model can generate a fresh answer.
    const lastMessage = await prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });
    if (lastMessage?.role === 'assistant') {
      await prisma.message.delete({ where: { id: lastMessage.id } });
    } else {
      return NextResponse.json({ error: 'Nothing to regenerate' }, { status: 400 });
    }

    const { stream } = buildChatStream({
      user,
      model,
      provider,
      conversationId,
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
      { error: e.message || 'Failed to regenerate' },
      { status: e.status ?? 500 },
    );
  }
}
