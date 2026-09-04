import type {
  ChatMessage,
  ChatStreamParams,
  ModelDefinition,
  ProviderAdapter,
  ProviderConnectionConfig,
  StreamChunk,
  TestResult,
} from './types';
import { ProviderError } from './types';
import { estimateTokens, mapHttpError, parseErrorResponse, sseJsonIterator } from './stream';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';

export const geminiAdapter: ProviderAdapter = {
  type: 'GEMINI',
  label: 'Google Gemini',
  description: 'Google Generative Language API (Gemini models).',
  defaultBaseUrl: DEFAULT_BASE_URL,
  defaultModels: [
    { identifier: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' },
    { identifier: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
    { identifier: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash' },
  ],

  async *chatStream(config, params) {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}/v1beta/models/${encodeURIComponent(params.model)}:streamGenerateContent?alt=sse`;
    const system = params.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const contents = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

    const body: {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      generationConfig: Record<string, unknown>;
      systemInstruction?: { parts: Array<{ text: string }> };
    } = {
      contents,
      generationConfig: {},
    };
    if (params.temperature !== undefined) body.generationConfig.temperature = params.temperature;
    if (params.maxTokens !== undefined) body.generationConfig.maxOutputTokens = params.maxTokens;
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey,
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
      const data = raw as any;
      const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      let chunkText = '';
      for (const part of parts) {
        if (part?.text) chunkText += part.text;
      }
      if (chunkText) {
        fullText += chunkText;
        yield { delta: chunkText };
      }
      if (data?.usageMetadata) {
        if (data.usageMetadata.promptTokenCount !== undefined) {
          inputTokens = data.usageMetadata.promptTokenCount;
        }
        if (data.usageMetadata.candidatesTokenCount !== undefined) {
          outputTokens = data.usageMetadata.candidatesTokenCount;
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
      const res = await fetch(`${baseUrl}/v1beta/models`, {
        headers: { 'x-goog-api-key': config.apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return { ok: true, status: 'CONNECTED', message: 'Connected successfully' };
      const detail = await parseErrorResponse(res).catch(() => '');
      if (res.status === 400 || res.status === 403) {
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
      res = await fetch(`${baseUrl}/v1beta/models`, {
        headers: { 'x-goog-api-key': config.apiKey },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new ProviderError('NETWORK_ERROR', (err as Error).message || 'Network error');
    }
    if (!res.ok) throw mapHttpError(res.status, await parseErrorResponse(res).catch(() => ''));
    const json = (await res.json()) as any;
    const list: ModelDefinition[] = Array.isArray(json?.models)
      ? json.models
          .filter((m: any) => String(m.name ?? '').includes('gemini') && !String(m.name ?? '').includes('embedding'))
          .map((m: any) => {
            const identifier = String(m.name).replace(/^models\//, '');
            return { identifier, displayName: m.displayName ?? identifier };
          })
      : [];
    if (list.length === 0) throw new ProviderError('PROVIDER_ERROR', 'No models returned by endpoint');
    return list;
  },
};

export type { ChatMessage, StreamChunk };
