'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, Send, Square, Sparkles } from 'lucide-react';
import MessageBubble from './message-bubble';
import ModelSelector from './model-selector';
import { useChatStore } from '@/store/chat-store';
import type { ChatMessage, ConversationSummary } from '@/types';

interface ChatAreaProps {
  conversationId?: string | null;
  initialMessages?: ChatMessage[];
  initialTitle?: string;
}

let tempId = 0;
const nextId = () => `tmp-${Date.now()}-${tempId++}`;

function parseSSE(line: string): { type: string; [k: string]: unknown } | null {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export default function ChatArea({ conversationId, initialMessages = [], initialTitle }: ChatAreaProps) {
  const router = useRouter();
  const selectedModelId = useChatStore((s) => s.selectedModelId);
  const addOrUpdateConversation = useChatStore((s) => s.addOrUpdateConversation);

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(conversationId ?? null);
  const [title, setTitle] = useState(initialTitle ?? '');
  const [streamError, setStreamError] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    setConvoId(conversationId ?? null);
    setTitle(initialTitle ?? '');
    setMessages(initialMessages);
  }, [conversationId, initialTitle, initialMessages]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, []);

  useEffect(() => {
    if (isStreaming || messages.length > 0) {
      if (atBottomRef.current) scrollToBottom(true);
    }
  }, [messages, isStreaming, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowJump(!atBottomRef.current);
  };

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isStreaming) return;
      if (!selectedModelId) {
        setStreamError('No model selected. Choose a model from the selector above.');
        return;
      }

      setStreamError('');
      setIsStreaming(true);
      atBottomRef.current = true;

      const userMsg: ChatMessage = {
        id: nextId(),
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      };
      const newMessages = [...messages, userMsg, assistantMsg];
      setMessages(newMessages);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: convoId, modelId: selectedModelId, content }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let msg = `Request failed (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {
            /* ignore */
          }
          setMessages((prev) => {
            const copy = [...prev];
            const idx = copy.findIndex((m) => m.id === assistantMsg.id);
            if (idx >= 0) copy[idx] = { ...copy[idx], error: msg, content: '⚠️ ' + msg };
            return copy;
          });
          return;
        }

        if (!res.body) throw new Error('No response stream');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx = buffer.indexOf('\n\n');
          while (idx !== -1) {
            const line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const evt = parseSSE(line);
            if (evt) {
              if (evt.type === 'delta') {
                const delta = String(evt.content ?? '');
                setMessages((prev) => {
                  const copy = [...prev];
                  const mIdx = copy.findIndex((m) => m.id === assistantMsg.id);
                  if (mIdx >= 0) {
                    copy[mIdx] = { ...copy[mIdx], content: copy[mIdx].content + delta };
                  }
                  return copy;
                });
              } else if (evt.type === 'usage') {
                const u = evt.usage as { input: number; output: number };
                setMessages((prev) => {
                  const copy = [...prev];
                  const mIdx = copy.findIndex((m) => m.id === assistantMsg.id);
                  if (mIdx >= 0) {
                    copy[mIdx] = {
                      ...copy[mIdx],
                      inputTokens: u?.input ?? 0,
                      outputTokens: u?.output ?? 0,
                    };
                  }
                  return copy;
                });
              } else if (evt.type === 'done') {
                const cid = String(evt.conversationId ?? '');
                setMessages((prev) => {
                  const copy = [...prev];
                  const mIdx = copy.findIndex((m) => m.id === assistantMsg.id);
                  if (mIdx >= 0) {
                    copy[mIdx] = {
                      ...copy[mIdx],
                      id: String(evt.messageId ?? copy[mIdx].id),
                      inputTokens: (evt.usage as { input: number })?.input ?? 0,
                      outputTokens: (evt.usage as { output: number })?.output ?? 0,
                    };
                  }
                  return copy;
                });
                const summary: ConversationSummary = {
                  id: cid,
                  title: content.trim().slice(0, 60),
                  modelId: selectedModelId,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  messageCount: 2,
                };
                addOrUpdateConversation(summary);
                setConvoId(cid);
                if (!convoId && cid && window.location.pathname !== `/chat/${cid}`) {
                  router.replace(`/chat/${cid}`, { scroll: false });
                }
              } else if (evt.type === 'error') {
                const msg = String(evt.message ?? 'An error occurred');
                setMessages((prev) => {
                  const copy = [...prev];
                  const mIdx = copy.findIndex((m) => m.id === assistantMsg.id);
                  if (mIdx >= 0) copy[mIdx] = { ...copy[mIdx], error: msg };
                  return copy;
                });
              }
            }
            idx = buffer.indexOf('\n\n');
          }
        }
      } catch (err) {
        if (controller.signal.aborted) {
          // User pressed stop — keep the partial content.
          setMessages((prev) => {
            const copy = [...prev];
            const mIdx = copy.findIndex((m) => m.id === assistantMsg.id);
            if (mIdx >= 0 && copy[mIdx].content) {
              copy[mIdx] = { ...copy[mIdx], error: 'Generation stopped.' };
            }
            return copy;
          });
        } else {
          setMessages((prev) => {
            const copy = [...prev];
            const mIdx = copy.findIndex((m) => m.id === assistantMsg.id);
            if (mIdx >= 0) copy[mIdx] = { ...copy[mIdx], error: (err as Error).message };
            return copy;
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        setInput('');
        textareaRef.current?.focus();
      }
    },
    [isStreaming, selectedModelId, convoId, messages, addOrUpdateConversation, router],
  );

  const stop = () => {
    abortRef.current?.abort();
  };

  const regenerate = useCallback(async () => {
    if (!convoId || isStreaming) return;
    if (!selectedModelId) {
      setStreamError('No model selected.');
      return;
    }

    // Drop the last assistant message locally.
    const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user');
    if (lastUserIndex < 0) return;
    const newMessages = messages.slice(0, lastUserIndex + 1);
    setMessages(newMessages);
    setStreamError('');
    setIsStreaming(true);

    const assistantMsg: ChatMessage = {
      id: nextId(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convoId, modelId: selectedModelId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.findIndex((m) => m.id === assistantMsg.id);
          if (idx >= 0) copy[idx] = { ...copy[idx], error: msg, content: '⚠️ ' + msg };
          return copy;
        });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx = buffer.indexOf('\n\n');
        while (idx !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const evt = parseSSE(line);
          if (evt) {
            if (evt.type === 'delta') {
              const delta = String(evt.content ?? '');
              setMessages((prev) => {
                const copy = [...prev];
                const mIdx = copy.findIndex((m) => m.id === assistantMsg.id);
                if (mIdx >= 0) copy[mIdx] = { ...copy[mIdx], content: copy[mIdx].content + delta };
                return copy;
              });
            } else if (evt.type === 'usage') {
              const u = evt.usage as { input: number; output: number };
              setMessages((prev) => {
                const copy = [...prev];
                const mIdx = copy.findIndex((m) => m.id === assistantMsg.id);
                if (mIdx >= 0) copy[mIdx] = { ...copy[mIdx], inputTokens: u?.input ?? 0, outputTokens: u?.output ?? 0 };
                return copy;
              });
            } else if (evt.type === 'done') {
              setMessages((prev) => {
                const copy = [...prev];
                const mIdx = copy.findIndex((m) => m.id === assistantMsg.id);
                if (mIdx >= 0) copy[mIdx] = { ...copy[mIdx], id: String(evt.messageId ?? copy[mIdx].id) };
                return copy;
              });
              addOrUpdateConversation({
                id: convoId,
                title: title || 'New Chat',
                modelId: selectedModelId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                messageCount: newMessages.length + 1,
              });
            } else if (evt.type === 'error') {
              const msg = String(evt.message ?? 'An error occurred');
              setMessages((prev) => {
                const copy = [...prev];
                const mIdx = copy.findIndex((m) => m.id === assistantMsg.id);
                if (mIdx >= 0) copy[mIdx] = { ...copy[mIdx], error: msg };
                return copy;
              });
            }
          }
          idx = buffer.indexOf('\n\n');
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        const mIdx = copy.findIndex((m) => m.id === assistantMsg.id);
        if (mIdx >= 0 && !controller.signal.aborted) copy[mIdx] = { ...copy[mIdx], error: (err as Error).message };
        return copy;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      textareaRef.current?.focus();
    }
  }, [convoId, isStreaming, selectedModelId, messages, title, addOrUpdateConversation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
      e.preventDefault();
      send(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="relative flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-[rgba(var(--bg),0.6)] px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold sm:text-base">
            {title || 'New Chat'}
          </h1>
          <p className="hidden text-xs text-foreground/40 sm:block">
            {convoId ? 'Conversation' : 'Start a new conversation'}
          </p>
        </div>
        <ModelSelector compact />
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto scrollbar-thin"
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-cyan-500 shadow-glow"
            >
              <Sparkles className="h-8 w-8 text-white" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl font-bold"
            >
              Ask anything
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="mt-2 max-w-md text-foreground/50"
            >
              Choose a model above and start a conversation. Your chats are saved automatically.
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-foreground/40"
            >
              {['Markdown', 'Code highlighting', 'Streaming', 'Multi-model'].map((f) => (
                <span key={f} className="glass rounded-full px-3 py-1">{f}</span>
              ))}
            </motion.div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                message={m}
                isStreaming={isStreaming && i === messages.length - 1 && m.role === 'assistant'}
                isLast={i === messages.length - 1}
                onRegenerate={m.role === 'assistant' && i === messages.length - 1 ? regenerate : undefined}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        <AnimatePresence>
          {showJump && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => {
                atBottomRef.current = true;
                setShowJump(false);
                scrollToBottom();
              }}
              className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-border glass-strong shadow-glow"
            >
              <ArrowDown className="h-4 w-4 text-purple-300" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-[rgba(var(--bg),0.6)] px-4 pb-4 pt-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-3xl">
          {streamError && (
            <p className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {streamError}
            </p>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-[rgba(var(--surface),0.7)] p-2 transition-all focus-within:border-purple-400/50 focus-within:shadow-glow">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Message Snck AI…"
              className="max-h-40 min-h-[2.4rem] flex-1 resize-none bg-transparent px-3 py-2 text-[0.95rem] outline-none placeholder:text-foreground/35"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              }}
            />
            {isStreaming ? (
              <button
                onClick={stop}
                title="Stop generating"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white transition-transform hover:scale-105"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => send(input)}
                disabled={!input.trim()}
                title="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-cyan-500 text-white shadow-glow transition-all hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-foreground/30">
            Snck AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
