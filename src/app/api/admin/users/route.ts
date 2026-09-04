import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, requireOwner } from '@/lib/auth';
import { num } from '@/lib/serialize';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get('q')?.trim() ?? '';
  const status = searchParams.get('status');
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0));

  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(status && (status === 'ACTIVE' || status === 'DISABLED') ? { status: status as 'ACTIVE' | 'DISABLED' } : {}),
  };

  const [users, total, aggregates] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        dailyTokenLimit: true,
        monthlyTokenLimit: true,
        totalTokenLimit: true,
        unlimited: true,
        dailyTokensUsed: true,
        monthlyTokensUsed: true,
        totalTokensUsed: true,
        _count: { select: { conversations: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.usageRecord.groupBy({
      by: ['userId'],
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
  ]);

  const aggMap = new Map(
    aggregates.map((a) => [
      a.userId,
      { totalTokens: num(a._sum.totalTokens), requests: a._count._all },
    ]),
  );

  return NextResponse.json({
    total,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      dailyTokenLimit: u.dailyTokenLimit !== null ? num(u.dailyTokenLimit) : null,
      monthlyTokenLimit: u.monthlyTokenLimit !== null ? num(u.monthlyTokenLimit) : null,
      totalTokenLimit: u.totalTokenLimit !== null ? num(u.totalTokenLimit) : null,
      unlimited: u.unlimited,
      dailyTokensUsed: num(u.dailyTokensUsed),
      monthlyTokensUsed: num(u.monthlyTokensUsed),
      totalTokensUsed: num(u.totalTokensUsed),
      conversations: u._count.conversations,
      totalTokens: aggMap.get(u.id)?.totalTokens ?? 0,
      requests: aggMap.get(u.id)?.requests ?? 0,
    })),
  });
}
