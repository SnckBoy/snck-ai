'use client';

import { motion } from 'framer-motion';
import { Logo } from '@/components/ui';

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-mesh">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-purple-600/25 blur-[120px] animate-float" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 h-[520px] w-[520px] rounded-full bg-cyan-500/15 blur-[130px] animate-float" style={{ animationDelay: '-3s' }} />
      <div className="pointer-events-none absolute top-1/3 right-1/4 h-[300px] w-[300px] rounded-full bg-indigo-500/20 blur-[100px] animate-float" style={{ animationDelay: '-1.5s' }} />
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-60" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <Logo size={48} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-full max-w-md"
        >
          <div className="glass-strong rounded-2xl p-8 shadow-card">{children}</div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center text-xs text-foreground/40"
        >
          Snck AI · Multi-provider AI chat platform
        </motion.p>
      </div>
    </div>
  );
}
