'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Bot,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Settings as SettingsIcon,
  Sun,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/components/theme-provider';
import { Logo, cn } from '@/components/ui';

const navItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/providers', label: 'AI Providers', icon: KeyRound },
  { href: '/admin/models', label: 'Models', icon: Bot },
  { href: '/admin/usage', label: 'Usage', icon: Activity },
  { href: '/admin/settings', label: 'Settings', icon: SettingsIcon },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-mesh">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-border bg-[rgba(var(--surface),0.4)] backdrop-blur-xl lg:flex">
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/admin">
            <Logo size={34} />
          </Link>
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-purple-300">
            ADMIN
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'bg-gradient-to-r from-purple-500/25 to-cyan-500/10 text-foreground shadow-glow'
                    : 'text-foreground/60 hover:bg-white/5 hover:text-foreground',
                )}
              >
                <item.icon className="h-4.5 w-4.5 h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border p-3">
          <Link
            href="/chat"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/60 transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <MessageSquare className="h-5 w-5" /> Back to chat
          </Link>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/60 transition-colors hover:bg-white/5 hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={() => useAuthStore.getState().logout().then(() => (window.location.href = '/login'))}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
          >
            <LogOut className="h-5 w-5" /> Log out
          </button>
          <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-border bg-white/5 px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-xs font-bold text-white">
              {user?.username.slice(0, 2).toUpperCase() ?? 'SN'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.username ?? 'Owner'}</p>
              <p className="truncate text-[11px] text-purple-300">Owner</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border bg-[rgba(var(--bg),0.8)] px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo size={30} />
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="rounded-lg p-2 text-foreground/60 hover:bg-white/5"
          >
            <MessageSquare className="h-5 w-5" />
          </Link>
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-300">
            ADMIN
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pt-16 lg:pt-0 lg:pl-[240px]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4 sm:p-6 lg:p-8"
        >
          {children}
        </motion.div>
      </div>

      {/* Mobile nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-[rgba(var(--bg),0.9)] px-2 py-2 backdrop-blur-xl lg:hidden">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 text-[10px]',
                active ? 'text-purple-300' : 'text-foreground/50',
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
