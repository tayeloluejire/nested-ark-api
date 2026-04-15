'use client';
import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export type Theme = 'dark' | 'light';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem('ark-theme') as Theme) || 'dark';
}

export function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem('ark-theme', theme);
  // Dispatch custom event so other components can react
  window.dispatchEvent(new Event('theme-change'));
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = getStoredTheme();
    setTheme(saved);
    applyTheme(saved);
    setMounted(true);

    const handleThemeEvent = () => setTheme(getStoredTheme());
    window.addEventListener('theme-change', handleThemeEvent);
    return () => window.removeEventListener('theme-change', handleThemeEvent);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  };

  if (!mounted) return (
    <div className={`${compact ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse`} />
  );

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`
        relative flex items-center justify-center rounded-lg border transition-all duration-300
        ${compact ? 'w-8 h-8' : 'w-9 h-9'}
        ${isDark
          ? 'border-zinc-800 bg-zinc-900/50 text-amber-400 hover:border-amber-400/50 hover:bg-amber-400/5'
          : 'border-slate-300 bg-slate-100 text-slate-800 hover:border-teal-500 shadow-sm'
        }
      `}
    >
      <span className={`transition-all duration-500 ${isDark ? 'rotate-0 scale-100' : 'rotate-180 scale-0 opacity-0 absolute'}`}>
        <Sun size={compact ? 13 : 15} />
      </span>
      <span className={`transition-all duration-500 ${!isDark ? 'rotate-0 scale-100' : 'rotate-180 scale-0 opacity-0 absolute'}`}>
        <Moon size={compact ? 13 : 15} />
      </span>
    </button>
  );
}