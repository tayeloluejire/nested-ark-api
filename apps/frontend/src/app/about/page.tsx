'use client';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Shield, Globe, TrendingUp, Database, Users, Building2,
  CheckCircle2, ArrowUpRight, Zap, Lock, Eye, ChevronRight
} from 'lucide-react';

const TEAM_VALUES = [
  { icon: Shield,    title: 'Bulletproof Security',   desc: 'Every transaction is protected by tri-layer verification — AI, human audit, and drone capture — before a single kobo is released.' },
  { icon: Globe,     title: 'Global by Design',        desc: 'Built for Africa, designed for the world. Multi-currency, geo-aware, and accessible to investors from Lagos to London to Dubai.' },
  { icon: Database,  title: 'Immutable Transparency',  desc: 'Every event — investment, verification, payout — is logged in an immutable SHA-256 hash chain that no one can alter or delete.' },
  { icon: Zap,       title: 'Real-Time Capital Flow',  desc: 'Paystack-powered escrow moves real money instantly. No intermediaries, no delays — automated release the moment verification passes.' },
];

const PLATFORM_STATS = [
  { label: 'Verification Layers', value: '3', desc: 'AI + Human + Drone' },
  { label: 'Currencies Supported', value: '9+', desc: 'NGN, GHS, KES, EUR, GBP…' },
  { label: 'API Endpoints', value: '70+', desc: 'Full REST infrastructure' },
  { label: 'Ledger Integrity', value: '100%', desc: 'SHA-256 hash chain' },
];

