'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Coins,
  KeyRound,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserX,
  UserCheck,
} from 'lucide-react';
import { Badge, Button, Card, Input, Modal, Spinner, Toggle } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/components/ui';

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'OWNER' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  dailyTokenLimit: number | null;
  monthlyTokenLimit: number | null;
  totalTokenLimit: number | null;
  unlimited: boolean;
  dailyTokensUsed: number;
  monthlyTokensUsed: number;
  totalTokensUsed: number;
  conversations: number;
  totalTokens: number;
  requests: number;
}

export default function UsersManager() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  // Edit form state
  const [form, setForm] = useState({
    unlimited: false,
    dailyTokenLimit: '',
    monthlyTokenLimit: '',
    totalTokenLimit: '',
  });

  const load = useCallback(async (query = '') => {
    setLoading(true);
    setError('');
    try {
      const res = await api<{ users: AdminUser[]; total: number }>(
        `/api/admin/users?q=${encodeURIComponent(query)}&limit=100`,
      );
      setUsers(res.users);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const openEdit = (u: AdminUser) => {
    setEditing(u);
    setForm({
      unlimited: u.unlimited,
      dailyTokenLimit: u.dailyTokenLimit === null ? '' : String(u.dailyTokenLimit),
      monthlyTokenLimit: u.monthlyTokenLimit === null ? '' : String(u.monthlyTokenLimit),
      totalTokenLimit: u.totalTokenLimit === null ? '' : String(u.totalTokenLimit),
    });
  };

  const saveLimits = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const parse = (v: string) => (v.trim() === '' ? null : Number(v));
      await api(`/api/admin/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          unlimited: form.unlimited,
          dailyTokenLimit: form.unlimited ? null : parse(form.dailyTokenLimit),
          monthlyTokenLimit: form.unlimited ? null : parse(form.monthlyTokenLimit),
          totalTokenLimit: form.unlimited ? null : parse(form.totalTokenLimit),
        }),
      });
      setEditing(null);
      await load(q);
    } catch (e) {
      alert((e as ApiClientError).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (u: AdminUser) => {
    try {
      await api(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }),
      });
      await load(q);
    } catch (e) {
      alert((e as ApiClientError).message);
    }
  };

  const resetUsage = async (u: AdminUser) => {
    if (!confirm(`Reset usage for ${u.username}? This clears all usage records and counters.`)) return;
    try {
      await api(`/api/admin/users/${u.id}?action=reset-usage`, { method: 'POST' });
      await load(q);
    } catch (e) {
      alert((e as ApiClientError).message);
    }
  };

  const deleteUser = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/admin/users/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      await load(q);
    } catch (e) {
      alert((e as ApiClientError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-foreground/50">{total} registered accounts</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username or email…" className="pl-9" />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-foreground/40">
                <th className="px-5 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Limits</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Requests</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Spinner size={28} />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-foreground/40">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-border transition-colors hover:bg-white/[0.03]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/70 to-cyan-500/60 text-xs font-bold">
                          {u.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium">
                            {u.username}
                            {u.role === 'OWNER' && (
                              <ShieldCheck className="h-3.5 w-3.5 text-purple-300" />
                            )}
                          </p>
                          <p className="truncate text-xs text-foreground/40">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge color={u.status === 'ACTIVE' ? 'green' : 'red'}>
                        {u.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      {u.role === 'OWNER' ? (
                        <span className="text-purple-300">Owner</span>
                      ) : u.unlimited ? (
                        <span className="text-cyan-300">Unlimited</span>
                      ) : (
                        <div className="space-y-0.5">
                          <p>{u.dailyTokenLimit ? `Daily: ${formatNumber(u.dailyTokenLimit)}` : 'Daily: ∞'}</p>
                          <p>{u.monthlyTokenLimit ? `Monthly: ${formatNumber(u.monthlyTokenLimit)}` : 'Monthly: ∞'}</p>
                          <p>{u.totalTokenLimit ? `Total: ${formatNumber(u.totalTokenLimit)}` : 'Total: ∞'}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs">
                        <p className="font-medium text-foreground/80">{formatNumber(u.totalTokensUsed)} tokens</p>
                        <p className="text-foreground/40">
                          {u.monthlyTokenLimit && !u.unlimited
                            ? `${Math.min(100, Math.round((u.monthlyTokensUsed / u.monthlyTokenLimit) * 100))}% of monthly`
                            : 'no monthly cap'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5 text-foreground/40" />
                        <span>{formatNumber(u.requests)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-foreground/50">{formatRelative(u.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1">
                        {u.role !== 'OWNER' && (
                          <>
                            <button
                              onClick={() => openEdit(u)}
                              title="Edit limits"
                              className="rounded-lg p-2 text-foreground/50 transition-colors hover:bg-purple-500/15 hover:text-purple-300"
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => toggleStatus(u)}
                              title={u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                              className={cn(
                                'rounded-lg p-2 transition-colors',
                                u.status === 'ACTIVE'
                                  ? 'text-foreground/50 hover:bg-amber-500/15 hover:text-amber-300'
                                  : 'text-emerald-400 hover:bg-emerald-500/15',
                              )}
                            >
                              {u.status === 'ACTIVE' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => resetUsage(u)}
                              title="Reset usage"
                              className="rounded-lg p-2 text-foreground/50 transition-colors hover:bg-cyan-500/15 hover:text-cyan-300"
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleting(u)}
                              title="Delete user"
                              className="rounded-lg p-2 text-foreground/50 transition-colors hover:bg-red-500/15 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit limits modal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Token limits — ${editing?.username ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveLimits} loading={busy}>
              Save limits
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-white/5 px-4 py-3">
            <div>
              <p className="font-medium">Unlimited tokens</p>
              <p className="text-xs text-foreground/50">Bypass all token limits for this user</p>
            </div>
            <Toggle
              checked={form.unlimited}
              onChange={(v) => setForm((f) => ({ ...f, unlimited: v }))}
            />
          </div>

          {!form.unlimited && (
            <>
              {([
                ['dailyTokenLimit', 'Daily limit', 'Tokens per day'],
                ['monthlyTokenLimit', 'Monthly limit', 'Tokens per month'],
                ['totalTokenLimit', 'Total limit', 'Lifetime tokens'],
              ] as const).map(([key, label, hint]) => (
                <div key={key}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                    {label} <span className="text-xs font-normal text-foreground/40">({hint})</span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0 or empty = unlimited"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete user?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteUser} loading={busy}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground/60">
          <span className="font-medium text-foreground">{deleting?.username}</span> ({deleting?.email}) and all
          their conversations, messages and usage records will be permanently deleted. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
