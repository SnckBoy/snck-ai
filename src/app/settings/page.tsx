import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { num, nullableNum } from '@/lib/serialize';
import SettingsContent from './settings-content';

export const metadata = {
  title: 'Settings',
};

export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) redirect('/login');

  return (
    <SettingsContent
      user={{
        username: dbUser.username,
        email: dbUser.email,
        role: dbUser.role,
        unlimited: dbUser.unlimited,
        dailyTokenLimit: nullableNum(dbUser.dailyTokenLimit),
        monthlyTokenLimit: nullableNum(dbUser.monthlyTokenLimit),
        totalTokenLimit: nullableNum(dbUser.totalTokenLimit),
        dailyTokensUsed: num(dbUser.dailyTokensUsed),
        monthlyTokensUsed: num(dbUser.monthlyTokensUsed),
        totalTokensUsed: num(dbUser.totalTokensUsed),
        joinedAt: dbUser.createdAt.toISOString(),
      }}
    />
  );
}
