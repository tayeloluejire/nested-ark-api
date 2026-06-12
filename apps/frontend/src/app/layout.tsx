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

// ── FULL SEO METADATA — production-grade ──────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: 'Nested Ark Rent Vault – Save for Annual Rent Gradually | Nigeria, Ghana, Kenya, UK',
    template: '%s | Nested Ark Rent Vault',
  },
  description:
    'Save for your annual rent gradually with Nested Ark Rent Vault. Build a rent savings plan, track progress, and pay your landlord on time without borrowing. Secure, transparent and landlord-friendly. Available in Nigeria, Ghana, Kenya and the UK.',
  keywords: [
    'save for rent', 'rent savings plan', 'annual rent savings', 'save rent gradually',
    'rent vault', 'rent contribution plan', 'pay rent without borrowing',
    'how to save for rent', 'rent planning app', 'rent target calculator',
    'save for rent in Nigeria', 'annual rent Nigeria', 'pay rent monthly Nigeria',
    'landlord rent assurance', 'rent escrow platform', 'property payment management',
    'tenant payment tracking', 'housing savings platform', 'goal savings platform',
    'save for rent Ghana', 'save for rent Kenya', 'rent planning UK',
    'nested ark', 'rent vault Nigeria', 'tenant rent savings',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    alternateLocale: ['en_GH', 'en_KE', 'en_GB', 'en_US'],
    url: 'https://nested-ark-api.vercel.app',
    siteName: 'Nested Ark Rent Vault',
    title: 'Nested Ark Rent Vault – Save for Annual Rent Gradually',
    description:
      'Save gradually toward your annual rent. Track every contribution. Pay your landlord on time without borrowing. Nigeria · Ghana · Kenya · United Kingdom.',
    images: [{
      url: 'https://nested-ark-api.vercel.app/og-image.png',
      width: 1200, height: 630,
      alt: 'Nested Ark Rent Vault – Save for Rent. Pay with Confidence.',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@NestedArk_OS',
    creator: '@NestedArk_OS',
    title: 'Nested Ark Rent Vault – Save for Annual Rent Gradually',
    description: 'Build a rent savings plan. Track progress. Pay confidently. Nigeria · Ghana · Kenya · UK.',
    images: ['https://nested-ark-api.vercel.app/og-image.png'],
  },
  alternates: {
    canonical: 'https://nested-ark-api.vercel.app',
    languages: {
      'en-NG': 'https://nested-ark-api.vercel.app/save-for-rent-nigeria',
      'en-GH': 'https://nested-ark-api.vercel.app/save-for-rent-ghana',
      'en-KE': 'https://nested-ark-api.vercel.app/save-for-rent-kenya',
      'en-GB': 'https://nested-ark-api.vercel.app/rent-planning',
    },
  },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: { icon: '/nested_ark_icon.png', apple: '/nested_ark_icon.png' },
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