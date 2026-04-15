'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck, ArrowLeft, ExternalLink,
  Scale, Globe, Lock, AlertTriangle, DollarSign, Users,
  FileText, Zap, Ban, RefreshCw, Mail, Building2
} from 'lucide-react';

const EFFECTIVE_DATE = 'April 8, 2026';
const COMPANY        = 'Impressions & Impacts Ltd';
const PLATFORM       = 'Nested Ark OS';
const EMAIL          = 'nestedark@gmail.com';
const WEBSITE        = 'https://nested-ark-frontend.vercel.app';

const SECTIONS = [
  { id: 'acceptance',      label: 'Acceptance of Terms',         icon: Scale       },
  { id: 'platform',        label: 'Platform Description',        icon: Building2   },
  { id: 'eligibility',     label: 'Eligibility & Registration',  icon: Users       },
  { id: 'roles',           label: 'Operator Roles & Access',     icon: ShieldCheck },
  { id: 'financial',       label: 'Financial Services & Escrow', icon: DollarSign  },
  { id: 'fees',            label: 'Fees & Revenue',              icon: Zap         },
  { id: 'kyc',             label: 'KYC / AML Compliance',        icon: FileText    },
  { id: 'ip',              label: 'Intellectual Property',       icon: Lock        },
  { id: 'prohibited',      label: 'Prohibited Conduct',          icon: Ban         },
  { id: 'disclaimers',     label: 'Disclaimers & Liability',     icon: AlertTriangle },
  { id: 'indemnification', label: 'Indemnification',             icon: ShieldCheck },
  { id: 'governing',       label: 'Governing Law & Disputes',    icon: Globe       },
  { id: 'modifications',   label: 'Modifications & Termination', icon: RefreshCw   },
  { id: 'contact',         label: 'Contact Information',         icon: Mail        },
];

