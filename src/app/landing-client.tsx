'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Shield,
  Sparkles,
  Activity,
  Layers,
  MessageSquare,
  Gauge,
  KeyRound,
} from 'lucide-react';
import { Logo, Button, Badge } from '@/components/ui';
import { useAuthStore } from '@/store/auth-store';

const features = [
  {
    icon: Layers,
    title: 'Multiple AI Providers',
    desc: 'OpenAI, Anthropic, Google Gemini, OpenRouter and any OpenAI-compatible endpoint — all behind one interface.',
  },
  {
    icon: Shield,
    title: 'Enterprise-grade Security',
    desc: 'Encrypted API keys, bcrypt password hashing, signed sessions and strict server-side role checks.',
  },
  {
    icon: Gauge,
    title: 'Token & Usage Control',
    desc: 'Owners set daily, monthly or total token limits per user. Usage is tracked in real time.',
  },
  {
    icon: Activity,
    title: 'Deep Analytics',
    desc: 'Live dashboards for usage by model, provider and user, with beautiful charts and insights.',
  },
  {
    icon: MessageSquare,
    title: 'Streaming Chat',
    desc: 'Blazing-fast streaming responses, markdown, code highlighting and full conversation history.',
  },
  {
    icon: KeyRound,
    title: 'Provider Management',
    desc: 'Owners add and test provider connections with one click. Keys are never exposed to users.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

export default function LandingClient() {
  const router = useRouter();
  const { user, loading, load } = useAuthStore();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/chat');
    }
  }, [loading, user, router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-mesh">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[500px] w-[500px] rounded-full bg-purple-600/20 blur-[140px] animate-float" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[480px] w-[480px] rounded-full bg-cyan-500/12 blur-[130px] animate-float" style={{ animationDelay: '-2.5s' }} />
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-40" />

      {/* Nav */}
      <header className="relative z-20">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Logo size={40} />
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto max-w-6xl px-6">
        <section className="flex flex-col items-center pt-20 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Badge color="purple" className="mb-6 px-3 py-1 text-sm">
              <Sparkles className="h-3.5 w-3.5" /> Multi-provider AI, unified
            </Badge>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl"
          >
            One chat. <span className="text-gradient">Every AI model.</span>
            <br />
            Zero compromises.
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-6 max-w-2xl text-lg text-foreground/60"
          >
            Snck AI is a premium AI chat platform that puts GPT, Claude, Gemini and hundreds of
            OpenRouter models behind a single, beautiful, streaming interface — with full owner
            control over models, users and token usage.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
          >
            <Link href="/register">
              <Button size="lg">
                Start chatting free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                I already have an account
              </Button>
            </Link>
          </motion.div>

          {/* Floating model chips */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ delay: 0.45, duration: 0.6 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-3"
          >
            {['GPT-4o', 'Claude 3.5 Sonnet', 'Gemini 1.5 Pro', 'Llama 3.1 70B', 'GPT-4o Mini'].map(
              (m) => (
                <span
                  key={m}
                  className="glass rounded-full px-4 py-1.5 text-sm text-foreground/70 transition-all hover:border-purple-400/40 hover:text-foreground"
                >
                  {m}
                </span>
              ),
            )}
          </motion.div>
        </section>

        {/* Features */}
        <section className="pb-24">
          <motion.h2
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            className="mb-12 text-center text-3xl font-bold"
          >
            Everything you need to <span className="text-gradient">run an AI platform</span>
          </motion.h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                transition={{ delay: i * 0.06 }}
              >
                <div className="group glass rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-purple-400/40 hover:shadow-glow">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/80 to-cyan-500/70 shadow-glow">
                    <f.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="mb-2 font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-foreground/55">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="pb-24">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            className="border-gradient relative overflow-hidden rounded-3xl p-10 text-center sm:p-16"
          >
            <div className="pointer-events-none absolute inset-0 bg-snck-radial" />
            <Bot className="mx-auto mb-6 h-12 w-12 text-purple-300" />
            <h2 className="text-3xl font-bold sm:text-4xl">
              Ready to power your own <span className="text-gradient">AI chat platform?</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-foreground/60">
              The first account to register becomes the Owner, with the full admin dashboard at
              their fingertips.
            </p>
            <Link href="/register" className="mt-8 inline-block">
              <Button size="lg">
                Claim Owner access <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border py-8 text-center text-sm text-foreground/40">
        © {new Date().getFullYear()} Snck AI — Built for the future of multi-model chat.
      </footer>
    </div>
  );
}
