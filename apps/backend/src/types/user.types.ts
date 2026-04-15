export interface UserProfileRequest {
  bio?: string;
  company_name?: string;
  location?: string;
  country?: string;
  timezone?: string;
  website?: string;
  social_links?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
}

export interface UserProfileResponse {
  id: string;
  user_id: string;
  bio: string;
  company_name: string;
  location: string;
  country: string;
  timezone: string;
  website: string;
  social_links: any;
  phone_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IdentityDocumentRequest {
  document_type: 'PASSPORT' | 'DRIVERS_LICENSE' | 'NATIONAL_ID';
  document_number: string;
  file_url: string;
  expiry_date?: string;
}

export interface IdentityDocumentResponse {
  id: string;
  user_id: string;
  document_type: string;
  document_number: string;
  file_url: string;
  expiry_date: string;
  verified: boolean;
  verified_at: Date;
  verification_notes: string;
  created_at: Date;
}

export interface KYCRequest {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  residential_address: string;
  residential_city: string;
  residential_country: string;
  residential_postal_code: string;
  phone_number: string;
  annual_income_range?: string;
  employment_status?: string;
  industry?: string;
  company_name?: string;
  job_title?: string;
}

export interface KYCResponse {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  residential_address: string;
  residential_city: string;
  residential_country: string;
  residential_postal_code: string;
  phone_number: string;
  annual_income_range: string;
  employment_status: string;
  industry: string;
  company_name: string;
  job_title: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW';
  submitted_at: Date;
  reviewed_at: Date;
  review_notes: string;
  created_at: Date;
  updated_at: Date;
}

export interface PhoneVerificationRequest {
  phone_number: string;
  country_code: string;
}

export interface PhoneVerificationResponse {
  verification_id: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  phone_number: string;
  expires_at: Date;
}

export interface VerificationCode {
  code: string;
  phone_number: string;
  expires_at: Date;
}

export interface UserFullProfile {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    created_at: Date;
  };
  profile: UserProfileResponse;
  kyc: KYCResponse;
  identity_documents: IdentityDocumentResponse[];
  phone_verified: boolean;
  identity_verified: boolean;
  kyc_status: string;
}

// Alias for backward compatibility with user.controller imports
export type UpdateProfileRequest = UserProfileRequest;
