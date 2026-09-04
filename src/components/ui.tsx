'use client';

import React, { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import clsx from 'clsx';

export const cn = clsx;

export const Logo = ({
  size = 36,
  withText = true,
  className,
}: {
  size?: number;
  withText?: boolean;
  className?: string;
}) => (
  <div className={cn('flex items-center gap-2.5', className)}>
    <div
      className="relative flex items-center justify-center rounded-xl shadow-glow"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #7c3aed, #6366f1 55%, #06b6d4)',
      }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10c.9 0 1.78-.12 2.62-.34-.62-.4-1.12-.94-1.5-1.56A8.2 8.2 0 0 1 12 20.2 8.2 8.2 0 1 1 20.2 12c0 .8-.1 1.57-.3 2.28.62-.4 1.3-.72 2-.9.06-.45.1-.9.1-1.38C22 6.477 17.523 2 12 2Z"
          fill="white"
        />
        <circle cx="9.5" cy="10.5" r="1.4" fill="white" />
        <circle cx="14.5" cy="10.5" r="1.4" fill="white" />
        <path d="M9.6 14.6c.7.7 1.5 1 2.4 1s1.7-.3 2.4-1" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 opacity-40 blur-md -z-10" />
    </div>
    {withText && (
      <span className="text-xl font-bold tracking-tight text-foreground">
        Snck <span className="text-gradient">AI</span>
      </span>
    )}
  </div>
);

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-snck-gradient text-white font-medium shadow-glow hover:shadow-[0_0_32px_rgba(124,58,237,0.5)] hover:brightness-110',
  secondary:
    'bg-[rgba(var(--surface-2),0.9)] text-foreground border border-border hover:bg-[rgba(var(--surface-2),0.6)]',
  outline:
    'bg-transparent text-foreground border border-purple-500/40 hover:border-purple-400/70 hover:bg-purple-500/10',
  ghost: 'bg-transparent text-foreground hover:bg-white/5',
  danger: 'bg-red-500/90 text-white font-medium hover:bg-red-500',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 disabled:opacity-50 disabled:pointer-events-none select-none',
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export function Input({
  className,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-xl border border-border bg-[rgba(var(--surface),0.6)] px-3.5 text-sm text-foreground placeholder:text-foreground/40 outline-none transition-all',
        'focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20',
        error && 'border-red-500/60',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-xl border border-border bg-[rgba(var(--surface),0.6)] px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/40 outline-none transition-all',
        'focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20 resize-none',
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-[rgba(var(--surface),0.55)] backdrop-blur-xl shadow-card',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  color = 'purple',
  className,
}: {
  children: React.ReactNode;
  color?: 'purple' | 'cyan' | 'green' | 'red' | 'amber' | 'orange' | 'slate';
  className?: string;
}) {
  const colors: Record<string, string> = {
    purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    red: 'bg-red-500/15 text-red-300 border-red-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    orange: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    slate: 'bg-white/8 text-foreground/70 border-white/10',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        colors[color],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className="animate-spin rounded-full border-2 border-purple-400/30 border-t-purple-400"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60',
        checked ? 'bg-gradient-to-r from-purple-500 to-cyan-500' : 'bg-white/10',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
      {label}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 12, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className={cn(
              'relative w-full rounded-2xl border border-border glass-strong shadow-card p-6',
              width,
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-foreground/50 transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">{children}</div>
            {footer && <div className="mt-5 flex justify-end gap-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    CONNECTED: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
    INVALID_KEY: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]',
    PROVIDER_ERROR: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
    NETWORK_ERROR: 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]',
    DISABLED: 'bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.8)]',
    UNTESTED: 'bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.8)]',
  };
  return (
    <span className={cn('inline-block h-2 w-2 rounded-full', colorMap[status] ?? 'bg-slate-500')} />
  );
}
