import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, requireOwner } from '@/lib/auth';
import { num } from '@/lib/serialize';

export const runtime = 'nodejs';

const DAY_MS = 86_400_000;

export async function GET(req: NextRequest) {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  const days = Math.min(Number(req.nextUrl.searchParams.get('days') ?? 30), 90);
  const since = new Date(Date.now() - days * DAY_MS);

  const [totalUsers, totalConversations, totalRequests, totalTokensAgg, activeUsers, models, providers] =
    await Promise.all([
      prisma.user.count(),
      prisma.conversation.count(),
      prisma.usageRecord.count(),
      prisma.usageRecord.aggregate({ _sum: { totalTokens: true } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.model.findMany({ select: { id: true, identifier: true, displayName: true } }),
      prisma.aIProvider.findMany({ select: { id: true, name: true, type: true, enabled: true } }),
    ]);

  const modelMap = new Map(models.map((m) => [m.id, m]));
  const providerMap = new Map(providers.map((p) => [p.id, p]));

  // Usage by model
  const usageByModel = await prisma.usageRecord.groupBy({
    by: ['modelId'],
    where: { createdAt: { gte: since } },
    _sum: { totalTokens: true },
    _count: { _all: true },
    orderBy: { _sum: { totalTokens: 'desc' } },
    take: 10,
  });

  // Usage by provider
  const usageByProvider = await prisma.usageRecord.groupBy({
    by: ['providerId'],
    where: { createdAt: { gte: since } },
    _sum: { totalTokens: true },
    _count: { _all: true },
  });

  // Top users
  const topUsers = await prisma.usageRecord.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: since } },
    _sum: { totalTokens: true },
    _count: { _all: true },
    orderBy: { _sum: { totalTokens: 'desc' } },
    take: 10,
  });
  const topUserDetails = await prisma.user.findMany({
    where: { id: { in: topUsers.map((t) => t.userId) } },
    select: { id: true, username: true, email: true },
  });
  const userMap = new Map(topUserDetails.map((u) => [u.id, u]));

  // Daily series
  const dailyRecords = await prisma.usageRecord.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, totalTokens: true },
  });
  const dailyMap = new Map<string, { tokens: number; requests: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * DAY_MS);
    dailyMap.set(d.toISOString().slice(0, 10), { tokens: 0, requests: 0 });
  }
  for (const r of dailyRecords) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const entry = dailyMap.get(key);
    if (entry) {
      entry.tokens += num(r.totalTokens);
      entry.requests += 1;
    }
  }
  const dailySeries = [...dailyMap.entries()].map(([date, v]) => ({ date, ...v }));

  // Recent activity
  const recent = await prisma.usageRecord.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json({
    summary: {
      totalUsers,
      activeUsers,
      disabledUsers: totalUsers - activeUsers,
      totalConversations,
      totalRequests,
      totalTokens: num(totalTokensAgg._sum.totalTokens),
    },
    usageByModel: usageByModel.map((u) => ({
      modelId: u.modelId,
      name: u.modelId ? modelMap.get(u.modelId)?.displayName ?? modelMap.get(u.modelId)?.identifier ?? 'Unknown' : 'Unknown',
      tokens: num(u._sum.totalTokens),
      requests: u._count._all,
    })),
    usageByProvider: usageByProvider.map((u) => ({
      providerId: u.providerId,
      name: u.providerId ? providerMap.get(u.providerId)?.name ?? 'Unknown' : 'Unknown',
      tokens: num(u._sum.totalTokens),
      requests: u._count._all,
    })),
    topUsers: topUsers.map((t) => ({
      userId: t.userId,
      username: userMap.get(t.userId)?.username ?? 'Unknown',
      email: userMap.get(t.userId)?.email ?? '',
      tokens: num(t._sum.totalTokens),
      requests: t._count._all,
    })),
    dailySeries,
    recentActivity: recent.map((r) => ({
      id: r.id,
      username: r.user?.username ?? 'Unknown',
      modelId: r.modelId,
      modelName: r.modelId ? modelMap.get(r.modelId)?.displayName ?? 'Unknown' : 'Unknown',
      tokens: num(r.totalTokens),
      createdAt: r.createdAt.toISOString(),
    })),
    providers: providers.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      enabled: p.enabled,
    })),
  });
}
