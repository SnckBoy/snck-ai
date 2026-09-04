import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/auth';
import { num, nullableNum, toTokenInt } from '@/lib/serialize';
import type { User, Prisma } from '@prisma/client';

const DAY_MS = 86_400_000;
const MONTH_MS = 30 * DAY_MS;

export interface PlatformLimits {
  defaultDailyTokenLimit: number | null;
  defaultMonthlyTokenLimit: number | null;
  defaultTotalTokenLimit: number | null;
  defaultUnlimited: boolean;
}

const SETTING_KEYS = [
  'defaultDailyTokenLimit',
  'defaultMonthlyTokenLimit',
  'defaultTotalTokenLimit',
  'defaultUnlimited',
] as const;

export async function getPlatformLimits(): Promise<PlatformLimits> {
  const settings = await prisma.platformSetting.findMany({
    where: { key: { in: [...SETTING_KEYS] } },
  });
  const map = new Map(settings.map((s) => [s.key, s.value]));
  const parseLimit = (raw: string | undefined): number | null => {
    if (raw === undefined || raw === '' || raw === '-1' || raw === 'null') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    defaultDailyTokenLimit: parseLimit(map.get('defaultDailyTokenLimit')),
    defaultMonthlyTokenLimit: parseLimit(map.get('defaultMonthlyTokenLimit')),
    defaultTotalTokenLimit: parseLimit(map.get('defaultTotalTokenLimit')),
    defaultUnlimited: map.get('defaultUnlimited') === 'true',
  };
}

export async function savePlatformLimits(limits: Partial<PlatformLimits>): Promise<void> {
  const entries: Prisma.PlatformSettingCreateManyInput[] = [];
  const put = (key: string, value: string) => entries.push({ key, value });
  if (limits.defaultDailyTokenLimit !== undefined)
    put('defaultDailyTokenLimit', String(limits.defaultDailyTokenLimit ?? -1));
  if (limits.defaultMonthlyTokenLimit !== undefined)
    put('defaultMonthlyTokenLimit', String(limits.defaultMonthlyTokenLimit ?? -1));
  if (limits.defaultTotalTokenLimit !== undefined)
    put('defaultTotalTokenLimit', String(limits.defaultTotalTokenLimit ?? -1));
  if (limits.defaultUnlimited !== undefined)
    put('defaultUnlimited', String(limits.defaultUnlimited));

  await prisma.$transaction(
    entries.map((e) =>
      prisma.platformSetting.upsert({
        where: { key: e.key },
        create: e,
        update: { value: e.value },
      }),
    ),
  );
}

/**
 * Apply the platform default token limits to a freshly registered user.
 */
export async function applyDefaultLimitsToUser(userId: string): Promise<void> {
  const limits = await getPlatformLimits();
  if (limits.defaultUnlimited) {
    await prisma.user.update({
      where: { id: userId },
      data: { unlimited: true, dailyTokenLimit: null, monthlyTokenLimit: null, totalTokenLimit: null },
    });
    return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyTokenLimit: limits.defaultDailyTokenLimit != null ? BigInt(limits.defaultDailyTokenLimit) : null,
      monthlyTokenLimit: limits.defaultMonthlyTokenLimit != null ? BigInt(limits.defaultMonthlyTokenLimit) : null,
      totalTokenLimit: limits.defaultTotalTokenLimit != null ? BigInt(limits.defaultTotalTokenLimit) : null,
    },
  });
}

/**
 * Roll daily/monthly usage counters over when their window expires.
 */
export async function rolloverWindows(userId: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const now = new Date();
  const updates: Prisma.UserUpdateInput = {};
  if (now.getTime() - user.dailyWindowStart.getTime() > DAY_MS) {
    updates.dailyTokensUsed = 0n;
    updates.dailyWindowStart = now;
  }
  if (now.getTime() - user.monthlyWindowStart.getTime() > MONTH_MS) {
    updates.monthlyTokensUsed = 0n;
    updates.monthlyWindowStart = now;
  }
  if (Object.keys(updates).length > 0) {
    return prisma.user.update({ where: { id: userId }, data: updates });
  }
  return user;
}

export interface UsageCheckResult {
  allowed: boolean;
  limit?: 'daily' | 'monthly' | 'total';
  message?: string;
}

export async function checkUsageAllowed(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(401, 'User not found');
  if (user.status === 'DISABLED') {
    throw new ApiError(403, 'Your account has been disabled');
  }
  if (user.unlimited) return user;

  const fresh = (await rolloverWindows(userId)) ?? user;

  const usedDaily = num(fresh.dailyTokensUsed);
  const usedMonthly = num(fresh.monthlyTokensUsed);
  const usedTotal = num(fresh.totalTokensUsed);

  const checks: Array<[bigint | null, number, 'daily' | 'monthly' | 'total', string]> = [
    [fresh.dailyTokenLimit, usedDaily, 'daily', `Daily token limit of ${Number(fresh.dailyTokenLimit).toLocaleString()} reached`],
    [fresh.monthlyTokenLimit, usedMonthly, 'monthly', `Monthly token limit of ${Number(fresh.monthlyTokenLimit).toLocaleString()} reached`],
    [fresh.totalTokenLimit, usedTotal, 'total', `Total token limit of ${Number(fresh.totalTokenLimit).toLocaleString()} reached`],
  ];

  for (const [limit, used, key, message] of checks) {
    if (limit !== null && used >= num(limit)) {
      const err = new ApiError(429, message) as ApiError & { limitKey?: string };
      err.limitKey = key;
      throw err;
    }
  }
  return fresh;
}

export async function recordUsage(params: {
  userId: string;
  providerId?: string;
  modelId?: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const inputTokens = toTokenInt(params.inputTokens);
  const outputTokens = toTokenInt(params.outputTokens);
  const total = inputTokens + outputTokens;
  if (total <= 0) return;
  await rolloverWindows(params.userId);
  await prisma.$transaction([
    prisma.usageRecord.create({
      data: {
        userId: params.userId,
        providerId: params.providerId,
        modelId: params.modelId,
        inputTokens: BigInt(inputTokens),
        outputTokens: BigInt(outputTokens),
        totalTokens: BigInt(total),
      },
    }),
    prisma.user.update({
      where: { id: params.userId },
      data: {
        dailyTokensUsed: { increment: BigInt(total) },
        monthlyTokensUsed: { increment: BigInt(total) },
        totalTokensUsed: { increment: BigInt(total) },
      },
    }),
  ]);
}

export async function resetUserUsage(userId: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        dailyTokensUsed: 0n,
        monthlyTokensUsed: 0n,
        totalTokensUsed: 0n,
        dailyWindowStart: now,
        monthlyWindowStart: now,
      },
    }),
    prisma.usageRecord.deleteMany({ where: { userId } }),
  ]);
}

export async function resetAllUsage(): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.user.updateMany({
      data: {
        dailyTokensUsed: 0n,
        monthlyTokensUsed: 0n,
        totalTokensUsed: 0n,
        dailyWindowStart: now,
        monthlyWindowStart: now,
      },
    }),
    prisma.usageRecord.deleteMany({}),
  ]);
}

export function userUsageView(user: User) {
  return {
    dailyTokensUsed: num(user.dailyTokensUsed),
    monthlyTokensUsed: num(user.monthlyTokensUsed),
    totalTokensUsed: num(user.totalTokensUsed),
    dailyTokenLimit: nullableNum(user.dailyTokenLimit),
    monthlyTokenLimit: nullableNum(user.monthlyTokenLimit),
    totalTokenLimit: nullableNum(user.totalTokenLimit),
    unlimited: user.unlimited,
  };
}
