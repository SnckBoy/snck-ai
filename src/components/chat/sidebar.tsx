'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Pencil,
  Plus,
  Search,
  Settings,
  Shield,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/components/theme-provider';
import { api, ApiClientError } from '@/lib/api';
import { cn, Logo } from '@/components/ui';
import { formatRelative, truncate } from '@/lib/format';
import type { ConversationSummary } from '@/types';
import type { SessionUser } from '@/types/auth';
import { Modal } from '@/components/ui';

export default function Sidebar({
  user,
  onNavigate,
}: {
  user: SessionUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { conversations, setConversations, removeConversation, addOrUpdateConversation } = useChatStore();
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme } = useTheme();

  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversations = async (query = '') => {
    setSearching(true);
    try {
      const res = await api<{ conversations: ConversationSummary[] }>(
        `/api/conversations?q=${encodeURIComponent(query)}`,
      );
      setConversations(res.conversations);
    } catch {
      /* ignore */
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    loadConversations('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => loadConversations(q), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const newChat = () => {
    router.push('/chat');
    onNavigate?.();
  };

  const startRename = (c: ConversationSummary) => {
    setRenaming(c.id);
    setRenameValue(c.title);
  };

  const saveRename = async (id: string) => {
    const title = renameValue.trim();
    if (title) {
      try {
        await api(`/api/conversations/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title }),
        });
        const current = useChatStore.getState().conversations.find((c) => c.id === id);
        if (current) addOrUpdateConversation({ ...current, title });
        if (pathname === `/chat/${id}`) router.refresh();
      } catch {
        /* ignore */
      }
    }
    setRenaming(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/api/conversations/${deleteTarget.id}`, { method: 'DELETE' });
      removeConversation(deleteTarget.id);
      if (pathname === `/chat/${deleteTarget.id}`) router.push('/chat');
    } catch (err) {
      console.error(err);
    }
    setDeleteTarget(null);
  };

  const doLogout = async () => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex h-full w-full flex-col bg-[rgba(var(--surface),0.35)] backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/chat" onClick={onNavigate}>
          <Logo size={34} />
        </Link>
        <button
          onClick={newChat}
          title="New chat"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 text-white shadow-glow transition-transform hover:scale-105"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations"
            className="h-9 w-full rounded-xl border border-border bg-[rgba(var(--surface),0.6)] pl-9 pr-3 text-sm outline-none transition-all focus:border-purple-400/50"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3">
        {searching && q && (
          <div className="shimmer-bg my-2 h-10 rounded-xl" />
        )}
        {!searching && conversations.length === 0 && (
          <div className="mt-8 text-center">
            <MessageSquare className="mx-auto mb-2 h-8 w-8 text-foreground/25" />
            <p className="text-sm text-foreground/40">
              {q ? 'No conversations found' : 'No conversations yet'}
            </p>
            {!q && (
              <button onClick={newChat} className="mt-2 text-xs text-purple-300 hover:text-purple-200">
                Start your first chat →
              </button>
            )}
          </div>
        )}
        <div className="space-y-0.5">
          {conversations.map((c) => {
            const active = pathname === `/chat/${c.id}`;
            return (
              <div
                key={c.id}
                className={cn(
                  'group relative flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors',
                  active
                    ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/10 text-foreground'
                    : 'hover:bg-white/5',
                )}
              >
                {renaming === c.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => saveRename(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename(c.id);
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    className="w-full rounded-lg border border-purple-400/50 bg-[rgba(var(--surface),0.8)] px-2 py-1 text-sm outline-none"
                  />
                ) : (
                  <button
                    onClick={() => {
                      router.push(`/chat/${c.id}`);
                      onNavigate?.();
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium">{truncate(c.title, 40)}</p>
                    <p className="truncate text-[11px] text-foreground/40">
                      {c.preview || c.messageCount + ' messages'} · {formatRelative(c.updatedAt)}
                    </p>
                  </button>
                )}

                <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                  <button
                    onClick={() => startRename(c)}
                    title="Rename"
                    className="rounded-lg p-1.5 text-foreground/40 hover:bg-white/10 hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
                    title="Delete"
                    className="rounded-lg p-1.5 text-foreground/40 hover:bg-red-500/20 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* User menu */}
      <div className="border-t border-border p-3">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-sm font-bold text-white">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium">{user.username}</p>
              <p className="truncate text-[11px] text-foreground/40">
                {user.role === 'OWNER' ? 'Owner' : 'Standard User'}
              </p>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-foreground/40 transition-transform', menuOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 z-50 mb-2 w-full overflow-hidden rounded-2xl border border-border glass-strong p-1.5 shadow-card"
              >
                <button
                  onClick={toggleTheme}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-white/5"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
                {user.role === 'OWNER' && (
                  <Link
                    href="/admin"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-purple-300 transition-colors hover:bg-white/5"
                  >
                    <Shield className="h-4 w-4" /> Admin Dashboard
                  </Link>
                )}
                <Link
                  href="/settings"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-white/5"
                >
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <button
                  onClick={doLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Delete confirmation */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete conversation?"
        footer={
          <>
            <button
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl px-4 py-2 text-sm text-foreground/70 transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="rounded-xl bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-foreground/60">
          “{deleteTarget?.title}” and all its messages will be permanently deleted. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
