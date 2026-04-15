export interface ContractorCreatePayload {
  company_name: string;
  bio: string;
  specialization: string;
  years_experience: number;
  rating: number;
  hourly_rate: number;
  portfolio_url?: string;
  certifications?: string[];
}

export interface Contractor {
  id: string;
  user_id: string;
  company_name: string;
  bio: string;
  specialization: string;
  years_experience: number;
  rating: number;
  total_jobs: number;
  completed_jobs: number;
  hourly_rate: number;
  portfolio_url: string;
  certifications: string[];
  verified: boolean;
  verification_date: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  created_at: string;
  updated_at: string;
}

export interface ContractorBid {
  id: string;
  contractor_id: string;
  milestone_id: string;
  project_id: string;
  bid_amount: number;
  estimated_duration_days: number;
  proposal: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  created_at: string;
  updated_at: string;
}

export interface ContractorProfile extends Contractor {
  total_earnings: number;
  avg_completion_time_days: number;
  repeat_client_percentage: number;
  response_time_hours: number;
}

export interface BidCreatePayload {
  contractor_id: string;
  milestone_id: string;
  project_id?: string;
  bid_amount: number;
  estimated_duration_days: number;
  proposal: string;
}

export interface BidUpdatePayload {
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
}
