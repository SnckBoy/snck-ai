'use client';

import { Bot } from 'lucide-react';
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
import { Card } from '@/components/ui';
import { formatNumber, formatDate } from '@/lib/format';
import { CHART_COLORS, type StatsData } from './overview-types';

const TOOLTIP_STYLE = {
  background: 'rgba(20,16,40,0.9)',
  border: '1px solid rgba(139,92,246,0.3)',
  borderRadius: 12,
  color: '#e5e5f5',
} as const;

export default function OverviewCharts({ data }: { data: StatsData }) {
  return (
    <>
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
                  contentStyle={TOOLTIP_STYLE}
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
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [formatNumber(Number(v)), 'Tokens']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Usage by model</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.usageByModel.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 20, bottom: 0, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.15)" />
                <XAxis type="number" tick={{ fill: 'rgba(150,150,180,0.6)', fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'rgba(200,200,225,0.8)', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [formatNumber(Number(v)), 'Tokens']} />
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
    </>
  );
}
