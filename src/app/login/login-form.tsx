'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Zap } from 'lucide-react';
import AuthShell from '@/components/auth-shell';
import { Button, Input } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ user: { id: string; username: string; email: string; role: 'OWNER' | 'USER' } }>(
        '/api/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      );
      setUser(res.user);
      const next = searchParams.get('next');
      router.push(next?.startsWith('/') ? next : res.user.role === 'OWNER' ? '/chat' : '/chat');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-foreground/50">Log in to continue chatting with your AI models.</p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/80">Email</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/80">Password</label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 transition-colors hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </motion.p>
          )}

          <Button type="submit" fullWidth size="lg" loading={loading}>
            <Zap className="h-4 w-4" /> Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-foreground/50">
          New here?{' '}
          <Link href="/register" className="font-medium text-purple-300 hover:text-purple-200">
            Create an account
          </Link>
        </p>
      </motion.div>
    </AuthShell>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
