'use client';

import { useEffect, useState } from 'react';

/**
 * Public page (allow-listed in middleware.ts). Android browsers are sent
 * here from /tenant/pay/success after Paystack, and it reopens the
 * NestedArk app via the nestedark://payment deep link.
 */
export default function AppReturnPage() {
  const [intentUrl, setIntentUrl] = useState('#');
  const [webUrl, setWebUrl] = useState('/tenant/pay/success?web=1');

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('reference') ?? '';
    const enc = encodeURIComponent(ref);
    // If the app is not installed, Chrome follows browser_fallback_url
    // (the normal web success page; ?web=1 stops the redirect loop).
    const web = `${window.location.origin}/tenant/pay/success?reference=${enc}&web=1`;
    const intent =
      `intent://payment?reference=${enc}` +
      `#Intent;scheme=nestedark;package=com.nestedark.app;` +
      `S.browser_fallback_url=${encodeURIComponent(web)};end`;
    setWebUrl(web);
    setIntentUrl(intent);
    // Automatic attempt; the button below is the guaranteed (tap) path.
    const t = setTimeout(() => window.location.replace(intent), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
        background: '#050505',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Payment received</h1>
      <p style={{ opacity: 0.7, maxWidth: 320 }}>
        Returning you to the NestedArk app…
      </p>
      <a
        href={intentUrl}
        style={{
          background: '#14b8a6',
          color: '#000',
          fontWeight: 800,
          padding: '14px 28px',
          borderRadius: 999,
          textDecoration: 'none',
        }}
      >
        Return to NestedArk
      </a>
      <a href={webUrl} style={{ color: '#14b8a6', fontSize: 14 }}>
        Continue on the web instead
      </a>
    </main>
  );
}
