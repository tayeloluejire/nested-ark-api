export interface ProjectCreatePayload {
  title: string;
  description: string;
  location: string;
  country: string;
  budget: number;
  currency: string;
  category: string;
  timeline_months: number;
  target_completion_date: string;
  sponsor_id: string;
  escrow_wallet_id?: string;
}

export interface Project {
  id: string;
  sponsor_id: string;
  title: string;
  description: string;
  location: string;
  country: string;
  budget: number;
  currency: string;
  category: string;
  timeline_months: number;
  target_completion_date: string;
  status: "DRAFT" | "ACTIVE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  progress_percentage: number;
  escrow_wallet_id: string;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithDetails extends Project {
  sponsor: {
    id: string;
    email: string;
    company_name: string;
    location: string;
  };
  milestone_count: number;
  contractor_count: number;
  investor_count: number;
  total_invested: number;
}

export interface ProjectUpdatePayload {
  title?: string;
  description?: string;
  status?: "DRAFT" | "ACTIVE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  progress_percentage?: number;
  target_completion_date?: string;
}

export interface ProjectListQuery {
  status?: string;
  category?: string;
  country?: string;
  sponsor_id?: string;
  limit?: number;
  offset?: number;
  sort?: "created_at" | "budget" | "progress_percentage";
}
