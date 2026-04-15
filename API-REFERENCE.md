# Infrastructure Platform - Complete API Reference

## Base URL
```
Development: http://localhost:3001/api
Production: https://api.infrastructure-platform.com/api
```

## Authentication
All endpoints (except `/auth/*`) require JWT Bearer token in Authorization header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 1. AUTHENTICATION ENDPOINTS

### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "full_name": "John Doe",
  "phone": "+1234567890",
  "role": "PROJECT_SPONSOR" | "CONTRACTOR" | "INVESTOR" | "ADMIN"
}

Response: 201 Created
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "PROJECT_SPONSOR",
  "status": "PENDING",
  "identity_verified": false,
  "mfa_enabled": false,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response: 200 OK
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "PROJECT_SPONSOR",
    "mfa_enabled": false
  }
}
```

### Setup MFA
```http
POST /auth/mfa-setup
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "secret": "JBSWY3DPEBLW64TMMQQ",
  "qr_code": "data:image/png;base64,...",
  "backup_codes": ["XXXXX-XXXXX", ...]
}
```

### Verify MFA
```http
POST /auth/mfa-verify
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "mfa_code": "123456"
}

Response: 200 OK
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Refresh Token
```http
POST /auth/refresh-token
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}

Response: 200 OK
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 86400
}
```

---

## 2. USER ENDPOINTS

### Get Current User Profile
```http
GET /users/me
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "PROJECT_SPONSOR",
  "phone": "+1234567890",
  "identity_verified": true,
  "kyc_status": "APPROVED",
  "mfa_enabled": true,
  "profile": {
    "bio": "Infrastructure specialist",
    "company_name": "Infrastructure Inc",
    "location": "San Francisco, CA",
    "profile_picture_url": "https://..."
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Update User Profile
```http
PUT /users/me
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "full_name": "John Doe",
  "phone": "+1234567890",
  "bio": "Updated bio",
  "company_name": "New Company",
  "location": "New York, NY"
}

Response: 200 OK
{
  "id": "uuid",
  "full_name": "John Doe",
  ...
}
```

### Upload Identity Document
```http
POST /users/me/identity-document
Authorization: Bearer <TOKEN>
Content-Type: multipart/form-data

Form Data:
- document_type: "PASSPORT" | "DRIVERS_LICENSE" | "NATIONAL_ID"
- document_file: <binary file>

Response: 200 OK
{
  "document_url": "https://...",
  "verification_status": "PENDING",
  "document_type": "PASSPORT"
}
```

### Get User by ID
```http
GET /users/:userId
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "id": "uuid",
  "full_name": "John Doe",
  "role": "PROJECT_SPONSOR",
  "profile_picture_url": "https://...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

## 3. PROJECT ENDPOINTS

### Create Project
```http
POST /projects
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "name": "Highway Construction Project",
  "description": "Construction of 50km highway",
  "location": "Texas, USA",
  "country": "USA",
  "latitude": 31.9686,
  "longitude": -99.9018,
  "project_type": "INFRASTRUCTURE",
  "budget": 10000000,
  "currency": "USD",
  "timeline_start_date": "2024-02-01",
  "timeline_end_date": "2025-12-31",
  "expected_revenue_model": "toll_collection",
  "risk_level": "MEDIUM"
}

Response: 201 Created
{
  "id": "uuid",
  "name": "Highway Construction Project",
  "status": "DRAFT",
  "budget": 10000000,
  "created_by": "uuid",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Get Projects (Paginated)
```http
GET /projects?page=1&limit=20&status=ACTIVE&project_type=INFRASTRUCTURE&sort=-created_at
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "Highway Construction Project",
      "status": "ACTIVE",
      "budget": 10000000,
      "location": "Texas, USA",
      "bid_count": 5,
      "investor_count": 3,
      "total_investment": 2000000,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

