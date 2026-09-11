import type {
  ChatMessage,
  ChatStreamParams,
  ModelDefinition,
  ProviderAdapter,
  ProviderConnectionConfig,
  TestResult,
} from './types';
import { ProviderError } from './types';
import { estimateTokens, mapHttpError, parseErrorResponse, sseJsonIterator } from './stream';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

export const anthropicAdapter: ProviderAdapter = {
  type: 'ANTHROPIC',
  label: 'Anthropic',
  description: 'Anthropic Messages API (Claude models) or any compatible endpoint.',
  defaultBaseUrl: DEFAULT_BASE_URL,
  defaultModels: [
    { identifier: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' },
    { identifier: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet' },
    { identifier: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku' },
    { identifier: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus' },
  ],

  async *chatStream(config, params) {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const system = params.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');

    // Anthropic requires strictly alternating user/assistant turns, so merge
    // consecutive messages with the same role and never start with assistant.
    const messages: ChatMessage[] = [];
    for (const m of params.messages) {
      if (m.role === 'system') continue;
      const last = messages[messages.length - 1];
      if (last && last.role === m.role) {
        last.content += `\n\n${m.content}`;
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    }
    while (messages[0]?.role === 'assistant') messages.shift();

    const body: Record<string, unknown> = {
      model: params.model,
      messages,
      max_tokens: params.maxTokens ?? 4096,
      stream: true,
    };
    if (system) body.system = system;
    if (params.temperature !== undefined) body.temperature = params.temperature;

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
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

    let fullText = '';
    let inputTokens = estimateTokens(JSON.stringify(params.messages));
    let outputTokens = 0;

    for await (const raw of sseJsonIterator(res.body)) {
      const event = raw as any;
      switch (event.type) {
        case 'message_start':
          if (event.message?.usage?.input_tokens !== undefined) {
            inputTokens = event.message.usage.input_tokens;
          }
          break;
        case 'content_block_delta':
          if (event.delta?.type === 'text_delta' && event.delta.text) {
            fullText += event.delta.text;
            yield { delta: event.delta.text };
          }
          break;
        case 'message_delta':
          if (event.usage?.output_tokens !== undefined) {
            outputTokens = event.usage.output_tokens;
          }
          break;
        default:
          break;
      }
    }

    if (outputTokens === 0 && fullText.length > 0) outputTokens = estimateTokens(fullText);
    yield { usage: { inputTokens, outputTokens } };
  },

  async testConnection(config) {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    try {
      const res = await fetch(`${baseUrl}/v1/models`, {
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
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
      res = await fetch(`${baseUrl}/v1/models`, {
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new ProviderError('NETWORK_ERROR', (err as Error).message || 'Network error');
    }
    if (!res.ok) throw mapHttpError(res.status, await parseErrorResponse(res).catch(() => ''));
    const json = (await res.json()) as any;
    const list: ModelDefinition[] = Array.isArray(json?.data)
      ? json.data.map((m: any) => ({ identifier: m.id ?? m.identifier, displayName: m.id ?? m.identifier }))
      : [];
    if (list.length === 0) throw new ProviderError('PROVIDER_ERROR', 'No models returned by endpoint');
    return list;
  },
};
