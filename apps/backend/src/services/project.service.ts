import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { Project, ProjectCreatePayload, ProjectUpdatePayload, ProjectWithDetails } from "../types/project.types";
import { EscrowService } from "./escrow.service";

export class ProjectService {
  constructor(private pool: Pool, private escrowService: EscrowService) {}

  private async ensureTablesExist(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY,
          sponsor_id UUID NOT NULL REFERENCES users(id),
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          location VARCHAR(255) NOT NULL,
          country VARCHAR(100) NOT NULL,
          budget DECIMAL(15,2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          category VARCHAR(100),
          timeline_months INTEGER,
          target_completion_date TIMESTAMP,
          status VARCHAR(50) DEFAULT 'DRAFT',
          progress_percentage DECIMAL(5,2) DEFAULT 0,
          escrow_wallet_id UUID REFERENCES escrow_wallets(id),
          featured BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_projects_sponsor ON projects(sponsor_id);
        CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
        CREATE INDEX IF NOT EXISTS idx_projects_country ON projects(country);
        CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
      `);
    } catch (error: any) {
      console.log("Projects table exists or error:", error.message);
    }
  }

  async createProject(payload: ProjectCreatePayload, sponsorId: string): Promise<Project> {
    await this.ensureTablesExist();
    const projectId = uuidv4();
    
    // Create escrow wallet for project
    const wallet = await this.escrowService.getOrCreateWallet(projectId, sponsorId);
    
    const result = await this.pool.query(
      `INSERT INTO projects (id, sponsor_id, title, description, location, country, budget, currency, category, timeline_months, target_completion_date, status, progress_percentage, escrow_wallet_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()) RETURNING *`,
      [
        projectId,
        sponsorId,
        payload.title,
        payload.description,
        payload.location,
        payload.country,
        payload.budget,
        payload.currency || "USD",
        payload.category,
        payload.timeline_months,
        payload.target_completion_date,
        "DRAFT",
        0,
        wallet.id
      ]
    );
    return result.rows[0];
  }

  async getProjectById(projectId: string): Promise<ProjectWithDetails> {
    const result = await this.pool.query(
      `SELECT p.*, 
              u.email, u.company_name, u.location,
              (SELECT COUNT(*) FROM milestones WHERE project_id = p.id) as milestone_count,
              (SELECT COUNT(DISTINCT contractor_id) FROM milestones WHERE project_id = p.id AND contractor_id IS NOT NULL) as contractor_count,
              (SELECT COUNT(*) FROM project_investors WHERE project_id = p.id) as investor_count,
              (SELECT COALESCE(SUM(amount_invested), 0) FROM project_investors WHERE project_id = p.id) as total_invested
       FROM projects p
       JOIN users u ON p.sponsor_id = u.id
       WHERE p.id = $1`,
      [projectId]
    );
    if (result.rows.length === 0) throw new Error("Project not found");
    return result.rows[0];
  }

  async listProjects(filters: any = {}, limit: number = 20, offset: number = 0): Promise<Project[]> {
    await this.ensureTablesExist();
    let query = "SELECT * FROM projects WHERE 1=1";
    const params: any[] = [];
    
    if (filters.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }
    if (filters.category) {
      query += ` AND category = $${params.length + 1}`;
      params.push(filters.category);
    }
    if (filters.country) {
      query += ` AND country = $${params.length + 1}`;
      params.push(filters.country);
    }
    if (filters.sponsor_id) {
      query += ` AND sponsor_id = $${params.length + 1}`;
      params.push(filters.sponsor_id);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async updateProject(projectId: string, payload: ProjectUpdatePayload): Promise<Project> {
    const updates: string[] = [];
    const params: any[] = [projectId];
    let paramCount = 2;
    
    if (payload.title) {
      updates.push(`title = $${paramCount}`);
      params.push(payload.title);
      paramCount++;
    }
    if (payload.description) {
      updates.push(`description = $${paramCount}`);
      params.push(payload.description);
      paramCount++;
    }
    if (payload.status) {
      updates.push(`status = $${paramCount}`);
      params.push(payload.status);
      paramCount++;
    }
    if (payload.progress_percentage !== undefined) {
      updates.push(`progress_percentage = $${paramCount}`);
      params.push(payload.progress_percentage);
      paramCount++;
    }
    if (payload.target_completion_date) {
      updates.push(`target_completion_date = $${paramCount}`);
      params.push(payload.target_completion_date);
      paramCount++;
    }
    
    updates.push(`updated_at = NOW()`);
    
    const result = await this.pool.query(
      `UPDATE projects SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
      params
    );
    if (result.rows.length === 0) throw new Error("Project not found");
    return result.rows[0];
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.pool.query("DELETE FROM projects WHERE id = $1", [projectId]);
  }

  async getProjectStats(projectId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM milestones WHERE project_id = $1) as total_milestones,
        (SELECT COUNT(*) FROM milestones WHERE project_id = $1 AND status = 'COMPLETED') as completed_milestones,
        (SELECT COALESCE(SUM(amount), 0) FROM escrow_transactions WHERE wallet_id = (SELECT escrow_wallet_id FROM projects WHERE id = $1) AND transaction_type = 'DEPOSIT') as total_deposits,
        (SELECT COALESCE(SUM(amount), 0) FROM escrow_transactions WHERE wallet_id = (SELECT escrow_wallet_id FROM projects WHERE id = $1) AND transaction_type = 'RELEASE') as total_released,
        p.progress_percentage, p.status
       FROM projects p WHERE p.id = $1`,
      [projectId]
    );
    if (result.rows.length === 0) throw new Error("Project not found");
    return result.rows[0];
  }

  async featuredProjects(limit: number = 10): Promise<Project[]> {
    const result = await this.pool.query(
      "SELECT * FROM projects WHERE featured = true AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return result.rows;
  }

  async getProjectsByCategory(category: string, limit: number = 20): Promise<Project[]> {
    const result = await this.pool.query(
      "SELECT * FROM projects WHERE category = $1 AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT $2",
      [category, limit]
    );
    return result.rows;
  }
}