### Get Project Details
```http
GET /projects/:projectId
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "id": "uuid",
  "name": "Highway Construction Project",
  "description": "Construction of 50km highway",
  "location": "Texas, USA",
  "status": "ACTIVE",
  "budget": 10000000,
  "timeline_start_date": "2024-02-01",
  "timeline_end_date": "2025-12-31",
  "approver_id": "uuid",
  "approved_at": "2024-01-15T00:00:00Z",
  "created_by": "uuid",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-20T00:00:00Z"
}
```

### Update Project
```http
PUT /projects/:projectId
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description",
  "budget": 11000000
}

Response: 200 OK
{
  "id": "uuid",
  "name": "Updated Name",
  ...
}
```

### Delete Project
```http
DELETE /projects/:projectId
Authorization: Bearer <TOKEN>

Response: 204 No Content
```

### Get Project Dashboard
```http
GET /projects/:projectId/dashboard
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "project": {
    "id": "uuid",
    "name": "Highway Construction Project",
    "status": "ACTIVE",
    "budget": 10000000
  },
  "milestones": {
    "total": 5,
    "completed": 2,
    "in_progress": 2,
    "pending": 1,
    "completion_percentage": 40
  },
  "escrow": {
    "total_balance": 5000000,
    "reserved_amount": 1000000,
    "released_amount": 3000000,
    "available_balance": 4000000
  },
  "bids": {
    "total": 5,
    "selected": 1,
    "pending": 3
  },
  "investments": {
    "total_investors": 10,
    "total_invested": 2000000,
    "expected_roi": 15.5
  },
  "contractor": {
    "id": "uuid",
    "company_name": "ABC Construction",
    "rating": 4.8,
    "contract_amount": 8000000
  }
}
```

---

## 4. CONTRACTOR ENDPOINTS

### Create Contractor Profile
```http
POST /contractor/profile
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "company_name": "ABC Construction Inc",
  "business_registration_number": "BRN123456",
  "tax_id": "TAX123456",
  "company_size": "LARGE",
  "experience_years": 15,
  "specializations": ["INFRASTRUCTURE", "HIGHWAYS", "BRIDGES"],
  "certifications": ["ISO9001", "SAFETY_CERT"],
  "insurance_number": "INS123456",
  "insurance_expiry_date": "2025-12-31"
}

Response: 201 Created
{
  "user_id": "uuid",
  "company_name": "ABC Construction Inc",
  "verification_status": "PENDING",
  "average_rating": 0,
  "total_projects_completed": 0
}
```

### Get Contractor Profile
```http
GET /contractor/profile
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "user_id": "uuid",
  "company_name": "ABC Construction Inc",
  "business_registration_number": "BRN123456",
  "experience_years": 15,
  "specializations": ["INFRASTRUCTURE", "HIGHWAYS", "BRIDGES"],
  "certifications": ["ISO9001", "SAFETY_CERT"],
  "verification_status": "APPROVED",
  "average_rating": 4.8,
  "total_projects_completed": 12,
  "total_revenue_handled": 50000000
}
```

### Update Contractor Profile
```http
PUT /contractor/profile
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "company_name": "ABC Construction Inc",
  "specializations": ["INFRASTRUCTURE", "HIGHWAYS"],
  "certifications": ["ISO9001", "ISO14001", "SAFETY_CERT"]
}

Response: 200 OK
{
  "user_id": "uuid",
  "company_name": "ABC Construction Inc",
  ...
}
```

### Get Contractor Bids
```http
GET /contractor/bids?status=PENDING&sort=-created_at
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "project_name": "Highway Construction Project",
      "amount": 8000000,
      "timeline_days": 365,
      "status": "PENDING",
      "created_at": "2024-01-20T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

---

## 5. BIDDING ENDPOINTS

### Submit Bid
```http
POST /bids
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "project_id": "uuid",
  "amount": 8000000,
  "timeline_days": 365,
  "proposal": "We have extensive experience in highway construction...",
  "attachments": ["https://...", "https://..."]
}

