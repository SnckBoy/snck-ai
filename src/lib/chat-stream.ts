import { prisma } from '@/lib/prisma';
import { recordUsage } from '@/lib/usage';
import { decryptSecret } from '@/lib/crypto';
import { getAdapter } from '@/lib/providers';
import { toTokenInt } from '@/lib/serialize';
import type { SessionUser } from '@/lib/auth';
import type { AIProvider, Model } from '@prisma/client';

export type { SessionUser };

interface ChatStreamInput {
  user: SessionUser;
  model: Model;
  provider: AIProvider;
  conversationId: string;
}

export interface ChatStreamOutput {
  stream: ReadableStream<Uint8Array>;
  conversationId: string;
}

export function buildChatStream({
  user,
  model,
  provider,
  conversationId,
}: ChatStreamInput): ChatStreamOutput {
  if (!provider.apiKeyEnc) {
    throw new Error('Provider has no API key configured');
  }

  const apiKey = decryptSecret(provider.apiKeyEnc);
  const adapter = getAdapter(provider.type);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeSend = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* controller closed */
        }
      };

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const history = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'asc' },
        });
        const providerMessages = history
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        const generator = adapter.chatStream(
          { baseUrl: provider.baseUrl ?? undefined, apiKey },
          {
            model: model.identifier,
            messages: providerMessages,
            maxTokens: 4096,
          },
        );

        for await (const chunk of generator) {
          if (chunk.delta) {
            fullText += chunk.delta;
            safeSend({ type: 'delta', content: chunk.delta });
          }
          if (chunk.usage) {
            inputTokens = toTokenInt(chunk.usage.inputTokens);
            outputTokens = toTokenInt(chunk.usage.outputTokens);
          }
        }

        inputTokens = toTokenInt(inputTokens);
        outputTokens = toTokenInt(outputTokens);

        const assistant = await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: fullText || '(no response)',
            modelId: model.id,
            inputTokens: BigInt(inputTokens),
            outputTokens: BigInt(outputTokens),
          },
        });

        await recordUsage({
          userId: user.id,
          providerId: provider.id,
          modelId: model.id,
          inputTokens,
          outputTokens,
        });

        safeSend({
          type: 'done',
          conversationId,
          messageId: assistant.id,
          usage: { input: inputTokens, output: outputTokens },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected streaming error';
        inputTokens = toTokenInt(inputTokens);
        outputTokens = toTokenInt(outputTokens);

        if (fullText.trim().length > 0) {
          await prisma.message.create({
            data: {
              conversationId,
              role: 'assistant',
              content: fullText,
              modelId: model.id,
              inputTokens: BigInt(inputTokens),
              outputTokens: BigInt(outputTokens),
            },
          });
          await recordUsage({
            userId: user.id,
            providerId: provider.id,
            modelId: model.id,
            inputTokens,
            outputTokens,
          }).catch(() => undefined);
        } else {
          await prisma.message.create({
            data: {
              conversationId,
              role: 'assistant',
              content: 'An error occurred while generating a response.',
              modelId: model.id,
            },
          });
        }
        safeSend({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return { stream, conversationId };
}
