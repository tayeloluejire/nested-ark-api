export interface MilestoneCreatePayload {
  project_id: string;
  title: string;
  description: string;
  budget_allocation: number;
  estimated_start_date: string;
  estimated_completion_date: string;
  deliverables: string[];
  required_approvals: number;
  approval_period_days?: number;
}

export interface Milestone {
  id: string;
  project_id: string;
  contractor_id?: string;
  title: string;
  description: string;
  budget_allocation: number;
  estimated_start_date: string;
  estimated_completion_date: string;
  actual_completion_date?: string;
  deliverables: string[];
  status: "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";
  progress_percentage: number;
  required_approvals: number;
  approval_period_days: number;
  created_at: string;
  updated_at: string;
}

export interface MilestoneEvidence {
  id: string;
  milestone_id: string;
  contractor_id: string;
  evidence_type: "PHOTO" | "VIDEO" | "DOCUMENT" | "INSPECTION_REPORT";
  file_url: string;
  description: string;
  submission_date: string;
}

export interface MilestoneApproval {
  id: string;
  milestone_id: string;
  approver_id: string;
  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  comments: string;
  approval_date?: string;
}

export interface MilestoneWithDetails extends Milestone {
  project_title: string;
  contractor: {
    id: string;
    company_name: string;
    rating: number;
  } | null;
  evidence_count: number;
  approvals_count: number;
  approved_count: number;
  next_approval_deadline?: string;
}

export interface MilestoneUpdatePayload {
  status?: string;
  progress_percentage?: number;
  actual_completion_date?: string;
  contractor_id?: string;
}

export interface EvidenceSubmitPayload {
  milestone_id: string;
  evidence_type: "PHOTO" | "VIDEO" | "DOCUMENT" | "INSPECTION_REPORT";
  file_url: string;
  description: string;
}
