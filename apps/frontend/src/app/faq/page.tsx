'use client';
export const dynamic = 'force-dynamic';

/**
 * src/app/faq/page.tsx
 * Nested Ark OS — Frequently Asked Questions
 * Covers all stakeholder roles: Tenant, Landlord, Investor, Diaspora,
 * Developer, Contractor, Government.
 * Fully searchable, category-filtered, accordion layout.
 */

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  ChevronDown, Search, Home, Wallet, Building2, Globe,
  HardHat, Gavel, ShieldCheck, DollarSign, Users,
  FileText, Lock, TrendingUp, Bell, ArrowRight, X,
} from 'lucide-react';

// ── FAQ Data ──────────────────────────────────────────────────────────────────
type FAQItem = {
  q: string;
  a: string | React.ReactNode;
  tags?: string[];
};

type FAQCategory = {
  id:    string;
  label: string;
  icon:  React.ElementType;
  color: string;
  bg:    string;
  items: FAQItem[];
};

const CATEGORIES: FAQCategory[] = [
  {
    id:    'general',
    label: 'General',
    icon:  Globe,
    color: 'text-teal-400',
    bg:    'bg-teal-500/10 border-teal-500/20',
    items: [
      {
        q: 'What is Nested Ark OS?',
        a: 'Nested Ark OS is a global infrastructure and housing operating system built by Impressions & Impacts Ltd. It provides programmable escrow, rent automation, milestone-based construction funding, tenant savings vaults, and landlord payout infrastructure — all secured by SHA-256 ledger technology and Paystack\'s payment rails. It operates across 12+ countries.',
      },
      {
        q: 'Who is Nested Ark OS for?',
        a: 'The platform serves seven types of stakeholders: Landlords (rent automation & tenant management), Tenants (independent savings vaults & rent payments), Investors (fractional infrastructure investment), Diaspora developers (remote construction tracking), Infrastructure developers (project funding & milestone escrow), Contractors (milestone delivery & bidding), and Government regulators (permit verification & compliance dashboards).',
      },
      {
        q: 'Is my money safe on the platform?',
        a: 'Yes. All funds are held in Paystack-regulated escrow — never in a general pool. Each payment is SHA-256 hashed on the immutable Nested Ark ledger and court-admissible. Funds are only released when verified milestone conditions or savings targets are met. Nested Ark never holds or touches your money directly — Paystack\'s regulated infrastructure acts as the custodian.',
      },
      {
        q: 'Which countries does Nested Ark OS operate in?',
        a: 'Nested Ark OS is currently active across 12+ countries with primary infrastructure in Nigeria (Lagos), UK (London), and UAE (Dubai). The platform supports multi-currency transactions: NGN, GHS, KES, EUR, and GBP, with more currencies being added. Paystack\'s rails handle cross-border settlement.',
      },
      {
        q: 'How does the SHA-256 ledger work?',
        a: 'Every payment event, contract action, and receipt is cryptographically hashed using SHA-256 and written to the Nested Ark immutable ledger. This means records cannot be altered retroactively. Each receipt carries a unique hash that can be verified independently — making all records court-admissible evidence in the event of a dispute.',
      },
      {
        q: 'Is Nested Ark OS a bank?',
        a: 'No. Nested Ark OS is a programmable infrastructure platform. It does not hold deposits or issue loans. All financial transactions are processed by Paystack, a CBN-licensed payment processor. Nested Ark provides the orchestration layer — automating when, how, and to whom funds move based on verified conditions.',
      },
    ],
  },
  {
    id:    'tenant',
    label: 'Tenants',
    icon:  Home,
    color: 'text-green-400',
    bg:    'bg-green-500/10 border-green-500/20',
    items: [
      {
        q: 'Can I join Nested Ark without a landlord invite?',
        a: 'Yes. You can create an independent tenant account directly from the registration page or the "Tenant" button on the homepage. This gives you a standalone savings identity — you can set a rent target, choose your payment rhythm, and browse marketplace properties. Your vault activates when you link to a property. No landlord is required to get started.',
      },
      {
        q: 'What is the Flex-Pay Vault?',
        a: 'The Flex-Pay Vault is your personal rent savings account held in Paystack escrow. Instead of paying a large annual lump sum, you contribute weekly, monthly, or quarterly. Your vault accumulates contributions and automatically disburses to your landlord\'s registered bank account when it reaches 100% of the agreed target. You receive a SHA-256 receipt for every contribution.',
      },
      {
        q: 'How do I set my payment rhythm?',
        a: 'During onboarding or from your tenant dashboard, you can choose Weekly (52 payments/year), Monthly (12 payments/year), or Quarterly (4 payments/year). The platform calculates your installment amount automatically based on your target rent and frequency. You can see a live preview before confirming.',
      },
      {
        q: 'What happens when my vault reaches 100%?',
        a: 'When your vault is fully funded, it enters FUNDED_READY status. The platform automatically initiates a Paystack transfer to your landlord\'s verified bank account within 24 hours. You receive a final settlement receipt. Your vault then resets for the next rental cycle if applicable.',
      },
      {
        q: 'Can I add my landlord\'s bank account after registration?',
        a: 'Yes. You can add or update your landlord\'s payout destination at any time from your tenant dashboard. The platform will verify the account via Paystack in the background — this process takes a few seconds and never blocks your ability to save. If verification fails due to network issues, you can retry or enter the details manually.',
      },
      {
        q: 'What is my Tenant Score and why does it matter?',
        a: 'Your Tenant Score is a portable reputation metric (0–100) built from your payment consistency, vault discipline, and ledger history. It travels with you across properties — a strong score makes it easier to be approved for premium listings on the marketplace. Landlords can see your score when you apply for a unit. Every on-time installment improves your score.',
      },
      {
        q: 'Can I browse and apply for properties directly?',
        a: 'Yes. The marketplace at /marketplace lists verified vacant properties for rent and sale. You can filter by type, location, and price. When you find a property you want, click "Setup Vault" to initiate your savings toward that unit. If you\'re already authenticated, you go straight to the pay page. If not, you\'re prompted to create an account first.',
      },
      {
        q: 'What do legal notices mean and what should I do?',
        a: 'Legal notices are formal communications from your landlord — typically Notice to Pay (rent arrears), Notice to Quit, or Final Warning. Each notice is SHA-256 signed, timestamped, and emailed as a PDF. If you receive one, navigate to My Notices, read the response deadline, and make a payment immediately via the Pay Installment button. Resolving the outstanding balance removes the active notice status.',
      },
      {
        q: 'Can I download my payment receipts?',
        a: 'Yes. Every contribution generates a digital receipt downloadable as HTML or PDF from the My Contributions page. Each receipt includes: tenant name, unit details, amount paid, date, Paystack reference, and your SHA-256 ledger hash. These are court-admissible documents.',
      },
      {
        q: 'What happens if I change my mind before the vault is fully funded?',
        a: 'Before a vault reaches FUNDED_READY status, tenants may request a withdrawal or reassignment subject to platform policy, applicable escrow rules, and any linked tenancy agreement. Depending on the vault state, processing fees or cooling periods may apply. Once a landlord payout has been triggered and the transfer completed, it cannot be reversed except through formal dispute resolution. Contact support at nestedark@gmail.com for assistance.',
      },
      {
        q: 'Can I save toward a property before it becomes available?',
        a: 'Yes. Independent vaults can be created before tenancy linkage. This allows you to build savings progressively while monitoring target properties on the marketplace. Once a unit becomes available or an invite link is received from a landlord, your vault links instantly — without restarting the savings cycle. Your contributions and history are fully preserved.',
      },
      {
        q: 'Does my vault history move with me if I relocate?',
        a: 'Yes. Nested Ark OS creates a portable tenant financial identity. Your vault history, contribution discipline, SHA-256 receipts, and Tenant Score remain attached to your account — not to a specific property. You carry your financial reputation across landlords, cities, and countries. A strong track record on the platform makes approvals faster wherever you move.',
      },
      {
        q: 'Are all marketplace properties verified?',
        a: 'Nested Ark OS supports both platform-verified and self-listed properties. Verified listings undergo identity checks, ownership review, location validation, and documentation screening before receiving a verification badge. Unverified listings are clearly marked. Users should always review listing status and verification level before making financial commitments. We recommend contacting the landlord directly for any clarification before activating a vault.',
      },
    ],
  },
  {
    id:    'landlord',
    label: 'Landlords',
    icon:  Building2,
    color: 'text-teal-400',
    bg:    'bg-teal-500/10 border-teal-500/20',
    items: [
      {
        q: 'How do I list a property and invite a tenant?',
        a: 'From the Landlord Command panel or /onboard, add your property details. Once a unit is created, you get a unique shareable invite link. Send it to your tenant via WhatsApp, email, or any channel. The tenant clicks the link, creates an account (or logs in), and their Flex-Pay vault is automatically linked to your unit.',
      },
      {
        q: 'When do I receive rent payment?',
        a: 'You receive rent when the tenant\'s vault reaches 100% of the agreed target amount. The platform automatically initiates a Paystack bank transfer to your registered bank account. You do not need to request it — the release is fully automated. You can set cashout mode to Lump Sum (full amount at once) or Drawdown (monthly disbursements from the vault).',
      },
      {
        q: 'How do I register my bank account for payout?',
        a: 'Navigate to Landlord → Bank Accounts (/landlord/bank). Enter your bank name, account number, and bank code. The platform verifies your account live via Paystack\'s resolve-account API and creates a Paystack subaccount and transfer recipient in the background. This payout rail is how rent reaches your account automatically.',
      },
      {
        q: 'How do legal notices work?',
        a: 'From the Legal Notices section (/landlord/notices), you can generate Notice to Pay, Notice to Quit, or Final Warning documents for any tenant with outstanding rent. Each notice is SHA-256 signed, timestamped, and emailed as a PDF to the tenant. The platform tracks served/resolved status. If escalation is needed, the evidence trail is fully court-admissible.',
      },
      {
        q: 'What is the Rent Dashboard?',
        a: 'The Rent Dashboard (/landlord/rent-dashboard) is your live yield engine. It shows every vault\'s status, funded percentage, overdue alerts, next due dates, and total rent roll across all your properties in real time. It aggregates data from all active tenancies so you can spot overdue vaults instantly without checking each property individually.',
      },
      {
        q: 'What does the Inventory Matrix do?',
        a: 'The Inventory Matrix (/landlord/inventory) is your full property portfolio manager. It shows all units — occupied, vacant, and listed. From here you can edit unit specs, upload photos, mark units as available for marketplace listing, and see occupancy rates. The Unit Editor (/landlord/inventory/editor) allows granular changes to individual units.',
      },
      {
        q: 'What is the 2% platform fee?',
        a: 'Nested Ark OS charges a 2% platform fee on each vault disbursement — deducted automatically at the point of payout, not during contributions. For example, if a tenant\'s vault reaches ₦1,200,000, the landlord receives ₦1,176,000 and ₦24,000 goes to the platform. There are no monthly subscription fees or hidden charges.',
      },
    ],
  },
  {
    id:    'investor',
    label: 'Investors',
    icon:  TrendingUp,
    color: 'text-amber-400',
    bg:    'bg-amber-500/10 border-amber-500/20',
    items: [
      {
        q: 'What can I invest in on Nested Ark OS?',
        a: 'Investors can participate in fractional infrastructure investment across verified NAP (Nested Ark Protocol) projects — residential buildings, commercial developments, solar installations, road infrastructure, and more. Each project has a unique NAP ID and a milestone-based escrow structure. Capital is released progressively as verified milestones complete, with projected distributions benchmarked to prevailing market reference rates plus a project-specific infrastructure premium.',
      },
      {
        q: 'How is my investment protected?',
        a: 'All investor capital is held in Paystack milestone escrow — never released to a developer until the corresponding milestone is independently verified by the Tri-Layer system: AI analysis + human auditor + drone footage. All three must confirm before any capital is disbursed. This prevents fraud and ensures funds only flow for verified work.',
      },
      {
        q: 'What is Tri-Layer Verification?',
        a: 'Tri-Layer Verification is Nested Ark\'s proprietary milestone authentication system. Every construction milestone must pass three independent checks: (1) AI image analysis of submitted photos, (2) a human auditor review, and (3) drone footage verification of the site. Only when all three agree does the escrow release trigger. This makes milestone fraud near-impossible.',
      },
      {
        q: 'How are investor returns determined?',
        a: 'Nested Ark OS uses a market-linked infrastructure yield model rather than arbitrary fixed return promises. Projected distributions are benchmarked against prevailing macroeconomic reference rates — such as government bond yields, treasury instruments, and institutional fixed-deposit markets — with an additional infrastructure premium applied based on project complexity, geography, execution profile, and asset class.',
      },
      {
        q: 'Why not offer a fixed guaranteed return?',
        a: 'Infrastructure projects operate within real economic environments influenced by inflation, central bank rates, material pricing, and construction execution conditions. Using a dynamic benchmark-linked model allows the platform to remain economically sustainable, inflation-aware, and aligned with institutional finance standards — rather than making return promises that cannot be structurally supported.',
      },
      {
        q: 'What is the infrastructure premium?',
        a: 'Infrastructure projects typically carry higher execution complexity than passive banking products or sovereign bonds. To compensate participants for this additional asset exposure, eligible projects may include an infrastructure premium above prevailing benchmark rates. This premium is project-specific and reflected transparently on each project\'s detail page alongside verified milestone status.',
      },
      {
        q: 'How is my investment protected?',
        a: 'Capital committed through Nested Ark OS remains inside programmable escrow infrastructure and is released progressively only after milestone verification, contractor validation, and ledger confirmation processes are completed. This reduces premature fund exposure and improves transparency across the project lifecycle. No developer receives funds ahead of independently verified construction progress.',
      },
      {
        q: 'Can diaspora investors participate remotely?',
        a: 'Yes. Nested Ark OS is designed for global participation and supports cross-border infrastructure funding in NGN, USD, GBP, EUR, and AED. Diaspora participants can fund projects, monitor verified milestones remotely, track drone and photo evidence, and receive immutable ledger receipts — all without being physically present.',
      },
      {
        q: 'How do I track my portfolio?',
        a: 'Your Investor Dashboard (/investments) shows all active positions, funded percentages, milestone statuses, yield accrued, and projected exit timelines. The Global Ledger (/ledger) shows the immutable record of every verified event across every project you\'re invested in. All data is real-time.',
      },
    ],
  },
  {
    id:    'diaspora',
    label: 'Diaspora',
    icon:  Globe,
    color: 'text-rose-400',
    bg:    'bg-rose-500/10 border-rose-500/20',
    items: [
      {
        q: 'How can I fund a construction project from abroad?',
        a: 'Register as a Diaspora Developer, submit your project via /projects/submit with your local permit reference (e.g. Lagos State digital building permit), and fund the milestone escrow from abroad using Paystack\'s multi-currency rails (GBP, EUR, USD converting to NGN). You track every milestone remotely via live photo updates, drone footage, and the project dashboard.',
      },
      {
        q: 'How do I know my construction money isn\'t being stolen?',
        a: 'Funds are held in Paystack milestone escrow and released only on verified completion — verified by AI analysis, a human auditor, AND drone footage. None of the three parties can approve alone. The contractor only receives payment for completed, verified work. Every release is logged on the SHA-256 immutable ledger with full timestamp and audit trail.',
      },
      {
        q: 'Can I find and hire local contractors on the platform?',
        a: 'Yes. The contractor registry lists vetted, background-checked contractors who have been bonded and approved for milestone-based delivery. You can browse by specialty, location, and project type. Contractors are paid per milestone — not upfront — which incentivises completion and quality.',
      },
      {
        q: 'What is a digital building permit and why does it matter?',
        a: 'Lagos State (and increasingly other Nigerian states) now requires digital building permits issued via the e-Permit portal. Nested Ark integrates the permit reference number (permit_ref) into every project record. This makes your project legally compliant, enables government oversight verification, and reduces the risk of demolition or legal challenge. The platform treats verified permits as a competitive advantage for your project.',
      },
    ],
  },
  {
    id:    'escrow',
    label: 'Escrow & Payments',
    icon:  Lock,
    color: 'text-blue-400',
    bg:    'bg-blue-500/10 border-blue-500/20',
    items: [
      {
        q: 'How does the escrow system work?',
        a: 'When a tenant makes a contribution, funds go directly into a Paystack-held escrow account linked to that vault. The platform monitors the vault balance. When it reaches the target (100%), the system automatically initiates a Paystack bank transfer to the landlord\'s verified account. Neither the landlord nor the tenant can manually trigger early release — it is governed entirely by the programmatic rule.',
      },
      {
        q: 'What payment methods are accepted?',
        a: 'All payments are processed via Paystack, which accepts Nigerian bank cards, bank transfers (USSD), and international cards (Visa/Mastercard). For diaspora users, Paystack supports GBP and EUR card payments with automatic NGN conversion. Mobile money is available in supported West African markets.',
      },
      {
        q: 'What happens if a payment fails?',
        a: 'Failed Paystack payments do not affect your vault balance — only successful, verified payments are credited. The platform sends a reminder notification. You can retry the payment at any time from the Pay Installment page. Your vault status remains active and your contribution history is preserved.',
      },
      {
        q: 'Can the landlord access my vault money early?',
        a: 'No. Vault funds are held by Paystack in escrow and the landlord has no access until the target is 100% funded and the automated disbursement triggers. This protects tenants from pressure to pay early or in ways not agreed. The escrow is governed by platform rules, not by either party directly.',
      },
      {
        q: 'How long does payout take after vault completion?',
        a: 'Paystack bank transfers typically settle within T+1 (next business day) for Nigerian bank accounts. International transfers may take 2–3 business days depending on the receiving bank and country. The platform logs the transfer initiation timestamp on the ledger — if transfer is delayed beyond 48 hours, the system flags it for support review.',
      },
      {
        q: 'What happens if the landlord\'s bank transfer fails?',
        a: 'If a Paystack transfer fails due to an invalid account, frozen account, compliance restriction, or banking outage, the funds remain safely held within the regulated payout flow — they are never lost. The platform automatically retries eligible transfers and sends a notification to the landlord to update their payout details. All transfer attempts and outcomes are logged on the immutable ledger. If a transfer remains unresolved after 72 hours, the platform flags it for support review.',
      },
      {
        q: 'What is a Paystack subaccount and why is one created for my landlord?',
        a: 'A Paystack subaccount is a virtual payment destination linked to a specific bank account. When a landlord registers their bank details, Nested Ark automatically creates a Paystack subaccount and transfer recipient for them. This enables programmable, automatic rent disbursement without requiring the landlord to be online or manually approve each transfer. It is the core of the rent automation infrastructure.',
      },
    ],
  },
  {
    id:    'security',
    label: 'Security & Legal',
    icon:  ShieldCheck,
    color: 'text-purple-400',
    bg:    'bg-purple-500/10 border-purple-500/20',
    items: [
      {
        q: 'Are my documents and receipts legally valid?',
        a: 'Yes. All receipts and notices generated by Nested Ark OS carry SHA-256 cryptographic hashes, timestamps, and unique reference numbers. They are court-admissible evidence in Nigeria and many other jurisdictions. The immutable ledger record means the document cannot be altered after creation — any tampering would invalidate the hash.',
      },
      {
        q: 'How is my personal data protected?',
        a: 'Nested Ark OS follows NDPR (Nigeria Data Protection Regulation) and GDPR-aligned data handling practices. Passwords are bcrypt-hashed and never stored in plaintext. JWT authentication tokens expire after 24 hours. Bank account details are transmitted via TLS 1.3 and never logged in plain text. KYC data is stored in segregated, encrypted storage.',
      },
      {
        q: 'What happens if there is a dispute between tenant and landlord?',
        a: 'The immutable ledger provides an objective, tamper-proof record of every payment, notice, and action. In a dispute, both parties (or a court) can verify the exact timeline of events from the ledger. Legal notices generated on the platform are SHA-256 signed and have unique notice numbers — making them directly usable as supporting evidence. For unresolved disputes, contact support at nestedark@gmail.com.',
      },
      {
        q: 'Is KYC (Know Your Customer) verification required?',
        a: 'KYC verification is available via /kyc and is required for high-value transactions, investor accounts, and government portal access. Basic tenant and landlord accounts can operate with email verification. Enhanced KYC (BVN or NIN verification, identity document upload) unlocks higher vault limits, priority marketplace visibility, and full investor participation.',
      },
      {
        q: 'What is the platform\'s AML (Anti-Money Laundering) policy?',
        a: 'Nested Ark OS maintains AML controls in line with CBN guidelines and Paystack\'s compliance framework. Transactions above threshold limits trigger additional verification. Government and enterprise accounts access AML reporting dashboards via the Government Portal. Suspicious activity reports are handled according to regulatory requirements.',
      },
      {
        q: 'Does Nested Ark OS work with government regulators?',
        a: 'Yes. The platform is designed to support government oversight, permit verification, AML reporting, infrastructure transparency, and compliance auditing. The Government Portal (/gov) provides institutional dashboards for regulators and agencies. Permit references (such as Lagos State digital building permits) are embedded in every project record. Government and enterprise compliance integrations are being expanded in partnership-ready phases.',
      },
      {
        q: 'Is Nested Ark OS compliant with financial regulations?',
        a: 'Nested Ark OS provides infrastructure orchestration and escrow automation services. Payment processing and regulated financial operations are handled exclusively by Paystack, a CBN-licensed payment processor. The platform follows NDPR (Nigeria Data Protection Regulation) for data handling and operates within Paystack\'s AML/KYC compliance framework for all financial transactions.',
      },
    ],
  },
  {
    id:    'technical',
    label: 'Technical',
    icon:  FileText,
    color: 'text-zinc-400',
    bg:    'bg-zinc-800/60 border-zinc-700/50',
    items: [
      {
        q: 'What technology powers Nested Ark OS?',
        a: 'Frontend: Next.js 14 (App Router) with TypeScript, deployed on Vercel. Backend: Node.js/Express with TypeScript, deployed on Render. Database: Supabase PostgreSQL. Payments: Paystack API (escrow, subaccounts, bank transfers, webhooks). Cryptography: SHA-256 ledger hashing. PDF generation: Puppeteer (server-side). Infrastructure: GitHub-triggered CI/CD auto-deploys.',
      },
      {
        q: 'How does the webhook system work?',
        a: 'When Paystack processes a payment, it sends a signed webhook event to the backend. The backend verifies the Paystack signature, validates the event type (charge.success, transfer.success, etc.), updates the vault balance, generates the SHA-256 receipt, and triggers any automated actions (notices, disbursements, emails). Webhooks are idempotent — duplicate events are safely ignored.',
      },
      {
        q: 'Is there an API for developers?',
        a: 'The Nested Ark backend exposes a RESTful API with 50+ authenticated endpoints covering tenancy management, vault operations, milestone escrow, landlord payouts, and legal notices. API access for third-party integrations is available for enterprise and government partners. Contact nestedark@gmail.com for API partnership inquiries.',
      },
      {
        q: 'What is a NAP Project ID?',
        a: 'NAP (Nested Ark Protocol) Project ID is a unique identifier assigned to every infrastructure project registered on the platform — e.g. NAP-2026-00001. It links all associated records: investor stakes, contractor milestones, escrow transactions, permit references, and drone verification events. It is searchable globally via the NAP Search bar in the navigation.',
      },
      {
        q: 'Does AI make investment or construction decisions automatically?',
        a: 'No. AI systems on the platform assist with analysis, anomaly detection, milestone image comparison, and verification support — but they are advisory components only. Final approvals always involve human oversight and compliance workflows. The Tri-Layer Verification system requires AI analysis, a human auditor, AND drone footage confirmation — no single layer can approve a release alone. AI outputs are never used as the sole basis for releasing investor funds.',
      },
      {
        q: 'What happens if the platform experiences downtime?',
        a: 'Core payment records remain protected because transaction processing occurs through Paystack\'s infrastructure and the immutable ledger logging is handled server-side. Temporary frontend outages do not affect vault balances, payment history, or escrow state. Nested Ark OS uses GitHub-triggered CI/CD auto-deploys on Vercel (frontend) and Render (backend) with automatic failover, minimising recovery time. All critical data is backed up in Supabase PostgreSQL with point-in-time recovery.',
      },
    ],
  },
];