const ROADMAP = [
  { phase: 'Phase 1', title: 'Core Infrastructure OS', status: 'LIVE', items: ['Multi-role authentication', 'Escrow engine', 'Tri-layer verification', 'Global ledger'] },
  { phase: 'Phase 2', title: 'Capital Markets Layer', status: 'LIVE', items: ['Paystack payment gateway', 'Real-time currency oracle', 'Investor portfolio dashboard', 'KYC/AML compliance'] },
  { phase: 'Phase 3', title: 'Ecosystem Expansion', status: 'IN PROGRESS', items: ['Supply chain integration', 'Bank capital partners', 'Satellite + drone sync', 'Mobile operator app'] },
  { phase: 'Phase 4', title: 'Global Exchange', status: 'PLANNED', items: ['Blockchain ledger anchoring', 'Tokenized project ownership', 'Secondary market trading', 'International regulatory compliance'] },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.3em]">About the Platform</div>
            <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-tight">
              The Global Ledger for Physical Infrastructure
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Nested Ark OS is a real-time infrastructure investment and management platform — connecting government project sponsors, institutional investors, contractors, and supply chain partners through a single, bulletproof operating system.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/register" className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold uppercase text-xs tracking-widest rounded-xl hover:bg-teal-500 transition-all">
                Join the Network <ArrowUpRight size={12} />
              </Link>
              <Link href="/investments" className="flex items-center gap-2 px-6 py-3 border border-zinc-700 text-white font-bold uppercase text-xs tracking-widest rounded-xl hover:border-teal-500 transition-all">
                Browse Projects
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {PLATFORM_STATS.map(stat => (
              <div key={stat.label} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 text-center">
                <p className="text-4xl font-black text-teal-500 font-mono">{stat.value}</p>
                <p className="text-[9px] text-white font-bold uppercase tracking-widest mt-1">{stat.label}</p>
                <p className="text-[8px] text-zinc-600 mt-0.5">{stat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Core Values */}
        <section className="border-t border-zinc-800 bg-zinc-900/20 py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-14 space-y-3">
              <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.3em]">Our Principles</p>
              <h2 className="text-3xl font-black uppercase tracking-tighter">Built on Four Pillars</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {TEAM_VALUES.map(v => (
                <div key={v.title} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
                  <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 w-fit">
                    <v.icon size={18} className="text-teal-500" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-tight">{v.title}</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-7xl mx-auto px-6 py-20 space-y-14">
          <div className="text-center space-y-3">
            <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.3em]">The System</p>
            <h2 className="text-3xl font-black uppercase tracking-tighter">How Nested Ark Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                role: 'Government / Sponsor',
                icon: Building2,
                title: 'Create & Verify Projects',
                desc: 'Government agencies and project sponsors create infrastructure projects on the platform. Each project receives an immutable SHA-256 verification hash upon government authorization.',
                color: 'teal',
              },
              {
                step: '02',
                role: 'Investors',
                icon: TrendingUp,
                title: 'Fund via Secure Escrow',
                desc: 'Investors browse verified infrastructure nodes and commit capital through the Paystack-powered escrow engine. Funds are locked until each milestone passes tri-layer verification.',
                color: 'white',
              },
              {
                step: '03',
                role: 'Contractors',
                icon: Users,
                title: 'Execute & Submit Evidence',
                desc: 'Contractors execute works and submit photographic and drone evidence. The AI validator, human auditor, and drone capture must all confirm progress before any fund release occurs.',
                color: 'white',
              },
            ].map(item => (
              <div key={item.step} className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className={`text-5xl font-black font-mono ${item.color === 'teal' ? 'text-teal-500/30' : 'text-zinc-700'}`}>{item.step}</span>
                  <div className={`p-2 rounded-lg ${item.color === 'teal' ? 'bg-teal-500/10' : 'bg-zinc-800'}`}>
                    <item.icon size={16} className={item.color === 'teal' ? 'text-teal-500' : 'text-zinc-400'} />
                  </div>
                </div>
                <div>
                  <p className="text-[9px] text-teal-500 uppercase font-bold tracking-widest">{item.role}</p>
                  <h3 className="text-lg font-bold uppercase tracking-tight mt-1">{item.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed mt-2">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* About Impressions & Impacts Ltd */}
        <section className="border-t border-zinc-800 bg-gradient-to-b from-zinc-900/30 to-transparent py-20">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div>
                <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.3em] mb-2">The Company Behind the Platform</p>
                <h2 className="text-3xl font-black uppercase tracking-tighter">Impressions &amp; Impacts Ltd</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Impressions &amp; Impacts Ltd is a technology innovation company incorporated to conceptualize, develop, and deliver high-impact digital products for the African and global markets.
              </p>
              <p className="text-zinc-500 text-sm leading-relaxed">
                From creative technology and web applications to enterprise platforms, our studio builds solutions at the intersection of design, engineering, and human impact. Nested Ark OS is our flagship infrastructure platform — designed to transform how capital flows into physical development across the continent.
              </p>
              <div className="space-y-2">
                {[
                  'Web, app, and creative technology products',
                  'Enterprise platform engineering',
                  'AI-powered verification and automation systems',
                  'Cross-border payment and escrow infrastructure',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-zinc-400">
                    <CheckCircle2 size={12} className="text-teal-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex gap-4 flex-wrap">
                <a href="https://iandi-studios.web.app" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-3 border border-zinc-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl hover:border-teal-500 transition-all">
                  <Globe size={12} /> iandi-studios.web.app <ArrowUpRight size={10} />
                </a>
                <a href="mailto:nestedark@gmail.com"
                  className="flex items-center gap-2 px-5 py-3 border border-zinc-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl hover:border-teal-500 transition-all">
                  Contact Us
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Founded', value: '2020', sub: 'Lagos, Nigeria' },
                { label: 'Products', value: '5+', sub: 'Live digital products' },
                { label: 'Markets', value: '3', sub: 'Lagos · London · Dubai' },
                { label: 'Focus', value: 'Impact', sub: 'Technology for growth' },
              ].map(item => (
                <div key={item.label} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 text-center">
                  <p className="text-3xl font-black text-white font-mono">{item.value}</p>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mt-1">{item.label}</p>
                  <p className="text-[8px] text-zinc-600 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section className="max-w-7xl mx-auto px-6 py-20 space-y-10">
          <div className="text-center space-y-3">
            <p className="text-[9px] text-teal-500 uppercase font-bold tracking-[0.3em]">What's Next</p>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Platform Roadmap</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ROADMAP.map(phase => (
              <div key={phase.phase} className={`p-6 rounded-2xl border space-y-4 ${
                phase.status === 'LIVE' ? 'border-teal-500/30 bg-teal-500/5' :
                phase.status === 'IN PROGRESS' ? 'border-amber-500/20 bg-amber-500/5' :
                'border-zinc-800 bg-zinc-900/20'
              }`}>
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{phase.phase}</p>
                  <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                    phase.status === 'LIVE' ? 'border-teal-500/40 text-teal-500' :
                    phase.status === 'IN PROGRESS' ? 'border-amber-500/40 text-amber-400' :
                    'border-zinc-700 text-zinc-500'
                  }`}>{phase.status}</span>
                </div>
                <h3 className="text-sm font-bold uppercase tracking-tight">{phase.title}</h3>
                <ul className="space-y-1.5">
                  {phase.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-[10px] text-zinc-500">
                      <ChevronRight size={10} className={`mt-0.5 flex-shrink-0 ${phase.status === 'LIVE' ? 'text-teal-500' : 'text-zinc-600'}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-800 bg-zinc-900/20 py-20">
          <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
            <h2 className="text-4xl font-black uppercase tracking-tighter italic">Ready to Join the Infrastructure Revolution?</h2>
            <p className="text-zinc-400">Whether you're a government agency, institutional investor, contractor, or supply chain partner — there's a node for you in the Nested Ark ecosystem.</p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/register" className="flex items-center gap-2 px-8 py-4 bg-white text-black font-black uppercase text-xs tracking-[0.2em] rounded-xl hover:bg-teal-500 transition-all">
                Apply for Access <ArrowUpRight size={12} />
              </Link>
              <Link href="/map" className="flex items-center gap-2 px-8 py-4 border border-zinc-700 text-white font-bold uppercase text-xs tracking-widest rounded-xl hover:border-teal-500 transition-all">
                View Infrastructure Map
              </Link>
            </div>
            <p className="text-[9px] text-zinc-600 font-mono">nestedark@gmail.com · Lagos · London · Dubai · A product of Impressions &amp; Impacts Ltd</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
