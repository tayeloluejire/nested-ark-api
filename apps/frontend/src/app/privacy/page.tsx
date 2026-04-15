'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck, ArrowLeft, ExternalLink, Lock, Eye,
  Database, Globe, Users, RefreshCw, Mail, AlertTriangle,
  FileText, Cpu, Server, UserX, Download
} from 'lucide-react';

const EFFECTIVE_DATE = 'April 8, 2026';
const COMPANY        = 'Impressions & Impacts Ltd';
const PLATFORM       = 'Nested Ark OS';
const EMAIL          = 'nestedark@gmail.com';

const SECTIONS = [
  { id: 'overview',       label: 'Overview & Controller',      icon: ShieldCheck  },
  { id: 'data-collected', label: 'Data We Collect',            icon: Database     },
  { id: 'how-collected',  label: 'How We Collect Data',        icon: Eye          },
  { id: 'legal-basis',    label: 'Legal Basis for Processing', icon: FileText     },
  { id: 'how-used',       label: 'How We Use Your Data',       icon: Cpu          },
  { id: 'sharing',        label: 'Data Sharing & Disclosure',  icon: Users        },
  { id: 'international',  label: 'International Transfers',    icon: Globe        },
  { id: 'retention',      label: 'Data Retention',             icon: Server       },
  { id: 'security',       label: 'Security Measures',          icon: Lock         },
  { id: 'rights',         label: 'Your Rights',                icon: UserX        },
  { id: 'cookies',        label: 'Cookies & Tracking',         icon: Eye          },
  { id: 'children',       label: "Children's Privacy",         icon: AlertTriangle},
  { id: 'changes',        label: 'Changes to This Policy',     icon: RefreshCw    },
  { id: 'contact',        label: 'Contact & DPO',              icon: Mail         },
];