// ── Accordion item ────────────────────────────────────────────────────────────
function AccordionItem({
  item, index, isOpen, onToggle, accentColor,
}: {
  item: FAQItem; index: number; isOpen: boolean;
  onToggle: () => void; accentColor: string;
}) {
  return (
    <div className={`border border-zinc-800/80 rounded-2xl overflow-hidden transition-all duration-200 ${
      isOpen ? 'bg-zinc-900/40' : 'bg-zinc-900/20 hover:bg-zinc-900/30'
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className={`text-[8px] font-black font-mono tracking-widest mt-1.5 shrink-0 ${accentColor}`}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <p className={`text-sm font-bold leading-snug ${isOpen ? 'text-white' : 'text-zinc-200'}`}>
            {item.q}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 mt-0.5 transition-transform duration-200 ${
            isOpen ? `rotate-180 ${accentColor}` : 'text-zinc-600'
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5">
          <div className={`w-full h-px mb-4 opacity-30`}
            style={{ background: 'linear-gradient(90deg, transparent, #52525b, transparent)' }} />
          <p className="text-[13px] text-zinc-400 leading-relaxed">
            {item.a}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main FAQ page ─────────────────────────────────────────────────────────────
export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState<string>('general');
  const [openItem,       setOpenItem]       = useState<string | null>(null);
  const [search,         setSearch]         = useState('');

  // Read URL hash on mount — supports /faq#tenant, /faq#escrow etc.
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && CATEGORIES.find(c => c.id === hash)) {
      setActiveCategory(hash);
    }
  }, []);

  const currentCategory = CATEGORIES.find(c => c.id === activeCategory)!;

  // Search filters across all categories when query present
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const results: { category: FAQCategory; item: FAQItem; idx: number }[] = [];
    for (const cat of CATEGORIES) {
      cat.items.forEach((item, idx) => {
        const qLower = typeof item.q === 'string' ? item.q.toLowerCase() : '';
        const aLower = typeof item.a === 'string' ? item.a.toLowerCase() : '';
        if (qLower.includes(q) || aLower.includes(q)) {
          results.push({ category: cat, item, idx });
        }
      });
    }
    return results;
  }, [search]);

  const totalItems = CATEGORIES.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="relative border-b border-zinc-900 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#14b8a6 1px, transparent 1px), linear-gradient(90deg, #14b8a6 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-4xl mx-auto px-6 py-16 md:py-20 text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-500/5 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-[9px] text-teal-400 font-black uppercase tracking-widest">
              {totalItems} Questions Answered
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
            Frequently Asked<br />
            <span className="text-teal-400">Questions</span>
          </h1>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto leading-relaxed">
            Everything you need to know about Nested Ark OS — from tenant savings vaults
            and landlord automation to investor escrow and government compliance.
          </p>

          {/* Search */}
          <div className="relative max-w-lg mx-auto mt-6">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setOpenItem(null); }}
              placeholder="Search questions…"
              className="w-full bg-zinc-900 border border-zinc-800 pl-10 pr-10 py-3.5 rounded-xl text-sm outline-none focus:border-teal-500/60 transition-colors text-white placeholder:text-zinc-600"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Popular questions */}
          {!search && (
            <div className="mt-5 space-y-2">
              <p className="text-[8px] text-zinc-600 uppercase font-black tracking-widest">Popular questions</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { q: 'How does Flex-Pay work?',           cat: 'tenant'  },
                  { q: 'Can I join without a landlord?',    cat: 'tenant'  },
                  { q: 'Is my money safe?',                  cat: 'general' },
                  { q: 'How are landlords paid?',            cat: 'landlord'},
                  { q: 'How does escrow work?',              cat: 'escrow'  },
                  { q: 'What is Tri-Layer Verification?',    cat: 'investor'},
                ].map(p => (
                  <button key={p.q}
                    onClick={() => { setSearch(p.q); setOpenItem(null); }}
                    className="px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/40 text-zinc-400 text-[9px] font-bold hover:border-teal-500/40 hover:text-teal-400 transition-all">
                    {p.q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Last updated */}
          <p className="text-[8px] text-zinc-700 font-mono mt-4">Last updated: May 2026</p>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 w-full">

        {/* ── Search results ──────────────────────────────────────────────── */}
        {searchResults !== null ? (
          <div className="space-y-4">
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-6">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{search}"
            </p>
            {searchResults.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
                <Search size={32} className="text-zinc-700 mx-auto" />
                <p className="text-zinc-500 font-bold">No results found</p>
                <p className="text-zinc-600 text-sm">Try different keywords or browse the categories below.</p>
                <button onClick={() => setSearch('')}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-600 transition-all mt-2">
                  Clear search
                </button>
              </div>
            ) : (
              searchResults.map(({ category, item, idx }) => (
                <div key={`${category.id}-${idx}`} className="border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className={`flex items-center gap-2 px-4 py-2 border-b border-zinc-800 ${category.bg}`}>
                    <category.icon size={11} className={category.color} />
                    <span className={`text-[8px] font-black uppercase tracking-widest ${category.color}`}>
                      {category.label}
                    </span>
                  </div>
                  <AccordionItem
                    item={item}
                    index={idx}
                    isOpen={openItem === `search-${category.id}-${idx}`}
                    onToggle={() => setOpenItem(
                      openItem === `search-${category.id}-${idx}` ? null : `search-${category.id}-${idx}`
                    )}
                    accentColor={category.color}
                  />
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-8">

            {/* ── Category sidebar ─────────────────────────────────────────── */}
            <div className="md:w-56 shrink-0">
              <p className="text-[9px] text-zinc-600 uppercase font-black tracking-widest mb-3 px-1">
                Categories
              </p>
              <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setOpenItem(null);
                        window.history.replaceState(null, '', `/faq#${cat.id}`);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all shrink-0 md:shrink text-left w-full ${
                        isActive
                          ? `${cat.bg} ${cat.color} border-current/30`
                          : 'border-zinc-800/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      <Icon size={14} className="shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest truncate">
                          {cat.label}
                        </p>
                        <p className="text-[8px] text-zinc-600 mt-0.5">{cat.items.length} questions</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── FAQ list ─────────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              {/* Category header */}
              <div
                id={currentCategory.id}
                className={`flex items-center gap-3 p-4 rounded-2xl border mb-6 ${currentCategory.bg}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-black/30`}>
                  <currentCategory.icon size={18} className={currentCategory.color} />
                </div>
                <div>
                  <p className={`text-xs font-black uppercase tracking-widest ${currentCategory.color}`}>
                    {currentCategory.label}
                  </p>
                  <p className="text-[9px] text-zinc-600">{currentCategory.items.length} questions</p>
                </div>
              </div>

              <div className="space-y-2">
                {currentCategory.items.map((item, idx) => (
                  <AccordionItem
                    key={idx}
                    item={item}
                    index={idx}
                    isOpen={openItem === `${activeCategory}-${idx}`}
                    onToggle={() => setOpenItem(
                      openItem === `${activeCategory}-${idx}` ? null : `${activeCategory}-${idx}`
                    )}
                    accentColor={currentCategory.color}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compliance note */}
        <div className="mt-12 px-5 py-4 rounded-2xl border border-zinc-900 bg-zinc-950/60 flex items-start gap-3">
          <ShieldCheck size={14} className="text-teal-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            <span className="text-zinc-500 font-bold">Regulatory notice:</span> Nested Ark OS provides infrastructure orchestration and escrow automation services. Payment processing and regulated financial operations are handled exclusively by licensed payment infrastructure providers. Nested Ark OS is a product of Impressions &amp; Impacts Ltd.
          </p>
        </div>

        {/* ── Still have questions CTA ─────────────────────────────────────── */}
        <div className="mt-16 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-zinc-300 mb-1">
              Still have questions?
            </p>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Our support team is reachable via email. For technical API inquiries,
              enterprise partnerships, or government integration, reach out directly.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <a href="mailto:nestedark@gmail.com"
              className="flex items-center gap-2 px-5 py-3 bg-teal-500 text-black text-[10px] font-black uppercase rounded-xl hover:bg-teal-400 transition-all tracking-widest">
              Email Support <ArrowRight size={12} />
            </a>
            <Link href="/register"
              className="flex items-center gap-2 px-5 py-3 border border-zinc-700 text-zinc-300 text-[10px] font-black uppercase rounded-xl hover:border-teal-500/40 transition-all tracking-widest">
              Get Started
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
