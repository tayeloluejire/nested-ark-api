import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';

const inter = Inter({ subsets: ['latin'] });

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
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
