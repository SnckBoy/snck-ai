'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Boxes,
  CheckCircle2,
  KeyRound,
  Loader2,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card, Input, Modal, Spinner, StatusDot, Toggle } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { cn } from '@/components/ui';

type ProviderType = 'OPENAI_COMPATIBLE' | 'ANTHROPIC' | 'GEMINI' | 'OPENROUTER' | 'CUSTOM';
type Status = 'UNTESTED' | 'CONNECTED' | 'INVALID_KEY' | 'PROVIDER_ERROR' | 'NETWORK_ERROR' | 'DISABLED';

interface ProviderModel {
  id: string;
  identifier: string;
  displayName: string;
  enabled: boolean;
  standardAccess: boolean;
}

interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string | null;
  enabled: boolean;
  status: Status;
  statusMessage: string | null;
  hasKey: boolean;
  maskedKey: string | null;
  createdAt: string;
  models: ProviderModel[];
}

const PROVIDER_TYPES: Array<{ value: ProviderType; label: string; defaultBaseUrl: string; description: string }> = [
  { value: 'OPENAI_COMPATIBLE', label: 'OpenAI Compatible', defaultBaseUrl: 'https://api.openai.com/v1', description: 'OpenAI or any /chat/completions endpoint' },
  { value: 'ANTHROPIC', label: 'Anthropic', defaultBaseUrl: 'https://api.anthropic.com', description: 'Claude Messages API' },
  { value: 'GEMINI', label: 'Google Gemini', defaultBaseUrl: 'https://generativelanguage.googleapis.com', description: 'Google Generative Language API' },
  { value: 'OPENROUTER', label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1', description: 'Unified API with hundreds of models' },
  { value: 'CUSTOM', label: 'Custom Endpoint', defaultBaseUrl: 'https://your-endpoint.com/v1', description: 'Any custom OpenAI-compatible API' },
];

const statusColor: Record<Status, 'green' | 'red' | 'amber' | 'orange' | 'slate' | 'purple'> = {
  CONNECTED: 'green',
  INVALID_KEY: 'red',
  PROVIDER_ERROR: 'amber',
  NETWORK_ERROR: 'orange',
  DISABLED: 'slate',
  UNTESTED: 'purple',
};

const statusLabel: Record<Status, string> = {
  CONNECTED: 'Connected',
  INVALID_KEY: 'Invalid API Key',
  PROVIDER_ERROR: 'Provider Error',
  NETWORK_ERROR: 'Network Error',
  DISABLED: 'Disabled',
  UNTESTED: 'Untested',
};

export default function ProvidersManager() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: 'OPENAI_COMPATIBLE' as ProviderType,
    baseUrl: PROVIDER_TYPES[0].defaultBaseUrl,
    apiKey: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ providers: Provider[] }>('/api/admin/providers');
      setProviders(res.providers);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm({
      name: '',
      type: 'OPENAI_COMPATIBLE',
      baseUrl: PROVIDER_TYPES[0].defaultBaseUrl,
      apiKey: '',
    });
  };

  const openAdd = () => {
    resetForm();
    setShowAdd(true);
  };

  const openEdit = (p: Provider) => {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.type,
      baseUrl: p.baseUrl ?? PROVIDER_TYPES.find((t) => t.value === p.type)?.defaultBaseUrl ?? '',
      apiKey: '',
    });
  };

  const changeType = (type: ProviderType) => {
    setForm((f) => ({
      ...f,
      type,
      baseUrl: PROVIDER_TYPES.find((t) => t.value === type)?.defaultBaseUrl ?? '',
    }));
  };

  const saveProvider = async () => {
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await api(`/api/admin/providers/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            type: form.type,
            baseUrl: form.baseUrl,
            ...(form.apiKey ? { apiKey: form.apiKey } : {}),
          }),
        });
        setEditing(null);
      } else {
        await api('/api/admin/providers', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setShowAdd(false);
      }
      resetForm();
      await load();
    } catch (e) {
      setError((e as ApiClientError).message);
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async (p: Provider) => {
    setTesting(p.id);
    try {
      const res = await api<{ ok: boolean; status: string; message: string }>(
        `/api/admin/providers/${p.id}?action=test`,
        { method: 'POST' },
      );
      await load();
      alert(`${res.ok ? '✓' : '✗'} ${res.status}: ${res.message}`);
    } catch (e) {
      alert((e as ApiClientError).message);
      await load();
    } finally {
      setTesting(null);
    }
  };

  const fetchModels = async (p: Provider) => {
    if (!confirm(`Fetch model list from ${p.name}? This will add any new models returned by the provider.`)) return;
    try {
      const res = await api<{ ok: boolean; fetched: number; created: number }>(
        `/api/admin/providers/${p.id}?action=fetch-models`,
        { method: 'POST' },
      );
      alert(`Fetched ${res.fetched} models, ${res.created} new`);
      await load();
    } catch (e) {
      alert((e as ApiClientError).message);
      await load();
    }
  };

  const toggleProvider = async (p: Provider) => {
    try {
      await api(`/api/admin/providers/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !p.enabled }),
      });
      await load();
    } catch (e) {
      alert((e as ApiClientError).message);
    }
  };

  const deleteProvider = async (p: Provider) => {
    if (!confirm(`Delete provider "${p.name}"? All its models will be removed too.`)) return;
    try {
      await api(`/api/admin/providers/${p.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert((e as ApiClientError).message);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Providers</h1>
          <p className="mt-1 text-sm text-foreground/50">
            Manage API connections. Keys are encrypted at rest and never exposed to users.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add provider
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size={32} />
        </div>
      ) : providers.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-14 text-center">
          <Boxes className="mb-4 h-12 w-12 text-foreground/25" />
          <h3 className="text-lg font-semibold">No providers yet</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">
            Add your first AI provider to enable models for your users.
          </p>
          <Button className="mt-5" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add your first provider
          </Button>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {providers.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/70 to-cyan-500/60">
                      <Plug className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold">
                        {p.name}
                        <Badge color={statusColor[p.status]}>
                          <StatusDot status={p.status} /> {statusLabel[p.status]}
                        </Badge>
                      </h3>
                      <p className="text-xs text-foreground/40">
                        {PROVIDER_TYPES.find((t) => t.value === p.type)?.label} · {p.baseUrl}
                      </p>
                    </div>
                  </div>
                  <Toggle checked={p.enabled} onChange={() => toggleProvider(p)} />
                </div>

                {p.statusMessage && (
                  <p className="mt-3 rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-xs text-foreground/50">
                    {p.statusMessage}
                  </p>
                )}

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-foreground/60">
                    <KeyRound className="h-4 w-4 text-foreground/40" />
                    <span className="font-mono">{p.maskedKey ?? 'No key stored'}</span>
                    {p.hasKey && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <div className="text-foreground/60">
                    <span className="text-foreground/40">{p.models.length} models</span>
                    {' · '}
                    <span className={cn(p.enabled ? 'text-emerald-300' : 'text-foreground/40')}>
                      {p.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => testConnection(p)} loading={testing === p.id}>
                    <RefreshCw className={cn('h-3.5 w-3.5', testing === p.id && 'animate-spin')} />
                    Test connection
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => fetchModels(p)}>
                    <Boxes className="h-3.5 w-3.5" /> Fetch models
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => deleteProvider(p)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={showAdd || Boolean(editing)}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        title={editing ? `Edit provider — ${editing.name}` : 'Add AI provider'}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setShowAdd(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveProvider} loading={busy}>
              {editing ? 'Save changes' : 'Add provider'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Provider name</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. OpenAI, Anthropic" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Provider type</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROVIDER_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => changeType(t.value)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left text-sm transition-all',
                    form.type === t.value
                      ? 'border-purple-400/60 bg-purple-500/10 shadow-glow'
                      : 'border-border hover:border-purple-400/30',
                  )}
                >
                  <p className="font-medium">{t.label}</p>
                  <p className="mt-0.5 text-[11px] text-foreground/40">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">API endpoint</label>
            <Input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.openai.com/v1" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              API key {editing && <span className="text-xs font-normal text-foreground/40">(leave empty to keep current)</span>}
            </label>
            <Input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder={editing ? 'sk-••••••••••' : 'sk-…'}
              autoComplete="new-password"
            />
          </div>

          <p className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-300/80">
            Keys are encrypted with AES-256-GCM using your ENCRYPTION_KEY. They are only decrypted server-side
            when a request is sent to the provider.
          </p>
        </div>
      </Modal>
    </div>
  );
}
