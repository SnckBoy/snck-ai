'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, ShieldCheck } from 'lucide-react';
import { Button, Card, Input, Toggle, Spinner } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';

interface Settings {
  defaultDailyTokenLimit: number | null;
  defaultMonthlyTokenLimit: number | null;
  defaultTotalTokenLimit: number | null;
  defaultUnlimited: boolean;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({ daily: '', monthly: '', total: '', unlimited: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ settings: Settings }>('/api/admin/settings')
      .then((res) => {
        setSettings(res.settings);
        setForm({
          daily: res.settings.defaultDailyTokenLimit === null ? '' : String(res.settings.defaultDailyTokenLimit),
          monthly: res.settings.defaultMonthlyTokenLimit === null ? '' : String(res.settings.defaultMonthlyTokenLimit),
          total: res.settings.defaultTotalTokenLimit === null ? '' : String(res.settings.defaultTotalTokenLimit),
          unlimited: res.settings.defaultUnlimited,
        });
      })
      .catch(() => setError('Failed to load settings'));
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    const parse = (v: string) => (v.trim() === '' ? null : Number(v));
    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          defaultDailyTokenLimit: form.unlimited ? null : parse(form.daily),
          defaultMonthlyTokenLimit: form.unlimited ? null : parse(form.monthly),
          defaultTotalTokenLimit: form.unlimited ? null : parse(form.total),
          defaultUnlimited: form.unlimited,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e as ApiClientError).message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="mt-1 text-sm text-foreground/50">
          Default token limits applied to newly registered Standard Users.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/70 to-cyan-500/60">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold">Default token limits</h2>
                <p className="text-xs text-foreground/40">
                  Applies to new Standard User accounts. Per-user overrides are set in the Users page.
                </p>
              </div>
            </div>
            <Toggle
              checked={form.unlimited}
              onChange={(v) => setForm((f) => ({ ...f, unlimited: v }))}
            />
          </div>

          {!form.unlimited && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              {([
                ['daily', 'Daily token limit', 'Tokens a user can spend per day'],
                ['monthly', 'Monthly token limit', 'Tokens a user can spend per month'],
                ['total', 'Total token limit', 'Lifetime tokens a user can spend'],
              ] as const).map(([key, label, hint]) => (
                <div key={key}>
                  <label className="mb-1.5 block text-sm font-medium">
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
            </motion.div>
          )}

          {form.unlimited && (
            <p className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
              New standard users will have <span className="font-semibold">unlimited</span> tokens by default.
            </p>
          )}

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          {saved && <p className="mt-3 text-sm text-emerald-400">Settings saved.</p>}

          <div className="mt-6 flex justify-end">
            <Button onClick={save} loading={saving}>
              <Save className="h-4 w-4" /> Save settings
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 font-semibold">How token limits work</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/60">
            <li>Token usage is counted when an AI response completes, using the provider-reported usage.</li>
            <li>When a user hits a limit, further requests are rejected until usage is reset or the window rolls over.</li>
            <li>Daily windows reset 24h after they start; monthly windows reset after 30 days.</li>
            <li>Owners can reset any user&apos;s usage manually, or set per-user limits that override these defaults.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
