import type {
  ChatStreamParams,
  ModelDefinition,
  ProviderAdapter,
  ProviderConnectionConfig,
  StreamChunk,
  TestResult,
} from './types';
import { ProviderError } from './types';
import { estimateTokens, mapHttpError, parseErrorResponse, sseJsonIterator } from './stream';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export const openaiCompatibleAdapter: ProviderAdapter = {
  type: 'OPENAI_COMPATIBLE',
  label: 'OpenAI Compatible',
  description: 'Any API that implements the OpenAI /chat/completions protocol.',
  defaultBaseUrl: DEFAULT_BASE_URL,
  defaultModels: [
    { identifier: 'gpt-4o', displayName: 'GPT-4o' },
    { identifier: 'gpt-4o-mini', displayName: 'GPT-4o Mini' },
    { identifier: 'gpt-4-turbo', displayName: 'GPT-4 Turbo' },
    { identifier: 'gpt-3.5-turbo', displayName: 'GPT-3.5 Turbo' },
  ],
  async *chatStream(config, params) {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const endpoint = `${baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: params.model,
      messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (params.temperature !== undefined) body.temperature = params.temperature;
    if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens;

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: params.signal,
      });
    } catch (err) {
      if (params.signal?.aborted) throw new ProviderError('NETWORK_ERROR', 'Request aborted');
      throw new ProviderError('NETWORK_ERROR', (err as Error).message || 'Network error');
    }

    if (!res.ok || !res.body) {
      const detail = await parseErrorResponse(res).catch(() => '');
      throw mapHttpError(res.status, detail);
    }

    // Some OpenAI-compatible endpoints return non-streaming JSON.
    if (!res.headers.get('content-type')?.includes('text/event-stream')) {
      const json = (await res.json()) as any;
      const content = json?.choices?.[0]?.message?.content ?? '';
      const usage = json?.usage;
      yield {
        delta: content,
        usage: usage
          ? {
              inputTokens: usage.prompt_tokens ?? estimateTokens(JSON.stringify(params.messages)),
              outputTokens: usage.completion_tokens ?? estimateTokens(content),
            }
          : undefined,
      };
      return;
    }

    let fullText = '';
    let inputTokens = estimateTokens(JSON.stringify(params.messages));
    let outputTokens = 0;

    for await (const raw of sseJsonIterator(res.body)) {
      const data = raw as any;
      const choice = data?.choices?.[0];
      const delta = choice?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        fullText += delta;
        yield { delta };
      }
      if (data?.usage) {
        if (data.usage.prompt_tokens !== undefined && data.usage.prompt_tokens !== null) {
          inputTokens = data.usage.prompt_tokens;
        }
        if (data.usage.completion_tokens !== undefined && data.usage.completion_tokens !== null) {
          outputTokens = data.usage.completion_tokens;
        } else {
          outputTokens = estimateTokens(fullText);
        }
      }
    }

    if (outputTokens === 0 && fullText.length > 0) outputTokens = estimateTokens(fullText);
    yield { usage: { inputTokens, outputTokens } };
  },

  async testConnection(config) {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return { ok: true, status: 'CONNECTED', message: 'Connected successfully' };
      const detail = await parseErrorResponse(res).catch(() => '');
      if (res.status === 401 || res.status === 403) {
        return { ok: false, status: 'INVALID_KEY', message: `Invalid API key: ${detail}` };
      }
      return { ok: false, status: 'PROVIDER_ERROR', message: `Provider error (HTTP ${res.status}): ${detail}` };
    } catch (err) {
      return { ok: false, status: 'NETWORK_ERROR', message: (err as Error).message || 'Network error' };
    }
  },

  async fetchModels(config) {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new ProviderError('NETWORK_ERROR', (err as Error).message || 'Network error');
    }
    if (!res.ok) throw mapHttpError(res.status, await parseErrorResponse(res).catch(() => ''));
    const json = (await res.json()) as any;
    const list: ModelDefinition[] = Array.isArray(json?.data)
      ? json.data.map((m: any) => ({ identifier: m.id ?? m.identifier, displayName: m.id ?? m.identifier }))
      : Array.isArray(json)
        ? json.map((m: any) => ({ identifier: m.id ?? m.identifier, displayName: m.id ?? m.identifier }))
        : [];
    if (list.length === 0) throw new ProviderError('PROVIDER_ERROR', 'No models returned by endpoint');
    return list;
  },
};

export type { StreamChunk };