export default function PrivacyPolicyPage() {
  const [active, setActive] = useState('overview');
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
            <Link href="/terms" className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/40 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all">
              Terms of Service <ExternalLink size={9} />
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
            {/* Compliance badge */}
            <div className="mt-6 p-3 rounded-xl border border-teal-500/20 bg-teal-500/5 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={12} className="text-teal-500" />
                <p className="text-[9px] text-teal-500 font-black uppercase tracking-widest">Compliance</p>
              </div>
              {['NDPR (Nigeria)', 'GDPR (EU/UK)', 'DPA 2018 (UK)', 'CCPA (California)', 'POPIA (S. Africa)'].map(r => (
                <p key={r} className="text-[8px] text-zinc-500 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-teal-500 flex-shrink-0" />{r}
                </p>
              ))}
            </div>
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
            <div className="flex items-center gap-2 mb-3">
              <Lock size={14} className="text-teal-500" />
              <span className="text-[9px] text-teal-500 uppercase font-black tracking-[0.3em]">Your Privacy · Our Commitment</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic mb-4">Privacy Policy</h1>
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-500 font-mono mb-6">
              <span>Effective: <strong className="text-white">{EFFECTIVE_DATE}</strong></span>
              <span>·</span>
              <span>Controller: <strong className="text-white">{COMPANY}</strong></span>
              <span>·</span>
              <span>DPO: <strong className="text-teal-500">{EMAIL}</strong></span>
            </div>
            <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5 text-teal-400 text-xs leading-relaxed">
              <ShieldCheck size={12} className="inline mr-2" />
              {COMPANY} is committed to protecting your personal data. This Privacy Policy explains how we collect, process, store, share, and protect your data when you use {PLATFORM}. We comply with the Nigerian Data Protection Regulation (NDPR), UK/EU GDPR, and other applicable global privacy frameworks.
            </div>
          </div>

          <Sec id="overview" title="1. Overview & Data Controller" icon={ShieldCheck}>
            <p><strong className="text-white">Data Controller.</strong> {COMPANY} is the data controller responsible for your personal data processed through {PLATFORM}. We are incorporated in Nigeria and operate internationally, with legal presence in Lagos, London, and Dubai.</p>
            <p>As data controller, we determine the purposes and means by which personal data is processed. Where we engage third-party service providers, they act as data processors under data processing agreements obligating them to process data only according to our instructions.</p>
            <p><strong className="text-white">Scope.</strong> This policy applies to all personal data processed in connection with: your registration and use of the Platform; participation in any transaction, project, investment, or verification; your communications with us; and your use of our website and digital properties.</p>
            <p><strong className="text-white">Joint Controllership.</strong> For payment processing activities, {COMPANY} and Paystack Financial Services Ltd act as joint data controllers. Paystack's Privacy Policy applies in addition to this policy for all payment-related data.</p>
          </Sec>

          <Sec id="data-collected" title="2. Data We Collect" icon={Database}>
            <p>We collect personal data across the following categories:</p>
            <Sub>Identity & Account Data</Sub>
            <ul>
              <li>Full legal name, email address, phone number</li>
              <li>Operator role and account preferences</li>
              <li>Account credentials (passwords stored as bcrypt hashes — never in plaintext)</li>
              <li>Profile information, company name, and specialisation (for Contractors)</li>
            </ul>
            <Sub>KYC / Identity Verification Data</Sub>
            <ul>
              <li>Government-issued ID number (NIN, BVN, Passport, Driver's Licence)</li>
              <li>Date of birth, nationality, residential address, city, country</li>
              <li>Identity document images (uploaded via secure URL)</li>
              <li>KYC status, verification timestamps, and rejection reasons</li>
            </ul>
            <Sub>Financial & Transaction Data</Sub>
            <ul>
              <li>Investment amounts, project funding commitments, and transaction history</li>
              <li>Paystack payment references, access codes, and transaction statuses</li>
              <li>Escrow wallet balances and milestone payout records</li>
              <li>Platform fee records associated with your account</li>
            </ul>
            <Sub>Project & Activity Data</Sub>
            <ul>
              <li>Project submissions, NAP IDs, descriptions, budgets, and documentation</li>
              <li>Milestone evidence (photos, drone footage URLs, geo-coordinates)</li>
              <li>Bids submitted, proposals, and contractor work records</li>
              <li>Verification decisions, audit notes, and ledger hash records</li>
            </ul>
            <Sub>Technical & Usage Data</Sub>
            <ul>
              <li>IP address, browser type, operating system, device identifiers</li>
              <li>Pages visited, features used, and interaction patterns</li>
              <li>API request logs, error logs, and performance data</li>
              <li>Authentication tokens (JWT) and security logs</li>
            </ul>
          </Sec>

          <Sec id="how-collected" title="3. How We Collect Data" icon={Eye}>
            <p>We collect your personal data through the following means:</p>
            <ul>
              <li><strong className="text-white">Direct submission:</strong> When you register, complete KYC, submit a project, make an investment, or contact us.</li>
              <li><strong className="text-white">Automated collection:</strong> When you use the Platform, we automatically collect technical and usage data through server logs and API request records.</li>
              <li><strong className="text-white">Third-party sources:</strong> We may receive data from Paystack (payment confirmation), KYC verification providers, and sanctions screening services to fulfil our AML/KYC obligations.</li>
              <li><strong className="text-white">Verification processes:</strong> Drone footage URLs, geo-coordinates, and evidence submitted during tri-layer verification.</li>
              <li><strong className="text-white">Ledger recording:</strong> Platform events are automatically recorded in the immutable system ledger, including timestamps of transactions you initiate or participate in.</li>
            </ul>
          </Sec>

          <Sec id="legal-basis" title="4. Legal Basis for Processing" icon={FileText}>
            <p>Under the GDPR, UK GDPR, and NDPR, we process your data on the following legal bases:</p>
            <ul>
              <li><strong className="text-white">Contract performance (Art. 6(1)(b)):</strong> Processing necessary to provide the Platform services you have signed up for — account management, escrow operations, project listings, and milestone payouts.</li>
              <li><strong className="text-white">Legal obligation (Art. 6(1)(c)):</strong> Processing required to comply with AML, KYC, CTF, tax reporting, and other regulatory obligations under Nigerian, UK, EU, and international law.</li>
              <li><strong className="text-white">Legitimate interests (Art. 6(1)(f)):</strong> Processing for fraud prevention, security monitoring, platform integrity, and service improvement — where these interests are not overridden by your fundamental rights.</li>
              <li><strong className="text-white">Consent (Art. 6(1)(a)):</strong> Where we rely on consent (e.g., for optional marketing), you may withdraw at any time without affecting prior lawful processing.</li>
            </ul>
          </Sec>

          <Sec id="how-used" title="5. How We Use Your Data" icon={Cpu}>
            <Sub>Platform Operations</Sub>
            <ul>
              <li>Registering and managing your operator account and role permissions</li>
              <li>Processing investments, escrow deposits, milestone verifications, and payouts</li>
              <li>Issuing NAP project IDs and maintaining the project registry</li>
              <li>Recording all transactions in the immutable SHA-256 ledger</li>
              <li>Sending transactional notifications (payment confirmations, verification updates, reset links)</li>
            </ul>
            <Sub>Compliance & Security</Sub>
            <ul>
              <li>Conducting KYC identity verification and AML screening</li>
              <li>Screening against international sanctions, PEP, and watchlists</li>
              <li>Detecting, investigating, and preventing fraud and financial crime</li>
              <li>Maintaining audit trails for regulatory compliance</li>
              <li>Reporting to financial intelligence units as required by law</li>
            </ul>
            <Sub>Platform Improvement</Sub>
            <ul>
              <li>Analysing usage patterns to improve features and user experience</li>
              <li>Diagnosing technical issues and monitoring platform performance</li>
              <li>Conducting analytics on aggregate, anonymised data for business intelligence</li>
            </ul>
          </Sec>

          <Sec id="sharing" title="6. Data Sharing & Disclosure" icon={Users}>
            <p><strong className="text-white">We do not sell your personal data.</strong> We do not permit advertisers to target you individually. We share data only as described below:</p>
            <Sub>Service Providers (Data Processors)</Sub>
            <ul>
              <li><strong className="text-white">Paystack Financial Services Ltd:</strong> Payment processing, escrow management, and transaction verification. Bound by a data processing agreement.</li>
              <li><strong className="text-white">Supabase / PostgreSQL:</strong> Database hosting. Encrypted at rest and in transit.</li>
              <li><strong className="text-white">Render.com:</strong> Backend server hosting. GDPR-compliant data processing terms.</li>
              <li><strong className="text-white">Vercel:</strong> Frontend hosting. Subject to Vercel's GDPR-compliant data practices.</li>
              <li><strong className="text-white">Nodemailer / Gmail SMTP:</strong> Transactional email delivery. No marketing tracking pixels.</li>
            </ul>
            <Sub>Legal & Regulatory Disclosure</Sub>
            <ul>
              <li>Nigerian Financial Intelligence Unit (NFIU) — suspicious transaction reports</li>
              <li>UK National Crime Agency (NCA) — Suspicious Activity Reports</li>
              <li>OFAC, EU sanctions authorities, and equivalent bodies globally</li>
              <li>Courts, tribunals, and law enforcement when required by valid legal process</li>
            </ul>
            <Sub>Other Platform Users (Limited)</Sub>
            <ul>
              <li>Project sponsor name and project details — visible to all users browsing projects</li>
              <li>Contractor company name and specialisation — visible when bidding</li>
              <li>Milestone verification status and ledger hashes — visible to relevant project stakeholders</li>
            </ul>
            <p>We never share your private financial data, KYC documents, or account credentials with other users.</p>
          </Sec>

          <Sec id="international" title="7. International Data Transfers" icon={Globe}>
            <p>The Platform operates globally. Your data may be transferred to and processed in countries outside your country of residence, including Nigeria, the United Kingdom, and the United States (Vercel, Render infrastructure).</p>
            <p>Where we transfer data from the UK or EEA to countries without an adequacy decision, we implement appropriate safeguards including Standard Contractual Clauses (SCCs) and adequacy decisions where available.</p>
            <p>For Nigerian users, international transfers comply with the NDPR's requirements for cross-border data transfers. You may request details of specific safeguards in place by contacting {EMAIL}.</p>
          </Sec>

          <Sec id="retention" title="8. Data Retention" icon={Server}>
            <p>We retain personal data only as long as necessary to fulfil the purposes for which it was collected or as required by law:</p>
            <ul>
              <li><strong className="text-white">Account data:</strong> Duration of your account plus 7 years after closure, to comply with financial record-keeping obligations.</li>
              <li><strong className="text-white">KYC records:</strong> Minimum 5 years from the last transaction, as required by AML regulations.</li>
              <li><strong className="text-white">Transaction records & ledger entries:</strong> Permanently retained in the immutable ledger. Personal data is pseudonymised after the applicable retention period.</li>
              <li><strong className="text-white">Financial records:</strong> 7 years minimum, per Nigerian and UK tax and financial reporting requirements.</li>
              <li><strong className="text-white">Support records:</strong> 3 years from date of last interaction.</li>
              <li><strong className="text-white">Technical logs:</strong> 90 days for routine logs; 3 years for security-incident logs.</li>
              <li><strong className="text-white">Deleted account data:</strong> Within 30 days of account closure, data not subject to legal retention is purged from active systems.</li>
            </ul>
          </Sec>

          <Sec id="security" title="9. Security Measures" icon={Lock}>
            <Sub>Technical Controls</Sub>
            <ul>
              <li><strong className="text-white">Encryption at rest:</strong> All database content encrypted via Supabase's managed PostgreSQL with AES-256 encryption.</li>
              <li><strong className="text-white">Encryption in transit:</strong> All API communications use TLS 1.2+ (HTTPS). No plaintext data transmission.</li>
              <li><strong className="text-white">Password hashing:</strong> All passwords stored as bcrypt hashes with cost factor 12. No plaintext passwords are ever stored.</li>
              <li><strong className="text-white">JWT authentication:</strong> Session tokens use HS256 HMAC signing and expire after 24 hours.</li>
              <li><strong className="text-white">Immutable audit trail:</strong> All critical events are SHA-256 hash-chained in the system ledger, creating a tamper-evident record.</li>
              <li><strong className="text-white">Role-based access control:</strong> Eight distinct operator roles with granular permissions.</li>
            </ul>
            <Sub>Organisational Controls</Sub>
            <ul>
              <li>Principle of least privilege — staff access only data necessary for their function</li>
              <li>Regular security reviews and penetration testing</li>
              <li>Incident response plan with 72-hour breach notification protocol (GDPR Art. 33)</li>
            </ul>
            <p><strong className="text-white">Breach Notification.</strong> In the event of a personal data breach posing risk to your rights and freedoms, we will notify you without undue delay and notify the relevant supervisory authority within 72 hours of becoming aware.</p>
          </Sec>

          <Sec id="rights" title="10. Your Privacy Rights" icon={UserX}>
            <p>Depending on your jurisdiction, you have the following rights. We will respond to verified requests within 30 days:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-4">
              {[
                { right: 'Right of Access',          desc: 'Request a copy of all personal data we hold about you (Subject Access Request).', tag: 'GDPR · NDPR · CCPA' },
                { right: 'Right to Rectification',   desc: 'Request correction of inaccurate or incomplete personal data.',                    tag: 'GDPR · NDPR' },
                { right: 'Right to Erasure',         desc: '"Right to be forgotten" — request deletion where there is no overriding legal purpose to retain.', tag: 'GDPR · NDPR' },
                { right: 'Right to Restriction',     desc: 'Request that we restrict processing of your data in certain circumstances.',       tag: 'GDPR' },
                { right: 'Right to Data Portability', desc: 'Receive your data in a structured, machine-readable format.',                    tag: 'GDPR · UK GDPR' },
                { right: 'Right to Object',          desc: 'Object to processing based on legitimate interests, including profiling.',        tag: 'GDPR · NDPR' },
                { right: 'Right to Opt-Out of Sale', desc: 'We do not sell personal data. California residents may submit a "Do Not Sell" request.', tag: 'CCPA' },
                { right: 'Non-Discrimination',       desc: 'We will not discriminate against you for exercising any privacy rights.',         tag: 'CCPA · POPIA' },
              ].map(item => (
                <div key={item.right} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20">
                  <p className="text-[9px] text-zinc-600 font-mono mb-1">{item.tag}</p>
                  <p className="text-sm font-bold text-white mb-1">{item.right}</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
            <p><strong className="text-white">How to Exercise Rights.</strong> Send your request to {EMAIL} with the subject "Privacy Rights Request", including your registered email, the right you wish to exercise, and any relevant details. We may need to verify your identity before processing.</p>
            <p><strong className="text-white">Supervisory Authorities.</strong> You may lodge a complaint with: NITDA (Nigeria), ICO (UK), your national DPA (EU), Information Regulator (South Africa), or CPPA (California, USA).</p>
          </Sec>

          <Sec id="cookies" title="11. Cookies & Tracking Technologies" icon={Eye}>
            <p>The Platform uses minimal browser storage technologies:</p>
            <ul>
              <li><strong className="text-white">Authentication token (localStorage):</strong> A JWT stored in your browser's localStorage to maintain your logged-in session. Strictly necessary for platform functionality. No third-party tracking involved.</li>
              <li><strong className="text-white">Currency preference (localStorage):</strong> Your selected display currency stored locally for user experience continuity. No server-side tracking.</li>
              <li><strong className="text-white">Vercel Analytics:</strong> Where enabled, aggregated and anonymised page view data only. No individual user profiling.</li>
            </ul>
            <p>We do not use third-party advertising cookies, cross-site tracking pixels, Facebook Pixel, or Google Analytics with user identification. We do not track you across other websites.</p>
          </Sec>

          <Sec id="children" title="12. Children's Privacy" icon={AlertTriangle}>
            <p>The Platform is strictly intended for users aged 18 and over. We do not knowingly collect personal data from minors.</p>
            <p>If we become aware that a person under 18 has created an account or submitted personal data, we will immediately suspend the account and delete the data. Report suspected minor accounts to {EMAIL} with the subject "Minor Account Report."</p>
          </Sec>

          <Sec id="changes" title="13. Changes to This Policy" icon={RefreshCw}>
            <p>We review and update this Privacy Policy regularly. The effective date at the top indicates when it was last revised.</p>
            <p><strong className="text-white">Material changes</strong> (new data categories, new sharing arrangements, changes to your rights) will be communicated by: (a) prominent Platform notice for at least 30 days; (b) email notification to your registered address.</p>
            <p><strong className="text-white">Non-material changes</strong> (clarifications, corrections) may be made without formal notice. Prior versions are available on request at {EMAIL}.</p>
          </Sec>

          <Sec id="contact" title="14. Contact & Data Protection Officer" icon={Mail}>
            <p>For all privacy-related enquiries, data subject access requests, complaints, or to exercise your rights:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
              {[
                { label: 'Privacy & DPO Email',   value: EMAIL,   mono: true  },
                { label: 'Legal Name',             value: COMPANY, mono: false },
                { label: 'NDPR Registration',      value: 'Registered with NITDA Nigeria', mono: false },
                { label: 'Registered Presence',    value: 'Lagos · London · Dubai', mono: false },
                { label: 'Response Time',          value: '1–3 business days standard · 72h urgent', mono: false },
                { label: 'Subject Line',           value: '"Privacy Rights Request"', mono: true },
              ].map(item => (
                <div key={item.label} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20">
                  <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1">{item.label}</p>
                  <p className={`text-sm text-teal-400 ${item.mono ? 'font-mono' : 'font-bold'}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <p>Supervisory authorities by jurisdiction:</p>
            <ul>
              <li><strong className="text-white">Nigeria:</strong> NITDA — nitda.gov.ng</li>
              <li><strong className="text-white">UK:</strong> Information Commissioner's Office (ICO) — ico.org.uk</li>
              <li><strong className="text-white">EU:</strong> Your national Data Protection Authority — edpb.europa.eu</li>
              <li><strong className="text-white">South Africa:</strong> Information Regulator — inforegulator.org.za</li>
              <li><strong className="text-white">California (USA):</strong> CPPA — cppa.ca.gov</li>
            </ul>
            {/* PDF download */}
            <div className="mt-6 p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-bold text-white">Save a copy of this policy</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Print or save as PDF using your browser's print function</p>
              </div>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-black font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
                <Download size={12} /> Save as PDF
              </button>
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
                <p>Privacy Policy v2.0 · Effective {EFFECTIVE_DATE}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[9px] text-zinc-600 font-mono">
              <Link href="/terms" className="hover:text-teal-500 transition-colors uppercase tracking-widest">Terms of Service</Link>
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

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="!text-white font-black text-xs uppercase tracking-widest pt-2 pb-1 border-b border-zinc-800/60">{children}</p>;
}
