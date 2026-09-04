'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Sidebar from '@/components/chat/sidebar';
import type { SessionUser } from '@/types/auth';

export default function ChatShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-mesh">
      {/* Desktop sidebar */}
      <aside className="hidden w-[280px] shrink-0 border-r border-border md:block">
        <Sidebar user={user} />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-[300px] border-r border-border md:hidden"
            >
              <Sidebar user={user} onNavigate={() => setMobileOpen(false)} />
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 rounded-lg p-1.5 text-foreground/60 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <button
          onClick={() => setMobileOpen(true)}
          className="absolute left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-xl border border-border glass text-foreground/70 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="h-full">{children}</div>
      </main>
    </div>
  );
}
