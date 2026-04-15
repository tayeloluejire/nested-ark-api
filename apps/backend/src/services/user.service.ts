import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  UserProfileRequest,
  UserProfileResponse,
  IdentityDocumentRequest,
  KYCRequest,
  KYCResponse,
  UserFullProfile,
} from '../types/user.types';

export class UserService {
  constructor(private pool: Pool) {}

  // ============================================================================
  // PROFILE MANAGEMENT
  // ============================================================================

  async getOrCreateProfile(userId: string): Promise<UserProfileResponse> {
    const existingProfile = await this.pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (existingProfile.rows.length > 0) {
      return existingProfile.rows[0];
    }

    const id = uuidv4();
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO user_profiles (id, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, bio, company_name, location, country, timezone, 
                 website, social_links, phone_verified, created_at, updated_at`,
      [id, userId, now, now]
    );

    return result.rows[0];
  }

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const result = await this.pool.query(
      `SELECT id, user_id, bio, company_name, location, country, timezone, 
              website, social_links, phone_verified, created_at, updated_at
       FROM user_profiles 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return this.getOrCreateProfile(userId);
    }

    return result.rows[0];
  }

  async updateProfile(
    userId: string,
    data: UserProfileRequest
  ): Promise<UserProfileResponse> {
    const now = new Date();

    // Ensure profile exists
    await this.getOrCreateProfile(userId);

    const result = await this.pool.query(
      `UPDATE user_profiles 
       SET bio = COALESCE($2, bio),
           company_name = COALESCE($3, company_name),
           location = COALESCE($4, location),
           country = COALESCE($5, country),
           timezone = COALESCE($6, timezone),
           website = COALESCE($7, website),
           social_links = COALESCE($8::jsonb, social_links),
           updated_at = $9
       WHERE user_id = $1
       RETURNING id, user_id, bio, company_name, location, country, timezone,
                 website, social_links, phone_verified, created_at, updated_at`,
      [
        userId,
        data.bio,
        data.company_name,
        data.location,
        data.country,
        data.timezone,
        data.website,
        data.social_links ? JSON.stringify(data.social_links) : null,
        now,
      ]
    );

    return result.rows[0];
  }

  // ============================================================================
  // IDENTITY VERIFICATION
  // ============================================================================

