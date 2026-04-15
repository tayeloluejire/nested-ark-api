import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { Milestone, MilestoneEvidence, MilestoneApproval } from "../types/milestone.types";

export class MilestoneService {
  constructor(private pool: Pool) {}

  private async ensureTablesExist(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS milestones (
          id UUID PRIMARY KEY,
          project_id UUID NOT NULL REFERENCES projects(id),
          contractor_id UUID REFERENCES contractors(id),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          budget_allocation DECIMAL(15,2) NOT NULL,
          estimated_start_date TIMESTAMP,
          estimated_completion_date TIMESTAMP,
          actual_completion_date TIMESTAMP,
          deliverables TEXT[],
          status VARCHAR(50) DEFAULT 'PENDING',
          progress_percentage DECIMAL(5,2) DEFAULT 0,
          required_approvals INTEGER DEFAULT 1,
          approval_period_days INTEGER DEFAULT 7,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS milestone_evidence (
          id UUID PRIMARY KEY,
          milestone_id UUID NOT NULL REFERENCES milestones(id),
          contractor_id UUID NOT NULL REFERENCES contractors(id),
          evidence_type VARCHAR(50) NOT NULL,
          file_url VARCHAR(500) NOT NULL,
          description TEXT,
          submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS milestone_approvals (
          id UUID PRIMARY KEY,
          milestone_id UUID NOT NULL REFERENCES milestones(id),
          approver_id UUID NOT NULL REFERENCES users(id),
          approval_status VARCHAR(50) DEFAULT 'PENDING',
          comments TEXT,
          approval_date TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
        CREATE INDEX IF NOT EXISTS idx_milestones_contractor ON milestones(contractor_id);
        CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
        CREATE INDEX IF NOT EXISTS idx_evidence_milestone ON milestone_evidence(milestone_id);
        CREATE INDEX IF NOT EXISTS idx_approvals_milestone ON milestone_approvals(milestone_id);
      `);
    } catch (error: any) {
      console.log("Milestones table exists or error:", error.message);
    }
  }

  async createMilestone(payload: any, projectId: string): Promise<Milestone> {
    await this.ensureTablesExist();
    const id = uuidv4();
    const result = await this.pool.query(
      `INSERT INTO milestones (id, project_id, title, description, budget_allocation, estimated_start_date, estimated_completion_date, deliverables, status, required_approvals, approval_period_days, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
      [
        id,
        projectId,
        payload.title,
        payload.description,
        payload.budget_allocation,
        payload.estimated_start_date,
        payload.estimated_completion_date,
        payload.deliverables || [],
        "PENDING",
        payload.required_approvals || 1,
        payload.approval_period_days || 7
      ]
    );
    return result.rows[0];
  }

  async getMilestoneById(milestoneId: string): Promise<Milestone> {
    const result = await this.pool.query("SELECT * FROM milestones WHERE id = $1", [milestoneId]);
    if (result.rows.length === 0) throw new Error("Milestone not found");
    return result.rows[0];
  }

  async getMilestonesByProject(projectId: string): Promise<Milestone[]> {
    const result = await this.pool.query(
      "SELECT * FROM milestones WHERE project_id = $1 ORDER BY estimated_start_date ASC",
      [projectId]
    );
    return result.rows;
  }

  async updateMilestoneStatus(milestoneId: string, status: string): Promise<Milestone> {
    const result = await this.pool.query(
      `UPDATE milestones SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, milestoneId]
    );
    if (result.rows.length === 0) throw new Error("Milestone not found");
    return result.rows[0];
  }

  async updateMilestoneProgress(milestoneId: string, progress: number): Promise<Milestone> {
    const result = await this.pool.query(
      `UPDATE milestones SET progress_percentage = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [progress, milestoneId]
    );
    if (result.rows.length === 0) throw new Error("Milestone not found");
    return result.rows[0];
  }

  async assignContractorToMilestone(milestoneId: string, contractorId: string): Promise<Milestone> {
    const result = await this.pool.query(
      `UPDATE milestones SET contractor_id = $1, status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $2 RETURNING *`,
      [contractorId, milestoneId]
    );
    if (result.rows.length === 0) throw new Error("Milestone not found");
    return result.rows[0];
  }

  async submitEvidence(payload: any, milestoneId: string, contractorId: string): Promise<MilestoneEvidence> {
    await this.ensureTablesExist();
    const id = uuidv4();
    const result = await this.pool.query(
      `INSERT INTO milestone_evidence (id, milestone_id, contractor_id, evidence_type, file_url, description, submission_date)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [id, milestoneId, contractorId, payload.evidence_type, payload.file_url, payload.description]
    );
    return result.rows[0];
  }

  async getEvidenceForMilestone(milestoneId: string): Promise<MilestoneEvidence[]> {
    const result = await this.pool.query(
      "SELECT * FROM milestone_evidence WHERE milestone_id = $1 ORDER BY submission_date DESC",
      [milestoneId]
    );
    return result.rows;
  }

  async createApprovalRequest(milestoneId: string, approverId: string): Promise<MilestoneApproval> {
    await this.ensureTablesExist();
    const id = uuidv4();
    const result = await this.pool.query(
      `INSERT INTO milestone_approvals (id, milestone_id, approver_id, approval_status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, milestoneId, approverId, "PENDING"]
    );
    return result.rows[0];
  }

  async approveMilestone(approvalId: string, approved: boolean, comments?: string): Promise<MilestoneApproval> {
    const status = approved ? "APPROVED" : "REJECTED";
    const result = await this.pool.query(
      `UPDATE milestone_approvals SET approval_status = $1, comments = $2, approval_date = NOW() WHERE id = $3 RETURNING *`,
      [status, comments || null, approvalId]
    );
    if (result.rows.length === 0) throw new Error("Approval not found");
    
    // If approved, check if all approvals are done
    if (approved) {
      const approval = result.rows[0];
      await this.checkAndCompleteMilestone(approval.milestone_id);
    }
    
    return result.rows[0];
  }

  private async checkAndCompleteMilestone(milestoneId: string): Promise<void> {
    const milestone = await this.getMilestoneById(milestoneId);
    const approvalsResult = await this.pool.query(
      "SELECT COUNT(*) as total, SUM(CASE WHEN approval_status = 'APPROVED' THEN 1 ELSE 0 END) as approved FROM milestone_approvals WHERE milestone_id = $1",
      [milestoneId]
    );
    
    const approvals = approvalsResult.rows[0];
    if (approvals.approved >= milestone.required_approvals) {
      await this.updateMilestoneStatus(milestoneId, "COMPLETED");
      await this.updateMilestoneProgress(milestoneId, 100);
    }
  }

  async getApprovalsForMilestone(milestoneId: string): Promise<MilestoneApproval[]> {
    const result = await this.pool.query(
      "SELECT * FROM milestone_approvals WHERE milestone_id = $1 ORDER BY created_at ASC",
      [milestoneId]
    );
    return result.rows;
  }

  async getMilestoneStats(projectId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) as total_milestones,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        ROUND(AVG(progress_percentage)::numeric, 2) as avg_progress,
        SUM(budget_allocation) as total_budget
       FROM milestones WHERE project_id = $1`,
      [projectId]
    );
    return result.rows[0];
  }

  async completeMilestone(milestoneId: string, completionDate?: string): Promise<Milestone> {
    const result = await this.pool.query(
      `UPDATE milestones SET status = 'COMPLETED', actual_completion_date = COALESCE($1, NOW()), progress_percentage = 100, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [completionDate || null, milestoneId]
    );
    if (result.rows.length === 0) throw new Error("Milestone not found");
    return result.rows[0];
  }
}
