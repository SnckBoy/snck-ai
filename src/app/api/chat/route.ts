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
    // These three lookups are independent — run them concurrently to cut
    // latency before the first token.
    const [{ model, provider }, , existing] = await Promise.all([
      resolveModelForUser(modelId, user),
      checkUsageAllowed(user.id),
      conversationId
        ? prisma.conversation.findFirst({
            where: { id: conversationId, userId: user.id },
          })
        : Promise.resolve(null),
    ]);

    if (conversationId && !existing) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    let activeConversationId: string;
    if (existing) {
      activeConversationId = existing.id;

      // Persist the user message before streaming.
      await prisma.message.create({
        data: { conversationId: existing.id, role: 'user', content, modelId },
      });

      const needsTitle = existing.title === 'New Chat';
      if (existing.modelId !== modelId || needsTitle) {
        await prisma.conversation.update({
          where: { id: existing.id },
          data: {
            modelId,
            ...(needsTitle ? { title: content.trim().slice(0, 60) || 'New Chat' } : {}),
          },
        });
      }
    } else {
      const autoTitle = (title?.trim() || content.trim().slice(0, 60)) || 'New Chat';
      const created = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: autoTitle,
          modelId,
          messages: { create: { role: 'user', content, modelId } },
        },
      });
      activeConversationId = created.id;
    }

    const { stream } = buildChatStream({
      user,
      model,
      provider,
      conversationId: activeConversationId,
      signal: req.signal,
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
