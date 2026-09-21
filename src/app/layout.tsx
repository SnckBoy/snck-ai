import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: {
    default: 'Snck AI — Multi-Provider AI Chat',
    template: '%s · Snck AI',
  },
  description:
    'Snck AI is a premium multi-provider AI chat platform. Chat with the best AI models from OpenAI, Anthropic, Google and more — all in one place.',
  keywords: ['AI chat', 'multi-provider', 'GPT', 'Claude', 'Gemini', 'Snck AI'],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6fc' },
    { media: '(prefers-color-scheme: dark)', color: '#080710' },
  ],
};

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('snck-theme');var d=t==='light'?'light':'dark';var r=document.documentElement;if(d==='light'){r.classList.add('light');r.classList.remove('dark');}else{r.classList.remove('light');r.classList.add('dark');}r.style.colorScheme=d;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={{
          ['--font-inter' as string]: "'Inter', 'Segoe UI', system-ui, sans-serif",
          ['--font-jetbrains' as string]: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
        }}
      >
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
