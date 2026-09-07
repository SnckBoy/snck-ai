/**
 * Snck AI - Mock AI Provider (plain JS, used by the demo service in
 * docker-compose.yml so a fresh install has working chat immediately).
 *
 * This is a local OpenAI-compatible server used for development, testing and
 * out-of-the-box demos WITHOUT real API keys. It implements:
 *   GET  /models
 *   POST /chat/completions  (streaming SSE + usage reporting)
 */

const http = require('node:http');

const PORT = Number(process.env.MOCK_PORT ?? 4500);
const MODELS = [
  { id: 'snck-mock-gpt', object: 'model', created: 1735689600, owned_by: 'snck-mock' },
  { id: 'snck-mock-claude', object: 'model', created: 1735689600, owned_by: 'snck-mock' },
  { id: 'snck-mock-gemini', object: 'model', created: 1735689600, owned_by: 'snck-mock' },
];

function sendSSE(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitText(text, chunkSize) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks.length ? chunks : [''];
}

function buildResponse(userMsg, model) {
  const t = (userMsg || '').trim() || 'world';
  return `Hello! I'm the **Snck Mock AI** running as \`${model}\`.

You said: *"${t}"*

This is a simulated response used for local development, testing and demos. Real providers (OpenAI, Anthropic, Gemini, OpenRouter) will return actual model output through the same code path.

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

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
    const userMsg = (json.messages || [])
      .filter((m) => m.role === 'user')
      .pop()?.content;
    const promptTokens = Math.round(JSON.stringify(json.messages).length / 4);
    const outputText = buildResponse(userMsg, model);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

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

server.listen(PORT, () => {
  console.log(`[snck-mock] Mock AI provider listening on http://0.0.0.0:${PORT}`);
});