Response: 201 Created
{
  "id": "uuid",
  "project_id": "uuid",
  "contractor_id": "uuid",
  "amount": 8000000,
  "timeline_days": 365,
  "status": "PENDING",
  "created_at": "2024-01-20T00:00:00Z"
}
```

### Get Bid Details
```http
GET /bids/:bidId
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "id": "uuid",
  "project_id": "uuid",
  "contractor": {
    "id": "uuid",
    "company_name": "ABC Construction",
    "rating": 4.8,
    "projects_completed": 12
  },
  "amount": 8000000,
  "timeline_days": 365,
  "proposal": "...",
  "status": "PENDING",
  "created_at": "2024-01-20T00:00:00Z"
}
```

### Accept Bid
```http
POST /bids/:bidId/accept
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "id": "uuid",
  "status": "ACCEPTED",
  "contract_id": "uuid",
  "updated_at": "2024-01-21T00:00:00Z"
}
```

### Reject Bid
```http
POST /bids/:bidId/reject
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "rejection_reason": "Budget exceeded our allocation"
}

Response: 200 OK
{
  "id": "uuid",
  "status": "REJECTED",
  "rejection_reason": "Budget exceeded our allocation",
  "updated_at": "2024-01-21T00:00:00Z"
}
```

---

## 6. MILESTONE ENDPOINTS

### Create Milestone
```http
POST /projects/:projectId/milestones
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "name": "Foundation Completion",
  "description": "Complete foundation work and obtain inspection approval",
  "budget_allocation": 1000000,
  "completion_criteria": "Inspection report approved by engineer",
  "verification_required": true,
  "target_completion_date": "2024-06-30"
}

Response: 201 Created
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "Foundation Completion",
  "budget_allocation": 1000000,
  "status": "PENDING",
  "created_at": "2024-01-21T00:00:00Z"
}
```

### Get Project Milestones
```http
GET /projects/:projectId/milestones?status=PENDING
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "Foundation Completion",
      "budget_allocation": 1000000,
      "status": "PENDING",
      "target_completion_date": "2024-06-30",
      "created_at": "2024-01-21T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

### Update Milestone
```http
PUT /milestones/:milestoneId
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "name": "Foundation Completion",
  "description": "Updated description",
  "budget_allocation": 1100000
}

Response: 200 OK
{
  "id": "uuid",
  "name": "Foundation Completion",
  ...
}
```

### Get Milestone Details
```http
GET /milestones/:milestoneId
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "Foundation Completion",
  "description": "Complete foundation work...",
  "budget_allocation": 1000000,
  "completion_criteria": "Inspection report approved",
  "status": "PENDING",
  "evidence": [],
  "created_at": "2024-01-21T00:00:00Z"
}
```

---

## 7. EVIDENCE ENDPOINTS

### Upload Milestone Evidence
```http
POST /milestones/:milestoneId/evidence
Authorization: Bearer <TOKEN>
Content-Type: multipart/form-data

Form Data:
- evidence_type: "PHOTO" | "INSPECTION_REPORT" | "ENGINEER_APPROVAL"
- file: <binary file>
- description: "Photos of completed foundation"

Response: 201 Created
{
  "id": "uuid",
  "milestone_id": "uuid",
  "file_url": "https://...",
  "evidence_type": "PHOTO",
  "uploaded_at": "2024-06-30T00:00:00Z"
}
```

### Get Milestone Evidence
```http
GET /milestones/:milestoneId/evidence
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "file_url": "https://...",
      "evidence_type": "PHOTO",
      "uploaded_at": "2024-06-30T00:00:00Z"
    }
  ]
}
```

---

## 8. ESCROW & PAYMENT ENDPOINTS

### Get Escrow Status
```http
GET /escrow/:projectId
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "id": "uuid",
  "project_id": "uuid",
  "total_balance": 5000000,
  "reserved_amount": 1000000,
  "released_amount": 3000000,
  "available_balance": 4000000,
  "status": "ACTIVE",
  "last_transaction_at": "2024-06-30T00:00:00Z"
}
```

