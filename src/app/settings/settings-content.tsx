'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Coins, Moon, Sun, Zap, Calendar } from 'lucide-react';
import { Badge, Card, Button } from '@/components/ui';
import { useTheme } from '@/components/theme-provider';
import { formatNumber, formatDate } from '@/lib/format';

interface SettingsUser {
  username: string;
  email: string;
  role: 'OWNER' | 'USER';
  unlimited: boolean;
  dailyTokenLimit: number | null;
  monthlyTokenLimit: number | null;
  totalTokenLimit: number | null;
  dailyTokensUsed: number;
  monthlyTokensUsed: number;
  totalTokensUsed: number;
  joinedAt: string;
}

function LimitBar({ used, limit, label }: { used: number; limit: number | null; label: string }) {
  const pct = limit && limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const over = limit !== null && used >= limit;
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-foreground/60">{label}</span>
        <span className={over ? 'font-medium text-red-400' : 'text-foreground/80'}>
          {formatNumber(used)} / {limit === null ? 'Unlimited' : formatNumber(limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${
            over
              ? 'bg-gradient-to-r from-red-500 to-rose-500'
              : pct > 80
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-purple-500 to-cyan-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SettingsContent({ user }: { user: SettingsUser }) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-mesh">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-foreground/50 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 text-2xl font-bold text-white shadow-glow">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold">
                {user.username}
                {user.role === 'OWNER' && <Badge color="purple">Owner</Badge>}
              </h1>
              <p className="text-sm text-foreground/50">
                {user.email} · Joined {formatDate(user.joinedAt)}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Usage */}
            <Card className="p-6">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
                <Zap className="h-5 w-5 text-purple-300" /> Token usage & limits
              </h2>
              {user.unlimited ? (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
                  Your account is set to <span className="font-semibold">Unlimited</span> token usage.
                </div>
              ) : (
                <>
                  <LimitBar used={user.dailyTokensUsed} limit={user.dailyTokenLimit} label="Daily usage" />
                  <LimitBar used={user.monthlyTokensUsed} limit={user.monthlyTokenLimit} label="Monthly usage" />
                  <LimitBar used={user.totalTokensUsed} limit={user.totalTokenLimit} label="Total usage" />
                </>
              )}
            </Card>

            {/* Account info */}
            <Card className="p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Coins className="h-5 w-5 text-purple-300" /> Lifetime usage
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { label: 'Total tokens used', value: formatNumber(user.totalTokensUsed) },
                  { label: 'Monthly tokens', value: formatNumber(user.monthlyTokensUsed) },
                  { label: 'Today', value: formatNumber(user.dailyTokensUsed) },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-white/5 p-4">
                    <p className="text-2xl font-bold text-gradient">{s.value}</p>
                    <p className="mt-1 text-xs text-foreground/50">{s.label}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Preferences */}
            <Card className="p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Moon className="h-5 w-5 text-purple-300" /> Preferences
              </h2>
              <button
                onClick={toggleTheme}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-white/5 px-4 py-3 text-sm transition-colors hover:bg-white/10"
              >
                <span className="flex items-center gap-2">
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  Appearance
                </span>
                <span className="text-foreground/50">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
              </button>
            </Card>

            <div className="flex items-center justify-between">
              <p className="text-xs text-foreground/40">
                <Calendar className="mr-1 inline h-3 w-3" /> Need more tokens? Contact your platform Owner.
              </p>
              <Link href="/chat">
                <Button variant="ghost" size="sm">
                  Back to chat
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
