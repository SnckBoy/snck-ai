import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import ChatArea from '@/components/chat/chat-area';
import { num } from '@/lib/serialize';

export const metadata = {
  title: 'Chat',
};

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const user = await getSession();
  const conversation = await prisma.conversation.findFirst({
    where: { id: params.id, userId: user?.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!conversation) notFound();

  return (
    <div className="h-full">
      <ChatArea
        conversationId={conversation.id}
        initialTitle={conversation.title}
        initialMessages={conversation.messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          modelId: m.modelId,
          inputTokens: num(m.inputTokens),
          outputTokens: num(m.outputTokens),
        }))}
      />
    </div>
  );
}
