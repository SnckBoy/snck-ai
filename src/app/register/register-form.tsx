'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Crown, Eye, EyeOff, Rocket } from 'lucide-react';
import AuthShell from '@/components/auth-shell';
import { Button, Input } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export default function RegisterForm() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ user: { id: string; username: string; email: string; role: 'OWNER' | 'USER' }; isOwner?: boolean }>(
        '/api/auth/register',
        { method: 'POST', body: JSON.stringify({ username, email, password }) },
      );
      setIsOwner(Boolean(res.isOwner));
      setUser(res.user);
      setTimeout(() => router.push('/chat'), 900);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        {isOwner ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 shadow-glow">
              <Crown className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">You are the Owner!</h1>
            <p className="mt-2 text-sm text-foreground/60">
              As the very first account, you have been granted{' '}
              <span className="font-semibold text-purple-300">Owner privileges</span>. You can now manage
              providers, models, users and usage from the admin dashboard.
            </p>
            <Button className="mt-6" size="lg" onClick={() => router.push('/admin')} fullWidth>
              Open Admin Dashboard
            </Button>
            <p className="mt-3 text-xs text-foreground/40">Redirecting to your workspace…</p>
          </motion.div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="mt-1 text-sm text-foreground/50">
              Join Snck AI and chat with the best AI models.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">Username</label>
                <Input
                  required
                  minLength={3}
                  maxLength={24}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="snckuser"
                  autoComplete="username"
                />
              </div>
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
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
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
                <Rocket className="h-4 w-4" /> Create account
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-foreground/50">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-purple-300 hover:text-purple-200">
                Log in
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </AuthShell>
  );
}
