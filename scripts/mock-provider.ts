/**
 * Snck AI - Mock AI Provider
 *
 * A local OpenAI-compatible server used to develop and test Snck AI
 * end-to-end WITHOUT real API keys. It implements:
 *   GET  /models
 *   POST /chat/completions  (streaming SSE + usage reporting)
 *
 * Start it with:  npm run mock:provider
 * Then add it in the Owner dashboard as a "Custom" provider with base URL
 * http://localhost:4500 and any API key (e.g. mock-key-12345).
 */

import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 4500);
const MODELS = [
  { id: 'snck-mock-gpt', object: 'model', created: 1735689600, owned_by: 'snck-mock' },
  { id: 'snck-mock-claude', object: 'model', created: 1735689600, owned_by: 'snck-mock' },
  { id: 'snck-mock-gemini', object: 'model', created: 1735689600, owned_by: 'snck-mock' },
];

function sendSSE(res: http.ServerResponse, payload: unknown) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // CORS for local testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/models' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: MODELS }));
    return;
  }

  if (url.pathname === '/chat/completions' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const json = JSON.parse(body || '{}');
    const model = json.model ?? 'snck-mock-gpt';
    const userMsg = json.messages?.filter((m: any) => m.role === 'user').pop()?.content ?? '';
    const promptTokens = Math.round(JSON.stringify(json.messages).length / 4);
    const outputText = buildResponse(userMsg, model);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Simulate a streaming completion with a few chunks.
    const chunks = splitText(outputText, 24);
    for (let i = 0; i < chunks.length; i++) {
      await sleep(30);
      sendSSE(res, {
        id: 'chatcmpl-mock',
        object: 'chat.completion.chunk',
        model,
        choices: [{ index: 0, delta: { content: chunks[i] }, finish_reason: null }],
      });
    }
    sendSSE(res, {
      id: 'chatcmpl-mock',
      object: 'chat.completion.chunk',
      model,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    });
    sendSSE(res, {
      id: 'chatcmpl-mock',
      object: 'chat.completion.chunk',
      model,
      choices: [],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: Math.ceil(chunks.join('').length / 4),
      },
    });
    sendSSE(res, '[DONE]');
    res.end();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found' } }));
});

function buildResponse(userMsg: string, model: string): string {
  const t = userMsg.trim() || 'world';
  return `Hello! I'm the **Snck Mock AI** running as \`${model}\`.

You said: *"${t}"*

This is a simulated response used for local development and testing. Real providers (OpenAI, Anthropic, Gemini, OpenRouter) will return actual model output through the same code path.

### Markdown works here

- Streaming responses
- Code blocks
- Tables

\`\`\`ts
const answer = "42";
console.log(answer);
\`\`\`

**Have a great day!**`;
}

function splitText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks.length ? chunks : [''];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

server.listen(PORT, () => {
  console.log(`[snck-mock] Mock AI provider listening on http://localhost:${PORT}`);
  console.log(`[snck-mock] Base URL to use in Snck AI: http://localhost:${PORT}`);
  console.log(`[snck-mock] Models: ${MODELS.map((m) => m.id).join(', ')}`);
});
