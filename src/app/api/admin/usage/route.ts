import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, requireOwner } from '@/lib/auth';
import { num } from '@/lib/serialize';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get('limit') ?? 50), 200);
  const offset = Math.max(0, Number(sp.get('offset') ?? 0));
  const userId = sp.get('userId');

  const where = userId ? { userId } : {};

  const [records, total, aggregates] = await Promise.all([
    prisma.usageRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: { select: { id: true, username: true, email: true } },
        model: { select: { id: true, identifier: true, displayName: true } },
        provider: { select: { id: true, name: true } },
      },
    }),
    prisma.usageRecord.count({ where }),
    prisma.usageRecord.aggregate({
      where,
      _sum: { inputTokens: true, outputTokens: true, totalTokens: true },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    total,
    summary: {
      requests: aggregates._count._all,
      inputTokens: num(aggregates._sum.inputTokens),
      outputTokens: num(aggregates._sum.outputTokens),
      totalTokens: num(aggregates._sum.totalTokens),
    },
    records: records.map((r) => ({
      id: r.id,
      username: r.user?.username ?? 'Unknown',
      userId: r.userId,
      providerId: r.providerId,
      providerName: r.provider?.name ?? 'Unknown',
      modelId: r.modelId,
      modelName: r.model?.displayName ?? r.model?.identifier ?? 'Unknown',
      inputTokens: num(r.inputTokens),
      outputTokens: num(r.outputTokens),
      totalTokens: num(r.totalTokens),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
