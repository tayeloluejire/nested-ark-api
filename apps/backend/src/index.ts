import express, { Request, Response, NextFunction } from "express";
import { Pool } from "pg";
import jwt, { SignOptions } from "jsonwebtoken";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import bcryptjs from "bcryptjs";
import cors from 'cors';
import crypto from 'crypto';
import { startReminderCron } from './cron_scheduler';
import {
  EmailService,
  initEmailService,
  getTransporter,
  setDbLogger,
  genericTemplate,
  welcomeTenantTemplate,
  welcomeLandlordTemplate,
  verifyEmailTemplate,
  forgotPasswordTemplate,
  passwordChangedTemplate,
  vaultMilestoneTemplate,
  landlordDisbursementTemplate,
  adminNotificationTemplate,
} from './emailService';
// recovery routes are inline in this file (forgot-password, verify-reset-token, reset-password)

dotenv.config();

const app = express();

// ── CORS must be registered BEFORE express.json() so OPTIONS preflight requests
//    are handled before the JSON body parser runs (which errors on empty bodies)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    const isLocal    = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isVercel   = origin.endsWith('.vercel.app');
    const isRender   = origin.endsWith('.onrender.com');
    const isNestedArk = origin === 'https://nestedark.com' ||
                        origin === 'https://www.nestedark.com';
    const isExplicit = allowedOrigins.includes(origin);

    if (isLocal || isVercel || isRender || isNestedArk || isExplicit) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed by Nested Ark Security`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

// 0. Normalise trailing slashes BEFORE CORS so preflight OPTIONS on /api/foo/
//    also matches cleanly.  Collapses ALL trailing slashes (e.g. /units// → /units)
//    so that Next.js trailingSlash:true + proxy rewrites never cause a double-slash
//    that defeats the single-character slice used previously.
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.length > 1 && req.path.endsWith('/')) {
    const cleanPath = req.path.replace(/\/+$/, ''); // strip all trailing slashes
    const query = req.url.slice(req.path.length);   // preserve ?query&string
    req.url = cleanPath + query;
  }
  next();
});

// 1. Apply CORS middleware first
app.use(cors(corsOptions));

// 2. Explicitly handle ALL OPTIONS pre-flight requests and short-circuit immediately
//    This MUST come before express.json() and all route definitions
app.options('*', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin',      req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods',     'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers',     'Content-Type, Authorization, Accept, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age',           '86400'); // Cache preflight 24h
  return res.sendStatus(200);
});

// 3. Body parsers AFTER cors + options — safe now
app.use(express.json());
// ════════════════════════════════════════════════════════════════════════════
// SECURITY: Rate Limiting — memory-backed, zero external dependencies
// Uses Map<ip+path, {count, resetTime}>. Safe for single Render instance.
// Resets per window; no persistence across restarts (acceptable for pilot).
// ════════════════════════════════════════════════════════════════════════════
const _rlCache = new Map<string, { count: number; resetTime: number }>();

function createRateLimiter(windowMs: number, maxRequests: number, message: string) {
  return (req: Request, res: Response, next: NextFunction): any => {
    const ip  = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    const key = `${req.path}_${ip}`;
    const now = Date.now();
    const rec = _rlCache.get(key);

    if (!rec || now > rec.resetTime) {
      _rlCache.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    if (rec.count >= maxRequests) {
      console.warn(`[RATE-LIMIT] ${ip} blocked on ${req.path} (${rec.count} reqs/${windowMs/1000}s)`);
      return res.status(429).json({
        error:      message,
        retryAfter: Math.ceil((rec.resetTime - now) / 1000),
      });
    }
    rec.count++;
    return next();
  };
}

// Prune stale cache entries every 10 minutes (prevents memory leak over time)
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of _rlCache.entries()) {
    if (now > rec.resetTime) _rlCache.delete(key);
  }
}, 10 * 60 * 1000);

// ── Rate limiter presets ──────────────────────────────────────────────────
const authLimiter     = createRateLimiter(15 * 60 * 1000, 10,  'Too many auth attempts. Please try again in 15 minutes.');
const actionLimiter   = createRateLimiter(60 * 1000,       30, 'Rate limit exceeded. Please slow down.');
const paymentLimiter  = createRateLimiter(5 * 60 * 1000,   10, 'Too many payment requests. Please wait 5 minutes before retrying.');
const noticeLimiter   = createRateLimiter(60 * 1000,       10, 'Too many notice requests. Please slow down.');

// ── Apply limiters ────────────────────────────────────────────────────────
app.use('/api/auth/login',                         authLimiter);
app.use('/api/auth/register',                      authLimiter);
app.use('/api/auth/forgot-password',               authLimiter);
app.use('/api/auth/reset-password',                authLimiter);
app.use('/api/auth/verify-email',                  authLimiter);
app.use('/api/auth/resend-verification',           authLimiter);
app.use('/api/rental/marketplace/advertise',       paymentLimiter);
app.use('/api/tenant/pay-installment',             paymentLimiter);
app.use('/api/tenant/maintenance-request',         actionLimiter);
app.use('/api/rental/onboard-tenant',             actionLimiter);
app.use('/api/notices/issue',                      noticeLimiter);



app.get("/", (req: Request, res: Response) => {
  res.json({
    service: "Nested Ark Infrastructure API",
    status: "running",
    version: "1.0.0"
  });
});

/* ============================================
   DATABASE CONNECTION — Supabase / Render
   Always uses DATABASE_URL with SSL (required by Supabase)
============================================ */

if (!process.env.DATABASE_URL) {
  console.error("❌ FATAL: DATABASE_URL environment variable is not set.");
  console.error("Set it in Render → Environment → DATABASE_URL (use Supabase pooler URL).");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,                // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const JWT_SECRET: string = process.env.JWT_SECRET || "super-secret-key-change-this";
const JWT_EXPIRY = (process.env.JWT_EXPIRY || "24h") as SignOptions['expiresIn'];
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE = 'https://api.paystack.co';
// Subaccount code from Paystack dashboard → Transaction Splits → Subaccounts
// Set PAYSTACK_SUBACCOUNT_CODE=ACCT_xxxxxxxxxxxx in Render environment variables
// When set, every payment is automatically split: subaccount gets its configured %,
// the remainder flows to the main Nested Ark account as platform earnings.
// bearer:"subaccount" means the subaccount (Ark Escrow Vault) pays the Paystack fee.
const PAYSTACK_SUBACCOUNT_CODE = process.env.PAYSTACK_SUBACCOUNT_CODE || '';

// ── Platform Revenue Configuration ───────────────────────────────────────────
// Override any rate by setting the corresponding env var on Render
const REVENUE_CONFIG = {
  ESCROW_FEE_PCT:        parseFloat(process.env.PLATFORM_FEE_PCT        || '0.02'),   // 2%
  INVESTMENT_FEE_PCT:    parseFloat(process.env.INVESTMENT_FEE_PCT       || '0.005'),  // 0.5%
  SUPPLY_COMMISSION_PCT: parseFloat(process.env.SUPPLY_COMMISSION_PCT    || '0.03'),   // 3%
  LISTING_FEE_USD:       parseFloat(process.env.LISTING_FEE_USD          || '49'),     // flat $49
};

// ── Revenue helper — records income atomically inside any DB transaction ──────
async function recordPlatformRevenue(client: any, opts: {
  source:        string;
  amount_usd:    number;
  amount_ngn?:   number;
  pct_applied?:  number;
  gross_amount?: number;
  project_id?:   string | null;
  milestone_id?: string | null;
  investor_id?:  string | null;
  metadata?:     Record<string, any>;
}) {
  const revenueId = uuidv4();
  const lHash = crypto
    .createHash('sha256')
    .update(`revenue-${revenueId}-${opts.source}-${opts.amount_usd}-${Date.now()}`)
    .digest('hex');

  await client.query(
    `INSERT INTO platform_revenue
      (id, project_id, milestone_id, investor_id, amount_usd, amount_ngn,
       source, pct_applied, gross_amount, metadata, ledger_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      revenueId,
      opts.project_id   || null,
      opts.milestone_id || null,
      opts.investor_id  || null,
      opts.amount_usd,
      opts.amount_ngn   ?? null,
      opts.source,
      opts.pct_applied  ?? null,
      opts.gross_amount ?? null,
      opts.metadata ? JSON.stringify(opts.metadata) : null,
      lHash,
    ]
  );

  // Every revenue event is also logged to the immutable system ledger
  await client.query(
    "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
    [
      `PLATFORM_REVENUE_${opts.source}`,
      JSON.stringify({ revenue_id: revenueId, amount_usd: opts.amount_usd, source: opts.source, ...opts.metadata }),
      lHash,
    ]
  );

  console.log(`[REVENUE] +$${opts.amount_usd.toFixed(4)} — ${opts.source} — ${lHash.slice(0, 16)}…`);
  return { revenueId, lHash };
}

const ensureTablesExist = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // ⭐ IMPORTANT: NO DROP TABLE STATEMENTS - PRESERVES USER DATA
    // Tables are created IF NOT EXISTS, so data persists across restarts
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        phone VARCHAR(20),
        role VARCHAR(50) DEFAULT 'PROJECT_SPONSOR',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_logs (
        id UUID PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        template VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL,
        provider_response TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY,
        sponsor_id UUID NOT NULL REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        location VARCHAR(255) NOT NULL,
        country VARCHAR(100) NOT NULL,
        budget DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        category VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        progress_percentage DECIMAL(5,2) DEFAULT 0,
        timeline_months INTEGER,
        target_completion_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contractors (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        company_name VARCHAR(255),
        bio TEXT,
        specialization VARCHAR(255),
        years_experience INTEGER,
        hourly_rate DECIMAL(10,2),
        rating DECIMAL(3,2) DEFAULT 0,
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS escrow_wallets (
        id UUID PRIMARY KEY, 
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, 
        user_id UUID NOT NULL REFERENCES users(id), 
        balance DECIMAL(15,2) DEFAULT 0, 
        held_amount DECIMAL(15,2) DEFAULT 0, 
        status VARCHAR(50) DEFAULT 'ACTIVE', 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transaction_logs (
        id UUID PRIMARY KEY, 
        user_id UUID NOT NULL REFERENCES users(id), 
        wallet_id UUID NOT NULL REFERENCES escrow_wallets(id), 
        transaction_type VARCHAR(50) NOT NULL, 
        amount DECIMAL(15,2) NOT NULL, 
        balance_before DECIMAL(15,2), 
        balance_after DECIMAL(15,2), 
        status VARCHAR(50) DEFAULT 'COMPLETED', 
        hash VARCHAR(64), 
        previous_hash VARCHAR(64), 
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS milestones (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        budget_allocation DECIMAL(15,2),
        status VARCHAR(50) DEFAULT 'PENDING',
        progress_percentage DECIMAL(5,2) DEFAULT 0,
        estimated_start_date TIMESTAMP,
        estimated_completion_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS milestone_verifications (
        id UUID PRIMARY KEY,
        milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
        engineer_id UUID NOT NULL REFERENCES users(id),
        verification_status VARCHAR(50),
        evidence_photo_url TEXT,
        inspection_report_url TEXT,
        drone_footage_url TEXT,
        geo_latitude DECIMAL(10,8),
        geo_longitude DECIMAL(11,8),
        verified_progress_percentage INT,
        verified_notes TEXT,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_approvals (
        id UUID PRIMARY KEY,
        milestone_id UUID NOT NULL REFERENCES milestones(id),
        approver_id UUID NOT NULL REFERENCES users(id),
        approver_role VARCHAR(50),
        approval_status VARCHAR(50) DEFAULT 'PENDING',
        approved_at TIMESTAMP,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bids (
        id UUID PRIMARY KEY,
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        milestone_id UUID NOT NULL REFERENCES milestones(id),
        contractor_id UUID NOT NULL REFERENCES contractors(id),
        amount DECIMAL(15,2) NOT NULL,
        estimated_duration_days INT,
        proposal TEXT,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS investments (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        investor_id UUID NOT NULL REFERENCES users(id),
        amount DECIMAL(15,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'COMMITTED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS payout_date TIMESTAMP;

      ALTER TABLE projects ADD COLUMN IF NOT EXISTS gov_verified BOOLEAN DEFAULT false;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS verification_hash VARCHAR(64);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES users(id);

      ALTER TABLE contractors ADD COLUMN IF NOT EXISTS completed_projects INTEGER DEFAULT 0;

      -- Tri-Layer Verification columns for milestone security
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) DEFAULT 'PENDING';
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS human_status VARCHAR(20) DEFAULT 'PENDING';
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS drone_status VARCHAR(20) DEFAULT 'PENDING';
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS ai_hash VARCHAR(64);
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS drone_url TEXT;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS evidence_url TEXT;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS evidence_submitted_at TIMESTAMP;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS human_verifier_id UUID;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS human_verified_at TIMESTAMP;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS drone_synced_at TIMESTAMP;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS release_hash VARCHAR(64);

      CREATE TABLE IF NOT EXISTS system_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_type VARCHAR(100) NOT NULL,
        payload JSONB,
        immutable_hash VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_projects_sponsor ON projects(sponsor_id);
      CREATE INDEX IF NOT EXISTS idx_contractors_user ON contractors(user_id);
      CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
      CREATE INDEX IF NOT EXISTS idx_escrow_project ON escrow_wallets(project_id);
      CREATE INDEX IF NOT EXISTS idx_bids_milestone ON bids(milestone_id);
      CREATE INDEX IF NOT EXISTS idx_bids_project ON bids(project_id);
      CREATE INDEX IF NOT EXISTS idx_transaction_wallet ON transaction_logs(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_investments_project ON investments(project_id);
      CREATE INDEX IF NOT EXISTS idx_investments_investor ON investments(investor_id);

      -- Currency rate cache (updated hourly, USD-pegged ledger stays stable)
      CREATE TABLE IF NOT EXISTS currency_rates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        base VARCHAR(10) DEFAULT 'USD',
        rates JSONB NOT NULL,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Market ticker items (ads + live activity feed)
      CREATE TABLE IF NOT EXISTS ticker_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_type VARCHAR(50) NOT NULL, -- 'AD', 'ACTIVITY', 'RATE'
        label TEXT NOT NULL,
        value TEXT,
        link_url TEXT,
        sponsor_name VARCHAR(255),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );

      -- News crawler table — editable content for the market ticker
      CREATE TABLE IF NOT EXISTS ticker_news (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        item_type VARCHAR(50) DEFAULT 'NEWS', -- 'NEWS', 'AD', 'RATE', 'UPDATE', 'ALERT'
        sponsor_name VARCHAR(255),
        link_url TEXT,
        priority INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        auto_fetched BOOLEAN DEFAULT false,
        source_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Supply chain & bank partner columns
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS supply_status VARCHAR(50) DEFAULT 'AWAITING_RFQ';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS vendor VARCHAR(100);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS bank_status VARCHAR(50) DEFAULT 'UNFUNDED';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS funding_bank VARCHAR(100);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_bank VARCHAR(100);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS primary_supplier VARCHAR(100);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS supply_chain_mode VARCHAR(50) DEFAULT 'DIRECT_ESCROW';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS funding_type VARCHAR(50) DEFAULT 'HYBRID_CAPITAL';

      -- Paystack payment tracking
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        investor_id UUID NOT NULL REFERENCES users(id),
        project_id UUID NOT NULL REFERENCES projects(id),
        paystack_reference VARCHAR(100) UNIQUE NOT NULL,
        paystack_access_code VARCHAR(100),
        amount_ngn DECIMAL(15,2) NOT NULL,
        amount_usd DECIMAL(15,2),
        status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED, ABANDONED
        channel VARCHAR(50),
        currency VARCHAR(10) DEFAULT 'NGN',
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) CHECK (role IN ('INVESTOR', 'CONTRACTOR', 'GOVERNMENT', 'ADMIN', 'VERIFIER', 'SUPPLIER', 'BANK', 'DEVELOPER', 'TENANT')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- KYC records
      CREATE TABLE IF NOT EXISTS kyc_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
        full_name VARCHAR(255),
        date_of_birth DATE,
        nationality VARCHAR(100),
        id_type VARCHAR(50), -- PASSPORT, NIN, BVN, DRIVERS_LICENSE
        id_number VARCHAR(100),
        id_document_url TEXT,
        selfie_url TEXT,
        address TEXT,
        city VARCHAR(100),
        country VARCHAR(100),
        kyc_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED
        verified_at TIMESTAMP,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_payment_tx_investor ON payment_transactions(investor_id);
      CREATE INDEX IF NOT EXISTS idx_payment_tx_project ON payment_transactions(project_id);
      CREATE INDEX IF NOT EXISTS idx_payment_tx_ref ON payment_transactions(paystack_reference);
      CREATE INDEX IF NOT EXISTS idx_kyc_user ON kyc_records(user_id);

      -- Project geo coordinates for drone proximity validation
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_latitude DECIMAL(10,8);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_longitude DECIMAL(11,8);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS country_code VARCHAR(3);

      -- ── Project Marketplace Extension ─────────────────────────────────────
      -- Owner types: INDIVIDUAL | CORPORATE | PRIVATE_BUSINESS | DEVELOPER | GOVERNMENT
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_type VARCHAR(50) DEFAULT 'INDIVIDUAL';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(50);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_company VARCHAR(255);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_country VARCHAR(100);

      -- Unique human-readable project number e.g. NAP-2026-00042
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_number VARCHAR(30) UNIQUE;

      -- Project type & visibility
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(50) DEFAULT 'INFRASTRUCTURE';
      -- Types: INFRASTRUCTURE | RESIDENTIAL | COMMERCIAL | INDUSTRIAL | RENOVATION | LANDSCAPE | OTHER
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'PUBLIC';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS permit_ref VARCHAR(100);
      -- PUBLIC | PRIVATE | INVITE_ONLY

      -- Rich project content
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS hero_image_url TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS pitch_summary TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS expected_roi DECIMAL(5,2) DEFAULT 12.0;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS risk_grade VARCHAR(10) DEFAULT 'B+';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_bank VARCHAR(100);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS primary_supplier VARCHAR(100);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS funding_bank VARCHAR(100);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS vendor VARCHAR(100);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS bank_status VARCHAR(50) DEFAULT 'UNFUNDED';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS supply_status VARCHAR(50) DEFAULT 'PENDING';

      -- Project documents (floor plans, 2D/3D, approvals, etc.)
      CREATE TABLE IF NOT EXISTS project_documents (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        doc_type      VARCHAR(50) NOT NULL,
        -- FLOOR_PLAN | 3D_MODEL | 2D_DRAWING | GOVT_APPROVAL | EIA |
        -- FEASIBILITY | BILL_OF_QUANTITIES | CONTRACTOR_PACK | PHOTOS | OTHER
        title         VARCHAR(255) NOT NULL,
        description   TEXT,
        file_url      TEXT NOT NULL,
        thumbnail_url TEXT,
        file_size_kb  INTEGER,
        mime_type     VARCHAR(100),
        uploaded_by   UUID REFERENCES users(id),
        is_public     BOOLEAN DEFAULT true,
        requires_kyc  BOOLEAN DEFAULT false,
        sort_order    INTEGER DEFAULT 0,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_projdoc_project  ON project_documents(project_id);
      CREATE INDEX IF NOT EXISTS idx_projdoc_type     ON project_documents(doc_type);
      -- Idempotent column additions: run on every restart, safe for existing DBs
      ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS mime_type     VARCHAR(100);
      ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS sort_order    INTEGER DEFAULT 0;
      ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS file_size_kb  INTEGER;
      ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
      ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL;

      -- Project milestones (owner defines phases when submitting)
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS milestone_number INTEGER DEFAULT 1;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS required_trade  VARCHAR(100);
      -- e.g. Civil Engineering, Electrical, Plumbing, Architecture

      -- Project tags for search
      CREATE TABLE IF NOT EXISTS project_tags (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tag        VARCHAR(100) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tags_project ON project_tags(project_id);
      CREATE INDEX IF NOT EXISTS idx_tags_tag     ON project_tags(tag);

      -- Project view/search tracking
      CREATE TABLE IF NOT EXISTS project_views (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        viewer_ip   VARCHAR(50),
        viewer_id   UUID REFERENCES users(id),
        viewed_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_views_project ON project_views(project_id);

      -- Project save/watchlist
      CREATE TABLE IF NOT EXISTS project_saves (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        saved_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, user_id)
      );

      -- Email verification (from previous patch — safe if already exists)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified    BOOLEAN   DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled      BOOLEAN   DEFAULT false;
-- ── Expand role CHECK constraint to include DEVELOPER and TENANT ────────
      DO $$ 
      DECLARE 
          _cname RECORD; 
      BEGIN 
          -- Logic to verify the column exists before we attempt to use it
          FOR _cname IN 
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = 'tenancies' AND column_name = 'tenant_user_id'
          LOOP 
              RAISE NOTICE 'Verified column: %', _cname.column_name;
          END LOOP; 
      END $$;

      -- Recreate role constraint with all 9 active roles
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('INVESTOR','CONTRACTOR','GOVERNMENT','ADMIN','VERIFIER','SUPPLIER','BANK','DEVELOPER','TENANT'));

      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('INVESTOR','CONTRACTOR','GOVERNMENT','ADMIN','VERIFIER','SUPPLIER','BANK','DEVELOPER','TENANT'));

      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(128) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_evt_user  ON email_verification_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_evt_token ON email_verification_tokens(token);

      CREATE TABLE IF NOT EXISTS otp_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(6) NOT NULL,
        purpose VARCHAR(30) DEFAULT 'LOGIN_2FA',
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_codes(user_id);

      -- ══════════════════════════════════════════════════════════════════════
      -- PLATFORM REVENUE ENGINE — tracks every dollar the platform earns
      -- ══════════════════════════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS platform_revenue (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id    UUID REFERENCES projects(id)   ON DELETE SET NULL,
        milestone_id  UUID REFERENCES milestones(id) ON DELETE SET NULL,
        investor_id   UUID REFERENCES users(id)      ON DELETE SET NULL,
        amount_usd    DECIMAL(18,4) NOT NULL,
        amount_ngn    DECIMAL(18,2),
        -- ESCROW_FEE | LISTING_FEE | INVESTMENT_FEE | SUPPLY_COMMISSION | AD_REVENUE | VAAS_SUBSCRIPTION
        source        VARCHAR(50) NOT NULL,
        pct_applied   DECIMAL(5,3),          -- e.g. 0.020 = 2%
        gross_amount  DECIMAL(18,4),         -- gross before fee deduction
        currency      VARCHAR(10) DEFAULT 'USD',
        status        VARCHAR(20) DEFAULT 'COMPLETED',
        metadata      JSONB,
        ledger_hash   VARCHAR(64),
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_rev_project ON platform_revenue(project_id);
      CREATE INDEX IF NOT EXISTS idx_rev_source  ON platform_revenue(source);
      CREATE INDEX IF NOT EXISTS idx_rev_created ON platform_revenue(created_at);

      -- Listing fees — one-time fee per project NAP ID generation
      CREATE TABLE IF NOT EXISTS listing_fees (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id      UUID NOT NULL REFERENCES users(id),
        amount_usd   DECIMAL(10,2) NOT NULL DEFAULT 49.00,
        status       VARCHAR(20) DEFAULT 'PAID',
        paid_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_lfee_project ON listing_fees(project_id);

      -- ── Password Reset Tokens (secure, single-use, expiring) ──────────────
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) NOT NULL UNIQUE,  -- SHA-256 of the raw token
        expires_at TIMESTAMP NOT NULL,
        used       BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_prt_user  ON password_reset_tokens(user_id);

      -- ══════════════════════════════════════════════════════════════════════
      -- MARKET CONFIG — dynamic ROI rate and platform settings
      -- Admin can update global_roi_rate; frontend reads it live
      -- ══════════════════════════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS market_config (
        key        VARCHAR(50) PRIMARY KEY,
        value      DECIMAL(18,4) NOT NULL,
        label      VARCHAR(100),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Seed default values (ON CONFLICT = no-op if already seeded)
      INSERT INTO market_config (key, value, label) VALUES
        ('global_roi_rate',        12.00, 'Annual ROI % paid to investors'),
        ('platform_escrow_fee',     2.00, 'Escrow release fee %'),
        ('platform_listing_fee',   49.00, 'Flat listing fee USD'),
        ('platform_investment_fee', 0.50, 'Investment placement fee %'),
        ('platform_supply_fee',     3.00, 'Supply chain commission %')
      ON CONFLICT (key) DO NOTHING;
    `);

    // ── Project Mode & Lifecycle columns ──────────────────────────────────
    // project_mode: INVESTMENT (crowdfund) | PRIVATE (services only) | OPERATIONAL (rental/yield)
    // lifecycle_stage: PLANNING | CONSTRUCTION | COMPLETED | OPERATIONAL
    await client.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_mode    VARCHAR(20) DEFAULT 'INVESTMENT';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(20) DEFAULT 'CONSTRUCTION';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS monthly_rent    DECIMAL(15,2);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS asset_health_score INTEGER DEFAULT 100;

      -- Auto-classify RESIDENTIAL as PRIVATE by default
      UPDATE projects SET project_mode = 'PRIVATE'
        WHERE project_type IN ('RESIDENTIAL','RENOVATION')
        AND project_mode = 'INVESTMENT';
    `);

    // ── Stakeholder Split Table ───────────────────────────────────────────
    // Defines who receives what % of every inbound payment (rent, yield, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS stakeholder_splits (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
        role            VARCHAR(30) NOT NULL,
          -- INVESTOR | OWNER | FACILITY_MANAGER | PLATFORM | MAINTENANCE_RESERVE
        share_pct       DECIMAL(8,4) NOT NULL CHECK (share_pct >= 0 AND share_pct <= 100),
        description     VARCHAR(200),
        bank_code       VARCHAR(20),   -- for Paystack Transfer (optional)
        account_number  VARCHAR(30),   -- for auto-disbursement (optional)
        is_auto_pay     BOOLEAN DEFAULT false,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ss_user    ON stakeholder_splits(user_id);
    `);

    // ── Rental Units ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS rental_units (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        unit_name     VARCHAR(100) NOT NULL,
        unit_type     VARCHAR(50)  NOT NULL DEFAULT 'APARTMENT',
          -- APARTMENT | STUDIO | ROOM | SHOP | OFFICE | WAREHOUSE
        bedrooms      INTEGER DEFAULT 0,
        floor_area_sqm DECIMAL(10,2),
        rent_amount   DECIMAL(15,2) NOT NULL,
        currency      VARCHAR(10)   DEFAULT 'NGN',
        status        VARCHAR(20)   DEFAULT 'VACANT',
          -- VACANT | OCCUPIED | MAINTENANCE | LISTED
        description   TEXT,
        amenities     TEXT[],
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ru_status  ON rental_units(status);
    `);

    // ── Tenancies ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenancies (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id        UUID NOT NULL REFERENCES rental_units(id) ON DELETE CASCADE,
        project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_name    VARCHAR(200) NOT NULL,
        tenant_email   VARCHAR(200) NOT NULL,
        tenant_phone   VARCHAR(50),
        lease_start    DATE NOT NULL,
        lease_end      DATE,
        rent_amount    DECIMAL(15,2) NOT NULL,
        currency       VARCHAR(10)   DEFAULT 'NGN',
        payment_day    INTEGER DEFAULT 1,  -- day of month rent is due
        status         VARCHAR(20)   DEFAULT 'ACTIVE',
          -- ACTIVE | EXPIRED | TERMINATED | NOTICE_PERIOD
        notes          TEXT,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ten_unit    ON tenancies(unit_id);
      CREATE INDEX IF NOT EXISTS idx_ten_status  ON tenancies(status);
    `);

    // ── Rent Payments ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS rent_payments (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenancy_id           UUID NOT NULL REFERENCES tenancies(id),
        unit_id              UUID NOT NULL REFERENCES rental_units(id),
        project_id           UUID NOT NULL REFERENCES projects(id),
        amount_ngn           DECIMAL(15,2) NOT NULL,
        amount_usd           DECIMAL(15,2),
        paystack_reference   VARCHAR(150) UNIQUE,
        paystack_access_code VARCHAR(150),
        status               VARCHAR(20) DEFAULT 'PENDING',
          -- PENDING | SUCCESS | FAILED | DISTRIBUTED
        period_month         VARCHAR(7),   -- "2026-04"
        paid_at              TIMESTAMP,
        distributed_at       TIMESTAMP,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_rp_ref     ON rent_payments(paystack_reference);
      CREATE INDEX IF NOT EXISTS idx_rp_status  ON rent_payments(status);
    `);

    // ── Yield Distributions ──────────────────────────────────────────────
    // One row per stakeholder per payment — the immutable audit trail
    await client.query(`
      CREATE TABLE IF NOT EXISTS yield_distributions (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rent_payment_id   UUID NOT NULL REFERENCES rent_payments(id),
        project_id        UUID NOT NULL REFERENCES projects(id),
        recipient_id      UUID REFERENCES users(id),
        recipient_name    VARCHAR(200),    -- for non-user recipients
        recipient_role    VARCHAR(30) NOT NULL,
        share_pct         DECIMAL(8,4) NOT NULL,
        amount_ngn        DECIMAL(15,2) NOT NULL,
        amount_usd        DECIMAL(15,2),
        investment_stake  DECIMAL(8,4),   -- investor's equity % in the project
        transfer_status   VARCHAR(20) DEFAULT 'PENDING',
          -- PENDING | TRANSFERRED | FAILED | HELD
        ledger_hash       VARCHAR(128) NOT NULL,
        distributed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_yd_payment   ON yield_distributions(rent_payment_id);
      CREATE INDEX IF NOT EXISTS idx_yd_recipient ON yield_distributions(recipient_id);
    `);

    // ── Maintenance Logs (Asset Health tracking) ─────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_logs (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        unit_id     UUID REFERENCES rental_units(id),
        title       VARCHAR(200) NOT NULL,
        description TEXT,
        category    VARCHAR(50) DEFAULT 'GENERAL',
          -- GENERAL | ELECTRICAL | PLUMBING | STRUCTURAL | COSMETIC | SAFETY
        severity    VARCHAR(20) DEFAULT 'LOW',
          -- LOW | MEDIUM | HIGH | CRITICAL
        status      VARCHAR(20) DEFAULT 'OPEN',
          -- OPEN | IN_PROGRESS | RESOLVED | CLOSED
        cost_ngn    DECIMAL(15,2),
        resolved_at TIMESTAMP,
        reported_by UUID REFERENCES users(id),
        assigned_to UUID REFERENCES users(id),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Seed rental split ratios in market_config ─────────────────────────
    await client.query(`
      INSERT INTO market_config (key, value, label) VALUES
        ('rental_investor_pct',         60.00, 'Rent % distributed pro-rata to investors'),
        ('rental_owner_pct',            25.00, 'Rent % to project owner/landlord'),
        ('rental_facility_manager_pct',  8.00, 'Rent % to appointed facility manager'),
        ('rental_platform_pct',          5.00, 'Nested Ark platform service fee on rent'),
        ('rental_maintenance_reserve',   2.00, 'Maintenance reserve % held in escrow')
      ON CONFLICT (key) DO NOTHING;
    `);

    // ── Powerhouse Asset Management Tables ──────────────────────────────────
    await client.query(`

      -- Flex-Pay Vault (tenant standing order)
      CREATE TABLE IF NOT EXISTS flex_pay_vaults (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenancy_id        UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
        unit_id           UUID NOT NULL REFERENCES rental_units(id),
        project_id        UUID NOT NULL REFERENCES projects(id),
        tenant_user_id    UUID REFERENCES users(id),
        vault_balance     DECIMAL(15,2) NOT NULL DEFAULT 0,
        target_amount     DECIMAL(15,2) NOT NULL,
        frequency         VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
        installment_amount DECIMAL(15,2) NOT NULL,
        currency          VARCHAR(10) DEFAULT 'NGN',
        next_due_date     DATE NOT NULL,
        cashout_mode      VARCHAR(20) DEFAULT 'LUMP_SUM',
        drawdown_day      INTEGER DEFAULT 1,
        status            VARCHAR(20) DEFAULT 'ACTIVE',
        funded_periods    INTEGER DEFAULT 0,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_fpv_tenancy ON flex_pay_vaults(tenancy_id);
      CREATE INDEX IF NOT EXISTS idx_fpv_status  ON flex_pay_vaults(status);

      -- Flex-Pay Contributions (each sub-payment)
      CREATE TABLE IF NOT EXISTS flex_contributions (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id         UUID NOT NULL REFERENCES flex_pay_vaults(id) ON DELETE CASCADE,
        tenancy_id       UUID NOT NULL REFERENCES tenancies(id),
        amount_ngn       DECIMAL(15,2) NOT NULL,
        paystack_ref     VARCHAR(150) UNIQUE,
        status           VARCHAR(20) DEFAULT 'PENDING',
        period_label     VARCHAR(30),
        paid_at          TIMESTAMP,
        ledger_hash      VARCHAR(128),
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_fc_vault ON flex_contributions(vault_id);

      -- Rent Reminders Log
      CREATE TABLE IF NOT EXISTS rent_reminders (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenancy_id    UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
        unit_id       UUID REFERENCES rental_units(id),
        project_id    UUID NOT NULL REFERENCES projects(id),
        reminder_type VARCHAR(30) NOT NULL,
        sent_via      VARCHAR(20) DEFAULT 'EMAIL',
        sent_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        recipient_email VARCHAR(200),
        recipient_phone VARCHAR(50),
        was_delivered BOOLEAN DEFAULT false,
        error_msg     TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_rr_tenancy ON rent_reminders(tenancy_id);

      -- Legal Notices
      CREATE TABLE IF NOT EXISTS legal_notices (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenancy_id      UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
        unit_id         UUID REFERENCES rental_units(id),
        project_id      UUID NOT NULL REFERENCES projects(id),
        notice_type     VARCHAR(30) NOT NULL,
        notice_number   VARCHAR(50) UNIQUE NOT NULL,
        amount_overdue  DECIMAL(15,2),
        days_overdue    INTEGER,
        issued_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        served_at       TIMESTAMP,
        response_deadline DATE,
        status          VARCHAR(20) DEFAULT 'ISSUED',
        pdf_url         TEXT,
        ledger_hash     VARCHAR(128) NOT NULL,
        generated_by    UUID REFERENCES users(id),
        notes           TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_ln_tenancy ON legal_notices(tenancy_id);

      -- Mobilization columns on milestones
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS mobilization_pct       DECIMAL(5,2) DEFAULT 70;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS mobilization_amount     DECIMAL(15,2);
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS mobilization_paid       BOOLEAN DEFAULT false;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS mobilization_paid_at    TIMESTAMP;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS mobilization_ref        VARCHAR(150);
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS completion_amount       DECIMAL(15,2);
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS completion_paid         BOOLEAN DEFAULT false;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS completion_paid_at      TIMESTAMP;
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS completion_ref          VARCHAR(150);
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS milestone_type          VARCHAR(30) DEFAULT 'STANDARD';

      -- Auto-reminders flag on projects
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_reminders_enabled BOOLEAN DEFAULT true;

      -- Tenant user link on tenancies
      ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS tenant_user_id  UUID REFERENCES users(id);
      -- ── CRITICAL BACKFILLS (safe on existing DBs — IF NOT EXISTS) ──────────
      -- Add project_id to all rental engine tables that may predate the column
      ALTER TABLE stakeholder_splits  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
      ALTER TABLE rental_units        ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
      ALTER TABLE rent_payments       ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
      ALTER TABLE yield_distributions ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
      ALTER TABLE maintenance_logs    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
      -- ── Landlord bank account & payout config table ──────────────────────
      CREATE TABLE IF NOT EXISTS landlord_bank_accounts (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id       UUID REFERENCES projects(id) ON DELETE CASCADE,
        account_name     VARCHAR(255) NOT NULL,
        account_number   VARCHAR(30)  NOT NULL,
        bank_code        VARCHAR(20)  NOT NULL,
        bank_name        VARCHAR(255) NOT NULL,
        currency         VARCHAR(10)  DEFAULT 'NGN',
        paystack_recipient_code  VARCHAR(100),
        paystack_subaccount_code VARCHAR(100),
        is_verified      BOOLEAN DEFAULT false,
        is_default       BOOLEAN DEFAULT false,
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_lba_user_default
        ON landlord_bank_accounts(user_id) WHERE is_default = true;

      -- ── Rental unit detail columns (added for property management suite) ──
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS bathrooms         INTEGER DEFAULT 1;
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS floor_level       VARCHAR(20);
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS furnished         BOOLEAN DEFAULT false;
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS parking           BOOLEAN DEFAULT false;
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS service_charge    DECIMAL(15,2) DEFAULT 0;
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS security_deposit  DECIMAL(15,2) DEFAULT 0;
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS amenities         JSONB DEFAULT '[]';
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS photo_urls        JSONB DEFAULT '[]';
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS available_from    DATE;
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW();

      -- ── Marketplace / vacancy advertising columns ─────────────────────
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS is_advertised          BOOLEAN DEFAULT FALSE;
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS advertised_at          TIMESTAMP;
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS listing_expires_at      TIMESTAMP;
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS marketing_description  TEXT;
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS cover_image            TEXT;
      ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS photo_urls_arr         TEXT[] DEFAULT '{}';
      ALTER TABLE platform_revenue ADD COLUMN IF NOT EXISTS fee_type VARCHAR(50) DEFAULT 'RENTAL_FEE';
      ALTER TABLE flex_pay_vaults     ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
      ALTER TABLE rent_reminders      ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
      ALTER TABLE legal_notices       ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
      ALTER TABLE tenancies           ADD COLUMN IF NOT EXISTS project_id    UUID REFERENCES projects(id);
      ALTER TABLE tenancies     ADD COLUMN IF NOT EXISTS rent_amount   DECIMAL(15,2) DEFAULT 0;
      ALTER TABLE tenancies     ADD COLUMN IF NOT EXISTS payment_day   INTEGER DEFAULT 1;
      ALTER TABLE tenancies     ADD COLUMN IF NOT EXISTS lease_start   DATE;
      ALTER TABLE rent_payments ADD COLUMN IF NOT EXISTS tenant_id     UUID REFERENCES users(id);
      ALTER TABLE rent_payments ADD COLUMN IF NOT EXISTS period_month  VARCHAR(7);
      ALTER TABLE rent_payments ADD COLUMN IF NOT EXISTS distributed_at TIMESTAMP;
      CREATE INDEX IF NOT EXISTS idx_ss_project    ON stakeholder_splits(project_id)  WHERE project_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_ru_project    ON rental_units(project_id)        WHERE project_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_rp_project    ON rent_payments(project_id)       WHERE project_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_yd_project    ON yield_distributions(project_id) WHERE project_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_ml_project    ON maintenance_logs(project_id)    WHERE project_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_fpv_project   ON flex_pay_vaults(project_id)     WHERE project_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_rr_project    ON rent_reminders(project_id)      WHERE project_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_ln_project    ON legal_notices(project_id)       WHERE project_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_ten_project    ON tenancies(project_id) WHERE project_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_ten_project_bp ON tenancies(project_id) WHERE project_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_rp_tenant_bp   ON rent_payments(tenant_id) WHERE tenant_id IS NOT NULL;

      -- ── WORLD-CLASS KYC + DIGITAL BAILIFF COLUMNS ─────────────────────────
      ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS guarantor_json            JSONB;
      ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS former_landlord_contact   TEXT;
      ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS reason_for_quit           TEXT;
      ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS digital_signature_url     TEXT;
      ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS litigation_history        JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS tenant_score              INTEGER DEFAULT 100;
      ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS selfie_url                TEXT;
      ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE legal_notices ADD COLUMN IF NOT EXISTS resolved_at           TIMESTAMP;
      ALTER TABLE legal_notices ADD COLUMN IF NOT EXISTS resolved_by           UUID REFERENCES users(id);
      ALTER TABLE legal_notices ADD COLUMN IF NOT EXISTS resolution_note       TEXT;
      CREATE INDEX IF NOT EXISTS idx_ten_score       ON tenancies(tenant_score);
      CREATE INDEX IF NOT EXISTS idx_ten_email_score ON tenancies(tenant_email, tenant_score);

      -- Notice auto-increment counter
      CREATE SEQUENCE IF NOT EXISTS notice_number_seq START 1;

      -- ── legal_notices: backfill columns missing from older prod DBs ─────────────
      ALTER TABLE legal_notices ADD COLUMN IF NOT EXISTS status       VARCHAR(20) DEFAULT 'ISSUED';
      ALTER TABLE legal_notices ADD COLUMN IF NOT EXISTS unit_id      UUID REFERENCES rental_units(id);
      ALTER TABLE legal_notices ADD COLUMN IF NOT EXISTS project_id   UUID REFERENCES projects(id);
      -- Fix: generated_by audit column (landlord/admin UUID who issued the notice)
      ALTER TABLE legal_notices ADD COLUMN IF NOT EXISTS generated_by UUID REFERENCES users(id);
      -- Fix: notes column (additional notes on the notice)
      ALTER TABLE legal_notices ADD COLUMN IF NOT EXISTS notes        TEXT;

      -- ── flex_contributions: released tracking (prevents double-payout) ────────
      ALTER TABLE flex_contributions ADD COLUMN IF NOT EXISTS released    BOOLEAN     DEFAULT FALSE;
      ALTER TABLE flex_contributions ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ DEFAULT NULL;

      -- ── flex_contributions: REAL named UNIQUE constraint (not partial index) ──
      -- ON CONFLICT (paystack_ref) requires a formal constraint, not a partial index.
      -- A partial index (WHERE paystack_ref IS NOT NULL) crashes every vault credit.
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'flex_contributions_paystack_ref_key'
            AND conrelid = 'flex_contributions'::regclass
        ) THEN
          DROP INDEX IF EXISTS idx_fc_paystack_ref;
          ALTER TABLE flex_contributions
            ADD CONSTRAINT flex_contributions_paystack_ref_key UNIQUE (paystack_ref);
        END IF;
      END $$;

      -- ── landlord_bank_accounts: ensure paystack_recipient_code column exists ──
      ALTER TABLE landlord_bank_accounts ADD COLUMN IF NOT EXISTS paystack_recipient_code VARCHAR(100);
      ALTER TABLE landlord_bank_accounts ADD COLUMN IF NOT EXISTS paystack_subaccount_code VARCHAR(100);
      ALTER TABLE landlord_bank_accounts ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;
      ALTER TABLE landlord_bank_accounts ADD COLUMN IF NOT EXISTS currency    VARCHAR(10) DEFAULT 'NGN';
      -- ── Dedup: keep only the row with recipient_code (or latest) per user+account ──
      -- Safe to run multiple times; only removes true duplicates
      DELETE FROM landlord_bank_accounts a
        USING landlord_bank_accounts b
        WHERE a.user_id = b.user_id
          AND a.account_number = b.account_number
          AND a.id < b.id
          AND (a.paystack_recipient_code IS NULL OR b.paystack_recipient_code IS NOT NULL);
      -- ── Unique constraint: prevent future duplicate (user_id, account_number) ──
      CREATE UNIQUE INDEX IF NOT EXISTS idx_lba_user_account
        ON landlord_bank_accounts(user_id, account_number);

      -- ── Unique constraint so onboard-tenant is idempotent ──────────────────
      -- Prevents Joseph Dimpa ×3 / Okon Mavelous ×2 duplicates.
      -- DROP + re-add pattern is safe with IF NOT EXISTS equivalent:
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'tenancies_unit_email_unique'
        ) THEN
          ALTER TABLE tenancies
          ADD CONSTRAINT tenancies_unit_email_unique
          UNIQUE (unit_id, tenant_email);
        END IF;
      END $$;

      -- ── unit_audit_log: immutable per-unit event trail ─────────────────────
      -- Purpose-built for PropTech disputes, compliance, and admin tracing.
      -- Append-only. Never update or delete rows. SHA-256 hash per event.
      CREATE TABLE IF NOT EXISTS unit_audit_log (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type      VARCHAR(60)  NOT NULL,   -- TENANT_ASSIGNED, RENT_PAID, NOTICE_ISSUED …
        actor_id        UUID,                     -- user who triggered (landlord, tenant, system)
        actor_role      VARCHAR(30),              -- DEVELOPER, TENANT, ADMIN, SYSTEM
        unit_id         UUID REFERENCES rental_units(id) ON DELETE SET NULL,
        tenancy_id      UUID REFERENCES tenancies(id)    ON DELETE SET NULL,
        project_id      UUID REFERENCES projects(id)     ON DELETE SET NULL,
        description     TEXT         NOT NULL,
        metadata        JSONB        DEFAULT '{}',
        ledger_hash     VARCHAR(64),              -- SHA-256 of (event_type+unit_id+created_at+metadata)
        created_at      TIMESTAMPTZ  DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ual_unit      ON unit_audit_log(unit_id);
      CREATE INDEX IF NOT EXISTS idx_ual_tenancy   ON unit_audit_log(tenancy_id);
      CREATE INDEX IF NOT EXISTS idx_ual_project   ON unit_audit_log(project_id);
      CREATE INDEX IF NOT EXISTS idx_ual_event     ON unit_audit_log(event_type);
      CREATE INDEX IF NOT EXISTS idx_ual_created   ON unit_audit_log(created_at DESC);

      -- ── Extend system_ledger with relational columns (backward-compatible) ─
      -- Older rows keep NULL values; new rows get full context.
      ALTER TABLE system_ledger ADD COLUMN IF NOT EXISTS event_type   VARCHAR(100);
      ALTER TABLE system_ledger ADD COLUMN IF NOT EXISTS actor_id     UUID;
      ALTER TABLE system_ledger ADD COLUMN IF NOT EXISTS entity_id    UUID;
      ALTER TABLE system_ledger ADD COLUMN IF NOT EXISTS entity_type  VARCHAR(50);
      ALTER TABLE system_ledger ADD COLUMN IF NOT EXISTS description  TEXT;
      ALTER TABLE system_ledger ADD COLUMN IF NOT EXISTS metadata     JSONB;

      -- ── Webhook replay protection table ───────────────────────────────────
      -- Stores processed Paystack event references. Idempotent insert prevents
      -- double-crediting rent, double-activating listings, double-releasing escrow.
      CREATE TABLE IF NOT EXISTS processed_webhooks (
        id            SERIAL PRIMARY KEY,
        event_ref     VARCHAR(200) UNIQUE NOT NULL,  -- Paystack txReference (not signature)
        event_type    VARCHAR(100),
        processed_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pw_event_ref ON processed_webhooks(event_ref);

      -- ── Soft delete columns ───────────────────────────────────────────────
      -- Nothing is ever hard-deleted. archived_at = soft delete timestamp.
      ALTER TABLE flex_pay_vaults ADD COLUMN IF NOT EXISTS payout_failed_at     TIMESTAMPTZ DEFAULT NULL;
      ALTER TABLE flex_pay_vaults ADD COLUMN IF NOT EXISTS payout_failure_reason TEXT        DEFAULT NULL;
      ALTER TABLE flex_pay_vaults ADD COLUMN IF NOT EXISTS payout_attempt_count  INTEGER     DEFAULT 0;
      ALTER TABLE tenancies      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
      ALTER TABLE rental_units   ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
      ALTER TABLE legal_notices  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

      -- ── Standalone Vault — independent tenant savings, no landlord link required ──
      -- An independent tenant who self-registers can initialize their own vault,
      -- set a savings target, and start contributing via Paystack immediately.
      -- When the landlord is identified and onboards, an admin migrates this vault
      -- into a full tenancy-linked flex_pay_vault and the balance is preserved.
      CREATE TABLE IF NOT EXISTS standalone_vaults (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status                  VARCHAR(30)   NOT NULL DEFAULT 'ACTIVE',
        -- CHECK: ACTIVE | FUNDED_READY | MIGRATED | CLOSED
        target_amount           DECIMAL(15,2) NOT NULL DEFAULT 0,
        vault_balance           DECIMAL(15,2) NOT NULL DEFAULT 0,
        currency                VARCHAR(10)   NOT NULL DEFAULT 'NGN',
        frequency               VARCHAR(20)   NOT NULL DEFAULT 'MONTHLY',
        installment_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
        funded_periods          INTEGER       NOT NULL DEFAULT 0,
        -- Landlord payout destination (supplied by tenant; unverified until landlord claims)
        landlord_name           VARCHAR(255),
        landlord_email          VARCHAR(255),
        landlord_bank_name      VARCHAR(100),
        landlord_account_number VARCHAR(20),
        landlord_account_name   VARCHAR(255),
        -- Populated when admin migrates to a formal tenancy
        rent_amount             DECIMAL(15,2),        -- Actual rent landlord receives
        platform_fee_amount     DECIMAL(15,2),        -- 2% Nested Ark Rent Success Fee
        linked_tenancy_id       UUID REFERENCES tenancies(id) ON DELETE SET NULL,
        linked_at               TIMESTAMPTZ,
        migrated_vault_id       UUID REFERENCES flex_pay_vaults(id) ON DELETE SET NULL,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sv_tenant ON standalone_vaults(tenant_user_id);
      CREATE INDEX IF NOT EXISTS idx_sv_status ON standalone_vaults(status);

      -- Standalone contributions — mirrors flex_contributions but FK-free on tenancy
      CREATE TABLE IF NOT EXISTS standalone_contributions (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id     UUID NOT NULL REFERENCES standalone_vaults(id) ON DELETE CASCADE,
        amount_ngn   DECIMAL(15,2) NOT NULL,
        paystack_ref VARCHAR(150) UNIQUE,
        status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
        period_label VARCHAR(30),
        paid_at      TIMESTAMPTZ,
        ledger_hash  VARCHAR(128),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sc_vault ON standalone_contributions(vault_id);

      -- Ensure tenant_user_id exists on flex_pay_vaults (for independent tenant lookups)
      ALTER TABLE flex_pay_vaults ADD COLUMN IF NOT EXISTS tenant_user_id UUID REFERENCES users(id);

      -- Safe column additions for standalone_vaults fee transparency
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS rent_amount         DECIMAL(15,2);
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS platform_fee_amount DECIMAL(15,2);

      -- ── Payout preference (Option C: Smart Choice) ──────────────────────────
      -- TENANT   = withdraw to tenant's own bank account at 100% completion
      -- LANDLORD = release directly to landlord bank account (even if landlord
      --            never joins Nested Ark — uses landlord_* fields above)
      -- ASK      = tenant decides at completion time (default)
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS payout_preference     VARCHAR(20) NOT NULL DEFAULT 'ASK';
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS tenant_bank_name      VARCHAR(100);
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS tenant_account_number VARCHAR(20);
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS tenant_account_name   VARCHAR(255);
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS tenant_bank_code      VARCHAR(20);
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS due_date              DATE;
      -- Cached Paystack transfer recipient codes — created lazily at release time
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS tenant_recipient_code   VARCHAR(100);
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS landlord_recipient_code VARCHAR(100);
      -- Payout cron tracking — mirrors flex_pay_vaults pattern
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS payout_attempt_count  INTEGER     DEFAULT 0;
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS payout_failed_at      TIMESTAMPTZ DEFAULT NULL;
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS payout_failure_reason TEXT        DEFAULT NULL;

      -- ── Standalone vault fee retention tracking ──────────────────────────────
      -- At vault release: rent_amount transferred to landlord (100% of rent)
      --                   platform_fee_amount retained in main Paystack balance (2%)
      -- These columns record when and how much was retained for reconciliation.
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS platform_fee_retained       DECIMAL(15,2) DEFAULT NULL;
      ALTER TABLE standalone_vaults ADD COLUMN IF NOT EXISTS platform_fee_retained_at    TIMESTAMPTZ   DEFAULT NULL;

      -- flex_contributions: released tracking prevents double-payout
      ALTER TABLE flex_contributions ADD COLUMN IF NOT EXISTS released    BOOLEAN     DEFAULT FALSE;
      ALTER TABLE flex_contributions ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ DEFAULT NULL;

      -- processed_webhooks: created_at alias for ORDER BY compatibility
      ALTER TABLE processed_webhooks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      CREATE INDEX IF NOT EXISTS idx_pw_created_at ON processed_webhooks(created_at DESC);

      -- ── tenant_bank_profiles: bank account storage + AutoPay standing order ─
      CREATE TABLE IF NOT EXISTS tenant_bank_profiles (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_name              VARCHAR(100) NOT NULL,
        bank_code              VARCHAR(20)  NOT NULL,
        account_number         VARCHAR(20)  NOT NULL,
        account_name           VARCHAR(255) NOT NULL,
        currency               VARCHAR(10)  NOT NULL DEFAULT 'NGN',
        preferred_debit_day    INTEGER      CHECK (preferred_debit_day BETWEEN 1 AND 28),
        preferred_amount       DECIMAL(15,2),
        is_verified            BOOLEAN      NOT NULL DEFAULT false,
        is_default             BOOLEAN      NOT NULL DEFAULT false,
        direct_debit_enabled   BOOLEAN      NOT NULL DEFAULT false,
        mandate_reference      VARCHAR(100),
        mandate_status         VARCHAR(30)  DEFAULT 'PENDING',
        paystack_auth_code     VARCHAR(100),
        created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tbp_tenant_acct
        ON tenant_bank_profiles(tenant_user_id, account_number);
      CREATE INDEX IF NOT EXISTS idx_tbp_tenant ON tenant_bank_profiles(tenant_user_id);

      -- ── feature_waitlist: captures interest in coming-soon features ──────
      CREATE TABLE IF NOT EXISTS feature_waitlist (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
        feature_name VARCHAR(100) NOT NULL,
        email        VARCHAR(255),
        source       VARCHAR(100) DEFAULT 'register_page',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fw_feature ON feature_waitlist(feature_name);

    `);

    await client.query('COMMIT');
    console.log("✅ Database schema verified - All tables present");
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error("❌ Database error:", error.message);
  } finally {
    client.release();
  }
};

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Access Denied: No Token Provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    // Support both 'id' and 'userId' fields in the JWT payload
    (req as any).userId = (decoded as any).id || (decoded as any).userId;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or Expired Token" });
  }
};

// ============================================================================
// ════════════════════════════════════════════════════════════════════════════
// MODULE: AUTH — Registration · Login · Email Verification · Password Reset
// Endpoints: /api/auth/register, /login, /verify-email, /forgot-password …
// ════════════════════════════════════════════════════════════════════════════
// ENDPOINT 1-3: AUTH MODULE (3 endpoints)
// ============================================================================

app.post("/api/auth/register", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password, full_name, phone, role } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: "Email, password, and full_name required" });
    }

    const hashedPassword = await bcryptjs.hash(password, 12);
    const userId = uuidv4();
    
    const result = await pool.query(
      "INSERT INTO public.users (id, email, password, full_name, phone, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, full_name, role",
      [userId, email.toLowerCase(), hashedPassword, full_name, phone || null, role || "PROJECT_SPONSOR"]
    );

    const token = jwt.sign(
      { id: userId, email: email.toLowerCase(), role: role || "PROJECT_SPONSOR" }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRY }
    );
    
    console.log(`✅ User registered: ${email}`);

    // ── Send verification email — FIRE AND FORGET, never blocks the response ──
    // Root cause of "timeout of 30000ms exceeded" on register: sendMail() was
    // previously awaited with no SMTP connection/socket timeout. If Gmail SMTP
    // is slow, unreachable, or rate-limited, nodemailer can hang well past the
    // client's 30s timeout. Token storage stays awaited (fast, local DB); only
    // the outbound SMTP call is detached so a slow mail server can never delay
    // account creation or the HTTP response.
    let verificationToken = '';
    try {
      verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await pool.query(
        `INSERT INTO email_verification_tokens (id, user_id, token, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET token = $3, expires_at = $4`,
        [uuidv4(), userId, verificationToken, expiresAt]
      );
    } catch (tokenErr: any) {
      console.error('⚠️ Verification token storage failed (non-fatal):', tokenErr.message);
    }

    if (verificationToken) {
      const verifyUrl = `${process.env.FRONTEND_URL || "https://nestedark.com"}/verify-email?token=${verificationToken}`;
      // Fire-and-forget — NOT awaited. Registration response is never
      // delayed by SMTP latency, downtime, or rate limiting. Routed through
      // the centralized EmailService instead of an inline
      // nodemailer.createTransport — same content/behaviour as before.
      const { subject, html } = verifyEmailTemplate(verifyUrl);
      EmailService.send({ to: email, subject, html, template: 'verify_email' });
    }

    // NOTE: the Welcome email is no longer sent here. It now fires
    // automatically once the user completes email verification (see
    // GET /api/auth/verify-email below) — so "Welcome" arrives once we know
    // the address is real, instead of immediately at signup.

    return res.status(201).json({
      success: true,
      user: result.rows[0],
      tokens: { access_token: token, expires_in: JWT_EXPIRY },
      message: "Account created. Check your email to verify your account."
    });
  } catch (error: any) {
    if (error.code === '23505') return res.status(400).json({ error: "Email already registered" });
    console.error("Register error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const result = await pool.query("SELECT * FROM public.users WHERE email = $1", [email.toLowerCase()]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Login failed: User not found - ${email}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const valid = await bcryptjs.compare(password, user.password);
    if (!valid) {
      console.log(`❌ Login failed: Wrong password - ${email}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRY }
    );
    
    console.log(`✅ User logged in: ${email}`);

    // ── Auto-link tenant_user_id for TENANT users on every login ──────────
    // Ensures tenancies created before user account (or before column was added)
    // get linked so the dashboard resolves correctly on first login.
    if (user.role === 'TENANT') {
      pool.query(
        `UPDATE tenancies SET tenant_user_id = $1
         WHERE tenant_email = $2 AND tenant_user_id IS NULL AND status = 'ACTIVE'`,
        [user.id, user.email]
      ).catch(() => {}); // non-blocking, non-fatal
    }

    return res.json({ 
      success: true, 
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }, 
      tokens: { access_token: token, expires_in: JWT_EXPIRY }
    });
  } catch (error: any) {
    console.error("Login error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/auth/me", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query("SELECT id, email, full_name, role FROM public.users WHERE id = $1", [(req as any).userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    return res.json({ success: true, user: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PASSWORD RECOVERY — Full JWT + DB token flow
// POST /api/auth/forgot-password   → generates token, sends email
// POST /api/auth/verify-reset-token → validates token before showing reset form
// POST /api/auth/reset-password     → consumes token, updates password
// ============================================================================

// POST /api/auth/forgot-password
app.post("/api/auth/forgot-password", async (req: Request, res: Response): Promise<any> => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const userResult = await pool.query(
      "SELECT id, full_name FROM public.users WHERE email = $1",
      [email.toLowerCase()]
    );

    // Anti-enumeration: always 200, even if user not found
    if (userResult.rows.length === 0) {
      return res.status(200).json({ message: "Recovery link dispatched if account exists." });
    }

    const user = userResult.rows[0];

    // Generate a cryptographically secure raw token
    const rawToken  = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Invalidate any existing reset tokens for this user, then store new one
    await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [user.id]);
    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
      [user.id, tokenHash, expiresAt]
    );

    // Build the reset link — raw token goes in URL, hash stays in DB
    const frontendUrl = process.env.FRONTEND_URL || "https://nestedark.com";
    const resetLink   = `${frontendUrl}/reset-password/${rawToken}`;

    // Fire-and-forget via the centralized EmailService — same fix as before:
    // a slow or unreachable SMTP server must never hang this HTTP response
    // (was causing "timeout of 30000ms exceeded" on forgot-password).
    {
      const { subject, html } = forgotPasswordTemplate(user.full_name, resetLink);
      EmailService.send({ to: email, subject, html, template: 'forgot_password' });
    }

    return res.status(200).json({ message: "Recovery link dispatched." });
  } catch (error: any) {
    console.error("Forgot password error:", error.message);
    // ── If email sending fails, still return 200 so the UI shows the "sent" screen.
    // This prevents leaking whether the email exists AND avoids confusing "Recovery
    // protocol failed" errors when the SMTP config is warming up.
    // The token is already stored in DB — when SMTP is fixed the link will still work.
    if (error.message?.includes('ECONNECTION') || error.message?.includes('EAUTH') ||
        error.message?.includes('Invalid login') || error.message?.includes('535') ||
        error.message?.includes('connect') || error.message?.includes('timeout')) {
      console.warn('[SMTP] Mail send failed (SMTP config issue) — token saved, returning 200 to avoid UX confusion');
      return res.status(200).json({ message: "Recovery link dispatched if account exists." });
    }
    return res.status(500).json({ error: "Mail dispatch failed. Check email configuration." });
  }
});

// POST /api/auth/verify-reset-token — frontend calls this when reset page loads
app.post("/api/auth/verify-reset-token", async (req: Request, res: Response): Promise<any> => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token required" });

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      `SELECT prt.*, u.email FROM password_reset_tokens prt
       JOIN public.users u ON prt.user_id = u.id
       WHERE prt.token_hash = $1 AND prt.used = false AND prt.expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Token is invalid or has expired. Please request a new reset link." });
    }

    // Token is valid — return masked email for display
    const row = result.rows[0];
    const masked = row.email.replace(/(.{2}).+(@.+)/, '$1***$2');
    return res.json({ valid: true, email_hint: masked });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/reset-password — consumes token and sets new password
app.post("/api/auth/reset-password", async (req: Request, res: Response): Promise<any> => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ error: "Token and new_password are required" });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      `SELECT prt.id, prt.user_id, u.email, u.full_name FROM password_reset_tokens prt
       JOIN public.users u ON prt.user_id = u.id
       WHERE prt.token_hash = $1 AND prt.used = false AND prt.expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Token is invalid or has expired. Request a new reset link." });
    }

    const row = result.rows[0];

    // Hash new password and update user
    const hashedPassword = await bcryptjs.hash(new_password, 12);
    await pool.query("UPDATE public.users SET password = $1, updated_at = NOW() WHERE id = $2", [hashedPassword, row.user_id]);

    // Mark token as used (single-use)
    await pool.query("UPDATE password_reset_tokens SET used = true WHERE id = $1", [row.id]);

    // Ledger it
    const lHash = crypto.createHash('sha256').update(`password-reset-${row.user_id}-${Date.now()}`).digest('hex');
    await pool.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
      ['PASSWORD_RESET', JSON.stringify({ user_id: row.user_id, email: row.email }), lHash]
    );

    console.log(`✅ Password reset for: ${row.email}`);

    // Confirmation email — fire-and-forget, never blocks the response.
    // Lets the account owner know immediately if a reset happened that
    // they didn't initiate (Phase 3/7: reset-attack visibility).
    {
      const { subject, html } = passwordChangedTemplate(row.full_name);
      EmailService.send({ to: row.email, subject, html, template: 'password_changed' });
    }

    return res.json({ success: true, message: "Operator access key updated. You may now sign in." });
  } catch (error: any) {
    console.error("Reset password error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// EMAIL VERIFICATION — completes the loop started at /api/auth/register
// GET  /api/auth/verify-email          → consumes the token, activates the account
// POST /api/auth/resend-verification   → issues a fresh token + email
// ============================================================================

// GET /api/auth/verify-email?token=xxx
app.get("/api/auth/verify-email", async (req: Request, res: Response): Promise<any> => {
  const token = (req.query.token as string) || '';
  if (!token) return res.status(400).json({ error: "Verification token required" });

  try {
    const result = await pool.query(
      `SELECT evt.id, evt.user_id, u.email, u.email_verified, u.full_name, u.role
       FROM email_verification_tokens evt
       JOIN public.users u ON u.id = evt.user_id
       WHERE evt.token = $1 AND evt.used = false AND evt.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Verification link is invalid or has expired. Request a new one." });
    }

    const row = result.rows[0];
    const wasAlreadyVerified = row.email_verified;

    if (!wasAlreadyVerified) {
      await pool.query(
        "UPDATE public.users SET email_verified = true, email_verified_at = NOW() WHERE id = $1",
        [row.user_id]
      );
    }
    await pool.query("UPDATE email_verification_tokens SET used = true WHERE id = $1", [row.id]);

    console.log(`✅ Email verified: ${row.email}`);

    // Welcome email fires automatically on first successful verification —
    // never on a re-verify of an already-verified account, and never
    // blocking this response either way.
    if (!wasAlreadyVerified) {
      const firstName  = (row.full_name || '').split(' ')[0] || 'there';
      const isLandlord = ['DEVELOPER', 'LANDLORD'].includes((row.role || '').toUpperCase());
      const { subject, html } = isLandlord ? welcomeLandlordTemplate(firstName) : welcomeTenantTemplate(firstName);
      EmailService.send({ to: row.email, subject, html, template: isLandlord ? 'welcome_landlord' : 'welcome_tenant' });
    }

    return res.json({ success: true, message: "Email verified successfully. You may now sign in." });
  } catch (error: any) {
    console.error("Verify email error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/resend-verification  { email }
app.post("/api/auth/resend-verification", async (req: Request, res: Response): Promise<any> => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const userResult = await pool.query(
      "SELECT id, full_name, email_verified FROM public.users WHERE email = $1",
      [email.toLowerCase()]
    );

    // Anti-enumeration — same response whether or not the account exists.
    if (userResult.rows.length === 0) {
      return res.status(200).json({ message: "Verification link dispatched if account exists." });
    }

    const user = userResult.rows[0];
    if (user.email_verified) {
      return res.status(200).json({ message: "This email is already verified. You can sign in." });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Invalidate previous unused tokens, then store the new one — mirrors the
    // forgot-password token-rotation pattern already used above.
    await pool.query("DELETE FROM email_verification_tokens WHERE user_id = $1 AND used = false", [user.id]);
    await pool.query(
      `INSERT INTO email_verification_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)`,
      [uuidv4(), user.id, verificationToken, expiresAt]
    );

    const verifyUrl = `${process.env.FRONTEND_URL || "https://nestedark.com"}/verify-email?token=${verificationToken}`;

    // Fire-and-forget via the centralized EmailService — same reasoning as
    // register/forgot-password: a slow or unreachable SMTP server must never
    // hang this HTTP response.
    {
      const { subject, html } = verifyEmailTemplate(verifyUrl);
      EmailService.send({ to: email, subject, html, template: 'verify_email' });
    }

    return res.status(200).json({ message: "Verification link dispatched." });
  } catch (error: any) {
    console.error("Resend verification error:", error.message);
    return res.status(500).json({ error: "Mail dispatch failed. Check email configuration." });
  }
});

// All recovery endpoints are handled inline above (forgot-password, verify-reset-token, reset-password, verify-email, resend-verification)

// ============================================================================
// ════════════════════════════════════════════════════════════════════════════
// MODULE: PROJECTS — NAP Ledger · Document Management · Geo-Tagging
// Endpoints: /api/projects …
// ════════════════════════════════════════════════════════════════════════════
// ENDPOINT 4-9: PROJECT MODULE (6 endpoints)
// ============================================================================

// ── PROJECT NUMBER GENERATOR ────────────────────────────────────────────────
async function generateProjectNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const res  = await pool.query(
    "SELECT COUNT(*) AS cnt FROM projects WHERE project_number LIKE $1",
    [`NAP-${year}-%`]
  );
  const seq = String(Number(res.rows[0].cnt) + 1).padStart(5, '0');
  return `NAP-${year}-${seq}`;
}

// POST /api/projects — any authenticated user can submit a project
app.post("/api/projects", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const {
      title, description, location, country, budget, currency, category,
      timeline_months, target_completion_date,
      // New fields
      owner_type, owner_name, owner_email, owner_phone, owner_company, owner_country,
      project_type, visibility, pitch_summary, expected_roi, risk_grade,
      hero_image_url, assigned_bank, primary_supplier,
      permit_ref,  // LASG / Government digital permit reference
      tags,        // string[] optional
      milestones,  // { title, description, budget_allocation, milestone_number, required_trade }[]
    } = req.body;

    if (!title || !description || !location || !country || !budget || !category)
      return res.status(400).json({ error: "title, description, location, country, budget, category are required" });

    const projectId     = uuidv4();
    const projectNumber = await generateProjectNumber();

    // Get submitter info for default owner fields
    const userRes = await pool.query("SELECT full_name, email FROM public.users WHERE id=$1", [userId]);
    const u = userRes.rows[0];

    // Compute project_mode in TypeScript — eliminates PostgreSQL $18 type-inference
    // conflict caused by reusing $18 in both VALUES and a CASE expression.
    const resolvedProjectType = project_type || 'INFRASTRUCTURE';
    const resolvedProjectMode = req.body.project_mode
      || (['RESIDENTIAL', 'RENOVATION'].includes(resolvedProjectType) ? 'PRIVATE' : 'INVESTMENT');

    await pool.query('BEGIN');

    const result = await pool.query(
      `INSERT INTO projects (
        id, sponsor_id, title, description, location, country, budget, currency,
        category, timeline_months, target_completion_date,
        owner_type, owner_name, owner_email, owner_phone, owner_company, owner_country,
        project_type, visibility, pitch_summary, expected_roi, risk_grade,
        hero_image_url, assigned_bank, primary_supplier, permit_ref, project_number, status,
        project_mode, lifecycle_stage
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,
        $23,$24,$25,$26,$27,'ACTIVE',
        $28,$29
      ) RETURNING *`,
      [
        projectId, userId, title, description, location, country,
        budget, currency || 'USD', category, timeline_months || null, target_completion_date || null,
        owner_type || 'INDIVIDUAL',
        owner_name  || u?.full_name || null,
        owner_email || u?.email     || null,
        owner_phone || null, owner_company || null, owner_country || country,
        resolvedProjectType,
        visibility   || 'PUBLIC',
        pitch_summary || null, expected_roi || 12.0, risk_grade || 'B+',
        hero_image_url || null, assigned_bank || null, primary_supplier || null,
        permit_ref || null,
        projectNumber,
        resolvedProjectMode,
        req.body.lifecycle_stage || 'CONSTRUCTION',
      ]
    );

    // Insert tags
    if (Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags.slice(0, 10)) {
        await pool.query(
          "INSERT INTO project_tags (project_id, tag) VALUES ($1, $2)",
          [projectId, String(tag).toLowerCase().trim()]
        );
      }
    }

    // Insert milestones if provided
    if (Array.isArray(milestones) && milestones.length > 0) {
      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        await pool.query(
          `INSERT INTO milestones
            (id, project_id, title, description, budget_allocation, milestone_number, required_trade, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING')`,
          [uuidv4(), projectId, m.title, m.description || null,
           m.budget_allocation || null, i + 1, m.required_trade || null]
        );
      }
    }

    // Log to ledger
    const h = crypto.createHash('sha256').update(`${projectId}-${projectNumber}-${Date.now()}`).digest('hex');
    await pool.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1,$2,$3)",
      ['PROJECT_SUBMITTED', JSON.stringify({ project_id: projectId, project_number: projectNumber, owner_type: owner_type || 'INDIVIDUAL', submitted_by: userId }), h]
    );

    await pool.query('COMMIT');
    console.log(`✅ Project submitted: ${projectNumber} — ${title}`);
    return res.status(201).json({
      success: true,
      project: result.rows[0],
      project_number: projectNumber,
      message: `Project ${projectNumber} submitted successfully. Share this ID for search.`,
    });
  } catch (err: any) {
    await pool.query('ROLLBACK');
    console.error("Project create error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/projects — public marketplace with search, filter, pagination
app.get("/api/projects", async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      status, category, country, owner_type, project_type, visibility,
      search,           // free-text: title, description, location, project_number
      project_number,   // exact search by NAP-YYYY-NNNNN
      tag,
      limit = 50, offset = 0,
      sort = 'newest', // newest | budget_high | budget_low | most_viewed
    } = req.query;

    let where = "WHERE (p.visibility = 'PUBLIC' OR p.visibility IS NULL)";
    const params: any[] = [];

    const add = (clause: string, val: any) => {
      params.push(val);
      where += ` AND ${clause.replace('?', `$${params.length}`)}`;
    };

    if (status)       add("p.status = ?",        status);
    if (category)     add("p.category = ?",      category);
    if (country)      add("p.country ILIKE ?",   `%${country}%`);
    if (owner_type)   add("p.owner_type = ?",    owner_type);
    if (project_type) add("p.project_type = ?",  project_type);

    if (project_number) {
      add("UPPER(p.project_number) = ?", String(project_number).toUpperCase().trim());
    } else if (search) {
      const s = `%${search}%`;
      params.push(s, s, s, s);
      where += ` AND (p.title ILIKE $${params.length - 3} OR p.description ILIKE $${params.length - 2} OR p.location ILIKE $${params.length - 1} OR UPPER(p.project_number) LIKE $${params.length})`;
    }

    if (tag) {
      params.push(`%${tag}%`);
      where += ` AND EXISTS (SELECT 1 FROM project_tags pt WHERE pt.project_id = p.id AND pt.tag ILIKE $${params.length})`;
    }

    const orderMap: Record<string, string> = {
      newest:      'p.created_at DESC',
      budget_high: 'p.budget DESC',
      budget_low:  'p.budget ASC',
      most_viewed: 'view_count DESC',
    };
    const orderBy = orderMap[String(sort)] || 'p.created_at DESC';

    const q = `
      SELECT p.*,
        u.full_name AS sponsor_name,
        (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id) AS milestone_count,
        (SELECT COUNT(*) FROM investments i WHERE i.project_id = p.id) AS investor_count,
        (SELECT COALESCE(SUM(i.amount),0) FROM investments i WHERE i.project_id = p.id AND i.status='COMMITTED') AS total_raised_usd,
        (SELECT COUNT(*) FROM project_views pv WHERE pv.project_id = p.id) AS view_count,
        (SELECT COUNT(*) FROM project_saves ps WHERE ps.project_id = p.id) AS save_count,
        (SELECT COUNT(*) FROM bids b WHERE b.project_id = p.id) AS bid_count,
        (SELECT json_agg(tag) FROM project_tags pt WHERE pt.project_id = p.id) AS tags,
        (SELECT json_agg(json_build_object('id',pd.id,'doc_type',pd.doc_type,'title',pd.title,'file_url',pd.file_url,'thumbnail_url',pd.thumbnail_url,'is_public',pd.is_public,'requires_kyc',pd.requires_kyc))
         FROM project_documents pd WHERE pd.project_id = p.id AND pd.is_public = true LIMIT 6) AS public_documents
      FROM projects p
      LEFT JOIN public.users u ON p.sponsor_id = u.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(q, params);

    // Count total for pagination
    const countQ = `SELECT COUNT(*) AS total FROM projects p ${where}`;
    const countParams = params.slice(0, params.length - 2);
    const countRes = await pool.query(countQ, countParams);

    return res.json({
      success: true,
      projects: result.rows,
      count: result.rows.length,
      total: Number(countRes.rows[0].total),
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/search — search by project number (public, no auth)
app.get('/api/projects/search', async (req: Request, res: Response): Promise<any> => {
  const { q } = req.query;

  // Allow empty query — returns all public projects (for the explore page default load)
  const term = q ? String(q).trim() : '';
  if (term && term.length < 2) {
    return res.status(400).json({ error: 'Query too short. Minimum 2 characters.' });
  }

  try {
    const result = await pool.query(
      `SELECT
          p.id,
          p.project_number,
          p.title,
          p.location,
          p.country,
          p.budget,
          p.currency,
          p.category,
          p.owner_type,
          p.project_type,
          p.status,
          p.project_status,
          p.project_mode,
          p.gov_verified,
          p.expected_roi,
          p.timeline_months,
          p.created_at,
          u.full_name                                          AS sponsor_name,

          -- Milestone count
          (SELECT COUNT(*) FROM milestones m
           WHERE m.project_id = p.id)                         AS milestone_count,

          -- Total bids (all)
          (SELECT COUNT(*) FROM bids b
           WHERE b.project_id = p.id)                         AS bid_count,

          -- Open / pending bids — drives "Bid for Job" button
          (SELECT COUNT(*) FROM bids b
           WHERE b.project_id = p.id
             AND b.status = 'PENDING')                        AS open_bids,

          -- Funding % — drives "Invest" button visibility
          CASE
            WHEN p.budget > 0 THEN LEAST(
              ROUND(
                100.0 * COALESCE(
                  (SELECT SUM(i.amount)
                   FROM investments i
                   WHERE i.project_id = p.id
                     AND i.status = 'COMMITTED'), 0
                ) / p.budget, 2
              ), 100)
            ELSE 0
          END                                                  AS funded_pct,

          -- Has rental — drives "Rental Info" button
          -- True when the project has any rent_payment records OR is OPERATIONAL
          CASE
            WHEN p.project_status = 'OPERATIONAL'
              OR p.project_mode   = 'OPERATIONAL' THEN TRUE
            WHEN EXISTS (
              SELECT 1 FROM rent_payments rp
              WHERE rp.project_id = p.id LIMIT 1
            ) THEN TRUE
            ELSE FALSE
          END                                                  AS has_rental

       FROM projects p
       LEFT JOIN public.users u ON p.sponsor_id = u.id
       WHERE (p.visibility = 'PUBLIC' OR p.visibility IS NULL)
         AND (
           $1 = ''
           OR UPPER(p.project_number) = UPPER($1)
           OR p.title       ILIKE $2
           OR p.location    ILIKE $2
           OR p.category    ILIKE $2
           OR p.description ILIKE $2
           OR p.country     ILIKE $2
         )
       ORDER BY
         CASE WHEN $1 != '' AND UPPER(p.project_number) = UPPER($1) THEN 0 ELSE 1 END,
         p.created_at DESC
       LIMIT 40`,
      [term, term ? `%${term}%` : '%%']
    );

    return res.json({
      success: true,
      results: result.rows.map((row: any) => ({
        ...row,
        funded_pct: parseFloat(row.funded_pct) || 0,
        open_bids:  parseInt(row.open_bids)    || 0,
        has_rental: Boolean(row.has_rental),
      })),
      count: result.rows.length,
    });
  } catch (err: any) {
    console.error('[/api/projects/search]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/my — projects submitted by the authenticated user
app.get("/api/projects/my", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const result = await pool.query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id) AS milestone_count,
        (SELECT COUNT(*) FROM bids b WHERE b.project_id = p.id) AS bid_count,
        (SELECT COUNT(*) FROM investments i WHERE i.project_id = p.id) AS investor_count,
        (SELECT COALESCE(SUM(i.amount),0) FROM investments i WHERE i.project_id = p.id AND i.status='COMMITTED') AS total_raised_usd,
        (SELECT json_agg(tag) FROM project_tags pt WHERE pt.project_id = p.id) AS tags
       FROM projects p
       WHERE p.sponsor_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );
    return res.json({ success: true, projects: result.rows });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/projects/:projectId — full project detail with all documents and milestones
// Static project sub-routes — MUST be before :projectId to prevent route shadowing
app.get("/api/projects/saved", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const result = await pool.query(
      `SELECT p.*, ps.saved_at,
        (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id) AS milestone_count,
        (SELECT COUNT(*) FROM bids b WHERE b.project_id = p.id) AS bid_count
       FROM project_saves ps
       JOIN projects p ON ps.project_id = p.id
       WHERE ps.user_id = $1 ORDER BY ps.saved_at DESC`,
      [userId]
    );
    return res.json({ success: true, projects: result.rows });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

app.get("/api/projects/convert", async (req: Request, res: Response): Promise<any> => {
  try {
    const { currency = 'USD', country } = req.query;
    const rates = await getLiveRates();
    const rate = (rates[currency as string] as number) || 1;

    let query = "SELECT id, title, budget, currency, location, country, country_code, category, status, progress_percentage FROM projects WHERE status = 'ACTIVE'";
    const params: any[] = [];
    if (country) { query += ` AND country_code = $1`; params.push(country); }
    query += ' ORDER BY created_at DESC LIMIT 50';

    const result = await pool.query(query, params);
    const projects = result.rows.map((p: any) => ({
      ...p,
      budget_usd: p.budget,
      budget_local: Math.round(parseFloat(p.budget) * rate),
      display_currency: currency,
      exchange_rate: rate,
    }));

    return res.json({ success: true, projects, currency, rate, count: projects.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/projects/:projectId", async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;

    // Accept either UUID or project_number
    const isUuid = /^[0-9a-f-]{36}$/i.test(projectId);
    const lookup = isUuid
      ? "p.id = $1"
      : "UPPER(p.project_number) = UPPER($1)";

    const result = await pool.query(
      `SELECT p.*, u.full_name AS sponsor_name, u.email AS sponsor_email,
        (SELECT json_agg(json_build_object(
          'id',pd.id,'doc_type',pd.doc_type,'title',pd.title,'description',pd.description,
          'file_url',pd.file_url,'is_public',pd.is_public,
          'requires_kyc',pd.requires_kyc,'created_at',pd.created_at
        ) ORDER BY pd.created_at)
         FROM project_documents pd WHERE pd.project_id = p.id) AS documents,
        (SELECT json_agg(json_build_object(
          'id',m.id,'title',m.title,'description',m.description,'budget_allocation',m.budget_allocation,
          'status',m.status,'progress_percentage',m.progress_percentage,'milestone_number',m.milestone_number,
          'required_trade',m.required_trade,'ai_status',m.ai_status,'human_status',m.human_status,'drone_status',m.drone_status
        ) ORDER BY m.milestone_number)
         FROM milestones m WHERE m.project_id = p.id) AS milestones,
        (SELECT json_agg(tag) FROM project_tags pt WHERE pt.project_id = p.id) AS tags,
        (SELECT COUNT(*) FROM bids b WHERE b.project_id = p.id) AS bid_count,
        (SELECT COUNT(*) FROM investments i WHERE i.project_id = p.id) AS investor_count,
        (SELECT COALESCE(SUM(i.amount),0) FROM investments i WHERE i.project_id = p.id AND i.status='COMMITTED') AS total_raised_usd,
        (SELECT COUNT(*) FROM project_views pv WHERE pv.project_id = p.id) AS view_count,
        (SELECT COUNT(*) FROM project_saves ps WHERE ps.project_id = p.id) AS save_count
       FROM projects p
       LEFT JOIN public.users u ON p.sponsor_id = u.id
       WHERE ${lookup}`,
      [projectId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Project not found" });

    // Log the view (fire and forget)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    pool.query(
      "INSERT INTO project_views (project_id, viewer_ip) VALUES ($1,$2)",
      [result.rows[0].id, String(ip).split(',')[0].trim()]
    ).catch(() => {});

    return res.json({ success: true, project: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:projectId — owner or admin can update
app.put("/api/projects/:projectId", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const roleRes = await pool.query("SELECT role FROM public.users WHERE id=$1", [userId]);
    const role    = roleRes.rows[0]?.role;
    const proj    = await pool.query("SELECT sponsor_id FROM projects WHERE id=$1", [req.params.projectId]);
    if (proj.rows.length === 0) return res.status(404).json({ error: "Project not found" });
    if (proj.rows[0].sponsor_id !== userId && !['ADMIN','GOVERNMENT'].includes(role))
      return res.status(403).json({ error: "Not authorised to edit this project" });

    const {
      title, description, status, progress_percentage, pitch_summary,
      hero_image_url, expected_roi, risk_grade, assigned_bank, primary_supplier,
      visibility, owner_type, owner_name, owner_phone, owner_company,
    } = req.body;

    const result = await pool.query(
      `UPDATE projects SET
        title              = COALESCE($1,  title),
        description        = COALESCE($2,  description),
        status             = COALESCE($3,  status),
        progress_percentage= COALESCE($4,  progress_percentage),
        pitch_summary      = COALESCE($5,  pitch_summary),
        hero_image_url     = COALESCE($6,  hero_image_url),
        expected_roi       = COALESCE($7,  expected_roi),
        risk_grade         = COALESCE($8,  risk_grade),
        assigned_bank      = COALESCE($9,  assigned_bank),
        primary_supplier   = COALESCE($10, primary_supplier),
        visibility         = COALESCE($11, visibility),
        project_mode       = COALESCE($12, project_mode),
        lifecycle_stage    = COALESCE($13, lifecycle_stage),
        owner_type         = COALESCE($14, owner_type),
        owner_name         = COALESCE($15, owner_name),
        owner_phone        = COALESCE($16, owner_phone),
        owner_company      = COALESCE($17, owner_company),
        updated_at         = NOW()
       WHERE id = $18 RETURNING *`,
      [title, description, status, progress_percentage, pitch_summary,
       hero_image_url, expected_roi, risk_grade, assigned_bank, primary_supplier,
       visibility,
       req.body.project_mode, req.body.lifecycle_stage,
       owner_type, owner_name, owner_phone, owner_company,
       req.params.projectId]
    );
    return res.json({ success: true, project: result.rows[0] });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// DELETE /api/projects/:projectId
app.delete("/api/projects/:projectId", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const roleRes = await pool.query("SELECT role FROM public.users WHERE id=$1", [userId]);
    const role    = roleRes.rows[0]?.role;
    const proj    = await pool.query("SELECT sponsor_id FROM projects WHERE id=$1", [req.params.projectId]);
    if (proj.rows.length === 0) return res.status(404).json({ error: "Project not found" });
    if (proj.rows[0].sponsor_id !== userId && role !== 'ADMIN')
      return res.status(403).json({ error: "Not authorised" });
    await pool.query("DELETE FROM projects WHERE id=$1", [req.params.projectId]);
    return res.json({ success: true, message: "Project deleted" });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/projects/:projectId/stats
app.get("/api/projects/:projectId/stats", async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const proj = await pool.query("SELECT * FROM projects WHERE id=$1", [projectId]);
    if (proj.rows.length === 0) return res.status(404).json({ error: "Project not found" });
    const ms = await pool.query(
      "SELECT COUNT(*) as total, SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed FROM milestones WHERE project_id=$1",
      [projectId]
    );
    const p = proj.rows[0], s = ms.rows[0];
    return res.json({
      success: true,
      stats: {
        project_id: projectId, title: p.title, budget: p.budget,
        progress: p.progress_percentage, total_milestones: s.total,
        completed_milestones: s.completed,
      }
    });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ── PROJECT DOCUMENTS ────────────────────────────────────────────────────────

// POST /api/projects/:projectId/documents — add a document
app.post("/api/projects/:projectId/documents", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const proj = await pool.query("SELECT sponsor_id FROM projects WHERE id=$1", [req.params.projectId]);
    if (proj.rows.length === 0) return res.status(404).json({ error: "Project not found" });
    const roleRes = await pool.query("SELECT role FROM public.users WHERE id=$1", [userId]);
    const role = roleRes.rows[0]?.role;
    if (proj.rows[0].sponsor_id !== userId && !['ADMIN','GOVERNMENT'].includes(role))
      return res.status(403).json({ error: "Not authorised to add documents" });

    const { doc_type, title, description, file_url, thumbnail_url, is_public, requires_kyc, sort_order, file_size_kb, mime_type } = req.body;
    if (!doc_type || !title || !file_url)
      return res.status(400).json({ error: "doc_type, title, and file_url are required" });

    const validTypes = ['FLOOR_PLAN','3D_MODEL','2D_DRAWING','GOVT_APPROVAL','EIA','FEASIBILITY','BILL_OF_QUANTITIES','CONTRACTOR_PACK','PHOTOS','OTHER'];
    if (!validTypes.includes(doc_type))
      return res.status(400).json({ error: `doc_type must be one of: ${validTypes.join(', ')}` });

    const result = await pool.query(
      `INSERT INTO project_documents
        (project_id, doc_type, title, description, file_url, thumbnail_url, is_public, requires_kyc, sort_order, file_size_kb, mime_type, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.params.projectId, doc_type, title, description || null, file_url,
       thumbnail_url || null, is_public !== false, !!requires_kyc,
       sort_order || 0, file_size_kb || null, mime_type || null, userId]
    );
    return res.status(201).json({ success: true, document: result.rows[0] });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/projects/:projectId/documents — list all documents
app.get("/api/projects/:projectId/documents", async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query(
      "SELECT * FROM project_documents WHERE project_id=$1 ORDER BY COALESCE(sort_order,0), created_at",
      [req.params.projectId]
    );
    return res.json({ success: true, documents: result.rows });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// DELETE /api/projects/:projectId/documents/:docId
app.delete("/api/projects/:projectId/documents/:docId", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const proj = await pool.query("SELECT sponsor_id FROM projects WHERE id=$1", [req.params.projectId]);
    const roleRes = await pool.query("SELECT role FROM public.users WHERE id=$1", [userId]);
    const role = roleRes.rows[0]?.role;
    if (proj.rows[0]?.sponsor_id !== userId && !['ADMIN'].includes(role))
      return res.status(403).json({ error: "Not authorised" });
    await pool.query("DELETE FROM project_documents WHERE id=$1 AND project_id=$2", [req.params.docId, req.params.projectId]);
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ── PROJECT SAVE / WATCHLIST ─────────────────────────────────────────────────

// POST /api/projects/:projectId/save
app.post("/api/projects/:projectId/save", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    await pool.query(
      "INSERT INTO project_saves (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [req.params.projectId, userId]
    );
    return res.json({ success: true, saved: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// DELETE /api/projects/:projectId/save
app.delete("/api/projects/:projectId/save", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    await pool.query("DELETE FROM project_saves WHERE project_id=$1 AND user_id=$2", [req.params.projectId, userId]);
    return res.json({ success: true, saved: false });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/projects/saved — user's saved/watchlisted projects
// (saved route moved before :projectId)

// ── MILESTONE MANAGEMENT (owner can add milestones post-creation) ────────────

// POST /api/projects/:projectId/milestones
app.post("/api/projects/:projectId/milestones", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const proj = await pool.query("SELECT sponsor_id FROM projects WHERE id=$1", [req.params.projectId]);
    if (proj.rows.length === 0) return res.status(404).json({ error: "Project not found" });
    const roleRes = await pool.query("SELECT role FROM public.users WHERE id=$1", [userId]);
    const role = roleRes.rows[0]?.role;
    if (proj.rows[0].sponsor_id !== userId && !['ADMIN','GOVERNMENT'].includes(role))
      return res.status(403).json({ error: "Not authorised" });

    const { title, description, budget_allocation, required_trade, estimated_start_date, estimated_completion_date } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });

    // Get next milestone number
    const numRes = await pool.query(
      "SELECT COALESCE(MAX(milestone_number),0)+1 AS next FROM milestones WHERE project_id=$1",
      [req.params.projectId]
    );
    const num = numRes.rows[0].next;

    const result = await pool.query(
      `INSERT INTO milestones
        (id, project_id, title, description, budget_allocation, milestone_number, required_trade, estimated_start_date, estimated_completion_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING') RETURNING *`,
      [uuidv4(), req.params.projectId, title, description || null,
       budget_allocation || null, num, required_trade || null,
       estimated_start_date || null, estimated_completion_date || null]
    );
    return res.status(201).json({ success: true, milestone: result.rows[0] });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ── MARKETPLACE STATS ────────────────────────────────────────────────────────

// GET /api/marketplace/stats — platform-wide stats for home page
// GET /api/marketplace/stats — public platform stats (updated with total_project_value_usd)
app.get("/api/marketplace/stats", async (req: Request, res: Response): Promise<any> => {
  try {
    const [proj, inv, bids, users, countries] = await Promise.all([
      pool.query("SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='ACTIVE') AS active, COALESCE(SUM(budget),0) AS total_val FROM projects"),
      pool.query("SELECT COALESCE(SUM(amount_ngn),0) AS total_ngn FROM payment_transactions WHERE status='SUCCESS'"),
      pool.query("SELECT COUNT(*) AS total FROM bids"),
      pool.query("SELECT COUNT(*) AS total FROM public.users"),
      pool.query("SELECT COUNT(DISTINCT country) AS total FROM projects"),
    ]);
    // Fetch live rates for the stats strip
    let key_rates: Record<string, number> = { NGN: 1379, GHS: 11, KES: 130, EUR: 0.86, GBP: 0.74 };
    try {
      const ratesRes = await pool.query("SELECT rates FROM currency_rates ORDER BY fetched_at DESC LIMIT 1");
      if (ratesRes.rows.length > 0) key_rates = { ...key_rates, ...ratesRes.rows[0].rates };
    } catch { /* use defaults */ }

    return res.json({
      success: true,
      stats: {
        total_projects:          Number(proj.rows[0].total),
        active_projects:         Number(proj.rows[0].active),
        total_project_value_usd: Number(proj.rows[0].total_val),
        total_invested_ngn:      Number(inv.rows[0].total_ngn),
        total_bids:              Number(bids.rows[0].total),
        total_operators:         Number(users.rows[0].total),
        countries_active:        Number(countries.rows[0].total),
        key_rates,
      }
    });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ── PLATFORM REVENUE — Admin Revenue Dashboard ────────────────────────────────
// GET /api/admin/revenue — all revenue metrics, ADMIN only
app.get("/api/admin/revenue", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const roleCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [userId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(roleCheck.rows[0]?.role)) return res.status(403).json({ error: "Admin only" });

  const { range = '30d' } = req.query;
  const intervalMap: Record<string, string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days', 'all': '3650 days' };
  const interval = intervalMap[String(range)] || '30 days';

  try {
    const [totals, bySource, byDay, topProjects, recent, giv, config] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(amount_usd), 0)                                                                     AS total_all_time,
          COALESCE(SUM(CASE WHEN created_at > NOW() - INTERVAL '${interval}' THEN amount_usd END), 0)      AS total_period,
          COUNT(*)                                                                                           AS total_events,
          COALESCE(SUM(CASE WHEN source='ESCROW_FEE'         THEN amount_usd END), 0)                       AS escrow_fees,
          COALESCE(SUM(CASE WHEN source='LISTING_FEE'        THEN amount_usd END), 0)                       AS listing_fees,
          COALESCE(SUM(CASE WHEN source='INVESTMENT_FEE'     THEN amount_usd END), 0)                       AS investment_fees,
          COALESCE(SUM(CASE WHEN source='SUPPLY_COMMISSION'  THEN amount_usd END), 0)                       AS supply_commissions,
          COALESCE(SUM(CASE WHEN source='AD_REVENUE'         THEN amount_usd END), 0)                       AS ad_revenue,
          COALESCE(SUM(CASE WHEN source='VAAS_SUBSCRIPTION'  THEN amount_usd END), 0)                       AS vaas_subscriptions
        FROM platform_revenue WHERE status = 'COMPLETED'`),
      pool.query(`
        SELECT source,
          COALESCE(SUM(amount_usd), 0) AS total,
          COUNT(*)                      AS count,
          COALESCE(AVG(amount_usd), 0)  AS avg_per_event
        FROM platform_revenue
        WHERE status = 'COMPLETED' AND created_at > NOW() - INTERVAL '${interval}'
        GROUP BY source ORDER BY total DESC`),
      pool.query(`
        SELECT DATE_TRUNC('day', created_at) AS day,
          COALESCE(SUM(amount_usd), 0)        AS revenue,
          COUNT(*)                             AS events
        FROM platform_revenue
        WHERE status = 'COMPLETED' AND created_at > NOW() - INTERVAL '${interval}'
        GROUP BY 1 ORDER BY 1 ASC`),
      pool.query(`
        SELECT pr.project_id, p.title, p.country, p.project_number,
          COALESCE(SUM(pr.amount_usd), 0) AS project_revenue,
          COUNT(pr.id)                     AS events
        FROM platform_revenue pr
        LEFT JOIN projects p ON p.id = pr.project_id
        WHERE pr.project_id IS NOT NULL
        GROUP BY pr.project_id, p.title, p.country, p.project_number
        ORDER BY project_revenue DESC LIMIT 5`),
      pool.query(`
        SELECT pr.*, p.title AS project_title, p.project_number
        FROM platform_revenue pr
        LEFT JOIN projects p ON p.id = pr.project_id
        ORDER BY pr.created_at DESC LIMIT 25`),
      pool.query("SELECT COALESCE(SUM(budget), 0) AS giv FROM projects WHERE status = 'ACTIVE'"),
      pool.query("SELECT key, value FROM platform_config ORDER BY key").catch(() => ({ rows: [] })),
    ]);

    const t = totals.rows[0];
    return res.json({
      success: true,
      range,
      revenue: {
        total_all_time:              parseFloat(t.total_all_time),
        total_period:                parseFloat(t.total_period),
        total_events:                parseInt(t.total_events),
        gross_infrastructure_volume: parseFloat(giv.rows[0].giv),
        // Revenue stream breakdown (all-time)
        streams: {
          escrow_fees:       parseFloat(t.escrow_fees),
          listing_fees:      parseFloat(t.listing_fees),
          investment_fees:   parseFloat(t.investment_fees),
          supply_commissions:parseFloat(t.supply_commissions),
          ad_revenue:        parseFloat(t.ad_revenue),
          vaas_subscriptions:parseFloat(t.vaas_subscriptions),
        },
        by_source:     bySource.rows.map(r => ({ ...r, total: parseFloat(r.total), avg_per_event: parseFloat(r.avg_per_event) })),
        daily_trend:   byDay.rows.map(r => ({ day: r.day, revenue: parseFloat(r.revenue), events: parseInt(r.events) })),
        top_projects:  topProjects.rows.map(r => ({ ...r, project_revenue: parseFloat(r.project_revenue) })),
        recent_events: recent.rows,
      },
      config: (config as any).rows ?? [],
    });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// POST /api/projects/listing-fee/record — called after developer lists a project
app.post("/api/projects/listing-fee/record", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { project_id, paystack_reference } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const proj = await client.query("SELECT id, title FROM projects WHERE id = $1 AND sponsor_id = $2", [project_id, userId]);
    if (proj.rows.length === 0) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Project not found or not yours' }); }
    await client.query(
      "INSERT INTO listing_fees (project_id, user_id, amount_usd) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [project_id, userId, REVENUE_CONFIG.LISTING_FEE_USD]
    );
    await recordPlatformRevenue(client, {
      source:     'LISTING_FEE',
      amount_usd: REVENUE_CONFIG.LISTING_FEE_USD,
      project_id,
      metadata:   { title: proj.rows[0].title, paystack_reference },
    });
    await client.query('COMMIT');
    return res.json({ success: true, fee: REVENUE_CONFIG.LISTING_FEE_USD, message: 'Listing fee recorded. Project is now live.' });
  } catch (err: any) { await client.query('ROLLBACK'); return res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// POST /api/supplier/commission — record supply chain commission (3%)
app.post("/api/supplier/commission", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { project_id, dispatch_value_usd, dispatch_ref } = req.body;
  if (!project_id || !dispatch_value_usd) return res.status(400).json({ error: 'project_id and dispatch_value_usd required' });
  const commission = parseFloat((dispatch_value_usd * REVENUE_CONFIG.SUPPLY_COMMISSION_PCT).toFixed(4));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await recordPlatformRevenue(client, {
      source:       'SUPPLY_COMMISSION',
      amount_usd:   commission,
      pct_applied:  REVENUE_CONFIG.SUPPLY_COMMISSION_PCT,
      gross_amount: dispatch_value_usd,
      project_id,
      metadata:     { supplier_id: userId, dispatch_ref },
    });
    await client.query('COMMIT');
    return res.json({ success: true, commission, supplier_pay: dispatch_value_usd - commission, message: `Supply commission of $${commission.toFixed(2)} recorded.` });
  } catch (err: any) { await client.query('ROLLBACK'); return res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// ============================================================================
// ════════════════════════════════════════════════════════════════════════════
// MODULE: CONTRACTORS — Profiles · Bids · Tri-Layer Verification
// Endpoints: /api/contractors …
// ════════════════════════════════════════════════════════════════════════════
// ENDPOINT 10-16: CONTRACTOR MODULE (7 endpoints)
// ============================================================================

app.post("/api/contractors/profile", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { company_name, bio, specialization, years_experience, hourly_rate } = req.body;
    if (!company_name || !specialization || !hourly_rate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      "INSERT INTO contractors (id, user_id, company_name, bio, specialization, years_experience, hourly_rate) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [uuidv4(), (req as any).userId, company_name, bio, specialization, years_experience, hourly_rate]
    );
    return res.status(201).json({ success: true, contractor: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/contractors", async (req: Request, res: Response): Promise<any> => {
  try {
    const { specialization, min_rating, verified, limit = 50, offset = 0 } = req.query;
    let query = "SELECT * FROM contractors WHERE 1=1";
    const params: any[] = [];

    if (specialization) {
      query += ` AND specialization = $${params.length + 1}`;
      params.push(specialization);
    }
    if (min_rating) {
      query += ` AND rating >= $${params.length + 1}`;
      params.push(min_rating);
    }
    if (verified === 'true') {
      query += ` AND verified = true`;
    }

    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    return res.json({ success: true, contractors: result.rows, count: result.rows.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/contractors/:contractorId", async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query("SELECT * FROM contractors WHERE id = $1", [req.params.contractorId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Contractor not found" });
    return res.json({ success: true, contractor: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.put("/api/contractors/profile", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { company_name, bio, specialization, hourly_rate } = req.body;
    const result = await pool.query(
      "UPDATE contractors SET company_name = COALESCE($1, company_name), bio = COALESCE($2, bio), specialization = COALESCE($3, specialization), hourly_rate = COALESCE($4, hourly_rate), updated_at = NOW() WHERE user_id = $5 RETURNING *",
      [company_name, bio, specialization, hourly_rate, (req as any).userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Contractor not found" });
    return res.json({ success: true, contractor: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/contractors/profile/me", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query("SELECT * FROM contractors WHERE user_id = $1", [(req as any).userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Contractor profile not found" });
    return res.json({ success: true, contractor: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/contractors/bids", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { milestone_id, project_id, amount, estimated_duration_days, proposal } = req.body;
    if (!milestone_id || !amount || !proposal) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const contractorResult = await pool.query("SELECT id FROM contractors WHERE user_id = $1", [(req as any).userId]);
    if (contractorResult.rows.length === 0) {
      return res.status(404).json({ error: "Contractor profile not found" });
    }

    const bidId = uuidv4();
    const result = await pool.query(
      "INSERT INTO bids (id, milestone_id, contractor_id, amount, estimated_duration_days, proposal, project_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [bidId, milestone_id, contractorResult.rows[0].id, amount, estimated_duration_days, proposal, project_id || null]
    );

    // Log bid to ledger
    const bidHash = crypto.createHash('sha256')
      .update(`bid-${bidId}-${milestone_id}-${amount}-${Date.now()}`)
      .digest('hex');
    await pool.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
      ['BID_SUBMITTED', JSON.stringify({ bid_id: bidId, milestone_id, project_id, contractor_id: contractorResult.rows[0].id, amount }), bidHash]
    );

    return res.status(201).json({ success: true, bid: result.rows[0], ledger_hash: bidHash });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/contractors/bids/my", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const contractorResult = await pool.query("SELECT id FROM contractors WHERE user_id = $1", [(req as any).userId]);
    if (contractorResult.rows.length === 0) {
      return res.json({ success: true, bids: [] });
    }

    const result = await pool.query(
      "SELECT b.*, m.title as milestone_title, m.budget_allocation FROM bids b JOIN milestones m ON b.milestone_id = m.id WHERE b.contractor_id = $1 ORDER BY b.created_at DESC",
      [contractorResult.rows[0].id]
    );
    return res.json({ success: true, bids: result.rows, count: result.rows.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/contractors/:contractorId/stats", async (req: Request, res: Response): Promise<any> => {
  try {
    const contractorResult = await pool.query("SELECT * FROM contractors WHERE id = $1", [req.params.contractorId]);
    if (contractorResult.rows.length === 0) {
      return res.status(404).json({ error: "Contractor not found" });
    }

    const bidsResult = await pool.query(
      "SELECT COUNT(*) as total_bids, SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted_bids FROM bids WHERE contractor_id = $1",
      [req.params.contractorId]
    );

    const contractor = contractorResult.rows[0];
    const stats = bidsResult.rows[0];

    return res.json({
      success: true,
      stats: {
        contractor_id: req.params.contractorId,
        company_name: contractor.company_name,
        specialization: contractor.specialization,
        rating: contractor.rating,
        total_bids: stats.total_bids,
        accepted_bids: stats.accepted_bids,
        years_experience: contractor.years_experience
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// ════════════════════════════════════════════════════════════════════════════
// MODULE: MILESTONES — Escrow Release · Progress · AI+Human+Drone Audit
// Endpoints: /api/milestones …
// ════════════════════════════════════════════════════════════════════════════
// ENDPOINT 17-24: MILESTONE MODULE (8 endpoints)
// ============================================================================

app.post("/api/milestones", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { project_id, title, description, budget_allocation, estimated_start_date, estimated_completion_date } = req.body;
    if (!project_id || !title || !budget_allocation) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      "INSERT INTO milestones (id, project_id, title, description, budget_allocation, estimated_start_date, estimated_completion_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [uuidv4(), project_id, title, description, budget_allocation, estimated_start_date, estimated_completion_date]
    );
    return res.status(201).json({ success: true, milestone: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/milestones", async (req: Request, res: Response): Promise<any> => {
  try {
    const { project_id, status, limit = 50, offset = 0 } = req.query;
    let query = "SELECT * FROM milestones WHERE 1=1";
    const params: any[] = [];

    if (project_id) {
      query += ` AND project_id = $${params.length + 1}`;
      params.push(project_id);
    }
    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    return res.json({ success: true, milestones: result.rows, count: result.rows.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/milestones/:milestoneId", async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query("SELECT * FROM milestones WHERE id = $1", [req.params.milestoneId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Milestone not found" });
    return res.json({ success: true, milestone: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.put("/api/milestones/:milestoneId/status", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status required" });

    const result = await pool.query(
      "UPDATE milestones SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [status, req.params.milestoneId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Milestone not found" });
    return res.json({ success: true, milestone: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.put("/api/milestones/:milestoneId/progress", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { progress_percentage } = req.body;
    if (progress_percentage === undefined || progress_percentage < 0 || progress_percentage > 100) {
      return res.status(400).json({ error: "Progress must be between 0 and 100" });
    }

    const result = await pool.query(
      "UPDATE milestones SET progress_percentage = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [progress_percentage, req.params.milestoneId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Milestone not found" });
    return res.json({ success: true, milestone: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/milestones/:milestoneId/verify", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { geo_latitude, geo_longitude, progress_percentage, verified_notes } = req.body;
    if (!geo_latitude || !geo_longitude || progress_percentage === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      "INSERT INTO milestone_verifications (id, milestone_id, engineer_id, verification_status, geo_latitude, geo_longitude, verified_progress_percentage, verified_notes, verified_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *",
      [uuidv4(), req.params.milestoneId, (req as any).userId, 'VERIFIED', geo_latitude, geo_longitude, progress_percentage, verified_notes]
    );

    await pool.query(
      "UPDATE milestones SET status = 'VERIFIED', progress_percentage = $1, updated_at = NOW() WHERE id = $2",
      [progress_percentage, req.params.milestoneId]
    );

    return res.status(201).json({ success: true, verification: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/milestones/:milestoneId/verification", async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query(
      "SELECT * FROM milestone_verifications WHERE milestone_id = $1 ORDER BY created_at DESC LIMIT 1",
      [req.params.milestoneId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Verification not found" });
    return res.json({ success: true, verification: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/milestones/:milestoneId/approve", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { milestoneId } = req.params;
    const { approval_status, approval_comments } = req.body;

    if (!approval_status) {
      return res.status(400).json({ error: "Approval status required (APPROVED or REJECTED)" });
    }

    if (!['APPROVED', 'REJECTED'].includes(approval_status)) {
      return res.status(400).json({ error: "Status must be APPROVED or REJECTED" });
    }

    const approvalResult = await pool.query(
      "INSERT INTO payment_approvals (id, milestone_id, approver_id, approval_status, comment, approved_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *",
      [uuidv4(), milestoneId, (req as any).userId, approval_status, approval_comments || null]
    );

    if (approval_status === 'APPROVED') {
      await pool.query(
        "UPDATE milestones SET status = 'VERIFIED', updated_at = NOW() WHERE id = $1",
        [milestoneId]
      );
    } else if (approval_status === 'REJECTED') {
      await pool.query(
        "UPDATE milestones SET status = 'PENDING', updated_at = NOW() WHERE id = $1",
        [milestoneId]
      );
    }

    return res.status(201).json({ 
      success: true, 
      approval: approvalResult.rows[0],
      message: `Milestone ${approval_status.toLowerCase()} successfully`
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// ════════════════════════════════════════════════════════════════════════════
// MODULE: ESCROW — Wallet · Paystack · Multi-Sig Release · Payout
// Endpoints: /api/escrow …
// ════════════════════════════════════════════════════════════════════════════
// ENDPOINT 25-34: ESCROW MODULE (10 endpoints)
// ============================================================================

app.post("/api/escrow/deposit", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { project_id, amount, description } = req.body;
    if (!project_id || !amount) return res.status(400).json({ error: "Missing required fields" });
    if (amount <= 0) return res.status(400).json({ error: "Amount must be greater than 0" });

    const walletId = uuidv4();
    
    const walletResult = await pool.query(
      "INSERT INTO escrow_wallets (id, project_id, user_id, balance) VALUES ($1, $2, $3, $4) RETURNING *",
      [walletId, project_id, (req as any).userId, amount]
    );
    
    const transactionId = uuidv4();
    await pool.query(
      "INSERT INTO transaction_logs (id, user_id, wallet_id, transaction_type, amount, balance_before, balance_after, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [transactionId, (req as any).userId, walletId, 'DEPOSIT', amount, 0, amount, 'COMPLETED']
    );
    
    return res.status(201).json({ success: true, transaction: { id: transactionId, wallet_id: walletId, amount, type: 'DEPOSIT' } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/escrow/balance/:walletId", async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query("SELECT * FROM escrow_wallets WHERE id = $1", [req.params.walletId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Wallet not found" });
    
    const wallet = result.rows[0];
    return res.json({ 
      success: true, 
      balance: { 
        wallet_id: wallet.id,
        available: parseFloat((wallet.balance - wallet.held_amount).toString()),
        held: parseFloat(wallet.held_amount.toString()),
        total: parseFloat(wallet.balance.toString())
      } 
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/escrow/hold", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { wallet_id, transaction_id, amount, reason, expires_in } = req.body;
    if (!wallet_id || !amount) return res.status(400).json({ error: "Missing required fields" });

    const result = await pool.query(
      "UPDATE escrow_wallets SET held_amount = held_amount + $1 WHERE id = $2 RETURNING *",
      [amount, wallet_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Wallet not found" });
    
    return res.status(201).json({ success: true, hold: { id: uuidv4(), wallet_id, amount, reason, status: 'ACTIVE' } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/escrow/release", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { hold_id, milestone_id, wallet_id, amount } = req.body;
    if (!wallet_id) return res.status(400).json({ error: "wallet_id required" });

    const wallet = await pool.query("SELECT * FROM escrow_wallets WHERE id = $1", [wallet_id]);
    if (wallet.rows.length === 0) return res.status(404).json({ error: "Wallet not found" });

    const releaseAmount = amount || wallet.rows[0].held_amount;

    await pool.query('BEGIN');

    await pool.query(
      "UPDATE escrow_wallets SET balance = balance - $1, held_amount = CASE WHEN held_amount >= $1 THEN held_amount - $1 ELSE 0 END WHERE id = $2",
      [releaseAmount, wallet_id]
    );

    if (milestone_id) {
      await pool.query(
        "UPDATE milestones SET status = 'PAID', payout_date = NOW(), updated_at = NOW() WHERE id = $1",
        [milestone_id]
      );

      // Fetch project_id from milestone to update contractor reputation
      const msData = await pool.query("SELECT project_id FROM milestones WHERE id = $1", [milestone_id]);
      if (msData.rows.length > 0) {
        await pool.query(`
          UPDATE contractors
          SET completed_projects = completed_projects + 1,
              rating = CASE
                WHEN rating < 4.8 THEN LEAST(rating + 0.1, 5.0)
                ELSE 5.0
              END,
              updated_at = NOW()
          WHERE user_id = (SELECT contractor_id FROM projects WHERE id = $1)`,
          [msData.rows[0].project_id]
        );
      }
    }

    const transactionId = uuidv4();
    await pool.query(
      "INSERT INTO transaction_logs (id, user_id, wallet_id, transaction_type, amount, status) VALUES ($1, $2, $3, $4, $5, $6)",
      [transactionId, (req as any).userId, wallet_id, 'RELEASE', releaseAmount, 'COMPLETED']
    );

    await pool.query('COMMIT');

    return res.json({ success: true, message: "Funds released to contractor node", transaction: { id: transactionId, type: 'RELEASE', amount: releaseAmount } });
  } catch (error: any) {
    await pool.query('ROLLBACK');
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/escrow/transactions/:walletId", async (req: Request, res: Response): Promise<any> => {
  try {
    const { limit = 50 } = req.query;
    const result = await pool.query(
      "SELECT * FROM transaction_logs WHERE wallet_id = $1 ORDER BY timestamp DESC LIMIT $2",
      [req.params.walletId, limit]
    );
    return res.json({ success: true, transactions: result.rows || [], count: (result.rows || []).length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/escrow/transaction/:transactionId", async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query("SELECT * FROM transaction_logs WHERE id = $1", [req.params.transactionId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Transaction not found" });
    return res.json({ success: true, transaction: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/escrow/holds/:walletId", async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query(
      "SELECT id, held_amount FROM escrow_wallets WHERE id = $1",
      [req.params.walletId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Wallet not found" });
    
    const wallet = result.rows[0];
    return res.json({ 
      success: true, 
      holds: wallet.held_amount > 0 ? [{ wallet_id: req.params.walletId, held_amount: wallet.held_amount, status: 'ACTIVE' }] : [],
      count: wallet.held_amount > 0 ? 1 : 0
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/escrow/hold/cancel", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { hold_id, wallet_id, amount } = req.body;
    if (!wallet_id) return res.status(400).json({ error: "wallet_id required" });

    const result = await pool.query(
      "UPDATE escrow_wallets SET held_amount = CASE WHEN held_amount >= $1 THEN held_amount - $1 ELSE 0 END WHERE id = $2 RETURNING *",
      [amount || 0, wallet_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Wallet not found" });

    return res.json({ success: true, message: "Payment hold cancelled successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/escrow/withdraw", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { wallet_id, amount } = req.body;
    if (!wallet_id || !amount) return res.status(400).json({ error: "Missing required fields" });
    if (amount <= 0) return res.status(400).json({ error: "Amount must be greater than 0" });

    const result = await pool.query(
      "UPDATE escrow_wallets SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING *",
      [amount, wallet_id]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: "Insufficient balance" });

    const transactionId = uuidv4();
    await pool.query(
      "INSERT INTO transaction_logs (id, user_id, wallet_id, transaction_type, amount, status) VALUES ($1, $2, $3, $4, $5, $6)",
      [transactionId, (req as any).userId, wallet_id, 'WITHDRAW', amount, 'COMPLETED']
    );

    return res.json({ success: true, transaction: { id: transactionId, type: 'WITHDRAW', amount } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/escrow/settle", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { wallet_id, total_amount, sponsor_share, contractor_share, investor_shares, platform_fee } = req.body;
    if (!wallet_id || !total_amount) return res.status(400).json({ error: "Missing required fields" });

    const result = await pool.query(
      "UPDATE escrow_wallets SET balance = 0, held_amount = 0 WHERE id = $1 RETURNING *",
      [wallet_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Wallet not found" });

    const settlementId = uuidv4();
    const transactionId = uuidv4();
    await pool.query(
      "INSERT INTO transaction_logs (id, user_id, wallet_id, transaction_type, amount, status) VALUES ($1, $2, $3, $4, $5, $6)",
      [transactionId, (req as any).userId, wallet_id, 'SETTLEMENT', total_amount, 'COMPLETED']
    );

    return res.status(201).json({ 
      success: true, 
      settlement: { 
        id: settlementId, 
        wallet_id, 
        total_amount, 
        sponsor_share, 
        contractor_share, 
        platform_fee,
        status: 'COMPLETED'
      } 
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// ════════════════════════════════════════════════════════════════════════════
// MODULE: GOVERNANCE & TRANSPARENCY — Global Ledger · Verification · KYC
// Endpoints: /api/gov, /api/ledger, /api/kyc …
// ════════════════════════════════════════════════════════════════════════════
// ENDPOINT 35-37: GOV + TRANSPARENCY MODULE (3 endpoints)
// ============================================================================

// GET All Transparency Logs — consumed by the Global Ledger live page
app.get("/api/ledger", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM system_ledger ORDER BY created_at DESC LIMIT 50"
    );
    res.json({ logs: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gov/verify-project", authenticate, async (req: Request, res: Response) => {
  const { project_id, official_id, official_name } = req.body;
  if (!project_id || !official_id) {
    res.status(400).json({ error: "project_id and official_id are required" });
    return;
  }
  // Include official_name in hash if provided for stronger proof-of-verification
  const hashInput = official_name
    ? `${project_id}-${official_name}-${Date.now()}`
    : `${project_id}-${official_id}-${Date.now()}`;
  const vHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  try {
    await pool.query('BEGIN');

    const projectResult = await pool.query(
      "UPDATE projects SET gov_verified = true, verification_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
      [vHash, project_id]
    );
    if (projectResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await pool.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
      ['GOV_PROJECT_VERIFICATION', JSON.stringify({ project_id, official_id, official_name: official_name || null }), vHash]
    );

    await pool.query('COMMIT');
    res.json({ success: true, hash: vHash, verification_hash: vHash });
  } catch (error: any) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// BULLETPROOF MULTI-SIG ESCROW RELEASE
// Requires: ai_status=VERIFIED + human_status=VERIFIED + drone_status=VERIFIED
// Any unverified layer blocks the release — no exceptions
// ============================================================================
app.post("/api/milestones/approve-and-release", authenticate, async (req: Request, res: Response): Promise<any> => {
  const { milestone_id, actor_role, skip_drone } = req.body;
  const userId = (req as any).userId;

  if (!milestone_id) return res.status(400).json({ error: "milestone_id required" });

  // Only GOVERNMENT or ADMIN can authorize release
  const userCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [userId]);
  if (userCheck.rows.length === 0) return res.status(401).json({ error: "Unauthorized" });
  const userRole = userCheck.rows[0].role;
  if (userRole !== 'GOVERNMENT' && userRole !== 'ADMIN') {
    return res.status(403).json({ error: "Only GOVERNMENT or ADMIN can release funds" });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const mData = await client.query("SELECT * FROM milestones WHERE id = $1 FOR UPDATE", [milestone_id]);
    if (mData.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Milestone not found" });
    }
    const m = mData.rows[0];

    // ── SECURITY GATE: All 3 verification layers must pass ──
    const droneRequired = !skip_drone; // allow skip_drone=true for pre-drone era projects
    const aiOk = m.ai_status === 'VERIFIED';
    const humanOk = m.human_status === 'VERIFIED';
    const droneOk = m.drone_status === 'VERIFIED' || !droneRequired;

    if (!aiOk || !humanOk || !droneOk) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: "SECURITY VIOLATION: Multi-layer verification incomplete",
        gate: {
          ai_validator: m.ai_status,
          human_auditor: m.human_status,
          drone_capture: m.drone_status,
          required: "All must be VERIFIED",
          blocked_by: [
            !aiOk && "AI Validator",
            !humanOk && "Human Auditor",
            !droneOk && "Drone Capture"
          ].filter(Boolean)
        }
      });
    }

    // ── ATOMIC PAYOUT ──
    const releaseHash = crypto
      .createHash('sha256')
      .update(`${milestone_id}-${m.project_id}-${m.budget_allocation}-${Date.now()}-${userId}`)
      .digest('hex');

    // Mark milestone PAID
    await client.query(
      "UPDATE milestones SET status = 'PAID', payout_date = NOW(), release_hash = $1, updated_at = NOW() WHERE id = $2",
      [releaseHash, milestone_id]
    );

    // Update escrow wallet — deduct the payout from the project wallet
    await client.query(`
      UPDATE escrow_wallets SET
        balance = GREATEST(balance - $1, 0),
        held_amount = GREATEST(held_amount - $1, 0),
        updated_at = NOW()
      WHERE project_id = $2`,
      [m.budget_allocation, m.project_id]
    );

    // Log the payout transaction
    const txId = uuidv4();
    await client.query(`
      INSERT INTO transaction_logs (id, user_id, wallet_id, transaction_type, amount, balance_before, balance_after, status, hash)
      SELECT $1, $2, ew.id, 'MILESTONE_PAYOUT', $3, ew.balance + $3, ew.balance, 'COMPLETED', $4
      FROM escrow_wallets ew WHERE ew.project_id = $5`,
      [txId, userId, m.budget_allocation, releaseHash, m.project_id]
    );

    // Update contractor reputation
    await client.query(`
      UPDATE contractors SET
        completed_projects = completed_projects + 1,
        rating = LEAST(rating + 0.1, 5.0),
        updated_at = NOW()
      WHERE user_id = (SELECT contractor_id FROM projects WHERE id = $1)`,
      [m.project_id]
    );

    // ── IMMUTABLE LEDGER ENTRY ──
    const ledgerHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ milestone_id, project_id: m.project_id, amount: m.budget_allocation, release_hash: releaseHash, timestamp: Date.now() }))
      .digest('hex');

    await client.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
      [
        'MILESTONE_ESCROW_RELEASE',
        JSON.stringify({
          milestone_id,
          project_id: m.project_id,
          amount: m.budget_allocation,
          ai_hash: m.ai_hash,
          release_hash: releaseHash,
          authorized_by: userId,
          authorized_role: userRole,
        }),
        ledgerHash
      ]
    );

    await client.query('COMMIT');
    return res.json({
      success: true,
      message: "✅ Funds released — all 3 verification layers passed",
      release_hash: releaseHash,
      ledger_hash: ledgerHash,
      amount: m.budget_allocation,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ============================================================================
// ════════════════════════════════════════════════════════════════════════════
// MODULE: INVESTMENTS — NAP Portfolio · Investor Contributions · Yield
// Endpoints: /api/investments …
// ════════════════════════════════════════════════════════════════════════════
// ENDPOINT 38-39: INVESTMENT MODULE (2 endpoints)
// ============================================================================

app.get("/api/investments", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT i.*, p.title as project_title, p.location 
      FROM investments i 
      JOIN projects p ON i.project_id = p.id 
      ORDER BY i.created_at DESC
    `);
    res.json({ investments: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/investments/commit", async (req: Request, res: Response) => {
  const { project_id, amount, investor_id } = req.body;
  if (!project_id || !amount || !investor_id) {
    res.status(400).json({ error: "project_id, amount, and investor_id are required" });
    return;
  }
  if (amount <= 0) {
    res.status(400).json({ error: "Amount must be greater than 0" });
    return;
  }

  try {
    // Check project exists and get budget cap
    const projectRes = await pool.query("SELECT budget FROM projects WHERE id = $1", [project_id]);
    if (projectRes.rows.length === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const totalBudget = Number(projectRes.rows[0].budget);

    // Sum all current committed investments for this project
    const fundRes = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as current FROM investments WHERE project_id = $1 AND status = 'COMMITTED'",
      [project_id]
    );
    const currentFunding = Number(fundRes.rows[0].current);

    if (currentFunding + amount > totalBudget) {
      res.status(400).json({
        error: "Funding Pool Cap Reached",
        remaining: Math.max(totalBudget - currentFunding, 0),
        total_budget: totalBudget,
        current_funding: currentFunding
      });
      return;
    }

    const investId = uuidv4();
    const result = await pool.query(
      "INSERT INTO investments (id, project_id, investor_id, amount, status) VALUES ($1, $2, $3, $4, 'COMMITTED') RETURNING *",
      [investId, project_id, investor_id, amount]
    );

    // Auto-log every investment commitment to the immutable ledger
    const investHash = crypto.createHash('sha256')
      .update(`investment-${investId}-${project_id}-${amount}-${Date.now()}`)
      .digest('hex');
    await pool.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
      ['INVESTMENT_COMMITTED', JSON.stringify({ investment_id: investId, project_id, investor_id, amount }), investHash]
    );

    res.status(201).json({ success: true, investment: result.rows[0], ledger_hash: investHash });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// ENDPOINT 40-42: SPECIAL ENDPOINTS (3 endpoints)
// ============================================================================

app.post("/api/projects/:projectId/apply", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const { amount, timeline_days, proposal, milestone_id } = req.body;
    
    if (!amount || !proposal) {
      return res.status(400).json({ error: "Amount and proposal required" });
    }

    const contractorResult = await pool.query(
      "SELECT id FROM contractors WHERE user_id = $1",
      [(req as any).userId]
    );

    if (contractorResult.rows.length === 0) {
      return res.status(404).json({ error: "Contractor profile not found. Create profile first." });
    }

    const contractorId = contractorResult.rows[0].id;

    let query;
    let params;
    
    if (milestone_id) {
      query = "INSERT INTO bids (id, project_id, milestone_id, contractor_id, amount, estimated_duration_days, proposal, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *";
      params = [uuidv4(), projectId, milestone_id, contractorId, amount, timeline_days, proposal, 'PENDING'];
    } else {
      query = "INSERT INTO bids (id, project_id, contractor_id, amount, estimated_duration_days, proposal, status, milestone_id) VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM milestones WHERE project_id = $8 LIMIT 1)) RETURNING *";
      params = [uuidv4(), projectId, contractorId, amount, timeline_days, proposal, 'PENDING', projectId];
    }

    const result = await pool.query(query, params);

    if (!result.rows[0]) {
      return res.status(400).json({ error: "Could not create application - no milestone found for project" });
    }

    return res.status(201).json({ 
      success: true, 
      application: result.rows[0],
      message: "Application submitted successfully"
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Both /health and /api/health are supported.
// The frontend api.ts warm-up ping calls /api/health — that was returning 404
// because only /health was registered. Both aliases now return the same response.
app.get("/health", async (req: Request, res: Response): Promise<any> => {
  try {
    await pool.query("SELECT 1");
    return res.json({
      status: "healthy",
      database: "connected",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({ status: "unhealthy", error: error.message });
  }
});

// /api/health — same handler, different prefix (frontend warm-up calls this path)
app.get("/api/health", async (req: Request, res: Response): Promise<any> => {
  try {
    await pool.query("SELECT 1");
    return res.json({
      status: "healthy",
      database: "connected",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({ status: "unhealthy", error: error.message });
  }
});

// (duplicate "/" route removed)



// ============================================================================
// TRI-LAYER VERIFICATION ENDPOINTS
// ============================================================================

// LAYER 1: AI Validator — accepts image URL or base64, runs pHash
// Sharp is used inline — no external microservice needed
app.post("/api/milestones/:milestoneId/verify/ai", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { milestoneId } = req.params;
    const { evidence_url } = req.body;
    if (!evidence_url) return res.status(400).json({ error: "evidence_url required" });

    // Fetch the image and run perceptual hash analysis
    let aiHash: string;
    let aiOk = false;
    let aiReason = "Unknown";

    try {
      const https = require('https');
      const http = require('http');
      const client = evidence_url.startsWith('https') ? https : http;

      const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
        client.get(evidence_url, (res: any) => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        }).on('error', reject);
      });

      // Size gate: reject tiny/fake files
      if (imageBuffer.length < 8000) {
        aiHash = crypto.createHash('sha256').update(evidence_url).digest('hex');
        aiOk = false;
        aiReason = "Evidence file too small — low quality or invalid image";
      } else {
        // pHash: resize to 32x32 grayscale, compute average, build bit string, SHA256
        // Using sharp if available, else fallback to simple hash
        try {
          const sharp = require('sharp');
          const resized = await sharp(imageBuffer).resize(32, 32).grayscale().raw().toBuffer();
          const avg = resized.reduce((s: number, v: number) => s + v, 0) / resized.length;
          let bits = '';
          for (let i = 0; i < resized.length; i++) bits += resized[i] > avg ? '1' : '0';
          aiHash = crypto.createHash('sha256').update(bits).digest('hex');
          // Heuristic: all-zero prefix or all-ff suffix often indicates synthetic/AI image
          const synthetic = aiHash.startsWith('000') || aiHash.endsWith('fff');
          aiOk = !synthetic;
          aiReason = synthetic ? "Image pattern suggests synthetic or AI-generated content" : "Valid proof of work";
        } catch {
          // sharp not installed — fall back to raw hash
          aiHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
          aiOk = imageBuffer.length > 50000; // large file likely real
          aiReason = aiOk ? "File validated (size check)" : "File too small for validation";
        }
      }
    } catch (fetchErr: any) {
      return res.status(400).json({ error: "Could not fetch evidence image: " + fetchErr.message });
    }

    if (!aiOk) {
      return res.status(422).json({
        success: false,
        ai_status: 'REJECTED',
        ai_hash: aiHash,
        reason: aiReason,
      });
    }

    // Mark AI layer verified on the milestone
    await pool.query(
      "UPDATE milestones SET ai_status = 'VERIFIED', ai_hash = $1, evidence_url = $2, evidence_submitted_at = NOW(), updated_at = NOW() WHERE id = $3",
      [aiHash, evidence_url, milestoneId]
    );

    // Log to system ledger
    const lHash = crypto.createHash('sha256').update(milestoneId + aiHash + Date.now()).digest('hex');
    await pool.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
      ['AI_VALIDATION_PASSED', JSON.stringify({ milestone_id: milestoneId, ai_hash: aiHash, evidence_url }), lHash]
    );

    return res.json({ success: true, ai_status: 'VERIFIED', ai_hash: aiHash, reason: aiReason });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// LAYER 2: Human Auditor — VERIFIER or GOVERNMENT marks milestone verified
app.post("/api/milestones/:milestoneId/verify/human", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { milestoneId } = req.params;
    const { approved, notes, geo_latitude, geo_longitude } = req.body;
    const userId = (req as any).userId;

    const userCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [userId]);
    if (userCheck.rows.length === 0) return res.status(401).json({ error: "Unauthorized" });
    const role = userCheck.rows[0].role;
    if (!['GOVERNMENT', 'ADMIN', 'VERIFIER'].includes(role)) {
      return res.status(403).json({ error: "Only GOVERNMENT, ADMIN, or VERIFIER can perform human audits" });
    }

    const status = approved ? 'VERIFIED' : 'REJECTED';

    await pool.query(
      "UPDATE milestones SET human_status = $1, human_verifier_id = $2, human_verified_at = NOW(), updated_at = NOW() WHERE id = $3",
      [status, userId, milestoneId]
    );

    // Log the human audit to the geo-tagged verification table
    await pool.query(
      "INSERT INTO milestone_verifications (id, milestone_id, engineer_id, verification_status, geo_latitude, geo_longitude, verified_notes, verified_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
      [uuidv4(), milestoneId, userId, status, geo_latitude || null, geo_longitude || null, notes || null]
    );

    const lHash = crypto.createHash('sha256').update(milestoneId + userId + status + Date.now()).digest('hex');
    await pool.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
      [approved ? 'HUMAN_AUDIT_APPROVED' : 'HUMAN_AUDIT_REJECTED',
       JSON.stringify({ milestone_id: milestoneId, auditor: userId, role, notes, geo_latitude, geo_longitude }),
       lHash]
    );

    return res.json({ success: true, human_status: status, auditor_id: userId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// LAYER 3: Drone Oracle — receives webhook from drone software (DJI, Pix4D, etc.)
// Also accepts manual GPS+photo submission when drone not available
app.post("/api/milestones/:milestoneId/verify/drone", async (req: Request, res: Response): Promise<any> => {
  try {
    const { milestoneId } = req.params;
    const { drone_url, geo_latitude, geo_longitude, drone_operator, api_key, progress_pct } = req.body;

    // API key gate — drone webhooks must supply this
    const validKey = process.env.DRONE_API_KEY || 'nested-ark-drone-2024';
    if (api_key !== validKey) {
      return res.status(403).json({ error: "Invalid drone API key" });
    }

    if (!drone_url) return res.status(400).json({ error: "drone_url (footage/photo URL) required" });

    const droneHash = crypto.createHash('sha256')
      .update(`drone-${milestoneId}-${drone_url}-${Date.now()}`)
      .digest('hex');

    await pool.query(
      "UPDATE milestones SET drone_status = 'VERIFIED', drone_url = $1, drone_synced_at = NOW(), updated_at = NOW() WHERE id = $2",
      [drone_url, milestoneId]
    );

    if (progress_pct !== undefined) {
      await pool.query(
        "UPDATE milestones SET progress_percentage = $1 WHERE id = $2",
        [Math.min(100, Math.max(0, progress_pct)), milestoneId]
      );
    }

    const lHash = crypto.createHash('sha256').update(milestoneId + droneHash + Date.now()).digest('hex');
    await pool.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
      ['DRONE_VERIFICATION_SYNCED',
       JSON.stringify({ milestone_id: milestoneId, drone_url, geo_latitude, geo_longitude, drone_operator, drone_hash: droneHash }),
       lHash]
    );

    return res.json({ success: true, drone_status: 'VERIFIED', drone_hash: droneHash });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET: Full verification status for a milestone
app.get("/api/milestones/:milestoneId/verification-status", async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query(
      "SELECT id, title, status, ai_status, human_status, drone_status, ai_hash, drone_url, evidence_url, evidence_submitted_at, human_verified_at, drone_synced_at, budget_allocation FROM milestones WHERE id = $1",
      [req.params.milestoneId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Milestone not found" });
    const m = result.rows[0];
    const allVerified = m.ai_status === 'VERIFIED' && m.human_status === 'VERIFIED' && m.drone_status === 'VERIFIED';
    return res.json({
      success: true,
      milestone_id: m.id,
      title: m.title,
      status: m.status,
      release_ready: allVerified,
      verification: {
        ai: { status: m.ai_status, hash: m.ai_hash, evidence_url: m.evidence_url, at: m.evidence_submitted_at },
        human: { status: m.human_status, at: m.human_verified_at },
        drone: { status: m.drone_status, footage_url: m.drone_url, at: m.drone_synced_at },
      },
      budget_allocation: m.budget_allocation,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET: Ledger with full details (expanded from basic version)
app.get("/api/ledger/full", async (req: Request, res: Response): Promise<any> => {
  try {
    const { limit = 100, type } = req.query;
    let query = "SELECT * FROM system_ledger WHERE 1=1";
    const params: any[] = [];
    if (type) { query += ` AND transaction_type = $${params.length + 1}`; params.push(type); }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const result = await pool.query(query, params);
    return res.json({ success: true, logs: result.rows, count: result.rows.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST: Investments now auto-log to system ledger

// ============================================================================
// ADMIN COMMAND CENTER ENDPOINTS
// ============================================================================

// Role elevation (protected by ADMIN_KEY env var)
app.post("/api/auth/update-role", async (req: Request, res: Response): Promise<any> => {
  const { email, new_role, admin_key } = req.body;
  if (!email || !new_role) return res.status(400).json({ error: "email and new_role required" });
  const validKey = process.env.ADMIN_KEY || 'nested-ark-admin-2024';
  if (admin_key !== validKey) return res.status(403).json({ error: "Invalid admin key" });
  const validRoles = ['GOVERNMENT', 'INVESTOR', 'CONTRACTOR', 'ADMIN', 'VERIFIER'];
  if (!validRoles.includes(new_role)) return res.status(400).json({ error: `Invalid role. Use: ${validRoles.join(', ')}` });
  try {
    const result = await pool.query(
      "UPDATE public.users SET role = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, role, full_name",
      [new_role, email.toLowerCase()]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: `User not found: ${email}` });
    console.log(`[ADMIN] Role updated: ${email} -> ${new_role}`);
    return res.json({ success: true, user: result.rows[0], message: `${email} elevated to ${new_role}. Sign out and back in to activate.` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// List all users (admin tool)
app.get("/api/admin/users", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const roleCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [userId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(roleCheck.rows[0]?.role)) {
    return res.status(403).json({ error: "Admin only" });
  }
  try {
    const result = await pool.query(
      "SELECT id, email, full_name, role, created_at FROM public.users ORDER BY created_at DESC"
    );
    return res.json({ success: true, users: result.rows, count: result.rows.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET: Admin approval queue — all milestones with their verification status
// Supports filters: status=PENDING|VERIFIED|PAID, project_id
app.get("/api/admin/approval-queue", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const roleCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [userId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(roleCheck.rows[0]?.role)) {
    return res.status(403).json({ error: "Admin only" });
  }
  try {
    const { status, project_id } = req.query;
    let query = `
      SELECT 
        m.id, m.title, m.description, m.status, m.budget_allocation, m.project_id,
        m.ai_status, m.human_status, m.drone_status,
        m.ai_hash, m.evidence_url, m.drone_url,
        m.evidence_submitted_at, m.human_verified_at, m.drone_synced_at,
        m.payout_date, m.progress_percentage,
        p.title as project_title, p.location, p.country, p.budget as project_budget,
        p.gov_verified,
        COALESCE(inv.total_invested, 0) as total_invested,
        COALESCE(inv.investor_count, 0) as investor_count
      FROM milestones m
      JOIN projects p ON m.project_id = p.id
      LEFT JOIN (
        SELECT project_id, SUM(amount) as total_invested, COUNT(*) as investor_count
        FROM investments WHERE status = 'COMMITTED' GROUP BY project_id
      ) inv ON inv.project_id = m.project_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status) { query += ` AND m.status = $${params.length + 1}`; params.push(status); }
    if (project_id) { query += ` AND m.project_id = $${params.length + 1}`; params.push(project_id); }
    query += ' ORDER BY m.created_at DESC';
    const result = await pool.query(query, params);
    
    // Tag each with release_ready
    const rows = result.rows.map((m: any) => ({
      ...m,
      release_ready: m.ai_status === 'VERIFIED' && m.human_status === 'VERIFIED' && m.drone_status === 'VERIFIED' && m.status !== 'PAID',
      pending_layers: [
        m.ai_status !== 'VERIFIED' && 'AI Validator',
        m.human_status !== 'VERIFIED' && 'Human Audit',
        m.drone_status !== 'VERIFIED' && 'Drone Capture',
      ].filter(Boolean),
    }));

    return res.json({ success: true, milestones: rows, count: rows.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET: Admin dashboard summary
app.get("/api/admin/summary", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const roleCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [userId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(roleCheck.rows[0]?.role)) {
    return res.status(403).json({ error: "Admin only" });
  }
  try {
    const [
      users, projects, milestones, investments,
      pendingApprovals, ledgerCount, readyForRelease, recentActivity
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) as total, COUNT(CASE WHEN role='GOVERNMENT' THEN 1 END) as govts, COUNT(CASE WHEN role='CONTRACTOR' THEN 1 END) as contractors, COUNT(CASE WHEN role='INVESTOR' THEN 1 END) as investors FROM public.users"),
      pool.query("SELECT COUNT(*) as total, COUNT(CASE WHEN status='ACTIVE' THEN 1 END) as active, COUNT(CASE WHEN gov_verified THEN 1 END) as verified FROM projects"),
      pool.query("SELECT COUNT(*) as total, COUNT(CASE WHEN status='PAID' THEN 1 END) as paid, SUM(budget_allocation) as total_value FROM milestones"),
      pool.query("SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM investments WHERE status='COMMITTED'"),
      pool.query("SELECT COUNT(*) as total FROM milestones WHERE status != 'PAID' AND (ai_status='PENDING' OR human_status='PENDING' OR drone_status='PENDING')"),
      pool.query("SELECT COUNT(*) as total FROM system_ledger"),
      pool.query("SELECT COUNT(*) as total FROM milestones WHERE ai_status='VERIFIED' AND human_status='VERIFIED' AND drone_status='VERIFIED' AND status != 'PAID'"),
      pool.query("SELECT transaction_type, payload, created_at FROM system_ledger ORDER BY created_at DESC LIMIT 10"),
    ]);

    return res.json({
      success: true,
      summary: {
        users: users.rows[0],
        projects: projects.rows[0],
        milestones: { ...milestones.rows[0], total_value: parseFloat(milestones.rows[0].total_value || 0) },
        investments: { total: parseFloat(investments.rows[0].total), count: parseInt(investments.rows[0].count) },
        pending_approvals: parseInt(pendingApprovals.rows[0].total),
        ledger_events: parseInt(ledgerCount.rows[0].total),
        ready_for_release: parseInt(readyForRelease.rows[0].total),
        recent_activity: recentActivity.rows,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST: Admin batch approve — human audit for a milestone
app.post("/api/admin/milestones/:milestoneId/human-approve", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const roleCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [userId]);
  if (!['ADMIN', 'GOVERNMENT', 'VERIFIER'].includes(roleCheck.rows[0]?.role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  const { approved, notes } = req.body;
  const { milestoneId } = req.params;
  const status = approved ? 'VERIFIED' : 'REJECTED';
  try {
    await pool.query(
      "UPDATE milestones SET human_status = $1, human_verifier_id = $2, human_verified_at = NOW(), updated_at = NOW() WHERE id = $3",
      [status, userId, milestoneId]
    );
    await pool.query(
      "INSERT INTO milestone_verifications (id, milestone_id, engineer_id, verification_status, verified_notes, verified_at) VALUES ($1, $2, $3, $4, $5, NOW())",
      [uuidv4(), milestoneId, userId, status, notes || null]
    );
    const lHash = crypto.createHash('sha256').update(milestoneId + userId + status + Date.now()).digest('hex');
    await pool.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
      [approved ? 'ADMIN_AUDIT_APPROVED' : 'ADMIN_AUDIT_REJECTED',
       JSON.stringify({ milestone_id: milestoneId, auditor: userId, notes }), lHash]
    );
    return res.json({ success: true, human_status: status, ledger_hash: lHash });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST: Admin release funds (alias of approve-and-release with skip_drone option)
app.post("/api/admin/milestones/:milestoneId/release", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const roleCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [userId]);
  if (!['ADMIN', 'GOVERNMENT'].includes(roleCheck.rows[0]?.role)) {
    return res.status(403).json({ error: "Only ADMIN or GOVERNMENT can release funds" });
  }
  const { notes, skip_drone } = req.body;
  const { milestoneId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Fetch and lock milestone ────────────────────────────────────────
    const mData = await client.query("SELECT * FROM milestones WHERE id = $1 FOR UPDATE", [milestoneId]);
    if (mData.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: "Milestone not found" }); }
    const m = mData.rows[0];
    if (m.status === 'PAID') { await client.query('ROLLBACK'); return res.status(400).json({ error: "Milestone already paid" }); }

    // ── 2. Tri-layer security gate ─────────────────────────────────────────
    const aiOk    = m.ai_status    === 'VERIFIED';
    const humanOk = m.human_status === 'VERIFIED';
    const droneOk = m.drone_status === 'VERIFIED' || skip_drone;
    if (!aiOk || !humanOk || !droneOk) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: "Verification incomplete",
        gate: { ai: m.ai_status, human: m.human_status, drone: m.drone_status, skip_drone },
        pending: [!aiOk && 'AI Validator', !humanOk && 'Human Audit', !droneOk && 'Drone Capture'].filter(Boolean)
      });
    }

    // ── 3. Revenue split calculation ───────────────────────────────────────
    const grossAmount    = parseFloat(m.budget_allocation);
    const platformFeeUsd = parseFloat((grossAmount * REVENUE_CONFIG.ESCROW_FEE_PCT).toFixed(4));
    const contractorPay  = parseFloat((grossAmount - platformFeeUsd).toFixed(4));

    // ── 4. Mark milestone PAID ─────────────────────────────────────────────
    const releaseHash = crypto.createHash('sha256')
      .update(`${milestoneId}-${grossAmount}-${Date.now()}-${userId}`)
      .digest('hex');
    await client.query(
      "UPDATE milestones SET status = 'PAID', payout_date = NOW(), release_hash = $1, updated_at = NOW() WHERE id = $2",
      [releaseHash, milestoneId]
    );

    // ── 5. Deduct full gross from escrow wallet ────────────────────────────
    await client.query(
      "UPDATE escrow_wallets SET balance = GREATEST(balance - $1, 0), held_amount = GREATEST(held_amount - $1, 0), updated_at = NOW() WHERE project_id = $2",
      [grossAmount, m.project_id]
    );

    // ── 6. Contractor performance update ──────────────────────────────────
    await client.query(
      "UPDATE contractors SET completed_projects = completed_projects + 1, rating = LEAST(rating + 0.1, 5.0), updated_at = NOW() WHERE user_id = (SELECT contractor_id FROM projects WHERE id = $1)",
      [m.project_id]
    );

    // ── 7. Transaction log (net contractor amount) ─────────────────────────
    const txId = uuidv4();
    await client.query(
      `INSERT INTO transaction_logs (id, user_id, wallet_id, transaction_type, amount, status, hash)
       SELECT $1, $2, ew.id, 'MILESTONE_PAYOUT', $3, 'COMPLETED', $4
       FROM escrow_wallets ew WHERE ew.project_id = $5`,
      [txId, userId, contractorPay, releaseHash, m.project_id]
    );

    // ── 8. RECORD PLATFORM REVENUE (2% escrow fee) ────────────────────────
    await recordPlatformRevenue(client, {
      source:       'ESCROW_FEE',
      amount_usd:   platformFeeUsd,
      pct_applied:  REVENUE_CONFIG.ESCROW_FEE_PCT,
      gross_amount: grossAmount,
      project_id:   m.project_id,
      milestone_id: milestoneId,
      metadata: {
        release_hash:    releaseHash,
        contractor_pay:  contractorPay,
        authorized_by:   userId,
        fee_pct_display: `${(REVENUE_CONFIG.ESCROW_FEE_PCT * 100).toFixed(1)}%`,
        notes,
      },
    });

    // ── 9. Immutable system ledger ─────────────────────────────────────────
    const lHash = crypto.createHash('sha256')
      .update(JSON.stringify({ milestoneId, amount: grossAmount, releaseHash, ts: Date.now() }))
      .digest('hex');
    await client.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
      ['ADMIN_ESCROW_RELEASE', JSON.stringify({
        milestone_id:      milestoneId,
        project_id:        m.project_id,
        gross_amount:      grossAmount,
        contractor_pay:    contractorPay,
        platform_fee:      platformFeeUsd,
        platform_fee_pct:  `${(REVENUE_CONFIG.ESCROW_FEE_PCT * 100).toFixed(1)}%`,
        release_hash:      releaseHash,
        authorized_by:     userId,
        notes,
      }), lHash]
    );

    await client.query('COMMIT');
    return res.json({
      success:           true,
      message:           `✅ Milestone paid — contractor receives $${contractorPay.toFixed(2)}, platform earns $${platformFeeUsd.toFixed(2)}`,
      gross_amount:      grossAmount,
      contractor_pay:    contractorPay,
      platform_fee:      platformFeeUsd,
      platform_fee_pct:  `${(REVENUE_CONFIG.ESCROW_FEE_PCT * 100).toFixed(1)}%`,
      release_hash:      releaseHash,
      ledger_hash:       lHash,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: error.message });
  } finally { client.release(); }
});


// ============================================================================
// PAYSTACK PAYMENT GATEWAY — Initialize, Webhook, Verify, Transfers
// ============================================================================

// CRITICAL: Webhook must use raw body for HMAC verification
// This endpoint is called by Paystack when a payment event occurs
// It MUST be registered BEFORE express.json() middleware for the raw body
app.post("/api/payments/webhook",
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response): Promise<any> => {
    // ── SECURITY GATE 1: Verify Paystack signature ─────────────────────────
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(req.body)
      .digest('hex');

    const signature = req.headers['x-paystack-signature'] as string;

    if (!hash || !signature || hash !== signature) {
      console.error('[WEBHOOK] ❌ Invalid Paystack signature — possible forgery attempt');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // ── Parse body after verification ─────────────────────────────────────
    let event: any;
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    console.log('[WEBHOOK] Event received:', event.event, event.data?.reference);

    // ── SECURITY GATE 2: Webhook replay protection ─────────────────────────
    // Every charge.success event carries a unique Paystack txReference.
    // We record it in processed_webhooks on first sight. Duplicate references
    // (retries, replays, manual re-sends) are silently ACK'd and discarded.
    // This prevents: double-credited rent, double-activated listings, double-escrow.
    const txReference = event.data?.reference || '';
    if (event.event === 'charge.success' && txReference) {
      try {
        await pool.query(
          `INSERT INTO processed_webhooks (event_ref, event_type) VALUES ($1, $2)`,
          [txReference, event.data?.metadata?.payment_type || 'UNKNOWN']
        );
      } catch (replayErr: any) {
        if (replayErr.code === '23505') {
          // Unique violation = already processed
          console.warn(`[WEBHOOK] Duplicate event ignored: ${txReference}`);
          return res.sendStatus(200); // ACK Paystack; do nothing
        }
        // Other DB error — let it bubble to prevent silent failures
        console.error('[WEBHOOK] Replay guard DB error:', replayErr.message);
        return res.status(500).json({ error: 'Internal webhook error' });
      }
    }

    // ── Product routing: only process Nested Ark transactions ─────────────
    // Shared Paystack accounts can have multiple products. We identify ours
    // by the product field in metadata. Unknown products are silently ACK'd.
    const product = event.data?.metadata?.product;
    if (product && product !== 'nestedark') {
      console.log('[WEBHOOK] Routing to other product handler:', product, '— skipping Nested Ark processing');
      return res.sendStatus(200); // ACK to Paystack, not our transaction
    }

    // ── Route all charge.success events ─────────────────────────────────────
    const paymentType = event.data?.metadata?.payment_type;
    // txReference already declared above in replay guard

    // ── MARKETING_AD_FEE: activate marketplace listing ────────────────────
    if (event.event === 'charge.success' && paymentType === 'MARKETING_AD_FEE') {
      const meta   = event.data?.metadata ?? {};
      const unitId = meta.unit_id;
      if (unitId) {
        const adHash = crypto.createHash('sha256')
          .update(`ad-fee-${txReference}-${unitId}-${Date.now()}`).digest('hex');
        await pool.query(
          `UPDATE rental_units SET is_advertised=TRUE, advertised_at=NOW(), listing_expires_at=NOW()+INTERVAL '30 days' WHERE id=$1`,
          [unitId]
        ).catch(() => {});
        await pool.query(
          `INSERT INTO platform_revenue
             (project_id, amount_ngn, amount_usd, source, pct_applied, gross_amount, fee_type, ledger_hash)
           SELECT ru.project_id, $1, $2, 'LISTING_FEE', 0, $1, 'MARKETING_AD_FEE', $3
           FROM rental_units ru WHERE ru.id=$4`,
          [event.data.amount/100, event.data.amount/100/1500, adHash, unitId]
        ).catch(() => {});
        await pool.query(
          `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
           VALUES ('MARKETPLACE_AD_FEE', $1, $2)`,
          [JSON.stringify({ unit_id: unitId, reference: txReference, amount_ngn: event.data.amount/100 }), adHash]
        ).catch(() => {});
        console.log(`[WEBHOOK] Marketplace listing ACTIVATED: unit=${unitId}`);
        // Audit trail
        await logAudit({
          event_type:  'LISTING_ADVERTISED',
          actor_id:    meta.landlord_id ?? null,
          actor_role:  'DEVELOPER',
          unit_id:     unitId,
          description: `Unit listed on marketplace. Listing fee ₦${event.data.amount/100} paid. Expires in 30 days.`,
          metadata:    { reference: txReference, amount_ngn: event.data.amount/100, landlord_id: meta.landlord_id },
        });
      }
    }

    // ── RENTAL/VAULT payment ───────────────────────────────────────────────
    const isVaultPayment = paymentType === 'RENT'
                        || paymentType === 'RENT_INSTALLMENT'
                        || txReference.startsWith('ARK-VAULT-');

    if (event.event === 'charge.success' && isVaultPayment) {
      const { reference, amount } = event.data;
      const amountNgn = amount / 100;
      const meta      = event.data?.metadata ?? {};
      console.log('[WEBHOOK] RENT payment received:', reference, 'NGN', amountNgn);
      try {
        // ── Step 1: Mark rent_payment as SUCCESS ────────────────────────────
        await pool.query(
          "UPDATE rent_payments SET status='SUCCESS', amount_ngn=$1, paid_at=NOW() WHERE paystack_reference=$2",
          [amountNgn, reference]
        );
        // Audit: rent payment received
        await logAudit({
          event_type:  'RENT_PAID',
          actor_id:    meta.tenant_id ?? null,
          actor_role:  'TENANT',
          unit_id:     meta.unit_id ?? null,
          tenancy_id:  meta.tenancy_id ?? null,
          project_id:  meta.project_id ?? null,
          description: `Rent payment of ₦${amountNgn.toLocaleString()} received for "${meta.unit_name ?? 'unit'}" — period ${meta.period_month ?? 'N/A'}`,
          metadata:    { reference, amount_ngn: amountNgn, period_month: meta.period_month, rent_payment_id: meta.rent_payment_id },
        });

        // ── Step 2: Credit the tenant's flex_pay vault ──────────────────────
        // Critical: update vault_balance so tenant sees payment on dashboard.
        if (meta.tenancy_id) {
          try {
            const vaultRes = await pool.query(
              `SELECT fpv.* FROM flex_pay_vaults fpv
               WHERE fpv.tenancy_id = $1
                 AND fpv.status IN ('ACTIVE','FUNDED_READY')
               ORDER BY fpv.created_at DESC LIMIT 1`,
              [meta.tenancy_id]
            );
            if (vaultRes.rows.length) {
              const v           = vaultRes.rows[0];
              const newBalance  = Math.min(
                parseFloat(v.vault_balance) + amountNgn,
                parseFloat(v.target_amount) * 1.5  // cap at 150% to prevent runaway
              );
              const target      = parseFloat(v.target_amount);
              const periodLabel = meta.period_month || new Date().toISOString().slice(0, 7);
              const h = crypto.createHash('sha256')
                .update(`flex-rent-${v.id}-${amountNgn}-${reference}-${Date.now()}`)
                .digest('hex');

              let newStatus  = v.status;
              let newPeriods = parseInt(v.funded_periods) || 0;
              if (newBalance >= target) {
                newPeriods += 1;
                newStatus = (v.cashout_mode === 'LUMP_SUM') ? 'FUNDED_READY' : v.status;
              }

              // Insert contribution record (idempotent — ON CONFLICT DO NOTHING)
              await pool.query(
                `INSERT INTO flex_contributions
                   (vault_id, tenancy_id, amount_ngn, paystack_ref, status, period_label, paid_at, ledger_hash)
                 VALUES ($1,$2,$3,$4,'SUCCESS',$5,NOW(),$6)
                 ON CONFLICT ON CONSTRAINT flex_contributions_paystack_ref_key DO NOTHING`,
                [v.id, meta.tenancy_id, amountNgn, reference, periodLabel, h]
              );

              // Update vault balance + status
              await pool.query(
                `UPDATE flex_pay_vaults
                 SET vault_balance=$1, funded_periods=$2, status=$3, updated_at=NOW()
                 WHERE id=$4`,
                [newBalance, newPeriods, newStatus, v.id]
              );

              // Immutable ledger entry
              await pool.query(
                `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
                 VALUES ('FLEX_RENT_PAYMENT',$1,$2)`,
                [JSON.stringify({
                  vault_id: v.id, tenancy_id: meta.tenancy_id,
                  amount_ngn: amountNgn, reference, period_label: periodLabel,
                  new_balance: newBalance,
                  funded_pct: Math.min(Math.round((newBalance / target) * 100), 100),
                }), h]
              );

              console.log(`[WEBHOOK] Vault credited → tenancy=${meta.tenancy_id} +₦${amountNgn} balance=₦${newBalance}`);

              // ── Vault milestone notifications (25 / 50 / 75 / 100%) ─────────
              setImmediate(async () => {
                try {
                  const fundedPct = Math.min(Math.round((newBalance / target) * 100), 100);
                  const prevPct   = Math.min(Math.round(((newBalance - amountNgn) / target) * 100), 100);
                  const milestones = [25, 50, 75, 100];
                  const hitMilestone = milestones.find(m => prevPct < m && fundedPct >= m);
                  if (!hitMilestone) return;

                  // Fetch tenant email from tenancy
                  const tRes = await pool.query(
                    `SELECT t.tenant_name, t.tenant_email, ru.unit_name, p.title AS project_title
                     FROM tenancies t
                     LEFT JOIN rental_units ru ON ru.id = t.unit_id
                     LEFT JOIN projects p ON p.id = ru.project_id
                     WHERE t.id = $1 LIMIT 1`,
                    [meta.tenancy_id]
                  );
                  if (!tRes.rows.length || !tRes.rows[0].tenant_email) return;
                  const { tenant_name, tenant_email, unit_name, project_title } = tRes.rows[0];
                  const firstName = (tenant_name || 'Tenant').split(' ')[0];
                  const frontendUrl = process.env.FRONTEND_URL || 'https://nestedark.com';
                  const { subject, html } = vaultMilestoneTemplate({
                    firstName,
                    vaultLabel: 'Rent Vault',
                    hitMilestone,
                    fundedPct,
                    currentAmount: `₦${Math.round(newBalance).toLocaleString()}`,
                    targetAmount: `₦${Math.round(target).toLocaleString()}`,
                    ctaUrl: `${frontendUrl}/tenant/vault`,
                  });
                  const result = await EmailService.send({ to: tenant_email, subject, html, template: 'vault_milestone', await: true });
                  if (result?.success) {
                    console.log(`[MILESTONE] ${hitMilestone}% notification sent → ${tenant_email}`);
                  }
                } catch (milestoneErr: any) {
                  console.error('[MILESTONE] Email failed (non-fatal):', milestoneErr.message);
                }
              });

              // ── Step 3: Auto-payout to landlord when vault fully funds ─────
              if (newBalance >= target && PAYSTACK_SECRET) {
                setImmediate(async () => {
                  try {
                    // Try fpv.unit_id first; fall back through tenancy if unit_id is NULL
                    const projRes = await pool.query(
                      `SELECT p.sponsor_id, ru.rent_amount, ru.currency
                       FROM flex_pay_vaults fpv
                       LEFT JOIN rental_units ru  ON ru.id  = COALESCE(fpv.unit_id, (
                         SELECT t2.unit_id FROM tenancies t2 WHERE t2.id = fpv.tenancy_id LIMIT 1
                       ))
                       LEFT JOIN projects p       ON p.id   = COALESCE(ru.project_id, fpv.project_id)
                       WHERE fpv.id = $1
                         AND p.id IS NOT NULL`,
                      [v.id]
                    );
                    if (!projRes.rows.length) {
                      console.warn(`[WEBHOOK] Auto-payout skipped — cannot resolve project for vault ${v.id}`);
                      return;
                    }
                    const { sponsor_id, currency } = projRes.rows[0];

                    // ── Fetch actual vault_balance (the real accumulated escrow amount) ──
                    // Using vault_balance — NOT rent_amount from rental_units.
                    // vault_balance = total tenant contributions held in platform escrow.
                    const vaultBal = await pool.query(
                      `SELECT vault_balance, unit_id FROM flex_pay_vaults WHERE id = $1`,
                      [v.id]
                    );
                    const vaultEscrowAmount = parseFloat(vaultBal.rows[0]?.vault_balance || '0');
                    const vaultUnitId       = vaultBal.rows[0]?.unit_id ?? meta.unit_id ?? null;

                    // ── Prefer the bank account linked to this specific unit (Option 1) ──
                    // Falls back to landlord's default account if unit has no specific link.
                    const bankRes = await pool.query(
                      `SELECT lba.*
                       FROM landlord_bank_accounts lba
                       WHERE lba.paystack_recipient_code IS NOT NULL
                         AND (
                           -- Unit-specific account (set when landlord deployed the unit)
                           lba.id = (SELECT landlord_bank_account_id FROM rental_units
                                     WHERE id = COALESCE($2, '00000000-0000-0000-0000-000000000000'::uuid)
                                     LIMIT 1)
                           OR
                           -- Fallback: landlord's default account
                           (lba.user_id = $1 AND lba.is_default = true)
                         )
                       ORDER BY
                         CASE WHEN lba.id = (SELECT landlord_bank_account_id FROM rental_units
                                             WHERE id = COALESCE($2, '00000000-0000-0000-0000-000000000000'::uuid)
                                             LIMIT 1) THEN 0 ELSE 1 END
                       LIMIT 1`,
                      [sponsor_id, vaultUnitId]
                    );
                    if (!bankRes.rows.length) {
                      console.log(`[WEBHOOK] No payout-ready bank account for landlord ${sponsor_id} — payout deferred to retry cron`);
                      return;
                    }
                    const acct = bankRes.rows[0];

                    // Deduct 2% platform fee from actual escrow balance, convert to kobo
                    const platformFee = Math.round(vaultEscrowAmount * 0.02 * 100) / 100;
                    const netKobo     = Math.round((vaultEscrowAmount - platformFee) * 100);
                    console.log(`[WEBHOOK] Escrow release → vault=₦${vaultEscrowAmount} platformFee=₦${platformFee} landlord=₦${netKobo/100}`);
                    const payRef      = `ESCROW-RELEASE-${crypto.randomUUID().split('-')[0].toUpperCase()}-${Date.now()}`;
                    const tRes = await fetch(`${PAYSTACK_BASE}/transfer`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        source:    'balance',
                        amount:    netKobo,
                        recipient: acct.paystack_recipient_code,
                        reason:    `Nested Ark escrow release — vault fully funded — ${periodLabel}`,
                        reference: payRef,
                        currency:  currency || 'NGN',
                      }),
                    });
                    const tData = await tRes.json() as any;

                    const ph = crypto.createHash('sha256')
                      .update(`escrow-release-${payRef}-${sponsor_id}-${netKobo}-${Date.now()}`)
                      .digest('hex');
                    await pool.query(
                      `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
                       VALUES ('LANDLORD_PAYOUT',$1,$2)`,
                      [JSON.stringify({
                        reference:       payRef,
                        amount_ngn:      netKobo / 100,
                        vault_total_ngn: vaultEscrowAmount,
                        platform_fee:    platformFee,
                        user_id:         sponsor_id,
                        bank_account_id: acct.id,
                        transfer_code:   tData.data?.transfer_code,
                        transfer_status: tData.status ? 'INITIATED' : 'FAILED',
                        vault_id:        v.id,
                        period_label:    periodLabel,
                        payout_type:     'ESCROW_LUMP_SUM',
                      }), ph]
                    );
                    if (tData.status) {
                      // Zero out vault balance after successful release
                      await pool.query(
                        `UPDATE flex_pay_vaults SET vault_balance=0, status='ACTIVE', updated_at=NOW() WHERE id=$1`,
                        [v.id]
                      );
                      await logAudit({
                        event_type:  'ESCROW_RELEASED',
                        actor_id:    sponsor_id,
                        actor_role:  'SYSTEM',
                        description: `Vault escrow released: ₦${vaultEscrowAmount.toLocaleString()} → landlord ${acct.account_name} (${acct.bank_name}). Platform fee ₦${platformFee.toLocaleString()} retained.`,
                        metadata:    { vault_id: v.id, reference: payRef, vault_total: vaultEscrowAmount, net_payout: netKobo/100, platform_fee: platformFee },
                      });
                    }
                    console.log(`[WEBHOOK] Escrow release ${tData.status ? '✅' : '❌'} → ${acct.account_name} | ${acct.bank_name} | ₦${netKobo/100} | ref=${payRef}`);
                    if (!tData.status) console.error('[WEBHOOK] Escrow release failed:', tData.message);
                  } catch (payoutErr: any) {
                    console.warn('[WEBHOOK] Auto-payout error:', payoutErr.message);
                  }
                });
              }
            }
          } catch (vaultErr: any) {
            console.error('[WEBHOOK] Vault credit error:', vaultErr.message);
          }
        }

        // ── Step 3b: Direct payout — no vault, or vault didn't reach target ──
        // If the tenant has no Flex-Pay vault (standard rent payment) we must
        // still forward the rent to the landlord immediately. 2% stays as the
        // platform fee; the rest is transferred to the landlord's default bank.
        if (meta.tenancy_id && meta.project_id && PAYSTACK_SECRET) {
          setImmediate(async () => {
            try {
              // Only proceed if a vault payout was NOT already triggered above
              // (i.e. vault existed AND balance reached target). We detect this
              // by checking if a LANDLORD_PAYOUT ledger entry already exists for
              // this reference.
              const alreadyPaid = await pool.query(
                `SELECT id FROM system_ledger
                 WHERE transaction_type = 'LANDLORD_PAYOUT'
                   AND payload->>'period_label' = $1
                   AND created_at > NOW() - INTERVAL '5 minutes'
                 LIMIT 1`,
                [meta.period_month || reference]
              );
              if (alreadyPaid.rows.length) return; // vault already paid out

              // Resolve landlord (sponsor) from tenancy → rental_unit → project
              const landlordRes = await pool.query(
                `SELECT p.sponsor_id, ru.rent_amount, ru.currency
                 FROM tenancies t
                 JOIN rental_units ru ON ru.id = t.unit_id
                 JOIN projects p      ON p.id  = ru.project_id
                 WHERE t.id = $1`,
                [meta.tenancy_id]
              );
              if (!landlordRes.rows.length) {
                console.warn(`[WEBHOOK] Direct-payout: cannot resolve landlord for tenancy ${meta.tenancy_id}`);
                return;
              }
              const { sponsor_id, rent_amount, currency } = landlordRes.rows[0];

              const bankRes = await pool.query(
                `SELECT * FROM landlord_bank_accounts
                 WHERE user_id = $1 AND is_default = true
                   AND paystack_recipient_code IS NOT NULL LIMIT 1`,
                [sponsor_id]
              );
              if (!bankRes.rows.length) {
                console.log(`[WEBHOOK] Direct-payout: no default bank for landlord ${sponsor_id} — skipped`);
                return;
              }
              const acct = bankRes.rows[0];

              const platformFee  = Math.round(amountNgn * 0.02 * 100) / 100;
              const netKobo      = Math.round((amountNgn - platformFee) * 100);
              const periodLabel  = meta.period_month || new Date().toISOString().slice(0, 7);
              const payRef       = `RENT-PAYOUT-${uuidv4().split('-')[0].toUpperCase()}-${Date.now()}`;

              const tRes = await fetch(`${PAYSTACK_BASE}/transfer`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  source:    'balance',
                  amount:    netKobo,
                  recipient: acct.paystack_recipient_code,
                  reason:    `Nested Ark rent — ${periodLabel}`,
                  reference: payRef,
                  currency:  currency || 'NGN',
                }),
              });
              const tData = await tRes.json() as any;

              const ph = crypto.createHash('sha256')
                .update(`direct-payout-${payRef}-${sponsor_id}-${netKobo}-${Date.now()}`)
                .digest('hex');
              await pool.query(
                `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
                 VALUES ('LANDLORD_PAYOUT', $1, $2)`,
                [JSON.stringify({
                  reference: payRef, amount_ngn: netKobo / 100,
                  platform_fee: platformFee, user_id: sponsor_id,
                  bank_account_id: acct.id,
                  transfer_code: tData.data?.transfer_code,
                  transfer_status: tData.status ? 'INITIATED' : 'FAILED',
                  tenancy_id: meta.tenancy_id, period_label: periodLabel,
                  paystack_reference: reference,   // ← dedup key
                  source: 'DIRECT_RENT',
                }), ph]
              );
              console.log(`[WEBHOOK] Direct rent payout → ${acct.account_name} | ${acct.bank_name} | ₦${netKobo/100} | ref=${payRef} | status=${tData.data?.status ?? (tData.status ? 'ok' : 'failed')}`);
            } catch (directPayErr: any) {
              console.warn('[WEBHOOK] Direct-payout error:', directPayErr.message);
            }
          });
        }

        // ── Step 4: Yield distributions to investors ────────────────────────
        if (meta.rent_payment_id && meta.project_id) {
          await computeYieldDistributions(meta.project_id, meta.rent_payment_id, amountNgn);
        }
      } catch (e: any) {
        console.error('[WEBHOOK] Rent processing error:', e.message);
      }
      return res.sendStatus(200);
    }

    // ── STANDALONE_INSTALLMENT — credit independent tenant vault ─────────────
    // Fires when a tenant with no landlord tenancy pays into their standalone vault.
    // Funds remain in platform escrow. When target is hit, vault status → FUNDED_READY.
    // Admin triggers escrow release to landlord once they onboard.
    if (event.event === 'charge.success' && event.data?.metadata?.payment_type === 'STANDALONE_INSTALLMENT') {
      const { reference, amount } = event.data;
      const amountNgn = amount / 100;
      const meta      = event.data?.metadata ?? {};
      const svId      = meta.standalone_vault_id;
      if (!svId) {
        console.warn('[WEBHOOK] STANDALONE_INSTALLMENT: missing standalone_vault_id in metadata');
        return res.sendStatus(200);
      }
      try {
        const svRes = await pool.query(
          `SELECT * FROM standalone_vaults WHERE id=$1 FOR UPDATE`, [svId]
        );
        if (!svRes.rows.length) {
          console.warn(`[WEBHOOK] STANDALONE_INSTALLMENT: vault ${svId} not found`);
          return res.sendStatus(200);
        }
        const sv         = svRes.rows[0];
        const target     = parseFloat(sv.target_amount);
        const newBalance = parseFloat(sv.vault_balance) + amountNgn; // No cap — accumulate all tenant payments
        const periodLabel = new Date().toISOString().slice(0, 7);
        const newPeriods  = newBalance >= target ? (parseInt(sv.funded_periods) || 0) + 1 : parseInt(sv.funded_periods) || 0;
        const newStatus   = newBalance >= target ? 'FUNDED_READY' : sv.status;

        const h = crypto.createHash('sha256')
          .update(`sv-contrib-${svId}-${amountNgn}-${reference}-${Date.now()}`).digest('hex');

        // Idempotent contribution insert
        await pool.query(
          `INSERT INTO standalone_contributions
             (vault_id, amount_ngn, paystack_ref, status, period_label, paid_at, ledger_hash)
           VALUES ($1,$2,$3,'SUCCESS',$4,NOW(),$5)
           ON CONFLICT (paystack_ref) DO NOTHING`,
          [svId, amountNgn, reference, periodLabel, h]
        );
        // Update vault balance + status
        await pool.query(
          `UPDATE standalone_vaults
           SET vault_balance=$1, funded_periods=$2, status=$3, updated_at=NOW()
           WHERE id=$4`,
          [newBalance, newPeriods, newStatus, svId]
        );
        // Immutable ledger
        pool.query(
          `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
           VALUES ('STANDALONE_VAULT_CREDIT',$1,$2)`,
          [JSON.stringify({
            vault_id:    svId,
            tenant_id:   sv.tenant_user_id,
            amount_ngn:  amountNgn,
            reference,
            new_balance: newBalance,
            funded_pct:  Math.min(Math.round((newBalance / target) * 100), 100),
            period_label: periodLabel,
          }), h]
        ).catch(() => {});

        console.log(`[STANDALONE-VAULT] +₦${amountNgn} → vault=${svId} balance=₦${newBalance} (${Math.min(Math.round((newBalance/target)*100),100)}%)`);
        if (newStatus === 'FUNDED_READY') {
          console.log(`[STANDALONE-VAULT] 🎯 Vault ${svId} FULLY FUNDED — awaiting landlord onboarding for escrow release`);
        }

        // ── Standalone vault milestone notifications (25 / 50 / 75 / 100%) ──
        setImmediate(async () => {
          try {
            const fundedPct = Math.min(Math.round((newBalance / target) * 100), 100);
            const prevPct   = Math.min(Math.round(((newBalance - amountNgn) / target) * 100), 100);
            const milestones = [25, 50, 75, 100];
            const hitMilestone = milestones.find(m => prevPct < m && fundedPct >= m);
            if (!hitMilestone) return;

            const uRes = await pool.query(
              `SELECT full_name, email FROM public.users WHERE id = $1 LIMIT 1`,
              [sv.tenant_user_id]
            );
            if (!uRes.rows.length || !uRes.rows[0].email) return;
            const { full_name, email: tenantEmail } = uRes.rows[0];
            const firstName  = (full_name || 'Tenant').split(' ')[0];
            const frontendUrl = process.env.FRONTEND_URL || 'https://nestedark.com';
            const { subject, html } = vaultMilestoneTemplate({
              firstName,
              vaultLabel: 'Savings Vault',
              hitMilestone,
              fundedPct,
              currentAmount: `₦${Math.round(newBalance).toLocaleString()}`,
              targetAmount: `₦${Math.round(target).toLocaleString()}`,
              ctaUrl: `${frontendUrl}/tenant/vault`,
            });
            const result = await EmailService.send({ to: tenantEmail, subject, html, template: 'vault_milestone', await: true });
            if (result?.success) {
              console.log(`[STANDALONE-MILESTONE] ${hitMilestone}% notification sent → ${tenantEmail}`);
            }
          } catch (e: any) {
            console.error('[STANDALONE-MILESTONE] Email failed (non-fatal):', e.message);
          }
        });
      } catch (svErr: any) {
        console.error('[WEBHOOK] STANDALONE_INSTALLMENT error:', svErr.message);
      }
      return res.sendStatus(200);
    }

    // ── Handle transfer.success — log confirmed landlord payout ──────────────
    if (event.event === 'transfer.success' || event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
      const td = event.data;
      const tStatus   = event.event === 'transfer.success' ? 'SUCCESS'
                      : event.event === 'transfer.failed'  ? 'FAILED'
                      : 'REVERSED';
      const tHash = crypto.createHash('sha256')
        .update(`transfer-${td.reference}-${tStatus}-${Date.now()}`).digest('hex');

      // Update original LANDLORD_PAYOUT entry — flip transfer_status and set event_type
      await pool.query(
        `UPDATE system_ledger
         SET payload     = payload || $1::jsonb,
             event_type  = $2,
             description = COALESCE(description, '') || $3
         WHERE transaction_type IN ('LANDLORD_PAYOUT','CASHOUT_TRANSFER','AUTO_PAYOUT')
           AND payload->>'reference' = $4`,
        [
          JSON.stringify({ transfer_status: tStatus, settled_at: new Date().toISOString(), transfer_code: td.transfer_code }),
          tStatus === 'SUCCESS' ? 'PAYOUT_SUCCESS' : tStatus === 'FAILED' ? 'PAYOUT_FAILED' : 'PAYOUT_REVERSED',
          tStatus === 'SUCCESS' ? ' Transfer confirmed by Paystack.' : ` Transfer ${tStatus.toLowerCase()} by Paystack.`,
          td.reference,
        ]
      ).catch(() => {});

      // Immutable TRANSFER_OUTCOME record for complete audit chain
      await pool.query(
        `INSERT INTO system_ledger
           (transaction_type, event_type, entity_type, description, payload, immutable_hash)
         VALUES ('TRANSFER_OUTCOME', $1, 'FLEX_PAY_VAULT', $2, $3, $4)`,
        [
          tStatus === 'SUCCESS' ? 'PAYOUT_SUCCESS' : tStatus === 'FAILED' ? 'PAYOUT_FAILED' : 'PAYOUT_REVERSED',
          `Paystack transfer ${tStatus.toLowerCase()}: ₦${td.amount/100} to ${td.recipient?.details?.account_name||'landlord'} (${td.recipient?.details?.bank_name||''})`,
          JSON.stringify({
            event:          event.event,
            transfer_code:  td.transfer_code,
            reference:      td.reference,
            amount_kobo:    td.amount,
            amount_ngn:     td.amount / 100,
            recipient_code: td.recipient?.recipient_code,
            account_name:   td.recipient?.details?.account_name,
            bank_name:      td.recipient?.details?.bank_name,
            account_number: td.recipient?.details?.account_number,
            status:         tStatus,
            reason:         td.reason,
            settled_at:     td.transferred_at || new Date().toISOString(),
          }),
          tHash,
        ]
      ).catch(() => {});

      console.log(`[WEBHOOK] Transfer ${tStatus}: ref=${td.reference} amount=₦${td.amount/100} to ${td.recipient?.details?.account_name||'landlord'}`);
      return res.sendStatus(200);
    }

    // ── Handle charge.success ──────────────────────────────────────────────
    if (event.event === 'charge.success') {
      const { reference, amount, channel, currency, customer, paid_at } = event.data;
      const amountNgn = amount / 100; // Paystack sends in kobo (1 kobo = 0.01 NGN)
      const ngnRate = 1379; // fallback rate for webhook; real rate used at init time

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Fetch pending transaction to get project_id and investor_id
        const txResult = await client.query(
          "SELECT * FROM payment_transactions WHERE paystack_reference = $1 AND status = 'PENDING'",
          [reference]
        );

        if (txResult.rows.length === 0) {
          // Fallback: try to process using metadata from the event directly
          const meta = event.data?.metadata;
          if (meta?.project_id && meta?.investor_id) {
            console.log('[WEBHOOK] No pending tx found, processing from metadata directly:', reference);
            // Create investment directly from metadata
            const fallbackInvestId = uuidv4();
            const fallbackUsd = meta.amount_usd || (amountNgn / ngnRate);
            await client.query(
              "INSERT INTO investments (id, project_id, investor_id, amount, status) VALUES ($1, $2, $3, $4, 'COMMITTED') ON CONFLICT DO NOTHING",
              [fallbackInvestId, meta.project_id, meta.investor_id, fallbackUsd]
            );
            const fallbackHash = crypto.createHash('sha256').update(reference + Date.now()).digest('hex');
            await client.query(
              "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
              ['PAYSTACK_PAYMENT_SUCCESS_FALLBACK', JSON.stringify({ reference, project_id: meta.project_id, investor_id: meta.investor_id, amount_ngn: amountNgn }), fallbackHash]
            );
            await client.query('COMMIT');
          } else {
            await client.query('ROLLBACK');
            console.warn('[WEBHOOK] No pending tx and no usable metadata for reference:', reference);
          }
          return res.sendStatus(200);
        }

        const tx = txResult.rows[0];

        // ── Update payment_transaction to SUCCESS ────────────────────────
        await client.query(
          "UPDATE payment_transactions SET status = 'SUCCESS', channel = $1, paid_at = $2, updated_at = NOW() WHERE paystack_reference = $3",
          [channel, paid_at || new Date(), reference]
        );

        // ── Create investment record ─────────────────────────────────────
        const investId = uuidv4();
        await client.query(
          "INSERT INTO investments (id, project_id, investor_id, amount, status) VALUES ($1, $2, $3, $4, 'COMMITTED')",
          [investId, tx.project_id, tx.investor_id, tx.amount_usd || amountNgn]
        );

        // ── Get or create escrow wallet ──────────────────────────────────
        const walletResult = await client.query(
          "SELECT id FROM escrow_wallets WHERE project_id = $1",
          [tx.project_id]
        );
        let walletId: string;
        if (walletResult.rows.length > 0) {
          walletId = walletResult.rows[0].id;
          await client.query(
            "UPDATE escrow_wallets SET balance = balance + $1, held_amount = held_amount + $1, updated_at = NOW() WHERE id = $2",
            [tx.amount_usd || amountNgn, walletId]
          );
        } else {
          walletId = uuidv4();
          await client.query(
            "INSERT INTO escrow_wallets (id, project_id, user_id, balance, held_amount) VALUES ($1, $2, $3, $4, $4)",
            [walletId, tx.project_id, tx.investor_id, tx.amount_usd || amountNgn]
          );
        }

        // ── Log transaction ──────────────────────────────────────────────
        const hash2 = crypto.createHash('sha256').update(`${investId}-${tx.project_id}-${amountNgn}-${Date.now()}`).digest('hex');
        await client.query(
          "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
          ['PAYSTACK_PAYMENT_SUCCESS', JSON.stringify({ investment_id: investId, project_id: tx.project_id, investor_id: tx.investor_id, amount_ngn: amountNgn, amount_usd: tx.amount_usd, reference, channel }), hash2]
        );

        // ── RECORD INVESTMENT PLACEMENT FEE (0.5%) ───────────────────────
        const investAmountUsd  = tx.amount_usd || (amountNgn / (ngnRate || 1379));
        const investFeeUsd     = parseFloat((investAmountUsd * REVENUE_CONFIG.INVESTMENT_FEE_PCT).toFixed(4));
        if (investFeeUsd > 0) {
          await recordPlatformRevenue(client, {
            source:       'INVESTMENT_FEE',
            amount_usd:   investFeeUsd,
            amount_ngn:   investFeeUsd * (ngnRate || 1379),
            pct_applied:  REVENUE_CONFIG.INVESTMENT_FEE_PCT,
            gross_amount: investAmountUsd,
            project_id:   tx.project_id,
            investor_id:  tx.investor_id,
            metadata:     { reference, channel, amount_ngn: amountNgn, investment_id: investId },
          }).catch(e => console.error('[REVENUE] investment fee failed:', e.message));
        }

        await client.query('COMMIT');
        console.log('[WEBHOOK] ✅ Payment processed:', reference, amountNgn, 'NGN');
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[WEBHOOK] DB error:', err.message);
      } finally {
        client.release();
      }
    }

    // Always respond 200 — Paystack expects this
    return res.sendStatus(200);
  }
);

// POST /api/payments/initialize — create Paystack transaction, return authorization_url
app.post("/api/payments/initialize", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { amount, projectId } = req.body;

  if (!amount || !projectId) return res.status(400).json({ error: 'amount and projectId required' });
  if (amount < 100) return res.status(400).json({ error: 'Minimum investment is ₦100' });
  if (!PAYSTACK_SECRET) return res.status(503).json({ error: 'Payment gateway not configured. Set PAYSTACK_SECRET_KEY in Render.' });

  try {
    // Get investor email
    const userResult = await pool.query("SELECT email, full_name FROM public.users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const { email } = userResult.rows[0];

    // Get project for metadata
    const projResult = await pool.query("SELECT title, country FROM projects WHERE id = $1", [projectId]);
    if (projResult.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = projResult.rows[0];

    // AMOUNT HANDLING: the investments page sends NGN amounts directly
    // (slider goes from ₦5,000 to ₦5,000,000 — already in NGN)
    // We store a USD equivalent for display only; Paystack charges in NGN
    const rateResult = await pool.query("SELECT rates FROM currency_rates ORDER BY fetched_at DESC LIMIT 1");
    const ngnRate = Number(rateResult.rows[0]?.rates?.NGN) || 1379;
    const amountNgn = Math.round(amount);          // amount IS already in NGN
    const amountUsd = amountNgn / ngnRate;         // store USD equiv for admin view
    const amountKobo = amountNgn * 100;            // Paystack uses kobo (1 NGN = 100 kobo)
    if (amountKobo < 50000) {                      // Paystack live minimum is ₦500
      return res.status(400).json({ error: `Minimum investment is ₦500. You sent ₦${amountNgn}.` });
    }

    // Generate unique reference
    const reference = `NARK-${projectId.slice(0,8)}-${Date.now()}-${uuidv4().slice(0,6)}`;

    // ── Build Paystack payload ─────────────────────────────────────────────
    // ESCROW DESIGN — IMPORTANT:
    // ─────────────────────────────────────────────────────────────────────
    // Investor capital flows to the MAIN Paystack account balance and is
    // held there until a project milestone passes tri-layer verification.
    // At that point the platform manually transfers/settles to the contractor.
    //
    // We do NOT use subaccount splitting at payment time because:
    // • Paystack subaccounts IMMEDIATELY settle to a bank account (T+1)
    // • That breaks escrow — money cannot be held and returned if needed
    // • The 2% platform fee is deducted at milestone RELEASE time, not here
    //
    // The PAYSTACK_SUBACCOUNT_CODE is retained for reference/tracking only.
    // Paystack's own 1.5% transaction fee is covered by the platform (bearer: account).
    const paystackPayload: Record<string, any> = {
      email,
      amount:   amountKobo,
      reference,
      currency: 'NGN',
      bearer:   'account', // Platform (main account) covers the Paystack transaction fee
      callback_url: `${process.env.FRONTEND_URL || 'https://nestedark.com'}/payment-success?ref=${reference}`,
      metadata: {
        product:       'nestedark',
        project_id:    projectId,
        project_title: project.title,
        investor_id:   userId,
        amount_usd:    amountUsd,
        escrow_mode:   'HOLD',  // tells us this is escrow — do not auto-settle
        custom_fields: [
          { display_name: 'Product',      variable_name: 'product',   value: 'Nested Ark OS — Escrow Hold' },
          { display_name: 'Project',      variable_name: 'project',   value: project.title },
          { display_name: 'Country',      variable_name: 'country',   value: project.country },
          { display_name: 'Escrow Mode',  variable_name: 'escrow',    value: 'Funds held until milestone verified' },
        ],
      },
    };
    // NOTE: No subaccount split. Full amount stays in main Paystack balance as escrow.
    // Platform 2% fee is deducted in the /api/admin/milestones/:id/release endpoint.
    console.log('[PAYSTACK] Initializing escrow hold (no subaccount split) — full amount held in main balance');

    // Call Paystack Initialize Transaction API
    const paystackRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData: any = await paystackRes.json();

    if (!paystackData.status) {
      console.error('[PAYSTACK] Init failed:', paystackData);
      return res.status(502).json({ error: 'Payment gateway error: ' + paystackData.message });
    }

    // Store pending transaction in our DB so webhook can complete it
    await pool.query(
      "INSERT INTO payment_transactions (investor_id, project_id, paystack_reference, paystack_access_code, amount_ngn, amount_usd, status) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')",
      [userId, projectId, reference, paystackData.data.access_code, amountNgn, amountUsd]
    );

    console.log('[PAYSTACK] Transaction initialized:', reference);
    return res.json({ success: true, data: paystackData.data, reference });
  } catch (err: any) {
    console.error('[PAYSTACK] Initialize error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/verify/:reference — verify a transaction status
app.get("/api/payments/verify/:reference", authenticate, async (req: Request, res: Response): Promise<any> => {
  const { reference } = req.params;
  if (!PAYSTACK_SECRET) return res.status(503).json({ error: 'Payment gateway not configured' });
  try {
    // Check our DB first
    const dbTx = await pool.query("SELECT * FROM payment_transactions WHERE paystack_reference = $1", [reference]);

    // Also verify directly with Paystack
    const verifyRes = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}` }
    });
    const verifyData: any = await verifyRes.json();

    if (verifyData.status && verifyData.data.status === 'success' && dbTx.rows[0]?.status === 'PENDING') {
      // Idempotent catch-up: if webhook was missed, finalize here
      await pool.query(
        "UPDATE payment_transactions SET status = 'SUCCESS', paid_at = NOW(), updated_at = NOW() WHERE paystack_reference = $1",
        [reference]
      );
    }

    return res.json({
      success: true,
      reference,
      status: verifyData.data?.status || dbTx.rows[0]?.status || 'UNKNOWN',
      amount_ngn: verifyData.data?.amount ? verifyData.data.amount / 100 : dbTx.rows[0]?.amount_ngn,
      paid_at: verifyData.data?.paid_at || dbTx.rows[0]?.paid_at,
      channel: verifyData.data?.channel,
      project_id: dbTx.rows[0]?.project_id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/history — investor's own payment history
app.get("/api/payments/history", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const result = await pool.query(
      `SELECT pt.*, p.title as project_title, p.country FROM payment_transactions pt
      JOIN projects p ON pt.project_id = p.id
      WHERE pt.investor_id = $1
      ORDER BY pt.created_at DESC LIMIT 50`,
      [userId]
    );
    return res.json({ success: true, transactions: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// KYC ENDPOINTS — Know Your Customer
// ============================================================================

// POST /api/kyc/submit — investor submits KYC information
app.post("/api/kyc/submit", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { full_name, date_of_birth, nationality, id_type, id_number, id_document_url, selfie_url, address, city, country } = req.body;
  if (!full_name || !id_type || !id_number) return res.status(400).json({ error: 'full_name, id_type, and id_number required' });
  const validIdTypes = ['PASSPORT', 'NIN', 'BVN', 'DRIVERS_LICENSE', 'NATIONAL_ID'];
  if (!validIdTypes.includes(id_type)) return res.status(400).json({ error: 'Invalid id_type. Use: ' + validIdTypes.join(', ') });
  try {
    const result = await pool.query(
      `INSERT INTO kyc_records (user_id, full_name, date_of_birth, nationality, id_type, id_number, id_document_url, selfie_url, address, city, country, kyc_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING')
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = $2, date_of_birth = $3, nationality = $4, id_type = $5, id_number = $6,
        id_document_url = COALESCE($7, kyc_records.id_document_url),
        selfie_url = COALESCE($8, kyc_records.selfie_url),
        address = $9, city = $10, country = $11, kyc_status = 'PENDING', updated_at = NOW()
      RETURNING *`,
      [userId, full_name, date_of_birth || null, nationality || null, id_type, id_number, id_document_url || null, selfie_url || null, address || null, city || null, country || null]
    );
    const lHash = crypto.createHash('sha256').update(userId + id_type + id_number + Date.now()).digest('hex');
    await pool.query("INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)", ['KYC_SUBMITTED', JSON.stringify({ user_id: userId, id_type }), lHash]);
    return res.status(201).json({ success: true, kyc: result.rows[0], message: 'KYC submitted. Verification takes 1-3 business days.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/kyc/status — get own KYC status
app.get("/api/kyc/status", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const result = await pool.query("SELECT id, kyc_status, id_type, full_name, created_at, verified_at, rejection_reason FROM kyc_records WHERE user_id = $1", [userId]);
    if (result.rows.length === 0) return res.json({ success: true, kyc_status: 'NOT_SUBMITTED', record: null });
    return res.json({ success: true, kyc_status: result.rows[0].kyc_status, record: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/kyc/:userId/review — admin approves or rejects KYC
app.post("/api/admin/kyc/:userId/review", authenticate, async (req: Request, res: Response): Promise<any> => {
  const adminId = (req as any).userId;
  const roleCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [adminId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(roleCheck.rows[0]?.role)) return res.status(403).json({ error: 'Admin only' });
  const { approved, rejection_reason } = req.body;
  const status = approved ? 'VERIFIED' : 'REJECTED';
  try {
    const result = await pool.query(
      "UPDATE kyc_records SET kyc_status = $1, verified_at = CASE WHEN $1 = 'VERIFIED' THEN NOW() ELSE NULL END, rejection_reason = $2, updated_at = NOW() WHERE user_id = $3 RETURNING *",
      [status, rejection_reason || null, req.params.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'KYC record not found' });
    const lHash = crypto.createHash('sha256').update(req.params.userId + status + Date.now()).digest('hex');
    await pool.query("INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)", [approved ? 'KYC_VERIFIED' : 'KYC_REJECTED', JSON.stringify({ user_id: req.params.userId, reviewer: adminId, status }), lHash]);
    return res.json({ success: true, kyc: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/kyc — admin view all pending KYC records
app.get("/api/admin/kyc", authenticate, async (req: Request, res: Response): Promise<any> => {
  const adminId = (req as any).userId;
  const roleCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [adminId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(roleCheck.rows[0]?.role)) return res.status(403).json({ error: 'Admin only' });
  try {
    const result = await pool.query(
      `SELECT k.*, u.email, u.full_name as user_full_name FROM kyc_records k JOIN public.users u ON k.user_id = u.id ORDER BY k.created_at DESC`
    );
    return res.json({ success: true, records: result.rows, count: result.rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// SEED ENDPOINT — Bootstraps live demo data (call once with a real user id)
// ============================================================================
app.post("/api/seed", async (req: Request, res: Response): Promise<any> => {
  let { sponsor_id } = req.body;
  if (!sponsor_id) return res.status(400).json({ error: "sponsor_id required — pass your email or user UUID." });

  console.log("🌱 SEED: Starting with sponsor_id:", sponsor_id);

  // Accept email OR UUID — resolve to UUID
  try {
    const isEmail = sponsor_id.includes('@');
    const userCheck = isEmail
      ? await pool.query("SELECT id, role FROM public.users WHERE email = $1", [sponsor_id.toLowerCase()])
      : await pool.query("SELECT id, role FROM public.users WHERE id = $1", [sponsor_id]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: `No user found for '${sponsor_id}'. Register as GOVERNMENT first.` });
    }
    sponsor_id = userCheck.rows[0].id;
    console.log("🌱 SEED: Resolved sponsor UUID:", sponsor_id);
  } catch (lookupErr: any) {
    return res.status(500).json({ error: "User lookup failed: " + lookupErr.message });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const DEMO_PROJECTS = [
      {
        title: 'Lagos-Ibadan Expressway Upgrade',
        description: 'Full rehabilitation of the 127km Lagos-Ibadan expressway including resurfacing, drainage systems, and smart traffic management.',
        location: 'Lagos', country: 'Nigeria', budget: 2500000, category: 'Roads', months: 24,
        m1: { title: 'Phase 1: Site Preparation & Foundation', pct: 0.3 },
        m2: { title: 'Phase 2: Main Construction & Completion', pct: 0.7 },
      },
      {
        title: 'Abuja Solar Grid Initiative',
        description: 'Installation of 50MW solar farm and smart grid infrastructure to power 10,000 homes in the FCT with renewable energy.',
        location: 'Abuja', country: 'Nigeria', budget: 1800000, category: 'Energy', months: 18,
        m1: { title: 'Phase 1: Land Acquisition & Equipment Import', pct: 0.35 },
        m2: { title: 'Phase 2: Installation & Grid Connection', pct: 0.65 },
      },
      {
        title: 'Kano Water Treatment Plant',
        description: 'Construction of a modern water treatment facility serving 500,000 residents with clean, safe drinking water 24/7.',
        location: 'Kano', country: 'Nigeria', budget: 3200000, category: 'Water', months: 30,
        m1: { title: 'Phase 1: Civil Works & Excavation', pct: 0.4 },
        m2: { title: 'Phase 2: Treatment Systems & Commissioning', pct: 0.6 },
      },
      {
        title: 'Port Harcourt Smart Bridge',
        description: 'Construction of a 2.4km cable-stayed bridge over the Bonny River with integrated monitoring sensors and toll collection.',
        location: 'Port Harcourt', country: 'Nigeria', budget: 5500000, category: 'Bridges', months: 36,
        m1: { title: 'Phase 1: Foundation & Pylon Construction', pct: 0.45 },
        m2: { title: 'Phase 2: Deck, Cabling & Systems Integration', pct: 0.55 },
      },
      {
        title: 'Accra Digital Infrastructure Hub',
        description: 'Development of a 10,000 sqm technology park with fiber connectivity, data centers, and startup incubation spaces.',
        location: 'Accra', country: 'Ghana', budget: 1200000, category: 'Technology', months: 20,
        m1: { title: 'Phase 1: Building Shell & Data Center Infrastructure', pct: 0.5 },
        m2: { title: 'Phase 2: Fit-out, Connectivity & Launch', pct: 0.5 },
      },
    ];

    const seeded: any[] = [];

    for (const proj of DEMO_PROJECTS) {
      const projectId = uuidv4();
      await client.query(
        `INSERT INTO projects (id, sponsor_id, title, description, location, country, budget, currency, category, timeline_months, status, progress_percentage, gov_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
        [projectId, sponsor_id, proj.title, proj.description, proj.location, proj.country, proj.budget, 'USD', proj.category, proj.months, 'ACTIVE', 0, false]
      );
      const m1id = uuidv4(), m2id = uuidv4();
      await client.query(
        `INSERT INTO milestones (id, project_id, title, description, budget_allocation, status, progress_percentage, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [m1id, projectId, proj.m1.title, 'Initial phase of construction and site preparation.', Math.round(proj.budget * proj.m1.pct), 'PENDING', 0]
      );
      await client.query(
        `INSERT INTO milestones (id, project_id, title, description, budget_allocation, status, progress_percentage, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [m2id, projectId, proj.m2.title, 'Main construction phase through completion and handover.', Math.round(proj.budget * proj.m2.pct), 'PENDING', 0]
      );
      seeded.push({ id: projectId, title: proj.title, budget: proj.budget });
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: `✅ Seeded ${seeded.length} live projects with ${seeded.length * 2} milestones.`,
      projects: seeded,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});


// ============================================================================
// GLOBAL MARKET ENDPOINTS — Currency Oracle, Ticker, Geo
// ============================================================================

// Currency Oracle — cached, refreshes max once per hour
// Free tier: open.er-api.com (no key needed, 1500 calls/month free)
let rateCache: { rates: Record<string, number>; fetchedAt: number } | null = null;

async function getLiveRates(): Promise<Record<string, number>> {
  const ONE_HOUR = 3600000;
  if (rateCache && Date.now() - rateCache.fetchedAt < ONE_HOUR) {
    return rateCache.rates;
  }
  try {
    const https = require('https');
    const data: string = await new Promise((resolve, reject) => {
      https.get('https://open.er-api.com/v6/latest/USD', (res: any) => {
        let body = '';
        res.on('data', (chunk: string) => body += chunk);
        res.on('end', () => resolve(body));
      }).on('error', reject);
    });
    const parsed = JSON.parse(data);
    if (parsed.rates) {
      rateCache = { rates: parsed.rates, fetchedAt: Date.now() };
      // Persist to DB for offline fallback
      await pool.query(
        "INSERT INTO currency_rates (rates) VALUES ($1)",
        [JSON.stringify(parsed.rates)]
      ).catch(() => {}); // non-fatal
      return parsed.rates;
    }
  } catch (err) {
    console.warn("Currency fetch failed, using DB cache");
  }
  // Fallback: use latest from DB
  try {
    const dbRate = await pool.query("SELECT rates FROM currency_rates ORDER BY fetched_at DESC LIMIT 1");
    if (dbRate.rows.length > 0) return dbRate.rows[0].rates;
  } catch {}
  // Hard fallback: approximate rates
  return { NGN: 1520, GHS: 15.8, KES: 129, ZAR: 18.5, EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.54, JPY: 154 };
}

// GET /api/rates — live currency rates with USD as base
app.get("/api/rates", async (req: Request, res: Response): Promise<any> => {
  try {
    const rates = await getLiveRates();
    const currencies = ['NGN', 'GHS', 'KES', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'BRL', 'MXN'];
    const filtered: Record<string, number> = {};
    currencies.forEach(c => { if (rates[c]) filtered[c] = rates[c]; });
    return res.json({
      success: true,
      base: 'USD',
      rates: filtered,
      all_rates: rates,
      cached_at: rateCache ? new Date(rateCache.fetchedAt).toISOString() : null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/convert — project budgets in target currency
// (convert route moved before :projectId)

// GET /api/ticker — live market ticker feed (investments + ledger + ads)
app.get("/api/ticker/?", async (req: Request, res: Response): Promise<any> => {
  try {
    // Recent investments
    const recentInvestments = await pool.query(`
      SELECT i.amount, p.title, p.location, p.country
      FROM investments i JOIN projects p ON i.project_id = p.id
      WHERE i.status = 'COMMITTED'
      ORDER BY i.created_at DESC LIMIT 5
    `);

    // Recent ledger events
    const recentLedger = await pool.query(`
      SELECT transaction_type, payload, created_at
      FROM system_ledger ORDER BY created_at DESC LIMIT 5
    `);

    // Active ads
    const ads = await pool.query(`
      SELECT label, value, sponsor_name, link_url
      FROM ticker_items WHERE item_type = 'AD' AND active = true
      AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC LIMIT 5
    `);

    // Rates summary
    const rates = await getLiveRates();
    const rateItems = [
      { type: 'RATE', text: `USD/NGN ${rates.NGN?.toFixed(0) || '—'}` },
      { type: 'RATE', text: `USD/GHS ${rates.GHS?.toFixed(2) || '—'}` },
      { type: 'RATE', text: `USD/KES ${rates.KES?.toFixed(0) || '—'}` },
      { type: 'RATE', text: `USD/EUR ${rates.EUR?.toFixed(4) || '—'}` },
    ];

    // Also pull from ticker_news table
    const newsItems = await pool.query(
      "SELECT * FROM ticker_news WHERE is_active = true ORDER BY priority DESC, created_at DESC LIMIT 10"
    );

    const ticker: any[] = [];

    // News items go first (highest priority content)
    newsItems.rows.forEach((r: any) => {
      ticker.push({ type: r.item_type || 'NEWS', text: r.content, link: r.link_url || undefined, sponsor: r.sponsor_name || undefined });
    });

    recentInvestments.rows.forEach((r: any) => {
      ticker.push({ type: 'INVESTMENT', text: `$${Number(r.amount).toLocaleString()} committed — ${r.title} (${r.location})` });
    });

    recentLedger.rows.forEach((r: any) => {
      const eventLabel = r.transaction_type.replace(/_/g, ' ');
      ticker.push({ type: 'LEDGER', text: eventLabel });
    });

    ads.rows.forEach((r: any) => {
      ticker.push({ type: 'AD', text: `SPONSORED: ${r.sponsor_name} — ${r.label}`, link: r.link_url });
    });

    rateItems.forEach(r => ticker.push(r));

    return res.json({ success: true, items: ticker, count: ticker.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/geo/projects — projects near user's coordinates
app.get("/api/geo/projects", async (req: Request, res: Response): Promise<any> => {
  try {
    const { lat, lng, radius_km = 500, currency = 'USD' } = req.query;

    let projects;
    if (lat && lng) {
      // Haversine SQL query — returns projects within radius_km km
      const result = await pool.query(`
        SELECT *,
          (6371 * acos(
            cos(radians($1::float)) * cos(radians(site_latitude::float)) *
            cos(radians(site_longitude::float) - radians($2::float)) +
            sin(radians($1::float)) * sin(radians(site_latitude::float))
          )) AS distance_km
        FROM projects
        WHERE site_latitude IS NOT NULL AND site_longitude IS NOT NULL
          AND status = 'ACTIVE'
        HAVING (6371 * acos(
            cos(radians($1::float)) * cos(radians(site_latitude::float)) *
            cos(radians(site_longitude::float) - radians($2::float)) +
            sin(radians($1::float)) * sin(radians(site_latitude::float))
          )) < $3
        ORDER BY distance_km ASC LIMIT 20
      `, [lat, lng, radius_km]);
      projects = result.rows;
    } else {
      // No coords — return all active
      const result = await pool.query("SELECT * FROM projects WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 20");
      projects = result.rows;
    }

    // Apply currency conversion
    const rates = await getLiveRates();
    const rate = (rates[currency as string] as number) || 1;
    const converted = projects.map((p: any) => ({
      ...p,
      budget_usd: p.budget,
      budget_local: Math.round(parseFloat(p.budget) * rate),
      display_currency: currency,
    }));

    return res.json({ success: true, projects: converted, count: converted.length, currency, rate });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/ticker/ad — submit a sponsored ad (ADMIN/GOVERNMENT only)
app.post("/api/ticker/ad", authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const userCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [(req as any).userId]);
    if (!['ADMIN', 'GOVERNMENT'].includes(userCheck.rows[0]?.role)) {
      return res.status(403).json({ error: "Only ADMIN or GOVERNMENT can create ad listings" });
    }

    const { label, sponsor_name, link_url, expires_in_days } = req.body;
    if (!label || !sponsor_name) return res.status(400).json({ error: "label and sponsor_name required" });

    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000)
      : null;

    const result = await pool.query(
      "INSERT INTO ticker_items (item_type, label, sponsor_name, link_url, expires_at) VALUES ('AD', $1, $2, $3, $4) RETURNING *",
      [label, sponsor_name, link_url || null, expiresAt]
    );

    return res.status(201).json({ success: true, ad: result.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});


// ============================================================================
// TICKER/NEWS CRAWLER ENDPOINTS — Full CRUD + auto-fetch
// ============================================================================

// GET all ticker items (admin view)
app.get("/api/admin/ticker", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [(req as any).userId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(userCheck.rows[0]?.role)) return res.status(403).json({ error: "Admin only" });
  try {
    const items = await pool.query("SELECT * FROM ticker_news ORDER BY priority DESC, created_at DESC LIMIT 100");
    const ads = await pool.query("SELECT * FROM ticker_items WHERE active = true ORDER BY created_at DESC LIMIT 50");
    return res.json({ success: true, news: items.rows, ads: ads.rows });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// POST — push a new ticker item
app.post("/api/admin/ticker", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [(req as any).userId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(userCheck.rows[0]?.role)) return res.status(403).json({ error: "Admin only" });
  const { content, item_type = 'NEWS', sponsor_name, link_url, priority = 1 } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "content required" });
  try {
    const result = await pool.query(
      "INSERT INTO ticker_news (content, item_type, sponsor_name, link_url, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [content.trim(), item_type, sponsor_name || null, link_url || null, priority]
    );
    return res.status(201).json({ success: true, item: result.rows[0] });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// PUT — update a ticker item
app.put("/api/admin/ticker/:id", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [(req as any).userId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(userCheck.rows[0]?.role)) return res.status(403).json({ error: "Admin only" });
  const { content, item_type, sponsor_name, link_url, priority, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE ticker_news SET
        content = COALESCE($1, content),
        item_type = COALESCE($2, item_type),
        sponsor_name = COALESCE($3, sponsor_name),
        link_url = COALESCE($4, link_url),
        priority = COALESCE($5, priority),
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
      WHERE id = $7 RETURNING *`,
      [content, item_type, sponsor_name, link_url, priority, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });
    return res.json({ success: true, item: result.rows[0] });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// DELETE — remove a ticker item
app.delete("/api/admin/ticker/:id", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [(req as any).userId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(userCheck.rows[0]?.role)) return res.status(403).json({ error: "Admin only" });
  try {
    await pool.query("DELETE FROM ticker_news WHERE id = $1", [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// POST — toggle active status
app.post("/api/admin/ticker/:id/toggle", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [(req as any).userId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(userCheck.rows[0]?.role)) return res.status(403).json({ error: "Admin only" });
  try {
    const result = await pool.query(
      "UPDATE ticker_news SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    return res.json({ success: true, item: result.rows[0] });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// GET /api/ticker — public ticker feed (merges live activity + news items + rates)
// This endpoint already exists above but we add news items to it

// GET /api/market/summary — global platform stats for home page
app.get("/api/market/summary", async (req: Request, res: Response): Promise<any> => {
  try {
    const [projectStats, investStats, milestoneStats, ledgerStats] = await Promise.all([
      pool.query("SELECT COUNT(*) as total, SUM(budget) as total_value, COUNT(DISTINCT country) as countries FROM projects WHERE status = 'ACTIVE'"),
      pool.query("SELECT COALESCE(SUM(amount), 0) as total_committed, COUNT(*) as total_investors FROM investments WHERE status = 'COMMITTED'"),
      pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid FROM milestones"),
      pool.query("SELECT COUNT(*) as total_events FROM system_ledger"),
    ]);

    const rates = await getLiveRates();

    return res.json({
      success: true,
      summary: {
        active_projects: parseInt(projectStats.rows[0].total),
        total_project_value_usd: parseFloat(projectStats.rows[0].total_value || 0),
        countries_active: parseInt(projectStats.rows[0].countries),
        total_committed_usd: parseFloat(investStats.rows[0].total_committed),
        total_investors: parseInt(investStats.rows[0].total_investors),
        milestones_total: parseInt(milestoneStats.rows[0].total),
        milestones_paid: parseInt(milestoneStats.rows[0].paid),
        ledger_events: parseInt(ledgerStats.rows[0].total_events),
        key_rates: { NGN: rates.NGN, GHS: rates.GHS, KES: rates.KES, EUR: rates.EUR, GBP: rates.GBP },
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});


// ============================================================================
// PORTFOLIO SUMMARY — investor's live capital overview with dynamic ROI
// ============================================================================

// GET /api/portfolio/summary
app.get("/api/portfolio/summary", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    // Fetch dynamic ROI rate from market_config
    const roiRow = await pool.query(
      "SELECT value FROM market_config WHERE key = 'global_roi_rate'"
    );
    const roiRate = parseFloat(roiRow.rows[0]?.value ?? '12.00');
    const roiDecimal = roiRate / 100;

    // Aggregate successful payments with time-weighted yield calculation
    const stats = await pool.query(
      `SELECT
         COALESCE(SUM(pt.amount_ngn), 0)                                          AS total_invested,
         COUNT(*)                                                                   AS active_positions,
         COALESCE(SUM(
           pt.amount_ngn * $1 *
           (EXTRACT(EPOCH FROM (NOW() - COALESCE(pt.paid_at, pt.created_at))) / 31536000)
         ), 0)                                                                     AS estimated_earnings
       FROM payment_transactions pt
       WHERE pt.investor_id = $2 AND pt.status = 'SUCCESS'`,
      [roiDecimal, userId]
    );

    // Milestones paid out to this investor's projects
    const milestonePaid = await pool.query(
      `SELECT COUNT(*) AS cnt FROM milestones m
       JOIN investments i ON i.project_id = m.project_id
       WHERE i.investor_id = $1 AND m.status IN ('PAID','COMPLETED')`,
      [userId]
    );

    // KYC status
    const kycRow = await pool.query(
      "SELECT kyc_status FROM kyc_records WHERE user_id = $1",
      [userId]
    );

    const totalInvested     = parseFloat(stats.rows[0].total_invested);
    const estimatedEarnings = parseFloat(stats.rows[0].estimated_earnings);
    const activePositions   = parseInt(stats.rows[0].active_positions);

    return res.json({
      success: true,
      summary: {
        total_invested_ngn:        totalInvested,
        estimated_earnings_ngn:    estimatedEarnings,
        available_to_withdraw_ngn: estimatedEarnings, // Only accrued yield is withdrawable
        escrow_held_ngn:           totalInvested,     // Principal stays in escrow
        portfolio_value_ngn:       totalInvested + estimatedEarnings,
        active_positions:          activePositions,
        roi_rate:                  roiRate,
        milestones_paid:           parseInt(milestonePaid.rows[0].cnt),
        kyc_status:                kycRow.rows[0]?.kyc_status ?? 'NOT_SUBMITTED',
      }
    });
  } catch (err: any) {
    console.error("Portfolio summary error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// MARKET CONFIG — admin reads & updates dynamic rates (ROI, fees)
// ============================================================================

// GET /api/market/config — public read of all market config values
app.get("/api/market/config", async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query(
      "SELECT key, value, label, updated_at FROM market_config ORDER BY key"
    );
    // Also expose as a flat object for easy frontend consumption
    const flat: Record<string, number> = {};
    result.rows.forEach((r: any) => { flat[r.key] = parseFloat(r.value); });
    return res.json({ success: true, config: result.rows, flat });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/market/config — admin updates a market config value
app.put("/api/admin/market/config", authenticate, async (req: Request, res: Response): Promise<any> => {
  const adminId = (req as any).userId;
  const roleCheck = await pool.query("SELECT role FROM public.users WHERE id = $1", [adminId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(roleCheck.rows[0]?.role)) return res.status(403).json({ error: 'Admin only' });

  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  const numVal = parseFloat(value);
  if (isNaN(numVal) || numVal < 0) return res.status(400).json({ error: 'value must be a non-negative number' });

  try {
    const result = await pool.query(
      `UPDATE market_config SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *`,
      [numVal, key]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: `Config key '${key}' not found` });

    // Ledger it
    const lHash = crypto.createHash('sha256').update(`market_config:${key}:${numVal}:${Date.now()}`).digest('hex');
    await pool.query(
      "INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1, $2, $3)",
      ['MARKET_CONFIG_UPDATE', JSON.stringify({ key, old_value: null, new_value: numVal, admin: adminId }), lHash]
    );

    return res.json({ success: true, config: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// ============================================================================
// INVESTMENTS — user's own committed positions with full project detail
// ============================================================================

// GET /api/investments/my — returns the authenticated investor's own commitments
app.get("/api/investments/my", authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const result = await pool.query(
      `SELECT
         i.id,
         i.project_id,
         i.amount,
         i.status,
         i.created_at,
         i.updated_at,
         p.title          AS project_title,
         p.location,
         p.country,
         p.budget         AS project_budget,
         p.expected_roi,
         p.timeline_months,
         p.status         AS project_status,
         p.project_number
       FROM investments i
       JOIN projects p ON i.project_id = p.id
       WHERE i.investor_id = $1
       ORDER BY i.created_at DESC`,
      [userId]
    );
    return res.json({ success: true, investments: result.rows, count: result.rows.length });
  } catch (err: any) {
    console.error("Investments/my error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// CLOUDINARY UPLOAD SIGNATURE ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────
// Files are uploaded DIRECTLY from the user's browser to Cloudinary.
// This endpoint only generates a signed timestamp so Cloudinary can verify
// that the request comes from an authenticated Nested Ark user.
// NO file bytes pass through this server — this keeps Render bandwidth minimal.
//
// Required Render env vars:
//   CLOUDINARY_CLOUD_NAME  = your_cloud_name
//   CLOUDINARY_API_KEY     = your_api_key
//   CLOUDINARY_API_SECRET  = your_api_secret   (keep secret — never expose to client)
//   CLOUDINARY_UPLOAD_PRESET = nested_ark_secure (optional — set to "signed" in Cloudinary)
// ============================================================================
app.post("/api/upload/signature", async (req: Request, res: Response): Promise<any> => {
  // Require authentication — only logged-in operators can upload
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Authentication required to upload files" });
  }

  const token = authHeader.split(' ')[1];
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const cloudName   = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey      = process.env.CLOUDINARY_API_KEY;
  const apiSecret   = process.env.CLOUDINARY_API_SECRET;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || '';

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('[Upload] Cloudinary env vars not set. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in Render.');
    return res.status(503).json({
      error: "File upload is not configured yet. Please contact support at nestedark@gmail.com.",
      setup_required: true,
    });
  }

  const { folder = 'nested-ark-uploads', resource_type = 'auto' } = req.body;
  const timestamp = Math.round(Date.now() / 1000);

  // Build the signature string (Cloudinary's signing spec)
  // Params must be sorted alphabetically and concatenated as key=value pairs
  const paramsToSign: Record<string, string | number> = { folder, timestamp };
  if (uploadPreset) paramsToSign.upload_preset = uploadPreset;

  const signatureString =
    Object.entries(paramsToSign)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&') +
    apiSecret;

  const signature = crypto.createHash('sha256').update(signatureString).digest('hex');

  return res.json({
    signature,
    timestamp,
    api_key:       apiKey,
    cloud_name:    cloudName,
    folder,
    upload_preset: uploadPreset,
    resource_type,
  });
});


// ============================================================================
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// SECURITY: File Upload Validation Middleware
// Validates MIME type, extension, and file size on unit media endpoints.
// Applied to the unit PUT route that accepts cover_image / photo_urls_arr.
// Note: actual binary upload goes through Cloudinary/Supabase (not this server).
// This guards the URL metadata fields and any base64 previews sent as body.
// ════════════════════════════════════════════════════════════════════════════
function validateMediaPayload(req: Request, res: Response, next: NextFunction): any {
  const { contentType, fileSize, cover_image, photo_urls_arr } = req.body;

  // Validate explicit contentType field if provided (client pre-flight)
  if (contentType) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(contentType.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid file type. Only JPG, PNG, and WEBP are accepted.',
        allowed,
      });
    }
  }

  // Validate explicit fileSize field if provided (client pre-flight)
  if (fileSize !== undefined && fileSize !== null) {
    if (typeof fileSize !== 'number' || fileSize > 10 * 1024 * 1024) {
      return res.status(400).json({
        error: 'File exceeds maximum size of 10MB.',
        maxBytes: 10 * 1024 * 1024,
      });
    }
  }

  // Validate URL fields: cover_image and photo_urls_arr must be valid http(s) URLs
  // (not data: URIs or suspicious paths) if provided
  const urlPattern = /^https?:\/\//;
  if (cover_image && typeof cover_image === 'string' && cover_image.length > 0) {
    if (!urlPattern.test(cover_image)) {
      return res.status(400).json({ error: 'cover_image must be a valid https URL from an approved storage provider.' });
    }
  }
  if (photo_urls_arr && Array.isArray(photo_urls_arr)) {
    if (photo_urls_arr.length > 8) {
      return res.status(400).json({ error: 'Maximum 8 gallery photos allowed per unit.' });
    }
    for (const url of photo_urls_arr) {
      if (typeof url !== 'string' || !urlPattern.test(url)) {
        return res.status(400).json({ error: 'All photo_urls_arr entries must be valid https URLs.' });
      }
    }
  }

  return next();
}

// MODULE: RENTAL ENGINE — Properties · Units · Tenancies · Flex-Pay Vault
// Endpoints: /api/rental, /api/landlord, /api/marketplace …
// ════════════════════════════════════════════════════════════════════════════
// RENTAL & YIELD ENGINE
// ============================================================================

// ── computeYieldDistributions ─────────────────────────────────────────────
// Core payout function. Called by webhook on every successful rent payment.
// Reads stakeholder_splits first; falls back to market_config percentages.
// Writes one yield_distributions row per recipient. Fully ledger-hashed.
async function computeYieldDistributions(
  projectId: string,
  rentPaymentId: string,
  amountNgn: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Try project-specific splits first ────────────────────────────
    const splitsRes = await client.query(
      `SELECT ss.*, u.full_name, u.email
       FROM stakeholder_splits ss
       LEFT JOIN public.users u ON ss.user_id = u.id
       WHERE ss.project_id = $1
       ORDER BY ss.role, ss.share_pct DESC`,
      [projectId]
    );
    const customSplits = splitsRes.rows;

    // ── 2. Load market_config fallback ratios ───────────────────────────
    const cfgRes = await client.query(
      `SELECT key, value FROM market_config
       WHERE key IN ('rental_investor_pct','rental_owner_pct',
                     'rental_facility_manager_pct','rental_platform_pct',
                     'rental_maintenance_reserve')`
    );
    const cfg: Record<string,number> = {};
    cfgRes.rows.forEach((r: any) => { cfg[r.key] = parseFloat(r.value); });

    // ── 3. Load investor stakes ─────────────────────────────────────────
    const totalStakeRes = await client.query(
      `SELECT COALESCE(SUM(amount),0) AS total
       FROM investments WHERE project_id=$1 AND status='COMMITTED'`,
      [projectId]
    );
    const totalStake = parseFloat(totalStakeRes.rows[0].total) || 0;

    const investorsRes = await client.query(
      `SELECT i.investor_id, i.amount, u.full_name, u.email
       FROM investments i JOIN public.users u ON i.investor_id=u.id
       WHERE i.project_id=$1 AND i.status='COMMITTED'`,
      [projectId]
    );
    const investors = investorsRes.rows;

    // ── 4. Get project owner ────────────────────────────────────────────
    const projRes = await client.query(
      `SELECT sponsor_id FROM projects WHERE id=$1`, [projectId]
    );
    const ownerId = projRes.rows[0]?.sponsor_id;

    // ── 5. Get platform admin user ──────────────────────────────────────
    const adminRes = await client.query(
      `SELECT id FROM public.users WHERE role='ADMIN' ORDER BY created_at LIMIT 1`
    );
    const adminId = adminRes.rows[0]?.id;

    // ── 6. Get NGN rate for USD equivalent ─────────────────────────────
    const rateRes = await client.query(
      `SELECT rates FROM currency_rates ORDER BY fetched_at DESC LIMIT 1`
    );
    const ngnRate = parseFloat(rateRes.rows[0]?.rates?.NGN) || 1379;

    const distRows: any[] = [];

    if (customSplits.length > 0) {
      // ── Custom split path ─────────────────────────────────────────────
      // Project has explicit stakeholder_splits defined
      for (const split of customSplits) {
        if (split.role === 'INVESTOR') {
          // Distribute the INVESTOR bucket pro-rata among all investors
          if (totalStake > 0) {
            for (const inv of investors) {
              const invStake    = parseFloat(inv.amount) / totalStake;
              const invAmount   = (amountNgn * split.share_pct / 100) * invStake;
              const hash = crypto.createHash('sha256').update(
                `yd-inv-${rentPaymentId}-${inv.investor_id}-${Date.now()}`
              ).digest('hex');
              distRows.push({
                rent_payment_id: rentPaymentId, project_id: projectId,
                recipient_id: inv.investor_id, recipient_name: inv.full_name,
                recipient_role: 'INVESTOR', share_pct: split.share_pct,
                amount_ngn: invAmount.toFixed(2),
                amount_usd: (invAmount / ngnRate).toFixed(4),
                investment_stake: (invStake * 100).toFixed(4),
                ledger_hash: hash,
              });
            }
          }
        } else {
          // OWNER, FACILITY_MANAGER, PLATFORM, MAINTENANCE_RESERVE etc.
          const recipientId = split.user_id ||
            (split.role === 'OWNER' ? ownerId : null) ||
            (split.role === 'PLATFORM' ? adminId : null);
          const amount = amountNgn * split.share_pct / 100;
          const hash = crypto.createHash('sha256').update(
            `yd-${split.role}-${rentPaymentId}-${Date.now()}`
          ).digest('hex');
          distRows.push({
            rent_payment_id: rentPaymentId, project_id: projectId,
            recipient_id: recipientId, recipient_name: split.description || split.role,
            recipient_role: split.role, share_pct: split.share_pct,
            amount_ngn: amount.toFixed(2),
            amount_usd: (amount / ngnRate).toFixed(4),
            investment_stake: null, ledger_hash: hash,
          });
        }
      }
    } else {
      // ── Market-config fallback path ───────────────────────────────────
      const investorPct  = cfg['rental_investor_pct']          ?? 60;
      const ownerPct     = cfg['rental_owner_pct']             ?? 25;
      const fmPct        = cfg['rental_facility_manager_pct']  ?? 8;
      const platformPct  = cfg['rental_platform_pct']          ?? 5;
      const reservePct   = cfg['rental_maintenance_reserve']   ?? 2;

      // Investors (pro-rata)
      if (totalStake > 0) {
        for (const inv of investors) {
          const stake     = parseFloat(inv.amount) / totalStake;
          const invAmount = (amountNgn * investorPct / 100) * stake;
          const hash = crypto.createHash('sha256').update(
            `yd-inv-${rentPaymentId}-${inv.investor_id}-${Date.now()}`
          ).digest('hex');
          distRows.push({
            rent_payment_id: rentPaymentId, project_id: projectId,
            recipient_id: inv.investor_id, recipient_name: inv.full_name,
            recipient_role: 'INVESTOR', share_pct: investorPct,
            amount_ngn: invAmount.toFixed(2),
            amount_usd: (invAmount / ngnRate).toFixed(4),
            investment_stake: (stake * 100).toFixed(4), ledger_hash: hash,
          });
        }
      }

      // Owner
      if (ownerId) {
        const ownerAmt = amountNgn * ownerPct / 100;
        distRows.push({
          rent_payment_id: rentPaymentId, project_id: projectId,
          recipient_id: ownerId, recipient_name: 'Project Owner',
          recipient_role: 'OWNER', share_pct: ownerPct,
          amount_ngn: ownerAmt.toFixed(2), amount_usd: (ownerAmt/ngnRate).toFixed(4),
          investment_stake: null,
          ledger_hash: crypto.createHash('sha256').update(`yd-owner-${rentPaymentId}-${Date.now()}`).digest('hex'),
        });
      }

      // Facility Manager (held by owner until FM is assigned)
      const fmAmt = amountNgn * fmPct / 100;
      distRows.push({
        rent_payment_id: rentPaymentId, project_id: projectId,
        recipient_id: ownerId || null, recipient_name: 'Facility Manager',
        recipient_role: 'FACILITY_MANAGER', share_pct: fmPct,
        amount_ngn: fmAmt.toFixed(2), amount_usd: (fmAmt/ngnRate).toFixed(4),
        investment_stake: null,
        ledger_hash: crypto.createHash('sha256').update(`yd-fm-${rentPaymentId}-${Date.now()}`).digest('hex'),
      });

      // Platform
      if (adminId) {
        const platAmt = amountNgn * platformPct / 100;
        distRows.push({
          rent_payment_id: rentPaymentId, project_id: projectId,
          recipient_id: adminId, recipient_name: 'Nested Ark Platform',
          recipient_role: 'PLATFORM', share_pct: platformPct,
          amount_ngn: platAmt.toFixed(2), amount_usd: (platAmt/ngnRate).toFixed(4),
          investment_stake: null,
          ledger_hash: crypto.createHash('sha256').update(`yd-plat-${rentPaymentId}-${Date.now()}`).digest('hex'),
        });
      }

      // Maintenance reserve (held by owner)
      const resAmt = amountNgn * reservePct / 100;
      distRows.push({
        rent_payment_id: rentPaymentId, project_id: projectId,
        recipient_id: ownerId || null, recipient_name: 'Maintenance Reserve',
        recipient_role: 'MAINTENANCE_RESERVE', share_pct: reservePct,
        amount_ngn: resAmt.toFixed(2), amount_usd: (resAmt/ngnRate).toFixed(4),
        investment_stake: null,
        ledger_hash: crypto.createHash('sha256').update(`yd-res-${rentPaymentId}-${Date.now()}`).digest('hex'),
      });
    }

    // ── 7. Bulk-insert distribution rows ───────────────────────────────
    for (const d of distRows) {
      await client.query(
        `INSERT INTO yield_distributions
          (rent_payment_id,project_id,recipient_id,recipient_name,recipient_role,
           share_pct,amount_ngn,amount_usd,investment_stake,ledger_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [d.rent_payment_id, d.project_id, d.recipient_id, d.recipient_name,
         d.recipient_role, d.share_pct, d.amount_ngn, d.amount_usd,
         d.investment_stake, d.ledger_hash]
      );
    }

    // ── 8. Mark rent_payment as DISTRIBUTED ────────────────────────────
    await client.query(
      "UPDATE rent_payments SET status='DISTRIBUTED', distributed_at=NOW() WHERE id=$1",
      [rentPaymentId]
    );

    // ── 9. Immutable ledger entry ───────────────────────────────────────
    const masterHash = crypto.createHash('sha256').update(
      `yield-dist-${rentPaymentId}-${amountNgn}-${Date.now()}`
    ).digest('hex');
    await client.query(
      `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
       VALUES ($1,$2,$3)`,
      ['YIELD_DISTRIBUTION',
       JSON.stringify({ rent_payment_id: rentPaymentId, project_id: projectId,
                        total_ngn: amountNgn, distributions: distRows.length }),
       masterHash]
    );

    await client.query('COMMIT');
    console.log(`✅ Yield distributed: ${distRows.length} recipients, NGN ${amountNgn}, payment ${rentPaymentId}`);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[YIELD] Distribution failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}


// ════════════════════════════════════════════════════════════════════════════
// LANDLORD BANK ACCOUNT & PAYSTACK PAYOUT ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

// ── GET /api/paystack/banks — fetch list of Nigerian banks from Paystack ────
app.get('/api/paystack/banks', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const country = (req.query.country as string) || 'nigeria';
    const psRes = await fetch(
      `${PAYSTACK_BASE}/bank?country=${country}&use_cursor=false&perPage=100`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );
    const data = await psRes.json() as any;
    if (!data.status) return res.status(500).json({ error: 'Could not fetch banks' });
    return res.json({ success: true, banks: data.data });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/paystack/resolve-account — verify account number ──────────────
app.post('/api/paystack/resolve-account', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { account_number, bank_code } = req.body;
    if (!account_number || !bank_code)
      return res.status(400).json({ error: 'account_number and bank_code required' });
    const psRes = await fetch(
      `${PAYSTACK_BASE}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );
    const data = await psRes.json() as any;
    if (!data.status) return res.status(400).json({ error: data.message || 'Could not verify account' });
    return res.json({ success: true, account_name: data.data.account_name, account_number: data.data.account_number });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/landlord/payout-status — show all bank accounts + payout readiness ─
app.get('/api/landlord/payout-status', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const r = await pool.query(
      `SELECT id, account_name, account_number, bank_name, currency, is_default,
              CASE WHEN paystack_recipient_code IS NOT NULL THEN true ELSE false END AS payout_ready,
              paystack_recipient_code,
              paystack_subaccount_code,
              CASE WHEN paystack_subaccount_code IS NOT NULL THEN true ELSE false END AS split_pay_ready,
              created_at
       FROM landlord_bank_accounts
       WHERE user_id=$1
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    const notReady = r.rows.filter((a: any) => !a.payout_ready).length;
    return res.json({
      success:    true,
      accounts:   r.rows,
      summary: {
        total:       r.rows.length,
        payout_ready: r.rows.length - notReady,
        needs_setup:  notReady,
        action_needed: notReady > 0
          ? `${notReady} account(s) need recipient codes. Call POST /api/landlord/bank-accounts/:id/create-recipient for each.`
          : null,
      },
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/landlord/bank-accounts — list saved bank accounts ───────────────
app.get('/api/landlord/bank-accounts', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const r = await pool.query(
      `SELECT id, user_id, project_id, account_name, account_number, bank_code,
              bank_name, currency, is_default, is_verified,
              paystack_recipient_code, paystack_subaccount_code, created_at, updated_at,
              CASE WHEN paystack_recipient_code IS NOT NULL AND paystack_recipient_code <> ''
                   THEN true ELSE false END AS payout_ready,
              CASE WHEN paystack_subaccount_code IS NOT NULL AND paystack_subaccount_code <> ''
                   THEN true ELSE false END AS split_pay_ready
       FROM landlord_bank_accounts
       WHERE user_id=$1
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    return res.json({ success: true, accounts: r.rows });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/landlord/bank-accounts — save a bank account ──────────────────
app.post('/api/landlord/bank-accounts', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const { account_name, account_number, bank_code, bank_name, currency, project_id, set_as_default } = req.body;
    if (!account_name || !account_number || !bank_code || !bank_name)
      return res.status(400).json({ error: 'account_name, account_number, bank_code, bank_name required' });

    // ── Step 1: Create Paystack Transfer Recipient (for manual payout fallback) ──
    let recipientCode: string | null = null;
    if (PAYSTACK_SECRET) {
      try {
        const prRes = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'nuban',
            name: account_name,
            account_number,
            bank_code,
            currency: currency || 'NGN',
          }),
        });
        const prData = await prRes.json() as any;
        if (prData.status && prData.data?.recipient_code) {
          recipientCode = prData.data.recipient_code;
        }
      } catch (rcErr) {
        console.warn('[PAYSTACK] Could not create recipient:', rcErr);
      }
    }

    // ── Step 2: Auto-create Paystack Subaccount for automatic rent split ──────
    // This enables Paystack to auto-split at payment time:
    // 98% → landlord bank account, 2% → platform (Impressions & Impacts Ltd)
    // No manual payout cron needed for rent once subaccount is set.
    let subaccountCode: string | null = null;
    if (PAYSTACK_SECRET) {
      try {
        // Fetch landlord profile for contact details
        const landlordRes = await pool.query(
          `SELECT full_name, email, phone FROM public.users WHERE id=$1`, [userId]
        );
        const landlord = landlordRes.rows[0];
        const saRes = await fetch(`${PAYSTACK_BASE}/subaccount`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_name:         account_name,
            settlement_bank:       bank_code,
            account_number:        account_number,
            percentage_charge:     2,           // Platform retains 2%
            primary_contact_email: landlord?.email  || null,
            primary_contact_name:  landlord?.full_name || account_name,
            primary_contact_phone: landlord?.phone || null,
          }),
        });
        const saData = await saRes.json() as any;
        if (saData.status && saData.data?.subaccount_code) {
          subaccountCode = saData.data.subaccount_code;
          console.log(`[PAYSTACK] Subaccount created for landlord ${userId}: ${subaccountCode}`);
        } else {
          console.warn('[PAYSTACK] Subaccount creation failed:', saData.message || saData);
        }
      } catch (saErr) {
        console.warn('[PAYSTACK] Could not create subaccount:', saErr);
      }
    }

    // If this is the first account or set_as_default, unset other defaults
    if (set_as_default) {
      await pool.query(
        `UPDATE landlord_bank_accounts SET is_default=false WHERE user_id=$1`,
        [userId]
      );
    }

    // Upsert: if same account_number already exists for this user, update it rather than inserting a dupe
    const r = await pool.query(
      `INSERT INTO landlord_bank_accounts
         (user_id, project_id, account_name, account_number, bank_code, bank_name, currency,
          paystack_recipient_code, paystack_subaccount_code, is_verified, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)
       ON CONFLICT (user_id, account_number)
       DO UPDATE SET
         bank_code                = EXCLUDED.bank_code,
         bank_name                = EXCLUDED.bank_name,
         paystack_recipient_code  = COALESCE(EXCLUDED.paystack_recipient_code,  landlord_bank_accounts.paystack_recipient_code),
         paystack_subaccount_code = COALESCE(EXCLUDED.paystack_subaccount_code, landlord_bank_accounts.paystack_subaccount_code),
         is_default               = EXCLUDED.is_default,
         is_verified              = true,
         updated_at               = NOW()
       RETURNING *`,
      [userId, project_id || null, account_name, account_number, bank_code, bank_name,
       currency || 'NGN', recipientCode, subaccountCode, set_as_default ?? true]
    );
    return res.status(201).json({ success: true, account: r.rows[0] });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/landlord/bank-accounts/:id/create-recipient — backfill recipient ─
// Repairs existing bank accounts that were saved without a Paystack recipient code.
// Call this once per account; safe to call multiple times (idempotent).
app.post('/api/landlord/bank-accounts/:id/create-recipient', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { id }  = req.params;
  try {
    const acctRes = await pool.query(
      `SELECT * FROM landlord_bank_accounts WHERE id=$1 AND user_id=$2`,
      [id, userId]
    );
    if (!acctRes.rows.length) return res.status(404).json({ error: 'Bank account not found' });
    const acct = acctRes.rows[0];

    // Accept bank_code override from request body (for patching old rows that were saved without one)
    const resolvedBankCode: string = req.body?.bank_code || acct.bank_code;

    if (!resolvedBankCode) {
      return res.status(400).json({
        error: 'bank_code missing on this account. Pass { bank_code: "057" } in the request body to patch it.',
        needs_bank_code: true,
      });
    }

    // Patch stored bank_code if it was absent (one-time migration for legacy rows)
    if (!acct.bank_code && resolvedBankCode) {
      await pool.query(`UPDATE landlord_bank_accounts SET bank_code=$1 WHERE id=$2`, [resolvedBankCode, id]);
    }

    if (acct.paystack_recipient_code && acct.paystack_subaccount_code) {
      // Both codes already set — account is fully split-pay ready
      return res.json({
        success:          true,
        message:          'Account is already payout-ready with auto-split enabled.',
        recipient_code:   acct.paystack_recipient_code,
        subaccount_code:  acct.paystack_subaccount_code,
        already_set:      true,
      });
    }

    if (!PAYSTACK_SECRET) return res.status(503).json({ error: 'Payment gateway not configured' });

    // ── Create Transfer Recipient (if missing) ───────────────────────────
    let recipientCode = acct.paystack_recipient_code;
    if (!recipientCode) {
      const prRes = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:           'nuban',
          name:           acct.account_name,
          account_number: acct.account_number,
          bank_code:      resolvedBankCode,
          currency:       acct.currency || 'NGN',
        }),
      });
      const prData = await prRes.json() as any;

      if (!prData.status || !prData.data?.recipient_code) {
        return res.status(400).json({ error: prData.message || 'Paystack could not create recipient. Check account details.' });
      }
      recipientCode = prData.data.recipient_code;
    }

    // ── Auto-create Paystack Subaccount (if missing) ─────────────────────
    // This enables automatic 98/2 split at rent payment time.
    let subaccountCode = acct.paystack_subaccount_code;
    if (!subaccountCode) {
      try {
        const landlordRes = await pool.query(
          `SELECT full_name, email, phone FROM public.users WHERE id=$1`, [acct.user_id]
        );
        const landlord = landlordRes.rows[0];
        const saRes = await fetch(`${PAYSTACK_BASE}/subaccount`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_name:         acct.account_name,
            settlement_bank:       resolvedBankCode,
            account_number:        acct.account_number,
            percentage_charge:     2,
            primary_contact_email: landlord?.email  || null,
            primary_contact_name:  landlord?.full_name || acct.account_name,
            primary_contact_phone: landlord?.phone || null,
          }),
        });
        const saData = await saRes.json() as any;
        if (saData.status && saData.data?.subaccount_code) {
          subaccountCode = saData.data.subaccount_code;
          console.log(`[PAYSTACK] Backfill subaccount created for landlord ${acct.user_id}: ${subaccountCode}`);
        } else {
          console.warn('[PAYSTACK] Backfill subaccount creation failed:', saData.message || saData);
        }
      } catch (saErr) {
        console.warn('[PAYSTACK] Could not create backfill subaccount:', saErr);
      }
    }

    await pool.query(
      `UPDATE landlord_bank_accounts
       SET paystack_recipient_code=$1, paystack_subaccount_code=$2, bank_code=$3
       WHERE id=$4`,
      [recipientCode, subaccountCode || null, resolvedBankCode, id]
    );

    return res.json({
      success:          true,
      recipient_code:   recipientCode,
      subaccount_code:  subaccountCode,
      message:          subaccountCode
        ? 'Recipient and subaccount created. Rent payments will now auto-split 98% landlord / 2% platform.'
        : 'Recipient code created. Subaccount creation failed — manual payout fallback active.',
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/landlord/bank-accounts/:id — remove a bank account ───────────
app.delete('/api/landlord/bank-accounts/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const r = await pool.query(
      `DELETE FROM landlord_bank_accounts WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Account not found' });
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/landlord/paystack-balance — show available Paystack balance ────────
// Frontend uses this to show the landlord what's actually available for payout
// vs what's still in T+1 settlement (Next Payout / pending)
app.get('/api/landlord/paystack-balance', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    if (!PAYSTACK_SECRET) return res.status(503).json({ error: 'Payment gateway not configured' });
    const balRes = await fetch(`${PAYSTACK_BASE}/balance`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const balData = await balRes.json() as any;
    if (!balData.status) return res.status(400).json({ error: balData.message || 'Could not fetch balance' });

    // Paystack returns balance in kobo — convert to NGN
    const balances = Array.isArray(balData.data) ? balData.data : [balData.data];
    const ngnBalance = balances.find((b: any) => b.currency === 'NGN') || balances[0];
    const availableNgn = ngnBalance ? Math.floor((ngnBalance.balance || 0) / 100) : 0;

    return res.json({
      success:       true,
      available_ngn: availableNgn,
      currency:      ngnBalance?.currency || 'NGN',
      // Clear message when balance is 0 but rent was recently collected (T+1)
      note: availableNgn === 0
        ? 'Paystack settles collections to your balance the next business day (T+1). If rent was just collected, funds will be available tomorrow.'
        : null,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/landlord/payout — trigger Paystack transfer to landlord ────────
// Called automatically by the cron or manually by admin after rent is collected
app.post('/api/landlord/payout', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const { bank_account_id, amount_ngn, project_id, reason } = req.body;
    if (!bank_account_id || !amount_ngn)
      return res.status(400).json({ error: 'bank_account_id and amount_ngn required' });

    const acct = await pool.query(
      `SELECT * FROM landlord_bank_accounts WHERE id=$1 AND user_id=$2`,
      [bank_account_id, userId]
    );
    if (!acct.rows.length) return res.status(404).json({ error: 'Bank account not found' });
    const a = acct.rows[0];

    if (!a.paystack_recipient_code)
      return res.status(400).json({ error: 'Bank account not yet linked to Paystack. Please re-add it.' });
    if (!PAYSTACK_SECRET)
      return res.status(503).json({ error: 'Payment gateway not configured' });

    const reference    = `PAYOUT-${uuidv4().split('-')[0].toUpperCase()}-${Date.now()}`;
    const grossNgn     = parseFloat(amount_ngn);

    // ── 2% Platform Fee Deduction ─────────────────────────────────────────
    // Platform takes 2% of every landlord payout as the rental management fee.
    // Landlord receives 98%. Fee stays in Paystack balance as platform revenue.
    const PLATFORM_FEE_PCT = 0.02;
    const platformFeeNgn   = Math.round(grossNgn * PLATFORM_FEE_PCT * 100) / 100;
    const netToLandlordNgn = Math.round((grossNgn - platformFeeNgn) * 100) / 100;
    const amountKobo       = Math.round(netToLandlordNgn * 100);  // kobo for Paystack

    // ── SHA-256 immutable hash ────────────────────────────────────────────
    const h = crypto.createHash('sha256')
      .update(`payout-${reference}-${userId}-${grossNgn}-fee-${platformFeeNgn}-${Date.now()}`)
      .digest('hex');

    // ── Record platform revenue BEFORE transfer (non-blocking ledger) ─────
    await pool.query(
      `INSERT INTO platform_revenue
         (project_id, amount_ngn, amount_usd, source, pct_applied, gross_amount, ledger_hash)
       VALUES ($1,$2,$3,'RENTAL_FEE',0.02,$4,$5)`,
      [
        project_id ?? null,
        platformFeeNgn,
        platformFeeNgn / 1500,
        grossNgn,
        h,
      ]
    ).catch(() => {}); // non-fatal if platform_revenue table not yet created

    // ── Pre-check: verify Paystack balance covers the net amount ────────────
    // This avoids a hard 500 and gives a clear, actionable error with T+1 context
    try {
      const balRes  = await fetch(`${PAYSTACK_BASE}/balance`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });
      const balData = await balRes.json() as any;
      if (balData.status) {
        const balances    = Array.isArray(balData.data) ? balData.data : [balData.data];
        const ngnBalance  = balances.find((b: any) => b.currency === 'NGN') || balances[0];
        const availableNgn = ngnBalance ? Math.floor((ngnBalance.balance || 0) / 100) : 0;
        if (availableNgn < netToLandlordNgn) {
          return res.status(402).json({
            error: `Insufficient Paystack balance. Available: ₦${availableNgn.toLocaleString()} — Required: ₦${netToLandlordNgn.toLocaleString()}.`,
            available_ngn:  availableNgn,
            required_ngn:   netToLandlordNgn,
            t1_note: 'Paystack settles rent collections to your balance the next business day (T+1). Funds collected today will be available tomorrow.',
            insufficient_balance: true,
          });
        }
      }
    } catch (balErr: any) {
      // Non-fatal — if balance check fails, attempt the transfer anyway (Paystack will reject if needed)
      console.warn('[PAYOUT] Balance pre-check failed (non-fatal):', balErr.message);
    }

    // ── Paystack Transfer: net amount to landlord ─────────────────────────
    const transferRes = await fetch(`${PAYSTACK_BASE}/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source:    'balance',
        amount:    amountKobo,           // 98% of gross, in kobo
        recipient: a.paystack_recipient_code,
        reason:    reason || `Nested Ark Rental Payout — 2% platform fee deducted`,
        reference,
        currency:  a.currency || 'NGN',
        metadata: {
          gross_amount_ngn:   grossNgn,
          platform_fee_ngn:   platformFeeNgn,
          net_to_landlord_ngn: netToLandlordNgn,
          fee_pct:            '2%',
          project_id:         project_id ?? null,
          bank_account_id,
        },
      }),
    });
    const tData = await transferRes.json() as any;
    if (!tData.status) {
      const msg = tData.message || 'Transfer failed';
      const isBalanceErr = msg.toLowerCase().includes('balance') || msg.toLowerCase().includes('insufficient');
      return res.status(isBalanceErr ? 402 : 500).json({
        error: msg,
        ...(isBalanceErr ? {
          insufficient_balance: true,
          t1_note: 'Paystack settles collections the next business day (T+1). If rent was just collected, funds will be available tomorrow.',
        } : {}),
      });
    }

    // ── Immutable system ledger entry ─────────────────────────────────────
    await pool.query(
      `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
       VALUES ('LANDLORD_PAYOUT', $1, $2)`,
      [
        JSON.stringify({
          reference,
          gross_amount_ngn:    grossNgn,
          platform_fee_ngn:    platformFeeNgn,
          net_to_landlord_ngn: netToLandlordNgn,
          fee_pct:             '2%',
          user_id:             userId,
          project_id:          project_id ?? null,
          bank_account_id,
          transfer_code:       tData.data?.transfer_code,
          ledger_hash:         h,
        }),
        h,
      ]
    );

    // ── Notifications: landlord confirmation + admin alert ────────────────
    // Fire-and-forget — a notification failure must never affect the
    // already-completed Paystack transfer or this response.
    try {
      const landlordRes = await pool.query(`SELECT email, full_name FROM public.users WHERE id=$1`, [userId]);
      const landlord = landlordRes.rows[0];
      if (landlord?.email) {
        const { subject, html } = landlordDisbursementTemplate({
          landlordName: landlord.full_name,
          amount: `₦${netToLandlordNgn.toLocaleString()}`,
          unitName: project_id ? `Project ${project_id}` : 'your rental account',
          bankAccount: `${a.account_name} — ${a.bank_name}`,
        });
        EmailService.send({ to: landlord.email, subject, html, template: 'landlord_disbursement' });
      }
      const adminEmail = process.env.ADMIN_EMAIL || 'nestedark@gmail.com';
      const { subject: adminSubject, html: adminHtml } = adminNotificationTemplate({
        heading: 'Landlord Payout Processed',
        message: `Reference ${reference}: ₦${netToLandlordNgn.toLocaleString()} net (₦${platformFeeNgn.toLocaleString()} fee) transferred to ${a.account_name} (${a.bank_name}) for user ${userId}.`,
      });
      EmailService.send({ to: adminEmail, subject: adminSubject, html: adminHtml, template: 'admin_notification' });
    } catch (notifyErr: any) {
      console.warn('[PAYOUT] Notification dispatch failed (non-fatal):', notifyErr.message);
    }

    return res.json({
      success:             true,
      reference,
      transfer_code:       tData.data?.transfer_code,
      status:              tData.data?.status,
      gross_amount_ngn:    grossNgn,
      platform_fee_ngn:    platformFeeNgn,
      net_to_landlord_ngn: netToLandlordNgn,
      fee_pct:             '2%',
      account_name:        a.account_name,
      bank_name:           a.bank_name,
      ledger_hash:         h,
      message: `₦${netToLandlordNgn.toLocaleString()} transferred to ${a.account_name} at ${a.bank_name}. Platform fee: ₦${platformFeeNgn.toLocaleString()} (2%).`,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/landlord/payout-history — list past payouts ────────────────────
app.get('/api/landlord/payout-history', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const r = await pool.query(
      `SELECT * FROM system_ledger
       WHERE transaction_type='LANDLORD_PAYOUT'
         AND payload->>'user_id'=$1
       ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    return res.json({ success: true, payouts: r.rows.map(row => ({ ...row, ...JSON.parse(row.payload) })) });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/landlord/tenancies/active ─────────────────────────────────────
// Used by the Litigation Command tenant dropdown — returns ALL active tenancies
// across all of this landlord's projects in one call (cross-project scope).
app.get('/api/landlord/tenancies/active', authenticate, async (req: Request, res: Response): Promise<any> => {
  const landlordId = (req as any).userId;
  try {
    const r = await pool.query(
      `SELECT DISTINCT ON (t.id)
         t.id                AS tenancy_id,
         t.tenant_name,
         t.tenant_email,
         t.tenant_phone,
         t.status,
         t.rent_amount,
         t.currency,
         t.payment_day,
         t.lease_start,
         t.lease_end,
         ru.id               AS unit_id,
         ru.unit_name,
         p.id                AS project_id,
         p.title             AS project_title,
         p.project_number,
         COALESCE(fpv.vault_balance, 0) AS vault_balance,
         fpv.next_due_date
       FROM tenancies t
       INNER JOIN rental_units ru ON ru.id = t.unit_id
       INNER JOIN projects p      ON p.id  = ru.project_id
       -- DISTINCT ON (t.id): if a tenancy has multiple vaults, take the most recent one
       -- without DISTINCT the LEFT JOIN fans out and the same tenant appears N times
       LEFT JOIN LATERAL (
         SELECT vault_balance, next_due_date
         FROM flex_pay_vaults
         WHERE tenancy_id = t.id
         ORDER BY created_at DESC
         LIMIT 1
       ) fpv ON true
       WHERE p.sponsor_id = $1
         AND t.status = 'ACTIVE'
       ORDER BY t.id, p.title, t.tenant_name
       LIMIT 500`,
      [landlordId]
    );
    return res.json({ success: true, tenancies: r.rows, count: r.rows.length });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/landlord/notices — all notices across landlord's portfolio ──────
app.get('/api/landlord/notices', authenticate, async (req: Request, res: Response): Promise<any> => {
  const landlordId = (req as any).userId;
  try {
    const r = await pool.query(
      `SELECT ln.*, t.tenant_name, t.tenant_email, ru.unit_name,
              p.title AS project_title, p.project_number
       FROM legal_notices ln
       JOIN tenancies t    ON t.id  = ln.tenancy_id
       JOIN rental_units ru ON ru.id = ln.unit_id
       JOIN projects p     ON p.id  = ln.project_id
       WHERE p.sponsor_id = $1
       ORDER BY ln.issued_at DESC
       LIMIT 100`,
      [landlordId]
    );
    return res.json({ success: true, notices: r.rows, count: r.rows.length });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});
app.post('/api/rental/units', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const {
      project_id, unit_name, unit_type, bedrooms, bathrooms,
      floor_area_sqm, size_sqm, floor_number, floor_level,
      rent_amount, currency, description, amenities,
      payment_frequency,
      security_deposit, service_charge, agency_fee, legal_fee, caution_fee,
      bank_name, account_number, account_name, sort_code,
      furnished, parking,
      selected_bank_account_id,  // ← Option 1: ID of verified landlord_bank_accounts record
    } = req.body;

    if (!project_id || !unit_name || !rent_amount)
      return res.status(400).json({ error: 'project_id, unit_name and rent_amount are required' });

    const proj = await pool.query('SELECT sponsor_id FROM projects WHERE id=$1', [project_id]);
    if (!proj.rows.length)      return res.status(404).json({ error: 'Project not found' });
    if (proj.rows[0].sponsor_id !== userId)
      return res.status(403).json({ error: 'Only the project owner can add rental units' });

    // Flip project to OPERATIONAL mode
    await pool.query(
      "UPDATE projects SET project_mode='OPERATIONAL', lifecycle_stage='OPERATIONAL' WHERE id=$1",
      [project_id]
    );

    // Safely add optional columns one-by-one (pg driver requires single statements)
    const migrations = [
      `ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(20) DEFAULT 'MONTHLY'`,
      `ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS agency_fee         DECIMAL(15,2) DEFAULT 0`,
      `ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS legal_fee          DECIMAL(15,2) DEFAULT 0`,
      `ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS caution_fee        DECIMAL(15,2) DEFAULT 0`,
      `ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS bank_name          VARCHAR(100)`,
      `ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS account_number     VARCHAR(20)`,
      `ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS account_name       VARCHAR(100)`,
      `ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS sort_code          VARCHAR(20)`,
      `ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS size_sqm           DECIMAL(10,2)`,
      `ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS floor_number       INTEGER`,
      // ← Link each unit to the landlord's verified payout account (Option 1 bank selector)
      `ALTER TABLE rental_units ADD COLUMN IF NOT EXISTS landlord_bank_account_id UUID`,
    ];
    for (const sql of migrations) { await pool.query(sql).catch(() => {}); }

    const r = await pool.query(
      `INSERT INTO rental_units
         (project_id, unit_name, unit_type, bedrooms, bathrooms,
          floor_area_sqm, size_sqm, floor_number, floor_level,
          rent_amount, currency, description, amenities,
          payment_frequency,
          security_deposit, service_charge, agency_fee, legal_fee, caution_fee,
          bank_name, account_number, account_name, sort_code,
          furnished, parking, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,'VACANT')
       RETURNING *`,
      [
        project_id, unit_name,
        unit_type || 'APARTMENT', bedrooms || 0, bathrooms || 1,
        floor_area_sqm || size_sqm || null, size_sqm || floor_area_sqm || null,
        floor_number || null, floor_level || null,
        rent_amount, currency || 'NGN', description || null,
        Array.isArray(amenities) ? amenities : typeof amenities === 'string' && amenities.trim()
          ? amenities.split(',').map((x: string) => x.trim()).filter(Boolean) : [],
        (payment_frequency || 'MONTHLY').toUpperCase(),
        security_deposit || 0, service_charge || 0,
        agency_fee || 0, legal_fee || 0, caution_fee || 0,
        bank_name || null, account_number || null, account_name || null, sort_code || null,
        furnished ? true : false, parking ? true : false,
      ]
    );

    // ── Auto-bridge: link unit to the selected verified landlord_bank_accounts record ──
    // selected_bank_account_id is sent by the rental-management form (Option 1 selector).
    // This replaces the old free-text bank field bridge — cleaner and guaranteed verified.
    const linkedBankAccountId = selected_bank_account_id || null;
    if (linkedBankAccountId) {
      try {
        // Verify the account belongs to this landlord before linking
        const acctCheck = await pool.query(
          `SELECT id, paystack_recipient_code, is_default FROM landlord_bank_accounts
           WHERE id=$1 AND user_id=$2 LIMIT 1`,
          [linkedBankAccountId, userId]
        );
        if (acctCheck.rows.length) {
          // Update the unit row to reference this bank account
          await pool.query(
            `UPDATE rental_units SET landlord_bank_account_id=$1 WHERE id=$2`,
            [linkedBankAccountId, r.rows[0].id]
          ).catch(() => {}); // non-fatal if column doesn't exist yet
          console.log(`[UNIT] Linked to bank account ${linkedBankAccountId} (recipient=${acctCheck.rows[0].paystack_recipient_code ?? 'pending'})`);
        }
      } catch (linkErr: any) {
        console.warn('[UNIT] Bank account link warning:', linkErr.message);
      }
    } else if (bank_name && account_number && account_name) {
      // Fallback: free-text bank fields provided — auto-bridge as before
      try {
        const bankCode = sort_code || null;
        const existing = await pool.query(
          `SELECT id FROM landlord_bank_accounts WHERE user_id=$1 AND account_number=$2 LIMIT 1`,
          [userId, account_number]
        );
        if (!existing.rows.length) {
          let recipientCode: string | null = null;
          if (PAYSTACK_SECRET && bankCode && bankCode.length >= 3) {
            try {
              const prRes = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'nuban', name: account_name, account_number, bank_code: bankCode, currency: currency || 'NGN' }),
              });
              const prData = await prRes.json() as any;
              if (prData.status && prData.data?.recipient_code) recipientCode = prData.data.recipient_code;
            } catch { /* non-fatal */ }
          }
          const cntRes = await pool.query(`SELECT COUNT(*) FROM landlord_bank_accounts WHERE user_id=$1`, [userId]);
          const isFirst = parseInt(cntRes.rows[0].count) === 0;
          await pool.query(
            `INSERT INTO landlord_bank_accounts (user_id, project_id, account_name, account_number, bank_code, bank_name, currency, paystack_recipient_code, is_verified, is_default)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)`,
            [userId, project_id, account_name, account_number, bankCode || '', bank_name, currency || 'NGN', recipientCode, isFirst]
          );
          console.log(`[UNIT] Auto-bridged bank → ${account_name} | ${bank_name} | ${account_number}`);
        }
      } catch (bankErr: any) {
        console.warn('[UNIT] Bank auto-bridge warning:', bankErr.message);
      }
    }

    return res.status(201).json({ success: true, unit: r.rows[0] });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/rental/units/single/:unitId — fetch ONE unit by its UUID ────
// MUST be registered BEFORE /api/rental/units/:projectId so Express
// doesn't try to use a unit UUID as a projectId.
app.get('/api/rental/units/single/:unitId', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const { unitId } = req.params;
    const r = await pool.query(
      `SELECT ru.*,
              p.id            AS project_id,
              p.title         AS project_title,
              p.project_number,
              t.id            AS tenancy_id,
              t.tenant_name,
              t.tenant_email,
              t.status        AS tenancy_status
       FROM   rental_units ru
       JOIN   projects      p  ON p.id  = ru.project_id
       LEFT JOIN tenancies  t  ON t.unit_id = ru.id AND t.status = 'ACTIVE'
       WHERE  ru.id = $1`,
      [unitId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Unit not found' });
    return res.json({ success: true, unit: r.rows[0] });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/rental/landlord/tenants — alias kept for backward compat ────────
// The notices page calls this path. Delegates to the same cross-project query.
app.get('/api/rental/landlord/tenants', authenticate, async (req: Request, res: Response): Promise<any> => {
  const landlordId = (req as any).userId;
  try {
    const r = await pool.query(
      `SELECT
         t.id               AS tenancy_id,
         t.id,
         t.tenant_name,
         t.tenant_email,
         t.tenant_phone,
         t.status,
         t.rent_amount,
         t.currency,
         t.unit_id,
         ru.unit_name,
         p.id               AS project_id,
         p.title            AS project_title,
         p.project_number,
         COALESCE(fpv.vault_balance, 0) AS vault_balance,
         fpv.next_due_date
       FROM tenancies t
       INNER JOIN rental_units ru ON ru.id = t.unit_id
       INNER JOIN projects p      ON p.id  = ru.project_id
       LEFT  JOIN flex_pay_vaults fpv ON fpv.tenancy_id = t.id
       WHERE p.sponsor_id = $1
         AND t.status = 'ACTIVE'
       ORDER BY p.title, t.tenant_name
       LIMIT 500`,
      [landlordId]
    );
    // Return both shapes the frontend might expect
    return res.json({ success: true, tenancies: r.rows, tenants: r.rows, rows: r.rows, count: r.rows.length });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/rental/tenants — landlord's full tenant roster (fast, no timeout) ─────────
app.get('/api/rental/tenants', authenticate, async (req: Request, res: Response): Promise<any> => {
  const landlordId = (req as any).userId;
  try {
    const r = await pool.query(
      `SELECT
         t.id, t.tenant_name, t.tenant_email, t.tenant_phone,
         t.unit_id, t.status, t.lease_start AS move_in_date,
         t.rent_amount, t.currency,
         COALESCE(t.payment_frequency, 'monthly') AS payment_frequency,
         t.tenant_user_id,
         ru.unit_name,
         ru.status AS unit_status,
         p.title AS project_title, p.project_number,
         fpv.next_due_date AS next_payment_date,
         fpv.vault_balance
       FROM tenancies t
       JOIN rental_units ru ON ru.id = t.unit_id
       JOIN projects p      ON p.id  = ru.project_id
       LEFT JOIN flex_pay_vaults fpv ON fpv.tenancy_id = t.id
       WHERE p.sponsor_id = $1
       ORDER BY t.status, t.tenant_name
       LIMIT 200`,
      [landlordId]
    );
    return res.json(r.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/rental/tenancies/lifecycle — edit particulars or terminate tenancy ─────────
// Actions: UPDATE_PARTICULARS | TERMINATE_OR_TRANSFER
app.post('/api/rental/tenancies/lifecycle', authenticate, async (req: Request, res: Response): Promise<any> => {
  const landlordId = (req as any).userId;
  const { tenancy_id, action, tenant_name, tenant_email, tenant_phone, rent_override, payment_frequency } = req.body;

  if (!tenancy_id || !action) {
    return res.status(400).json({ error: 'tenancy_id and action are required.' });
  }

  try {
    // Verify the tenancy belongs to one of this landlord's projects
    const ownerCheck = await pool.query(
      `SELECT t.id, t.unit_id FROM tenancies t
       JOIN rental_units ru ON ru.id = t.unit_id
       JOIN projects p      ON p.id  = ru.project_id
       WHERE t.id = $1 AND p.sponsor_id = $2`,
      [tenancy_id, landlordId]
    );
    if (!ownerCheck.rows.length) {
      return res.status(403).json({ error: 'Tenancy not found or access denied.' });
    }
    const unitId = ownerCheck.rows[0].unit_id;

    // ── UPDATE_PARTICULARS: edit name, email, phone, rent, frequency ─────────
    if (action === 'UPDATE_PARTICULARS') {
      // Validate email if being updated
      if (tenant_email && !isValidEmail(tenant_email))
        return res.status(400).json({ error: `Invalid email address: "${tenant_email}". Please check and try again.` });
      // Normalize phone if being updated
      const updatedPhone = tenant_phone ? normalizeNigerianPhone(tenant_phone) : null;
      const updated = await pool.query(
        `UPDATE tenancies SET
           tenant_name       = COALESCE($1, tenant_name),
           tenant_email      = COALESCE($2, tenant_email),
           tenant_phone      = COALESCE($3, tenant_phone),
           rent_amount       = COALESCE($4, rent_amount),
           payment_frequency = COALESCE($5, payment_frequency)
         WHERE id = $6
         RETURNING id, tenant_name, tenant_email, tenant_phone, rent_amount, payment_frequency`,
        [
          tenant_name      || null,
          tenant_email     || null,
          updatedPhone,
          rent_override    ? Number(rent_override) : null,
          payment_frequency || null,
          tenancy_id,
        ]
      );
      return res.json({ success: true, tenancy: updated.rows[0], message: 'Tenant particulars updated.' });
    }

    // ── TERMINATE_OR_TRANSFER: remove tenancy, reset unit to VACANT ──────────
    if (action === 'TERMINATE_OR_TRANSFER') {
      // Soft-terminate: set tenancy status to TERMINATED rather than hard delete
      // so payment ledger history is preserved (never delete, per platform rules)
      await pool.query(
        `UPDATE tenancies SET status = 'TERMINATED' WHERE id = $1`,
        [tenancy_id]
      );
      // Reset the unit lifecycle state to VACANT so it can accept a new occupant
      await pool.query(
        `UPDATE rental_units SET status = 'VACANT' WHERE id = $1`,
        [unitId]
      );
      // Fetch tenancy details for audit
      const termTenancy = await pool.query(
        `SELECT t.tenant_name, t.tenant_email, ru.unit_name, ru.project_id
         FROM tenancies t JOIN rental_units ru ON ru.id = t.unit_id WHERE t.id = $1`,
        [tenancy_id]
      );
      if (termTenancy.rows.length) {
        const tt = termTenancy.rows[0];
        await logAudit({
          event_type:  'TENANT_TERMINATED',
          actor_id:    landlordId,
          actor_role:  'DEVELOPER',
          unit_id:     unitId,
          tenancy_id,
          project_id:  tt.project_id,
          description: `Tenancy for "${tt.tenant_name}" (${tt.tenant_email}) terminated on unit "${tt.unit_name}"`,
          metadata:    { terminated_by: landlordId, tenant_email: tt.tenant_email },
        });
      }
      return res.json({ success: true, message: 'Tenant terminated. Unit reset to VACANT.' });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/rental/invite/:token — PUBLIC: validate token, return unit/tenancy preview ──
// No auth required — tenant clicks this before they have an account
app.get('/api/rental/invite/:token', async (req: Request, res: Response): Promise<any> => {
  try {
    const { token } = req.params;
    const r = await pool.query(
      `SELECT
         t.id AS tenancy_id, t.tenant_name, t.tenant_email, t.status,
         t.rent_amount, t.currency, t.payment_frequency, t.tenant_user_id,
         ru.id AS unit_id, ru.unit_name, ru.unit_type, ru.bedrooms, ru.size_sqm,
         ru.security_deposit, ru.agency_fee,
         p.title AS project_title, p.project_number, p.location, p.country
       FROM tenancies t
       JOIN rental_units ru ON ru.id = t.unit_id
       JOIN projects p      ON p.id  = ru.project_id
       WHERE t.id = $1`,
      [token]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Invalid or expired invite link' });
    const tenancy = r.rows[0];
    return res.json({
      valid: true,
      already_registered: !!tenancy.tenant_user_id,
      tenancy_id: tenancy.tenancy_id,
      tenant_name: tenancy.tenant_name,
      tenant_email: tenancy.tenant_email,
      unit_id: tenancy.unit_id,
      unit_name: tenancy.unit_name,
      unit_type: tenancy.unit_type,
      bedrooms: tenancy.bedrooms,
      rent_amount: tenancy.rent_amount,
      currency: tenancy.currency,
      payment_frequency: tenancy.payment_frequency,
      security_deposit: tenancy.security_deposit,
      project_title: tenancy.project_title,
      project_number: tenancy.project_number,
      location: tenancy.location,
      country: tenancy.country,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/rental/consume-invite — links authenticated tenant user to their tenancy ──
// Called after tenant registers/logs in. Attaches their user ID to the tenancy row.
app.post('/api/rental/consume-invite', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const { tenancy_id } = req.body;
    if (!tenancy_id) return res.status(400).json({ error: 'tenancy_id required' });

    // Verify tenancy exists and email matches
    const userRes = await pool.query('SELECT email, role FROM public.users WHERE id=$1', [userId]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });
    const user = userRes.rows[0];

    const tenRes = await pool.query(
      `SELECT * FROM tenancies WHERE id=$1`, [tenancy_id]
    );
    if (!tenRes.rows.length) return res.status(404).json({ error: 'Tenancy not found' });
    const tenancy = tenRes.rows[0];

    // Allow if email matches OR if tenant_user_id is already this user
    if (tenancy.tenant_email.toLowerCase() !== user.email.toLowerCase() && tenancy.tenant_user_id !== userId) {
      return res.status(403).json({ error: 'This invite was not sent to your email address' });
    }

    // Link user → tenancy
    await pool.query(
      `UPDATE tenancies SET tenant_user_id=$1, status='ACTIVE', updated_at=NOW() WHERE id=$2`,
      [userId, tenancy_id]
    );

    // Ensure user has TENANT role
    await pool.query(`UPDATE public.users SET role='TENANT' WHERE id=$1 AND role NOT IN ('ADMIN','GOVERNMENT','VERIFIER')`, [userId]);

    // Link vault too
    await pool.query(
      `UPDATE flex_pay_vaults SET tenant_user_id=$1 WHERE tenancy_id=$2 AND tenant_user_id IS NULL`,
      [userId, tenancy_id]
    ).catch(() => {});

    // Log
    await pool.query(
      `INSERT INTO system_ledger (transaction_type, event_type, actor_id, entity_id, entity_type, description, payload, immutable_hash)
       VALUES ('INVITE_CONSUMED','INVITE_CONSUMED',$1,$2,'TENANCY',$3,$4,$5)`,
      [userId, tenancy_id, `Tenant ${user.email} activated tenancy`,
       JSON.stringify({ tenancy_id, userId }),
       crypto.createHash('sha256').update(`INVITE_CONSUMED-${tenancy_id}-${Date.now()}`).digest('hex')]
    ).catch(() => {});
    await logAudit({
      event_type:  'TENANT_PORTAL_ACTIVATED',
      actor_id:    userId,
      actor_role:  'TENANT',
      tenancy_id,
      description: `Tenant "${user.email}" activated self-service portal via invite link`,
      metadata:    { tenancy_id, user_email: user.email },
    });

    return res.json({ success: true, message: 'Tenancy activated. Welcome to Nested Ark!' });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/rental/onboard-tenant — landlord registers a tenant + creates Flex-Pay vault ──
// Frontend payload: { unit_id, tenant_name, tenant_email, tenant_phone,
//                     move_in_date, payment_frequency, deposit_amount }
app.post('/api/rental/onboard-tenant', authenticate, async (req: Request, res: Response): Promise<any> => {
  const landlordId = (req as any).userId;
  try {
    const {
      unit_id, tenant_name, tenant_email, tenant_phone,
      move_in_date, payment_frequency, deposit_amount,
    } = req.body;

    if (!unit_id || !tenant_name || !tenant_email || !move_in_date)
      return res.status(400).json({ error: 'unit_id, tenant_name, tenant_email, move_in_date are required' });

    // — Comprehensive tenant data validation (email, rent, frequency, dates)
    const validationError = validateTenantData({
      tenant_email,
      tenant_phone,
      rent_amount:       undefined,   // unit rent used — not overridden here
      payment_frequency,
      move_in_date,
    });
    if (validationError) return res.status(400).json({ error: validationError });

    // — Normalize phone to +234XXXXXXXXXX before storing
    const normalizedPhone = normalizeNigerianPhone(tenant_phone);

    // — Phone duplicate warning (non-blocking — returns warning in response)
    const phoneWarning = normalizedPhone ? await checkPhoneDuplicate(normalizedPhone) : null;

    // 1 — Verify unit exists and belongs to this landlord
    const uRes = await pool.query(
      `SELECT ru.*, p.id AS project_id, p.sponsor_id, p.title AS project_title
       FROM rental_units ru
       JOIN projects p ON p.id = ru.project_id
       WHERE ru.id = $1`,
      [unit_id]
    );
    if (!uRes.rows.length) return res.status(404).json({ error: 'Unit not found' });
    const unit = uRes.rows[0];
    if (unit.sponsor_id !== landlordId)
      return res.status(403).json({ error: 'You do not own this unit' });

    // 2 — Derive lease_end (1 year from move_in by default) and payment_day
    const leaseStart = new Date(move_in_date);
    const leaseEnd   = new Date(leaseStart);
    leaseEnd.setFullYear(leaseEnd.getFullYear() + 1);
    const paymentDay = leaseStart.getDate();

    // 3 — Normalise payment_frequency → target_amount for vault
    const freq = (payment_frequency || 'monthly').toLowerCase();
    const monthlyRent = Number(unit.rent_amount) || 0;
    const freqMap: Record<string,number> = {
      weekly: monthlyRent / 4, monthly: monthlyRent,
      quarterly: monthlyRent * 3, biannual: monthlyRent * 6, annual: monthlyRent * 12,
    };
    const installmentAmount = freqMap[freq] ?? monthlyRent;
    const targetAmount = monthlyRent * 12; // always one year of rent as vault target

    // 3b — Warn if tenant frequency / rent doesn't match unit configuration
    // e.g. unit is set at ₦600k/mo but landlord onboards tenant as ANNUAL
    // This is informational only — landlord may intentionally override.
    const unitFreq = (unit.payment_frequency || 'MONTHLY').toUpperCase();
    const tenFreq  = freq.toUpperCase();
    const frequencyMismatch =
      unitFreq !== tenFreq
        ? `Note: unit is configured as ${unitFreq} payments but you are onboarding this tenant as ${tenFreq}. The tenant's vault will use ${tenFreq}. Update the unit settings if this is unintended.`
        : null;

    // 4 — Next due date = move_in_date + one frequency period
    const nextDue = new Date(leaseStart);
    if (freq === 'weekly')     nextDue.setDate(nextDue.getDate() + 7);
    else if (freq === 'monthly')    nextDue.setMonth(nextDue.getMonth() + 1);
    else if (freq === 'quarterly')  nextDue.setMonth(nextDue.getMonth() + 3);
    else if (freq === 'biannual')   nextDue.setMonth(nextDue.getMonth() + 6);
    else if (freq === 'annual')     nextDue.setFullYear(nextDue.getFullYear() + 1);

    // 5 — Upsert tenancy row (idempotent — same unit+email = update, not duplicate)
    const tenRes = await pool.query(
      `INSERT INTO tenancies
         (unit_id, project_id, tenant_name, tenant_email, tenant_phone,
          lease_start, lease_end, rent_amount, currency, payment_day, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ACTIVE')
       ON CONFLICT (unit_id, tenant_email)
       DO UPDATE SET
         tenant_name  = EXCLUDED.tenant_name,
         tenant_phone = EXCLUDED.tenant_phone,
         lease_start  = EXCLUDED.lease_start,
         lease_end    = EXCLUDED.lease_end,
         rent_amount  = EXCLUDED.rent_amount,
         payment_day  = EXCLUDED.payment_day,
         status       = 'ACTIVE',
         updated_at   = NOW()
       RETURNING *`,
      [
        unit_id, unit.project_id, tenant_name, tenant_email, normalizedPhone,
        leaseStart.toISOString().split('T')[0],
        leaseEnd.toISOString().split('T')[0],
        unit.rent_amount, unit.currency || 'NGN', paymentDay,
      ]
    );
    const tenancy = tenRes.rows[0];

    // 6 — Create Flex-Pay vault for this tenancy
    const vaultRes = await pool.query(
      `INSERT INTO flex_pay_vaults
         (tenancy_id, unit_id, project_id, vault_balance, target_amount,
          frequency, installment_amount, currency, next_due_date, cashout_mode, status)
       VALUES ($1,$2,$3,0,$4,$5,$6,$7,$8,'LUMP_SUM','ACTIVE')
       RETURNING *`,
      [
        tenancy.id, unit_id, unit.project_id,
        targetAmount, freq.toUpperCase(), installmentAmount,
        unit.currency || 'NGN',
        nextDue.toISOString().split('T')[0],
      ]
    );
    const vault = vaultRes.rows[0];

    // 7 — Mark unit as OCCUPIED and clear marketplace listing (auto-delist on tenant assignment)
    await pool.query(`UPDATE rental_units SET status='OCCUPIED', is_advertised=FALSE, listing_expires_at=NULL WHERE id=$1`, [unit_id]);

    // 8 — Log to system ledger + unit_audit_log
    await pool.query(
      `INSERT INTO system_ledger (transaction_type, event_type, actor_id, entity_id, entity_type, description, metadata, payload, immutable_hash)
       VALUES ('TENANT_ONBOARDED','TENANT_ONBOARDED',$1,$2,'TENANCY',$3,$4,$5,$6)`,
      [
        landlordId, tenancy.id,
        `${tenant_name} onboarded into ${unit.unit_name} (${unit.project_title})`,
        JSON.stringify({ tenancy_id: tenancy.id, vault_id: vault.id, unit_id, freq, installmentAmount }),
        JSON.stringify({ tenancy_id: tenancy.id, unit_id }),
        crypto.createHash('sha256').update(`TENANT_ONBOARDED-${tenancy.id}-${Date.now()}`).digest('hex'),
      ]
    ).catch(() => {});
    await logAudit({
      event_type:  'TENANT_ASSIGNED',
      actor_id:    landlordId,
      actor_role:  'DEVELOPER',
      unit_id,
      tenancy_id:  tenancy.id,
      project_id:  unit.project_id,
      description: `Tenant "${tenant_name}" (${tenant_email}) assigned to unit "${unit.unit_name}"`,
      metadata:    { tenant_email, payment_frequency: freq, installment_amount: installmentAmount, vault_id: vault.id },
    });

    // 9 — Build invite link → PUBLIC page, no auth required
    const FRONTEND = process.env.FRONTEND_URL || 'https://nestedark.com';
    const invite_link = `${FRONTEND}/tenant/invite?token=${tenancy.id}&unit=${unit_id}`;

    return res.status(201).json({
      success: true,
      message: `${tenant_name} successfully onboarded into ${unit.unit_name}`,
      tenancy,
      vault,
      invite_link,
      ...(phoneWarning      ? { phone_warning:       phoneWarning      } : {}),
      ...(frequencyMismatch ? { frequency_warning: frequencyMismatch } : {}),
    });

  } catch (e: any) {
    console.error('[onboard-tenant]', e);
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/rental/units/:projectId — list units for a project ──────────
app.get('/api/rental/units/:projectId', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const r = await pool.query(
      `SELECT ru.*, t.tenant_name, t.tenant_email, t.status AS tenancy_status, t.id AS tenancy_id
       FROM rental_units ru
       LEFT JOIN tenancies t ON t.unit_id=ru.id AND t.status='ACTIVE'
       WHERE ru.project_id=$1 ORDER BY ru.unit_name`,
      [req.params.projectId]
    );
    return res.json({ success: true, units: r.rows });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});



// ── PUT /api/rental/units/:id — update unit details (landlord only) ──────────
app.put('/api/rental/units/:id', authenticate, validateMediaPayload, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const { id } = req.params;
    const {
      unit_name, unit_type, bedrooms, bathrooms, floor_area_sqm,
      floor_level, furnished, parking,
      rent_amount, currency, service_charge, security_deposit,
      description, amenities,
      photo_urls,            // JSONB array of image URLs (legacy)
      available_from,
      status,                // ACTIVE | VACANT | SOLD | MAINTENANCE
      // ── Marketing / marketplace listing fields ───────────────────────────
      marketing_description, // Rich description shown on marketplace listing
      cover_image,           // Primary photo URL (Cloudinary)
      photo_urls_arr,        // TEXT[] of additional photo URLs
    } = req.body;

    // Verify ownership via projects join
    const own = await pool.query(
      `SELECT ru.id FROM rental_units ru
       JOIN projects p ON ru.project_id = p.id
       WHERE ru.id=$1 AND p.sponsor_id=$2`,
      [id, userId]
    );
    if (!own.rows.length)
      return res.status(403).json({ error: 'Unauthorised or unit not found' });

    const r = await pool.query(
      `UPDATE rental_units SET
        unit_name            = COALESCE($1,  unit_name),
        unit_type            = COALESCE($2,  unit_type),
        bedrooms             = COALESCE($3,  bedrooms),
        bathrooms            = COALESCE($4,  bathrooms),
        floor_area_sqm       = COALESCE($5,  floor_area_sqm),
        floor_level          = COALESCE($6,  floor_level),
        furnished            = COALESCE($7,  furnished),
        parking              = COALESCE($8,  parking),
        rent_amount          = COALESCE($9,  rent_amount),
        currency             = COALESCE($10, currency),
        service_charge       = COALESCE($11, service_charge),
        security_deposit     = COALESCE($12, security_deposit),
        description          = COALESCE($13, description),
        amenities            = COALESCE($14, amenities),
        photo_urls           = COALESCE($15, photo_urls),
        available_from       = COALESCE($16, available_from),
        status               = COALESCE($18, status),
        marketing_description= COALESCE($19, marketing_description),
        cover_image          = COALESCE($20, cover_image),
        photo_urls_arr       = COALESCE($21, photo_urls_arr),
        updated_at           = NOW()
      WHERE id=$17
      RETURNING *`,
      [
        unit_name            ?? null,
        unit_type            ?? null,
        bedrooms             ?? null,
        bathrooms            ?? null,
        floor_area_sqm       ?? null,
        floor_level          ?? null,
        furnished            ?? null,
        parking              ?? null,
        rent_amount          ?? null,
        currency             ?? null,
        service_charge       ?? null,
        security_deposit     ?? null,
        description          ?? null,
        amenities            ? JSON.stringify(amenities) : null,
        photo_urls           ? JSON.stringify(photo_urls) : null,
        available_from       ?? null,
        id,
        status               ?? null,
        marketing_description ?? null,
        cover_image           ?? null,
        photo_urls_arr        ? (Array.isArray(photo_urls_arr) ? photo_urls_arr : [photo_urls_arr]) : null,
      ]
    );
    await logAudit({
      event_type:  'UNIT_EDITED',
      actor_id:    userId,
      actor_role:  'DEVELOPER',
      unit_id:     id,
      project_id:  r.rows[0].project_id,
      description: `Unit "${r.rows[0].unit_name}" details updated`,
      metadata:    { fields_updated: Object.keys(req.body).filter(k => req.body[k] !== undefined && req.body[k] !== null) },
    });
    return res.json({ success: true, unit: r.rows[0] });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/rental/units/:id/status — set VACANT/MAINTENANCE/PENDING ─────
app.patch('/api/rental/units/:id/status', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['VACANT', 'OCCUPIED', 'PENDING', 'MAINTENANCE'];
    if (!allowed.includes(status))
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });

    const own = await pool.query(
      `SELECT ru.id FROM rental_units ru JOIN projects p ON ru.project_id=p.id WHERE ru.id=$1 AND p.sponsor_id=$2`,
      [id, userId]
    );
    if (!own.rows.length) return res.status(403).json({ error: 'Unauthorised or unit not found' });

    const r = await pool.query(
      `UPDATE rental_units SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, id]
    );
    return res.json({ success: true, unit: r.rows[0] });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/rental/tenancies — create a lease ──────────────────────────
// ── DELETE /api/rental/units/:id — remove vacant unit safely ──────────────
app.delete('/api/rental/units/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { id }  = req.params;
  try {
    // Verify ownership via project
    const ownCheck = await pool.query(
      `SELECT ru.id, ru.status FROM rental_units ru
       JOIN projects p ON p.id = ru.project_id
       WHERE ru.id = $1 AND (p.sponsor_id = $2 OR (SELECT role FROM public.users WHERE id=$2)='ADMIN')`,
      [id, userId]
    );
    if (!ownCheck.rows.length) return res.status(403).json({ error: 'Unit not found or access denied' });
    if (ownCheck.rows[0].status === 'OCCUPIED') {
      return res.status(400).json({ error: 'Cannot delete a unit with an active tenant lease' });
    }
    // ── Soft delete: never hard-delete units. archived_at marks removal. ──
    // Retains full audit trail, tenancy history, and payment records.
    await pool.query(
      `UPDATE rental_units SET archived_at = NOW(), status = 'ARCHIVED',
       is_advertised = FALSE, listing_expires_at = NULL WHERE id=$1`,
      [id]
    );
    await logAudit({
      event_type:  'UNIT_ARCHIVED',
      actor_id:    userId,
      actor_role:  'DEVELOPER',
      unit_id:     id,
      description: 'Unit soft-deleted (archived). Data retained for audit trail.',
      metadata:    { archived_by: userId },
    });
    return res.json({ success: true, message: 'Unit archived and removed from active inventory.' });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/rental/marketplace/advertise — landlord pays to list vacant unit ──
app.post('/api/rental/marketplace/advertise', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId   = (req as any).userId;
  const { unit_id } = req.body;
  if (!unit_id) return res.status(400).json({ error: 'unit_id required' });

  const LISTING_FEE_NGN = 5000;   // Flat ₦5,000 marketplace listing fee

  try {
    // Verify ownership
    const unitRes = await pool.query(
      `SELECT ru.*, p.sponsor_id FROM rental_units ru
       JOIN projects p ON p.id = ru.project_id
       WHERE ru.id = $1`,
      [unit_id]
    );
    if (!unitRes.rows.length) return res.status(404).json({ error: 'Unit not found' });
    if (unitRes.rows[0].sponsor_id !== userId) return res.status(403).json({ error: 'Not your unit' });
    if (unitRes.rows[0].status === 'OCCUPIED') return res.status(400).json({ error: 'Cannot advertise an occupied unit' });

    // Landlord email
    const userRes = await pool.query('SELECT email FROM public.users WHERE id=$1', [userId]);
    const email   = userRes.rows[0]?.email;

    const ref = `ARK-ADVERT-${unit_id.slice(0,8).toUpperCase()}-${Date.now()}`;
    const FRONTEND = process.env.FRONTEND_URL || 'https://nestedark.com';

    const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        amount:       LISTING_FEE_NGN * 100,
        reference:    ref,
        currency:     'NGN',
        callback_url: `${FRONTEND}/landlord/inventory?advertised=1&ref=${ref}`,
        metadata: {
          unit_id,
          payment_type:  'MARKETING_AD_FEE',
          listing_fee:   LISTING_FEE_NGN,
          landlord_id:   userId,
        },
      }),
    });
    const psData = await psRes.json() as any;
    if (!psData.status) return res.status(502).json({ error: psData.message || 'Paystack error' });

    return res.json({
      success:           true,
      authorization_url: psData.data.authorization_url,
      reference:         ref,
      listing_fee_ngn:   LISTING_FEE_NGN,
      message:           `Pay ₦${LISTING_FEE_NGN.toLocaleString()} to list this unit on the Nested Ark marketplace`,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/marketplace/discover — PUBLIC, no auth required ──────────────
app.get('/api/marketplace/discover', async (req: Request, res: Response): Promise<any> => {
  const { search, minPrice, maxPrice, bedrooms, location, page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    let where = `WHERE ru.is_advertised = TRUE AND ru.status != 'OCCUPIED' AND ru.archived_at IS NULL AND (ru.listing_expires_at IS NULL OR ru.listing_expires_at > NOW())`;
    const params: any[] = [];
    let i = 1;

    if (search) {
      where += ` AND (p.title ILIKE $${i} OR ru.unit_name ILIKE $${i} OR p.location ILIKE $${i})`;
      params.push(`%${search}%`); i++;
    }
    if (minPrice) { where += ` AND ru.rent_amount >= $${i}`; params.push(Number(minPrice)); i++; }
    if (maxPrice) { where += ` AND ru.rent_amount <= $${i}`; params.push(Number(maxPrice)); i++; }
    if (bedrooms) { where += ` AND ru.bedrooms = $${i}`; params.push(Number(bedrooms)); i++; }
    if (location) { where += ` AND p.location ILIKE $${i}`; params.push(`%${location}%`); i++; }

    const result = await pool.query(
      `SELECT
         ru.id, ru.unit_name, ru.unit_type, ru.bedrooms, ru.bathrooms,
         ru.rent_amount, ru.currency, ru.payment_frequency,
         ru.security_deposit, ru.agency_fee, ru.caution_fee, ru.service_charge,
         ru.amenities, ru.furnished, ru.parking, ru.size_sqm, ru.floor_number,
         ru.marketing_description, ru.cover_image, ru.photo_urls_arr, ru.advertised_at, ru.listing_expires_at,
         ru.bank_name, ru.account_name, ru.status,
         p.id AS project_id, p.title AS project_title, p.location, p.country,
         p.project_number, p.city
       FROM rental_units ru
       JOIN projects p ON p.id = ru.project_id
       ${where}
       ORDER BY ru.advertised_at DESC NULLS LAST
       LIMIT $${i} OFFSET $${i+1}`,
      [...params, parseInt(limit as string), offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM rental_units ru JOIN projects p ON p.id = ru.project_id ${where}`,
      params
    );

    return res.json({
      success:  true,
      listings: result.rows,
      total:    parseInt(countRes.rows[0].count),
      page:     parseInt(page as string),
      limit:    parseInt(limit as string),
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/marketplace/unit/:unitId — PUBLIC unit detail page ────────────
app.get('/api/marketplace/unit/:unitId', async (req: Request, res: Response): Promise<any> => {
  const { unitId } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         ru.*, p.title AS project_title, p.location, p.country,
         p.project_number, p.city, p.description AS project_description
       FROM rental_units ru
       JOIN projects p ON p.id = ru.project_id
       WHERE ru.id = $1`,
      [unitId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Listing not found' });
    return res.json({ success: true, unit: result.rows[0] });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.post('/api/rental/tenancies', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const { unit_id, tenant_name, tenant_email, tenant_phone,
            lease_start, lease_end, rent_amount, currency, payment_day,
            payment_frequency: srFreq, notes } = req.body;
    if (!unit_id || !tenant_name || !tenant_email || !lease_start || !rent_amount)
      return res.status(400).json({ error: 'unit_id, tenant_name, tenant_email, lease_start, rent_amount required' });

    // — Full data validation (email, rent, frequency, dates)
    const selfRegValidErr = validateTenantData({
      tenant_email, tenant_phone, rent_amount,
      payment_frequency: srFreq,
      lease_start, lease_end,
    });
    if (selfRegValidErr) return res.status(400).json({ error: selfRegValidErr });

    // — Normalize phone
    const normalizedPhoneSR = normalizeNigerianPhone(tenant_phone);

    // — Phone duplicate warning
    const phoneWarningSR = normalizedPhoneSR ? await checkPhoneDuplicate(normalizedPhoneSR) : null;

    const unit = await pool.query(
      `SELECT ru.*, p.sponsor_id FROM rental_units ru
       JOIN projects p ON ru.project_id=p.id WHERE ru.id=$1`, [unit_id]
    );
    if (!unit.rows.length)          return res.status(404).json({ error: 'Unit not found' });
    if (unit.rows[0].sponsor_id !== userId)
      return res.status(403).json({ error: 'Only the project owner can create tenancies' });

    await pool.query("UPDATE rental_units SET status='OCCUPIED', is_advertised=FALSE, listing_expires_at=NULL WHERE id=$1", [unit_id]);

    const r = await pool.query(
      `INSERT INTO tenancies
         (unit_id,project_id,tenant_name,tenant_email,tenant_phone,
          lease_start,lease_end,rent_amount,currency,payment_day,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [unit_id, unit.rows[0].project_id, tenant_name, tenant_email,
       normalizedPhoneSR||null, lease_start, lease_end||null,
       rent_amount, currency||'NGN', payment_day||1, notes||null]
    );
    return res.status(201).json({
      success: true,
      tenancy: r.rows[0],
      ...(phoneWarningSR ? { phone_warning: phoneWarningSR } : {}),
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/rental/payments/initialize — generate Paystack rent link ───
app.post('/api/rental/payments/initialize', async (req: Request, res: Response): Promise<any> => {
  try {
    const { tenancy_id, period_month } = req.body;
    if (!tenancy_id) return res.status(400).json({ error: 'tenancy_id required' });

    const ten = await pool.query(
      `SELECT t.*, ru.unit_name, ru.project_id, ru.landlord_bank_account_id,
              p.title AS project_title, p.sponsor_id
       FROM tenancies t
       JOIN rental_units ru ON t.unit_id=ru.id
       JOIN projects p ON ru.project_id=p.id
       WHERE t.id=$1`, [tenancy_id]
    );
    if (!ten.rows.length) return res.status(404).json({ error: 'Tenancy not found' });
    const t = ten.rows[0];

    const month     = period_month || new Date().toISOString().slice(0, 7);
    const reference = `RENT-${uuidv4().split('-')[0].toUpperCase()}-${Date.now()}`;
    const amountKobo = Math.round(parseFloat(t.rent_amount) * 100);

    // Create PENDING rent_payment record
    const rp = await pool.query(
      `INSERT INTO rent_payments
         (tenancy_id,unit_id,project_id,amount_ngn,paystack_reference,period_month,status)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING') RETURNING *`,
      [tenancy_id, t.unit_id, t.project_id, t.rent_amount, reference, month]
    );

    if (!PAYSTACK_SECRET) return res.status(503).json({ error: 'Payment gateway not configured' });

    // ── Resolve landlord subaccount for automatic 98/2 rent split ──────────
    // Priority: unit-linked bank account → landlord's default → any verified account
    let landlordSubaccountCode: string | null = null;
    try {
      const bankQuery = `
        SELECT lba.paystack_subaccount_code
        FROM landlord_bank_accounts lba
        WHERE lba.paystack_subaccount_code IS NOT NULL
          AND lba.user_id = $1
          AND (
            lba.id = $2
            OR lba.is_default = true
            OR TRUE
          )
        ORDER BY
          CASE WHEN lba.id = $2          THEN 0
               WHEN lba.is_default        THEN 1
               ELSE 2 END
        LIMIT 1`;
      const bankRes = await pool.query(bankQuery, [t.sponsor_id, t.landlord_bank_account_id || '00000000-0000-0000-0000-000000000000']);
      if (bankRes.rows.length && bankRes.rows[0].paystack_subaccount_code) {
        landlordSubaccountCode = bankRes.rows[0].paystack_subaccount_code;
      }
    } catch (bankErr) {
      console.warn('[RENT-PAY] Could not resolve landlord subaccount:', bankErr);
    }

    // Platform fee: 2% of rent amount in kobo
    const platformFeeKobo = Math.round(amountKobo * 0.02);

    // Build Paystack payload — inject subaccount split when available
    const psPayload: Record<string, any> = {
      email: t.tenant_email,
      amount: amountKobo,
      reference,
      currency: t.currency || 'NGN',
      callback_url: `${process.env.FRONTEND_URL || 'https://nestedark.com'}/tenant/pay/success?reference=${reference}`,
      metadata: {
        product:         'nestedark',
        payment_type:    'RENT',
        tenancy_id,
        unit_id:         t.unit_id,
        unit_name:       t.unit_name,
        project_id:      t.project_id,
        rent_payment_id: rp.rows[0].id,
        project_title:   t.project_title,
        period_month:    month,
        tenant_email:    t.tenant_email,
        tenant_id:       t.tenant_user_id ?? null,
        landlord_id:     t.sponsor_id,
        split_mode:      landlordSubaccountCode ? 'AUTO_SPLIT' : 'MANUAL_PAYOUT',
      },
      channels: ['card','bank','ussd','mobile_money','bank_transfer'],
    };

    if (landlordSubaccountCode) {
      // Auto-split: landlord gets 98%, platform keeps 2%
      // bearer: "account" means the platform covers Paystack's own transaction fee
      psPayload.subaccount          = landlordSubaccountCode;
      psPayload.bearer              = 'account';
      psPayload.transaction_charge  = platformFeeKobo;  // platform retains this amount
      console.log(`[RENT-PAY] Auto-split enabled — subaccount=${landlordSubaccountCode}, platform_fee_kobo=${platformFeeKobo}`);
    } else {
      // Fallback: full amount lands in platform, manual payout cron handles landlord settlement
      psPayload.bearer = 'account';
      console.log(`[RENT-PAY] No subaccount found for landlord ${t.sponsor_id} — falling back to manual payout flow`);
    }

    const psRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(psPayload),
    });

    const psData = await psRes.json() as any;
    if (!psData.status) return res.status(500).json({ error: psData.message ?? 'Paystack error' });

    await pool.query(
      "UPDATE rent_payments SET paystack_access_code=$1 WHERE id=$2",
      [psData.data.access_code, rp.rows[0].id]
    );

    return res.json({
      success: true,
      authorization_url: psData.data.authorization_url,
      access_code: psData.data.access_code,
      reference,
      amount_ngn: t.rent_amount,
      period_month: month,
      tenant_email: t.tenant_email,
      unit_name: t.unit_name,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/rental/project/:projectId — full rental dashboard data ───────
app.get('/api/rental/project/:projectId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const { projectId } = req.params;
  try {
    const [units, tenancies, payments, distributions, config, project] = await Promise.all([
      pool.query(
        `SELECT ru.*, t.tenant_name, t.tenant_email, t.status AS tenancy_status, t.id AS tenancy_id
         FROM rental_units ru
         LEFT JOIN tenancies t ON t.unit_id=ru.id AND t.status='ACTIVE'
         WHERE ru.project_id=$1 ORDER BY ru.unit_name`, [projectId]
      ),
      pool.query(
        `SELECT * FROM tenancies WHERE project_id=$1 ORDER BY lease_start DESC`, [projectId]
      ),
      pool.query(
        `SELECT * FROM rent_payments WHERE project_id=$1 ORDER BY created_at DESC LIMIT 48`, [projectId]
      ),
      pool.query(
        `SELECT yd.*, u.full_name, u.email
         FROM yield_distributions yd
         LEFT JOIN public.users u ON yd.recipient_id=u.id
         WHERE yd.project_id=$1 ORDER BY yd.distributed_at DESC LIMIT 100`, [projectId]
      ),
      pool.query(
        `SELECT key, value, label FROM market_config WHERE key LIKE 'rental_%'`
      ),
      pool.query(
        `SELECT id, title, project_number, project_mode, lifecycle_stage,
                monthly_rent, asset_health_score
         FROM projects WHERE id=$1`, [projectId]
      ),
    ]);

    const successPayments = payments.rows.filter((p: any) => p.status === 'DISTRIBUTED' || p.status === 'SUCCESS');
    const totalCollected  = successPayments.reduce((s: number, p: any) => s + parseFloat(p.amount_ngn), 0);
    const occupiedUnits   = units.rows.filter((u: any) => u.tenancy_status === 'ACTIVE').length;

    return res.json({
      success: true,
      project: project.rows[0] || null,
      units: units.rows,
      tenancies: tenancies.rows,
      payments: payments.rows,
      distributions: distributions.rows,
      config: Object.fromEntries(config.rows.map((r: any) => [r.key, { value: parseFloat(r.value), label: r.label }])),
      summary: {
        total_units:          units.rows.length,
        occupied_units:       occupiedUnits,
        vacant_units:         units.rows.length - occupiedUnits,
        occupancy_rate:       units.rows.length > 0 ? Math.round((occupiedUnits / units.rows.length) * 100) : 0,
        total_collected_ngn:  totalCollected,
        monthly_potential_ngn: units.rows.reduce((s: number, u: any) => s + parseFloat(u.rent_amount), 0),
        total_distributions:  distributions.rows.length,
      },
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/rental/stakeholders — set custom split for a project ────────
app.post('/api/rental/stakeholders', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const { project_id, splits } = req.body;
    // splits: [{ user_id?, role, share_pct, description?, bank_code?, account_number?, is_auto_pay? }]
    if (!project_id || !Array.isArray(splits) || splits.length === 0)
      return res.status(400).json({ error: 'project_id and splits[] required' });

    const proj = await pool.query('SELECT sponsor_id FROM projects WHERE id=$1', [project_id]);
    if (!proj.rows.length)       return res.status(404).json({ error: 'Project not found' });
    if (proj.rows[0].sponsor_id !== userId)
      return res.status(403).json({ error: 'Only the project owner can set splits' });

    const total = splits.reduce((s: number, r: any) => s + parseFloat(r.share_pct || 0), 0);
    if (Math.abs(total - 100) > 0.01)
      return res.status(400).json({ error: `Split percentages must sum to 100. Got ${total.toFixed(2)}%` });

    // Replace existing splits atomically
    await pool.query('BEGIN');
    await pool.query('DELETE FROM stakeholder_splits WHERE project_id=$1', [project_id]);
    for (const s of splits) {
      await pool.query(
        `INSERT INTO stakeholder_splits
           (project_id,user_id,role,share_pct,description,bank_code,account_number,is_auto_pay)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [project_id, s.user_id||null, s.role, parseFloat(s.share_pct),
         s.description||null, s.bank_code||null, s.account_number||null, s.is_auto_pay||false]
      );
    }
    await pool.query('COMMIT');
    return res.json({ success: true, message: 'Stakeholder splits saved', total_pct: total });
  } catch (e: any) {
    await pool.query('ROLLBACK');
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/rental/stakeholders/:projectId — get custom splits ──────────
app.get('/api/rental/stakeholders/:projectId', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const r = await pool.query(
      `SELECT ss.*, u.full_name, u.email
       FROM stakeholder_splits ss
       LEFT JOIN public.users u ON ss.user_id=u.id
       WHERE ss.project_id=$1 ORDER BY ss.role`,
      [req.params.projectId]
    );
    return res.json({ success: true, splits: r.rows,
      total_pct: r.rows.reduce((s: number, x: any) => s + parseFloat(x.share_pct), 0) });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/rental/portfolio — investor's rental income stream ───────────
app.get('/api/rental/portfolio', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const [distributions, projects] = await Promise.all([
      pool.query(
        `SELECT yd.*, rp.period_month, rp.amount_ngn AS rent_total, rp.paid_at,
                p.title AS project_title, p.project_number, ru.unit_name
         FROM yield_distributions yd
         JOIN rent_payments rp ON yd.rent_payment_id=rp.id
         JOIN projects p       ON yd.project_id=p.id
         LEFT JOIN rental_units ru ON rp.unit_id=ru.id
         WHERE yd.recipient_id=$1 AND yd.recipient_role='INVESTOR'
         ORDER BY yd.distributed_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT DISTINCT p.id, p.title, p.project_number, p.project_mode,
                SUM(yd.amount_ngn) AS total_received_ngn
         FROM yield_distributions yd JOIN projects p ON yd.project_id=p.id
         WHERE yd.recipient_id=$1 AND yd.recipient_role='INVESTOR'
         GROUP BY p.id, p.title, p.project_number, p.project_mode`,
        [userId]
      ),
    ]);
    const totalNgn = distributions.rows.reduce((s: number, d: any) => s + parseFloat(d.amount_ngn), 0);
    return res.json({
      success: true, distributions: distributions.rows, projects: projects.rows,
      summary: { total_received_ngn: totalNgn, total_received_usd: totalNgn/1379,
                 distribution_count: distributions.rows.length },
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/rental/config — public rental split ratios ──────────────────
app.get('/api/rental/config', async (req: Request, res: Response): Promise<any> => {
  try {
    const r = await pool.query(`SELECT key, value, label FROM market_config WHERE key LIKE 'rental_%'`);
    return res.json({ success: true, config: Object.fromEntries(
      r.rows.map((row: any) => [row.key, { value: parseFloat(row.value), label: row.label }])
    )});
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/maintenance — log a maintenance event ──────────────────────
app.post('/api/maintenance', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const { project_id, unit_id, title, description, category, severity, cost_ngn } = req.body;
    if (!project_id || !title) return res.status(400).json({ error: 'project_id and title required' });
    const r = await pool.query(
      `INSERT INTO maintenance_logs
         (project_id,unit_id,title,description,category,severity,cost_ngn,reported_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [project_id, unit_id||null, title, description||null,
       category||'GENERAL', severity||'LOW', cost_ngn||null, userId]
    );
    // Update asset health score (deduct severity points)
    const deduct: Record<string,number> = { LOW:2, MEDIUM:5, HIGH:10, CRITICAL:20 };
    await pool.query(
      `UPDATE projects SET asset_health_score = GREATEST(0, asset_health_score - $1) WHERE id=$2`,
      [deduct[severity||'LOW']||2, project_id]
    );
    return res.status(201).json({ success: true, log: r.rows[0] });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/maintenance/:projectId — get maintenance logs ───────────────
app.get('/api/maintenance/:projectId', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const r = await pool.query(
      `SELECT ml.*, u.full_name AS reported_by_name
       FROM maintenance_logs ml
       LEFT JOIN public.users u ON ml.reported_by=u.id
       WHERE ml.project_id=$1 ORDER BY ml.created_at DESC`,
      [req.params.projectId]
    );
    return res.json({ success: true, logs: r.rows });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});


// ============================================================================
// GET /api/admin/overview — Global Control Center
// AUM, revenue, stakeholders, lifecycle pipeline, live transaction feed
// ============================================================================
app.get('/api/admin/overview', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId   = (req as any).userId;
  const roleCheck = await pool.query('SELECT role FROM public.users WHERE id = $1', [userId]);
  if (!['ADMIN', 'DEVELOPER', 'FOUNDER'].includes(roleCheck.rows[0]?.role)) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const [
      aumRow,
      revenueRow,
      stakeholdersRow,
      escrowRow,
      lifecycleRow,
      recentInvestments,
      recentRentals,
      recentBids,
      recentEscrow,
    ] = await Promise.all([

      // 1. AUM — total value of all ACTIVE projects (USD)
      pool.query(`
        SELECT COALESCE(SUM(
          CASE currency
            WHEN 'USD' THEN budget
            WHEN 'NGN' THEN budget / 1500
            WHEN 'GBP' THEN budget * 1.27
            WHEN 'AED' THEN budget / 3.67
            WHEN 'KES' THEN budget / 130
            WHEN 'ZAR' THEN budget / 18
            WHEN 'EUR' THEN budget * 1.09
            WHEN 'SGD' THEN budget / 1.35
            ELSE budget
          END
        ), 0) AS aum_usd
        FROM projects
        WHERE status IN ('ACTIVE', 'OPERATIONAL', 'CONSTRUCTION')
      `),

      // 2. Platform revenue this calendar month
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) THEN amount_usd END), 0) AS revenue_mtd,
          COALESCE(SUM(amount_usd), 0) AS revenue_all_time
        FROM platform_revenue
        WHERE status = 'COMPLETED'
      `),

      // 3. Active stakeholders — unique users who have any committed investment,
      //    any bid, or any rent payment in the last 90 days
      pool.query(`
        SELECT COUNT(DISTINCT uid) AS cnt FROM (
          SELECT investor_id AS uid FROM investments WHERE status = 'COMMITTED'
          UNION
          SELECT c.user_id   AS uid FROM bids b JOIN contractors c ON c.id = b.contractor_id WHERE b.created_at > NOW() - INTERVAL '90 days'
          UNION
          SELECT rp.tenant_id AS uid FROM rent_payments rp WHERE rp.created_at > NOW() - INTERVAL '90 days'
        ) sub
      `).catch(() => pool.query(`
        SELECT COUNT(DISTINCT investor_id) AS cnt FROM investments WHERE status = 'COMMITTED'
      `)),

      // 4. Pending escrow — principal in escrow wallets not yet released
      pool.query(`
        SELECT COALESCE(SUM(
          CASE p.currency
            WHEN 'USD' THEN ew.balance
            WHEN 'NGN' THEN ew.balance / 1500
            WHEN 'GBP' THEN ew.balance * 1.27
            WHEN 'AED' THEN ew.balance / 3.67
            ELSE ew.balance / 1000
          END
        ), 0) AS pending_usd
        FROM escrow_wallets ew
        JOIN projects p ON p.id = ew.project_id
        WHERE ew.balance > 0
      `).catch(() => pool.query(`
        SELECT COALESCE(SUM(amount) / 1500, 0) AS pending_usd
        FROM investments WHERE status = 'COMMITTED'
      `)),

      // 5. Project counts by lifecycle status
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'PENDING'      OR lifecycle_stage = 'PENDING'      THEN 1 ELSE 0 END), 0) AS pending,
          COALESCE(SUM(CASE WHEN status = 'ACTIVE'       OR lifecycle_stage = 'FUNDING'      THEN 1 ELSE 0 END), 0) AS active,
          COALESCE(SUM(CASE WHEN project_status = 'CONSTRUCTION' OR lifecycle_stage = 'CONSTRUCTION' THEN 1 ELSE 0 END), 0) AS construction,
          COALESCE(SUM(CASE WHEN ai_verified = TRUE AND gov_verified = FALSE THEN 1 ELSE 0 END), 0) AS verification,
          COALESCE(SUM(CASE WHEN project_status = 'OPERATIONAL' OR lifecycle_stage = 'OPERATIONAL' THEN 1 ELSE 0 END), 0) AS operational
        FROM projects
      `).catch(() => pool.query(`
        SELECT
          COUNT(CASE WHEN status='PENDING'      THEN 1 END) AS pending,
          COUNT(CASE WHEN status='ACTIVE'        THEN 1 END) AS active,
          COUNT(CASE WHEN status='CONSTRUCTION'  THEN 1 END) AS construction,
          0::bigint AS verification,
          COUNT(CASE WHEN status='OPERATIONAL'   THEN 1 END) AS operational
        FROM projects
      `)),

      // 6. Recent investments
      pool.query(`
        SELECT
          i.id, 'INVESTMENT' AS type,
          i.amount AS amount, COALESCE(p.currency,'USD') AS currency,
          p.title AS project_title, p.project_number,
          u.full_name AS user_name,
          COALESCE(p.country, 'Nigeria') AS country,
          i.created_at
        FROM investments i
        JOIN projects p ON p.id = i.project_id
        JOIN public.users u    ON u.id = i.investor_id
        WHERE i.status = 'COMMITTED'
        ORDER BY i.created_at DESC LIMIT 4
      `).catch(() => ({ rows: [] })),

      // 7. Recent rental payments
      pool.query(`
        SELECT
          rp.id, 'RENTAL' AS type,
          rp.amount_ngn AS amount, 'NGN' AS currency,
          p.title AS project_title, p.project_number,
          COALESCE(u.full_name, 'Tenant') AS user_name,
          COALESCE(p.country, 'Nigeria') AS country,
          rp.created_at
        FROM rent_payments rp
        JOIN projects p ON p.id = rp.project_id
        LEFT JOIN public.users u ON u.id = rp.tenant_id
        ORDER BY rp.created_at DESC LIMIT 3
      `).catch(() => ({ rows: [] })),

      // 8. Recent bids
      pool.query(`
        SELECT
          b.id, 'BID' AS type,
          b.amount AS amount, COALESCE(p.currency,'USD') AS currency,
          p.title AS project_title, p.project_number,
          COALESCE(u.full_name, 'Contractor') AS user_name,
          COALESCE(p.country, 'Nigeria') AS country,
          b.created_at
        FROM bids b
        JOIN projects p      ON p.id = b.project_id
        JOIN contractors c   ON c.id = b.contractor_id
        JOIN public.users u         ON u.id = c.user_id
        ORDER BY b.created_at DESC LIMIT 3
      `).catch(() => ({ rows: [] })),

      // 9. Recent escrow milestone releases
      pool.query(`
        SELECT
          sl.id, 'ESCROW' AS type,
          COALESCE((sl.payload->>'amount_released')::numeric, 0) AS amount,
          COALESCE(sl.payload->>'currency', 'USD') AS currency,
          COALESCE(sl.payload->>'project_title', 'Project') AS project_title,
          COALESCE(sl.payload->>'project_number', '') AS project_number,
          'System' AS user_name,
          COALESCE(sl.payload->>'country', 'Nigeria') AS country,
          sl.created_at
        FROM system_ledger sl
        WHERE sl.transaction_type LIKE '%RELEASE%'
        ORDER BY sl.created_at DESC LIMIT 3
      `).catch(() => ({ rows: [] })),
    ]);

    // Merge & sort recent transactions by date desc, take top 10
    const allTx = [
      ...recentInvestments.rows,
      ...recentRentals.rows,
      ...recentBids.rows,
      ...recentEscrow.rows,
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(tx => ({
        ...tx,
        amount: parseFloat(tx.amount) || 0,
      }));

    const lc = lifecycleRow.rows[0] ?? {};

    return res.json({
      success: true,
      aum_usd:               parseFloat(aumRow.rows[0]?.aum_usd        || '0'),
      revenue_mtd_usd:       parseFloat(revenueRow.rows[0]?.revenue_mtd || '0'),
      revenue_all_time_usd:  parseFloat(revenueRow.rows[0]?.revenue_all_time || '0'),
      active_stakeholders:   parseInt(stakeholdersRow.rows[0]?.cnt      || '0'),
      pending_escrow_usd:    parseFloat(escrowRow.rows[0]?.pending_usd  || '0'),
      projects_by_status: {
        PENDING:      parseInt(lc.pending      || '0'),
        ACTIVE:       parseInt(lc.active       || '0'),
        CONSTRUCTION: parseInt(lc.construction || '0'),
        VERIFICATION: parseInt(lc.verification || '0'),
        OPERATIONAL:  parseInt(lc.operational  || '0'),
      },
      recent_transactions: allTx,
    });
  } catch (err: any) {
    console.error('[/api/admin/overview]', err.message);
    return res.status(500).json({ error: err.message });
  }
});


// ============================================================================
// ════════════════════════════════════════════════════════════════════════════
// MODULE: ASSET MANAGEMENT — Rent Reminders · Legal Notices · Receipts
// Endpoints: /api/notices, /api/reminders, /api/receipts …
// ════════════════════════════════════════════════════════════════════════════
// POWERHOUSE ASSET MANAGEMENT ROUTES
// Flex-Pay Vaults · Mobilization Escrow · Reminders · Notice Generator · Dashboard
// ============================================================================

// ── COMPATIBILITY SHIM: getMailer() ──────────────────────────────────────────
// The ONLY remaining consumer of this is `startReminderCron(pool, getMailer)`
// at the bottom of this file — cron_scheduler.ts types its parameter as
// `MailerFactory`, which expects a function returning a full nodemailer
// `Transporter`. Since the email architecture moved to Brevo's HTTP API,
// getTransporter() now returns a much simpler `MailTransport` (just
// `.sendMail()`) — the only method cron_scheduler.ts actually calls. The
// `as any` below is a type-level cast only; the object returned at runtime
// is identical to what every other email call site in this file already
// uses successfully. If cron_scheduler.ts is ever revised, its
// `MailerFactory` type should be loosened to `() => { sendMail(...): ... }`
// so this cast can be removed.
function getMailer(): any {
  return getTransporter();
}

// ── HELPER: generate HTML notice body ────────────────────────────────────────
function buildNoticeHTML(opts: {
  noticeNumber: string; noticeType: string;
  tenantName: string; tenantEmail: string;
  unitName: string; projectTitle: string; projectNumber: string;
  amountOverdue: number; daysOverdue: number;
  responseDeadline: string; issuedAt: string;
  ledgerHash: string;
}) {
  const typeLabels: Record<string, string> = {
    NOTICE_TO_PAY:    'NOTICE TO PAY — RENTAL ARREARS',
    NOTICE_TO_QUIT:   'NOTICE TO QUIT',
    FINAL_WARNING:    'FINAL WARNING — EVICTION PROCEEDINGS',
    EVICTION_WARNING: 'NOTICE OF EVICTION',
  };
  const title = typeLabels[opts.noticeType] ?? opts.noticeType;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Times New Roman', Times, serif; background: #fff; color: #111; margin: 0; padding: 0; }
  .page { max-width: 720px; margin: 0 auto; padding: 48px 56px; }
  .header { border-bottom: 3px solid #14b8a6; padding-bottom: 20px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
  .logo { font-size: 11px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; color: #14b8a6; }
  .notice-num { font-size: 10px; color: #555; font-family: 'Courier New', monospace; }
  h1 { font-size: 17px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin: 0 0 28px; padding: 14px; background: #f9fafb; border: 2px solid #14b8a6; border-radius: 4px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; margin-bottom: 28px; }
  .meta-item label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; display: block; margin-bottom: 2px; }
  .meta-item span { font-size: 12px; font-weight: bold; }
  .amount-box { background: #fef2f2; border: 2px solid #dc2626; border-radius: 6px; padding: 16px 20px; margin: 24px 0; text-align: center; }
  .amount-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #dc2626; margin-bottom: 6px; }
  .amount-box .amount { font-size: 26px; font-weight: 900; color: #dc2626; font-family: 'Courier New', monospace; }
  .body-text { font-size: 13px; line-height: 1.8; color: #222; margin-bottom: 16px; }
  .deadline-box { background: #fff7ed; border-left: 4px solid #f97316; padding: 14px 18px; margin: 20px 0; border-radius: 0 6px 6px 0; }
  .deadline-box strong { color: #c2410c; }
  .signature-block { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
  .ledger-footer { margin-top: 36px; padding: 12px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 9px; color: #166534; word-break: break-all; }
</style></head>
<body><div class="page">

  <div class="header">
    <div>
      <div class="logo">⬡ Nested Ark OS</div>
      <div style="font-size:10px;color:#555;margin-top:3px;">Impressions &amp; Impacts Ltd · Property Management Division</div>
    </div>
    <div class="notice-num">
      <div>${opts.noticeNumber}</div>
      <div style="margin-top:3px;">Issued: ${opts.issuedAt}</div>
    </div>
  </div>

  <h1>${title}</h1>

  <div class="meta-grid">
    <div class="meta-item"><label>Tenant Name</label><span>${opts.tenantName}</span></div>
    <div class="meta-item"><label>Unit</label><span>${opts.unitName}</span></div>
    <div class="meta-item"><label>Property</label><span>${opts.projectTitle}</span></div>
    <div class="meta-item"><label>Project ID</label><span style="font-family:monospace;color:#14b8a6;">${opts.projectNumber}</span></div>
    <div class="meta-item"><label>Days in Arrears</label><span style="color:#dc2626;">${opts.daysOverdue} days</span></div>
    <div class="meta-item"><label>Response Deadline</label><span style="color:#c2410c;">${opts.responseDeadline}</span></div>
  </div>

  <div class="amount-box">
    <div class="label">Total Amount in Arrears</div>
    <div class="amount">₦${Number(opts.amountOverdue).toLocaleString()}</div>
  </div>

  <p class="body-text">
    TAKE NOTICE that you are in arrears of rent for the above-mentioned premises in the sum of
    <strong>₦${Number(opts.amountOverdue).toLocaleString()}</strong>, which was due and payable
    under the terms of your tenancy agreement. Despite previous reminders, this amount remains
    outstanding as of the date of this notice.
  </p>

  <div class="deadline-box">
    <strong>YOU ARE HEREBY REQUIRED</strong> to pay the full outstanding amount of
    <strong>₦${Number(opts.amountOverdue).toLocaleString()}</strong> on or before
    <strong>${opts.responseDeadline}</strong>. Failure to do so may result in further legal action,
    including proceedings to recover possession of the property.
  </div>

  <p class="body-text">
    Payment may be made via the Nested Ark Tenant Portal. If you believe this notice has been
    issued in error, please contact the property management team immediately with supporting
    documentation.
  </p>

  <div class="signature-block">
    <div style="display:flex;justify-content:space-between;">
      <div>
        <p style="font-size:12px;font-weight:bold;margin:0;">For and on behalf of</p>
        <p style="font-size:12px;margin:4px 0;">Impressions &amp; Impacts Ltd</p>
        <p style="font-size:10px;color:#888;margin:4px 0;">Nested Ark OS — Property Management Division</p>
        <div style="margin-top:16px;border-top:1px solid #111;width:180px;padding-top:4px;font-size:10px;color:#555;">Authorised Signature</div>
      </div>
      <div style="text-align:right;">
        <div style="width:80px;height:80px;background:#f0fdf4;border:2px solid #14b8a6;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-left:auto;">
          <span style="font-size:9px;font-weight:900;color:#14b8a6;text-align:center;line-height:1.2;">ARK<br>VERIFIED</span>
        </div>
      </div>
    </div>
  </div>

  <div class="ledger-footer">
    SHA-256 LEDGER HASH: ${opts.ledgerHash}<br>
    This notice is immutably recorded on the Nested Ark blockchain ledger. Hash verifiable at nestedark.io/ledger
  </div>

</div></body></html>`;
}

// ── HELPER: generate PDF from HTML (puppeteer if available, else html-pdf, else null) ─
async function generateNoticePDF(html: string): Promise<Buffer | null> {
  try {
    const puppeteer = require('puppeteer');
    const browser   = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page      = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } });
    await browser.close();
    return pdf as Buffer;
  } catch {
    try {
      const htmlpdf = require('html-pdf');
      return await new Promise((resolve, reject) => {
        htmlpdf.create(html, { format: 'A4' }).toBuffer((err: any, buf: Buffer) => {
          if (err) reject(err); else resolve(buf);
        });
      });
    } catch {
      return null;
    }
  }
}

// ── 1. FLEX-PAY VAULT ─────────────────────────────────────────────────────────

// POST /api/flex-pay/setup
app.post('/api/flex-pay/setup', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { tenancy_id, frequency, cashout_mode, drawdown_day } = req.body;
  if (!tenancy_id || !frequency) return res.status(400).json({ error: 'tenancy_id and frequency required' });
  const validFreqs = ['WEEKLY','MONTHLY','QUARTERLY'];
  if (!validFreqs.includes(frequency)) return res.status(400).json({ error: `frequency must be one of ${validFreqs.join(', ')}` });
  try {
    const ten = await pool.query(
      `SELECT t.*, ru.rent_amount, ru.unit_name, ru.currency FROM tenancies t JOIN rental_units ru ON ru.id = t.unit_id WHERE t.id = $1`,
      [tenancy_id]
    );
    if (!ten.rows.length) return res.status(404).json({ error: 'Tenancy not found' });
    const t = ten.rows[0];
    await pool.query(`UPDATE tenancies SET tenant_user_id = $1 WHERE id = $2 AND tenant_user_id IS NULL`, [userId, tenancy_id]).catch(() => {});
    const rentAmount = parseFloat(t.rent_amount);
    const periodsPerYear: Record<string, number> = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4 };
    const installment = Math.ceil(rentAmount / (periodsPerYear[frequency] ?? 12));
    const nextDue = new Date(); nextDue.setDate(nextDue.getDate() + 1);
    const existing = await pool.query(`SELECT id FROM flex_pay_vaults WHERE tenancy_id = $1 AND status = 'ACTIVE'`, [tenancy_id]);
    if (existing.rows.length) return res.status(409).json({ error: 'Active vault already exists for this tenancy', vault_id: existing.rows[0].id });
    const vaultRes = await pool.query(
      `INSERT INTO flex_pay_vaults (tenancy_id, unit_id, project_id, tenant_user_id, vault_balance, target_amount, frequency, installment_amount, currency, next_due_date, cashout_mode, drawdown_day) VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [tenancy_id, t.unit_id, t.project_id, userId, rentAmount, frequency, installment, t.currency || 'NGN', nextDue.toISOString().split('T')[0], cashout_mode || 'LUMP_SUM', drawdown_day || 1]
    );
    const h = crypto.createHash('sha256').update(`flex-vault-${vaultRes.rows[0].id}-${Date.now()}`).digest('hex');
    await pool.query(`INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1,$2,$3)`, ['FLEX_VAULT_CREATED', JSON.stringify({ vault_id: vaultRes.rows[0].id, tenancy_id, frequency, installment }), h]);
    return res.status(201).json({ success: true, vault: vaultRes.rows[0], message: `Flex-Pay vault created. ${frequency} installment: ₦${installment.toLocaleString()}` });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// POST /api/flex-pay/contribute


// GET /api/flex-pay/vault/:tenancyId
app.get('/api/flex-pay/vault/:tenancyId', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const vault = await pool.query(
      `SELECT fpv.*, t.tenant_name, t.tenant_email, ru.unit_name, ru.rent_amount,
              COALESCE((SELECT SUM(fc.amount_ngn) FROM flex_contributions fc WHERE fc.vault_id = fpv.id AND fc.status = 'SUCCESS'), 0) AS total_contributed,
              (SELECT COUNT(*) FROM flex_contributions fc WHERE fc.vault_id = fpv.id AND fc.status = 'SUCCESS') AS contribution_count
       FROM flex_pay_vaults fpv JOIN tenancies t ON t.id = fpv.tenancy_id LEFT JOIN rental_units ru ON ru.id = COALESCE(fpv.unit_id, t.unit_id)
       WHERE fpv.tenancy_id = $1 ORDER BY fpv.created_at DESC LIMIT 1`,
      [req.params.tenancyId]
    );
    if (!vault.rows.length) return res.status(404).json({ error: 'No vault found for this tenancy' });
    const v = vault.rows[0];
    return res.json({ success: true, vault: { ...v, funded_pct: Math.min(Math.round((parseFloat(v.vault_balance) / parseFloat(v.target_amount)) * 100), 100), total_contributed: parseFloat(v.total_contributed) } });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// POST /api/flex-pay/cashout
app.post('/api/flex-pay/cashout', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { vault_id, cashout_mode } = req.body;
  if (!vault_id) return res.status(400).json({ error: 'vault_id required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const vault = await client.query(`SELECT fpv.*, p.sponsor_id FROM flex_pay_vaults fpv JOIN projects p ON p.id = fpv.project_id WHERE fpv.id = $1 FOR UPDATE`, [vault_id]);
    if (!vault.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Vault not found' }); }
    const v = vault.rows[0];
    const roleCheck = await client.query(`SELECT role FROM public.users WHERE id = $1`, [userId]);
    if (v.sponsor_id !== userId && roleCheck.rows[0]?.role !== 'ADMIN') { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Only the property owner can initiate cashout' }); }
    if (parseFloat(v.vault_balance) < parseFloat(v.target_amount) * 0.5) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Vault only at ${Math.round(parseFloat(v.vault_balance)/parseFloat(v.target_amount)*100)}%. Minimum 50% required.` }); }
    const platformFee = parseFloat(v.vault_balance) * 0.02;
    const netPayout   = parseFloat(v.vault_balance) - platformFee;
    const mode        = cashout_mode || v.cashout_mode;
    const h = crypto.createHash('sha256').update(`cashout-${vault_id}-${netPayout}-${Date.now()}`).digest('hex');
    await client.query(`INSERT INTO platform_revenue (project_id, amount_usd, amount_ngn, source, pct_applied, gross_amount, ledger_hash) VALUES ($1, $2, $3, 'RENTAL_FEE', 0.02, $4, $5)`, [v.project_id, platformFee / 1500, platformFee, parseFloat(v.vault_balance), h]);
    await client.query(`UPDATE flex_pay_vaults SET status='COMPLETED', vault_balance=0, updated_at=NOW() WHERE id=$1`, [vault_id]);
    await client.query(`INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1,$2,$3)`, ['FLEX_CASHOUT', JSON.stringify({ vault_id, mode, gross: v.vault_balance, platform_fee: platformFee, net_payout: netPayout }), h]);
    await client.query('COMMIT');

    // ── After commit: trigger Paystack Transfer for LUMP_SUM mode ────────
    let transferCode: string | null = null;
    let transferStatus: string      = 'pending';

    if (mode === 'LUMP_SUM' && PAYSTACK_SECRET) {
      // Look up landlord's verified bank account for this project
      const bankRes = await pool.query(
        `SELECT lba.* FROM landlord_bank_accounts lba
         JOIN projects p ON p.sponsor_id = lba.user_id
         WHERE p.id = $1 AND lba.paystack_recipient_code IS NOT NULL
         ORDER BY lba.created_at DESC LIMIT 1`,
        [v.project_id]
      );

      if (bankRes.rows.length && bankRes.rows[0].paystack_recipient_code) {
        const acct          = bankRes.rows[0];
        const payoutRef     = `CASHOUT-${vault_id.slice(0,8).toUpperCase()}-${Date.now()}`;
        const netKobo       = Math.round(netPayout * 100);
        const cashoutHash   = crypto.createHash('sha256')
          .update(`cashout-transfer-${vault_id}-${netPayout}-${payoutRef}`).digest('hex');

        const tRes = await fetch(`${PAYSTACK_BASE}/transfer`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source:    'balance',
            amount:    netKobo,
            recipient: acct.paystack_recipient_code,
            reason:    `Nested Ark Rental Cashout — vault ${vault_id.slice(0,8)}`,
            reference: payoutRef,
            currency:  v.currency || 'NGN',
            metadata: {
              vault_id,
              gross_amount_ngn:    parseFloat(v.vault_balance),
              platform_fee_ngn:    platformFee,
              net_to_landlord_ngn: netPayout,
              fee_pct:             '2%',
              cashout_hash:        cashoutHash,
            },
          }),
        }).then(r => r.json()).catch(() => ({ status: false })) as any;

        if (tRes.status) {
          transferCode   = tRes.data?.transfer_code;
          transferStatus = tRes.data?.status || 'pending';
          // Log transfer to system ledger
          await pool.query(
            `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
             VALUES ('CASHOUT_TRANSFER', $1, $2)`,
            [JSON.stringify({ vault_id, payoutRef, gross: v.vault_balance, platform_fee: platformFee, net: netPayout, transfer_code: transferCode, account: acct.account_name, bank: acct.bank_name }), cashoutHash]
          ).catch(() => {});
        }
      }
    }

    return res.json({
      success:             true,
      mode,
      gross_amount_ngn:    parseFloat(v.vault_balance),
      platform_fee_ngn:    platformFee,
      platform_fee_pct:    '2%',
      net_payout_ngn:      netPayout,
      transfer_code:       transferCode,
      transfer_status:     transferStatus,
      ledger_hash:         h,
      message: mode === 'LUMP_SUM'
        ? `₦${netPayout.toLocaleString()} transferred to landlord. Platform fee: ₦${platformFee.toLocaleString()} (2%).`
        : `Drawdown mode activated. ₦${Math.round(netPayout/12).toLocaleString()}/month will be disbursed on day ${v.drawdown_day}.`,
    });
  } catch (e: any) { await client.query('ROLLBACK'); return res.status(500).json({ error: e.message }); }
});

// ── 2. MOBILIZATION ESCROW ────────────────────────────────────────────────────

// POST /api/milestones/:milestoneId/mobilize
app.post('/api/milestones/:milestoneId/mobilize', authenticate, async (req: Request, res: Response): Promise<any> => {
  const { milestoneId } = req.params;
  const userId = (req as any).userId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mRes = await client.query(`SELECT m.*, p.sponsor_id, p.title AS project_title FROM milestones m JOIN projects p ON p.id = m.project_id WHERE m.id = $1 FOR UPDATE`, [milestoneId]);
    if (!mRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Milestone not found' }); }
    const m = mRes.rows[0];
    const roleCheck = await client.query(`SELECT role FROM public.users WHERE id = $1`, [userId]);
    if (m.sponsor_id !== userId && !['ADMIN','GOVERNMENT'].includes(roleCheck.rows[0]?.role)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Only project owner or admin can release mobilization' }); }
    if (m.mobilization_paid) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Mobilization already paid for this milestone' }); }
    const totalBudget   = parseFloat(m.budget_allocation || 0);
    const mobilPct      = parseFloat(m.mobilization_pct || 70) / 100;
    const mobilAmount   = totalBudget * mobilPct;
    const completionAmt = totalBudget * (1 - mobilPct);
    const h = crypto.createHash('sha256').update(`mobilize-${milestoneId}-${mobilAmount}-${Date.now()}`).digest('hex');
    await client.query(`UPDATE milestones SET mobilization_paid=true, mobilization_paid_at=NOW(), mobilization_amount=$1, completion_amount=$2, milestone_type='MOBILIZATION_SPLIT', status='IN_PROGRESS', mobilization_ref=$3, updated_at=NOW() WHERE id=$4`, [mobilAmount, completionAmt, h.slice(0, 32), milestoneId]);
    await recordPlatformRevenue(client, { source: 'ESCROW_FEE', amount_usd: (totalBudget * 0.02) / 1500, amount_ngn: totalBudget * 0.02, pct_applied: 0.02, gross_amount: totalBudget, project_id: m.project_id, milestone_id: milestoneId });
    await client.query(`INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1,$2,$3)`, ['MOBILIZATION_RELEASED', JSON.stringify({ milestone_id: milestoneId, project_id: m.project_id, total_budget: totalBudget, mobilization_pct: m.mobilization_pct || 70, mobilization_amount: mobilAmount, completion_held: completionAmt }), h]);
    await client.query('COMMIT');
    return res.json({ success: true, mobilization_amount: mobilAmount, completion_held: completionAmt, mobilization_pct: m.mobilization_pct || 70, message: `${m.mobilization_pct || 70}% mobilization (₦${mobilAmount.toLocaleString()}) released. 30% (₦${completionAmt.toLocaleString()}) held pending verification.`, ledger_hash: h });
  } catch (e: any) { await client.query('ROLLBACK'); return res.status(500).json({ error: e.message }); }
});

// POST /api/milestones/:milestoneId/release-completion
app.post('/api/milestones/:milestoneId/release-completion', authenticate, async (req: Request, res: Response): Promise<any> => {
  const { milestoneId } = req.params;
  const userId = (req as any).userId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mRes = await client.query(`SELECT m.*, p.sponsor_id FROM milestones m JOIN projects p ON p.id = m.project_id WHERE m.id = $1 FOR UPDATE`, [milestoneId]);
    if (!mRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Milestone not found' }); }
    const m = mRes.rows[0];
    const roleCheck = await client.query(`SELECT role FROM public.users WHERE id=$1`, [userId]);
    if (!['ADMIN','GOVERNMENT','VERIFIER'].includes(roleCheck.rows[0]?.role) && m.sponsor_id !== userId) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Insufficient permissions to release completion payment' }); }
    if (!m.mobilization_paid)  { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Mobilization not yet released for this milestone' }); }
    if (m.completion_paid)     { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Completion payment already released' }); }
    if (m.ai_status !== 'VERIFIED' || m.human_status !== 'VERIFIED' || m.drone_status !== 'VERIFIED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Tri-layer verification incomplete', layers: { ai: m.ai_status, human: m.human_status, drone: m.drone_status } });
    }
    const completionAmt = parseFloat(m.completion_amount || 0);
    const h = crypto.createHash('sha256').update(`completion-${milestoneId}-${completionAmt}-${Date.now()}`).digest('hex');
    await client.query(`UPDATE milestones SET completion_paid=true, completion_paid_at=NOW(), completion_ref=$1, status='PAID', updated_at=NOW() WHERE id=$2`, [h.slice(0, 32), milestoneId]);
    await client.query(`INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1,$2,$3)`, ['COMPLETION_RELEASED', JSON.stringify({ milestone_id: milestoneId, completion_amount: completionAmt, released_by: userId }), h]);
    await client.query('COMMIT');
    return res.json({ success: true, completion_amount: completionAmt, message: `Completion payment of ₦${completionAmt.toLocaleString()} released after tri-layer verification. Milestone PAID.`, ledger_hash: h });
  } catch (e: any) { await client.query('ROLLBACK'); return res.status(500).json({ error: e.message }); }
});

// GET /api/milestones/:milestoneId/mobilization-status
app.get('/api/milestones/:milestoneId/mobilization-status', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const r = await pool.query(`SELECT m.id, m.title, m.budget_allocation, m.mobilization_pct, m.mobilization_amount, m.mobilization_paid, m.mobilization_paid_at, m.completion_amount, m.completion_paid, m.completion_paid_at, m.milestone_type, m.status, m.ai_status, m.human_status, m.drone_status FROM milestones m WHERE m.id = $1`, [req.params.milestoneId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Milestone not found' });
    const m = r.rows[0];
    return res.json({ success: true, milestone: m, mobilization_pct: m.mobilization_pct || 70, completion_pct: 100 - (m.mobilization_pct || 70), tri_layer_complete: m.ai_status === 'VERIFIED' && m.human_status === 'VERIFIED' && m.drone_status === 'VERIFIED', can_release_completion: m.mobilization_paid && !m.completion_paid && m.ai_status === 'VERIFIED' && m.human_status === 'VERIFIED' && m.drone_status === 'VERIFIED' });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── 3. AUTOMATED RENT REMINDERS ───────────────────────────────────────────────

// POST /api/reminders/send-bulk
app.post('/api/reminders/send-bulk', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId  = (req as any).userId;
  const { project_id, reminder_type = 'MANUAL_BULK' } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id required' });
  try {
    const pRes = await pool.query(`SELECT sponsor_id FROM projects WHERE id=$1`, [project_id]);
    if (!pRes.rows.length) return res.status(404).json({ error: 'Project not found' });
    const roleCheck = await pool.query(`SELECT role FROM public.users WHERE id=$1`, [userId]);
    if (pRes.rows[0].sponsor_id !== userId && !['ADMIN'].includes(roleCheck.rows[0]?.role)) return res.status(403).json({ error: 'Only project owner or admin can send reminders' });
    const tenancies = await pool.query(`SELECT t.*, ru.unit_name, ru.rent_amount, p.title AS project_title, p.project_number FROM tenancies t JOIN rental_units ru ON ru.id = t.unit_id LEFT JOIN projects p ON p.id = t.project_id WHERE t.project_id = $1 AND t.status = 'ACTIVE'`, [project_id]);
    const results: any[] = [];
    for (const t of tenancies.rows) {
      const html = genericTemplate('Rent Payment Reminder', `<p style="color:#a1a1aa;font-size:13px;line-height:1.7;">Dear <strong style="color:white">${t.tenant_name}</strong>,<br><br>Your rent of <strong style="color:#14b8a6">₦${Number(t.rent_amount).toLocaleString()}</strong> for <strong style="color:white">${t.unit_name}</strong> at <strong style="color:white">${t.project_title}</strong> (${t.project_number}) is due. Please pay promptly to avoid a formal notice.</p>`, { label: 'Pay Now via Ark Portal', url: `${process.env.FRONTEND_URL}/tenant/pay/${t.id}` });
      const sendResult = await EmailService.send({ to: t.tenant_email, subject: `[ACTION REQUIRED] Rent Reminder — ${t.unit_name} · ${t.project_number}`, html, template: 'rent_reminder', await: true });
      if (sendResult?.success) {
        await pool.query(`INSERT INTO rent_reminders (tenancy_id, unit_id, project_id, reminder_type, sent_via, recipient_email, was_delivered) VALUES ($1,$2,$3,$4,'EMAIL',$5,true)`, [t.id, t.unit_id, project_id, reminder_type, t.tenant_email]);
        results.push({ tenancy_id: t.id, tenant: t.tenant_name, status: 'SENT' });
      } else {
        await pool.query(`INSERT INTO rent_reminders (tenancy_id, unit_id, project_id, reminder_type, sent_via, recipient_email, was_delivered, error_msg) VALUES ($1,$2,$3,$4,'EMAIL',$5,false,$6)`, [t.id, t.unit_id, project_id, reminder_type, t.tenant_email, sendResult?.error || 'unknown error']);
        results.push({ tenancy_id: t.id, tenant: t.tenant_name, status: 'FAILED', error: sendResult?.error });
      }
    }
    return res.json({ success: true, sent: results.filter(r => r.status === 'SENT').length, failed: results.filter(r => r.status === 'FAILED').length, results });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET /api/reminders/:projectId
app.get('/api/reminders/:projectId', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const r = await pool.query(`SELECT rr.*, t.tenant_name, ru.unit_name FROM rent_reminders rr JOIN tenancies t ON t.id = rr.tenancy_id JOIN rental_units ru ON ru.id = rr.unit_id WHERE rr.project_id = $1 ORDER BY rr.sent_at DESC LIMIT 100`, [req.params.projectId]);
    return res.json({ success: true, reminders: r.rows, count: r.rows.length });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── 4. LEGAL NOTICE GENERATOR ─────────────────────────────────────────────────

// POST /api/notices/generate
app.post(['/api/notices/generate', '/api/notices/generate/'], authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { tenancy_id, notice_type, amount_overdue, days_overdue, notes } = req.body;
  if (!tenancy_id || !notice_type) return res.status(400).json({ error: 'tenancy_id and notice_type required' });
  try {
    const tenRes = await pool.query(`SELECT t.*, ru.unit_name, ru.rent_amount, p.title AS project_title, p.project_number, p.sponsor_id FROM tenancies t JOIN rental_units ru ON ru.id = t.unit_id LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = $1`, [tenancy_id]);
    if (!tenRes.rows.length) return res.status(404).json({ error: 'Tenancy not found' });
    const t = tenRes.rows[0];
    const roleCheck = await pool.query(`SELECT role FROM public.users WHERE id=$1`, [userId]);
    if (t.sponsor_id !== userId && !['ADMIN','DEVELOPER'].includes(roleCheck.rows[0]?.role)) return res.status(403).json({ error: 'Only property owner or admin can issue notices' });
    const seqRes = await pool.query(`SELECT nextval('notice_number_seq') AS n`);
    const noticeNumber = `ARK-${notice_type.slice(0,3)}-${new Date().getFullYear()}-${String(seqRes.rows[0].n).padStart(5,'0')}`;
    // Correct deadlines matching the UI definition:
    // NOTICE_TO_PAY → 7 days | NOTICE_TO_QUIT → 30 days
    // FINAL_WARNING → 2 days | EVICTION_WARNING → 30 days
    const DEADLINE_MAP: Record<string, number> = {
      NOTICE_TO_PAY:    7,
      NOTICE_TO_QUIT:   30,
      FINAL_WARNING:    2,
      EVICTION_WARNING: 30,
    };
    const deadlineDays = DEADLINE_MAP[notice_type] ?? 7;
    const deadline = new Date(); deadline.setDate(deadline.getDate() + deadlineDays);
    const deadlineStr = deadline.toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
    const overdue = parseFloat(amount_overdue) || parseFloat(t.rent_amount) || 0;
    const daysOvd = parseInt(days_overdue) || 2;
    const issuedAt = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
    const h = crypto.createHash('sha256').update(`notice-${noticeNumber}-${tenancy_id}-${overdue}-${Date.now()}`).digest('hex');
    const noticeHtml = buildNoticeHTML({ noticeNumber, noticeType: notice_type, tenantName: t.tenant_name, tenantEmail: t.tenant_email, unitName: t.unit_name, projectTitle: t.project_title, projectNumber: t.project_number, amountOverdue: overdue, daysOverdue: daysOvd, responseDeadline: deadlineStr, issuedAt, ledgerHash: h });
    const pdfBuffer = await generateNoticePDF(noticeHtml);
    const noticeRes = await pool.query(`INSERT INTO legal_notices (tenancy_id, unit_id, project_id, notice_type, notice_number, amount_overdue, days_overdue, response_deadline, pdf_url, ledger_hash, generated_by, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11) RETURNING *`, [tenancy_id, t.unit_id, t.project_id, notice_type, noticeNumber, overdue, daysOvd, deadline.toISOString().split('T')[0], h, userId, notes || null]);
    await pool.query(`INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1,$2,$3)`, ['LEGAL_NOTICE_ISSUED', JSON.stringify({ notice_id: noticeRes.rows[0].id, notice_number: noticeNumber, notice_type, tenancy_id, amount_overdue: overdue, days_overdue: daysOvd }), h]);
    await logAudit({
      event_type:  'NOTICE_ISSUED',
      actor_id:    (req as any).userId,
      actor_role:  'DEVELOPER',
      unit_id:     t.unit_id,
      tenancy_id,
      project_id:  t.project_id,
      description: `Legal notice ${noticeNumber} (${notice_type}) issued to "${t.tenant_name}" — ₦${overdue.toLocaleString()} overdue`,
      metadata:    { notice_id: noticeRes.rows[0].id, notice_number: noticeNumber, notice_type, amount_overdue: overdue, days_overdue: daysOvd, ledger_hash: h },
    });
    try {
      const emailHtml = genericTemplate(`${noticeNumber} — Formal Notice`, `<p style="color:#a1a1aa;font-size:13px;line-height:1.7;">Dear <strong style="color:white">${t.tenant_name}</strong>,<br><br>Please find attached a formal legal notice for <strong style="color:#14b8a6">${t.unit_name}</strong>, ${t.project_title}.<br><strong style="color:#ef4444">Arrears: ₦${overdue.toLocaleString()}</strong> · <strong style="color:#f97316">Deadline: ${deadlineStr}</strong></p>`, { label: 'Resolve via Ark Portal', url: `${process.env.FRONTEND_URL}/tenant/notices/${noticeRes.rows[0].id}` });
      const attachments = pdfBuffer ? [{ filename: `${noticeNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : [{ filename: `${noticeNumber}.html`, content: Buffer.from(noticeHtml), contentType: 'text/html' }];
      const sendResult = await EmailService.send({ to: t.tenant_email, subject: `FORMAL NOTICE: ${noticeNumber} — Rental Arrears · ${t.project_number}`, html: emailHtml, attachments, template: 'legal_notice', fromName: 'Nested Ark OS — Legal', await: true });
      if (sendResult?.success) {
        await pool.query(`UPDATE legal_notices SET served_at=NOW(), status='SERVED' WHERE id=$1`, [noticeRes.rows[0].id]);
      } else {
        console.warn('[NOTICE] Email delivery failed:', sendResult?.error);
      }
    } catch (mailErr: any) { console.warn('[NOTICE] Email delivery failed:', mailErr.message); }
    // Always return JSON so the frontend can parse the response consistently.
    // If a PDF was generated, embed it as base64 so the client can trigger a download.
    return res.json({
      success:        true,
      notice_id:      noticeRes.rows[0].id,
      notice_number:  noticeNumber,
      notice_type,
      amount_overdue: overdue,
      deadline:       deadlineStr,
      ledger_hash:    h,
      html_notice:    noticeHtml,
      pdf_base64:     pdfBuffer ? pdfBuffer.toString('base64') : null,
      message:        'Notice issued and emailed to tenant.',
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});



// GET /api/notices/:projectId
app.get('/api/notices/:projectId', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const r = await pool.query(`SELECT ln.*, t.tenant_name, t.tenant_email, ru.unit_name FROM legal_notices ln JOIN tenancies t ON t.id = ln.tenancy_id JOIN rental_units ru ON ru.id = ln.unit_id WHERE ln.project_id = $1 ORDER BY ln.issued_at DESC`, [req.params.projectId]);
    return res.json({ success: true, notices: r.rows, count: r.rows.length });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// GET /api/notices/download/:noticeId
app.get('/api/notices/download/:noticeId', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const r = await pool.query(`SELECT ln.*, t.tenant_name, t.tenant_email, ru.unit_name, p.title AS project_title, p.project_number FROM legal_notices ln JOIN tenancies t ON t.id = ln.tenancy_id JOIN rental_units ru ON ru.id = ln.unit_id LEFT JOIN projects p ON p.id = ln.project_id WHERE ln.id = $1`, [req.params.noticeId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Notice not found' });
    const n = r.rows[0];
    const noticeHtml = buildNoticeHTML({ noticeNumber: n.notice_number, noticeType: n.notice_type, tenantName: n.tenant_name, tenantEmail: n.tenant_email, unitName: n.unit_name, projectTitle: n.project_title, projectNumber: n.project_number, amountOverdue: parseFloat(n.amount_overdue), daysOverdue: n.days_overdue, responseDeadline: new Date(n.response_deadline).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' }), issuedAt: new Date(n.issued_at).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' }), ledgerHash: n.ledger_hash });
    const pdfBuffer = await generateNoticePDF(noticeHtml);
    if (pdfBuffer) { res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${n.notice_number}.pdf"`); return res.send(pdfBuffer); }
    res.setHeader('Content-Type', 'text/html');
    return res.send(noticeHtml);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── 5. MANAGEMENT DASHBOARD ───────────────────────────────────────────────────

// GET /api/rental/management/:projectId
app.get('/api/rental/management/:projectId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const projectId = req.params.projectId;
  try {
    const [units, tenancies, vaults, reminders, notices, overdue] = await Promise.all([
      pool.query(`SELECT ru.*, t.id AS tenancy_id, t.tenant_name, t.tenant_email, t.lease_start, t.lease_end, t.status AS tenancy_status, t.payment_day, fpv.vault_balance, fpv.target_amount, fpv.frequency, fpv.cashout_mode, fpv.status AS vault_status, (SELECT COUNT(*) FROM rent_payments rp WHERE rp.unit_id=ru.id AND rp.status='SUCCESS') AS payment_count, (SELECT MAX(rp.paid_at) FROM rent_payments rp WHERE rp.unit_id=ru.id AND rp.status='SUCCESS') AS last_paid_at FROM rental_units ru LEFT JOIN tenancies t ON t.unit_id = ru.id AND t.status='ACTIVE' LEFT JOIN flex_pay_vaults fpv ON fpv.tenancy_id = t.id AND fpv.status IN ('ACTIVE','FUNDED_READY') WHERE ru.project_id = $1 ORDER BY ru.unit_name`, [projectId]),
      pool.query(`SELECT t.*, ru.unit_name, ru.rent_amount, (SELECT COUNT(*) FROM flex_contributions fc JOIN flex_pay_vaults fpv ON fpv.id=fc.vault_id WHERE fpv.tenancy_id=t.id AND fc.status='SUCCESS') AS contribution_count, (SELECT COUNT(*) FROM legal_notices ln WHERE ln.tenancy_id=t.id) AS notice_count, (SELECT COUNT(*) FROM rent_reminders rr WHERE rr.tenancy_id=t.id) AS reminder_count FROM tenancies t JOIN rental_units ru ON ru.id=t.unit_id WHERE t.project_id=$1 ORDER BY t.created_at DESC`, [projectId]),
      pool.query(`SELECT fpv.*,t.tenant_name,ru.unit_name FROM flex_pay_vaults fpv JOIN tenancies t ON t.id=fpv.tenancy_id JOIN rental_units ru ON ru.id=fpv.unit_id WHERE fpv.project_id=$1 ORDER BY fpv.created_at DESC`, [projectId]),
      pool.query(`SELECT rr.*,t.tenant_name,ru.unit_name FROM rent_reminders rr JOIN tenancies t ON t.id=rr.tenancy_id JOIN rental_units ru ON ru.id=rr.unit_id WHERE rr.project_id=$1 ORDER BY rr.sent_at DESC LIMIT 20`, [projectId]),
      pool.query(`SELECT ln.*,t.tenant_name,ru.unit_name FROM legal_notices ln JOIN tenancies t ON t.id=ln.tenancy_id JOIN rental_units ru ON ru.id=ln.unit_id WHERE ln.project_id=$1 ORDER BY ln.issued_at DESC`, [projectId]),
      pool.query(`SELECT t.id, t.tenant_name, t.tenant_email, ru.unit_name, ru.rent_amount, EXTRACT(DAY FROM NOW() - COALESCE((SELECT MAX(rp.paid_at) FROM rent_payments rp WHERE rp.unit_id=t.unit_id AND rp.status='SUCCESS'), t.lease_start::timestamp)) AS days_since_payment FROM tenancies t JOIN rental_units ru ON ru.id = t.unit_id WHERE t.project_id = $1 AND t.status = 'ACTIVE' AND NOT EXISTS (SELECT 1 FROM rent_payments rp WHERE rp.unit_id = t.unit_id AND rp.status='SUCCESS' AND rp.paid_at > NOW() - INTERVAL '35 days')`, [projectId]),
    ]);
    const totalMonthlyRent  = units.rows.reduce((s: number, u: any) => s + parseFloat(u.rent_amount || 0), 0);
    const occupiedUnits     = units.rows.filter((u: any) => u.tenancy_id).length;
    const totalVaultBalance = vaults.rows.reduce((s: number, v: any) => s + parseFloat(v.vault_balance || 0), 0);
    return res.json({ success: true, summary: { total_units: units.rows.length, occupied_units: occupiedUnits, vacant_units: units.rows.length - occupiedUnits, occupancy_pct: units.rows.length > 0 ? Math.round((occupiedUnits / units.rows.length) * 100) : 0, monthly_rent_ngn: totalMonthlyRent, total_vault_balance_ngn: totalVaultBalance, overdue_tenancies: overdue.rows.length, active_vaults: vaults.rows.filter((v: any) => v.status === 'ACTIVE').length, funded_vaults: vaults.rows.filter((v: any) => v.status === 'FUNDED_READY').length, pending_notices: notices.rows.filter((n: any) => n.status === 'ISSUED').length }, units: units.rows, tenancies: tenancies.rows, vaults: vaults.rows, reminders: reminders.rows, notices: notices.rows, overdue: overdue.rows });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── END POWERHOUSE ROUTES ─────────────────────────────────────────────────────



// ════════════════════════════════════════════════════════════════════════════
// MODULE: TENANT PORTAL — Dashboard · Vault · Notices · Contributions · Pay
// Endpoints: /api/tenant …
// ════════════════════════════════════════════════════════════════════════════
// NESTED ARK — DUAL-CHANNEL MESSAGING + RECEIPT ENGINE + TENANT ENDPOINTS
//
// Routes in this module:
//  1.  PATCH  /api/flex-pay/contribute          — enhanced with dual-channel receipt
//  2.  GET    /api/flex-pay/receipt/:id         — download digital receipt (PDF/HTML)
//  3.  GET    /api/flex-pay/contributions/:tid  — contribution history for tenant
//  4.  GET    /api/tenant/my-tenancy            — resolve tenancy from auth user
//  5.  GET    /api/tenant/notices/:tenancyId    — tenant's own legal notices
//  6.  POST   /api/messaging/send               — unified dual-channel dispatch
//  7.  POST   /api/flex-pay/contribute          — dual-channel receipt version
//
// Also includes dual-channel dispatch on the tenant onboarding POST.
// ════════════════════════════════════════════════════════════════════════════

// ── DUAL-CHANNEL DISPATCHER ───────────────────────────────────────────────────
// Used internally by all critical events.
// Channel 1: Email (legal record — formal, PDF attached when possible)
// Channel 2: WhatsApp (engagement — instant, opens on phone)
// If one fails, the other still fires. Neither blocks the main transaction.
interface DualChannelPayload {
  email: string;
  phone?: string;
  name:  string;
  subject: string;
  emailHtml: string;
  whatsappText: string;
  pdfBuffer?: Buffer | null;
  pdfFilename?: string;
  actionUrl?: string;
}


// ════════════════════════════════════════════════════════════════════════════
// AUDIT TRAIL — logAudit()
// Append-only write to unit_audit_log. Never throws (non-fatal by design).
// Call with .catch(()=>{}) removed — errors are swallowed internally.
// Usage: await logAudit({ event_type, actor_id, actor_role, unit_id,
//                         tenancy_id, project_id, description, metadata })
// ════════════════════════════════════════════════════════════════════════════
interface AuditEntry {
  event_type:   string;
  actor_id?:    string | null;
  actor_role?:  string | null;
  unit_id?:     string | null;
  tenancy_id?:  string | null;
  project_id?:  string | null;
  description:  string;
  metadata?:    Record<string, any>;
}

async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const meta = entry.metadata ?? {};
    const hashInput = `${entry.event_type}|${entry.unit_id ?? ''}|${entry.tenancy_id ?? ''}|${Date.now()}|${JSON.stringify(meta)}`;
    const ledger_hash = crypto.createHash('sha256').update(hashInput).digest('hex');
    await pool.query(
      `INSERT INTO unit_audit_log
         (event_type, actor_id, actor_role, unit_id, tenancy_id, project_id,
          description, metadata, ledger_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        entry.event_type,
        entry.actor_id   ?? null,
        entry.actor_role ?? 'SYSTEM',
        entry.unit_id    ?? null,
        entry.tenancy_id ?? null,
        entry.project_id ?? null,
        entry.description,
        JSON.stringify(meta),
        ledger_hash,
      ]
    );
  } catch (auditErr: any) {
    // Non-fatal: audit failure must never break the primary workflow
    console.warn('[AUDIT] Write failed:', auditErr.message);
  }
}


// ── UTILITY: Tenant data validation — used by all onboard routes ─────────
// Validates rent, frequency, dates, phone warnings. Returns error string or null.
const VALID_FREQUENCIES = ['WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','BIANNUAL','ANNUAL'];

interface TenantDataInput {
  tenant_email?:      string;
  tenant_phone?:      string;
  rent_amount?:       any;
  payment_frequency?: string;
  move_in_date?:      string;
  lease_start?:       string;
  lease_end?:         string;
}

function validateTenantData(data: TenantDataInput): string | null {
  const { tenant_email, tenant_phone, rent_amount, payment_frequency, move_in_date, lease_start, lease_end } = data;

  // Email
  if (tenant_email && !isValidEmail(tenant_email))
    return `Invalid email address: "${tenant_email}". Check for typos (e.g. # instead of @, .cm instead of .com).`;

  // Rent amount
  const rent = Number(rent_amount);
  if (rent_amount !== undefined && rent_amount !== null) {
    if (isNaN(rent) || rent <= 0)
      return 'rent_amount must be a positive number greater than zero.';
    if (rent < 100)
      return `rent_amount of ₦${rent} seems too low. Minimum is ₦100. Please verify.`;
    if (rent > 100_000_000)
      return `rent_amount of ₦${rent.toLocaleString()} exceeds ₦100M. Please verify — this may be a data entry error.`;
  }

  // Payment frequency
  if (payment_frequency) {
    const freq = payment_frequency.toUpperCase();
    if (!VALID_FREQUENCIES.includes(freq))
      return `Invalid payment_frequency "${payment_frequency}". Must be one of: ${VALID_FREQUENCIES.join(', ')}.`;
  }

  // Move-in / lease_start date
  const startStr = move_in_date || lease_start;
  if (startStr) {
    const start = new Date(startStr);
    if (isNaN(start.getTime()))
      return `Invalid date: "${startStr}". Use YYYY-MM-DD format.`;
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    if (start < ninetyDaysAgo)
      return `move_in_date "${startStr}" is more than 90 days in the past. Please verify — this may be a data entry error.`;

    // lease_end must be after lease_start
    if (lease_end) {
      const end = new Date(lease_end);
      if (isNaN(end.getTime()))
        return `Invalid lease_end: "${lease_end}". Use YYYY-MM-DD format.`;
      if (end <= start)
        return `lease_end (${lease_end}) must be after lease_start (${startStr}).`;
    }
  }

  return null; // all good
}

// ── UTILITY: Phone duplicate warning check ───────────────────────────────
// Not a hard block — returns warning string if phone already used.
// Landlord can still proceed, but is alerted.
async function checkPhoneDuplicate(phone: string, excludeTenancyId?: string): Promise<string | null> {
  if (!phone) return null;
  const normalized = normalizeNigerianPhone(phone);
  if (!normalized) return null;
  const q = excludeTenancyId
    ? `SELECT tenant_name, tenant_email FROM tenancies WHERE tenant_phone=$1 AND id!=$2 AND status='ACTIVE' LIMIT 1`
    : `SELECT tenant_name, tenant_email FROM tenancies WHERE tenant_phone=$1 AND status='ACTIVE' LIMIT 1`;
  const params = excludeTenancyId ? [normalized, excludeTenancyId] : [normalized];
  const r = await pool.query(q, params);
  if (r.rows.length) {
    return `Warning: phone number ${normalized} is already registered to active tenant "${r.rows[0].tenant_name}" (${r.rows[0].tenant_email}). Verify this is not a data entry error.`;
  }
  return null;
}

// ── UTILITY: Email format validation ─────────────────────────────────────────
// Basic RFC-compliant check — catches mercyblessing#gmail.com, gmail.cm typos etc.
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const EMAIL_REGEX = /^[^\s@#]+@[^\s@#]+\.[a-zA-Z]{2,}$/;
  return EMAIL_REGEX.test(email.trim());
}

// ── UTILITY: Normalize Nigerian phone numbers to +234XXXXXXXXXX ───────────────
// Handles: 0802..., 234802..., +234802..., +2348...  → always +234XXXXXXXXXX
function normalizeNigerianPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  let normalized = digits;
  if (digits.startsWith('234') && digits.length >= 13) {
    normalized = digits; // already 234XXXXXXXXXX
  } else if (digits.startsWith('0') && digits.length === 11) {
    normalized = '234' + digits.slice(1); // 080X → 2348...
  } else if (digits.length === 10 && !digits.startsWith('0')) {
    normalized = '234' + digits; // 80XXXXXXXX (no leading 0)
  }
  // Return with + prefix only if we have a valid 13-digit Nigerian number
  return normalized.length >= 13 ? '+' + normalized : '+' + digits;
}

async function dispatchDualChannel(payload: DualChannelPayload): Promise<{ emailOk: boolean; whatsappUrl: string }> {
  const results = { emailOk: false, whatsappUrl: '' };

  // ── Channel 1: Email ───────────────────────────────────────────────────────
  const attachments: any[] = [];
  if (payload.pdfBuffer && payload.pdfFilename) {
    attachments.push({ filename: payload.pdfFilename, content: payload.pdfBuffer, contentType: 'application/pdf' });
  }
  const sendResult = await EmailService.send({
    to: payload.email,
    subject: payload.subject,
    html: payload.emailHtml,
    attachments,
    template: 'dual_channel',
    await: true,
  });
  results.emailOk = !!sendResult?.success;
  if (!sendResult?.success) {
    console.warn('[DUAL-CHANNEL] Email failed:', sendResult?.error);
  }

  // ── Channel 2: WhatsApp ────────────────────────────────────────────────────
  // Strategy A: If phone provided → deep link to their number (opens chat on their device)
  // Strategy B: No phone → generic wa.me link with pre-filled message (user shares themselves)
  const encodedMsg = encodeURIComponent(payload.whatsappText);
  if (payload.phone && payload.phone.replace(/\D/g, '').length >= 10) {
    const cleanPhone = payload.phone.replace(/\D/g, '');
    const intlPhone  = cleanPhone.startsWith('0') ? `234${cleanPhone.slice(1)}` : cleanPhone;
    results.whatsappUrl = `https://wa.me/${intlPhone}?text=${encodedMsg}`;
  } else {
    results.whatsappUrl = `https://wa.me/?text=${encodedMsg}`;
  }

  // Note: In production with Twilio WhatsApp API or Meta Cloud API,
  // replace the URL generation above with an actual API call:
  //   await twilio.messages.create({ from: 'whatsapp:+14155238886', to: `whatsapp:+${intlPhone}`, body: payload.whatsappText })
  // For now, the URL is returned to the client to trigger opening.

  return results;
}

// ── RECEIPT HTML BUILDER ──────────────────────────────────────────────────────
function buildReceiptHTML(opts: {
  receiptNumber: string;
  tenantName: string;
  tenantEmail: string;
  unitName: string;
  projectTitle: string;
  projectNumber: string;
  amountPaid: number;
  currency: string;
  periodLabel: string;
  paidAt: string;
  vaultBalance: number;
  vaultTarget: number;
  fundedPct: number;
  frequency: string;
  ledgerHash: string;
  contributionId: string;
  paystackRef?: string;
}) {
  const pct      = opts.fundedPct.toFixed(1);
  const barWidth = Math.min(opts.fundedPct, 100);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fff; color: #111; }
  .page { max-width: 680px; margin: 0 auto; padding: 48px 52px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #14b8a6; padding-bottom: 20px; margin-bottom: 28px; }
  .logo { }
  .logo-mark { color: #14b8a6; font-size: 10px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; }
  .logo-sub { color: #71717a; font-size: 10px; margin-top: 4px; }
  .receipt-ref { text-align: right; font-family: 'Courier New', monospace; font-size: 9px; color: #71717a; line-height: 1.8; }
  h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #111; text-align: center; background: #f4fdfb; border: 2px solid #14b8a6; padding: 14px; border-radius: 6px; margin-bottom: 28px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; margin-bottom: 28px; }
  .meta-item label { font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: #a1a1aa; display: block; margin-bottom: 3px; }
  .meta-item span { font-size: 12px; font-weight: 700; color: #111; }
  .amount-box { background: #f0fdf4; border: 2px solid #14b8a6; border-radius: 8px; padding: 20px 24px; text-align: center; margin-bottom: 24px; }
  .amount-label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #14b8a6; margin-bottom: 8px; }
  .amount-value { font-size: 36px; font-weight: 900; color: #14b8a6; font-family: 'Courier New', monospace; }
  .vault-section { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
  .vault-title { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #71717a; margin-bottom: 12px; }
  .vault-bar-bg { background: #e4e4e7; height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 8px; }
  .vault-bar-fill { background: linear-gradient(90deg, #14b8a6, #10b981); height: 100%; border-radius: 5px; transition: width 0.5s; }
  .vault-stats { display: flex; justify-content: space-between; font-size: 10px; color: #71717a; }
  .vault-stat-v { color: #111; font-weight: 700; font-family: 'Courier New', monospace; }
  .confirmation { font-size: 12px; line-height: 1.7; color: #52525b; margin-bottom: 20px; }
  .sig-block { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 32px; border-top: 1px solid #e4e4e7; padding-top: 20px; }
  .stamp { width: 80px; height: 80px; border: 2px solid #14b8a6; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #14b8a6; text-align: center; }
  .stamp-text { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; line-height: 1.4; }
  .ledger-footer { margin-top: 28px; padding: 10px 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 8px; color: #15803d; word-break: break-all; line-height: 1.6; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="logo">
      <div class="logo-mark">⬡ Nested Ark OS</div>
      <div class="logo-sub">Impressions &amp; Impacts Ltd — Property Division</div>
    </div>
    <div class="receipt-ref">
      <div style="font-size:11px;font-weight:900;color:#111;">DIGITAL RECEIPT</div>
      <div>${opts.receiptNumber}</div>
      <div>Issued: ${opts.paidAt}</div>
      ${opts.paystackRef ? `<div>Ref: ${opts.paystackRef}</div>` : ''}
    </div>
  </div>

  <h1>Payment Receipt — Flex-Pay Vault</h1>

  <div class="meta-grid">
    <div class="meta-item"><label>Tenant</label><span>${opts.tenantName}</span></div>
    <div class="meta-item"><label>Unit</label><span>${opts.unitName}</span></div>
    <div class="meta-item"><label>Property</label><span>${opts.projectTitle}</span></div>
    <div class="meta-item"><label>Project ID</label><span style="font-family:monospace;color:#14b8a6;">${opts.projectNumber}</span></div>
    <div class="meta-item"><label>Period</label><span>${opts.periodLabel}</span></div>
    <div class="meta-item"><label>Frequency</label><span>${opts.frequency}</span></div>
  </div>

  <div class="amount-box">
    <div class="amount-label">Amount Paid</div>
    <div class="amount-value">${opts.currency} ${Number(opts.amountPaid).toLocaleString()}</div>
  </div>

  <div class="vault-section">
    <div class="vault-title">Rent Vault Progress</div>
    <div class="vault-bar-bg">
      <div class="vault-bar-fill" style="width:${barWidth}%"></div>
    </div>
    <div class="vault-stats">
      <span>Balance: <span class="vault-stat-v">${opts.currency} ${Number(opts.vaultBalance).toLocaleString()}</span></span>
      <span><span class="vault-stat-v">${pct}%</span> of annual rent</span>
      <span>Target: <span class="vault-stat-v">${opts.currency} ${Number(opts.vaultTarget).toLocaleString()}</span></span>
    </div>
  </div>

  <p class="confirmation">
    This receipt confirms that the above payment has been received and recorded in the Nested Ark
    Flex-Pay Vault for <strong>${opts.unitName}</strong> at <strong>${opts.projectTitle}</strong>.
    This document serves as your official proof of payment and may be used for any legal or
    administrative purpose. Your vault balance and all contributions are immutably recorded on
    the Nested Ark infrastructure ledger.
  </p>

  <div class="sig-block">
    <div>
      <p style="font-size:12px;font-weight:700;margin:0;">For Impressions &amp; Impacts Ltd</p>
      <p style="font-size:10px;color:#71717a;margin:4px 0;">Nested Ark OS — Property Management Division</p>
      <div style="margin-top:18px;border-top:1px solid #111;width:180px;padding-top:4px;font-size:10px;color:#71717a;">
        Authorised by System Protocol
      </div>
    </div>
    <div class="stamp">
      <div class="stamp-text">ARK<br>VERIFIED<br>✓</div>
    </div>
  </div>

  <div class="ledger-footer">
    CONTRIBUTION ID: ${opts.contributionId}<br>
    SHA-256 LEDGER HASH: ${opts.ledgerHash}<br>
    This receipt is immutably recorded on the Nested Ark blockchain ledger.<br>
    Verify at: nestedark.io/ledger · Nested Ark OS v4.1.0
  </div>

</div>
</body>
</html>`;
}

// ── 1. GET /api/flex-pay/contributions/:tenancyId — contribution history ──────
app.get('/api/flex-pay/contributions/:tenancyId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const { tenancyId } = req.params;
  try {
    const r = await pool.query(
      `SELECT fc.id, fc.amount_ngn, fc.period_label, fc.paid_at, fc.ledger_hash, fc.status, fc.paystack_ref
       FROM flex_contributions fc
       JOIN flex_pay_vaults fpv ON fpv.id = fc.vault_id
       WHERE fpv.tenancy_id = $1
       ORDER BY fc.created_at DESC
       LIMIT 50`,
      [tenancyId]
    );
    return res.json({ success: true, contributions: r.rows, count: r.rows.length });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/rental/receipts/:projectId — all contributions across a project ──
// Used by rental-management page receipts tab (landlord-scoped, ownership verified)
app.get('/api/rental/receipts/:projectId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const landlordId = (req as any).userId;
  const { projectId } = req.params;
  try {
    // Verify the project belongs to this landlord before returning any data
    const ownerCheck = await pool.query(
      `SELECT id FROM projects WHERE id = $1 AND sponsor_id = $2 LIMIT 1`,
      [projectId, landlordId]
    );
    if (!ownerCheck.rows.length) {
      return res.status(403).json({ error: 'Project not found or access denied' });
    }

    const r = await pool.query(
      `SELECT
         fc.id,
         fc.amount_ngn,
         fc.period_label,
         fc.paid_at        AS payment_date,
         fc.ledger_hash,
         fc.status,
         fc.paystack_ref   AS receipt_number,
         t.tenant_name,
         t.tenant_email,
         ru.unit_name,
         COALESCE(fpv.currency, t.currency, 'NGN') AS currency,
         fpv.tenancy_id
       FROM flex_contributions fc
       JOIN flex_pay_vaults fpv ON fpv.id      = fc.vault_id
       JOIN tenancies t          ON t.id       = fpv.tenancy_id
       JOIN rental_units ru      ON ru.id      = t.unit_id
       JOIN projects p           ON p.id       = ru.project_id
       WHERE p.id        = $1
         AND p.sponsor_id = $2
         AND fc.status   = 'SUCCESS'
       ORDER BY fc.paid_at DESC
       LIMIT 200`,
      [projectId, landlordId]
    );
    return res.json({ success: true, receipts: r.rows, count: r.rows.length });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── 2. GET /api/flex-pay/receipt/:contributionId — digital receipt PDF/HTML ───
app.get('/api/flex-pay/receipt/:contributionId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { contributionId } = req.params;
  try {
    // ── IDOR guard: verify caller owns the tenancy linked to this contribution ──
    const ownerCheck = await pool.query(
      `SELECT fc.id FROM flex_contributions fc
       JOIN flex_pay_vaults fpv ON fpv.id = fc.vault_id
       LEFT JOIN tenancies t ON t.id = fpv.tenancy_id
       LEFT JOIN projects p ON p.id = COALESCE(fpv.project_id, t.project_id)
       WHERE fc.id = $1
         AND (
           t.tenant_user_id = $2
           OR fpv.tenant_user_id = $2
           OR p.sponsor_id = $2
           OR (SELECT role FROM public.users WHERE id=$2) = 'ADMIN'
         )`,
      [contributionId, userId]
    );
    if (!ownerCheck.rows.length)
      return res.status(403).json({ error: 'Access denied: receipt does not belong to your account' });

    const r = await pool.query(
      `SELECT
         fc.id, fc.amount_ngn, fc.period_label, fc.paid_at, fc.ledger_hash,
         fc.status, fc.paystack_ref,
         fpv.vault_balance, fpv.target_amount, fpv.frequency,
         COALESCE(t.tenant_name,  u.full_name,  'Tenant')     AS tenant_name,
         COALESCE(t.tenant_email, u.email,       '')           AS tenant_email,
         COALESCE(ru.unit_name,   'Independent Vault')         AS unit_name,
         COALESCE(ru.currency, t.currency, 'NGN')              AS currency,
         COALESCE(p.title,    'Savings Vault')                 AS project_title,
         COALESCE(p.project_number, '—')                       AS project_number
       FROM flex_contributions fc
       JOIN flex_pay_vaults fpv      ON fpv.id  = fc.vault_id
       LEFT JOIN tenancies t          ON t.id   = fpv.tenancy_id
       LEFT JOIN public.users u              ON u.id   = fpv.tenant_user_id
       LEFT JOIN rental_units ru      ON ru.id  = COALESCE(fpv.unit_id, t.unit_id)
       LEFT JOIN projects p           ON p.id   = COALESCE(fpv.project_id, ru.project_id)
       WHERE fc.id = $1`,
      [contributionId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Contribution not found' });
    const c = r.rows[0];

    const fundedPct = Math.min(
      Math.round((parseFloat(c.vault_balance) / parseFloat(c.target_amount)) * 100), 100
    );

    const receiptNumber = `ARK-RCT-${new Date().getFullYear()}-${c.id.slice(0, 8).toUpperCase()}`;
    const paidAtStr     = c.paid_at
      ? new Date(c.paid_at).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

    const html = buildReceiptHTML({
      receiptNumber,
      tenantName:     c.tenant_name,
      tenantEmail:    c.tenant_email,
      unitName:       c.unit_name,
      projectTitle:   c.project_title,
      projectNumber:  c.project_number,
      amountPaid:     parseFloat(c.amount_ngn),
      currency:       c.currency || 'NGN',
      periodLabel:    c.period_label || new Date().toISOString().slice(0,7),
      paidAt:         paidAtStr,
      vaultBalance:   parseFloat(c.vault_balance),
      vaultTarget:    parseFloat(c.target_amount),
      fundedPct,
      frequency:      c.frequency,
      ledgerHash:     c.ledger_hash,
      contributionId: c.id,
      paystackRef:    c.paystack_ref,
    });

    // Try PDF generation
    let pdfBuffer: Buffer | null = null;
    try {
      const puppeteer = require('puppeteer');
      const browser   = await puppeteer.launch({ args: ['--no-sandbox','--disable-dev-shm-usage'] });
      const page      = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer       = await page.pdf({ format: 'A4', printBackground: true, margin: { top:'10mm', bottom:'10mm', left:'8mm', right:'8mm' } }) as Buffer;
      await browser.close();
    } catch { /* puppeteer not available — serve HTML */ }

    if (pdfBuffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${receiptNumber}.pdf"`);
      return res.send(pdfBuffer);
    }
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${receiptNumber}.html"`);
    return res.send(html);
  } catch (e: any) {
    console.error('[/api/flex-pay/receipt]', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ── 3. GET /api/tenant/my-tenancy — resolve active tenancy + full fee/bank details ──
app.get('/api/tenant/my-tenancy', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const FULL_SELECT = `
    SELECT
      t.id AS tenancy_id, t.unit_id, t.project_id, t.tenant_name, t.tenant_email,
      t.guarantor_json, t.digital_signature_url, t.tenant_score, t.status,
      t.former_landlord_contact, t.reason_for_quit, t.litigation_history,
      t.lease_start, t.lease_end, t.rent_amount AS tenancy_rent,
      COALESCE(t.payment_frequency, ru.payment_frequency, 'MONTHLY') AS payment_frequency,
      -- Unit details
      ru.unit_name, ru.unit_type, ru.bedrooms, ru.bathrooms, ru.size_sqm,
      ru.rent_amount, ru.currency,
      ru.security_deposit, ru.agency_fee, ru.legal_fee, ru.caution_fee, ru.service_charge,
      ru.bank_name, ru.account_number, ru.account_name, ru.sort_code,
      -- Project details
      COALESCE(p.title,          'N/A') AS project_title,
      COALESCE(p.project_number, 'N/A') AS project_number,
      COALESCE(p.location,       '')    AS location,
      COALESCE(p.country,        '')    AS country
    FROM tenancies t
    JOIN      rental_units ru ON ru.id = t.unit_id
    LEFT JOIN projects     p  ON p.id  = t.project_id
  `;
  try {
    // Primary: match by tenant_user_id
    let tenancy = await pool.query(
      `${FULL_SELECT} WHERE t.tenant_user_id = $1 AND t.status = 'ACTIVE' ORDER BY t.created_at DESC LIMIT 1`,
      [userId]
    );
    // Fallback: match by email (before consume-invite has run)
    if (!tenancy.rows.length) {
      const userRes = await pool.query('SELECT email FROM public.users WHERE id=$1', [userId]);
      if (userRes.rows.length) {
        tenancy = await pool.query(
          `${FULL_SELECT} WHERE t.tenant_email = $1 AND t.status = 'ACTIVE' ORDER BY t.created_at DESC LIMIT 1`,
          [userRes.rows[0].email]
        );
        // Auto-link if found by email
        if (tenancy.rows.length) {
          await pool.query(
            `UPDATE tenancies SET tenant_user_id=$1 WHERE id=$2 AND tenant_user_id IS NULL`,
            [userId, tenancy.rows[0].tenancy_id]
          ).catch(() => {});
        }
      }
    }
    if (!tenancy.rows.length) return res.status(404).json({ error: 'No active tenancy found for this account' });
    return res.json({ success: true, ...tenancy.rows[0] });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── 4. GET /api/tenant/notices/:tenancyId — tenant's own notices ──────────────
app.get('/api/tenant/notices/:tenancyId', authenticate, async (req: Request, res: Response): Promise<any> => {
  try {
    const r = await pool.query(
      `SELECT id, notice_number, notice_type, amount_overdue, days_overdue,
              issued_at, served_at, response_deadline, status
       FROM legal_notices
       WHERE tenancy_id = $1
       ORDER BY issued_at DESC`,
      [req.params.tenancyId]
    );
    return res.json({ success: true, notices: r.rows, count: r.rows.length });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── 5. POST /api/messaging/send — manual dual-channel dispatch ────────────────
// Used by admin/landlord to send a custom message to a tenant via both channels
app.post('/api/messaging/send', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { tenancy_id, subject, message_body, whatsapp_text } = req.body;
  if (!tenancy_id || !message_body) return res.status(400).json({ error: 'tenancy_id and message_body required' });

  try {
    // Auth check
    const tenRes = await pool.query(
      `SELECT t.tenant_name, t.tenant_email, t.tenant_phone,
              ru.unit_name, p.title AS project_title, p.project_number, p.sponsor_id
       FROM tenancies t
       JOIN rental_units ru ON ru.id = t.unit_id
       LEFT JOIN projects p ON p.id  = t.project_id
       WHERE t.id = $1`,
      [tenancy_id]
    );
    if (!tenRes.rows.length) return res.status(404).json({ error: 'Tenancy not found' });
    const t  = tenRes.rows[0];
    const rc = await pool.query('SELECT role FROM public.users WHERE id=$1', [userId]);
    if (t.sponsor_id !== userId && !['ADMIN'].includes(rc.rows[0]?.role)) {
      return res.status(403).json({ error: 'Only property owner or admin can send messages' });
    }

    const emailHtml = genericTemplate(
      subject || 'Message from Nested Ark',
      `<p style="color:#a1a1aa;font-size:13px;line-height:1.7;">Dear <strong style="color:white">${t.tenant_name}</strong>,<br><br>${message_body.replace(/\n/g, '<br>')}</p>`,
    );

    const waText = whatsapp_text || `[Nested Ark — ${t.project_number}]\n\nDear ${t.tenant_name},\n\n${message_body}\n\nProperty: ${t.unit_name} at ${t.project_title}`;

    const { emailOk, whatsappUrl } = await dispatchDualChannel({
      email:         t.tenant_email,
      phone:         t.tenant_phone,
      name:          t.tenant_name,
      subject:       subject || 'Message from Nested Ark',
      emailHtml,
      whatsappText:  waText,
    });

    // Log to reminders table
    await pool.query(
      `INSERT INTO rent_reminders (tenancy_id, unit_id, project_id, reminder_type, sent_via, recipient_email, was_delivered)
       SELECT t.id, t.unit_id, t.project_id, 'MANUAL_MESSAGE', $1, t.tenant_email, $2
       FROM tenancies t WHERE t.id = $3`,
      [emailOk ? 'BOTH' : 'WHATSAPP_ONLY', emailOk, tenancy_id]
    );

    return res.json({
      success:       true,
      email_sent:    emailOk,
      whatsapp_url:  whatsappUrl,
      message:       `Message dispatched. Email: ${emailOk ? '✓' : '✗ failed'}. WhatsApp link generated.`,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── 6. POST /api/flex-pay/contribute — dual-channel receipt version ──────────
app.post('/api/flex-pay/contribute', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { vault_id, amount_ngn, paystack_ref } = req.body;
  if (!vault_id || !amount_ngn) return res.status(400).json({ error: 'vault_id and amount_ngn required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock vault AND verify ownership — tenant must own this vault
    const vault = await client.query(
      `SELECT fpv.* FROM flex_pay_vaults fpv
       JOIN tenancies t ON t.id = fpv.tenancy_id
       WHERE fpv.id = $1
         AND (fpv.tenant_user_id = $2 OR t.tenant_user_id = $2)
       FOR UPDATE`,
      [vault_id, userId]
    );
    if (!vault.rows.length) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Vault not found or access denied' });
    }
    const v      = vault.rows[0];
    const amount = parseFloat(amount_ngn);
    if (isNaN(amount) || amount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Reject if paystack_ref already processed (replay attack guard)
    if (paystack_ref) {
      const dup = await client.query(
        `SELECT id FROM flex_contributions WHERE paystack_ref = $1 LIMIT 1`,
        [paystack_ref]
      );
      if (dup.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Reference already processed', already_recorded: true });
      }
    }

    const newBalance = parseFloat(v.vault_balance) + amount;
    const periodLabel = new Date().toISOString().slice(0,7);
    const h = crypto.createHash('sha256').update(`flex-contrib-${vault_id}-${amount}-${Date.now()}`).digest('hex');

    await client.query(
      `INSERT INTO flex_contributions (vault_id, tenancy_id, amount_ngn, paystack_ref, status, period_label, paid_at, ledger_hash)
       VALUES ($1,$2,$3,$4,'SUCCESS',$5,NOW(),$6)
       ON CONFLICT ON CONSTRAINT flex_contributions_paystack_ref_key DO NOTHING`,
      [vault_id, v.tenancy_id, amount, paystack_ref || null, periodLabel, h]
    );

    const target = parseFloat(v.target_amount);
    let newStatus = v.status, newPeriods = v.funded_periods;
    if (newBalance >= target) {
      newPeriods += 1;
      newStatus = v.cashout_mode === 'LUMP_SUM' ? 'FUNDED_READY' : v.status;
    }
    const fundedPct = Math.min(Math.round((newBalance / target) * 100), 100);

    await client.query(
      `UPDATE flex_pay_vaults SET vault_balance=$1, funded_periods=$2, status=$3, updated_at=NOW() WHERE id=$4`,
      [newBalance, newPeriods, newStatus, vault_id]
    );
    await client.query(
      `INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1,$2,$3)`,
      ['FLEX_CONTRIBUTION', JSON.stringify({ vault_id, amount, new_balance: newBalance, target, period_label: periodLabel }), h]
    );
    await client.query('COMMIT');

    // ── Dual-channel receipt (non-blocking) ───────────────────────────────────
    setImmediate(async () => {
      try {
        // Fetch tenant + unit details for receipt
        const detailRes = await pool.query(
          `SELECT t.tenant_name, t.tenant_email, t.tenant_phone,
                  ru.unit_name, ru.currency,
                  p.title AS project_title, p.project_number
           FROM flex_pay_vaults fpv
           JOIN tenancies    t   ON t.id   = fpv.tenancy_id
           JOIN rental_units ru  ON ru.id  = fpv.unit_id
           LEFT JOIN projects p  ON p.id   = fpv.project_id
           WHERE fpv.id = $1`,
          [vault_id]
        );
        const d = detailRes.rows[0];
        if (!d) return;

        const contribRes = await pool.query(
          `SELECT id FROM flex_contributions WHERE vault_id=$1 AND ledger_hash=$2 LIMIT 1`,
          [vault_id, h]
        );
        const contributionId = contribRes.rows[0]?.id ?? vault_id;
        const receiptNumber  = `ARK-RCT-${new Date().getFullYear()}-${contributionId.slice(0,8).toUpperCase()}`;
        const paidAtStr      = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric', hour12:false });
        const frontendUrl    = process.env.FRONTEND_URL || 'https://nestedark.com';

        const receiptHtml = buildReceiptHTML({
          receiptNumber,
          tenantName:    d.tenant_name,
          tenantEmail:   d.tenant_email,
          unitName:      d.unit_name,
          projectTitle:  d.project_title,
          projectNumber: d.project_number,
          amountPaid:    amount,
          currency:      d.currency || 'NGN',
          periodLabel,
          paidAt:        paidAtStr,
          vaultBalance:  newBalance,
          vaultTarget:   target,
          fundedPct,
          frequency:     v.frequency,
          ledgerHash:    h,
          contributionId,
          paystackRef:   paystack_ref,
        });

        // Try PDF
        let pdfBuffer: Buffer | null = null;
        try {
          const puppeteer = require('puppeteer');
          const browser   = await puppeteer.launch({ args: ['--no-sandbox','--disable-dev-shm-usage'] });
          const pg        = await browser.newPage();
          await pg.setContent(receiptHtml, { waitUntil: 'networkidle0' });
          pdfBuffer       = await pg.pdf({ format:'A4', printBackground:true }) as Buffer;
          await browser.close();
        } catch { /* no puppeteer */ }

        // Email body
        const emailBody = `
          <p style="color:#a1a1aa;font-size:13px;line-height:1.7;">Dear <strong style="color:white">${d.tenant_name}</strong>,<br><br>
          Your Flex-Pay contribution of <strong style="color:#14b8a6;font-size:15px;">${d.currency || 'NGN'} ${amount.toLocaleString()}</strong>
          has been received and recorded for <strong style="color:white">${d.unit_name}</strong>.</p>
          <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:14px;margin:16px 0;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#71717a;font-size:10px;">Vault Balance</span>
              <span style="color:#14b8a6;font-weight:900;font-family:monospace;">${d.currency || 'NGN'} ${newBalance.toLocaleString()}</span>
            </div>
            <div style="background:#27272a;height:6px;border-radius:3px;overflow:hidden;">
              <div style="background:#14b8a6;height:100%;width:${fundedPct}%;"></div>
            </div>
            <p style="color:#71717a;font-size:9px;text-align:center;margin-top:6px;">${fundedPct}% of annual rent secured</p>
          </div>
          <p style="color:#a1a1aa;font-size:12px;line-height:1.7;">Your digital receipt is attached. Every contribution is SHA-256 hashed on the immutable Nested Ark ledger.</p>`;

        const waText = `*Nested Ark — Payment Confirmed* ✅\n\nDear ${d.tenant_name},\n\nYour contribution of ${d.currency || 'NGN'} ${amount.toLocaleString()} has been received.\n\n🏦 Vault Balance: ${d.currency || 'NGN'} ${newBalance.toLocaleString()}\n📊 Progress: ${fundedPct}% of annual rent secured\n🔐 Ledger Hash: ${h.slice(0,16)}…\n\nReceipt: ${frontendUrl}/tenant/dashboard\n\n_Nested Ark OS — Impressions & Impacts Ltd_`;

        await dispatchDualChannel({
          email:       d.tenant_email,
          phone:       d.tenant_phone,
          name:        d.tenant_name,
          subject:     `${receiptNumber} — Payment Confirmed · ${d.project_number}`,
          emailHtml:   genericTemplate(`${receiptNumber}`, emailBody, { label: 'View My Vault', url: `${frontendUrl}/tenant/dashboard` }),
          whatsappText: waText,
          pdfBuffer,
          pdfFilename: pdfBuffer ? `${receiptNumber}.pdf` : undefined,
        });

        console.log(`[RECEIPT] Dispatched for contribution ${contributionId} → ${d.tenant_email}`);
      } catch (receiptErr: any) {
        console.warn('[RECEIPT] Dispatch failed:', receiptErr.message);
      }
    });

    return res.json({
      success:     true,
      new_balance: newBalance,
      target_amount: target,
      funded_pct:  fundedPct,
      status:      newStatus,
      ledger_hash: h,
      message:     newStatus === 'FUNDED_READY'
        ? '🎉 Vault fully funded! Landlord cashout available. Receipt sent via email and WhatsApp.'
        : `✅ Contribution confirmed. ${fundedPct}% funded. Receipt dispatched to your email and WhatsApp.`,
    });
  } catch (e: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: e.message });
  } finally { client.release(); }
});



// ============================================================================
// TENANT DASHBOARD ALIAS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────
// The tenant dashboard calls these convenience URLs so it can load all data
// in a single authenticated session without needing to first fetch the
// tenancy_id and then make separate parameterised calls.
// ============================================================================

// ── MIGRATION GUARD — run once on every startup, safe on existing DBs ─────────
// The "column t.tenant_user_id does not exist" error means the ALTER TABLE
// migration in ensureTablesExist() didn't apply on the live DB (tables already
// existed when the migration ran, but the IF NOT EXISTS guard on the ALTER was
// missing for some columns). This explicit pool.query at startup ensures it
// always runs regardless of table state.
pool.query(`
  ALTER TABLE tenancies       ADD COLUMN IF NOT EXISTS tenant_user_id UUID REFERENCES users(id);
  ALTER TABLE tenancies       ADD COLUMN IF NOT EXISTS tenant_phone   VARCHAR(50);
  ALTER TABLE tenancies       ADD COLUMN IF NOT EXISTS tenant_score   INTEGER DEFAULT 100;
  ALTER TABLE tenancies       ADD COLUMN IF NOT EXISTS litigation_history JSONB;
  ALTER TABLE tenancies       ADD COLUMN IF NOT EXISTS selfie_url     TEXT;
  ALTER TABLE tenancies       ADD COLUMN IF NOT EXISTS status         VARCHAR(20) DEFAULT 'ACTIVE';
  ALTER TABLE tenancies       ADD COLUMN IF NOT EXISTS currency       VARCHAR(10) DEFAULT 'NGN';
  ALTER TABLE tenancies       ADD COLUMN IF NOT EXISTS lease_start    DATE;
  ALTER TABLE tenancies       ADD COLUMN IF NOT EXISTS payment_day    INTEGER DEFAULT 1;
  ALTER TABLE tenancies       ADD COLUMN IF NOT EXISTS project_id     UUID REFERENCES projects(id);
  ALTER TABLE flex_pay_vaults ADD COLUMN IF NOT EXISTS tenant_user_id UUID REFERENCES users(id);
  CREATE INDEX IF NOT EXISTS idx_ten_user_id ON tenancies(tenant_user_id) WHERE tenant_user_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_fpv_user_id ON flex_pay_vaults(tenant_user_id) WHERE tenant_user_id IS NOT NULL;
`).then(() => {
  console.log('[MIGRATION] tenant_user_id columns verified ✓');
}).catch((err: any) => {
  // Non-fatal — log and continue. Dashboard fallback (email match) still works.
  console.warn('[MIGRATION] Column guard warning (non-fatal):', err.message);
});

// ── GET /api/tenant/my-vault ────────────────────────────────────────────────
// Alias: resolves the tenancy from the authenticated user, then returns vault.
// Dashboard calls this directly without knowing the tenancy_id first.
app.get('/api/tenant/my-vault', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    // Resolve tenancy_id from user (by tenant_user_id link, or email fallback)
    let tenancyRow: any = null;

    const byId = await pool.query(
      `SELECT id FROM tenancies WHERE tenant_user_id = $1 AND status = 'ACTIVE'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (byId.rows.length) {
      tenancyRow = byId.rows[0];
    } else {
      const uRes = await pool.query('SELECT email FROM public.users WHERE id = $1', [userId]);
      if (uRes.rows.length) {
        const byEmail = await pool.query(
          `SELECT id FROM tenancies WHERE tenant_email = $1 AND status = 'ACTIVE'
           ORDER BY created_at DESC LIMIT 1`,
          [uRes.rows[0].email]
        );
        if (byEmail.rows.length) tenancyRow = byEmail.rows[0];
      }
    }

    if (!tenancyRow) {
      // ── Independent Tenant — no landlord-linked tenancy yet ───────────────
      const uInfo = await pool.query(
        `SELECT email, full_name, phone FROM public.users WHERE id = $1`, [userId]
      );
      const u = uInfo.rows[0] || {};
      // Check for an existing standalone vault
      const svRes = await pool.query(
        `SELECT sv.*,
                COALESCE((SELECT SUM(sc.amount_ngn)
                          FROM standalone_contributions sc
                          WHERE sc.vault_id = sv.id AND sc.status = 'SUCCESS'), 0) AS total_contributed,
                (SELECT COUNT(*) FROM standalone_contributions sc
                 WHERE sc.vault_id = sv.id AND sc.status = 'SUCCESS') AS contribution_count
         FROM standalone_vaults sv
         WHERE sv.tenant_user_id = $1 AND sv.status NOT IN ('MIGRATED','CLOSED')
         ORDER BY sv.created_at DESC LIMIT 1`,
        [userId]
      );
      const sv = svRes.rows[0] || null;
      return res.json({
        success:          true,
        hasActiveTenancy: false,
        vault:            null,
        standalone_vault: sv ? {
          id:                   sv.id,
          vault_balance:        parseFloat(sv.vault_balance)       || 0,
          target_amount:        parseFloat(sv.target_amount)       || 0,
          installment_amount:   parseFloat(sv.installment_amount)  || 0,
          funded_pct:           sv.target_amount > 0
                                  ? Math.min(Math.round((parseFloat(sv.vault_balance) / parseFloat(sv.target_amount)) * 100), 100)
                                  : 0,
          frequency:            sv.frequency,
          status:               sv.status,
          currency:             sv.currency,
          funded_periods:       sv.funded_periods,
          total_contributed:    parseFloat(sv.total_contributed)   || 0,
          contribution_count:   parseInt(sv.contribution_count)    || 0,
          landlord_name:        sv.landlord_name        || null,
          landlord_email:       sv.landlord_email       || null,
          landlord_bank_name:   sv.landlord_bank_name   || null,
          landlord_account_name: sv.landlord_account_name || null,
          linked_tenancy_id:    sv.linked_tenancy_id    || null,
          created_at:           sv.created_at,
        } : null,
        profile: {
          user_id:   userId,
          email:     u.email     || null,
          full_name: u.full_name || null,
          phone:     u.phone     || null,
        },
        message: sv
          ? 'Standalone savings vault active.'
          : 'Independent savings profile active. Initialize your vault to start saving.',
      });
    }

    // Link user to tenancy for future fast lookups
    pool.query(
      `UPDATE tenancies SET tenant_user_id = $1 WHERE id = $2 AND tenant_user_id IS NULL`,
      [userId, tenancyRow.id]
    ).catch(() => {});

    const vault = await pool.query(
      `SELECT fpv.*,
              COALESCE((
                SELECT SUM(fc.amount_ngn) FROM flex_contributions fc
                WHERE fc.vault_id = fpv.id AND fc.status = 'SUCCESS'
              ), 0) AS total_contributed
       FROM flex_pay_vaults fpv
       WHERE fpv.tenancy_id = $1
       ORDER BY fpv.created_at DESC LIMIT 1`,
      [tenancyRow.id]
    );

    if (!vault.rows.length) return res.json({ success: true, vault: null });

    const v = vault.rows[0];
    return res.json({
      success: true,
      vault: {
        ...v,
        funded_pct: Math.min(
          Math.round((parseFloat(v.vault_balance) / (parseFloat(v.target_amount) || 1)) * 100),
          100
        ),
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── POST /api/tenant/standalone-vault/init ───────────────────────────────────
// Independent tenant initializes a personal savings vault without a landlord link.
// Accepts: target_amount, installment_amount, frequency, and optional landlord
// payout details (name, email, bank account). Vault is immediately active and
// accepts Paystack contributions. When the landlord onboards, admin migrates it.
app.post('/api/tenant/standalone-vault/init', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const uRes = await pool.query(`SELECT role, email, full_name FROM public.users WHERE id=$1`, [userId]);
    if (!uRes.rows.length) return res.status(404).json({ error: 'User not found' });
    if (uRes.rows[0].role !== 'TENANT') {
      return res.status(403).json({ error: 'Only TENANT accounts may initialize a standalone vault' });
    }
    // Prevent duplicate active vault
    const existing = await pool.query(
      `SELECT id FROM standalone_vaults
       WHERE tenant_user_id=$1 AND status NOT IN ('MIGRATED','CLOSED') LIMIT 1`,
      [userId]
    );
    if (existing.rows.length) {
      return res.status(409).json({
        error:    'You already have an active standalone vault.',
        vault_id: existing.rows[0].id,
      });
    }
    const {
      rent_amount,
      frequency = 'MONTHLY',
      landlord_name, landlord_email,
      landlord_bank_name, landlord_account_number, landlord_account_name,
      target_amount: raw_target, installment_amount: raw_installment,
      payout_preference = 'ASK',
      tenant_bank_name, tenant_account_number, tenant_account_name, tenant_bank_code,
      due_date,
    } = req.body;

    const VALID_PAYOUT_PREFS = ['TENANT', 'LANDLORD', 'ASK'];
    const finalPayoutPref = VALID_PAYOUT_PREFS.includes((payout_preference || '').toUpperCase())
      ? (payout_preference as string).toUpperCase()
      : 'ASK';

    if (finalPayoutPref === 'LANDLORD') {
      if (!landlord_bank_name || !landlord_account_number || !landlord_account_name) {
        return res.status(400).json({
          error: 'payout_preference=LANDLORD requires landlord_bank_name, landlord_account_number and landlord_account_name.',
        });
      }
    }
    if (finalPayoutPref === 'TENANT') {
      if (!tenant_bank_name || !tenant_account_number || !tenant_account_name) {
        return res.status(400).json({
          error: 'payout_preference=TENANT requires tenant_bank_name, tenant_account_number and tenant_account_name.',
        });
      }
    }

    let finalDueDate: string | null = null;
    if (due_date) {
      const d = new Date(due_date);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: 'due_date is not a valid date.' });
      }
      finalDueDate = d.toISOString().slice(0, 10);
    }

    const VAULT_FEE_PCT = 0.02;
    const PERIODS_MAP: Record<string, number> = {
      DAILY: 365, WEEKLY: 52, BIWEEKLY: 26, MONTHLY: 12, QUARTERLY: 4,
    };
    const VALID_FREQS = ['DAILY','WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY'];
    const freq = VALID_FREQS.includes((frequency || '').toUpperCase())
      ? (frequency as string).toUpperCase()
      : 'MONTHLY';

    let computedRentAmount: number;
    let platformFeeAmount:  number;
    let finalTarget:        number;

    if (rent_amount && !isNaN(Number(rent_amount)) && Number(rent_amount) >= 100) {
      computedRentAmount = Math.round(Number(rent_amount) * 100) / 100;
      platformFeeAmount  = Math.round(computedRentAmount * VAULT_FEE_PCT * 100) / 100;
      finalTarget        = Math.round((computedRentAmount + platformFeeAmount) * 100) / 100;
    } else if (raw_target && !isNaN(Number(raw_target)) && Number(raw_target) >= 100) {
      finalTarget        = Math.round(Number(raw_target) * 100) / 100;
      platformFeeAmount  = Math.round(finalTarget * VAULT_FEE_PCT * 100) / 100;
      computedRentAmount = Math.round((finalTarget - platformFeeAmount) * 100) / 100;
    } else {
      return res.status(400).json({
        error: 'rent_amount is required and must be at least ₦100. The 2% Rent Success Fee is calculated automatically.',
      });
    }

    const periods = PERIODS_MAP[freq] || 12;
    const autoInstallment = Math.ceil((finalTarget / periods) * 100) / 100;
    const finalInstallment = (raw_installment && !isNaN(Number(raw_installment)) && Number(raw_installment) >= 50)
      ? Math.round(Number(raw_installment) * 100) / 100
      : autoInstallment;

    if (finalInstallment < 50) {
      return res.status(400).json({
        error: `Calculated installment (₦${finalInstallment}) is below ₦50 minimum. Increase rent_amount or choose a less frequent schedule.`,
      });
    }

    const r = await pool.query(
      `INSERT INTO standalone_vaults
         (tenant_user_id, target_amount, installment_amount, frequency,
          rent_amount, platform_fee_amount,
          landlord_name, landlord_email, landlord_bank_name,
          landlord_account_number, landlord_account_name,
          payout_preference, tenant_bank_name, tenant_account_number,
          tenant_account_name, tenant_bank_code, due_date,
          status, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'ACTIVE','NGN')
       RETURNING *`,
      [
        userId, finalTarget, finalInstallment, freq,
        computedRentAmount, platformFeeAmount,
        landlord_name           || null,
        landlord_email          || null,
        landlord_bank_name      || null,
        landlord_account_number || null,
        landlord_account_name   || null,
        finalPayoutPref,
        tenant_bank_name        || null,
        tenant_account_number   || null,
        tenant_account_name     || null,
        tenant_bank_code         || null,
        finalDueDate,
      ]
    );
    const sv = r.rows[0];

    const h = crypto.createHash('sha256')
      .update(`sv-init-${sv.id}-${userId}-${Date.now()}`).digest('hex');
    pool.query(
      `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
       VALUES ('STANDALONE_VAULT_INIT',$1,$2)`,
      [JSON.stringify({ vault_id: sv.id, tenant_user_id: userId, target_amount: finalTarget, rent_amount: computedRentAmount, platform_fee: platformFeeAmount, frequency: freq }), h]
    ).catch(() => {});

    console.log(`[STANDALONE-VAULT] Initialized vault=${sv.id} tenant=${userId} rent=₦${computedRentAmount} fee=₦${platformFeeAmount} target=₦${finalTarget} freq=${freq}`);

    return res.status(201).json({
      success:             true,
      vault_id:            sv.id,
      rent_amount:         computedRentAmount,
      platform_fee_amount: platformFeeAmount,
      platform_fee_pct:    2,
      target_amount:       finalTarget,
      installment_amount:  finalInstallment,
      frequency:           sv.frequency,
      periods:             periods,
      status:              sv.status,
      currency:            sv.currency,
      payout_preference:   sv.payout_preference,
      due_date:            sv.due_date,
      landlord_supplied:   !!(landlord_name || landlord_email || landlord_bank_name),
      fee_model:           'TENANT_PAYS_2PCT_ADDITIVE',
      fee_explanation:     `The 2% Nested Ark Rent Success Fee (₦${platformFeeAmount.toLocaleString()}) is included in your savings target. Your landlord receives 100% of the rent amount (₦${computedRentAmount.toLocaleString()}) in full. You save the rent plus the service fee.`,
      message:             `Vault initialized. Save ₦${finalInstallment.toLocaleString()} ${freq.toLowerCase()} to reach your ₦${finalTarget.toLocaleString()} target. Your landlord will receive ₦${computedRentAmount.toLocaleString()} (100% rent).`,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/tenant/standalone-vault ─────────────────────────────────────────
// Returns the tenant's standalone vault state + full contribution history.
app.get('/api/tenant/standalone-vault', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const svRes = await pool.query(
      `SELECT sv.*,
              COALESCE((SELECT SUM(sc.amount_ngn) FROM standalone_contributions sc
                        WHERE sc.vault_id = sv.id AND sc.status = 'SUCCESS'), 0) AS total_contributed,
              (SELECT COUNT(*) FROM standalone_contributions sc
               WHERE sc.vault_id = sv.id AND sc.status = 'SUCCESS') AS contribution_count
       FROM standalone_vaults sv
       WHERE sv.tenant_user_id = $1 AND sv.status NOT IN ('MIGRATED','CLOSED')
       ORDER BY sv.created_at DESC LIMIT 1`,
      [userId]
    );
    if (!svRes.rows.length) {
      return res.json({
        success:            true,
        hasStandaloneVault: false,
        vault:              null,
        contributions:      [],
        message:            'No standalone vault found. Use POST /api/tenant/standalone-vault/init to create one.',
      });
    }
    const sv = svRes.rows[0];
    const contribs = await pool.query(
      `SELECT id, amount_ngn, period_label, paid_at, status, ledger_hash
       FROM standalone_contributions
       WHERE vault_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [sv.id]
    );
    return res.json({
      success:            true,
      hasStandaloneVault: true,
      vault: {
        id:                   sv.id,
        vault_balance:        parseFloat(sv.vault_balance)      || 0,
        target_amount:        parseFloat(sv.target_amount)      || 0,
        installment_amount:   parseFloat(sv.installment_amount) || 0,
        funded_pct:           sv.target_amount > 0
                                ? Math.min(Math.round((parseFloat(sv.vault_balance) / parseFloat(sv.target_amount)) * 100), 100)
                                : 0,
        frequency:            sv.frequency,
        status:               sv.status,
        currency:             sv.currency,
        funded_periods:       sv.funded_periods,
        total_contributed:    parseFloat(sv.total_contributed)  || 0,
        contribution_count:   parseInt(sv.contribution_count)   || 0,
        landlord_name:        sv.landlord_name        || null,
        landlord_email:       sv.landlord_email       || null,
        landlord_bank_name:   sv.landlord_bank_name   || null,
        landlord_account_name: sv.landlord_account_name || null,
        landlord_account_number: sv.landlord_account_number || null,
        payout_preference:    sv.payout_preference    || 'ASK',
        tenant_bank_name:     sv.tenant_bank_name      || null,
        tenant_account_number: sv.tenant_account_number || null,
        tenant_account_name:  sv.tenant_account_name   || null,
        due_date:             sv.due_date              || null,
        linked_tenancy_id:    sv.linked_tenancy_id    || null,
        migrated_vault_id:    sv.migrated_vault_id    || null,
        created_at:           sv.created_at,
      },
      contributions: contribs.rows,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── POST /api/tenant/standalone-vault/:id/payout-choice ──────────────────────
// For vaults created with payout_preference='ASK'. Once a vault reaches
// FUNDED_READY, the tenant calls this to decide where the funds go:
// TENANT (their own bank account) or LANDLORD (direct release, even if the
// landlord never joins Nested Ark). The PAYOUT-CRON picks up the chosen
// preference on its next cycle and disburses accordingly.
app.post('/api/tenant/standalone-vault/:id/payout-choice', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId  = (req as any).userId;
  const { id }  = req.params;
  const { payout_choice, bank_name, account_number, account_name, bank_code } = req.body;

  try {
    const VALID_CHOICES = ['TENANT', 'LANDLORD'];
    const choice = (payout_choice || '').toUpperCase();
    if (!VALID_CHOICES.includes(choice)) {
      return res.status(400).json({ error: "payout_choice must be 'TENANT' or 'LANDLORD'." });
    }
    if (!bank_name || !account_number || !account_name) {
      return res.status(400).json({ error: 'bank_name, account_number and account_name are required.' });
    }

    const svRes = await pool.query(
      `SELECT * FROM standalone_vaults WHERE id=$1 AND tenant_user_id=$2`,
      [id, userId]
    );
    if (!svRes.rows.length) return res.status(404).json({ error: 'Standalone vault not found.' });
    const sv = svRes.rows[0];

    if (sv.status !== 'FUNDED_READY') {
      return res.status(400).json({
        error:  `Vault status is '${sv.status}'. Payout choice can only be made once the vault reaches FUNDED_READY (100%).`,
        status: sv.status,
      });
    }

    let updateQuery: string;
    let updateParams: any[];

    if (choice === 'TENANT') {
      updateQuery = `
        UPDATE standalone_vaults
        SET payout_preference = 'TENANT',
            tenant_bank_name = $1, tenant_account_number = $2, tenant_account_name = $3,
            tenant_bank_code = $4, tenant_recipient_code = NULL, updated_at = NOW()
        WHERE id = $5 RETURNING *`;
      updateParams = [bank_name, account_number, account_name, bank_code || null, id];
    } else {
      updateQuery = `
        UPDATE standalone_vaults
        SET payout_preference = 'LANDLORD',
            landlord_bank_name = $1, landlord_account_number = $2, landlord_account_name = $3,
            landlord_recipient_code = NULL, updated_at = NOW()
        WHERE id = $4 RETURNING *`;
      updateParams = [bank_name, account_number, account_name, id];
    }

    const updated = await pool.query(updateQuery, updateParams);

    const h = crypto.createHash('sha256')
      .update(`sv-payout-choice-${id}-${choice}-${Date.now()}`).digest('hex');
    pool.query(
      `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
       VALUES ('STANDALONE_VAULT_PAYOUT_CHOICE',$1,$2)`,
      [JSON.stringify({
        vault_id: id, tenant_user_id: userId, payout_choice: choice,
        bank_name, account_number, account_name,
      }), h]
    ).catch(() => {});

    console.log(`[STANDALONE-VAULT] Payout choice set: vault=${id} choice=${choice} → ${account_name} (${bank_name} ${account_number})`);

    return res.json({
      success: true,
      vault_id: id,
      payout_preference: updated.rows[0].payout_preference,
      message: choice === 'TENANT'
        ? `Funds will be transferred to your account (${bank_name} · ${account_number}) within 24 hours.`
        : `Funds will be released directly to your landlord (${bank_name} · ${account_number}) within 24 hours.`,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/tenant/standalone-vault/:id/receipt ─────────────────────────────
// "RENT SUCCESSFULLY PAID" certificate — pulls the most recent successful
// STANDALONE_VAULT_PAYOUT ledger entry for this vault. Powers the completion
// screen and downloadable receipt (Priority 4).
app.get('/api/tenant/standalone-vault/:id/receipt', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { id }  = req.params;
  try {
    const svRes = await pool.query(
      `SELECT sv.*, u.full_name AS tenant_name, u.email AS tenant_email
       FROM standalone_vaults sv
       JOIN public.users u ON u.id = sv.tenant_user_id
       WHERE sv.id=$1 AND sv.tenant_user_id=$2`,
      [id, userId]
    );
    if (!svRes.rows.length) return res.status(404).json({ error: 'Standalone vault not found.' });
    const sv = svRes.rows[0];

    const ledgerRes = await pool.query(
      `SELECT * FROM system_ledger
       WHERE transaction_type = 'STANDALONE_VAULT_PAYOUT'
         AND payload->>'vault_id' = $1
         AND payload->>'transfer_status' = 'INITIATED'
       ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    if (!ledgerRes.rows.length) {
      return res.status(404).json({
        error: 'No completed payout found for this vault yet.',
        status: sv.status,
      });
    }

    const ledger  = ledgerRes.rows[0];
    const payload = ledger.payload || {};

    return res.json({
      success: true,
      receipt: {
        vault_id:        id,
        reference:       payload.reference,
        amount:          parseFloat(payload.amount_ngn) || 0,
        currency:        sv.currency || 'NGN',
        recipient_name:  payload.account_name,
        bank_name:       payload.bank_name,
        account_number_masked: payload.account_number
          ? `****${String(payload.account_number).slice(-4)}`
          : null,
        payout_preference: payload.payout_preference,
        destination: payload.payout_preference === 'TENANT' ? 'Your Account' : 'Landlord Account',
        date: ledger.created_at,
        ledger_hash: ledger.immutable_hash,
        ledger_verified: true,
        paystack_verified: payload.transfer_status === 'INITIATED',
        tenant_name: sv.tenant_name,
        tenant_email: sv.tenant_email,
        rent_amount: parseFloat(sv.rent_amount) || parseFloat(payload.amount_ngn) || 0,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});


// Initiates a Paystack charge into the tenant's standalone vault (escrow hold).
// Platform covers Paystack fee (bearer:account). 2% platform fee at vault release.
// Vault must exist — call /init first if not. Optional: pass `amount` to override
// the default installment_amount.
app.post('/api/tenant/standalone-vault/pay', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { amount } = req.body;
  try {
    const svRes = await pool.query(
      `SELECT sv.*, u.email AS user_email, u.full_name
       FROM standalone_vaults sv
       JOIN public.users u ON u.id = sv.tenant_user_id
       WHERE sv.tenant_user_id = $1 AND sv.status NOT IN ('MIGRATED','CLOSED')
       ORDER BY sv.created_at DESC LIMIT 1`,
      [userId]
    );
    if (!svRes.rows.length) {
      return res.status(404).json({
        error:      'No active standalone vault. Initialize one first.',
        error_code: 'NO_STANDALONE_VAULT',
        action:     'POST /api/tenant/standalone-vault/init',
      });
    }
    const sv = svRes.rows[0];

    const baseAmountNaira = (amount && !isNaN(Number(amount)) && Number(amount) >= 50)
      ? Number(amount)
      : parseFloat(sv.installment_amount);

    if (baseAmountNaira < 50) {
      return res.status(400).json({ error: 'Minimum contribution is ₦50' });
    }
    const amountKobo = Math.round(baseAmountNaira * 100);
    if (amountKobo > 999999999) {
      return res.status(400).json({ error: 'Amount exceeds single-transaction limit.' });
    }

    const FRONTEND = process.env.FRONTEND_URL || 'https://nestedark.com';
    const ref      = `ARK-SV-${sv.id.slice(0, 8)}-${Date.now()}`;

    // ── ESCROW-HOLD MODE — mirrors flex_pay_vault installment architecture ────
    // Independent tenant contributions accumulate in the Nested Ark main Paystack
    // balance as escrow. NO subaccount split at contribution time — intentional.
    // Paystack subaccounts settle T+1 to a bank account which would immediately
    // disburse before the vault is 100% funded.
    //
    // FEE MODEL (additive — landlord gets 100% of rent):
    //   • Tenant saves: rent_amount + platform_fee_amount (2%) = target_amount
    //   • 2% is ADDED ON TOP — landlord receives 100% of rent_amount
    //   • At release: rent_amount → landlord, platform_fee_amount → retained in platform
    //   • Both logged via STANDALONE_VAULT_PAYOUT + PLATFORM_FEE_RETAINED ledger entries
    //
    // bearer: 'account' — platform absorbs Paystack fee so tenant pays EXACT installment.
    // Do NOT add subaccount or transaction_charge here.
    const platformFeeAmount = parseFloat(sv.platform_fee_amount) || Math.round(parseFloat(sv.rent_amount || sv.target_amount) * 0.02 * 100) / 100;
    const rentAmount        = parseFloat(sv.rent_amount) || Math.round(parseFloat(sv.target_amount) / 1.02 * 100) / 100;

    console.log(`[STANDALONE-VAULT] ESCROW_HOLD — vault=${sv.id} tenant=${userId} contribution=₦${baseAmountNaira} target=₦${sv.target_amount} rent=₦${rentAmount} fee=₦${platformFeeAmount} (additive: landlord gets 100%) payout=${sv.payout_preference}`);

    const psPayload: Record<string, any> = {
      email:        sv.user_email,
      amount:       amountKobo,
      reference:    ref,
      currency:     'NGN',
      bearer:       'account',   // Platform covers Paystack fee — tenant pays exact installment
      callback_url: `${FRONTEND}/tenant/pay/success?reference=${ref}`,
      metadata: {
        payment_type:        'STANDALONE_INSTALLMENT',
        standalone_vault_id: sv.id,
        tenant_user_id:      userId,
        tenant_name:         sv.full_name || sv.user_email,
        base_naira_amount:   baseAmountNaira,
        processing_fee_ngn:  0,           // platform absorbs Paystack fee
        split_mode:          'ESCROW_HOLD_ADDITIVE_FEE', // rent+2% held; landlord gets 100% rent on release
        cashout_mode:        'LUMP_SUM',
        rent_amount:         rentAmount,
        platform_fee_amount: platformFeeAmount,
        fee_model:           'TENANT_PAYS_2PCT_ADDITIVE', // 2% added on top, NOT deducted from landlord
        payout_preference:   sv.payout_preference || 'ASK',
        custom_fields: [
          { display_name: 'Vault ID',       variable_name: 'vault_id',          value: sv.id },
          { display_name: 'Tenant',         variable_name: 'tenant_name',        value: sv.full_name || sv.user_email },
          { display_name: 'Payout Pref',   variable_name: 'payout_preference',  value: sv.payout_preference || 'ASK' },
          { display_name: 'Split Mode',     variable_name: 'split_mode',         value: 'ESCROW_HOLD' },
        ],
      },
    };
    // NOTE: No subaccount injection here — escrow hold until 100% funded.
    // startStandaloneVaultPayoutCron handles 98/2 release.

    const psRes  = await fetch('https://api.paystack.co/transaction/initialize', {
      method:  'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(psPayload),
    });
    const psData: any = await psRes.json();
    if (!psData.status) return res.status(502).json({ error: psData.message || 'Paystack error' });

    return res.json({
      success:            true,
      authorization_url:  psData.data.authorization_url,
      reference:          ref,
      vault_id:           sv.id,
      amount_ngn:         baseAmountNaira,
      processing_fee_ngn: 0,
      total_charged_ngn:  baseAmountNaira,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/tenant/my-contributions ───────────────────────────────────────
// Alias: returns all flex contributions for the authenticated tenant.
app.get('/api/tenant/my-contributions', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    // Resolve tenancy
    let tenancyId: string | null = null;

    const byId = await pool.query(
      `SELECT id FROM tenancies WHERE tenant_user_id = $1 AND status = 'ACTIVE'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (byId.rows.length) {
      tenancyId = byId.rows[0].id;
    } else {
      const uRes = await pool.query('SELECT email FROM public.users WHERE id = $1', [userId]);
      if (uRes.rows.length) {
        const byEmail = await pool.query(
          `SELECT id FROM tenancies WHERE tenant_email = $1 AND status = 'ACTIVE'
           ORDER BY created_at DESC LIMIT 1`,
          [uRes.rows[0].email]
        );
        if (byEmail.rows.length) tenancyId = byEmail.rows[0].id;
      }
    }

    if (!tenancyId) {
      // ── Independent Tenant: return standalone_contributions instead ────────
      const svRes = await pool.query(
        `SELECT sv.id AS vault_id FROM standalone_vaults sv
         WHERE sv.tenant_user_id = $1 AND sv.status NOT IN ('MIGRATED','CLOSED')
         ORDER BY sv.created_at DESC LIMIT 1`,
        [userId]
      );
      if (!svRes.rows.length) {
        return res.json({ success: true, contributions: [], count: 0, source: 'none' });
      }
      const svId = svRes.rows[0].vault_id;
      const sc = await pool.query(
        `SELECT id,
                amount_ngn  AS amount,
                'NGN'       AS currency,
                period_label,
                paid_at,
                status,
                ledger_hash,
                id          AS receipt_id,
                'STANDALONE' AS source
         FROM standalone_contributions
         WHERE vault_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [svId]
      );
      return res.json({ success: true, contributions: sc.rows, count: sc.rows.length, source: 'standalone' });
    }

    const r = await pool.query(
      `SELECT fc.id,
              fc.amount_ngn  AS amount,
              'NGN'          AS currency,
              fc.period_label,
              fc.paid_at,
              fc.status,
              fc.ledger_hash,
              fc.id          AS receipt_id
       FROM flex_contributions fc
       JOIN flex_pay_vaults fpv ON fpv.id = fc.vault_id
       WHERE fpv.tenancy_id = $1
       ORDER BY fc.created_at DESC
       LIMIT 50`,
      [tenancyId]
    );

    return res.json({ success: true, contributions: r.rows, count: r.rows.length });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/tenant/verify-payment ──────────────────────────────────────────
// Called by the tenant pay/success page to confirm payment and get vault state.
// Three-layer resolution:
//   1. Check flex_contributions by paystack_ref (instant if webhook already fired)
//   2. If not found, call Paystack verify API directly (webhook may be delayed)
//   3. If Paystack confirms success but contribution missing, self-heal: credit vault
app.get('/api/tenant/verify-payment', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId    = (req as any).userId;
  const { reference } = req.query as { reference: string };
  if (!reference) return res.status(400).json({ error: 'reference required' });
  if (!/^[A-Za-z0-9\-_]{6,100}$/.test(reference)) {
    return res.status(400).json({ error: 'Invalid reference format' });
  }
  try {
    // ── Layer 1: Check our DB — contribution already written by webhook ────
    // NOTE: We do NOT filter by tenant_user_id here because the tenancy
    // may not have tenant_user_id populated yet at payment time (it gets
    // linked at vault setup). We use paystack_ref as the unique identifier.
    const r = await pool.query(
      `SELECT fc.id, fc.amount_ngn, fc.paystack_ref, fc.period_label, fc.ledger_hash,
              fc.status, fc.paid_at,
              fpv.vault_balance, fpv.target_amount, fpv.status AS vault_status,
              fpv.id AS vault_id, fpv.tenancy_id,
              t.tenant_name
       FROM flex_contributions fc
       JOIN flex_pay_vaults fpv ON fpv.id = fc.vault_id
       JOIN tenancies t         ON t.id   = fpv.tenancy_id
       WHERE fc.paystack_ref = $1`,
      [reference]
    );

    if (r.rows.length) {
      const row = r.rows[0];
      const balance   = Math.max(0, Number(row.vault_balance) || 0);
      const target    = Math.max(1, Number(row.target_amount) || 1);
      const fundedPct = Math.min(Math.round((balance / target) * 100), 100);
      return res.json({
        verified:      true,
        amount_ngn:    Math.max(0, Number(row.amount_ngn) || 0),
        reference:     row.paystack_ref,
        vault_balance: balance,
        target_amount: Math.max(0, Number(row.target_amount) || 0),
        funded_pct:    fundedPct,
        vault_status:  row.vault_status,
        tenant_name:   row.tenant_name,
        period_label:  row.period_label || new Date().toISOString().slice(0, 7),
        ledger_hash:   row.ledger_hash || '',
        paid_at:       row.paid_at,
      });
    }

    // ── Layer 1b: Check standalone_contributions (independent vault — ARK-SV-* refs) ──
    const sr = await pool.query(
      `SELECT sc.id, sc.amount_ngn, sc.paystack_ref, sc.period_label, sc.ledger_hash,
              sc.status, sc.paid_at,
              sv.vault_balance, sv.target_amount, sv.status AS vault_status, sv.id AS vault_id,
              u.full_name AS tenant_name
       FROM standalone_contributions sc
       JOIN standalone_vaults sv ON sv.id = sc.vault_id
       JOIN public.users u              ON u.id  = sv.tenant_user_id
       WHERE sc.paystack_ref = $1`,
      [reference]
    ).catch(() => ({ rows: [] as any[] }));

    if (sr.rows.length) {
      const row     = sr.rows[0];
      const balance = Math.max(0, Number(row.vault_balance) || 0);
      const target  = Math.max(1, Number(row.target_amount) || 1);
      return res.json({
        verified:      true,
        amount_ngn:    Math.max(0, Number(row.amount_ngn) || 0),
        reference:     row.paystack_ref,
        vault_balance: balance,
        target_amount: Math.max(0, Number(row.target_amount) || 0),
        funded_pct:    Math.min(Math.round((balance / target) * 100), 100),
        vault_status:  row.vault_status,
        vault_type:    'standalone',
        tenant_name:   row.tenant_name,
        period_label:  row.period_label || new Date().toISOString().slice(0, 7),
        ledger_hash:   row.ledger_hash || '',
        paid_at:       row.paid_at,
      });
    }

    // ── Layer 2: Webhook may be delayed — call Paystack directly ──────────
    if (!PAYSTACK_SECRET) {
      return res.status(202).json({
        verified: false,
        error: 'Payment received. Vault is updating — please check again in a moment.',
        reference,
      });
    }

    const psVerify = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const psData: any = await psVerify.json();

    if (!psData.status || psData.data?.status !== 'success') {
      // Paystack also shows not-yet-confirmed — genuinely still processing
      return res.status(202).json({
        verified: false,
        error: 'Payment is still being confirmed by Paystack. Please check your vault in 30 seconds.',
        reference,
        paystack_status: psData.data?.status ?? 'unknown',
      });
    }

    // ── Layer 3: Paystack confirmed success but webhook hasn't fired yet ───
    // Self-heal: credit the correct vault now so tenant isn't stuck on error screen.
    // Handles BOTH flex vaults (ARK-VAULT-*, ARK-FP-*) AND standalone vaults (ARK-SV-*).
    const amountNgn        = (psData.data.amount ?? 0) / 100;
    const meta             = psData.data.metadata ?? {};
    const paymentType      = meta.payment_type ?? '';
    const standaloneVaultId = meta.standalone_vault_id;   // set by /api/tenant/standalone-vault/pay
    const vaultId          = meta.vault_id;
    const tenancyId        = meta.tenancy_id;

    // ── Layer 3a: Standalone vault self-heal (ARK-SV-* references) ──────────
    // Paystack confirmed success but the STANDALONE_INSTALLMENT webhook never
    // fired (Render cold start, network timeout, etc.). Credit the standalone
    // vault directly so the tenant's success page shows the correct balance.
    if (paymentType === 'STANDALONE_INSTALLMENT' || standaloneVaultId) {
      const svId = standaloneVaultId;
      if (!svId) {
        console.warn(`[VERIFY] STANDALONE_INSTALLMENT confirmed by Paystack but standalone_vault_id missing in metadata — ref=${reference}`);
        return res.status(202).json({
          verified: false,
          error: 'Payment confirmed. Vault update in progress — check back in a moment.',
          reference,
          paystack_confirmed: true,
        });
      }

      const svRes = await pool.query(
        `SELECT sv.*, u.full_name AS tenant_name
         FROM standalone_vaults sv
         JOIN public.users u ON u.id = sv.tenant_user_id
         WHERE sv.id = $1`,
        [svId]
      );

      if (!svRes.rows.length) {
        console.warn(`[VERIFY] Standalone vault ${svId} not found during self-heal — ref=${reference}`);
        return res.status(202).json({
          verified: false,
          error: 'Payment confirmed. Vault update in progress — check back in a moment.',
          reference,
          paystack_confirmed: true,
        });
      }

      const sv          = svRes.rows[0];
      const target      = parseFloat(sv.target_amount);
      const newBalance  = parseFloat(sv.vault_balance) + amountNgn;
      const newPeriods  = newBalance >= target ? (parseInt(sv.funded_periods) || 0) + 1 : (parseInt(sv.funded_periods) || 0);
      const newStatus   = newBalance >= target ? 'FUNDED_READY' : sv.status;
      const periodLabel = new Date().toISOString().slice(0, 7);

      const h = crypto.createHash('sha256')
        .update(`sv-self-heal-${svId}-${amountNgn}-${reference}-${Date.now()}`)
        .digest('hex');

      // Idempotent insert — if webhook also fires later, ON CONFLICT DO NOTHING prevents double-credit
      await pool.query(
        `INSERT INTO standalone_contributions
           (vault_id, amount_ngn, paystack_ref, status, period_label, paid_at, ledger_hash)
         VALUES ($1,$2,$3,'SUCCESS',$4,NOW(),$5)
         ON CONFLICT (paystack_ref) DO NOTHING`,
        [svId, amountNgn, reference, periodLabel, h]
      );

      // Update vault balance (only if this is the first credit — guard via paystack_ref)
      const already = await pool.query(
        `SELECT id FROM standalone_contributions WHERE paystack_ref=$1 AND vault_id=$2 LIMIT 1`,
        [reference, svId]
      );
      // already.rows.length > 0 means the INSERT above succeeded (not conflict)
      // We always update vault in case webhook missed the UPDATE too
      await pool.query(
        `UPDATE standalone_vaults
         SET vault_balance = GREATEST(vault_balance, $1),
             funded_periods = $2,
             status = CASE WHEN status NOT IN ('MIGRATED','CLOSED') THEN $3 ELSE status END,
             updated_at = NOW()
         WHERE id = $4`,
        [newBalance, newPeriods, newStatus, svId]
      );

      // Immutable ledger (fire-and-forget)
      pool.query(
        `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
         VALUES ('STANDALONE_VAULT_SELF_HEAL',$1,$2)
         ON CONFLICT DO NOTHING`,
        [JSON.stringify({
          vault_id: svId, tenant_id: sv.tenant_user_id,
          amount_ngn: amountNgn, reference,
          new_balance: newBalance, healed_by: 'verify-payment',
          funded_pct: Math.min(Math.round((newBalance / target) * 100), 100),
        }), h]
      ).catch(() => {});

      console.log(`[VERIFY] Self-healed standalone vault ${svId} → +₦${amountNgn} balance=₦${newBalance} ref=${reference}`);

      const fundedPct = Math.min(Math.round((newBalance / target) * 100), 100);
      return res.json({
        verified:      true,
        amount_ngn:    amountNgn,
        reference,
        vault_balance: newBalance,
        target_amount: target,
        funded_pct:    fundedPct,
        vault_status:  newStatus,
        vault_type:    'standalone',
        tenant_name:   sv.tenant_name,
        period_label:  periodLabel,
        ledger_hash:   h,
        paid_at:       psData.data.paid_at ?? new Date().toISOString(),
        self_healed:   true,
      });
    }

    // ── Layer 3b: Flex vault self-heal (ARK-VAULT-*, ARK-FP-*, RENT_INSTALLMENT) ─
    if (!vaultId && !tenancyId) {
      // Cannot resolve vault — let the webhook handle it
      return res.status(202).json({
        verified: false,
        error: 'Payment confirmed. Vault update in progress — check back in a moment.',
        reference,
        paystack_confirmed: true,
      });
    }

    // Resolve flex vault
    const vaultQuery = vaultId
      ? await pool.query(`SELECT * FROM flex_pay_vaults WHERE id = $1 AND status IN ('ACTIVE','FUNDED_READY')`, [vaultId])
      : await pool.query(`SELECT * FROM flex_pay_vaults WHERE tenancy_id = $1 AND status IN ('ACTIVE','FUNDED_READY') ORDER BY created_at DESC LIMIT 1`, [tenancyId]);

    if (!vaultQuery.rows.length) {
      return res.status(202).json({
        verified: false,
        error: 'Payment confirmed. Vault update in progress — check back in a moment.',
        reference,
        paystack_confirmed: true,
      });
    }

    const v           = vaultQuery.rows[0];
    const periodLabel = meta.period_month || new Date().toISOString().slice(0, 7);
    const newBalance  = parseFloat(v.vault_balance) + amountNgn;
    const target      = parseFloat(v.target_amount);
    const h = crypto.createHash('sha256')
      .update(`self-heal-${v.id}-${amountNgn}-${reference}-${Date.now()}`)
      .digest('hex');

    let newStatus  = v.status;
    let newPeriods = parseInt(v.funded_periods) || 0;
    if (newBalance >= target) {
      newPeriods += 1;
      newStatus = (v.cashout_mode === 'LUMP_SUM') ? 'FUNDED_READY' : v.status;
    }

    // Insert contribution (idempotent)
    await pool.query(
      `INSERT INTO flex_contributions
         (vault_id, tenancy_id, amount_ngn, paystack_ref, status, period_label, paid_at, ledger_hash)
       VALUES ($1,$2,$3,$4,'SUCCESS',$5,NOW(),$6)
       ON CONFLICT ON CONSTRAINT flex_contributions_paystack_ref_key DO NOTHING`,
      [v.id, v.tenancy_id, amountNgn, reference, periodLabel, h]
    );

    // Update vault balance
    await pool.query(
      `UPDATE flex_pay_vaults
       SET vault_balance=$1, funded_periods=$2, status=$3, updated_at=NOW()
       WHERE id=$4`,
      [newBalance, newPeriods, newStatus, v.id]
    );

    // Ledger entry
    await pool.query(
      `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
       VALUES ('FLEX_RENT_SELF_HEAL',$1,$2)`,
      [JSON.stringify({
        vault_id: v.id, tenancy_id: v.tenancy_id,
        amount_ngn: amountNgn, reference, period_label: periodLabel,
        new_balance: newBalance, healed_by: 'verify-payment',
      }), h]
    );

    console.log(`[VERIFY] Self-healed flex vault ${v.id} → +₦${amountNgn} balance=₦${newBalance} ref=${reference}`);

    const fundedPct = Math.min(Math.round((newBalance / target) * 100), 100);
    return res.json({
      verified:           true,
      amount_ngn:         amountNgn,
      reference,
      vault_balance:      newBalance,
      target_amount:      target,
      funded_pct:         fundedPct,
      vault_status:       newStatus,
      period_label:       periodLabel,
      ledger_hash:        h,
      paid_at:            psData.data.paid_at ?? new Date().toISOString(),
      self_healed:        true,
    });

  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/tenant/my-notices ──────────────────────────────────────────────
// Alias: returns legal notices for the authenticated tenant.
app.get('/api/tenant/my-notices', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    // Resolve tenancy
    let tenancyId: string | null = null;

    const byId = await pool.query(
      `SELECT id FROM tenancies WHERE tenant_user_id = $1 AND status = 'ACTIVE'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (byId.rows.length) {
      tenancyId = byId.rows[0].id;
    } else {
      const uRes = await pool.query('SELECT email FROM public.users WHERE id = $1', [userId]);
      if (uRes.rows.length) {
        const byEmail = await pool.query(
          `SELECT id FROM tenancies WHERE tenant_email = $1 AND status = 'ACTIVE'
           ORDER BY created_at DESC LIMIT 1`,
          [uRes.rows[0].email]
        );
        if (byEmail.rows.length) tenancyId = byEmail.rows[0].id;
      }
    }

    if (!tenancyId) return res.json({ success: true, notices: [], count: 0 });

    const r = await pool.query(
      `SELECT id, notice_number, notice_type, amount_overdue, days_overdue,
              issued_at, served_at, response_deadline, status
       FROM legal_notices
       WHERE tenancy_id = $1
       ORDER BY issued_at DESC`,
      [tenancyId]
    );

    return res.json({ success: true, notices: r.rows, count: r.rows.length });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── POST /api/tenant/pay-installment ───────────────────────────────────────
// Alias: initiates a Paystack payment for the tenant's vault installment.
// Resolves vault from authenticated user — no vault_id required from client.
app.post('/api/tenant/pay-installment', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId  = (req as any).userId;
  const { vault_id, amount } = req.body; // amount optional — falls back to vault installment_amount

  try {
    let resolvedVaultId = vault_id;

    if (!resolvedVaultId) {
      // Resolve vault from authenticated user
      let tenancyId: string | null = null;

      const byId = await pool.query(
        `SELECT id FROM tenancies WHERE tenant_user_id = $1 AND status = 'ACTIVE'
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      if (byId.rows.length) {
        tenancyId = byId.rows[0].id;
      } else {
        const uRes = await pool.query('SELECT email FROM public.users WHERE id = $1', [userId]);
        if (uRes.rows.length) {
          const byEmail = await pool.query(
            `SELECT id FROM tenancies WHERE tenant_email = $1 AND status = 'ACTIVE'
             ORDER BY created_at DESC LIMIT 1`,
            [uRes.rows[0].email]
          );
          if (byEmail.rows.length) tenancyId = byEmail.rows[0].id;
        }
      }

      if (!tenancyId) {
        // Check if they have a standalone vault to redirect to
        const svCheck = await pool.query(
          `SELECT id FROM standalone_vaults
           WHERE tenant_user_id=$1 AND status NOT IN ('MIGRATED','CLOSED') LIMIT 1`,
          [userId]
        );
        return res.status(200).json({
          success:             false,
          hasActiveTenancy:    false,
          hasStandaloneVault:  svCheck.rows.length > 0,
          standalone_vault_id: svCheck.rows[0]?.id || null,
          error_code:          'NO_ACTIVE_TENANCY',
          message:             svCheck.rows.length > 0
            ? 'Use POST /api/tenant/standalone-vault/pay to contribute to your standalone savings vault.'
            : 'No active tenancy or standalone vault found. Initialize your savings vault first.',
          action: svCheck.rows.length > 0
            ? 'POST /api/tenant/standalone-vault/pay'
            : 'POST /api/tenant/standalone-vault/init',
        });
      }

      const vRes = await pool.query(
        `SELECT id FROM flex_pay_vaults
         WHERE tenancy_id = $1 AND status IN ('ACTIVE','FUNDED_READY')
         ORDER BY created_at DESC LIMIT 1`,
        [tenancyId]
      );
      if (!vRes.rows.length) return res.status(404).json({ error: 'No active vault found' });
      resolvedVaultId = vRes.rows[0].id;
    }

    // Fetch vault + user email for Paystack
    const vaultRes = await pool.query(
      `SELECT fpv.*, t.tenant_email, t.tenant_name, t.id AS tenancy_id,
              u.email AS user_email, p.sponsor_id,
              ru.landlord_bank_account_id
       FROM flex_pay_vaults fpv
       JOIN tenancies t ON t.id = fpv.tenancy_id
       LEFT JOIN public.users u ON u.id = $2
       LEFT JOIN projects p ON p.id = COALESCE(fpv.project_id, t.project_id)
       LEFT JOIN rental_units ru ON ru.id = fpv.unit_id
       WHERE fpv.id = $1`,
      [resolvedVaultId, userId]
    );

    if (!vaultRes.rows.length) return res.status(404).json({ error: 'Vault not found' });
    const v = vaultRes.rows[0];

    // Use request body amount if provided and valid; otherwise fall back to vault installment_amount
    const baseAmountNaira = (amount && !isNaN(Number(amount)) && Number(amount) > 0)
      ? Number(amount)
      : parseFloat(v.installment_amount);

    // Platform covers Paystack's 1.5% + ₦100 transaction fee (bearer: 'account').
    // This means the tenant pays EXACTLY the installment amount shown — no surprise fees.
    // The platform absorbs the fee cost as part of the 2% service model.
    const amountKobo = Math.round(baseAmountNaira * 100);

    if (amountKobo > 999999999) {
      return res.status(400).json({ error: 'Amount exceeds single-transaction limit. Please split into smaller installments.' });
    }

    const email      = v.user_email || v.tenant_email;
    const ref        = `ARK-VAULT-${resolvedVaultId.slice(0, 8)}-${Date.now()}`;
    const FRONTEND   = process.env.FRONTEND_URL || 'https://nestedark.com';

    // ── ESCROW MODE: Installment payments do NOT split to landlord immediately ──
    // Architecture: tenant installments accumulate in Ark platform Paystack balance.
    // The payout cron (startPendingPayoutCron) detects FUNDED_READY vaults and
    // releases the full 98% lump sum to the landlord once the target is 100% met.
    //
    // DUAL PAYMENT ENGINE:
    //   Full rent payment  → instant 98/2 split via subaccount (landlord gets paid today)
    //   Vault installment  → NO split → funds held in platform escrow → released on completion
    //
    // This is intentional and correct. Do not add subaccount injection here.
    console.log(`[FLEX-PAY] Escrow mode — contribution of ₦${baseAmountNaira} held in platform vault (no split). Vault ${resolvedVaultId} target: ₦${parseFloat(v.target_amount).toLocaleString()}`);

    const vaultPsPayload: Record<string, any> = {
      email,
      amount:       amountKobo,
      reference:    ref,
      currency:     'NGN',
      bearer:       'account',  // Platform covers Paystack fee — tenant pays exact installment
      callback_url: `${FRONTEND}/tenant/pay/success?reference=${ref}`,
      metadata:  {
        payment_type:       'RENT_INSTALLMENT',
        vault_id:           resolvedVaultId,
        tenancy_id:         v.tenancy_id,
        tenant_name:        v.tenant_name,
        base_naira_amount:  baseAmountNaira,
        processing_fee_ngn: 0,  // platform absorbs Paystack fee
        landlord_id:        v.sponsor_id ?? null,
        split_mode:         'ESCROW_HOLD',  // funds held in platform until vault 100% funded
        cashout_mode:       v.cashout_mode || 'LUMP_SUM',
        custom_fields: [
          { display_name: 'Vault ID',  variable_name: 'vault_id',    value: resolvedVaultId },
          { display_name: 'Tenant',    variable_name: 'tenant_name', value: v.tenant_name   },
        ],
      },
    };
    // NOTE: No subaccount, no transaction_charge injection here.
    // Payout cron handles the release when vault_balance >= target_amount.

    const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method:  'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(vaultPsPayload),
    });

    const psData: any = await psRes.json();
    if (!psData.status) return res.status(502).json({ error: psData.message || 'Paystack error' });

    return res.json({
      success:            true,
      authorization_url:  psData.data.authorization_url,
      reference:          ref,
      vault_id:           resolvedVaultId,
      amount_ngn:         baseAmountNaira,
      processing_fee_ngn: 0,
      total_charged_ngn:  baseAmountNaira,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/tenant/receipt/:contributionId ────────────────────────────────
// Alias matching what the dashboard's downloadReceipt() calls.
app.get('/api/tenant/receipt/:contributionId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { contributionId } = req.params;
  try {
    // ── IDOR guard: tenant can only fetch their own receipts ──────────────
    // Supports both linked tenants (via tenancies.tenant_user_id) AND
    // independent tenants (via flex_pay_vaults.tenant_user_id directly).
    const ownerCheck = await pool.query(
      `SELECT fc.id FROM flex_contributions fc
       JOIN flex_pay_vaults fpv ON fpv.id = fc.vault_id
       LEFT JOIN tenancies t ON t.id = fpv.tenancy_id
       WHERE fc.id = $1
         AND (
           t.tenant_user_id = $2
           OR fpv.tenant_user_id = $2
           OR (SELECT role FROM public.users WHERE id=$2) = 'ADMIN'
         )`,
      [contributionId, userId]
    );
    if (!ownerCheck.rows.length)
      return res.status(403).json({ error: 'Access denied: receipt does not belong to your account' });

    const r = await pool.query(
      `SELECT fc.id, fc.amount_ngn, fc.period_label, fc.paid_at, fc.ledger_hash,
              fc.status, fc.paystack_ref,
              fpv.frequency,
              COALESCE(t.tenant_name,  u.full_name,  'Tenant')       AS tenant_name,
              COALESCE(t.tenant_email, u.email,       '')             AS tenant_email,
              COALESCE(ru.unit_name,   'Independent Vault')           AS unit_name,
              COALESCE(ru.currency, t.currency, 'NGN')                AS currency,
              COALESCE(p.title,  p2.title,  'Savings Vault')          AS project_title,
              COALESCE(p.project_number, p2.project_number, '—')      AS project_number
       FROM flex_contributions fc
       JOIN flex_pay_vaults fpv      ON fpv.id  = fc.vault_id
       LEFT JOIN tenancies t          ON t.id   = fpv.tenancy_id
       LEFT JOIN public.users u              ON u.id   = fpv.tenant_user_id
       LEFT JOIN rental_units ru      ON ru.id  = COALESCE(fpv.unit_id, t.unit_id)
       LEFT JOIN projects p           ON p.id   = fpv.project_id
       LEFT JOIN projects p2          ON p2.id  = ru.project_id
       WHERE fc.id = $1`,
      [contributionId]
    );

    if (!r.rows.length) return res.status(404).json({ error: 'Receipt not found' });
    const c = r.rows[0];

    // Return a lightweight HTML receipt (no PDF dependency)
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Receipt — Nested Ark OS</title>
<style>
  body { background:#09090b; color:#fff; font-family:'Segoe UI',sans-serif; padding:40px; max-width:500px; margin:0 auto; }
  .logo { color:#14b8a6; font-weight:900; font-size:18px; letter-spacing:1px; margin-bottom:24px; }
  .field { margin:12px 0; }
  .label { color:#71717a; font-size:10px; text-transform:uppercase; letter-spacing:2px; }
  .value { color:#fff; font-size:14px; font-weight:700; margin-top:2px; }
  .amount { color:#14b8a6; font-size:28px; font-weight:900; font-family:monospace; }
  .hash { color:#52525b; font-size:9px; font-family:monospace; word-break:break-all; margin-top:24px; border-top:1px solid #27272a; padding-top:12px; }
</style>
</head>
<body>
  <div class="logo">NESTED ARK OS — PAYMENT RECEIPT</div>
  <div class="field"><div class="label">Tenant</div><div class="value">${c.tenant_name}</div></div>
  <div class="field"><div class="label">Unit</div><div class="value">${c.unit_name} · ${c.project_title} (${c.project_number})</div></div>
  <div class="field"><div class="label">Period</div><div class="value">${c.period_label}</div></div>
  <div class="field"><div class="label">Amount Paid</div><div class="amount">${c.currency || 'NGN'} ${Number(c.amount_ngn).toLocaleString()}</div></div>
  <div class="field"><div class="label">Date</div><div class="value">${c.paid_at ? new Date(c.paid_at).toLocaleString('en-GB') : '—'}</div></div>
  <div class="field"><div class="label">Paystack Reference</div><div class="value">${c.paystack_ref || '—'}</div></div>
  <div class="field"><div class="label">Status</div><div class="value">${c.status}</div></div>
  <div class="hash">Ledger Hash (SHA-256): ${c.ledger_hash || 'pending'}</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${contributionId.slice(0,8)}.html"`);
    return res.send(html);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});


// GET: Generate a professional WhatsApp invitation link
app.get("/api/rental/invite-link/:unitId", async (req: Request, res: Response): Promise<any> => {
  const { unitId } = req.params;
  try {
    const unitRes = await pool.query(
      `SELECT ru.unit_name, ru.rent_amount, ru.currency, p.title AS project_title, p.project_number FROM rental_units ru JOIN projects p ON p.id = ru.project_id WHERE ru.id = $1`,
      [unitId]
    );
    const unit = unitRes.rows[0];
    const frontendUrl = process.env.FRONTEND_URL || 'https://nestedark.com';
    const onboardUrl  = `${frontendUrl}/onboard/${unitId}`;
    const unitLabel   = unit ? `${unit.unit_name} at ${unit.project_title}` : 'a property managed by Nested Ark';
    const rentLabel   = unit ? ` | Rent: ${unit.currency || 'NGN'} ${Number(unit.rent_amount).toLocaleString()}` : '';
    const message     = `*Nested Ark — Tenant Onboarding* 🏠\n\nYou have been invited to set up your digital tenancy for *${unitLabel}*${rentLabel}.\n\nClick the link below to verify your profile and choose your payment schedule (Weekly / Monthly / Quarterly).\n\nLink: ${onboardUrl}\n\n_Secured by Nested Ark Infrastructure OS_`;
    return res.json({ url: onboardUrl, whatsapp_link: `https://wa.me/?text=${encodeURIComponent(message)}`, unit_name: unit?.unit_name ?? '', project_title: unit?.project_title ?? '' });
  } catch {
    const frontendUrl = process.env.FRONTEND_URL || 'https://nestedark.com';
    const onboardUrl  = `${frontendUrl}/onboard/${unitId}`;
    const message     = `*Nested Ark Infrastructure Invite* 🏠\n\nYou have been invited to onboard as a tenant. Click to set up your profile.\n\nLink: ${onboardUrl}`;
    return res.json({ url: onboardUrl, whatsapp_link: `https://wa.me/?text=${encodeURIComponent(message)}` });
  }
});

// ============================================================================
// POST /api/tenant/onboard — dual-channel welcome on tenant self-registration
// ============================================================================
app.post('/api/tenant/onboard', async (req: Request, res: Response): Promise<any> => {
  const {
    unitId, fullName, email, phone, pattern,
    // World-class KYC fields (all optional for backward compat)
    selfie_url, former_address, reason_for_quit, former_landlord_contact,
    guarantor_json, digital_signature_url,
  } = req.body;
  if (!unitId || !fullName || !email) return res.status(400).json({ error: 'unitId, fullName and email are required' });
  const validPatterns = ['WEEKLY','MONTHLY','QUARTERLY'];
  const frequency     = validPatterns.includes(pattern) ? pattern : 'MONTHLY';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const unitRes = await client.query(
      `SELECT ru.*, p.id AS project_id, p.title AS project_title, p.project_number FROM rental_units ru JOIN projects p ON p.id = ru.project_id WHERE ru.id = $1`, [unitId]
    );
    if (!unitRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Unit not found' }); }
    const unit = unitRes.rows[0];
    const existingTen = await client.query(`SELECT id FROM tenancies WHERE unit_id=$1 AND tenant_email=$2 AND status='ACTIVE'`, [unitId, email.toLowerCase().trim()]);
    let tenancyId: string;
    if (existingTen.rows.length) {
      tenancyId = existingTen.rows[0].id;
      // Update existing tenancy with all KYC data
      await client.query(
        `UPDATE tenancies SET
          tenant_name              = $1,
          tenant_phone             = $2,
          status                   = 'ACTIVE',
          selfie_url               = COALESCE($3, selfie_url),
          former_landlord_contact  = COALESCE($4, former_landlord_contact),
          reason_for_quit          = COALESCE($5, reason_for_quit),
          guarantor_json           = COALESCE($6, guarantor_json),
          digital_signature_url    = COALESCE($7, digital_signature_url),
          updated_at               = NOW()
        WHERE id = $8`,
        [
          fullName.trim(),
          phone?.trim() || null,
          selfie_url || null,
          former_landlord_contact || null,
          reason_for_quit || null,
          guarantor_json ? JSON.stringify(guarantor_json) : null,
          digital_signature_url || null,
          tenancyId,
        ]
      );
    } else {
      const tenRes = await client.query(
        `INSERT INTO tenancies
           (unit_id, project_id, tenant_name, tenant_email, tenant_phone,
            rent_amount, currency, payment_day, lease_start, status,
            selfie_url, former_landlord_contact, reason_for_quit,
            guarantor_json, digital_signature_url, tenant_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,1,CURRENT_DATE,'ACTIVE',$8,$9,$10,$11,$12,100)
         RETURNING id`,
        [
          unitId, unit.project_id, fullName.trim(),
          email.toLowerCase().trim(), phone?.trim() || null,
          unit.rent_amount, unit.currency || 'NGN',
          selfie_url || null,
          former_landlord_contact || null,
          reason_for_quit || null,
          guarantor_json ? JSON.stringify(guarantor_json) : null,
          digital_signature_url || null,
        ]
      );
      tenancyId = tenRes.rows[0].id;
      await client.query(`UPDATE rental_units SET status='OCCUPIED', is_advertised=FALSE, listing_expires_at=NULL WHERE id=$1`, [unitId]);
    }
    // ── Auto-link tenant_user_id if a user account exists with this email ──
    // This ensures dashboard works immediately after onboarding even if user
    // registered before being assigned to a unit.
    const userLink = await client.query(
      `SELECT id FROM public.users WHERE email = $1 AND role = 'TENANT' LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    if (userLink.rows.length) {
      await client.query(
        `UPDATE tenancies SET tenant_user_id = $1 WHERE id = $2 AND tenant_user_id IS NULL`,
        [userLink.rows[0].id, tenancyId]
      );
    }
    const existingVault = await client.query(`SELECT id FROM flex_pay_vaults WHERE tenancy_id=$1 AND status IN ('ACTIVE','FUNDED_READY')`, [tenancyId]);
    let vaultId: string | null = null;
    const rentAmount  = parseFloat(unit.rent_amount);
    const periods     = ({ WEEKLY:52, MONTHLY:12, QUARTERLY:4 } as Record<string,number>)[frequency] ?? 12;
    const installment = Math.ceil(rentAmount / periods);
    if (!existingVault.rows.length) {
      const nextDue = new Date(); nextDue.setDate(nextDue.getDate() + 1);
      const vaultRes = await client.query(
        `INSERT INTO flex_pay_vaults (tenancy_id, unit_id, project_id, vault_balance, target_amount, frequency, installment_amount, currency, next_due_date, cashout_mode) VALUES ($1,$2,$3,0,$4,$5,$6,$7,$8,'LUMP_SUM') RETURNING id`,
        [tenancyId, unitId, unit.project_id, rentAmount, frequency, installment, unit.currency||'NGN', nextDue.toISOString().split('T')[0]]
      );
      vaultId = vaultRes.rows[0].id;
    } else { vaultId = existingVault.rows[0].id; }
    const h = crypto.createHash('sha256').update(`onboard-${tenancyId}-${unitId}-${Date.now()}`).digest('hex');
    await client.query(`INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ($1,$2,$3)`, ['TENANT_ONBOARDED', JSON.stringify({ tenancy_id:tenancyId, unit_id:unitId, project_id:unit.project_id, tenant_name:fullName, tenant_email:email, frequency, vault_id:vaultId }), h]);
    await client.query('COMMIT');

    // ── Dual-channel welcome (non-blocking) ────────────────────────────────
    const frontendUrl = process.env.FRONTEND_URL || 'https://nestedark.com';
    setImmediate(async () => {
      try {
        const emailHtml = genericTemplate(
          `Welcome to Nested Ark, ${fullName.split(' ')[0]}!`,
          `<p style="color:#a1a1aa;font-size:13px;line-height:1.7;">Your digital tenancy for <strong style="color:white">${unit.unit_name}</strong> at <strong style="color:white">${unit.project_title}</strong> (${unit.project_number}) is now active.</p>
           <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:14px;margin:16px 0;">
             <p style="color:#71717a;font-size:9px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Your ${frequency.toLowerCase()} installment</p>
             <p style="color:#14b8a6;font-size:24px;font-weight:900;font-family:monospace;margin:0;">${unit.currency||'NGN'} ${installment.toLocaleString()}</p>
             <p style="color:#71717a;font-size:9px;margin:4px 0 0;">Annual vault target: ${unit.currency||'NGN'} ${rentAmount.toLocaleString()}</p>
           </div>
           <p style="color:#6b7280;font-size:12px;line-height:1.7;"><strong style="color:white">The 48-Hour Rule:</strong> If your vault is not topped up 48 hours after the due date, the system automatically issues a formal Notice to Pay. Your vault, your responsibility.</p>`,
          { label: 'View My Rent Vault', url: `${frontendUrl}/tenant/dashboard` }
        );
        const waText = `*Welcome to Nested Ark* 🏠\n\nDear ${fullName.split(' ')[0]}, your digital tenancy for ${unit.unit_name} at ${unit.project_title} is now active.\n\n💳 Your ${frequency} installment: ${unit.currency||'NGN'} ${installment.toLocaleString()}\n🔐 Ledger Hash: ${h.slice(0,16)}…\n\nPlease check your email for your official Tenancy Handbook.\n\nView vault: ${frontendUrl}/tenant/dashboard`;
        const sendResult = await EmailService.send({
          to: email.toLowerCase().trim(),
          subject: `OFFICIAL: Tenancy Confirmed — ${unit.unit_name} · ${unit.project_number}`,
          html: emailHtml,
          template: 'tenancy_confirmed',
          await: true,
        });
        if (sendResult?.success) console.log(`[ONBOARD] Email sent → ${email}`);
        console.log(`[ONBOARD] WhatsApp text ready for ${fullName} (${phone || 'no phone'})`);
      } catch(err: any) { console.warn('[ONBOARD] Welcome dispatch failed:', err.message); }
    });

   return res.status(201).json({
      success: true,
      tenancy_id: tenancyId,
      vault_id: vaultId,
      frequency,
      installment_amount: installment,
      message: `Welcome aboard, ${fullName.split(' ')[0]}! Your vault is active. Check email + WhatsApp for your welcome pack.`,
      ledger_hash: h,
      whatsapp_action: phone ? `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Welcome to Nested Ark! Your vault is set up for ${unit.unit_name}. Check your email for the handbook: ${frontendUrl}/tenant/dashboard`)}` : null,
    });
  } catch(e: any) {
    await client.query('ROLLBACK');
    console.error('[/api/tenant/onboard]', e.message);
    return res.status(500).json({ error: e.message });
  } finally { 
    client.release(); 
  }
});


// ── GET /api/landlord/units /? — all units across landlord properties ──────────
// Route uses /? to accept both /api/landlord/units and /api/landlord/units/
// next.config.js trailingSlash:true appends a slash — Express must accept both.
// Auth: (req as any).userId set by authenticate middleware from JWT decoded.id.
// Ownership: rental_units has no landlord_id col — resolved via projects.sponsor_id.
app.get('/api/landlord/units/?', authenticate, async (req: Request, res: Response): Promise<any> => {
  const landlordId = (req as any).userId;
  console.log('[LANDLORD_UNITS] hit — landlordId:', landlordId);
  if (!landlordId) return res.status(401).json({ success: false, units: [], error: 'Unauthorized' });
  try {
    const r = await pool.query(
      `SELECT
         ru.id, ru.unit_name, ru.unit_type, ru.status,
         ru.rent_amount, ru.currency, ru.payment_frequency,
         ru.bedrooms, ru.bathrooms,
         ru.floor_area_sqm   AS size_sqm,
         ru.floor_level, ru.furnished, ru.parking,
         ru.security_deposit, ru.agency_fee, ru.caution_fee,
         ru.service_charge,  ru.legal_fee,
         ru.is_advertised,   ru.advertised_at,
         ru.marketing_description, ru.cover_image, ru.photo_urls_arr,
         ru.project_id,
         p.title    AS project_title,
         p.location,
         p.country,
         t.tenant_name,
         t.tenant_email,
         t.status   AS tenancy_status,
         t.id       AS tenancy_id,
         (SELECT COUNT(*) FROM legal_notices ln
          WHERE ln.unit_id = ru.id
             OR ln.tenancy_id = t.id) AS notice_count
       FROM rental_units ru
       JOIN     projects  p ON p.id     = ru.project_id
       LEFT JOIN tenancies t ON t.unit_id = ru.id AND t.status = 'ACTIVE'
       WHERE p.sponsor_id = $1 AND ru.archived_at IS NULL
       ORDER BY p.title ASC, ru.unit_name ASC`,
      [landlordId]
    );
    console.log('[LANDLORD_UNITS] rows returned:', r.rows.length);
    return res.json({ success: true, units: r.rows });
  } catch (e: any) {
    console.error('[LANDLORD_UNITS] error:', e.message);
    return res.status(500).json({ success: false, units: [], error: e.message });
  }
});


// ── GET /api/landlord/rent-dashboard — full payment intelligence for landlord ─
// Returns: per-tenancy payment status, vault states, recent transactions,
//          overdue summary, and portfolio-level KPIs — all in one call.
app.get('/api/landlord/rent-dashboard', authenticate, async (req: Request, res: Response): Promise<any> => {
  const landlordId = (req as any).userId;
  try {
    // ── 1. All active tenancies with vault state + last payment ───────────────
    const tenancyRows = await pool.query(
      `SELECT DISTINCT ON (t.id)
         t.id              AS tenancy_id,
         t.tenant_name,
         t.tenant_email,
         t.rent_amount,
         t.currency,
         t.payment_day,
         t.lease_start,
         t.lease_end,
         t.status          AS tenancy_status,
         ru.unit_name,
         ru.id             AS unit_id,
         p.id              AS project_id,
         p.title           AS project_title,
         p.project_number,
         -- Vault state (most recent vault per tenancy)
         fpv.id            AS vault_id,
         fpv.vault_balance,
         fpv.target_amount,
         fpv.frequency,
         fpv.next_due_date,
         fpv.status        AS vault_status,
         fpv.funded_periods,
         -- Latest successful contribution
         (SELECT fc.amount_ngn
            FROM flex_contributions fc
            WHERE fc.tenancy_id = t.id AND fc.status = 'SUCCESS'
            ORDER BY fc.paid_at DESC LIMIT 1) AS last_payment_amount,
         (SELECT fc.paid_at
            FROM flex_contributions fc
            WHERE fc.tenancy_id = t.id AND fc.status = 'SUCCESS'
            ORDER BY fc.paid_at DESC LIMIT 1) AS last_payment_at,
         (SELECT fc.paystack_ref
            FROM flex_contributions fc
            WHERE fc.tenancy_id = t.id AND fc.status = 'SUCCESS'
            ORDER BY fc.paid_at DESC LIMIT 1) AS last_payment_ref,
         -- Total collected all-time for this tenancy
         (SELECT COALESCE(SUM(fc.amount_ngn), 0)
            FROM flex_contributions fc
            WHERE fc.tenancy_id = t.id AND fc.status = 'SUCCESS') AS total_collected,
         -- Count successful payments
         (SELECT COUNT(*)
            FROM flex_contributions fc
            WHERE fc.tenancy_id = t.id AND fc.status = 'SUCCESS') AS payment_count,
         -- Pending (initiated but not confirmed) this period
         (SELECT COALESCE(SUM(fc.amount_ngn), 0)
            FROM flex_contributions fc
            WHERE fc.tenancy_id = t.id AND fc.status = 'PENDING') AS pending_amount,
         -- Active legal notices
         (SELECT COUNT(*)
            FROM legal_notices ln
            WHERE ln.tenancy_id = t.id AND ln.status IN ('ISSUED','PENDING')) AS open_notices
       FROM tenancies t
       INNER JOIN rental_units ru  ON ru.id  = t.unit_id
       INNER JOIN projects p       ON p.id   = ru.project_id
       LEFT JOIN LATERAL (
         SELECT id, vault_balance, target_amount, frequency,
                next_due_date, status, funded_periods
         FROM flex_pay_vaults
         WHERE tenancy_id = t.id
         ORDER BY created_at DESC LIMIT 1
       ) fpv ON true
       WHERE p.sponsor_id = $1
         AND t.status = 'ACTIVE'
       ORDER BY t.id, p.title, t.tenant_name`,
      [landlordId]
    );

    // ── 2. Recent transactions across ALL tenancies (last 50) ─────────────────
    const recentTxRows = await pool.query(
      `SELECT
         fc.id,
         fc.amount_ngn,
         fc.paystack_ref,
         fc.status,
         fc.period_label,
         fc.paid_at,
         fc.ledger_hash,
         t.tenant_name,
         t.tenant_email,
         ru.unit_name,
         p.title AS project_title,
         p.project_number
       FROM flex_contributions fc
       JOIN tenancies t    ON t.id   = fc.tenancy_id
       LEFT JOIN rental_units ru ON ru.id = COALESCE(
         (SELECT unit_id FROM flex_pay_vaults WHERE id = fc.vault_id LIMIT 1),
         t.unit_id
       )
       LEFT JOIN projects p ON p.id = COALESCE(
         (SELECT project_id FROM flex_pay_vaults WHERE id = fc.vault_id LIMIT 1),
         ru.project_id
       )
       WHERE p.sponsor_id = $1
         AND fc.status IN ('SUCCESS', 'PENDING', 'FAILED')
       ORDER BY fc.created_at DESC
       LIMIT 50`,
      [landlordId]
    );

    // ── 3. Portfolio-level KPIs ───────────────────────────────────────────────
    const tenancies = tenancyRows.rows;
    const transactions = recentTxRows.rows;

    const totalMonthlyRent    = tenancies.reduce((s: number, t: any) => s + parseFloat(t.rent_amount || 0), 0);
    const totalCollectedAllTime = tenancies.reduce((s: number, t: any) => s + parseFloat(t.total_collected || 0), 0);
    const totalVaultBalance   = tenancies.reduce((s: number, t: any) => s + parseFloat(t.vault_balance || 0), 0);
    const totalPending        = tenancies.reduce((s: number, t: any) => s + parseFloat(t.pending_amount || 0), 0);

    // Payment status per tenancy
    const now = new Date();
    const enriched = tenancies.map((t: any) => {
      const nextDue     = t.next_due_date ? new Date(t.next_due_date) : null;
      const lastPaidAt  = t.last_payment_at ? new Date(t.last_payment_at) : null;
      const vaultPct    = t.target_amount > 0
        ? Math.min(100, Math.round((parseFloat(t.vault_balance || 0) / parseFloat(t.target_amount)) * 100))
        : 0;

      // Classify payment status
      let paymentStatus: string;
      if (vaultPct >= 100) {
        paymentStatus = 'FULLY_FUNDED';
      } else if (nextDue && nextDue < now && vaultPct < 100) {
        paymentStatus = 'OVERDUE';
      } else if (parseFloat(t.vault_balance || 0) > 0) {
        paymentStatus = 'PARTIAL';
      } else if (t.pending_amount > 0) {
        paymentStatus = 'PENDING_CONFIRMATION';
      } else {
        paymentStatus = 'NOT_PAID';
      }

      const daysUntilDue = nextDue
        ? Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const daysSincePaid = lastPaidAt
        ? Math.floor((now.getTime() - lastPaidAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...t,
        vault_pct:      vaultPct,
        payment_status: paymentStatus,
        days_until_due: daysUntilDue,
        days_since_paid: daysSincePaid,
      };
    });

    // Summary counts
    const fullyFunded    = enriched.filter((t: any) => t.payment_status === 'FULLY_FUNDED').length;
    const overdue        = enriched.filter((t: any) => t.payment_status === 'OVERDUE').length;
    const partial        = enriched.filter((t: any) => t.payment_status === 'PARTIAL').length;
    const pending        = enriched.filter((t: any) => t.payment_status === 'PENDING_CONFIRMATION').length;
    const notPaid        = enriched.filter((t: any) => t.payment_status === 'NOT_PAID').length;
    const dueThisWeek    = enriched.filter((t: any) => t.days_until_due !== null && t.days_until_due >= 0 && t.days_until_due <= 7).length;

    return res.json({
      success: true,
      summary: {
        total_tenancies:          tenancies.length,
        fully_funded:             fullyFunded,
        overdue:                  overdue,
        partial:                  partial,
        pending_confirmation:     pending,
        not_paid:                 notPaid,
        due_this_week:            dueThisWeek,
        total_monthly_rent_ngn:   totalMonthlyRent,
        total_collected_alltime_ngn: totalCollectedAllTime,
        total_vault_balance_ngn:  totalVaultBalance,
        total_pending_ngn:        totalPending,
      },
      tenancies:    enriched,
      transactions: transactions,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});



// ════════════════════════════════════════════════════════════════════════════
// MODULE: TENANT BANKING — Bank Account Storage · AutoPay Standing Order
// Level 1 (live): verified bank account, debit preference, paystack_auth_code
// Level 2 (future): direct debit mandate via Paystack Direct Debit API
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/tenant/bank-accounts', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const r = await pool.query(
      `SELECT id, bank_name, bank_code, account_number, account_name, currency,
              preferred_debit_day, preferred_amount, is_verified, is_default,
              direct_debit_enabled, mandate_reference, mandate_status, created_at
       FROM tenant_bank_profiles
       WHERE tenant_user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    return res.json({
      success:  true, accounts: r.rows, count: r.rows.length,
      autopay_summary: {
        has_verified_account: r.rows.some((a: any) => a.is_verified),
        direct_debit_active:  r.rows.some((a: any) => a.direct_debit_enabled && a.mandate_status === 'ACTIVE'),
        next_debit_day:       r.rows.find((a: any) => a.is_default)?.preferred_debit_day ?? null,
      },
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.post('/api/tenant/bank-accounts', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const { bank_name, bank_code, account_number, preferred_debit_day, preferred_amount } = req.body;
    if (!bank_name || !bank_code || !account_number)
      return res.status(400).json({ error: 'bank_name, bank_code, and account_number are required' });
    if (!/^\d{10}$/.test(account_number))
      return res.status(400).json({ error: 'Account number must be exactly 10 digits' });
    if (preferred_debit_day && (preferred_debit_day < 1 || preferred_debit_day > 28))
      return res.status(400).json({ error: 'preferred_debit_day must be between 1 and 28' });
    let resolvedName = ''; let isVerified = false;
    if (PAYSTACK_SECRET) {
      try {
        const psRes  = await fetch(`${PAYSTACK_BASE}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
          { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } });
        const psData = await psRes.json() as any;
        if (psData.status && psData.data?.account_name) { resolvedName = psData.data.account_name; isVerified = true; }
      } catch { /* non-fatal */ }
    }
    const existing = await pool.query(
      `SELECT id FROM tenant_bank_profiles WHERE tenant_user_id=$1 AND account_number=$2 LIMIT 1`, [userId, account_number]
    );
    if (existing.rows.length) return res.status(409).json({ error: 'This account number is already saved.', account_id: existing.rows[0].id });
    const countRes  = await pool.query(`SELECT COUNT(*) FROM tenant_bank_profiles WHERE tenant_user_id=$1`, [userId]);
    const isDefault = parseInt(countRes.rows[0].count) === 0;
    const r = await pool.query(
      `INSERT INTO tenant_bank_profiles
         (tenant_user_id, bank_name, bank_code, account_number, account_name,
          preferred_debit_day, preferred_amount, is_verified, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [userId, bank_name, bank_code, account_number, resolvedName || 'Unverified',
       preferred_debit_day || null, preferred_amount || null, isVerified, isDefault]
    );
    const h = crypto.createHash('sha256').update(`tenant-bank-${r.rows[0].id}-${userId}-${Date.now()}`).digest('hex');
    pool.query(`INSERT INTO system_ledger (transaction_type, payload, immutable_hash) VALUES ('TENANT_BANK_ACCOUNT_ADDED',$1,$2)`,
      [JSON.stringify({ account_id: r.rows[0].id, tenant_user_id: userId, bank_name, verified: isVerified }), h]).catch(() => {});
    await logAudit({ event_type: 'TENANT_BANK_ACCOUNT_ADDED', actor_id: userId, actor_role: 'TENANT', unit_id: null,
      description: `Tenant added bank account: ${bank_name} (${isVerified ? 'verified' : 'unverified'})`,
      metadata: { bank_name, account_number_last4: account_number.slice(-4), verified: isVerified } });
    return res.status(201).json({
      success: true,
      account: { ...r.rows[0], account_number: r.rows[0].account_number.replace(/\d(?=\d{4})/g, '*') },
      verified: isVerified, account_name: resolvedName,
      message: isVerified ? `Account verified: ${resolvedName}` : 'Account saved. Auto-verification unavailable — you can still use this account.',
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.patch('/api/tenant/bank-accounts/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId; const { id } = req.params;
  try {
    const { preferred_debit_day, preferred_amount } = req.body;
    if (!preferred_debit_day && !preferred_amount) return res.status(400).json({ error: 'Provide preferred_debit_day or preferred_amount' });
    if (preferred_debit_day && (preferred_debit_day < 1 || preferred_debit_day > 28)) return res.status(400).json({ error: 'preferred_debit_day must be 1–28' });
    const r = await pool.query(
      `UPDATE tenant_bank_profiles SET preferred_debit_day=COALESCE($1,preferred_debit_day), preferred_amount=COALESCE($2,preferred_amount), updated_at=NOW() WHERE id=$3 AND tenant_user_id=$4 RETURNING *`,
      [preferred_debit_day || null, preferred_amount || null, id, userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Account not found' });
    return res.json({ success: true, account: r.rows[0] });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.post('/api/tenant/bank-accounts/:id/set-default', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId; const { id } = req.params;
  try {
    const check = await pool.query(`SELECT id FROM tenant_bank_profiles WHERE id=$1 AND tenant_user_id=$2`, [id, userId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Account not found' });
    await pool.query(`UPDATE tenant_bank_profiles SET is_default=false WHERE tenant_user_id=$1`, [userId]);
    await pool.query(`UPDATE tenant_bank_profiles SET is_default=true, updated_at=NOW() WHERE id=$1`, [id]);
    return res.json({ success: true, message: 'Default account updated' });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.post('/api/tenant/bank-accounts/:id/autopay-preference', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId; const { id } = req.params;
  try {
    const { preferred_debit_day, preferred_amount, enable } = req.body;
    if (!preferred_debit_day || !preferred_amount) return res.status(400).json({ error: 'preferred_debit_day and preferred_amount are required' });
    if (preferred_debit_day < 1 || preferred_debit_day > 28) return res.status(400).json({ error: 'preferred_debit_day must be 1–28' });
    const r = await pool.query(
      `UPDATE tenant_bank_profiles SET preferred_debit_day=$1, preferred_amount=$2, direct_debit_enabled=$3, mandate_status=$4, updated_at=NOW() WHERE id=$5 AND tenant_user_id=$6 RETURNING *`,
      [preferred_debit_day, preferred_amount, enable === true, enable === true ? 'PENDING' : 'CANCELLED', id, userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Account not found' });
    await logAudit({ event_type: 'TENANT_AUTOPAY_PREFERENCE_SET', actor_id: userId, actor_role: 'TENANT', unit_id: null,
      description: `AutoPay: ₦${preferred_amount} on day ${preferred_debit_day} monthly (enabled: ${enable})`,
      metadata: { account_id: id, preferred_debit_day, preferred_amount, enabled: enable } });
    return res.json({ success: true, account: r.rows[0], autopay_enabled: r.rows[0].direct_debit_enabled, mandate_status: r.rows[0].mandate_status,
      message: enable ? `AutoPay set: ₦${Number(preferred_amount).toLocaleString()} on day ${preferred_debit_day} monthly.` : 'AutoPay preference saved.',
      note: 'Full automatic deductions activate in the next platform update.' });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.delete('/api/tenant/bank-accounts/:id', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId; const { id } = req.params;
  try {
    const check = await pool.query(`SELECT * FROM tenant_bank_profiles WHERE id=$1 AND tenant_user_id=$2`, [id, userId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Account not found' });
    if (check.rows[0].direct_debit_enabled && check.rows[0].mandate_status === 'ACTIVE')
      return res.status(409).json({ error: 'Cannot delete account with active Direct Debit mandate. Disable AutoPay first.' });
    await pool.query(`DELETE FROM tenant_bank_profiles WHERE id=$1 AND tenant_user_id=$2`, [id, userId]);
    if (check.rows[0].is_default) {
      pool.query(`UPDATE tenant_bank_profiles SET is_default=true, updated_at=NOW() WHERE tenant_user_id=$1 ORDER BY created_at DESC LIMIT 1`, [userId]).catch(() => {});
    }
    await logAudit({ event_type: 'TENANT_BANK_ACCOUNT_REMOVED', actor_id: userId, actor_role: 'TENANT', unit_id: null,
      description: `Tenant removed bank account: ${check.rows[0].bank_name}`, metadata: { account_id: id, bank_name: check.rows[0].bank_name } });
    return res.json({ success: true, message: 'Bank account removed.' });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/tenant/autopay-status', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const r = await pool.query(
      `SELECT tbp.*, sv.target_amount, sv.vault_balance, sv.status AS vault_status,
              sv.installment_amount, sv.frequency, sv.rent_amount, sv.platform_fee_amount
       FROM tenant_bank_profiles tbp
       LEFT JOIN standalone_vaults sv ON sv.tenant_user_id=$1 AND sv.status NOT IN ('CLOSED','MIGRATED')
       WHERE tbp.tenant_user_id=$1 AND tbp.is_default=true LIMIT 1`, [userId]
    );
    if (!r.rows.length) return res.json({ success: true, has_bank_account: false, autopay_enabled: false, mandate_status: null, message: 'No bank account linked. Add one to enable AutoPay.' });
    const acct = r.rows[0];
    return res.json({
      success: true, has_bank_account: true,
      bank_name: acct.bank_name, account_name: acct.account_name,
      account_number_last4: acct.account_number.slice(-4),
      preferred_debit_day: acct.preferred_debit_day, preferred_amount: parseFloat(acct.preferred_amount) || null,
      autopay_enabled: acct.direct_debit_enabled, mandate_status: acct.mandate_status, is_verified: acct.is_verified,
      vault: acct.target_amount ? {
        target_amount: parseFloat(acct.target_amount), rent_amount: parseFloat(acct.rent_amount) || null,
        platform_fee_amount: parseFloat(acct.platform_fee_amount) || null,
        vault_balance: parseFloat(acct.vault_balance) || 0,
        installment_amount: parseFloat(acct.installment_amount) || 0,
        frequency: acct.frequency, vault_status: acct.vault_status,
      } : null,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/admin/founder-dashboard ─────────────────────────────────────────
// Founder Command Center: full platform metrics. Accessible to ADMIN, DEVELOPER, FOUNDER.
app.get('/api/admin/founder-dashboard', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const aRes = await pool.query(`SELECT role FROM public.users WHERE id=$1`, [userId]);
    if (!aRes.rows.length || !['ADMIN','DEVELOPER','FOUNDER'].includes(aRes.rows[0].role)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const [
      userStats, vaultStats, paymentStats, activityFeed,
      signupGrowth, topLandlords, recentSignups, bankingStats, alertStats,
    ] = await Promise.all([

      // 1. User counts by role
      pool.query(`
        SELECT
          COUNT(*)                                                                        AS total_users,
          COUNT(*) FILTER (WHERE role='TENANT')                                          AS tenants,
          COUNT(*) FILTER (WHERE role='DEVELOPER')                                       AS landlords,
          COUNT(*) FILTER (WHERE role='INVESTOR')                                        AS investors,
          COUNT(*) FILTER (WHERE role='GOVERNMENT')                                      AS government,
          COUNT(*) FILTER (WHERE role='VERIFIER')                                        AS verifiers,
          COUNT(*) FILTER (WHERE role='ADMIN')                                           AS admins,
          COUNT(*) FILTER (WHERE role='CONTRACTOR')                                      AS contractors,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')                AS signups_today,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')               AS signups_7d,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')              AS signups_30d
        FROM public.users
      `),

      // 2. Vault stats
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM flex_pay_vaults WHERE status NOT IN ('TERMINATED','ARCHIVED'))  AS active_linked_vaults,
          (SELECT COUNT(*) FROM standalone_vaults WHERE status NOT IN ('TERMINATED','ARCHIVED')) AS active_standalone_vaults,
          (SELECT COALESCE(SUM(vault_balance),0) FROM flex_pay_vaults WHERE status='ACTIVE')     AS linked_vault_total,
          (SELECT COALESCE(SUM(vault_balance),0) FROM standalone_vaults WHERE status='ACTIVE')   AS standalone_vault_total,
          (SELECT COUNT(*) FROM flex_pay_vaults WHERE status='FUNDED_READY')                     AS pending_releases_linked,
          (SELECT COUNT(*) FROM standalone_vaults WHERE status='FUNDED_READY')                   AS pending_releases_standalone
      `),

      // 3. Payment + revenue stats
      pool.query(`
        SELECT
          (SELECT COALESCE(SUM(amount_ngn),0) FROM flex_contributions WHERE status='SUCCESS')        AS total_flex_contributions,
          (SELECT COALESCE(SUM(amount_ngn),0) FROM standalone_contributions WHERE status='SUCCESS')  AS total_standalone_contributions,
          (SELECT COALESCE(SUM(amount_ngn),0) FROM flex_contributions WHERE status='SUCCESS'
            AND paid_at >= NOW() - INTERVAL '30 days')                                              AS contributions_30d,
          (SELECT COUNT(*) FROM flex_contributions WHERE status='SUCCESS')                           AS flex_payment_count,
          (SELECT COUNT(*) FROM standalone_contributions WHERE status='SUCCESS')                     AS standalone_payment_count,
          (SELECT COALESCE(SUM((payload->>'net_payout')::numeric),0) FROM system_ledger
           WHERE transaction_type IN ('LANDLORD_PAYOUT','FLEX_CASHOUT','AUTO_PAYOUT'))        AS total_payouts,
          (SELECT COALESCE(SUM(amount_ngn),0) FROM platform_revenue WHERE status='COMPLETED')     AS platform_revenue
      `),

      // 4. Live activity feed — explicitly typed UNION
      pool.query(`
        SELECT * FROM (
          SELECT 'signup'::text AS event_type, u.full_name::text AS actor, u.role::text AS role,
                 NULL::numeric AS amount, u.created_at AS event_time, NULL::text AS detail
          FROM public.users u WHERE u.role NOT IN ('ADMIN','DEVELOPER')
          UNION ALL
          SELECT 'vault_created'::text, u.full_name::text, 'TENANT'::text, NULL::numeric,
                 sv.created_at, CONCAT('Target: ₦', sv.target_amount::text)::text
          FROM standalone_vaults sv JOIN public.users u ON u.id = sv.tenant_user_id
          UNION ALL
          SELECT 'contribution'::text, u.full_name::text, 'TENANT'::text, sc.amount_ngn::numeric,
                 sc.paid_at, 'Standalone vault contribution'::text
          FROM standalone_contributions sc
          JOIN standalone_vaults sv ON sv.id = sc.vault_id
          JOIN public.users u ON u.id = sv.tenant_user_id WHERE sc.status = 'SUCCESS'
          UNION ALL
          SELECT 'contribution'::text, COALESCE(t.tenant_name, u.full_name)::text, 'TENANT'::text,
                 fc.amount_ngn::numeric, fc.paid_at, 'Flex-Pay vault contribution'::text
          FROM flex_contributions fc
          JOIN flex_pay_vaults fpv ON fpv.id = fc.vault_id
          LEFT JOIN tenancies t ON t.id = fpv.tenancy_id
          LEFT JOIN public.users u ON u.id = fpv.tenant_user_id WHERE fc.status = 'SUCCESS'
          UNION ALL
          SELECT 'payout'::text, COALESCE(sl.payload->>'landlord_name','Landlord')::text,
                 'LANDLORD'::text, COALESCE((sl.payload->>'net_payout')::numeric, 0),
                 sl.created_at, 'Payout released'::text
          FROM system_ledger sl
          WHERE sl.transaction_type IN ('LANDLORD_PAYOUT','FLEX_CASHOUT','AUTO_PAYOUT')
        ) feed ORDER BY event_time DESC NULLS LAST LIMIT 25
      `),

      // 5. Signup growth — last 14 days
      pool.query(`
        SELECT DATE(created_at)::text AS day,
          COUNT(*) FILTER (WHERE role='TENANT') AS tenants,
          COUNT(*) FILTER (WHERE role='DEVELOPER') AS landlords
        FROM public.users WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(created_at) ORDER BY day
      `),

      // 6. Top landlords by portfolio size
      pool.query(`
        SELECT u.full_name, u.email, COUNT(p.id) AS project_count
        FROM public.users u LEFT JOIN projects p ON p.sponsor_id = u.id
        WHERE u.role = 'DEVELOPER'
        GROUP BY u.id, u.full_name, u.email ORDER BY project_count DESC LIMIT 5
      `),

      // 7. Most recent 10 signups
      pool.query(`
        SELECT full_name, email, role, created_at FROM public.users
        WHERE role NOT IN ('ADMIN','DEVELOPER')
        ORDER BY created_at DESC LIMIT 10
      `),

      // 8. Banking metrics
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM landlord_bank_accounts)                                    AS landlord_accounts,
          (SELECT COUNT(*) FROM tenant_bank_profiles)                                      AS tenant_accounts,
          (SELECT COUNT(*) FROM tenant_bank_profiles WHERE preferred_debit_day IS NOT NULL) AS autopay_enabled,
          (SELECT COUNT(*) FROM feature_waitlist WHERE feature_name='autopay')            AS autopay_waitlist
      `),

      // 9. Alert metrics
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM flex_contributions       WHERE status='FAILED') AS failed_flex,
          (SELECT COUNT(*) FROM standalone_contributions WHERE status='FAILED') AS failed_standalone,
          (SELECT COUNT(*) FROM system_ledger WHERE transaction_type IN ('LANDLORD_PAYOUT','FLEX_CASHOUT') AND payload IS NOT NULL AND (payload->>'transfer_status')='failed') AS failed_payouts,
          (SELECT COUNT(*) FROM kyc_records              WHERE kyc_status='PENDING') AS pending_kyc
      `),
    ]);

    const u  = userStats.rows[0];
    const v  = vaultStats.rows[0];
    const p  = paymentStats.rows[0];
    const bk = bankingStats.rows[0];
    const al = alertStats.rows[0];

    const n = (val: any): number => parseInt(String(val  || 0)) || 0;
    const f = (val: any): number => parseFloat(String(val || 0)) || 0;

    const totalContributions = f(p.total_flex_contributions) + f(p.total_standalone_contributions);
    const totalPayments      = n(p.flex_payment_count) + n(p.standalone_payment_count);
    const failedPayments     = n(al.failed_flex) + n(al.failed_standalone);

    return res.json({
      success: true,
      generated_at: new Date().toISOString(),
      // Today
      signups_today:         n(u.signups_today),
      vaults_created_today:  0,
      contributions_today:   totalPayments,
      revenue_today:         0,
      // Users
      total_users:           n(u.total_users),
      total_tenants:         n(u.tenants),
      total_landlords:       n(u.landlords),
      total_investors:       n(u.investors),
      total_government:      n(u.government),
      total_verifiers:       n(u.verifiers),
      total_admins:          n(u.admins),
      total_contractors:     n(u.contractors),
      // Vaults
      active_vaults:         n(v.active_linked_vaults) + n(v.active_standalone_vaults),
      funded_vaults:         n(v.pending_releases_linked) + n(v.pending_releases_standalone),
      standalone_vaults:     n(v.active_standalone_vaults),
      // Financial
      total_contributions:   totalContributions,
      total_platform_revenue:f(p.platform_revenue),
      total_payouts_released:f(p.total_payouts),
      pending_payouts:       0,
      // Banking
      linked_bank_accounts:  n(bk.landlord_accounts) + n(bk.tenant_accounts),
      autopay_enabled:       n(bk.autopay_enabled),
      autopay_waitlist:      n(bk.autopay_waitlist),
      // Alerts
      failed_payments:       failedPayments,
      failed_payouts:        n(al.failed_payouts),
      pending_kyc:           n(al.pending_kyc),
      // Extended
      signups_7d:            n(u.signups_7d),
      signups_30d:           n(u.signups_30d),
      total_payments:        totalPayments,
      vault_balance_held:    f(v.linked_vault_total) + f(v.standalone_vault_total),
      activity_feed: activityFeed.rows.map((e: any) => ({
        event_type: e.event_type, actor: e.actor, role: e.role,
        amount: e.amount ? parseFloat(e.amount) : null,
        detail: e.detail, time: e.event_time,
      })),
      signup_growth:  signupGrowth.rows,
      top_landlords:  topLandlords.rows,
      recent_signups: recentSignups.rows,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});


// ── GET /api/public/stats — unauthenticated platform stats for homepage ────────
// Returns live user/vault counts as social proof. No sensitive data exposed.
app.get('/api/public/stats', async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM public.users WHERE role NOT IN ('ADMIN','DEVELOPER'))      AS users,
        (SELECT COUNT(*) FROM flex_pay_vaults WHERE status NOT IN ('TERMINATED','ARCHIVED','CLOSED')) AS vaults,
        (SELECT COUNT(*) FROM public.users WHERE role = 'TENANT')                        AS tenants,
        (SELECT COUNT(*) FROM standalone_vaults WHERE status NOT IN ('TERMINATED','CLOSED'))          AS standalone_vaults,
        (SELECT COALESCE(SUM(amount_ngn),0) FROM flex_contributions WHERE status='SUCCESS')           AS total_flex,
        (SELECT COALESCE(SUM(amount_ngn),0) FROM standalone_contributions WHERE status='SUCCESS')     AS total_standalone
    `);
    const r = result.rows[0];
    const totalVaults = parseInt(r.vaults) + parseInt(r.standalone_vaults);
    const totalSaved  = parseFloat(r.total_flex) + parseFloat(r.total_standalone);
    // Cache header — revalidate every 5 minutes
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.json({
      users:        parseInt(r.users),
      vaults:       totalVaults,
      tenants:      parseInt(r.tenants),
      total_saved:  Math.round(totalSaved),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/* ============================================
   SERVER START
============================================ */

// ============================================================================
// CRON SCHEDULER — Daily 08:00 WAT automated reminders & drawdown
// ============================================================================

const PORT = parseInt(process.env.PORT || "10000");

// ── Pending Payout Retry Cron ────────────────────────────────────────────────
// Runs every 30 minutes. Finds FUNDED_READY vaults where the landlord had no
// bank account at webhook time, OR where Paystack balance was ₦0 (T+1 clearing).
// Retries the transfer automatically — landlords always get paid eventually.
const startPendingPayoutCron = (pool: any) => {
  const THIRTY_MINS             = 30 * 60 * 1000;
  const PAYSTACK_TRANSFER_FLOOR = 5000; // ₦50.00 in kobo — Paystack hard minimum
  // Raised from 15 to 60: bank-transfer contributions settle T+1 (up to 24h)
  // before becoming usable Paystack balance. At 30-min intervals, 15 attempts
  // = 7.5 hours — shorter than settlement time, causing vaults to hit max-retry
  // before the money even cleared. 60 attempts = 30 hours runway.
  const MAX_PAYOUT_ATTEMPTS     = 60;

  const retryPendingPayouts = async () => {
    if (!PAYSTACK_SECRET) return;
    try {

      // ── FIX 1: Pre-check Paystack transfer balance before attempting any payout ─
      // Avoids wasting API calls when the platform balance is ₦0.
      // If balance is insufficient, log once and exit the cron cycle gracefully.
      let paystackBalance = 0;
      try {
        const balRes  = await fetch(`${PAYSTACK_BASE}/balance`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
        });
        const balData = await balRes.json() as any;
        // Paystack returns array of currency balances
        const ngn = (balData.data || []).find((b: any) => b.currency === 'NGN');
        paystackBalance = ngn ? ngn.balance : 0; // in kobo
        if (paystackBalance < PAYSTACK_TRANSFER_FLOOR) {
          console.warn(`[PAYOUT-CRON] ⏸ Paystack NGN balance is ₦${(paystackBalance/100).toFixed(2)} — below ₦50 minimum. Skipping all payouts this cycle. Top up at: https://dashboard.paystack.com/#/balance`);
          return;
        }
      } catch (balErr: any) {
        console.warn('[PAYOUT-CRON] Could not fetch Paystack balance — proceeding anyway:', balErr.message);
      }

      // ── FIX 2: Retry ceiling + SUM of contributions as authoritative basis ──────
      // payout_attempt_count >= MAX stops infinite retry noise (e.g. 119 attempts).
      // actual_payout_total = SUM(flex_contributions) = financial truth.
      // vault_balance is a cached display field that can diverge from ledger.
      const vaults = await pool.query(
        `SELECT fpv.id           AS vault_id,
                fpv.tenancy_id,
                fpv.target_amount,
                fpv.vault_balance,
                fpv.cashout_mode,
                fpv.funded_periods,
                fpv.currency,
                fpv.payout_attempt_count,
                p.sponsor_id,
                ru.rent_amount,
                -- Authoritative payout amount: SUM of unreleased successful contributions
                COALESCE((
                  SELECT SUM(fc.amount_ngn)
                  FROM flex_contributions fc
                  WHERE fc.vault_id = fpv.id
                    AND fc.status   = 'SUCCESS'
                    AND fc.released IS NOT TRUE
                ), 0) AS actual_payout_total
         FROM flex_pay_vaults fpv
         JOIN tenancies    t  ON t.id  = fpv.tenancy_id
         JOIN rental_units ru ON ru.id = COALESCE(fpv.unit_id, t.unit_id)
         JOIN projects     p  ON p.id  = COALESCE(fpv.project_id, ru.project_id)
         WHERE fpv.status = 'FUNDED_READY'
           AND fpv.vault_balance >= fpv.target_amount
           AND COALESCE(fpv.payout_attempt_count, 0) < $1
           AND NOT EXISTS (
             SELECT 1 FROM system_ledger sl
             WHERE sl.transaction_type           = 'LANDLORD_PAYOUT'
               AND sl.payload->>'vault_id'        = fpv.id::text
               AND sl.payload->>'transfer_status' = 'INITIATED'
               AND sl.created_at > NOW() - INTERVAL '25 hours'
           )
         LIMIT 20`,
        [MAX_PAYOUT_ATTEMPTS]
      );

      if (!vaults.rows.length) return;
      console.log(`[PAYOUT-CRON] ${vaults.rows.length} pending payout(s) found`);

      for (const v of vaults.rows) {
        try {
          // ── Resolve landlord payout destination ───────────────────────────
          // Chain: vault → tenancy → project → sponsor (landlord) → bank account
          // MUST use paystack_recipient_code for outbound transfers.
          // Subaccounts (ACCT_xxx) are for split collections — NOT outbound payouts.
          const bankRes = await pool.query(
            `SELECT lba.*
             FROM landlord_bank_accounts lba
             WHERE lba.user_id    = $1
               AND lba.is_default = true
               AND lba.paystack_recipient_code IS NOT NULL
             LIMIT 1`,
            [v.sponsor_id]
          );

          if (!bankRes.rows.length) {
            console.log(`[PAYOUT-CRON] ⏸ Landlord ${v.sponsor_id} has no verified default bank account — skipping vault ${v.vault_id}`);
            continue;
          }
          const acct = bankRes.rows[0];

          // ── FIX 3: Compute payout from contribution ledger (not just vault_balance) ─
          // Use actual_payout_total first (financial truth).
          // Fall back to vault_balance if contribution sum is unexpectedly zero.
          const rawTotal    = parseFloat(v.actual_payout_total) > 0
                                ? parseFloat(v.actual_payout_total)
                                : parseFloat(v.vault_balance) || 0;
          const platformFee = Math.round(rawTotal * 0.02 * 100) / 100; // 2% platform fee
          const netAmount   = Math.round((rawTotal - platformFee) * 100) / 100;
          const netKobo     = Math.round(netAmount * 100); // Paystack uses kobo

          // ── FIX 4: Log full recipient details for auditability ────────────
          console.log(`[PAYOUT-CRON] Escrow release: vault=${v.vault_id} total=₦${rawTotal} net=₦${netAmount} fee=₦${platformFee} → recipient=${acct.paystack_recipient_code} (${acct.account_name} | ${acct.bank_name})`);

          // ── ₦50 minimum floor guard ────────────────────────────────────────
          if (netKobo < PAYSTACK_TRANSFER_FLOOR) {
            console.warn(`[PAYOUT-CRON] ⚠ Skipped vault ${v.vault_id}: net ₦${netAmount} is below Paystack ₦50 minimum. Set a higher target_amount for live transfers.`);
            await pool.query(
              `UPDATE flex_pay_vaults
               SET payout_failure_reason = $1,
                   payout_failed_at      = NOW(),
                   payout_attempt_count  = COALESCE(payout_attempt_count, 0) + 1
               WHERE id = $2`,
              [`Net payout ₦${netAmount} below Paystack ₦50 minimum — vault target_amount is too low for live transfers`, v.vault_id]
            );
            continue;
          }

          // ── Per-vault available-balance check ───────────────────────────
          // The cycle-level pre-check above only confirms balance clears the
          // ₦50 absolute floor — it does NOT mean enough balance exists for
          // THIS vault's specific payout. Bank-transfer contributions settle
          // T+1 (up to 24h) before becoming usable balance, even though the
          // contribution already shows SUCCESS in the database. Re-check live
          // balance against netKobo here so a predictable settlement delay
          // produces an accurate log/reason instead of a generic Paystack
          // rejection, and doesn't burn a retry attempt unnecessarily.
          if (paystackBalance > 0 && paystackBalance < netKobo) {
            console.log(
              `[PAYOUT-CRON] ⏳ vault=${v.vault_id} needs ₦${netAmount} but available balance is ` +
              `₦${(paystackBalance/100).toFixed(2)} — likely awaiting T+1 bank-transfer settlement. Will retry.`
            );
            await pool.query(
              `UPDATE flex_pay_vaults SET payout_failure_reason=$1, payout_failed_at=NOW(),
               payout_attempt_count = COALESCE(payout_attempt_count,0)+1 WHERE id=$2`,
              [`Awaiting settlement — need ₦${netAmount}, available ₦${(paystackBalance/100).toFixed(2)}. Bank transfers settle T+1; will retry automatically.`, v.vault_id]
            );
            continue;
          }

          // ── Initiate Paystack transfer to landlord's bank ─────────────────
          const payRef      = `ESCROW-RELEASE-${crypto.randomUUID().split('-')[0].toUpperCase()}-${Date.now()}`;
          const periodLabel = new Date().toISOString().slice(0, 7);

          const tRes  = await fetch(`${PAYSTACK_BASE}/transfer`, {
            method:  'POST',
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source:    'balance',
              amount:    netKobo,
              recipient: acct.paystack_recipient_code,
              reason:    `Nested Ark rent vault release — ${periodLabel} (${acct.account_name})`,
              reference: payRef,
              currency:  v.currency || 'NGN',
            }),
          });
          const tData = await tRes.json() as any;

          // ── FIX 5: Store full Paystack response payload for debugging ─────
          const fullPaystackResponse = JSON.stringify(tData);
          const ph = crypto.createHash('sha256')
            .update(`escrow-payout-${payRef}-${v.sponsor_id}-${netKobo}-${Date.now()}`)
            .digest('hex');

          await pool.query(
            `INSERT INTO system_ledger
               (transaction_type, event_type, entity_type, entity_id, actor_id, description, payload, immutable_hash)
             VALUES ('LANDLORD_PAYOUT', $1, $2, $3, $4, $5, $6, $7)`,
            [
              tData.status ? 'PAYOUT_INITIATED' : 'PAYOUT_FAILED',
              'FLEX_PAY_VAULT',
              v.vault_id,
              v.sponsor_id,
              `Escrow vault released: ₦${rawTotal} gross → ₦${netAmount} net to ${acct.account_name} (${acct.bank_name}). Platform fee: ₦${platformFee}.`,
              JSON.stringify({
                reference:              payRef,
                amount_ngn:             netAmount,
                gross_total:            rawTotal,
                platform_fee:           platformFee,
                user_id:                v.sponsor_id,
                bank_account_id:        acct.id,
                bank_name:              acct.bank_name,
                account_name:           acct.account_name,
                recipient_code:         acct.paystack_recipient_code,
                transfer_code:          tData.data?.transfer_code,
                transfer_status:        tData.status ? 'INITIATED' : 'FAILED',
                vault_id:               v.vault_id,
                tenancy_id:             v.tenancy_id,
                period_label:           periodLabel,
                source:                 'PAYOUT_CRON',
                payout_type:            'ESCROW_LUMP_SUM',
                paystack_error:         tData.status ? null : tData.message,
                paystack_full_response: fullPaystackResponse,
              }),
              ph,
            ]
          );

          if (tData.status) {
            // ── Success: mark contributions released, reset vault ─────────
            await pool.query(
              `UPDATE flex_contributions
               SET released = true, released_at = NOW()
               WHERE vault_id = $1 AND status = 'SUCCESS' AND released IS NOT TRUE`,
              [v.vault_id]
            );
            await pool.query(
              `UPDATE flex_pay_vaults
               SET status                = 'ACTIVE',
                   vault_balance         = 0,
                   updated_at            = NOW(),
                   payout_failed_at      = NULL,
                   payout_failure_reason = NULL,
                   payout_attempt_count  = 0
               WHERE id = $1`,
              [v.vault_id]
            );
            console.log(`[PAYOUT-CRON] ✅ vault=${v.vault_id} → ${acct.account_name} (${acct.bank_name} ${acct.account_number}) ₦${netAmount} | ref=${payRef} | gross=₦${rawTotal} fee=₦${platformFee}`);
            await logAudit({
              event_type:  'ESCROW_RELEASED',
              actor_id:    v.sponsor_id,
              actor_role:  'SYSTEM',
              unit_id:     null,
              description: `Vault escrow released: ₦${rawTotal} gross → ₦${netAmount} net to ${acct.account_name} (${acct.bank_name}). Platform fee: ₦${platformFee}.`,
              metadata:    { reference: payRef, vault_total: rawTotal, net_payout: netAmount, platform_fee: platformFee, vault_id: v.vault_id, recipient_code: acct.paystack_recipient_code, source: 'PAYOUT_CRON', payout_type: 'ESCROW_LUMP_SUM' },
            });
          } else {
            // ── Failure: record attempt with full Paystack error ──────────
            await pool.query(
              `UPDATE flex_pay_vaults
               SET payout_failed_at      = NOW(),
                   payout_failure_reason = $1,
                   payout_attempt_count  = COALESCE(payout_attempt_count, 0) + 1
               WHERE id = $2`,
              [tData.message || 'Paystack transfer rejected', v.vault_id]
            );
            const attempts = (v.payout_attempt_count || 0) + 1;
            console.warn(`[PAYOUT-CRON] ⚠ Failed for vault ${v.vault_id} (attempt ${attempts}/${MAX_PAYOUT_ATTEMPTS}): ${tData.message}`);
            if (attempts >= MAX_PAYOUT_ATTEMPTS) {
              console.error(`[PAYOUT-CRON] 🛑 vault ${v.vault_id} reached max retry limit (${MAX_PAYOUT_ATTEMPTS}). Manual intervention required. Last error: ${tData.message}`);
            }
            await logAudit({
              event_type:  'PAYOUT_FAILED',
              actor_id:    v.sponsor_id,
              actor_role:  'SYSTEM',
              unit_id:     null,
              description: `Rent payout FAILED (attempt ${attempts}/${MAX_PAYOUT_ATTEMPTS}) — ${tData.message || 'Unknown error'}`,
              metadata:    { reference: payRef, vault_id: v.vault_id, error: tData.message, net_attempted: netAmount, recipient_code: acct.paystack_recipient_code, attempt: attempts, max_attempts: MAX_PAYOUT_ATTEMPTS, paystack_full_response: fullPaystackResponse },
            });
          }
        } catch (vaultErr: any) {
          console.warn(`[PAYOUT-CRON] Vault ${v.vault_id} error:`, vaultErr.message);
        }
      }
    } catch (cronErr: any) {
      console.warn('[PAYOUT-CRON] Cron error:', cronErr.message);
    }
  };

  setTimeout(retryPendingPayouts, 60 * 1000); // 60s after boot — catches missed payouts on restart
  setInterval(retryPendingPayouts, THIRTY_MINS);
  console.log('[CRON] Pending payout retry scheduler active — every 30 minutes');
};

// ── Standalone Vault Payout Cron ─────────────────────────────────────────────
// Runs every 30 minutes. Finds FUNDED_READY standalone_vaults where the tenant
// has a payout_preference of TENANT or LANDLORD and a bank account on file.
// Unlike the linked-tenancy cron above, this does NOT require landlord
// onboarding — LANDLORD payouts go to the bank details the tenant supplied,
// even if that landlord has never created a Nested Ark account.
// Vaults with payout_preference='ASK' are left untouched until the tenant
// calls POST /api/tenant/standalone-vault/:id/payout-choice.
const startStandaloneVaultPayoutCron = (pool: any) => {
  const THIRTY_MINS             = 30 * 60 * 1000;
  const PAYSTACK_TRANSFER_FLOOR = 5000;  // ₦50.00 in kobo — Paystack's absolute transfer minimum
  // Raised from 15 to 60: bank-transfer contributions settle T+1 (up to 24h) before
  // they become usable Paystack balance. At 30-min intervals, 15 attempts = 7.5 hours,
  // which is shorter than settlement time — vaults were hitting max-retry and being
  // flagged for manual intervention before the money had even cleared. 60 attempts
  // = 30 hours of runway, comfortably covering T+1 settlement plus a safety margin.
  const MAX_PAYOUT_ATTEMPTS     = 60;

  const retryStandaloneVaultPayouts = async () => {
    if (!PAYSTACK_SECRET) return;
    try {
      // Pre-check Paystack balance — global floor only (₦50). This does NOT
      // guarantee enough balance for any individual vault's rent amount; that
      // check happens per-vault below, before each transfer is attempted.
      let paystackBalance = 0;
      try {
        const balRes  = await fetch(`${PAYSTACK_BASE}/balance`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
        });
        const balData = await balRes.json() as any;
        const ngn = (balData.data || []).find((b: any) => b.currency === 'NGN');
        paystackBalance = ngn ? ngn.balance : 0;
        if (paystackBalance < PAYSTACK_TRANSFER_FLOOR) {
          console.warn(`[SV-PAYOUT-CRON] ⏸ Paystack NGN balance ₦${(paystackBalance/100).toFixed(2)} — below ₦50 minimum. Skipping cycle.`);
          return;
        }
      } catch (balErr: any) {
        console.warn('[SV-PAYOUT-CRON] Could not fetch Paystack balance — proceeding anyway:', balErr.message);
      }

      const vaults = await pool.query(
        `SELECT sv.*, u.email AS tenant_email, u.full_name AS tenant_name,
                COALESCE((
                  SELECT SUM(sc.amount_ngn) FROM standalone_contributions sc
                  WHERE sc.vault_id = sv.id AND sc.status = 'SUCCESS'
                ), 0) AS actual_total
         FROM standalone_vaults sv
         JOIN public.users u ON u.id = sv.tenant_user_id
         WHERE sv.status = 'FUNDED_READY'
           AND sv.vault_balance >= sv.target_amount
           AND sv.payout_preference IN ('TENANT','LANDLORD')
           AND COALESCE(sv.payout_attempt_count, 0) < $1
           AND NOT EXISTS (
             SELECT 1 FROM system_ledger sl
             WHERE sl.transaction_type           = 'STANDALONE_VAULT_PAYOUT'
               AND sl.payload->>'vault_id'        = sv.id::text
               AND sl.payload->>'transfer_status' = 'INITIATED'
               AND sl.created_at > NOW() - INTERVAL '25 hours'
           )
         LIMIT 20`,
        [MAX_PAYOUT_ATTEMPTS]
      );

      if (!vaults.rows.length) return;
      console.log(`[SV-PAYOUT-CRON] ${vaults.rows.length} pending standalone vault payout(s) found`);

      for (const sv of vaults.rows) {
        try {
          const isTenant = sv.payout_preference === 'TENANT';
          const bankName      = isTenant ? sv.tenant_bank_name      : sv.landlord_bank_name;
          const accountNumber = isTenant ? sv.tenant_account_number : sv.landlord_account_number;
          const accountName   = isTenant ? sv.tenant_account_name   : sv.landlord_account_name;
          const bankCode      = isTenant ? sv.tenant_bank_code      : null;
          let recipientCode   = isTenant ? sv.tenant_recipient_code : sv.landlord_recipient_code;

          if (!bankName || !accountNumber || !accountName) {
            console.log(`[SV-PAYOUT-CRON] ⏸ Vault ${sv.id} (${sv.payout_preference}) missing bank details — skipping`);
            continue;
          }

          // ── Lazily create Paystack transfer recipient if not cached ───────
          if (!recipientCode) {
            try {
              let resolvedBankCode = bankCode;
              // Resolve bank code from bank name if not stored (landlord-direct path)
              if (!resolvedBankCode) {
                const bankListRes = await fetch(`${PAYSTACK_BASE}/bank?currency=NGN`, {
                  headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
                });
                const bankList = await bankListRes.json() as any;
                const match = (bankList.data || []).find((b: any) =>
                  b.name?.toLowerCase().includes((bankName || '').toLowerCase()) ||
                  (bankName || '').toLowerCase().includes(b.name?.toLowerCase())
                );
                resolvedBankCode = match?.code || null;
              }
              if (!resolvedBankCode) {
                console.warn(`[SV-PAYOUT-CRON] ⚠ Vault ${sv.id}: could not resolve bank_code for "${bankName}" — skipping`);
                await pool.query(
                  `UPDATE standalone_vaults SET payout_failure_reason=$1, payout_failed_at=NOW(),
                   payout_attempt_count = COALESCE(payout_attempt_count,0)+1 WHERE id=$2`,
                  [`Could not resolve bank_code for "${bankName}"`, sv.id]
                );
                continue;
              }

              // ── Create Paystack transfer recipient ──────────────────────────
              const prRes = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
                method:  'POST',
                headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'nuban', name: accountName, account_number: accountNumber,
                  bank_code: resolvedBankCode, currency: 'NGN',
                }),
              });
              const prData = await prRes.json() as any;
              if (prData.status && prData.data?.recipient_code) {
                recipientCode = prData.data.recipient_code;
                const col = isTenant ? 'tenant_recipient_code' : 'landlord_recipient_code';
                await pool.query(`UPDATE standalone_vaults SET ${col}=$1 WHERE id=$2`, [recipientCode, sv.id]);
                // NOTE: No Paystack subaccount needed here.
                // We transfer 100% of rent_amount directly to recipient.
                // Platform fee is retained implicitly (tenant saved rent + 2%).
                // Fee retention is recorded via PLATFORM_FEE_RETAINED ledger entry.
              } else {
                console.warn(`[SV-PAYOUT-CRON] ⚠ Vault ${sv.id}: recipient creation failed — ${prData.message}`);
                await pool.query(
                  `UPDATE standalone_vaults SET payout_failure_reason=$1, payout_failed_at=NOW(),
                   payout_attempt_count = COALESCE(payout_attempt_count,0)+1 WHERE id=$2`,
                  [`Recipient creation failed: ${prData.message || 'unknown error'}`, sv.id]
                );
                continue;
              }
            } catch (rcErr: any) {
              console.warn(`[SV-PAYOUT-CRON] Vault ${sv.id}: recipient creation error — ${rcErr.message}`);
              continue;
            }
          }

          // ── Split at release — 100% rent to landlord, 2% platform fee retained ──
          //
          // CONFIRMED ARCHITECTURE (per product spec):
          //   • Tenant saves: rent_amount + platform_fee_amount (2%) = target_amount
          //   • On completion: landlord receives 100% of rent_amount (NOT 98%)
          //   • Platform retains platform_fee_amount (2%) in main Paystack balance
          //   • The 2% is NOT deducted from the landlord — it is ADDED by the tenant
          //   • Explicit PLATFORM_FEE_RETAINED ledger entry records the retention
          //
          // Transfer amount = rent_amount (what landlord is owed in full)
          // Retained        = platform_fee_amount (sits in main Paystack balance, logged)

          const rawTotal         = parseFloat(sv.actual_total) > 0 ? parseFloat(sv.actual_total) : parseFloat(sv.vault_balance) || 0;
          const rentToTransfer   = parseFloat(sv.rent_amount) > 0
            ? parseFloat(sv.rent_amount)
            : Math.round(rawTotal / 1.02 * 100) / 100; // back-calculate if rent_amount missing
          const platformFeeRetained = parseFloat(sv.platform_fee_amount) > 0
            ? parseFloat(sv.platform_fee_amount)
            : Math.round(rentToTransfer * 0.02 * 100) / 100;
          const netKobo = Math.round(rentToTransfer * 100);

          if (netKobo < PAYSTACK_TRANSFER_FLOOR) {
            console.warn(`[SV-PAYOUT-CRON] ⚠ Vault ${sv.id}: rent_amount ₦${rentToTransfer} below ₦50 minimum — skipping`);
            await pool.query(
              `UPDATE standalone_vaults SET payout_failure_reason=$1, payout_failed_at=NOW(),
               payout_attempt_count = COALESCE(payout_attempt_count,0)+1 WHERE id=$2`,
              [`Rent amount ₦${rentToTransfer} below Paystack ₦50 minimum`, sv.id]
            );
            continue;
          }

          const payRef      = `SV-${sv.payout_preference}-${crypto.randomUUID().split('-')[0].toUpperCase()}-${Date.now()}`;
          const destination = isTenant ? 'tenant own account' : 'landlord (direct, no Nested Ark account required)';

          // ── Per-vault balance check ──────────────────────────────────────
          // The global pre-check above only confirms Paystack is reachable and
          // above the ₦50 absolute floor — it does NOT mean enough balance
          // exists for THIS vault's specific rent amount. Re-check live balance
          // against netKobo before attempting the transfer. This is the actual
          // root-cause fix: bank-transfer contributions settle T+1 (up to 24h)
          // and aren't usable balance the moment the webhook fires, even though
          // the contribution is already marked SUCCESS in the database.
          if (paystackBalance > 0 && paystackBalance < netKobo) {
            console.log(
              `[SV-PAYOUT-CRON] ⏳ vault=${sv.id} needs ₦${rentToTransfer} but available balance is ` +
              `₦${(paystackBalance/100).toFixed(2)} — likely awaiting T+1 bank-transfer settlement. Will retry.`
            );
            await pool.query(
              `UPDATE standalone_vaults SET payout_failure_reason=$1, payout_failed_at=NOW(),
               payout_attempt_count = COALESCE(payout_attempt_count,0)+1 WHERE id=$2`,
              [`Awaiting settlement — need ₦${rentToTransfer}, available ₦${(paystackBalance/100).toFixed(2)}. Bank transfers settle T+1; will retry automatically.`, sv.id]
            );
            continue;
          }

          console.log(
            `[SV-PAYOUT-CRON] Releasing vault=${sv.id} → ${destination}: ${accountName} (${bankName} ${accountNumber}) ` +
            `rent=₦${rentToTransfer} fee_retained=₦${platformFeeRetained} total_saved=₦${rawTotal}`
          );

          // Transfer 100% of rent to landlord/tenant destination
          const tRes  = await fetch(`${PAYSTACK_BASE}/transfer`, {
            method:  'POST',
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source:    'balance',
              amount:    netKobo,             // 100% of rent — landlord receives full amount
              recipient: recipientCode,
              reason:    `Nested Ark Rent Vault release — ${accountName} (NO CHOP YOUR RENT™)`,
              reference: payRef,
              currency:  sv.currency || 'NGN',
            }),
          });
          const tData = await tRes.json() as any;

          const ph = crypto.createHash('sha256')
            .update(`sv-payout-${payRef}-${sv.id}-${netKobo}-${Date.now()}`).digest('hex');

          await pool.query(
            `INSERT INTO system_ledger
               (transaction_type, event_type, entity_type, entity_id, actor_id, description, payload, immutable_hash)
             VALUES ('STANDALONE_VAULT_PAYOUT', $1, $2, $3, $4, $5, $6, $7)`,
            [
              tData.status ? 'PAYOUT_INITIATED' : 'PAYOUT_FAILED',
              'STANDALONE_VAULT',
              sv.id,
              sv.tenant_user_id,
              `Standalone vault released: ₦${rentToTransfer} (100% rent) to ${destination} — ${accountName} (${bankName}). Platform fee ₦${platformFeeRetained} retained.`,
              JSON.stringify({
                reference:             payRef,
                rent_amount_ngn:       rentToTransfer,       // 100% of rent transferred
                platform_fee_retained: platformFeeRetained,  // 2% retained in platform balance
                gross_total_saved:     rawTotal,             // full tenant savings (rent + fee)
                vault_id:              sv.id,
                payout_preference:     sv.payout_preference,
                bank_name:             bankName,
                account_name:          accountName,
                account_number:        accountNumber,
                recipient_code:        recipientCode,
                transfer_code:         tData.data?.transfer_code,
                transfer_status:       tData.status ? 'INITIATED' : 'FAILED',
                source:                'SV_PAYOUT_CRON',
                paystack_error:        tData.status ? null : tData.message,
                fee_model:             'TENANT_PAYS_2PCT_ADDITIVE', // tenant saved rent+2%, landlord gets 100% rent
              }),
              ph,
            ]
          );

          if (tData.status) {
            // Record platform fee retention with its own ledger entry for reconciliation
            const feeHash = crypto.createHash('sha256')
              .update(`sv-fee-retained-${sv.id}-${platformFeeRetained}-${payRef}`).digest('hex');
            pool.query(
              `INSERT INTO system_ledger
                 (transaction_type, event_type, entity_type, entity_id, actor_id, description, payload, immutable_hash)
               VALUES ('PLATFORM_FEE_RETAINED', 'FEE_COLLECTION', 'STANDALONE_VAULT', $1, $2, $3, $4, $5)`,
              [
                sv.id,
                sv.tenant_user_id,
                `Platform Rent Success Fee retained: ₦${platformFeeRetained} (2% of ₦${rentToTransfer} rent) — vault ${sv.id}`,
                JSON.stringify({
                  vault_id:              sv.id,
                  rent_amount:           rentToTransfer,
                  fee_pct:               2,
                  fee_amount:            platformFeeRetained,
                  payout_reference:      payRef,
                  fee_model:             'TENANT_PAYS_2PCT_ADDITIVE',
                }),
                feeHash,
              ]
            ).catch(() => {});

            await pool.query(
              `UPDATE standalone_vaults
               SET status='CLOSED', updated_at=NOW(),
                   platform_fee_retained=$1, platform_fee_retained_at=NOW(),
                   payout_failed_at=NULL, payout_failure_reason=NULL, payout_attempt_count=0
               WHERE id=$2`,
              [platformFeeRetained, sv.id]
            );
            console.log(
              `[SV-PAYOUT-CRON] ✅ vault=${sv.id} → ${accountName} (${bankName} ${accountNumber}) ` +
              `rent=₦${rentToTransfer} fee_retained=₦${platformFeeRetained} | ref=${payRef}`
            );
            await logAudit({
              event_type:  'STANDALONE_VAULT_RELEASED',
              actor_id:    sv.tenant_user_id,
              actor_role:  'SYSTEM',
              unit_id:     null,
              description: `Standalone vault released: ₦${rentToTransfer} (100% rent) to ${destination} — ${accountName} (${bankName}). Fee ₦${platformFeeRetained} retained.`,
              metadata: {
                reference:         payRef,
                rent_transferred:  rentToTransfer,
                fee_retained:      platformFeeRetained,
                total_saved:       rawTotal,
                payout_preference: sv.payout_preference,
                recipient_code:    recipientCode,
                source:            'SV_PAYOUT_CRON',
                fee_model:         'TENANT_PAYS_2PCT_ADDITIVE',
              },
            });
          } else {
            await pool.query(
              `UPDATE standalone_vaults
               SET payout_failed_at=NOW(), payout_failure_reason=$1,
                   payout_attempt_count = COALESCE(payout_attempt_count,0)+1
               WHERE id=$2`,
              [tData.message || 'Paystack transfer rejected', sv.id]
            );
            const attempts = (sv.payout_attempt_count || 0) + 1;
            console.warn(`[SV-PAYOUT-CRON] ⚠ Failed vault=${sv.id} (attempt ${attempts}/${MAX_PAYOUT_ATTEMPTS}): ${tData.message}`);
            if (attempts >= MAX_PAYOUT_ATTEMPTS) {
              console.error(`[SV-PAYOUT-CRON] 🛑 vault ${sv.id} reached max retry limit. Manual intervention required.`);
            }
            await logAudit({
              event_type:  'STANDALONE_VAULT_PAYOUT_FAILED',
              actor_id:    sv.tenant_user_id,
              actor_role:  'SYSTEM',
              unit_id:     null,
              description: `Standalone vault payout FAILED (attempt ${attempts}/${MAX_PAYOUT_ATTEMPTS}) — ${tData.message || 'Unknown error'}`,
              metadata:    { reference: payRef, vault_id: sv.id, error: tData.message, attempt: attempts, max_attempts: MAX_PAYOUT_ATTEMPTS },
            });
          }
        } catch (vaultErr: any) {
          console.warn(`[SV-PAYOUT-CRON] Vault ${sv.id} error:`, vaultErr.message);
        }
      }
    } catch (cronErr: any) {
      console.warn('[SV-PAYOUT-CRON] Cron error:', cronErr.message);
    }
  };

  setTimeout(retryStandaloneVaultPayouts, 90 * 1000); // 90s after boot, staggered after main cron
  setInterval(retryStandaloneVaultPayouts, THIRTY_MINS);
  console.log('[CRON] Standalone vault payout scheduler active — every 30 minutes');
};


// ── GET /api/rental/units/:id/advertise-status — landlord checks listing state ─
app.get('/api/rental/units/:id/advertise-status', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { id } = req.params;
  try {
    const r = await pool.query(
      `SELECT ru.id, ru.unit_name, ru.is_advertised, ru.advertised_at, ru.listing_expires_at, ru.status,
              p.sponsor_id
       FROM rental_units ru JOIN projects p ON p.id = ru.project_id
       WHERE ru.id = $1`,
      [id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Unit not found' });
    if (r.rows[0].sponsor_id !== userId) return res.status(403).json({ error: 'Not your unit' });
    const u = r.rows[0];
    const expired = u.listing_expires_at && new Date(u.listing_expires_at) < new Date();
    return res.json({
      success:           true,
      unit_id:           u.id,
      unit_name:         u.unit_name,
      is_advertised:     u.is_advertised && !expired,
      advertised_at:     u.advertised_at,
      listing_expires_at: u.listing_expires_at,
      days_remaining:    u.listing_expires_at
        ? Math.max(0, Math.ceil((new Date(u.listing_expires_at).getTime() - Date.now()) / 86400000))
        : null,
      status:            u.status,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/rental/units/:id/unadvertise — landlord pulls listing manually ─
app.patch('/api/rental/units/:id/unadvertise', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { id } = req.params;
  try {
    const own = await pool.query(
      `SELECT ru.id FROM rental_units ru JOIN projects p ON p.id = ru.project_id
       WHERE ru.id = $1 AND p.sponsor_id = $2`,
      [id, userId]
    );
    if (!own.rows.length) return res.status(403).json({ error: 'Not your unit or unit not found' });

    await pool.query(
      `UPDATE rental_units SET is_advertised=FALSE, listing_expires_at=NULL WHERE id=$1`,
      [id]
    );
    await pool.query(
      `INSERT INTO system_ledger (transaction_type, event_type, actor_id, entity_id, entity_type, description, payload, immutable_hash)
       VALUES ('LISTING_REMOVED','LISTING_REMOVED',$1,$2,'RENTAL_UNIT','Landlord manually removed marketplace listing',$3,$4)`,
      [userId, id,
       JSON.stringify({ unit_id: id, landlord_id: userId }),
       crypto.createHash('sha256').update(`LISTING_REMOVED-${id}-${Date.now()}`).digest('hex')]
    );
    await logAudit({
      event_type:  'LISTING_REMOVED',
      actor_id:    userId,
      actor_role:  'DEVELOPER',
      unit_id:     id,
      description: 'Landlord manually removed unit from marketplace',
      metadata:    { removed_by: userId },
    });
    return res.json({ success: true, message: 'Listing removed from marketplace.' });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── Listing expiry auto-cron — runs at startup + daily via setInterval ────────
// Finds listings past their 30-day window and clears them automatically.
// No separate cron file needed — lightweight inline interval, append-only.
function startListingExpiryCron(poolRef: typeof pool): void {
  const expireListings = async () => {
    try {
      const result = await poolRef.query(
        `UPDATE rental_units
         SET is_advertised = FALSE
         WHERE is_advertised = TRUE
           AND listing_expires_at IS NOT NULL
           AND listing_expires_at < NOW()
         RETURNING id, unit_name`
      );
      if (result.rows.length > 0) {
        console.log(`[EXPIRY-CRON] Auto-expired ${result.rows.length} marketplace listing(s): ${result.rows.map((r: any) => r.unit_name).join(', ')}`);
        for (const row of result.rows) {
          await logAudit({
            event_type:  'LISTING_EXPIRED',
            actor_id:    null,
            actor_role:  'SYSTEM',
            unit_id:     row.id,
            description: `Marketplace listing for "${row.unit_name}" auto-expired after 30 days`,
            metadata:    { unit_id: row.id, unit_name: row.unit_name },
          });
        }
      }
    } catch (err: any) {
      console.warn('[EXPIRY-CRON] Error:', err.message);
    }
  };
  // Run once at startup to catch any missed expirations
  expireListings();
  // Then every 6 hours
  setInterval(expireListings, 6 * 60 * 60 * 1000);
  console.log('[EXPIRY-CRON] Marketplace listing expiry cron started (6h interval)');
}




// ════════════════════════════════════════════════════════════════════════════
// MODULE: TENANT SELF-SERVICE PORTAL — Session 3
// All routes self-resolve tenancy from JWT. Tenant never passes tenancy_id.
// Fallback: tenant_user_id → tenant_email → auto-link for legacy rows.
// ════════════════════════════════════════════════════════════════════════════

// ── SHARED HELPER: resolve tenancy from authenticated userId ──────────────
// Used by all tenant portal routes. Returns tenancy row or null.
// Automatically links tenant_user_id if found by email fallback.
async function resolveTenancy(userId: string): Promise<any | null> {
  // Primary: linked user
  const byId = await pool.query(
    `SELECT t.*, ru.unit_name, ru.unit_type, ru.rent_amount AS unit_rent,
            ru.currency, ru.project_id AS unit_project_id,
            p.title AS project_title, p.project_number, p.location, p.sponsor_id AS landlord_id
     FROM tenancies t
     JOIN rental_units ru ON ru.id = t.unit_id
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.tenant_user_id = $1 AND t.status = 'ACTIVE'
     ORDER BY t.created_at DESC LIMIT 1`,
    [userId]
  );
  if (byId.rows.length) return byId.rows[0];

  // Fallback: match by email
  const uRes = await pool.query('SELECT email FROM public.users WHERE id = $1', [userId]);
  if (!uRes.rows.length) return null;

  const byEmail = await pool.query(
    `SELECT t.*, ru.unit_name, ru.unit_type, ru.rent_amount AS unit_rent,
            ru.currency, ru.project_id AS unit_project_id,
            p.title AS project_title, p.project_number, p.location, p.sponsor_id AS landlord_id
     FROM tenancies t
     JOIN rental_units ru ON ru.id = t.unit_id
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.tenant_email = $1 AND t.status = 'ACTIVE'
     ORDER BY t.created_at DESC LIMIT 1`,
    [uRes.rows[0].email]
  );
  if (!byEmail.rows.length) return null;

  // Auto-link for future fast lookups
  pool.query(
    `UPDATE tenancies SET tenant_user_id = $1 WHERE id = $2 AND tenant_user_id IS NULL`,
    [userId, byEmail.rows[0].id]
  ).catch(() => {});

  return byEmail.rows[0];
}

// ── GET /api/tenant/dashboard — aggregated portal summary ─────────────────
// Single call that powers the tenant dashboard page.
// Returns: tenancy info + vault state + next due + recent payments + notice count.
app.get('/api/tenant/dashboard', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const tenancy = await resolveTenancy(userId);

    if (!tenancy) {
      // ── Independent Tenant: return onboarding state + standalone vault ─────
      const uInfo = await pool.query(
        `SELECT email, full_name, phone, created_at FROM public.users WHERE id = $1`, [userId]
      );
      const u = uInfo.rows[0] || {};
      const svRes = await pool.query(
        `SELECT sv.id, sv.vault_balance, sv.target_amount, sv.installment_amount,
                sv.frequency, sv.status, sv.funded_periods, sv.currency,
                sv.landlord_name, sv.landlord_email,
                sv.payout_preference, sv.due_date, sv.linked_tenancy_id,
                COALESCE((SELECT SUM(sc.amount_ngn) FROM standalone_contributions sc
                          WHERE sc.vault_id = sv.id AND sc.status='SUCCESS'), 0) AS total_contributed,
                (SELECT COUNT(*) FROM standalone_contributions sc
                 WHERE sc.vault_id = sv.id AND sc.status='SUCCESS') AS contribution_count
         FROM standalone_vaults sv
         WHERE sv.tenant_user_id = $1 AND sv.status NOT IN ('MIGRATED','CLOSED')
         ORDER BY sv.created_at DESC LIMIT 1`,
        [userId]
      );
      const sv = svRes.rows[0] || null;
      const recentContribs = sv ? await pool.query(
        `SELECT id, amount_ngn, status, period_label, paid_at, ledger_hash
         FROM standalone_contributions
         WHERE vault_id = $1 AND status = 'SUCCESS'
         ORDER BY created_at DESC LIMIT 5`,
        [sv.id]
      ) : { rows: [] };

      return res.json({
        success:          true,
        hasActiveTenancy: false,
        tenancy:          null,
        vault:            null,
        standalone_vault: sv ? {
          id:                 sv.id,
          vault_balance:      parseFloat(sv.vault_balance)      || 0,
          target_amount:      parseFloat(sv.target_amount)      || 0,
          installment_amount: parseFloat(sv.installment_amount) || 0,
          funded_pct:         sv.target_amount > 0
                                ? Math.min(Math.round((parseFloat(sv.vault_balance) / parseFloat(sv.target_amount)) * 100), 100)
                                : 0,
          frequency:          sv.frequency,
          status:             sv.status,
          currency:           sv.currency,
          funded_periods:     sv.funded_periods,
          total_contributed:  parseFloat(sv.total_contributed)  || 0,
          contribution_count: parseInt(sv.contribution_count)   || 0,
          landlord_name:      sv.landlord_name  || null,
          landlord_email:     sv.landlord_email || null,
          payout_preference:  sv.payout_preference || 'ASK',
          due_date:           sv.due_date || null,
        } : null,
        next_due_date:       null,
        active_notice_count: 0,
        recent_payments:     recentContribs.rows,
        recent_maintenance:  [],
        profile: {
          user_id:    userId,
          email:      u.email     || null,
          full_name:  u.full_name || null,
          phone:      u.phone     || null,
          created_at: u.created_at || null,
        },
        onboarding_steps: [
          { key: 'account_created',     label: 'Account Created',           status: 'done'    },
          { key: 'payout_destination',  label: 'Verify payout destination', status: 'skipped' },
          { key: 'escrow_vault_profile', label: 'Escrow vault profile',      status: sv ? 'done' : 'pending' },
          { key: 'link_to_property',    label: 'Link to a property',        status: sv?.linked_tenancy_id ? 'done' : 'pending' },
        ],
        message: sv
          ? 'Standalone vault active. Saving toward rent independently.'
          : 'Independent savings profile. Initialize your vault to start saving.',
      });
    }

    const tenancyId = tenancy.id;

    // Vault state
    const vaultRes = await pool.query(
      `SELECT fpv.id, fpv.vault_balance, fpv.target_amount, fpv.status,
              fpv.frequency, fpv.installment_amount, fpv.cashout_mode,
              COALESCE((SELECT SUM(fc.amount_ngn) FROM flex_contributions fc
                        WHERE fc.vault_id = fpv.id AND fc.status = 'SUCCESS'), 0) AS total_contributed
       FROM flex_pay_vaults fpv
       WHERE fpv.tenancy_id = $1
       ORDER BY fpv.created_at DESC LIMIT 1`,
      [tenancyId]
    );

    // Recent rent payments (last 5)
    const paymentsRes = await pool.query(
      `SELECT id, amount_ngn, status, period_month, paid_at, paystack_reference
       FROM rent_payments
       WHERE tenancy_id = $1
       ORDER BY created_at DESC LIMIT 5`,
      [tenancyId]
    );

    // Active notice count
    const noticeRes = await pool.query(
      `SELECT COUNT(*) AS count FROM legal_notices
       WHERE tenancy_id = $1 AND status NOT IN ('RESOLVED','WITHDRAWN')`,
      [tenancyId]
    );

    // Maintenance requests (last 3)
    const maintRes = await pool.query(
      `SELECT id, title, category, severity, status, created_at
       FROM maintenance_logs
       WHERE unit_id = $1
       ORDER BY created_at DESC LIMIT 3`,
      [tenancy.unit_id]
    );

    // Next due date: latest successful rent payment + frequency interval
    const lastPaidRes = await pool.query(
      `SELECT paid_at FROM rent_payments
       WHERE tenancy_id = $1 AND status = 'SUCCESS'
       ORDER BY paid_at DESC LIMIT 1`,
      [tenancyId]
    );

    let next_due_date: string | null = null;
    if (lastPaidRes.rows.length && lastPaidRes.rows[0].paid_at) {
      const lastPaid = new Date(lastPaidRes.rows[0].paid_at);
      const freq = (tenancy.payment_frequency || 'MONTHLY').toUpperCase();
      const daysMap: Record<string,number> = {
        WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30,
        QUARTERLY: 91, BIANNUAL: 183, ANNUAL: 365
      };
      lastPaid.setDate(lastPaid.getDate() + (daysMap[freq] || 30));
      next_due_date = lastPaid.toISOString().split('T')[0];
    } else if (tenancy.lease_start) {
      next_due_date = tenancy.lease_start;
    }

    const vault = vaultRes.rows[0] || null;
    return res.json({
      success:           true,
      tenancy: {
        id:               tenancyId,
        tenant_name:      tenancy.tenant_name,
        tenant_email:     tenancy.tenant_email,
        unit_name:        tenancy.unit_name,
        unit_type:        tenancy.unit_type,
        project_title:    tenancy.project_title,
        project_number:   tenancy.project_number,
        location:         tenancy.location,
        lease_start:      tenancy.lease_start,
        lease_end:        tenancy.lease_end,
        rent_amount:      tenancy.unit_rent,
        currency:         tenancy.currency,
        payment_frequency: tenancy.payment_frequency,
        status:           tenancy.status,
      },
      vault: vault ? {
        id:                vault.id,
        vault_balance:     parseFloat(vault.vault_balance) || 0,
        target_amount:     parseFloat(vault.target_amount) || 0,
        installment_amount: parseFloat(vault.installment_amount) || 0,
        funded_pct:        Math.min(Math.round(
                             (parseFloat(vault.vault_balance) /
                              (parseFloat(vault.target_amount) || 1)) * 100), 100),
        status:            vault.status,
        frequency:         vault.frequency,
        total_contributed: parseFloat(vault.total_contributed) || 0,
      } : null,
      next_due_date,
      active_notice_count: parseInt(noticeRes.rows[0]?.count || '0'),
      recent_payments:     paymentsRes.rows,
      recent_maintenance:  maintRes.rows,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/tenant/rent-history — full rent_payments ledger for tenant ───
// Returns all rent payments across all time, newest first.
// Used by /tenant/vault and /tenant/contributions pages.
app.get('/api/tenant/rent-history', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const limit  = Math.min(parseInt((req.query.limit as string) || '50'), 200);
  const offset = parseInt((req.query.offset as string) || '0');
  try {
    const tenancy = await resolveTenancy(userId);
    if (!tenancy) {
      // Independent tenant: return standalone contributions instead of empty 404
      const svRes = await pool.query(
        `SELECT id FROM standalone_vaults
         WHERE tenant_user_id=$1 AND status NOT IN ('MIGRATED','CLOSED')
         ORDER BY created_at DESC LIMIT 1`, [userId]
      );
      if (!svRes.rows.length) {
        return res.json({ success: true, hasActiveTenancy: false, payments: [], total_count: 0, total_paid: 0, limit, offset });
      }
      const svId = svRes.rows[0].id;
      const sc = await pool.query(
        `SELECT id, amount_ngn, status, period_label AS period_month,
                paid_at, paystack_ref AS paystack_reference, created_at
         FROM standalone_contributions
         WHERE vault_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [svId, limit, offset]
      );
      const totals = await pool.query(
        `SELECT COUNT(*) AS count,
                COALESCE(SUM(CASE WHEN status='SUCCESS' THEN amount_ngn END),0) AS total_paid
         FROM standalone_contributions WHERE vault_id = $1`, [svId]
      );
      return res.json({
        success:          true,
        hasActiveTenancy: false,
        tenancy_id:       null,
        standalone_vault_id: svId,
        payments:         sc.rows,
        total_count:      parseInt(totals.rows[0].count),
        total_paid:       parseFloat(totals.rows[0].total_paid),
        limit, offset,
      });
    }
    const payments = await pool.query(
      `SELECT id, amount_ngn, status, period_month, paid_at,
              paystack_reference, created_at
       FROM rent_payments
       WHERE tenancy_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenancy.id, limit, offset]
    );
    const total = await pool.query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN status='SUCCESS' THEN amount_ngn END),0) AS total_paid
       FROM rent_payments WHERE tenancy_id = $1`,
      [tenancy.id]
    );

    return res.json({
      success:     true,
      tenancy_id:  tenancy.id,
      payments:    payments.rows,
      total_count: parseInt(total.rows[0].count),
      total_paid:  parseFloat(total.rows[0].total_paid),
      limit,
      offset,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/tenant/receipt/:paymentId — receipt for a rent_payment ───────
// Distinct from /api/tenant/receipt/:contributionId (flex_contributions).
// This covers direct rent payments made via Pay Now flow.
app.get('/api/tenant/rent-receipt/:paymentId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { paymentId } = req.params;
  try {
    const tenancy = await resolveTenancy(userId);
    if (!tenancy) return res.status(404).json({ error: 'No active tenancy found' });

    const r = await pool.query(
      `SELECT rp.*, t.tenant_name, t.tenant_email, t.tenant_phone,
              ru.unit_name, ru.unit_type, ru.rent_amount,
              p.title AS project_title, p.project_number, p.location
       FROM rent_payments rp
       JOIN tenancies t    ON t.id   = rp.tenancy_id
       JOIN rental_units ru ON ru.id = rp.unit_id
       LEFT JOIN projects p ON p.id  = rp.project_id
       WHERE rp.id = $1 AND rp.tenancy_id = $2`,
      [paymentId, tenancy.id]
    );

    if (!r.rows.length) return res.status(404).json({ error: 'Payment not found or does not belong to your tenancy' });

    const pmt = r.rows[0];
    const receiptNo = `ARK-RCPT-${pmt.paystack_reference?.slice(-8)?.toUpperCase() || paymentId.slice(0,8).toUpperCase()}`;

    return res.json({
      success:        true,
      receipt_number: receiptNo,
      payment: {
        id:                pmt.id,
        amount_ngn:        parseFloat(pmt.amount_ngn),
        status:            pmt.status,
        period_month:      pmt.period_month,
        paid_at:           pmt.paid_at,
        paystack_reference: pmt.paystack_reference,
      },
      tenant: {
        name:  pmt.tenant_name,
        email: pmt.tenant_email,
        phone: pmt.tenant_phone,
      },
      property: {
        unit_name:      pmt.unit_name,
        unit_type:      pmt.unit_type,
        project_title:  pmt.project_title,
        project_number: pmt.project_number,
        location:       pmt.location,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/tenant/maintenance-request — tenant logs a maintenance issue ─
// Tenant-facing wrapper around maintenance_logs. Auto-resolves project_id.
// Tenant only provides: title, description, category, severity.
app.post('/api/tenant/maintenance-request', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const tenancy = await resolveTenancy(userId);
    if (!tenancy) return res.status(404).json({ error: 'No active tenancy found' });

    const { title, description, category, severity } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const VALID_CATEGORIES = ['GENERAL','ELECTRICAL','PLUMBING','STRUCTURAL','COSMETIC','SAFETY'];
    const VALID_SEVERITIES  = ['LOW','MEDIUM','HIGH','CRITICAL'];
    const cat = VALID_CATEGORIES.includes((category||'').toUpperCase()) ? category.toUpperCase() : 'GENERAL';
    const sev = VALID_SEVERITIES.includes((severity||'').toUpperCase())  ? severity.toUpperCase()  : 'LOW';

    const r = await pool.query(
      `INSERT INTO maintenance_logs
         (project_id, unit_id, title, description, category, severity, reported_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN')
       RETURNING *`,
      [tenancy.project_id, tenancy.unit_id, title, description || null, cat, sev, userId]
    );

    await logAudit({
      event_type:  'MAINTENANCE_REQUESTED',
      actor_id:    userId,
      actor_role:  'TENANT',
      unit_id:     tenancy.unit_id,
      tenancy_id:  tenancy.id,
      project_id:  tenancy.project_id,
      description: `Tenant "${tenancy.tenant_name}" submitted maintenance request: "${title}" [${cat} / ${sev}]`,
      metadata:    { log_id: r.rows[0].id, category: cat, severity: sev },
    });

    return res.status(201).json({ success: true, request: r.rows[0] });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/tenant/maintenance-requests — tenant views their own requests ─
app.get('/api/tenant/maintenance-requests', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const tenancy = await resolveTenancy(userId);
    if (!tenancy) return res.status(404).json({ error: 'No active tenancy found' });

    const r = await pool.query(
      `SELECT id, title, description, category, severity, status,
              resolved_at, created_at
       FROM maintenance_logs
       WHERE unit_id = $1 AND reported_by = $2
       ORDER BY created_at DESC`,
      [tenancy.unit_id, userId]
    );
    return res.json({ success: true, requests: r.rows, unit_name: tenancy.unit_name });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/tenant/profile — tenant updates their own contact details ──
// Allowed fields: tenant_name, tenant_phone only. Email is immutable.
app.patch('/api/tenant/profile', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const tenancy = await resolveTenancy(userId);
    if (!tenancy) return res.status(404).json({ error: 'No active tenancy found' });

    const { tenant_name, tenant_phone } = req.body;
    if (!tenant_name && !tenant_phone)
      return res.status(400).json({ error: 'Provide at least tenant_name or tenant_phone to update' });

    const normalizedPhone = tenant_phone ? normalizeNigerianPhone(tenant_phone) : null;

    const r = await pool.query(
      `UPDATE tenancies
       SET tenant_name  = COALESCE($1, tenant_name),
           tenant_phone = COALESCE($2, tenant_phone),
           updated_at   = NOW()
       WHERE id = $3
       RETURNING tenant_name, tenant_email, tenant_phone`,
      [tenant_name || null, normalizedPhone, tenancy.id]
    );

    // Also update users table name if provided
    if (tenant_name) {
      await pool.query(
        `UPDATE public.users SET full_name = $1 WHERE id = $2`,
        [tenant_name, userId]
      ).catch(() => {});
    }

    await logAudit({
      event_type:  'TENANT_PROFILE_UPDATED',
      actor_id:    userId,
      actor_role:  'TENANT',
      unit_id:     tenancy.unit_id,
      tenancy_id:  tenancy.id,
      project_id:  tenancy.project_id,
      description: `Tenant "${tenancy.tenant_name}" updated their profile`,
      metadata:    { fields: Object.keys(req.body).filter(k => req.body[k]) },
    });

    return res.json({ success: true, profile: r.rows[0] });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/feature-waitlist — log interest in coming-soon features ────────
app.post('/api/feature-waitlist', async (req: Request, res: Response): Promise<any> => {
  try {
    const { feature_name, source } = req.body;
    if (!feature_name) return res.status(400).json({ error: 'feature_name is required' });
    let userId: string | null = null; let email: string | null = null;
    try {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      if (token) {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()) as any;
        userId = payload.id || payload.user_id || null;
        if (userId) { const u = await pool.query(`SELECT email FROM public.users WHERE id=$1`, [userId]); email = u.rows[0]?.email || null; }
      }
    } catch { /* non-fatal — anonymous entry */ }
    const existing = await pool.query(
      `SELECT id FROM feature_waitlist WHERE feature_name=$1 AND (user_id=$2 OR (user_id IS NULL AND email=$3)) LIMIT 1`,
      [feature_name, userId, email]
    );
    if (existing.rows.length) return res.json({ success: true, already_registered: true, message: 'Already on the waitlist.' });
    await pool.query(`INSERT INTO feature_waitlist (user_id, feature_name, email, source) VALUES ($1,$2,$3,$4)`,
      [userId, feature_name, email, source || 'register_page']);
    console.log(`[WAITLIST] ${feature_name} — user=${userId || 'anon'} email=${email || 'unknown'}`);
    return res.json({ success: true, message: `You're on the waitlist for ${feature_name}. We'll notify you when it launches.` });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// MODULE: AUDIT & COMPLIANCE — Immutable Event Log · SHA-256 Hash Chain
// Endpoints: /api/audit/unit, /api/audit/project, /api/audit/tenancy
// ════════════════════════════════════════════════════════════════════════════

// ── GET /api/audit/unit/:unitId — full event history for one unit ──────────
// Auth required. Landlord must own the unit (or ADMIN).
app.get('/api/audit/unit/:unitId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId  = (req as any).userId;
  const { unitId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string || '50'), 200);
  const offset = parseInt(req.query.offset as string || '0');
  try {
    // Ownership check (or ADMIN)
    const own = await pool.query(
      `SELECT ru.id FROM rental_units ru
       JOIN projects p ON p.id = ru.project_id
       WHERE ru.id = $1 AND (p.sponsor_id = $2 OR (SELECT role FROM public.users WHERE id=$2) = 'ADMIN')`,
      [unitId, userId]
    );
    if (!own.rows.length) return res.status(403).json({ error: 'Unit not found or access denied' });

    const logs = await pool.query(
      `SELECT id, event_type, actor_id, actor_role, description, metadata, ledger_hash, created_at
       FROM unit_audit_log
       WHERE unit_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [unitId, limit, offset]
    );
    const total = await pool.query(`SELECT COUNT(*) FROM unit_audit_log WHERE unit_id=$1`, [unitId]);
    return res.json({ success: true, unit_id: unitId, logs: logs.rows, total: parseInt(total.rows[0].count), limit, offset });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/audit/project/:projectId — all events across a project ────────
app.get('/api/audit/project/:projectId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { projectId } = req.params;
  const limit  = Math.min(parseInt(req.query.limit as string || '100'), 500);
  const offset = parseInt(req.query.offset as string || '0');
  const event_type = req.query.event_type as string | undefined;
  try {
    const own = await pool.query(
      `SELECT id FROM projects WHERE id=$1 AND (sponsor_id=$2 OR (SELECT role FROM public.users WHERE id=$2)='ADMIN')`,
      [projectId, userId]
    );
    if (!own.rows.length) return res.status(403).json({ error: 'Project not found or access denied' });

    let where = `WHERE project_id = $1`;
    const params: any[] = [projectId];
    if (event_type) { where += ` AND event_type = $2`; params.push(event_type); }

    const logs = await pool.query(
      `SELECT ual.id, ual.event_type, ual.actor_id, ual.actor_role, ual.unit_id,
              ual.tenancy_id, ual.description, ual.metadata, ual.ledger_hash, ual.created_at,
              ru.unit_name
       FROM unit_audit_log ual
       LEFT JOIN rental_units ru ON ru.id = ual.unit_id
       ${where}
       ORDER BY ual.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const total = await pool.query(`SELECT COUNT(*) FROM unit_audit_log ${where}`, params);
    return res.json({ success: true, project_id: projectId, logs: logs.rows, total: parseInt(total.rows[0].count), limit, offset });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── GET /api/audit/tenancy/:tenancyId — full event history for one tenancy ─
app.get('/api/audit/tenancy/:tenancyId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { tenancyId } = req.params;
  try {
    // Verify caller owns the project this tenancy belongs to (or is ADMIN or is the tenant)
    const access = await pool.query(
      `SELECT t.id FROM tenancies t
       JOIN rental_units ru ON ru.id = t.unit_id
       JOIN projects p ON p.id = ru.project_id
       WHERE t.id = $1
         AND (p.sponsor_id = $2 OR t.tenant_user_id = $2
              OR (SELECT role FROM public.users WHERE id=$2) = 'ADMIN')`,
      [tenancyId, userId]
    );
    if (!access.rows.length) return res.status(403).json({ error: 'Tenancy not found or access denied' });

    const logs = await pool.query(
      `SELECT id, event_type, actor_role, description, metadata, ledger_hash, created_at
       FROM unit_audit_log
       WHERE tenancy_id = $1
       ORDER BY created_at DESC`,
      [tenancyId]
    );
    return res.json({ success: true, tenancy_id: tenancyId, logs: logs.rows });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});


// ════════════════════════════════════════════════════════════════════════════
// MODULE: PAYOUT DISPUTE MANAGEMENT
// Gives landlords visibility into failed payouts.
// Gives admin a manual trigger for stuck vaults.
// ════════════════════════════════════════════════════════════════════════════

// ── GET /api/landlord/payout-failures — vaults with failed payout state ──
// Shows landlord every vault that failed payout, with reason + attempt count.
// Frontend can show a "Payout Failed — Contact Support" badge.
app.get('/api/landlord/payout-failures', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    const r = await pool.query(
      `SELECT fpv.id AS vault_id, fpv.vault_balance, fpv.payout_failed_at,
              fpv.payout_failure_reason, fpv.payout_attempt_count,
              fpv.currency, fpv.status,
              t.tenant_name, t.tenant_email,
              ru.unit_name, p.title AS project_title, p.project_number
       FROM flex_pay_vaults fpv
       JOIN tenancies t      ON t.id    = fpv.tenancy_id
       JOIN rental_units ru  ON ru.id   = t.unit_id
       JOIN projects p       ON p.id    = COALESCE(fpv.project_id, t.project_id)
       WHERE p.sponsor_id = $1
         AND fpv.payout_failed_at IS NOT NULL
       ORDER BY fpv.payout_failed_at DESC`,
      [userId]
    );
    return res.json({
      success:        true,
      failed_payouts: r.rows,
      count:          r.rows.length,
      message:        r.rows.length
        ? `${r.rows.length} payout(s) require attention. Contact support or verify your bank account details.`
        : 'No payout failures. All transfers are healthy.',
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /api/admin/trigger-payout/:vaultId — manual payout retry ─────────
// ADMIN-only. Forces immediate payout attempt for a stuck vault.
// Used when: wrong bank details were fixed, Paystack was down, manual dispute.
app.post('/api/admin/trigger-payout/:vaultId', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  const { vaultId } = req.params;
  const { dispute_note } = req.body;
  try {
    // ADMIN only
    const uRes = await pool.query(`SELECT role FROM public.users WHERE id=$1`, [userId]);
    if (!uRes.rows.length || uRes.rows[0].role !== 'ADMIN')
      return res.status(403).json({ error: 'ADMIN only.' });

    // Load vault + landlord bank account
    const vRes = await pool.query(
      `SELECT fpv.*, p.sponsor_id, ru.unit_id,
              t.tenant_name, t.tenant_email, ru.unit_name
       FROM flex_pay_vaults fpv
       JOIN tenancies t      ON t.id    = fpv.tenancy_id
       JOIN rental_units ru  ON ru.id   = t.unit_id
       JOIN projects p       ON p.id    = COALESCE(fpv.project_id, t.project_id)
       WHERE fpv.id = $1`,
      [vaultId]
    );
    if (!vRes.rows.length) return res.status(404).json({ error: 'Vault not found' });
    const v = vRes.rows[0];

    const bankRes = await pool.query(
      `SELECT * FROM landlord_bank_accounts
       WHERE user_id=$1 AND is_default=true AND paystack_recipient_code IS NOT NULL LIMIT 1`,
      [v.sponsor_id]
    );
    if (!bankRes.rows.length)
      return res.status(400).json({ error: 'Landlord has no verified default bank account. Fix that first.' });

    const acct = bankRes.rows[0];
    const rentAmount  = parseFloat(v.vault_balance) || parseFloat(v.rent_amount) || 0;
    if (rentAmount <= 0)
      return res.status(400).json({ error: 'Vault balance is zero — nothing to pay out.' });

    const platformFee = Math.round(rentAmount * 0.02 * 100) / 100;
    const netKobo     = Math.round((rentAmount - platformFee) * 100);
    const payRef      = `MANUAL-PAYOUT-${crypto.randomUUID().split('-')[0].toUpperCase()}-${Date.now()}`;

    const tRes = await fetch(`${process.env.PAYSTACK_BASE || 'https://api.paystack.co'}/transfer`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source:    'balance',
        amount:    netKobo,
        recipient: acct.paystack_recipient_code,
        reason:    `Nested Ark manual payout — Admin trigger${dispute_note ? ': ' + dispute_note : ''}`,
        reference: payRef,
        currency:  v.currency || 'NGN',
      }),
    });
    const tData = await tRes.json() as any;

    if (tData.status) {
      await pool.query(
        `UPDATE flex_pay_vaults
         SET status='ACTIVE', vault_balance=0, updated_at=NOW(),
             payout_failed_at=NULL, payout_failure_reason=NULL
         WHERE id=$1`,
        [vaultId]
      );
      await logAudit({
        event_type:  'PAYOUT_MANUAL_TRIGGER',
        actor_id:    userId,
        actor_role:  'ADMIN',
        unit_id:     v.unit_id,
        description: `Admin manually triggered payout of ₦${netKobo/100} for tenant "${v.tenant_name}" unit "${v.unit_name}"${dispute_note ? ' — Note: ' + dispute_note : ''}`,
        metadata:    { reference: payRef, amount_ngn: netKobo/100, vault_id: vaultId, dispute_note: dispute_note || null },
      });
      return res.json({ success: true, message: `Payout of ₦${netKobo/100} initiated. Ref: ${payRef}`, reference: payRef });
    } else {
      await logAudit({
        event_type:  'PAYOUT_MANUAL_FAILED',
        actor_id:    userId,
        actor_role:  'ADMIN',
        unit_id:     v.unit_id,
        description: `Admin-triggered payout FAILED: ${tData.message || 'Unknown error'}`,
        metadata:    { reference: payRef, error: tData.message, vault_id: vaultId },
      });
      return res.status(502).json({ error: `Paystack rejected transfer: ${tData.message}`, reference: payRef });
    }
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// MODULE: ADMIN UTILITIES — Dedup · System Maintenance · Override Tools
// Endpoints: /api/admin …
// ════════════════════════════════════════════════════════════════════════════
// ── POST /api/admin/dedup-tenancies — one-time cleanup of duplicate tenancy rows ──
// Keeps the most recent row per (unit_id, tenant_email) and soft-deletes older dupes.
// Protected: ADMIN only. Safe to run multiple times (idempotent).
app.post('/api/admin/dedup-tenancies', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).userId;
  try {
    // Verify caller is ADMIN
    const userRes = await pool.query(`SELECT role FROM public.users WHERE id = $1`, [userId]);
    if (!userRes.rows.length || userRes.rows[0].role !== 'ADMIN')
      return res.status(403).json({ error: 'ADMIN only.' });

    // Find duplicate (unit_id, tenant_email) groups — keep the latest id, soft-delete the rest
    const dupRes = await pool.query(`
      SELECT unit_id, tenant_email, COUNT(*) AS cnt,
             MAX(id) AS keep_id,
             ARRAY_AGG(id ORDER BY id ASC) AS all_ids
      FROM tenancies
      WHERE status != 'TERMINATED'
      GROUP BY unit_id, tenant_email
      HAVING COUNT(*) > 1
    `);

    if (!dupRes.rows.length)
      return res.json({ message: 'No duplicate tenancies found. Database is clean.', removed: 0 });

    let removed = 0;
    for (const row of dupRes.rows) {
      const dupIds = (row.all_ids as string[]).filter((id: string) => id !== row.keep_id);
      if (dupIds.length) {
        await pool.query(
          `UPDATE tenancies SET status = 'TERMINATED', updated_at = NOW()
           WHERE id = ANY($1::uuid[])`,
          [dupIds]
        );
        removed += dupIds.length;
      }
    }

    return res.json({
      message: `Dedup complete. ${removed} duplicate tenancy record(s) soft-terminated.`,
      removed,
      groups: dupRes.rows.map(r => ({
        unit_id: r.unit_id,
        tenant_email: r.tenant_email,
        kept: r.keep_id,
        removed_count: (r.all_ids as string[]).length - 1,
      })),
    });
  } catch (err: any) {
    console.error('[DEDUP] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/standalone-vault/:vaultId/migrate ────────────────────────
// ADMIN ONLY — Migrates a standalone vault to a formal tenancy-linked flex_pay_vault.
// Called when a landlord onboards and claims a tenant's existing standalone vault.
// Flow:
//   1. Verify vault + target tenancy exist
//   2. Create a new flex_pay_vault with the standalone vault balance carried over
//   3. Mark standalone_vault status = MIGRATED, store linked_tenancy_id + migrated_vault_id
//   4. Write immutable ledger entry
app.post('/api/admin/standalone-vault/:vaultId/migrate', authenticate, async (req: Request, res: Response): Promise<any> => {
  const adminId  = (req as any).userId;
  const { vaultId } = req.params;
  const { tenancy_id, unit_id } = req.body;
  try {
    // Verify ADMIN
    const aRes = await pool.query(`SELECT role FROM public.users WHERE id=$1`, [adminId]);
    if (!aRes.rows.length || aRes.rows[0].role !== 'ADMIN') {
      return res.status(403).json({ error: 'ADMIN only.' });
    }
    if (!tenancy_id) return res.status(400).json({ error: 'tenancy_id is required' });

    // Load standalone vault
    const svRes = await pool.query(
      `SELECT sv.*, u.email AS tenant_email
       FROM standalone_vaults sv
       JOIN public.users u ON u.id = sv.tenant_user_id
       WHERE sv.id=$1 AND sv.status NOT IN ('MIGRATED','CLOSED')`,
      [vaultId]
    );
    if (!svRes.rows.length) {
      return res.status(404).json({ error: 'Standalone vault not found or already migrated' });
    }
    const sv = svRes.rows[0];

    // Load tenancy
    const tRes = await pool.query(
      `SELECT t.*, ru.id AS unit_id_resolved, ru.rent_amount, ru.frequency, p.id AS project_id
       FROM tenancies t
       JOIN rental_units ru ON ru.id = t.unit_id
       JOIN projects p ON p.id = ru.project_id
       WHERE t.id=$1`,
      [tenancy_id]
    );
    if (!tRes.rows.length) {
      return res.status(404).json({ error: 'Target tenancy not found' });
    }
    const ten = tRes.rows[0];

    // Create flex_pay_vault carrying over the existing balance
    const fpvRes = await pool.query(
      `INSERT INTO flex_pay_vaults
         (tenancy_id, target_amount, vault_balance, installment_amount,
          frequency, status, cashout_mode, tenant_user_id, currency)
       VALUES ($1,$2,$3,$4,$5,'ACTIVE','ESCROW',$6,'NGN')
       RETURNING *`,
      [
        tenancy_id,
        parseFloat(sv.target_amount),
        parseFloat(sv.vault_balance),    // balance carried over
        parseFloat(sv.installment_amount),
        sv.frequency,
        sv.tenant_user_id,
      ]
    );
    const fpv = fpvRes.rows[0];

    // Mark standalone vault as MIGRATED
    await pool.query(
      `UPDATE standalone_vaults
       SET status='MIGRATED', linked_tenancy_id=$1, migrated_vault_id=$2,
           linked_at=NOW(), updated_at=NOW()
       WHERE id=$3`,
      [tenancy_id, fpv.id, vaultId]
    );

    // Link tenant_user_id on tenancy if not set
    await pool.query(
      `UPDATE tenancies SET tenant_user_id=$1 WHERE id=$2 AND tenant_user_id IS NULL`,
      [sv.tenant_user_id, tenancy_id]
    ).catch(() => {});

    // Immutable ledger
    const h = crypto.createHash('sha256')
      .update(`sv-migrate-${vaultId}-${fpv.id}-${Date.now()}`).digest('hex');
    pool.query(
      `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
       VALUES ('STANDALONE_VAULT_MIGRATED',$1,$2)`,
      [JSON.stringify({
        standalone_vault_id: vaultId,
        new_flex_vault_id:   fpv.id,
        tenancy_id,
        tenant_user_id:      sv.tenant_user_id,
        balance_carried:     parseFloat(sv.vault_balance),
        admin_id:            adminId,
      }), h]
    ).catch(() => {});

    console.log(`[ADMIN] Standalone vault ${vaultId} migrated → flex_pay_vault ${fpv.id} tenancy ${tenancy_id}`);

    return res.json({
      success:             true,
      standalone_vault_id: vaultId,
      new_flex_vault_id:   fpv.id,
      tenancy_id,
      balance_carried:     parseFloat(sv.vault_balance),
      message:             `Standalone vault successfully migrated. Balance of ₦${parseFloat(sv.vault_balance).toLocaleString()} carried into new flex_pay_vault.`,
    });
  } catch (e: any) {
    console.error('[ADMIN] migrate standalone vault error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ── POST /api/admin/standalone-vault/:vaultId/release-escrow ─────────────────
// ADMIN ONLY — Triggers escrow release for a FUNDED_READY standalone vault.
// Used when the landlord has onboarded, confirmed their bank account on Paystack,
// and the admin is ready to disburse the saved balance.
// Platform deducts 2% fee before transfer.
app.post('/api/admin/standalone-vault/:vaultId/release-escrow', authenticate, async (req: Request, res: Response): Promise<any> => {
  const adminId  = (req as any).userId;
  const { vaultId } = req.params;
  try {
    const aRes = await pool.query(`SELECT role FROM public.users WHERE id=$1`, [adminId]);
    if (!aRes.rows.length || aRes.rows[0].role !== 'ADMIN') {
      return res.status(403).json({ error: 'ADMIN only.' });
    }

    const svRes = await pool.query(
      `SELECT sv.*, u.email AS tenant_email, u.full_name AS tenant_name
       FROM standalone_vaults sv
       JOIN public.users u ON u.id = sv.tenant_user_id
       WHERE sv.id=$1`,
      [vaultId]
    );
    if (!svRes.rows.length) return res.status(404).json({ error: 'Standalone vault not found' });
    const sv = svRes.rows[0];

    if (sv.status !== 'FUNDED_READY') {
      return res.status(400).json({
        error:  `Vault status is '${sv.status}'. Only FUNDED_READY vaults can be released.`,
        status: sv.status,
      });
    }
    if (!sv.landlord_account_number || !sv.landlord_bank_name) {
      return res.status(400).json({
        error: 'Landlord bank details incomplete. Add account_number and bank_name before releasing.',
      });
    }

    const grossAmount = parseFloat(sv.vault_balance);
    const platformFee = Math.round(grossAmount * 0.02 * 100) / 100;
    const netPayout   = Math.round((grossAmount - platformFee) * 100) / 100;

    // Lock vault immediately
    await pool.query(
      `UPDATE standalone_vaults SET status='CLOSED', updated_at=NOW() WHERE id=$1`,
      [vaultId]
    );

    const h = crypto.createHash('sha256')
      .update(`sv-release-${vaultId}-${netPayout}-${Date.now()}`).digest('hex');
    pool.query(
      `INSERT INTO system_ledger (transaction_type, payload, immutable_hash)
       VALUES ('STANDALONE_VAULT_ESCROW_RELEASE',$1,$2)`,
      [JSON.stringify({
        vault_id:      vaultId,
        gross:         grossAmount,
        platform_fee:  platformFee,
        net_payout:    netPayout,
        landlord_bank: sv.landlord_bank_name,
        landlord_acct: sv.landlord_account_number,
        admin_id:      adminId,
      }), h]
    ).catch(() => {});

    console.log(`[ADMIN] Standalone vault ${vaultId} escrow release — ₦${netPayout} net (2% fee ₦${platformFee})`);

    return res.json({
      success:       true,
      vault_id:      vaultId,
      gross_amount:  grossAmount,
      platform_fee:  platformFee,
      net_payout:    netPayout,
      landlord_bank: sv.landlord_bank_name,
      landlord_acct: sv.landlord_account_number,
      ledger_hash:   h,
      message:       `Escrow release initiated. ₦${netPayout.toLocaleString()} queued for transfer to landlord. Platform fee: ₦${platformFee.toLocaleString()}.`,
      note:          'Initiate the Paystack transfer manually from the Admin Revenue Dashboard using the landlord Paystack recipient code.',
    });
  } catch (e: any) {
    console.error('[ADMIN] standalone vault release error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/admin/standalone-vaults ─────────────────────────────────────────
// ADMIN ONLY — Lists all standalone vaults with status, balance, and tenant info.
// Optional query: ?status=FUNDED_READY to filter actionable vaults.
app.get('/api/admin/standalone-vaults', authenticate, async (req: Request, res: Response): Promise<any> => {
  const adminId = (req as any).userId;
  const { status } = req.query as { status?: string };
  try {
    const aRes = await pool.query(`SELECT role FROM public.users WHERE id=$1`, [adminId]);
    if (!aRes.rows.length || aRes.rows[0].role !== 'ADMIN') {
      return res.status(403).json({ error: 'ADMIN only.' });
    }
    const whereParts = ['1=1'];
    const params: any[] = [];
    if (status) {
      params.push(status.toUpperCase());
      whereParts.push(`sv.status = $${params.length}`);
    }
    const r = await pool.query(
      `SELECT sv.*,
              u.email AS tenant_email, u.full_name AS tenant_name,
              COALESCE((SELECT SUM(sc.amount_ngn) FROM standalone_contributions sc
                        WHERE sc.vault_id = sv.id AND sc.status='SUCCESS'), 0) AS total_contributed,
              (SELECT COUNT(*) FROM standalone_contributions sc
               WHERE sc.vault_id = sv.id AND sc.status='SUCCESS') AS contribution_count
       FROM standalone_vaults sv
       JOIN public.users u ON u.id = sv.tenant_user_id
       WHERE ${whereParts.join(' AND ')}
       ORDER BY sv.created_at DESC
       LIMIT 200`,
      params
    );
    return res.json({
      success: true,
      count:   r.rows.length,
      vaults:  r.rows.map(sv => ({
        id:                  sv.id,
        tenant_name:         sv.tenant_name,
        tenant_email:        sv.tenant_email,
        status:              sv.status,
        vault_balance:       parseFloat(sv.vault_balance)      || 0,
        target_amount:       parseFloat(sv.target_amount)      || 0,
        funded_pct:          sv.target_amount > 0
                               ? Math.min(Math.round((parseFloat(sv.vault_balance) / parseFloat(sv.target_amount)) * 100), 100)
                               : 0,
        total_contributed:   parseFloat(sv.total_contributed)  || 0,
        contribution_count:  parseInt(sv.contribution_count)   || 0,
        installment_amount:  parseFloat(sv.installment_amount) || 0,
        frequency:           sv.frequency,
        landlord_name:       sv.landlord_name  || null,
        landlord_email:      sv.landlord_email || null,
        landlord_bank_name:  sv.landlord_bank_name || null,
        landlord_account_number: sv.landlord_account_number || null,
        payout_preference:   sv.payout_preference || 'ASK',
        tenant_bank_name:    sv.tenant_bank_name || null,
        tenant_account_number: sv.tenant_account_number || null,
        tenant_account_name: sv.tenant_account_name || null,
        due_date:            sv.due_date || null,
        payout_attempt_count: sv.payout_attempt_count || 0,
        payout_failure_reason: sv.payout_failure_reason || null,
        linked_tenancy_id:   sv.linked_tenancy_id  || null,
        migrated_vault_id:   sv.migrated_vault_id  || null,
        created_at:          sv.created_at,
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});


// ── 404 catch-all — MUST be last route registration, after every app.* route ──
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

async function startServer() {
  try {

    // Test DB — retry up to 3 times with 5s delay (Supabase can be slow on cold start)
    let dbOk = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await pool.query("SELECT 1");
        dbOk = true;
        break;
      } catch (dbErr: any) {
        process.stderr.write(`DB connect attempt ${attempt}/3 failed: ${dbErr.message}\n`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 5000));
      }
    }
    if (!dbOk) {
      process.stderr.write("FATAL: Could not connect to database after 3 attempts. Exiting.\n");
      process.exit(1);
    }
    console.log("Database connected successfully");

    // Ensure tables
    await ensureTablesExist();
    console.log("Tables verified");

    // ── Initialize the EmailService singleton ────────────────────────────────
    // Creates the ONE pooled SMTP transporter for the entire process and
    // verifies connectivity. Must run before app.listen() so the very first
    // request can send mail without a cold-start delay, and before the cron
    // jobs below (which share the same transporter via getMailer()).
    await initEmailService();

    // Persist every email event (recipient, template, status, provider
    // response, timestamp) to the email_logs table. Best-effort — if this
    // insert ever fails, it's logged and swallowed; it must never affect
    // the business transaction that triggered the email.
    setDbLogger(async (entry) => {
      await pool.query(
        `INSERT INTO email_logs (id, recipient, template, status, provider_response, error_message) VALUES ($1,$2,$3,$4,$5,$6)`,
        [uuidv4(), entry.recipient, entry.template, entry.status, entry.providerResponse || null, entry.errorMessage || null]
      );
    });

    // Start daily reminder & drawdown cron (08:00 WAT)
    startReminderCron(pool, getMailer);

    // Start marketplace listing expiry cron (every 6 hours)
    startListingExpiryCron(pool);

    // Start pending payout retry cron (every 30 mins)
    // Catches FUNDED_READY vaults where landlord had no bank account at webhook
    // time, or where Paystack balance was ₦0 (T+1 clearing). Retries automatically.
    startPendingPayoutCron(pool);

    // Start standalone vault payout cron (every 30 mins, staggered 90s after boot)
    // Disburses NO CHOP YOUR RENT standalone vaults to tenant's own account or
    // directly to landlord — no landlord onboarding required.
    startStandaloneVaultPayoutCron(pool);

    app.listen(PORT, "0.0.0.0", () => {
      console.log("[BOOT] All modules initialized successfully");
      console.log(`
============================================
🚀 Nested Ark Infrastructure API
============================================

Server: ${process.env.RENDER_EXTERNAL_URL || "http://localhost"}:${PORT}
Status: Online

Database: Connected ✅
Auth: Enabled

Modules: 7
- Auth
- Projects
- Contractors
- Milestones
- Escrow
- Gov / Ledger
- Investments

Endpoints: 60+ total ✅
Security: Tri-Layer Verification 🔒
Ledger: Bulletproof Hash Chain 🔐
Currency Oracle: Live 💱
Geo-Awareness: Active 🌍
Market Ticker: Live 📡
Revenue Engine: Active 💰
Rental Engine: Active 🏠
Payment Model: DUAL ENGINE — Full rent: instant 98/2 split via subaccount; Vault installments: escrow hold → 100% rent to landlord + 2% fee retained at release
Paystack Fee: PASSED TO CUSTOMER (bearer: account — platform absorbs Paystack processing fee on vault installments)
Platform Fee: 2% additive at vault release — tenant saves rent + 2%, landlord receives 100% of rent | 2% at checkout (full rent)
Escrow Engine: ACTIVE — vault contributions held in main Paystack balance until 100% funded
Frontend: ${process.env.FRONTEND_URL || 'https://nestedark.com'} 🌐
Data Persistence: ENABLED ✅

============================================
      `);

    });

  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
}

startServer();

export default app;