  async uploadIdentityDocument(
    userId: string,
    data: IdentityDocumentRequest
  ) {
    const id = uuidv4();
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO identity_documents 
       (id, user_id, document_type, document_number, file_url, expiry_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, document_type, document_number, file_url, 
                 expiry_date, verified, verified_at, verification_notes, created_at`,
      [
        id,
        userId,
        data.document_type,
        data.document_number,
        data.file_url,
        data.expiry_date || null,
        now,
      ]
    );

    return result.rows[0];
  }

  async getIdentityDocuments(userId: string) {
    const result = await this.pool.query(
      `SELECT id, user_id, document_type, document_number, file_url, 
              expiry_date, verified, verified_at, verification_notes, created_at
       FROM identity_documents 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async getIdentityDocumentById(docId: string, userId: string) {
    const result = await this.pool.query(
      `SELECT id, user_id, document_type, document_number, file_url, 
              expiry_date, verified, verified_at, verification_notes, created_at
       FROM identity_documents 
       WHERE id = $1 AND user_id = $2`,
      [docId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Document not found');
    }

    return result.rows[0];
  }

  async verifyIdentityDocument(
    docId: string,
    userId: string,
    isVerified: boolean,
    notes: string
  ) {
    const now = new Date();

    const result = await this.pool.query(
      `UPDATE identity_documents 
       SET verified = $3,
           verified_at = $4,
           verification_notes = $5,
           updated_at = $4
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, document_type, document_number, file_url, 
                 expiry_date, verified, verified_at, verification_notes, created_at`,
      [docId, userId, isVerified, now, notes]
    );

    if (result.rows.length === 0) {
      throw new Error('Document not found');
    }

    // Update user's identity_verified status if document is verified
    if (isVerified) {
      await this.pool.query(
        'UPDATE users SET identity_verified = TRUE WHERE id = $1',
        [userId]
      );
    }

    return result.rows[0];
  }

  // ============================================================================
  // KYC (KNOW YOUR CUSTOMER)
  // ============================================================================

  async submitKYC(userId: string, data: KYCRequest): Promise<KYCResponse> {
    const id = uuidv4();
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO kyc_submissions 
       (id, user_id, first_name, last_name, date_of_birth, nationality,
        residential_address, residential_city, residential_country, residential_postal_code,
        phone_number, annual_income_range, employment_status, industry, company_name, job_title,
        status, submitted_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING id, user_id, first_name, last_name, date_of_birth, nationality,
                 residential_address, residential_city, residential_country, residential_postal_code,
                 phone_number, annual_income_range, employment_status, industry, company_name, job_title,
                 status, submitted_at, reviewed_at, review_notes, created_at, updated_at`,
      [
        id,
        userId,
        data.first_name,
        data.last_name,
        data.date_of_birth,
        data.nationality,
        data.residential_address,
        data.residential_city,
        data.residential_country,
        data.residential_postal_code,
        data.phone_number,
        data.annual_income_range || null,
        data.employment_status || null,
        data.industry || null,
        data.company_name || null,
        data.job_title || null,
        'PENDING',
        now,
        now,
        now,
      ]
    );

    // Update user KYC status
    await this.pool.query(
      'UPDATE users SET kyc_status = $2 WHERE id = $1',
      [userId, 'PENDING']
    );

    return result.rows[0];
  }

  async getKYCStatus(userId: string): Promise<KYCResponse> {
    const result = await this.pool.query(
      `SELECT id, user_id, first_name, last_name, date_of_birth, nationality,
              residential_address, residential_city, residential_country, residential_postal_code,
              phone_number, annual_income_range, employment_status, industry, company_name, job_title,
              status, submitted_at, reviewed_at, review_notes, created_at, updated_at
       FROM kyc_submissions 
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('No KYC submission found');
    }

    return result.rows[0];
  }

  async updateKYCStatus(
    userId: string,
    status: 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW',
    notes: string
  ) {
    const now = new Date();

    const result = await this.pool.query(
      `UPDATE kyc_submissions 
       SET status = $2,
           reviewed_at = $3,
           review_notes = $4,
           updated_at = $3
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1
       RETURNING id, user_id, first_name, last_name, date_of_birth, nationality,
                 residential_address, residential_city, residential_country, residential_postal_code,
                 phone_number, annual_income_range, employment_status, industry, company_name, job_title,
                 status, submitted_at, reviewed_at, review_notes, created_at, updated_at`,
      [userId, status, now, notes]
    );

    // Update user's overall KYC status
    await this.pool.query(
      'UPDATE users SET kyc_status = $2 WHERE id = $1',
      [userId, status]
    );

    return result.rows[0];
  }

  async getAllPendingKYC() {
    const result = await this.pool.query(
      `SELECT id, user_id, first_name, last_name, date_of_birth, nationality,
              residential_address, residential_city, residential_country, residential_postal_code,
              phone_number, annual_income_range, employment_status, industry, company_name, job_title,
              status, submitted_at, reviewed_at, review_notes, created_at, updated_at
       FROM kyc_submissions 
       WHERE status = 'PENDING'
       ORDER BY submitted_at ASC`
    );

    return result.rows;
  }

  // ============================================================================
  // PHONE VERIFICATION
  // ============================================================================

  async generatePhoneVerificationCode(userId: string): Promise<string> {
    const code = Math.random().toString().slice(2, 8); // 6-digit code
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.pool.query(
      `INSERT INTO phone_verification_codes (user_id, code, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE 
       SET code = $2, expires_at = $3`,
      [userId, code, expiresAt]
    );

    return code;
  }

  async verifyPhoneCode(userId: string, code: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT code, expires_at FROM phone_verification_codes
       WHERE user_id = $1 AND code = $2 AND expires_at > NOW()`,
      [userId, code]
    );

    if (result.rows.length === 0) {
      return false;
    }

    // Mark phone as verified
    await this.pool.query(
      `UPDATE user_profiles 
       SET phone_verified = TRUE
       WHERE user_id = $1`,
      [userId]
    );

    // Delete the verification code
    await this.pool.query(
      'DELETE FROM phone_verification_codes WHERE user_id = $1',
      [userId]
    );

    return true;
  }

  // ============================================================================
  // FULL PROFILE
  // ============================================================================

  async getFullProfile(userId: string): Promise<UserFullProfile> {
    const userResult = await this.pool.query(
      'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const profile = await this.getProfile(userId);
    const identityDocuments = await this.getIdentityDocuments(userId);

    let kyc: any = null;
    try {
      kyc = await this.getKYCStatus(userId);
    } catch (error) {
      // No KYC submitted yet
    }

    return {
      user: userResult.rows[0],
      profile,
      kyc,
      identity_documents: identityDocuments,
      phone_verified: profile.phone_verified || false,
      identity_verified: userResult.rows[0].identity_verified || false,
      kyc_status: userResult.rows[0].kyc_status || 'NOT_STARTED',
    };
  }
}