### Fund Escrow
```http
POST /escrow/:projectId/fund
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "amount": 1000000,
  "payment_method": "STRIPE" | "BANK_TRANSFER",
  "currency": "USD"
}

Response: 201 Created
{
  "id": "uuid",
  "escrow_wallet_id": "uuid",
  "amount": 1000000,
  "transaction_type": "DEPOSIT",
  "status": "PENDING",
  "created_at": "2024-06-30T00:00:00Z"
}
```

### Get Payment Transaction
```http
GET /payments/:transactionId
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "id": "uuid",
  "escrow_wallet_id": "uuid",
  "from_user_id": "uuid",
  "to_user_id": "uuid",
  "amount": 500000,
  "transaction_type": "MILESTONE_PAYMENT",
  "status": "COMPLETED",
  "milestone_id": "uuid",
  "created_at": "2024-06-30T00:00:00Z",
  "released_at": "2024-06-30T12:00:00Z"
}
```

### Get Transaction History
```http
GET /transactions?type=MILESTONE_PAYMENT&status=COMPLETED&sort=-created_at
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "amount": 500000,
      "transaction_type": "MILESTONE_PAYMENT",
      "status": "COMPLETED",
      "created_at": "2024-06-30T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25
  }
}
```

---

## 9. INVESTMENT ENDPOINTS

### Get Available Projects for Investment
```http
GET /investments/projects?sort=-created_at&limit=20
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "Highway Construction Project",
      "location": "Texas, USA",
      "budget": 10000000,
      "status": "ACTIVE",
      "available_investment": 2000000,
      "investor_count": 10,
      "expected_roi": 15.5,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50
  }
}
```

### Create Investment
```http
POST /investments
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "project_id": "uuid",
  "amount": 500000,
  "currency": "USD",
  "payment_method": "STRIPE" | "BANK_TRANSFER"
}

Response: 201 Created
{
  "id": "uuid",
  "project_id": "uuid",
  "investor_id": "uuid",
  "amount": 500000,
  "percentage_ownership": 5,
  "status": "PENDING",
  "created_at": "2024-06-30T00:00:00Z"
}
```

### Get My Investments
```http
GET /investments?status=APPROVED
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "project_name": "Highway Construction Project",
      "amount": 500000,
      "percentage_ownership": 5,
      "status": "APPROVED",
      "expected_roi": 15.5,
      "created_at": "2024-06-30T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

### Get Investment Details
```http
GET /investments/:investmentId
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "id": "uuid",
  "project_id": "uuid",
  "project": {
    "name": "Highway Construction Project",
    "status": "ACTIVE",
    "location": "Texas, USA"
  },
  "investor_id": "uuid",
  "amount": 500000,
  "percentage_ownership": 5,
  "status": "APPROVED",
  "expected_return_percentage": 15.5,
  "expected_return_amount": 77500,
  "created_at": "2024-06-30T00:00:00Z"
}
```

### Get Investor Portfolio
```http
GET /investor/portfolio
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "total_investments": 2500000,
  "total_return_received": 187500,
  "total_roi_percentage": 7.5,
  "active_investments": 5,
  "completed_investments": 3,
  "investments": [
    {
      "id": "uuid",
      "project_name": "Highway Construction Project",
      "amount": 500000,
      "current_value": 577500,
      "return_received": 77500,
      "status": "ACTIVE"
    }
  ]
}
```

---

## 10. SETTLEMENT ENDPOINTS

### Get Settlements for Project
```http
GET /settlements/:projectId?status=COMPLETED
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "settlement_date": "2024-12-31",
      "period_start_date": "2024-01-01",
      "period_end_date": "2024-12-31",
      "total_revenue": 1000000,
      "status": "COMPLETED",
      "completed_at": "2024-12-31T23:59:59Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3
  }
}
```

### Get Settlement Distributions
```http
GET /settlements/:settlementId/distributions
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "settlement_id": "uuid",
  "total_revenue": 1000000,
  "distributions": [
    {
      "id": "uuid",
      "recipient_type": "INVESTOR",
      "recipient_id": "uuid",
      "amount": 300000,
      "percentage": 30,
      "status": "PAID",
      "paid_at": "2024-12-31T00:00:00Z"
    },
    {
      "id": "uuid",
      "recipient_type": "SPONSOR",
      "recipient_id": "uuid",
      "amount": 500000,
      "percentage": 50,
      "status": "PAID"
    },
    {
      "id": "uuid",
      "recipient_type": "PLATFORM",
      "recipient_id": "platform",
      "amount": 50000,
      "percentage": 5,
      "status": "PAID"
    },
    {
      "id": "uuid",
      "recipient_type": "MAINTENANCE",
      "recipient_id": "reserve",
      "amount": 150000,
      "percentage": 15,
      "status": "HELD"
    }
  ]
}
```

---

## 11. ADMIN ENDPOINTS

### Approve Project
```http
POST /admin/projects/:projectId/approve
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "approval_notes": "Project meets all requirements"
}

