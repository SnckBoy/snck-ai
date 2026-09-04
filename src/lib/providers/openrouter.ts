import type {
  ChatStreamParams,
  ModelDefinition,
  ProviderAdapter,
  ProviderConnectionConfig,
  TestResult,
} from './types';
import { ProviderError } from './types';
import { estimateTokens, mapHttpError, parseErrorResponse, sseJsonIterator } from './stream';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export const openrouterAdapter: ProviderAdapter = {
  type: 'OPENROUTER',
  label: 'OpenRouter',
  description: 'OpenRouter unified API with access to hundreds of models.',
  defaultBaseUrl: DEFAULT_BASE_URL,
  defaultModels: [
    { identifier: 'openai/gpt-4o', displayName: 'OpenAI GPT-4o' },
    { identifier: 'anthropic/claude-3.5-sonnet', displayName: 'Claude 3.5 Sonnet' },
    { identifier: 'google/gemini-2.0-flash-exp:free', displayName: 'Gemini 2.0 Flash (free)' },
    { identifier: 'meta-llama/llama-3.1-70b-instruct', displayName: 'Llama 3.1 70B' },
  ],

  async *chatStream(config, params) {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
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
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Snck AI',
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

    if (!res.headers.get('content-type')?.includes('text/event-stream')) {
      const json = (await res.json()) as any;
      const content = json?.choices?.[0]?.message?.content ?? '';
      yield {
        delta: content,
        usage: json?.usage
          ? {
              inputTokens: json.usage.prompt_tokens ?? estimateTokens(JSON.stringify(params.messages)),
              outputTokens: json.usage.completion_tokens ?? estimateTokens(content),
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
      const delta = data?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        fullText += delta;
        yield { delta };
      }
      if (data?.usage) {
        if (data.usage.prompt_tokens != null) inputTokens = data.usage.prompt_tokens;
        if (data.usage.completion_tokens != null) outputTokens = data.usage.completion_tokens;
        else outputTokens = estimateTokens(fullText);
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
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new ProviderError('NETWORK_ERROR', (err as Error).message || 'Network error');
    }
    if (!res.ok) throw mapHttpError(res.status, await parseErrorResponse(res).catch(() => ''));
    const json = (await res.json()) as any;
    const list: ModelDefinition[] = Array.isArray(json?.data)
      ? json.data.map((m: any) => ({ identifier: m.id ?? m.identifier, displayName: m.name ?? m.id ?? m.identifier }))
      : [];
    if (list.length === 0) throw new ProviderError('PROVIDER_ERROR', 'No models returned by endpoint');
    return list;
  },
};
