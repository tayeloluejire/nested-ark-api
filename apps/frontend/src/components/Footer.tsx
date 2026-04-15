'use client';
import Link from 'next/link';
import { Globe, Twitter, Linkedin, Mail, Shield, Database, TrendingUp, Github } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-black border-t border-zinc-800 pt-14 pb-8 px-6 mt-auto">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div className="space-y-4">
            <div>
              <h2 className="text-white font-black text-xl tracking-tighter uppercase">Nested Ark <span className="text-teal-500">OS</span></h2>
              <p className="text-[10px] text-teal-500 uppercase font-bold tracking-widest mt-1">Global Infrastructure Exchange</p>
            </div>
            <p className="text-zinc-500 text-sm leading-relaxed">Transparent ledgers, AI-driven verification, and automated escrow for infrastructure investment across Africa and beyond.</p>
            <p className="text-[9px] text-zinc-600 font-mono">A product of Impressions &amp; Impacts Ltd</p>
            <div className="flex items-center gap-3 pt-1">
              {[
                { href:'https://twitter.com/NestedArkOS', Icon: Twitter },
                { href:'https://linkedin.com/company/nested-ark', Icon: Linkedin },
                { href:'https://github.com/tayeloluejire/nested-ark-api', Icon: Github },
                { href:'mailto:nestedark@gmail.com', Icon: Mail },
              ].map(({ href, Icon }) => (
                <a key={href} href={href} target={href.startsWith('mailto')? undefined:'_blank'} rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-zinc-800 text-zinc-600 hover:text-teal-500 hover:border-teal-500/50 transition-all">
                  <Icon size={13}/>
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold mb-5 text-xs uppercase tracking-widest flex items-center gap-2"><TrendingUp size={12} className="text-teal-500"/> Platform</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              {[
                ['/portfolio','My Portfolio'],['/investments','Investment Nodes'],
                ['/milestones','Milestone Tracker'],['/ledger','Global Ledger'],
                ['/map','Infrastructure Map'],['/about','About Nested Ark'],
              ].map(([href,label]) => (
                <li key={href}><Link href={href} className="hover:text-teal-500 transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-5 text-xs uppercase tracking-widest flex items-center gap-2"><Shield size={12} className="text-teal-500"/> Access</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              {[
                ['/register','Register as Investor'],['/register','Register as Contractor'],
                ['/gov','Government Portal'],['/admin','Admin Command Center'],
                ['/kyc','KYC Verification'],['/verify-email','Email Verification'],
              ].map(([href,label],i) => (
                <li key={i}><Link href={href} className="hover:text-teal-500 transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-5 text-xs uppercase tracking-widest flex items-center gap-2"><Globe size={12} className="text-teal-500"/> Contact</h4>
            <div className="space-y-3 text-sm text-zinc-500 mb-5">
              <div className="flex items-center gap-2"><Mail size={12} className="text-teal-500 flex-shrink-0"/><a href="mailto:nestedark@gmail.com" className="hover:text-teal-500 transition-colors">nestedark@gmail.com</a></div>
              <div className="flex items-center gap-2"><Twitter size={12} className="text-teal-500 flex-shrink-0"/><a href="https://twitter.com/NestedArkOS" target="_blank" rel="noopener noreferrer" className="hover:text-teal-500 transition-colors">@NestedArk_OS</a></div>
              <div className="flex items-center gap-2"><Globe size={12} className="text-teal-500 flex-shrink-0"/><a href="https://iandi-studios.web.app" target="_blank" rel="noopener noreferrer" className="text-[10px] hover:text-teal-500 transition-colors">Impressions &amp; Impacts Ltd</a></div>
              <p className="text-zinc-600 text-[10px] font-mono">Lagos · London · Dubai</p>
            </div>
            <ul className="space-y-2 text-xs text-zinc-600">
              {[['/about','About Us'],['/terms','Terms of Service'],['/privacy','Privacy Policy']].map(([href,label]) => (
                <li key={href}><Link href={href} className="hover:text-zinc-400 transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5 py-5 border-t border-zinc-800 border-b border-zinc-800 mb-5">
          {[
            { icon: Shield,    label:'Tri-Layer Verification', desc:'AI + Human + Drone' },
            { icon: Database,  label:'Bulletproof Ledger',     desc:'SHA-256 Hash Chain' },
            { icon: TrendingUp,label:'Real-Time Escrow',       desc:'Atomic Multi-Sig Release' },
            { icon: Globe,     label:'Multi-Currency',         desc:'NGN · GHS · KES · EUR · GBP' },
          ].map(item => { const Icon = item.icon; return (
            <div key={item.label} className="flex items-center gap-2">
              <Icon size={11} className="text-teal-500 flex-shrink-0"/>
              <div><p className="text-[8px] text-white font-bold uppercase tracking-widest">{item.label}</p><p className="text-[7px] text-zinc-600">{item.desc}</p></div>
            </div>
          ); })}
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-[8px] text-zinc-700 uppercase tracking-[0.2em]">
          <span>© 2026 Impressions &amp; Impacts Ltd · Nested Ark OS. All Rights Reserved.</span>
          <span className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"/> Secured by Bulletproof Hash Chain v2.4</span>
        </div>
      </div>
    </footer>
  );
}
