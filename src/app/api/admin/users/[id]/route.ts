import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, requireOwner } from '@/lib/auth';
import { userUpdateSchema } from '@/lib/validation';
import { resetUserUsage } from '@/lib/usage';
import { num, nullableNum } from '@/lib/serialize';

export const runtime = 'nodejs';

async function loadTarget(id: string) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new ApiError(404, 'User not found');
  if (target.role === 'OWNER') {
    throw new ApiError(400, 'The Owner account cannot be modified');
  }
  return target;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { conversations: true } },
        usageRecords: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const aggregate = await prisma.usageRecord.aggregate({
      where: { userId: user.id },
      _sum: { totalTokens: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        dailyTokenLimit: user.dailyTokenLimit !== null ? Number(user.dailyTokenLimit) : null,
        monthlyTokenLimit: user.monthlyTokenLimit !== null ? Number(user.monthlyTokenLimit) : null,
        totalTokenLimit: user.totalTokenLimit !== null ? Number(user.totalTokenLimit) : null,
        unlimited: user.unlimited,
        dailyTokensUsed: Number(user.dailyTokensUsed),
        monthlyTokensUsed: Number(user.monthlyTokensUsed),
        totalTokensUsed: Number(user.totalTokensUsed),
        conversationCount: user._count.conversations,
        aggregate: {
          requests: aggregate._count._all,
          inputTokens: Number(aggregate._sum.inputTokens ?? 0n),
          outputTokens: Number(aggregate._sum.outputTokens ?? 0n),
          totalTokens: Number(aggregate._sum.totalTokens ?? 0n),
        },
        usageRecords: user.usageRecords.slice(0, 50).map((r) => ({
          id: r.id,
          modelId: r.modelId,
          inputTokens: Number(r.inputTokens),
          outputTokens: Number(r.outputTokens),
          totalTokens: Number(r.totalTokens),
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  try {
    await loadTarget(params.id);

    const data: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) data.status = parsed.data.status;

    const unlimited =
      parsed.data.unlimited !== undefined
        ? parsed.data.unlimited
        : parsed.data.dailyTokenLimit === null &&
            parsed.data.monthlyTokenLimit === null &&
            parsed.data.totalTokenLimit === null
          ? false
          : undefined;

    if (unlimited !== undefined) {
      data.unlimited = unlimited;
      if (unlimited) {
        data.dailyTokenLimit = null;
        data.monthlyTokenLimit = null;
        data.totalTokenLimit = null;
      }
    }
    if (parsed.data.dailyTokenLimit !== undefined && data.dailyTokenLimit === undefined) {
      data.dailyTokenLimit = parsed.data.dailyTokenLimit;
    }
    if (parsed.data.monthlyTokenLimit !== undefined && data.monthlyTokenLimit === undefined) {
      data.monthlyTokenLimit = parsed.data.monthlyTokenLimit;
    }
    if (parsed.data.totalTokenLimit !== undefined && data.totalTokenLimit === undefined) {
      data.totalTokenLimit = parsed.data.totalTokenLimit;
    }
    // If limits were explicitly set to a value, unlimited is turned off.
    if (parsed.data.dailyTokenLimit && parsed.data.dailyTokenLimit > 0) data.unlimited = false;
    if (parsed.data.monthlyTokenLimit && parsed.data.monthlyTokenLimit > 0) data.unlimited = false;
    if (parsed.data.totalTokenLimit && parsed.data.totalTokenLimit > 0) data.unlimited = false;

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        status: (data.status as 'ACTIVE' | 'DISABLED' | undefined) ?? undefined,
        unlimited: (data.unlimited as boolean | undefined) ?? undefined,
        dailyTokenLimit:
          data.dailyTokenLimit === undefined
            ? undefined
            : data.dailyTokenLimit === null
              ? null
              : BigInt(data.dailyTokenLimit as number),
        monthlyTokenLimit:
          data.monthlyTokenLimit === undefined
            ? undefined
            : data.monthlyTokenLimit === null
              ? null
              : BigInt(data.monthlyTokenLimit as number),
        totalTokenLimit:
          data.totalTokenLimit === undefined
            ? undefined
            : data.totalTokenLimit === null
              ? null
              : BigInt(data.totalTokenLimit as number),
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        unlimited: user.unlimited,
        dailyTokenLimit: nullableNum(user.dailyTokenLimit),
        monthlyTokenLimit: nullableNum(user.monthlyTokenLimit),
        totalTokenLimit: nullableNum(user.totalTokenLimit),
        dailyTokensUsed: num(user.dailyTokensUsed),
        monthlyTokensUsed: num(user.monthlyTokensUsed),
        totalTokensUsed: num(user.totalTokensUsed),
      },
    });
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  try {
    await loadTarget(params.id);
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireOwner();
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }

  const action = new URL(req.url).searchParams.get('action');
  if (action !== 'reset-usage') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  try {
    await loadTarget(params.id);
    await resetUserUsage(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as ApiError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
