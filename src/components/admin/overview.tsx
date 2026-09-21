'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  Activity,
  Coins,
  MessageSquare,
  Users,
  UserCheck,
  Activity as ActivityIcon,
  KeyRound,
} from 'lucide-react';
import { Card, Badge, Spinner } from '@/components/ui';
import { formatNumber, formatDateTime } from '@/lib/format';
import { api } from '@/lib/api';
import type { StatsData } from './overview-types';

const OverviewCharts = dynamic(() => import('./overview-charts'), {
  ssr: false,
  loading: () => (
    <div className="mt-6 flex h-[280px] items-center justify-center rounded-2xl border border-border">
      <Spinner size={28} />
    </div>
  ),
});

export default function AdminOverview() {
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<StatsData>('/api/admin/stats')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  const cards = [
    { label: 'Total users', value: formatNumber(data.summary.totalUsers), icon: Users, gradient: 'from-purple-600/70 to-indigo-600/60' },
    { label: 'Active users', value: formatNumber(data.summary.activeUsers), icon: UserCheck, gradient: 'from-emerald-500/70 to-cyan-500/60' },
    { label: 'Conversations', value: formatNumber(data.summary.totalConversations), icon: MessageSquare, gradient: 'from-indigo-500/70 to-purple-500/60' },
    { label: 'AI requests', value: formatNumber(data.summary.totalRequests), icon: Activity, gradient: 'from-amber-500/70 to-orange-500/60' },
    { label: 'Total tokens', value: formatNumber(data.summary.totalTokens), icon: Coins, gradient: 'from-cyan-500/70 to-blue-500/60' },
    { label: 'Providers', value: formatNumber(data.providers.length), icon: KeyRound, gradient: 'from-fuchsia-500/70 to-purple-500/60' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="mt-1 text-sm text-foreground/50">Live analytics for your entire Snck AI platform.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="relative overflow-hidden p-4">
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.gradient}`} />
              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${c.gradient}`}>
                <c.icon className="h-4.5 w-4.5 h-5 w-5 text-white" />
              </div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-xs text-foreground/50">{c.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <OverviewCharts data={data} />

      {/* Recent activity */}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Recent activity</h2>
        </div>
        {data.recentActivity.length === 0 ? (
          <p className="py-10 text-center text-sm text-foreground/40">No recent activity</p>
        ) : (
          <div className="divide-y divide-border">
            {data.recentActivity.slice(0, 12).map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <ActivityIcon className="h-4 w-4 text-purple-300" />
                  <span>
                    <span className="font-medium">{r.username}</span>
                    <span className="text-foreground/50"> · {r.modelName}</span>
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge color="cyan">{formatNumber(r.tokens)} tokens</Badge>
                  <span className="hidden text-xs text-foreground/40 sm:block">{formatDateTime(r.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
