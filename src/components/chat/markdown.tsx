'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy } from 'lucide-react';
import 'highlight.js/styles/github-dark.css';

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as any).props?.children ?? '');
  }
  return '';
}

function CodeBlockPre(props: any) {
  const [copied, setCopied] = useState(false);
  const inner: any = props.children;
  const className = typeof inner?.props?.className === 'string' ? inner.props.className : '';
  const language = /language-(\w+)/.exec(className)?.[1] || (className.startsWith('hljs') ? 'text' : '');
  const code = extractText(inner?.props?.children ?? props.children);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0b1a]">
      <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.03] px-4 py-1.5">
        <span className="text-[11px] uppercase tracking-wider text-white/40">
          {language || 'code'}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="!m-0 !rounded-none !border-0 bg-transparent">{props.children}</pre>
    </div>
  );
}

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-snck">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: CodeBlockPre,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
