export interface StatsData {
  summary: {
    totalUsers: number;
    activeUsers: number;
    disabledUsers: number;
    totalConversations: number;
    totalRequests: number;
    totalTokens: number;
  };
  usageByModel: Array<{ name: string; tokens: number; requests: number }>;
  usageByProvider: Array<{ name: string; tokens: number; requests: number }>;
  topUsers: Array<{ username: string; email: string; tokens: number; requests: number }>;
  dailySeries: Array<{ date: string; tokens: number; requests: number }>;
  recentActivity: Array<{ id: string; username: string; modelName: string; tokens: number; createdAt: string }>;
  providers: Array<{ id: string; name: string; type: string; enabled: boolean }>;
}

export const CHART_COLORS = ['#8b5cf6', '#6366f1', '#22d3ee', '#a855f7', '#06b6d4', '#818cf8'];
