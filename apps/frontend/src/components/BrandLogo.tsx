'use client';
/**
 * BrandLogo — Nested Ark OS
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for the brand mark across the entire infrastructure.
 * Uses the real /public/nested_ark_icon.png asset — never a CSS placeholder.
 *
 * Usage:
 *   <BrandLogo />                        — default 32px, links to /
 *   <BrandLogo size={48} />              — larger
 *   <BrandLogo showText={false} />       — icon only
 *   <BrandLogo href="/dashboard" />      — custom link target
 *   <BrandLogo noLink />                 — static, no anchor tag
 *   <BrandLogo className="mb-6" />       — extra wrapper classes
 */

import Image from 'next/image';
import Link from 'next/link';

interface BrandLogoProps {
  /** Icon size in px (default: 32) */
  size?: number;
  /** Show "Nested Ark OS" text beside the icon (default: true) */
  showText?: boolean;
  /** Where the logo links to (default: '/') */
  href?: string;
  /** If true, renders a <div> instead of a <Link> */
  noLink?: boolean;
  /** Extra classes on the outer wrapper */
  className?: string;
  /** Text colour override (default: 'text-white') */
  textColor?: string;
}

export default function BrandLogo({
  size       = 32,
  showText   = true,
  href       = '/',
  noLink     = false,
  className  = '',
  textColor  = 'text-white',
}: BrandLogoProps) {
  const inner = (
    <>
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <Image
          src="/nested_ark_icon.png"
          alt="Nested Ark OS"
          fill
          sizes={`${size}px`}
          className="object-contain"
          priority
        />
      </div>
      {showText && (
        <span
          className={`font-black tracking-tighter uppercase leading-none ${textColor}`}
          style={{ fontSize: Math.max(10, size * 0.38) }}
        >
          Nested Ark <span className="text-teal-500">OS</span>
        </span>
      )}
    </>
  );

  const wrapperClass = `flex items-center gap-2.5 ${className}`;

  if (noLink) {
    return <div className={wrapperClass}>{inner}</div>;
  }

  return (
    <Link href={href} className={wrapperClass}>
      {inner}
    </Link>
  );
}
