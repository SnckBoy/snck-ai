import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/crypto';
import { ProviderType, ProviderStatus } from '@prisma/client';

/**
 * Seed an out-of-the-box demo provider + models the first time the OWNER
 * account is created (guarded by SEED_DEMO_PROVIDER=true, which
 * docker-compose enables by default). Points at the "mock" service that runs
 * inside the compose network, so a fresh install has working chat immediately.
 *
 * Never fails registration: callers wrap this in a catch.
 */
export async function seedDemoProvider(): Promise<void> {
  const enabled = (process.env.SEED_DEMO_PROVIDER ?? '').toLowerCase();
  if (!['1', 'true', 'yes'].includes(enabled)) return;

  const baseUrl = process.env.MOCK_INTERNAL_URL ?? 'http://mock:4500';
  const name = 'Demo Provider (mock)';

  const existing = await prisma.aIProvider.findFirst({ where: { name } });
  if (existing) return;

  const provider = await prisma.aIProvider.create({
    data: {
      name,
      type: ProviderType.CUSTOM,
      baseUrl,
      apiKeyEnc: encryptSecret('mock-key-12345'),
      enabled: true,
      status: ProviderStatus.CONNECTED,
      statusMessage: 'Seeded demo provider (mock, no real API key needed)',
    },
  });

  const demoModels: Array<[string, string]> = [
    ['snck-mock-gpt', 'GPT-4o (Demo)'],
    ['snck-mock-claude', 'Claude Sonnet (Demo)'],
    ['snck-mock-gemini', 'Gemini Pro (Demo)'],
  ];

  await prisma.model.createMany({
    data: demoModels.map(([identifier, displayName], i) => ({
      providerId: provider.id,
      identifier,
      displayName,
      enabled: true,
      standardAccess: true,
      sortOrder: i,
    })),
  });
}
