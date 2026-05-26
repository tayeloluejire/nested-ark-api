import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import MarketTicker from '@/components/MarketTicker';
import MobileBottomNav from '@/components/navigation/MobileBottomNav';

const inter = Inter({ subsets: ['latin'] });

// ── MODERN NEXT.JS VIEWPORT STRUCTURAL EXPORT ─────────────────────────────
// Resolves: "Unsupported metadata viewport is configured in metadata export" warnings
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,      // Prevents unpredictable layout scale shifts on input field selections
  userScalable: false,
};

// ── CORE PLATFORM METADATA CONFIGURATION ──────────────────────────────────
export const metadata: Metadata = {
  title: 'Nested Ark OS',
  description: 'Infrastructure Management Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme="dark" is the default — ThemeToggle will override via JS+localStorage
    // The inline script below runs BEFORE React hydrates, preventing the flash of light mode
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/*
          Anti-flash script: reads localStorage BEFORE the page renders.
          This prevents the 1-frame "flash" when a user has saved light mode preference.
          suppressHydrationWarning on <html> allows the data-theme mismatch between
          server (always "dark") and client (from localStorage) without React warnings.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('ark-theme') || 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {/* ── MarketTicker: runs across ALL pages — global broadcast feed ── */}
          <MarketTicker />
          {children}
          {/* ── Mobile bottom navigation: role-aware, hidden on md+ ────── */}
          <MobileBottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}