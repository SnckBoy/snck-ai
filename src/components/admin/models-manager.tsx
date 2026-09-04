'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, Spinner, Toggle } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { cn } from '@/components/ui';

interface ProviderModel {
  id: string;
  identifier: string;
  displayName: string;
  enabled: boolean;
  standardAccess: boolean;
  sortOrder: number;
}

interface Provider {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  models: ProviderModel[];
}

export default function ModelsManager() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingTo, setAddingTo] = useState<Provider | null>(null);
  const [addForm, setAddForm] = useState({ identifier: '', displayName: '' });
  const [renaming, setRenaming] = useState<{ model: ProviderModel; providerId: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

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

  const toggleModel = async (providerId: string, model: ProviderModel, field: 'enabled' | 'standardAccess') => {
    try {
      await api(`/api/admin/models/${model.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: !model[field] }),
      });
      await load();
    } catch (e) {
      alert((e as ApiClientError).message);
    }
  };

  const saveRename = async () => {
    if (!renaming) return;
    try {
      await api(`/api/admin/models/${renaming.model.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ displayName: renameValue.trim() || renaming.model.identifier }),
      });
      setRenaming(null);
      await load();
    } catch (e) {
      alert((e as ApiClientError).message);
    }
  };

  const addModel = async () => {
    if (!addingTo) return;
    try {
      await api(`/api/admin/providers/${addingTo.id}?action=add-model`, {
        method: 'POST',
        body: JSON.stringify(addForm),
      });
      setAddingTo(null);
      setAddForm({ identifier: '', displayName: '' });
      await load();
    } catch (e) {
      alert((e as ApiClientError).message);
    }
  };

  const deleteModel = async (model: ProviderModel) => {
    if (!confirm(`Delete model "${model.identifier}"?`)) return;
    try {
      await api(`/api/admin/models/${model.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert((e as ApiClientError).message);
    }
  };

  const allModels = providers.flatMap((p) => p.models);
  const enabledCount = allModels.filter((m) => m.enabled).length;
  const standardCount = allModels.filter((m) => m.standardAccess).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Models</h1>
          <p className="mt-1 text-sm text-foreground/50">
            {allModels.length} models · {enabledCount} enabled · {standardCount} available to standard users
          </p>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size={32} />
        </div>
      ) : providers.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-14 text-center">
          <Bot className="mb-4 h-12 w-12 text-foreground/25" />
          <h3 className="text-lg font-semibold">No providers configured</h3>
          <p className="mt-1 text-sm text-foreground/50">Add an AI provider first, then enable its models here.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {providers.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-white/[0.02] px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/70 to-cyan-500/60">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-xs text-foreground/40">{p.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={p.enabled ? 'green' : 'slate'}>{p.enabled ? 'Provider enabled' : 'Provider disabled'}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setAddingTo(p)}>
                    <Plus className="h-3.5 w-3.5" /> Add model
                  </Button>
                </div>
              </div>

              {p.models.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-foreground/40">No models for this provider.</p>
              ) : (
                <div className="divide-y divide-border">
                  {p.models.map((m) => (
                    <div key={m.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        {renaming?.model.id === m.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={saveRename}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename();
                                if (e.key === 'Escape') setRenaming(null);
                              }}
                              className="h-8 w-48"
                            />
                            <Button size="sm" variant="ghost" onClick={saveRename}>Save</Button>
                          </div>
                        ) : (
                          <>
                            <p className="font-medium">{m.displayName}</p>
                            <p className="truncate font-mono text-xs text-foreground/40">{m.identifier}</p>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-4 sm:gap-5">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-foreground/40" />
                          <Toggle
                            checked={m.standardAccess}
                            onChange={() => toggleModel(p.id, m, 'standardAccess')}
                            label="Standard users"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color={m.enabled ? 'green' : 'slate'}>Enabled</Badge>
                          <Toggle checked={m.enabled} onChange={() => toggleModel(p.id, m, 'enabled')} />
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => {
                              setRenaming({ model: m, providerId: p.id });
                              setRenameValue(m.displayName);
                            }}
                            className="rounded-lg p-2 text-foreground/50 hover:bg-white/5 hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteModel(m)}
                            className="rounded-lg p-2 text-foreground/50 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add model modal */}
      <Modal
        open={Boolean(addingTo)}
        onClose={() => setAddingTo(null)}
        title={`Add model — ${addingTo?.name ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddingTo(null)}>Cancel</Button>
            <Button onClick={addModel}>Add model</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Model identifier</label>
            <Input
              value={addForm.identifier}
              onChange={(e) => setAddForm((f) => ({ ...f, identifier: e.target.value }))}
              placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Display name</label>
            <Input
              value={addForm.displayName}
              onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="e.g. GPT-4o"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
