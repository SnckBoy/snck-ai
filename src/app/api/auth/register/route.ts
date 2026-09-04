import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validation';
import { createSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { applyDefaultLimitsToUser } from '@/lib/usage';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const limited = rateLimit({ keyPrefix: 'auth:register' })(req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const { username, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });
  if (existing) {
    const field = existing.email === email ? 'email' : 'username';
    return NextResponse.json({ error: `${field} is already registered` }, { status: 409 });
  }

  const userCount = await prisma.user.count();
  const isFirstUser = userCount === 0;

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role: isFirstUser ? 'OWNER' : 'USER',
      unlimited: isFirstUser,
    },
  });

  if (!isFirstUser) {
    await applyDefaultLimitsToUser(user.id);
  }

  await createSession({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json(
    {
      user: { id: user.id, username: user.username, email: user.email, role: user.role, isOwner: isFirstUser },
    },
    { status: 201 },
  );
}
