'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Cpu, Search } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { api } from '@/lib/api';
import type { ModelOption } from '@/types';
import { cn } from '@/components/ui';

export default function ModelSelector({ compact = false }: { compact?: boolean }) {
  const { selectedModelId, setSelectedModelId, availableModels, setAvailableModels, modelsLoaded } =
    useChatStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(!modelsLoaded);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modelsLoaded) {
      api<{ models: ModelOption[] }>('/api/models')
        .then((res) => {
          setAvailableModels(res.models);
          const stored = localStorage.getItem('snck-model');
          const valid = res.models.find((m) => m.id === stored);
          setSelectedModelId(valid?.id ?? res.models[0]?.id ?? null);
        })
        .catch(() => setSelectedModelId(null))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = availableModels.filter(
      (m) => !q || m.displayName.toLowerCase().includes(q) || m.identifier.toLowerCase().includes(q),
    );
    const groups = new Map<string, ModelOption[]>();
    for (const m of filtered) {
      const key = m.providerName;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return [...groups.entries()];
  }, [availableModels, query]);

  const selected = availableModels.find((m) => m.id === selectedModelId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-border bg-[rgba(var(--surface),0.6)] px-3 py-1.5 text-sm transition-all hover:border-purple-400/40',
          compact ? 'h-8' : 'h-9',
        )}
      >
        <Cpu className="h-4 w-4 text-purple-300" />
        <span className="max-w-[180px] truncate font-medium">
          {loading ? 'Loading models…' : selected ? selected.displayName : 'Select model'}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-foreground/40 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border glass-strong shadow-card"
          >
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search models…"
                  className="h-9 w-full rounded-lg border border-border bg-[rgba(var(--surface),0.6)] pl-9 pr-3 text-sm outline-none focus:border-purple-400/50"
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin p-1.5">
              {loading && (
                <div className="shimmer-bg h-16 rounded-lg" />
              )}
              {!loading && grouped.length === 0 && (
                <p className="p-4 text-center text-sm text-foreground/40">No models available</p>
              )}
              {grouped.map(([provider, models]) => (
                <div key={provider} className="mb-1">
                  <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/40">
                    {provider}
                  </p>
                  {models.map((m) => {
                    const active = m.id === selectedModelId;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedModelId(m.id);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                          active ? 'bg-purple-500/15 text-purple-200' : 'text-foreground/80 hover:bg-white/5',
                        )}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{m.displayName}</span>
                          <span className="truncate text-xs text-foreground/40">{m.identifier}</span>
                        </span>
                        {active && <Check className="h-4 w-4 shrink-0 text-purple-300" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