export default function TermsOfServicePage() {
  const [active, setActive] = useState('acceptance');
  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* ── Header ── */}
      <div className="border-b border-zinc-800 bg-black sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-teal-500 transition-colors">
              <ArrowLeft size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">Back</span>
            </Link>
            <div className="h-4 w-px bg-zinc-800" />
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative w-7 h-7 flex-shrink-0">
                <Image src="/nested_ark_icon.png" alt="Nested Ark OS" fill sizes="28px" priority className="object-contain" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.15em] hidden sm:block">
                Nested Ark <span className="text-teal-500">OS</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-zinc-600 font-mono uppercase hidden md:block">Effective {EFFECTIVE_DATE}</span>
            <Link href="/privacy" className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/40 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all">
              Privacy Policy <ExternalLink size={9} />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 flex gap-10">
        {/* ── Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-64 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-[0.3em] mb-4 pl-3">Contents</p>
            {SECTIONS.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[10px] font-bold uppercase tracking-wider transition-all ${active === s.id ? 'bg-teal-500/10 text-teal-500 border-l-2 border-teal-500' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900/40 border-l-2 border-transparent'}`}>
                  <Icon size={11} className="flex-shrink-0" />
                  <span className="line-clamp-1">{s.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 min-w-0 max-w-3xl">
          {/* Document hero */}
          <div className="pb-10 border-b border-zinc-800 mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-10 h-10 flex-shrink-0">
                <Image src="/nested_ark_icon.png" alt="Nested Ark OS" fill sizes="40px" className="object-contain" />
              </div>
              <div>
                <p className="text-[9px] text-teal-500 uppercase font-black tracking-[0.3em]">Nested Ark OS · Legal Document</p>
                <p className="text-[8px] text-zinc-600 font-mono uppercase">{COMPANY}</p>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic mb-4">Terms of Service</h1>
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-500 font-mono mb-6">
              <span>Effective: <strong className="text-white">{EFFECTIVE_DATE}</strong></span>
              <span>·</span>
              <span>Platform: <strong className="text-teal-500">{PLATFORM}</strong></span>
              <span>·</span>
              <span>Operator: <strong className="text-white">{COMPANY}</strong></span>
            </div>
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs leading-relaxed">
              <AlertTriangle size={12} className="inline mr-2" />
              <strong>Important:</strong> By using {PLATFORM}, you agree to be bound by these Terms. If you do not agree, do not use the platform. These terms constitute a legally binding agreement between you and {COMPANY}.
            </div>
          </div>

          <Sec id="acceptance" title="1. Acceptance of Terms" icon={Scale}>
            <p>These Terms of Service govern your access to and use of {PLATFORM}, operated by {COMPANY}, a technology company incorporated in Nigeria with operational presence in the United Kingdom and the United Arab Emirates.</p>
            <p>By creating an account, accessing the Platform, submitting a project, making an investment, or otherwise using any feature, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy, which is incorporated by reference.</p>
            <p>If you are using the Platform on behalf of an organisation, company, government agency, or financial institution, you represent that you have the authority to bind that entity to these Terms.</p>
            <p>We reserve the right to update these Terms at any time. Continued use after modification constitutes acceptance. For material changes, we will provide at least 30 days' notice via the Platform or registered email.</p>
          </Sec>

          <Sec id="platform" title="2. Platform Description" icon={Building2}>
            <p>{PLATFORM} is a real-time infrastructure investment and project management platform connecting developers, investors, contractors, suppliers, verifiers, financial institutions, and government agencies across Africa and globally.</p>
            <p>Core services:</p>
            <ul>
              <li><strong className="text-white">Project Marketplace:</strong> A publicly searchable registry of projects identified by NAP IDs, enabling transparent discovery and due diligence.</li>
              <li><strong className="text-white">Escrow Engine:</strong> Paystack-powered escrow holding investor capital in trust; released only upon successful tri-layer milestone verification.</li>
              <li><strong className="text-white">Tri-Layer Verification:</strong> AI-assisted, human-audited, and drone-captured verification — all three must pass before any escrow release.</li>
              <li><strong className="text-white">Immutable Ledger:</strong> SHA-256 hash-chained audit trail recording all platform events permanently.</li>
              <li><strong className="text-white">Multi-Role Command Centers:</strong> Purpose-built dashboards for all eight operator types.</li>
              <li><strong className="text-white">Currency Oracle:</strong> Hourly exchange rate feeds for NGN, GBP, USD, EUR, GHS, KES, ZAR, CAD, and AUD.</li>
            </ul>
            <p>The Platform is a technology intermediary — not a licensed financial institution, investment adviser, or regulated escrow agent in all jurisdictions. Nothing on the Platform constitutes financial advice.</p>
          </Sec>

          <Sec id="eligibility" title="3. Eligibility & Registration" icon={Users}>
            <p>To use the Platform you must:</p>
            <ul>
              <li>Be at least 18 years of age or the legal age of majority in your jurisdiction, whichever is higher.</li>
              <li>Have legal capacity to enter into binding contracts under the laws of your country of residence.</li>
              <li>Not be located in or a national of any country subject to UN, US OFAC, UK OFSI, EU, or Nigerian sanctions.</li>
              <li>Not be a Politically Exposed Person (PEP) without prior written disclosure to and approval from the Company.</li>
              <li>Not have been previously suspended or permanently banned from the Platform.</li>
            </ul>
            <p>You agree to provide accurate, current, and complete registration information and to maintain the confidentiality of your credentials. Notify us immediately at {EMAIL} if you suspect unauthorised account access.</p>
          </Sec>

          <Sec id="roles" title="4. Operator Roles & Access" icon={ShieldCheck}>
            <p>The Platform operates an eight-role access model:</p>
            <ul>
              <li><strong className="text-white">Developer / Owner:</strong> Responsible for accurate project information and authentic documentation. Bears primary liability for project representations.</li>
              <li><strong className="text-white">Investor:</strong> Accepts that investments carry risk, yields are indicative only, and capital may not be recovered. KYC required above platform thresholds.</li>
              <li><strong className="text-white">Contractor:</strong> Must submit genuine bids and perform works honestly. Fabricating verification evidence is grounds for immediate permanent ban and criminal referral.</li>
              <li><strong className="text-white">Verifier / Auditor:</strong> Must conduct genuine inspections and submit truthful reports. Collusion to fraudulently pass verification is a criminal matter.</li>
              <li><strong className="text-white">Supplier:</strong> Responsible for accurate dispatch records, genuine QR codes, and truthful delivery confirmations.</li>
              <li><strong className="text-white">Bank / Institution:</strong> Access institutional ledger data and capital analytics; must comply with applicable banking regulations.</li>
              <li><strong className="text-white">Government / Agency:</strong> Bears heightened responsibility for public project sponsorships and verifications.</li>
              <li><strong className="text-white">Administrator:</strong> System-assigned only. Bound by elevated confidentiality and fiduciary obligations.</li>
            </ul>
          </Sec>

          <Sec id="financial" title="5. Financial Services & Escrow" icon={DollarSign}>
            <p><strong className="text-white">Escrow Mechanism.</strong> All investor capital is held in Paystack escrow accounts. Funds are not held directly by {COMPANY}. Release requires unanimous tri-layer verification (AI + Human + Drone).</p>
            <p><strong className="text-white">No Guarantee of Returns.</strong> Projected yields (e.g., 12% p.a.) are indicative targets only and are not guaranteed. Infrastructure projects carry inherent risks including construction delays, cost overruns, regulatory changes, and contractor default.</p>
            <p><strong className="text-white">Capital at Risk.</strong> All committed capital is at risk and may not be recovered in full. Do not invest amounts you cannot afford to lose entirely.</p>
            <p><strong className="text-white">Milestone Payouts.</strong> A platform escrow fee (currently 2% of gross milestone value — the "System Maintenance & Insurance Levy") is automatically deducted at the point of release. This fee is non-refundable.</p>
            <p><strong className="text-white">Currency Risk.</strong> Multi-currency transactions are subject to foreign exchange fluctuations. The Company is not liable for currency-related losses.</p>
            <p><strong className="text-white">Paystack Terms.</strong> Payment processing is additionally subject to Paystack's own Terms of Service. The Company's Paystack merchant name is "Impressions and Impacts Ltd."</p>
          </Sec>

          <Sec id="fees" title="6. Fees & Revenue Model" icon={Zap}>
            <p>By using the Platform, you agree to the following fee structure:</p>
            <ul>
              <li><strong className="text-white">Escrow Service Fee (2%):</strong> Charged on every verified milestone payout, automatically deducted from the gross milestone allocation.</li>
              <li><strong className="text-white">Investment Placement Fee (0.5%):</strong> Charged to investors at capital commitment, covering KYC/AML processing and escrow administration.</li>
              <li><strong className="text-white">Supply Chain Commission (3%):</strong> Charged on supplier dispatch value processed through the Platform.</li>
              <li><strong className="text-white">Project Listing Fee ($49 USD flat):</strong> A one-time, non-refundable fee charged to Developers to list a project and generate a NAP ID.</li>
              <li><strong className="text-white">Verification-as-a-Service (VaaS):</strong> Enterprise/government subscriptions for private ledger access, priced per agreement.</li>
              <li><strong className="text-white">Sponsored Placements:</strong> Market Ticker sponsorships, clearly labelled "SPONSORED".</li>
            </ul>
            <p>The Company reserves the right to modify the fee structure with 30 days' written notice. Continued use after the effective date constitutes acceptance.</p>
          </Sec>

          <Sec id="kyc" title="7. KYC / AML Compliance" icon={FileText}>
            <p>The Platform complies with applicable AML, CTF, and KYC regulations including Nigeria's Money Laundering (Prevention and Prohibition) Act 2022, FATF Recommendations, UK Proceeds of Crime Act 2002, EU Anti-Money Laundering Directives (AMLD4/5/6), and US Bank Secrecy Act.</p>
            <p><strong className="text-white">KYC Verification.</strong> Investors above platform thresholds and all project Developers must submit a government-issued ID (NIN, BVN, Passport, Driver's Licence, or National ID). Verification typically takes 1–3 business days.</p>
            <p><strong className="text-white">Data Retention.</strong> KYC records are retained for a minimum of 5 years from the last transaction date.</p>
            <p><strong className="text-white">Suspicious Activity Reporting.</strong> The Company is legally required to report suspicious transactions to the NFIU (Nigeria), NCA (UK), and other relevant authorities. By using the Platform, you consent to such reporting where legally required.</p>
            <p><strong className="text-white">Sanctions Screening.</strong> All users and transactions are screened against international sanctions lists. Matching accounts will be immediately suspended and reported to relevant authorities.</p>
          </Sec>

          <Sec id="ip" title="8. Intellectual Property" icon={Lock}>
            <p><strong className="text-white">Platform IP.</strong> All Platform software, design, logos, trademarks, the NAP protocol, tri-layer verification methodology, and hash chain architecture are owned exclusively by {COMPANY} and protected under Nigerian, UK, UAE, and international intellectual property laws.</p>
            <p>You are granted a limited, non-exclusive, non-transferable, revocable licence to use the Platform for the purposes described in these Terms. You may not copy, reverse-engineer, distribute, sublicense, or create derivative works.</p>
            <p><strong className="text-white">User Content.</strong> You retain ownership of content you upload. By uploading, you grant the Company a worldwide, royalty-free licence to store, display, and process that content for platform operations. You warrant that all uploaded content is accurate, non-misleading, and does not infringe third-party rights.</p>
          </Sec>

          <Sec id="prohibited" title="9. Prohibited Conduct" icon={Ban}>
            <p>The following are expressly prohibited and may result in immediate account termination, civil action, and/or criminal referral:</p>
            <ul>
              <li>Submitting false, fraudulent, or misleading project information, financial data, or identity documents.</li>
              <li>Fabricating, manipulating, or staging verification evidence (photos, videos, drone footage, GPS data).</li>
              <li>Colluding with any other user to fraudulently pass the tri-layer verification gate.</li>
              <li>Using the Platform to launder money, finance terrorism, evade sanctions, or engage in unlawful financial activity.</li>
              <li>Creating multiple accounts to circumvent KYC, fees, bans, or platform limits.</li>
              <li>Attempting to reverse-engineer, scrape, or gain unauthorised access to the Platform's source code, database, or APIs.</li>
              <li>Introducing malware, viruses, or code designed to disrupt or harm the Platform or its users.</li>
              <li>Impersonating any person, entity, government agency, or financial institution.</li>
              <li>Circumventing the Platform's escrow controls, release mechanisms, or payment routing.</li>
            </ul>
          </Sec>

          <Sec id="disclaimers" title="10. Disclaimers & Limitation of Liability" icon={AlertTriangle}>
            <p><strong className="text-white">AS-IS Provision.</strong> The Platform is provided "as is" and "as available" without warranties of any kind, including implied warranties of merchantability, fitness for purpose, or uninterrupted operation.</p>
            <p><strong className="text-white">No Financial Advice.</strong> Nothing on the Platform constitutes investment, financial, legal, tax, or regulatory advice. Consult qualified professionals before any investment decision.</p>
            <p><strong className="text-white">Third-Party Services.</strong> The Platform integrates with Paystack, exchange rate providers, and drone services. The Company is not liable for failures in these third-party services.</p>
            <p><strong className="text-white">Limitation of Liability.</strong> The Company's total liability shall not exceed the greater of: (a) fees you paid to the Company in the 12 months preceding the claim; or (b) USD $100. The Company shall not be liable for indirect, incidental, special, or consequential damages.</p>
          </Sec>

          <Sec id="indemnification" title="11. Indemnification" icon={ShieldCheck}>
            <p>You agree to indemnify, defend, and hold harmless {COMPANY} and its directors, officers, employees, and agents from all claims, liabilities, damages, losses, costs, and expenses (including reasonable legal fees) arising from:</p>
            <ul>
              <li>Your use of the Platform or activities through your account.</li>
              <li>Your breach of these Terms or any applicable law.</li>
              <li>User Content or project information you submit.</li>
              <li>Any fraud, misrepresentation, or wilful misconduct by you.</li>
              <li>Disputes between you and another Platform user.</li>
            </ul>
          </Sec>

          <Sec id="governing" title="12. Governing Law & Dispute Resolution" icon={Globe}>
            <p><strong className="text-white">Governing Law.</strong> These Terms are governed by the laws of the Federal Republic of Nigeria. Applicable consumer protection laws in the UK, EU, or UAE are not displaced by this clause.</p>
            <p><strong className="text-white">Dispute Resolution.</strong> Disputes must first be submitted to {EMAIL} for 30 days of good-faith negotiation. If unresolved, disputes shall proceed to binding arbitration under the Lagos Court of Arbitration Rules, with Lagos, Nigeria as the seat.</p>
            <p><strong className="text-white">Class Action Waiver.</strong> To the extent permitted by applicable law, you waive any right to bring claims as a class member in any class action proceeding.</p>
            <p><strong className="text-white">Regulatory Complaints.</strong> Nothing prevents you from filing a complaint with a relevant regulatory authority (CBN, FCA, SEC, etc.) in your jurisdiction.</p>
          </Sec>

          <Sec id="modifications" title="13. Modifications & Termination" icon={RefreshCw}>
            <p><strong className="text-white">Modifications.</strong> We may modify these Terms at any time, providing 30 days' advance notice for material changes via email or Platform notice.</p>
            <p><strong className="text-white">Account Closure by You.</strong> Contact {EMAIL} to close your account. Pending verified payouts will be processed; unverified escrow balances may be held pending investigation.</p>
            <p><strong className="text-white">Suspension by Us.</strong> We may suspend or terminate your account immediately for breach of these Terms, prohibited conduct, or when required by law.</p>
            <p><strong className="text-white">Survival.</strong> Sections 8 (IP), 9 (Prohibited Conduct), 10 (Disclaimers), 11 (Indemnification), and 12 (Governing Law) survive termination.</p>
          </Sec>

          <Sec id="contact" title="14. Contact Information" icon={Mail}>
            <p>For legal enquiries, questions about these Terms, or to lodge a complaint:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
              {[
                { label: 'Email',    value: EMAIL,   mono: true  },
                { label: 'Platform', value: WEBSITE, mono: true  },
                { label: 'Company',  value: COMPANY, mono: false },
                { label: 'Offices',  value: 'Lagos · London · Dubai', mono: false },
              ].map(item => (
                <div key={item.label} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20">
                  <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1">{item.label}</p>
                  <p className={`text-sm text-teal-400 ${item.mono ? 'font-mono' : 'font-bold'}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </Sec>

          {/* Footer stamp */}
          <div className="mt-16 pt-8 border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-6 h-6 flex-shrink-0">
                <Image src="/nested_ark_icon.png" alt="Nested Ark OS" fill sizes="24px" className="object-contain opacity-60" />
              </div>
              <div className="text-[9px] text-zinc-600 font-mono">
                <p>© 2026 {COMPANY} · {PLATFORM}</p>
                <p>Terms v2.0 · Effective {EFFECTIVE_DATE}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[9px] text-zinc-600 font-mono">
              <Link href="/privacy" className="hover:text-teal-500 transition-colors uppercase tracking-widest">Privacy Policy</Link>
              <span>·</span>
              <a href={`mailto:${EMAIL}`} className="hover:text-teal-500 transition-colors">{EMAIL}</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Sec({ id, title, icon: Icon, children }: { id: string; title: string; icon: any; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 pb-10 mb-10 border-b border-zinc-900 last:border-0">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 flex-shrink-0">
          <Icon size={14} className="text-teal-500" />
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight">{title}</h2>
      </div>
      <div className="space-y-4 text-sm text-zinc-400 leading-relaxed [&_strong]:font-bold [&_p]:text-zinc-400 [&_ul]:space-y-2 [&_li]:flex [&_li]:gap-2 [&_li]:before:content-['→'] [&_li]:before:text-teal-500 [&_li]:before:flex-shrink-0 [&_li]:before:font-black [&_li]:before:text-xs [&_li]:before:mt-0.5">
        {children}
      </div>
    </section>
  );
}
