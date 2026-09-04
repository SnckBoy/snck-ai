'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Coins,
  MessageSquare,
  Users,
  UserCheck,
  Bot,
  Activity as ActivityIcon,
  KeyRound,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, Badge, Spinner } from '@/components/ui';
import { formatNumber, formatDateTime, formatDate } from '@/lib/format';
import { api } from '@/lib/api';

interface StatsData {
  summary: {
    totalUsers: number;
    activeUsers: number;
    disabledUsers: number;
    totalConversations: number;
    totalRequests: number;
    totalTokens: number;
  };
  usageByModel: Array<{ name: string; tokens: number; requests: number }>;
  usageByProvider: Array<{ name: string; tokens: number; requests: number }>;
  topUsers: Array<{ username: string; email: string; tokens: number; requests: number }>;
  dailySeries: Array<{ date: string; tokens: number; requests: number }>;
  recentActivity: Array<{ id: string; username: string; modelName: string; tokens: number; createdAt: string }>;
  providers: Array<{ id: string; name: string; type: string; enabled: boolean }>;
}

const CHART_COLORS = ['#8b5cf6', '#6366f1', '#22d3ee', '#a855f7', '#06b6d4', '#818cf8'];

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

      {/* Charts row 1 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Token usage — last 30 days</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.dailySeries} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="tokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.15)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(150,150,180,0.6)', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: 'rgba(150,150,180,0.6)', fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(20,16,40,0.9)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: 12,
                    color: '#e5e5f5',
                  }}
                  formatter={(v: any, name: any) => [formatNumber(Number(v)), name === 'tokens' ? 'Tokens' : name]}
                  labelFormatter={(v) => formatDate(String(v))}
                />
                <Area type="monotone" dataKey="tokens" stroke="#8b5cf6" strokeWidth={2} fill="url(#tokens)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Usage by provider</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.usageByProvider}
                  dataKey="tokens"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {data.usageByProvider.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(20,16,40,0.9)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, color: '#e5e5f5' }}
                  formatter={(v: any) => [formatNumber(Number(v)), 'Tokens']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Usage by model</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.usageByModel.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 20, bottom: 0, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.15)" />
                <XAxis type="number" tick={{ fill: 'rgba(150,150,180,0.6)', fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'rgba(200,200,225,0.8)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'rgba(20,16,40,0.9)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, color: '#e5e5f5' }}
                  formatter={(v: any) => [formatNumber(Number(v)), 'Tokens']}
                />
                <Bar dataKey="tokens" radius={[0, 8, 8, 0]}>
                  {data.usageByModel.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Top users</h2>
          {data.topUsers.length === 0 ? (
            <p className="py-10 text-center text-sm text-foreground/40">No usage yet</p>
          ) : (
            <div className="space-y-3">
              {data.topUsers.map((u, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/60 to-cyan-500/50 text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.username}</p>
                    <p className="truncate text-xs text-foreground/40">{formatNumber(u.tokens)} tokens · {u.requests} reqs</p>
                  </div>
                  <Bot className="h-4 w-4 text-foreground/30" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

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