Response: 200 OK
{
  "id": "uuid",
  "status": "APPROVED",
  "approver_id": "uuid",
  "approved_at": "2024-06-30T00:00:00Z"
}
```

### Verify Milestone
```http
POST /admin/milestones/:milestoneId/verify
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "verification_notes": "All requirements met. Work completed satisfactorily."
}

Response: 200 OK
{
  "id": "uuid",
  "status": "COMPLETED",
  "verified_at": "2024-06-30T00:00:00Z",
  "verified_by": "uuid"
}
```

### Verify Contractor
```http
POST /admin/contractors/:contractorId/verify
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "verification_notes": "Documents verified. Business registration confirmed."
}

Response: 200 OK
{
  "user_id": "uuid",
  "verification_status": "APPROVED",
  "verification_completed_at": "2024-06-30T00:00:00Z"
}
```

### Get All Transactions
```http
GET /admin/transactions?status=COMPLETED&sort=-created_at
Authorization: Bearer <ADMIN_TOKEN>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "from_user": { "id": "uuid", "full_name": "John Doe" },
      "to_user": { "id": "uuid", "full_name": "ABC Construction" },
      "amount": 500000,
      "transaction_type": "MILESTONE_PAYMENT",
      "status": "COMPLETED",
      "created_at": "2024-06-30T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### Get Audit Logs
```http
GET /admin/audit-logs?entity_type=PROJECT&action=CREATED&sort=-created_at
Authorization: Bearer <ADMIN_TOKEN>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "action": "CREATED",
      "entity_type": "PROJECT",
      "entity_id": "uuid",
      "changes": {
        "name": "Highway Construction Project",
        "budget": 10000000
      },
      "ip_address": "192.168.1.1",
      "created_at": "2024-06-30T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500
  }
}
```

### Resolve Dispute
```http
POST /admin/disputes/:disputeId/resolve
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "resolution": "Payment dispute resolved in favor of contractor. Additional 10% authorized.",
  "decision": "APPROVE"
}

Response: 200 OK
{
  "id": "uuid",
  "status": "RESOLVED",
  "resolution": "...",
  "resolved_by": "uuid",
  "resolved_at": "2024-06-30T00:00:00Z"
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### HTTP Status Codes
- `200` - OK
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## Rate Limiting

All API endpoints are rate-limited:
- **Standard**: 100 requests per 15 minutes per IP
- **Auth endpoints**: 5 failed attempts per 15 minutes
- **Admin endpoints**: 1000 requests per 15 minutes per token

Headers included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1627603200
```

---

## Pagination

All list endpoints support pagination:
```
GET /projects?page=1&limit=20&sort=-created_at
```

Query Parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sort` - Sort field with direction (use `-` for descending)

---

## Webhooks (Future)

Subscribe to project events:
```
POST /webhooks/subscribe
{
  "url": "https://your-api.com/webhook",
  "events": ["project.created", "milestone.verified", "payment.released"]
}
```

---

End of API Reference
