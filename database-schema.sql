-- ============================================================================
-- GLOBAL INFRASTRUCTURE PLATFORM - COMPLETE DATABASE SCHEMA
-- PostgreSQL 13+
-- ============================================================================

-- ============================================================================
-- 1. USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    user_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    identity_verified BOOLEAN DEFAULT FALSE,
    kyc_status VARCHAR(50) DEFAULT 'PENDING',
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(32),
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR(45),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    profile_picture_url VARCHAR(512),
    company_name VARCHAR(255),
    location VARCHAR(255),
    country VARCHAR(100),
    timezone VARCHAR(50),
    phone_verified BOOLEAN DEFAULT FALSE,
    document_type VARCHAR(50),
    document_url VARCHAR(512),
    document_verified_at TIMESTAMP,
    bank_account_id VARCHAR(255),
    payment_method_id VARCHAR(255),
    two_factor_secret VARCHAR(32),
    preferences JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(512) NOT NULL UNIQUE,
    refresh_token VARCHAR(512) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- ============================================================================
-- 2. PROJECTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    project_type VARCHAR(100) NOT NULL,
    project_status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    budget DECIMAL(18, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    timeline_start_date DATE,
    timeline_end_date DATE,
    expected_completion_date DATE,
    expected_revenue_model TEXT,
    risk_level VARCHAR(50),
    approver_id UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_project_status ON projects(project_status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_location ON projects(location);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

CREATE TABLE IF NOT EXISTS project_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_type VARCHAR(100),
    file_url VARCHAR(512) NOT NULL,
    file_name VARCHAR(255),
    file_size INTEGER,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);

-- ============================================================================
-- 3. CONTRACTORS & BIDDING
-- ============================================================================

CREATE TABLE IF NOT EXISTS contractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255),
    business_registration_number VARCHAR(255),
    tax_id VARCHAR(100),
    company_size VARCHAR(50),
    experience_years INTEGER,
    specializations TEXT[],
    certifications TEXT[],
    insurance_number VARCHAR(255),
    insurance_expiry_date DATE,
    verification_status VARCHAR(50) DEFAULT 'PENDING',
    verification_completed_at TIMESTAMP,
    average_rating DECIMAL(3, 2) DEFAULT 0,
    total_projects_completed INTEGER DEFAULT 0,
    total_revenue_handled DECIMAL(18, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contractors_user_id ON contractors(user_id);
CREATE INDEX IF NOT EXISTS idx_contractors_verification_status ON contractors(verification_status);
CREATE INDEX IF NOT EXISTS idx_contractors_rating ON contractors(average_rating);

CREATE TABLE IF NOT EXISTS contractor_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    rater_id UUID NOT NULL REFERENCES users(id),
    rating DECIMAL(3, 2) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contractor_ratings_contractor_id ON contractor_ratings(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_ratings_project_id ON contractor_ratings(project_id);

CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    amount DECIMAL(18, 2) NOT NULL,
    timeline_days INTEGER,
    proposal TEXT,
    attachments TEXT[],
    bid_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    selected_at TIMESTAMP,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bids_project_id ON bids(project_id);
CREATE INDEX IF NOT EXISTS idx_bids_contractor_id ON bids(contractor_id);
CREATE INDEX IF NOT EXISTS idx_bids_bid_status ON bids(bid_status);

CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    bid_id UUID UNIQUE REFERENCES bids(id),
    contract_amount DECIMAL(18, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    contract_status VARCHAR(50) DEFAULT 'ACTIVE',
    contract_document_url VARCHAR(512),
    signed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_contractor_id ON contracts(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_status ON contracts(contract_status);

-- ============================================================================
-- 4. MILESTONES & VERIFICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    budget_allocation DECIMAL(18, 2) NOT NULL,
    percentage_of_total DECIMAL(5, 2),
    completion_criteria TEXT NOT NULL,
    verification_required BOOLEAN DEFAULT TRUE,
    milestone_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    order_index INTEGER,
    target_completion_date DATE,
    actual_completion_date DATE,
    verified_at TIMESTAMP,
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_milestone_status ON milestones(milestone_status);
CREATE INDEX IF NOT EXISTS idx_milestones_contract_id ON milestones(contract_id);

CREATE TABLE IF NOT EXISTS milestone_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id),
    file_url VARCHAR(512) NOT NULL,
    file_type VARCHAR(50),
    file_name VARCHAR(255),
    file_size INTEGER,
    evidence_type VARCHAR(100),
    description TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    verified_by UUID REFERENCES users(id),
    verification_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_milestone_evidence_milestone_id ON milestone_evidence(milestone_id);
CREATE INDEX IF NOT EXISTS idx_milestone_evidence_contractor_id ON milestone_evidence(contractor_id);

CREATE TABLE IF NOT EXISTS milestone_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id),
    approval_status VARCHAR(50) NOT NULL,
    approval_comments TEXT,
    approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_milestone_approvals_milestone_id ON milestone_approvals(milestone_id);

-- ============================================================================
-- 5. ESCROW & PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS escrow_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    total_balance DECIMAL(18, 2) NOT NULL DEFAULT 0,
    reserved_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
    released_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
    refunded_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
    wallet_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    hold_period_days INTEGER DEFAULT 30,
    last_transaction_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escrow_wallets_project_id ON escrow_wallets(project_id);
CREATE INDEX IF NOT EXISTS idx_escrow_wallets_wallet_status ON escrow_wallets(wallet_status);

CREATE TABLE IF NOT EXISTS escrow_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_wallet_id UUID NOT NULL REFERENCES escrow_wallets(id) ON DELETE CASCADE,
    from_user_id UUID REFERENCES users(id),
    to_user_id UUID REFERENCES users(id),
    amount DECIMAL(18, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    transaction_type VARCHAR(50) NOT NULL,
    transaction_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    milestone_id UUID REFERENCES milestones(id),
    payment_method VARCHAR(50),
    stripe_charge_id VARCHAR(255),
    description TEXT,
    reference_id VARCHAR(255),
    approval_required BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    released_at TIMESTAMP,
    settled_at TIMESTAMP,
    settlement_date DATE,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escrow_tx_wallet ON escrow_transactions(escrow_wallet_id);
CREATE INDEX IF NOT EXISTS idx_escrow_tx_transaction_status ON escrow_transactions(transaction_status);
CREATE INDEX IF NOT EXISTS idx_escrow_tx_from_user ON escrow_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_tx_to_user ON escrow_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_tx_milestone ON escrow_transactions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_escrow_tx_date ON escrow_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_created_at ON escrow_transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS payment_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_transaction_id UUID NOT NULL UNIQUE REFERENCES escrow_transactions(id) ON DELETE CASCADE,
    reason VARCHAR(255),
    hold_amount DECIMAL(18, 2),
    hold_until_date DATE,
    released_at TIMESTAMP,
    released_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_holds_transaction_id ON payment_holds(escrow_transaction_id);

-- ============================================================================
-- 6. INVESTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    investor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(18, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    percentage_ownership DECIMAL(5, 2),
    investment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    investment_terms TEXT,
    expected_return_percentage DECIMAL(5, 2),
    payment_method VARCHAR(50),
    stripe_charge_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_investments_project_id ON investments(project_id);
CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_investments_investment_status ON investments(investment_status);
CREATE INDEX IF NOT EXISTS idx_investments_created_at ON investments(created_at DESC);

CREATE TABLE IF NOT EXISTS investor_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    settlement_id UUID REFERENCES settlements(id),
    return_amount DECIMAL(18, 2) NOT NULL,
    return_percentage DECIMAL(5, 2),
    payment_date DATE,
    paid_at TIMESTAMP,
    return_status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_investor_returns_investment_id ON investor_returns(investment_id);

CREATE TABLE IF NOT EXISTS investor_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID NOT NULL UNIQUE REFERENCES investments(id) ON DELETE CASCADE,
    contract_document_url VARCHAR(512),
    contract_terms JSONB,
    signed_at TIMESTAMP,
    investor_signed_at TIMESTAMP,
    project_sponsor_signed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_investor_contracts_investment_id ON investor_contracts(investment_id);

-- ============================================================================
-- 7. SETTLEMENTS & DISTRIBUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    settlement_date DATE NOT NULL,
    period_start_date DATE,
    period_end_date DATE,
    total_revenue DECIMAL(18, 2) NOT NULL,
    total_distributed DECIMAL(18, 2) DEFAULT 0,
    settlement_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    triggered_by UUID REFERENCES users(id),
    triggered_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settlements_project_id ON settlements(project_id);
CREATE INDEX IF NOT EXISTS idx_settlements_settlement_status ON settlements(settlement_status);
CREATE INDEX IF NOT EXISTS idx_settlements_date ON settlements(settlement_date);

CREATE TABLE IF NOT EXISTS settlement_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id),
    recipient_type VARCHAR(50) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    percentage DECIMAL(5, 2),
    distribution_type VARCHAR(50),
    distribution_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    payment_method VARCHAR(50),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settlement_distributions_settlement_id ON settlement_distributions(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_distributions_recipient ON settlement_distributions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_settlement_distributions_distribution_status ON settlement_distributions(distribution_status);

CREATE TABLE IF NOT EXISTS settlement_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    investor_percentage DECIMAL(5, 2),
    sponsor_percentage DECIMAL(5, 2),
    operator_percentage DECIMAL(5, 2),
    maintenance_reserve_percentage DECIMAL(5, 2),
    platform_fee_percentage DECIMAL(5, 2),
    other_distributions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settlement_rules_project_id ON settlement_rules(project_id);

-- ============================================================================
-- 8. AUDIT & COMPLIANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    log_status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS transaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(255) NOT NULL,
    transaction_type VARCHAR(50),
    amount DECIMAL(18, 2),
    from_user_id UUID REFERENCES users(id),
    to_user_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    log_status VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transaction_logs_transaction_id ON transaction_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_log_status ON transaction_logs(log_status);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_created_at ON transaction_logs(created_at);

CREATE TABLE IF NOT EXISTS compliance_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(100),
    entity_id UUID,
    document_type VARCHAR(100),
    file_url VARCHAR(512),
    uploaded_by UUID REFERENCES users(id),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP,
    expires_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compliance_documents_entity ON compliance_documents(entity_type, entity_id);

-- ============================================================================
-- 9. DISPUTES & RESOLUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES milestones(id),
    transaction_id UUID REFERENCES escrow_transactions(id),
    raised_by UUID NOT NULL REFERENCES users(id),
    respondent_id UUID REFERENCES users(id),
    dispute_type VARCHAR(100),
    dispute_status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    description TEXT NOT NULL,
    resolution TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    priority VARCHAR(50) DEFAULT 'MEDIUM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disputes_project_id ON disputes(project_id);
CREATE INDEX IF NOT EXISTS idx_disputes_dispute_status ON disputes(dispute_status);

-- ============================================================================
-- 10. NOTIFICATIONS & MESSAGING
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    message TEXT,
    type VARCHAR(50),
    related_entity_type VARCHAR(100),
    related_entity_id UUID,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);

-- ============================================================================
-- 11. ANALYTICS & METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    total_bids_received INTEGER DEFAULT 0,
    total_investors INTEGER DEFAULT 0,
    total_investment_amount DECIMAL(18, 2) DEFAULT 0,
    total_contractor_cost DECIMAL(18, 2) DEFAULT 0,
    total_platform_fees DECIMAL(18, 2) DEFAULT 0,
    completion_percentage DECIMAL(5, 2) DEFAULT 0,
    milestone_completion_rate DECIMAL(5, 2),
    average_payment_processing_days DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_metrics_project_id ON project_metrics(project_id);

CREATE TABLE IF NOT EXISTS contractor_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    total_bids_submitted INTEGER DEFAULT 0,
    total_bids_won INTEGER DEFAULT 0,
    total_projects_completed INTEGER DEFAULT 0,
    total_revenue_handled DECIMAL(18, 2) DEFAULT 0,
    average_completion_time_days DECIMAL(5, 2),
    average_rating DECIMAL(3, 2),
    on_time_completion_percentage DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contractor_metrics_contractor_id ON contractor_metrics(contractor_id);

-- ============================================================================
-- 12. SYSTEM CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT,
    data_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_config_key ON platform_config(config_key);

-- ============================================================================
-- SAMPLE VIEWS FOR COMMON QUERIES
-- ============================================================================

CREATE OR REPLACE VIEW v_project_summary AS
SELECT 
    p.id,
    p.name,
    p.project_status,
    p.budget,
    COUNT(DISTINCT b.id) as bid_count,
    COUNT(DISTINCT i.id) as investor_count,
    COALESCE(SUM(i.amount), 0) as total_investment,
    COUNT(DISTINCT m.id) as milestone_count,
    SUM(CASE WHEN m.milestone_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_milestones
FROM projects p
LEFT JOIN bids b ON p.id = b.project_id
LEFT JOIN investments i ON p.id = i.project_id
LEFT JOIN milestones m ON p.id = m.project_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.project_status, p.budget;

CREATE OR REPLACE VIEW v_escrow_balance AS
SELECT 
    ew.id,
    ew.project_id,
    p.name as project_name,
    ew.total_balance,
    ew.reserved_amount,
    ew.released_amount,
    (ew.total_balance - ew.reserved_amount) as available_balance,
    ew.wallet_status
FROM escrow_wallets ew
JOIN projects p ON ew.project_id = p.id;

CREATE OR REPLACE VIEW v_contractor_performance AS
SELECT 
    c.id,
    c.user_id,
    u.full_name,
    c.company_name,
    COUNT(DISTINCT co.id) as total_contracts,
    SUM(CASE WHEN co.contract_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_contracts,
    AVG(cr.rating) as average_rating,
    COALESCE(SUM(m.budget_allocation), 0) as total_value_handled
FROM contractors c
JOIN users u ON c.user_id = u.id
LEFT JOIN contracts co ON c.id = co.contractor_id
LEFT JOIN contractor_ratings cr ON c.id = cr.contractor_id
LEFT JOIN milestones m ON co.id = m.contract_id
GROUP BY c.id, c.user_id, u.full_name, c.company_name;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
