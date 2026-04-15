import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { Contractor, ContractorBid, BidCreatePayload, BidUpdatePayload } from "../types/contractor.types";

export class ContractorService {
  constructor(private pool: Pool) {}

  private async ensureTablesExist(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS contractors (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
          company_name VARCHAR(255) NOT NULL,
          bio TEXT,
          specialization VARCHAR(100) NOT NULL,
          years_experience INTEGER,
          rating DECIMAL(3,2) DEFAULT 0,
          total_jobs INTEGER DEFAULT 0,
          completed_jobs INTEGER DEFAULT 0,
          hourly_rate DECIMAL(10,2),
          portfolio_url VARCHAR(500),
          certifications TEXT[],
          verified BOOLEAN DEFAULT false,
          verification_date TIMESTAMP,
          status VARCHAR(50) DEFAULT 'ACTIVE',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS contractor_bids (
          id UUID PRIMARY KEY,
          contractor_id UUID NOT NULL REFERENCES contractors(id),
          milestone_id UUID NOT NULL,
          project_id UUID NOT NULL,
          bid_amount DECIMAL(15,2) NOT NULL,
          estimated_duration_days INTEGER,
          proposal TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'PENDING',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_contractors_user ON contractors(user_id);
        CREATE INDEX IF NOT EXISTS idx_contractors_status ON contractors(status);
        CREATE INDEX IF NOT EXISTS idx_bids_contractor ON contractor_bids(contractor_id);
        CREATE INDEX IF NOT EXISTS idx_bids_milestone ON contractor_bids(milestone_id);
        CREATE INDEX IF NOT EXISTS idx_bids_status ON contractor_bids(status);
      `);
    } catch (error: any) {
      console.log("Contractors table exists or error:", error.message);
    }
  }

  async createContractorProfile(userId: string, payload: any): Promise<Contractor> {
    await this.ensureTablesExist();
    const id = uuidv4();
    const result = await this.pool.query(
      `INSERT INTO contractors (id, user_id, company_name, bio, specialization, years_experience, hourly_rate, portfolio_url, certifications, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *`,
      [
        id,
        userId,
        payload.company_name,
        payload.bio,
        payload.specialization,
        payload.years_experience,
        payload.hourly_rate,
        payload.portfolio_url || null,
        payload.certifications || [],
        "ACTIVE"
      ]
    );
    return result.rows[0];
  }

  async getContractorById(contractorId: string): Promise<Contractor> {
    const result = await this.pool.query("SELECT * FROM contractors WHERE id = $1", [contractorId]);
    if (result.rows.length === 0) throw new Error("Contractor not found");
    return result.rows[0];
  }

  async getContractorByUserId(userId: string): Promise<Contractor> {
    const result = await this.pool.query("SELECT * FROM contractors WHERE user_id = $1", [userId]);
    if (result.rows.length === 0) throw new Error("Contractor profile not found");
    return result.rows[0];
  }

  async updateContractorProfile(contractorId: string, payload: any): Promise<Contractor> {
    const updates: string[] = [];
    const params: any[] = [contractorId];
    let paramCount = 2;
    
    if (payload.company_name) {
      updates.push(`company_name = $${paramCount}`);
      params.push(payload.company_name);
      paramCount++;
    }
    if (payload.bio) {
      updates.push(`bio = $${paramCount}`);
      params.push(payload.bio);
      paramCount++;
    }
    if (payload.hourly_rate) {
      updates.push(`hourly_rate = $${paramCount}`);
      params.push(payload.hourly_rate);
      paramCount++;
    }
    if (payload.certifications) {
      updates.push(`certifications = $${paramCount}`);
      params.push(payload.certifications);
      paramCount++;
    }
    if (payload.portfolio_url) {
      updates.push(`portfolio_url = $${paramCount}`);
      params.push(payload.portfolio_url);
      paramCount++;
    }
    
    updates.push("updated_at = NOW()");
    
    const result = await this.pool.query(
      `UPDATE contractors SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
      params
    );
    if (result.rows.length === 0) throw new Error("Contractor not found");
    return result.rows[0];
  }

  async listContractors(filters: any = {}, limit: number = 20, offset: number = 0): Promise<Contractor[]> {
    await this.ensureTablesExist();
    let query = "SELECT * FROM contractors WHERE status = 'ACTIVE'";
    const params: any[] = [];
    
    if (filters.specialization) {
      query += ` AND specialization = $${params.length + 1}`;
      params.push(filters.specialization);
    }
    if (filters.min_rating) {
      query += ` AND rating >= $${params.length + 1}`;
      params.push(filters.min_rating);
    }
    if (filters.verified) {
      query += ` AND verified = $${params.length + 1}`;
      params.push(true);
    }
    
    query += ` ORDER BY rating DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async placeBid(payload: BidCreatePayload): Promise<ContractorBid> {
    await this.ensureTablesExist();
    const id = uuidv4();
    const result = await this.pool.query(
      `INSERT INTO contractor_bids (id, contractor_id, milestone_id, project_id, bid_amount, estimated_duration_days, proposal, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [
        id,
        payload.contractor_id,
        payload.milestone_id,
        payload.project_id || null,
        payload.bid_amount,
        payload.estimated_duration_days,
        payload.proposal,
        "PENDING"
      ]
    );
    return result.rows[0];
  }

  async getBidsForMilestone(milestoneId: string): Promise<ContractorBid[]> {
    const result = await this.pool.query(
      `SELECT cb.*, c.company_name, c.rating FROM contractor_bids cb
       JOIN contractors c ON cb.contractor_id = c.id
       WHERE cb.milestone_id = $1 ORDER BY cb.created_at DESC`,
      [milestoneId]
    );
    return result.rows;
  }

  async getBidsForContractor(contractorId: string): Promise<ContractorBid[]> {
    const result = await this.pool.query(
      "SELECT * FROM contractor_bids WHERE contractor_id = $1 ORDER BY created_at DESC",
      [contractorId]
    );
    return result.rows;
  }

  async updateBidStatus(bidId: string, status: string): Promise<ContractorBid> {
    const result = await this.pool.query(
      `UPDATE contractor_bids SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, bidId]
    );
    if (result.rows.length === 0) throw new Error("Bid not found");
    return result.rows[0];
  }

  async getContractorStats(contractorId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT 
        rating, total_jobs, completed_jobs,
        (SELECT COUNT(*) FROM contractor_bids WHERE contractor_id = $1 AND status = 'ACCEPTED') as active_projects,
        (SELECT COUNT(*) FROM contractor_bids WHERE contractor_id = $1) as total_bids,
        (SELECT COUNT(*) FROM contractor_bids WHERE contractor_id = $1 AND status = 'ACCEPTED') as won_bids
       FROM contractors WHERE id = $1`,
      [contractorId]
    );
    if (result.rows.length === 0) throw new Error("Contractor not found");
    return result.rows[0];
  }

  async updateContractorRating(contractorId: string, newRating: number): Promise<void> {
    await this.pool.query(
      "UPDATE contractors SET rating = $1, updated_at = NOW() WHERE id = $2",
      [newRating, contractorId]
    );
  }

  async incrementContractorJobCount(contractorId: string): Promise<void> {
    await this.pool.query(
      "UPDATE contractors SET completed_jobs = completed_jobs + 1, total_jobs = total_jobs + 1, updated_at = NOW() WHERE id = $1",
      [contractorId]
    );
  }
}
