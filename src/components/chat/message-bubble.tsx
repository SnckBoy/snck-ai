'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Check, Copy, RefreshCw, User, AlertTriangle } from 'lucide-react';
import Markdown from './markdown';
import type { ChatMessage } from '@/types';
import { cn } from '@/components/ui';

export default function MessageBubble({
  message,
  isStreaming,
  onRegenerate,
  isLast,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  isLast?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('group flex gap-3', isUser && 'flex-row-reverse')}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
          isUser
            ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-glow'
            : 'bg-gradient-to-br from-cyan-500 to-blue-600',
        )}
      >
        {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
      </div>

      <div className={cn('max-w-[85%] sm:max-w-[75%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'rounded-tr-sm bg-gradient-to-br from-purple-600/90 to-indigo-600/90 text-white shadow-glow'
              : 'rounded-tl-sm border border-border bg-[rgba(var(--surface),0.5)] backdrop-blur',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">{message.content}</p>
          ) : (
            <div className={cn(isStreaming && 'stream-caret')}>
              <Markdown content={message.content || '…'} />
            </div>
          )}
          {message.error && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{message.error}</span>
            </div>
          )}
        </div>

        <div
          className={cn(
            'mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100',
            isUser ? 'justify-end' : 'justify-start',
            (isStreaming || message.error) && 'opacity-100',
          )}
        >
          {!isUser && !isStreaming && (
            <>
              <button
                onClick={copy}
                title="Copy message"
                className="rounded-lg p-1.5 text-foreground/40 transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              {onRegenerate && isLast && (
                <button
                  onClick={onRegenerate}
                  title="Regenerate response"
                  className="rounded-lg p-1.5 text-foreground/40 transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
          {isStreaming && (
            <span className="flex items-center gap-1.5 px-1 text-[11px] text-foreground/40">
              <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />
              generating…
            </span>
          )}
          {message.inputTokens !== undefined && message.outputTokens !== undefined && !isStreaming && (
            <span className="px-1 text-[11px] text-foreground/35">
              ↑{message.inputTokens.toLocaleString()} ↓{message.outputTokens.toLocaleString()} tokens
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
