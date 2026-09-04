'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Coins } from 'lucide-react';
import { Badge, Button, Card, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatNumber, formatDateTime } from '@/lib/format';

interface UsageRecord {
  id: string;
  username: string;
  providerName: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  createdAt: string;
}

interface UsageData {
  total: number;
  summary: { requests: number; inputTokens: number; outputTokens: number; totalTokens: number };
  records: UsageRecord[];
}

const PAGE_SIZE = 25;

export default function UsageManager() {
  const [data, setData] = useState<UsageData | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const res = await api<UsageData>(`/api/admin/usage?limit=${PAGE_SIZE}&offset=${offset}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page * PAGE_SIZE);
  }, [page, load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Usage log</h1>
        <p className="mt-1 text-sm text-foreground/50">Every AI request made on the platform.</p>
      </div>

      {/* Summary */}
      {data && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Total requests', value: formatNumber(data.summary.requests) },
            { label: 'Input tokens', value: formatNumber(data.summary.inputTokens) },
            { label: 'Output tokens', value: formatNumber(data.summary.outputTokens) },
            { label: 'Total tokens', value: formatNumber(data.summary.totalTokens) },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-purple-300" />
                <span className="text-xs text-foreground/50">{s.label}</span>
              </div>
              <p className="mt-2 text-xl font-bold text-gradient">{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-foreground/40">
                <th className="px-5 py-3">User</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3 text-right">Input</th>
                <th className="px-4 py-3 text-right">Output</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Spinner size={28} />
                  </td>
                </tr>
              ) : !data || data.records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-foreground/40">
                    No usage recorded yet
                  </td>
                </tr>
              ) : (
                data.records.map((r) => (
                  <tr key={r.id} className="border-b border-border transition-colors hover:bg-white/[0.03]">
                    <td className="px-5 py-3 font-medium">{r.username}</td>
                    <td className="px-4 py-3">{r.modelName}</td>
                    <td className="px-4 py-3">
                      <Badge color="purple" className="!py-0.5 text-[11px]">{r.providerName}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground/60">{formatNumber(r.inputTokens)}</td>
                    <td className="px-4 py-3 text-right text-foreground/60">{formatNumber(r.outputTokens)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatNumber(r.totalTokens)}</td>
                    <td className="px-4 py-3 text-xs text-foreground/50">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
            <span className="text-foreground/50">
              Page {page + 1} of {totalPages} · {data.total} records
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
