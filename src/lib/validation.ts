import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(24, 'Username must be at most 24 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, _ and -'),
  email: z.string().email('Invalid email address').max(160),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(160),
  password: z.string().min(1, 'Password is required').max(128),
});

export const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
  modelId: z.string().optional(),
});

export const renameConversationSchema = z.object({
  title: z.string().min(1).max(200),
});

export const chatRequestSchema = z.object({
  conversationId: z.string().optional(),
  modelId: z.string().min(1),
  content: z.string().min(1, 'Message cannot be empty').max(12000),
  title: z.string().max(200).optional(),
});

export const providerSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(['OPENAI_COMPATIBLE', 'ANTHROPIC', 'GEMINI', 'OPENROUTER', 'CUSTOM']),
  baseUrl: z.string().url().max(500).optional().or(z.literal('')),
  apiKey: z.string().min(1).max(500),
});

export const providerUpdateSchema = providerSchema.partial().extend({
  apiKey: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
});

export const modelUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  standardAccess: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const userUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  dailyTokenLimit: z.number().int().min(0).max(1e15).nullable().optional(),
  monthlyTokenLimit: z.number().int().min(0).max(1e15).nullable().optional(),
  totalTokenLimit: z.number().int().min(0).max(1e15).nullable().optional(),
  unlimited: z.boolean().optional(),
});

export const platformSettingsSchema = z.object({
  defaultDailyTokenLimit: z.number().int().min(0).max(1e15).nullable().optional(),
  defaultMonthlyTokenLimit: z.number().int().min(0).max(1e15).nullable().optional(),
  defaultTotalTokenLimit: z.number().int().min(0).max(1e15).nullable().optional(),
  defaultUnlimited: z.boolean().optional(),
});
