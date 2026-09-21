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
  signal?: AbortSignal;
}

export interface ChatStreamOutput {
  stream: ReadableStream<Uint8Array>;
  conversationId: string;
}

const MAX_HISTORY_CHARS = 20_000;

export function buildChatStream({
  user,
  model,
  provider,
  conversationId,
  signal,
}: ChatStreamInput): ChatStreamOutput {
  if (!provider.apiKeyEnc) {
    throw new Error('Provider has no API key configured');
  }

  const apiKey = decryptSecret(provider.apiKeyEnc);
  const adapter = getAdapter(provider.type);

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const onAbort = () => abortController.abort();
  if (signal) {
    if (signal.aborted) abortController.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeSend = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* controller closed */
        }
      };
      const safeClose = () => {
        try {
          controller.close();
        } catch {
          /* already closed/cancelled */
        }
      };

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const history = await prisma.message.findMany({
          where: { conversationId, role: { in: ['user', 'assistant'] } },
          orderBy: { createdAt: 'asc' },
        });

        // Keep only the most recent context. Unbounded history inflates input
        // cost and can exceed the provider's context window on long chats.
        const providerMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        let historyChars = 0;
        for (let i = history.length - 1; i >= 0; i--) {
          const m = history[i];
          const len = m.content.length;
          if (providerMessages.length > 0 && historyChars + len > MAX_HISTORY_CHARS) break;
          providerMessages.unshift({ role: m.role as 'user' | 'assistant', content: m.content });
          historyChars += len;
        }

        const generator = adapter.chatStream(
          { baseUrl: provider.baseUrl ?? undefined, apiKey },
          {
            model: model.identifier,
            messages: providerMessages,
            maxTokens: 4096,
            signal: abortController.signal,
          },
        );

        for await (const chunk of generator) {
          if (abortController.signal.aborted) break;
          if (chunk.delta) {
            fullText += chunk.delta;
            safeSend({ type: 'delta', content: chunk.delta });
          }
          if (chunk.usage) {
            inputTokens = toTokenInt(chunk.usage.inputTokens);
            outputTokens = toTokenInt(chunk.usage.outputTokens);
          }
        }

        if (abortController.signal.aborted) {
          throw new Error('Generation stopped');
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
        const aborted = abortController.signal.aborted;
        const message = aborted
          ? 'Generation stopped'
          : err instanceof Error
            ? err.message
            : 'Unexpected streaming error';
        inputTokens = toTokenInt(inputTokens);
        outputTokens = toTokenInt(outputTokens);

        // Always persist whatever was generated so the user keeps partial output,
        // but never bill tokens for a response the user cancelled.
        if (fullText.trim().length > 0) {
          await prisma.message
            .create({
              data: {
                conversationId,
                role: 'assistant',
                content: fullText,
                modelId: model.id,
                inputTokens: BigInt(inputTokens),
                outputTokens: BigInt(outputTokens),
              },
            })
            .catch(() => undefined);
          if (!aborted) {
            await recordUsage({
              userId: user.id,
              providerId: provider.id,
              modelId: model.id,
              inputTokens,
              outputTokens,
            }).catch(() => undefined);
          }
        } else if (!aborted) {
          await prisma.message
            .create({
              data: {
                conversationId,
                role: 'assistant',
                content: 'An error occurred while generating a response.',
                modelId: model.id,
              },
            })
            .catch(() => undefined);
        }
        if (!aborted) safeSend({ type: 'error', message });
      } finally {
        if (signal) signal.removeEventListener('abort', onAbort);
        safeClose();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return { stream, conversationId };
}
