import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validation';
import { createSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { applyDefaultLimitsToUser } from '@/lib/usage';
import { seedDemoProvider } from '@/lib/demo-provider';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const OWNER_LOCK_KEY = 728319;

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

  const email = parsed.data.email.trim().toLowerCase();
  const username = parsed.data.username.trim();

  const existing = await prisma.user
    .findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    })
    .catch(() => null);
  if (existing) {
    const field = existing.email === email ? 'email' : 'username';
    return NextResponse.json({ error: `${field} is already registered` }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Serialize first-registration so exactly one account ever becomes OWNER,
      // even when two users register at the same moment.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${OWNER_LOCK_KEY})`;
      const userCount = await tx.user.count();
      const isFirstUser = userCount === 0;
      const user = await tx.user.create({
        data: {
          username,
          email,
          passwordHash,
          role: isFirstUser ? 'OWNER' : 'USER',
          unlimited: isFirstUser,
        },
      });
      return { id: user.id, isFirstUser };
    });

    // Non-fatal: a default-limit failure must never fail an otherwise valid
    // registration (the user is already created).
    if (!created.isFirstUser) {
      await applyDefaultLimitsToUser(created.id).catch(() => undefined);
    }

    // Non-fatal: seed the demo provider only for the very first (Owner) account.
    if (created.isFirstUser) {
      await seedDemoProvider().catch((err) => {
        console.error('[auth/register] seedDemoProvider', err);
      });
    }

    await createSession({
      id: created.id,
      username,
      email,
      role: created.isFirstUser ? 'OWNER' : 'USER',
    });

    return NextResponse.json(
      {
        user: {
          id: created.id,
          username,
          email,
          role: created.isFirstUser ? 'OWNER' : 'USER',
          isOwner: created.isFirstUser,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'That email or username is already registered' },
        { status: 409 },
      );
    }
    console.error('[auth/register]', err);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}
