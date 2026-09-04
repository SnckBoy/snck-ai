import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/auth';
import type { SessionUser } from '@/lib/auth';
import type { AIProvider, Model } from '@prisma/client';

export async function getAvailableModels(user: SessionUser) {
  return prisma.model.findMany({
    where: {
      enabled: true,
      provider: { enabled: true },
      ...(user.role !== 'OWNER' ? { standardAccess: true } : {}),
    },
    include: { provider: { select: { id: true, name: true, type: true } } },
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
  });
}

export async function resolveModelForUser(
  modelId: string,
  user: SessionUser,
): Promise<{ model: Model; provider: AIProvider }> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    include: { provider: true },
  });

  if (!model) throw new ApiError(404, 'Model not found');
  if (!model.provider || !model.provider.enabled || !model.enabled) {
    throw new ApiError(403, 'This model is not available');
  }
  if (user.role !== 'OWNER' && !model.standardAccess) {
    throw new ApiError(403, 'You do not have access to this model');
  }
  if (!model.provider.apiKeyEnc) {
    throw new ApiError(500, 'Provider has no API key configured');
  }
  return { model, provider: model.provider };
}
