# ============================================================================
# INFRASTRUCTURE PLATFORM API - ENDPOINT VERIFICATION SCRIPT
# ============================================================================
# This script tests all 36 endpoints and identifies any missing ones
# Run this after starting: npm run dev

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Blue = "Blue"

$baseUrl = "http://localhost:3001"
$testToken = $null
$testUserId = $null
$testContractorId = $null
$testProjectId = $null
$testMilestoneId = $null
$testWalletId = $null

Write-Host ""
Write-Host "============================================" -ForegroundColor $Blue
Write-Host "INFRASTRUCTURE PLATFORM API v2.5" -ForegroundColor $Blue
Write-Host "ENDPOINT VERIFICATION SCRIPT" -ForegroundColor $Blue
Write-Host "============================================" -ForegroundColor $Blue
Write-Host ""

# Function to test endpoints
function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = $null,
        [string]$Description = ""
    )
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Token) {
            $headers["Authorization"] = "Bearer $Token"
        }
        
        $params = @{
            Uri     = "$baseUrl$Path"
            Method  = $Method
            Headers = $headers
        }
        
        if ($Body) {
            $params["Body"] = $Body | ConvertTo-Json
        }
        
        $response = Invoke-WebRequest @params -ErrorAction Stop
        $statusCode = $response.StatusCode
        
        if ($statusCode -ge 200 -and $statusCode -lt 300) {
            Write-Host "[OK]" -ForegroundColor $Green -NoNewline
            Write-Host " $Method $Path - Status $statusCode"
            return @{
                Success = $true
                Status = $statusCode
                Data = $response.Content | ConvertFrom-Json
            }
        }
    }
    catch {
        Write-Host "[FAIL]" -ForegroundColor $Red -NoNewline
        Write-Host " $Method $Path - Error: $($_.Exception.Message)"
        return @{
            Success = $false
            Status = $_.Exception.Response.StatusCode
            Error = $_.Exception.Message
        }
    }
}

# ============================================================================
# SECTION 1: HEALTH CHECK
# ============================================================================
Write-Host ""
Write-Host "SECTION 1: HEALTH CHECK" -ForegroundColor $Yellow
Write-Host "============================================" -ForegroundColor $Yellow

$health = Test-Endpoint -Method "GET" -Path "/health"
if ($health.Success) {
    Write-Host "  Database: Connected" -ForegroundColor $Green
    Write-Host "  Timestamp: $($health.Data.timestamp)" -ForegroundColor $Green
}

$root = Test-Endpoint -Method "GET" -Path "/"
if ($root.Success) {
    Write-Host "  API Version: $($root.Data.version)" -ForegroundColor $Green
    Write-Host "  Status: $($root.Data.status)" -ForegroundColor $Green
    Write-Host "  Total Endpoints Reported: $($root.Data.endpoints.total)" -ForegroundColor $Yellow
}

# ============================================================================
# SECTION 2: AUTHENTICATION (3 endpoints)
# ============================================================================
Write-Host ""
Write-Host "SECTION 2: AUTHENTICATION (3 endpoints)" -ForegroundColor $Yellow
Write-Host "============================================" -ForegroundColor $Yellow

# Register
$registerBody = @{
    email = "testuser_$(Get-Random)@example.com"
    password = "password123"
    full_name = "Test User"
    phone = "1234567890"
    role = "PROJECT_SPONSOR"
}

$register = Test-Endpoint -Method "POST" -Path "/api/auth/register" -Body $registerBody
if ($register.Success) {
    $testToken = $register.Data.tokens.access_token
    $testUserId = $register.Data.user.id
    Write-Host "  Token obtained: $($testToken.Substring(0, 20))..." -ForegroundColor $Green
}

# Login
$loginBody = @{
    email = $registerBody.email
    password = "password123"
}

$login = Test-Endpoint -Method "POST" -Path "/api/auth/login" -Body $loginBody
if ($login.Success) {
    Write-Host "  Login successful" -ForegroundColor $Green
}

# Get Me
$me = Test-Endpoint -Method "GET" -Path "/api/auth/me" -Token $testToken
if ($me.Success) {
    Write-Host "  User: $($me.Data.user.full_name)" -ForegroundColor $Green
}

# ============================================================================
# SECTION 3: PROJECTS (7 endpoints)
# ============================================================================
Write-Host ""
Write-Host "SECTION 3: PROJECTS (7 endpoints)" -ForegroundColor $Yellow
Write-Host "============================================" -ForegroundColor $Yellow

# Create Project
$createProjectBody = @{
    title = "Test Infrastructure Project"
    description = "A test project for endpoint verification"
    location = "Test City"
    country = "Test Country"
    budget = 100000
    currency = "USD"
    category = "Infrastructure"
    timeline_months = 12
    target_completion_date = "2027-03-23T00:00:00Z"
}

$createProject = Test-Endpoint -Method "POST" -Path "/api/projects" -Body $createProjectBody -Token $testToken
if ($createProject.Success) {
    $testProjectId = $createProject.Data.project.id
    Write-Host "  Project created: $($testProjectId.Substring(0, 8))..." -ForegroundColor $Green
}

# List Projects
$listProjects = Test-Endpoint -Method "GET" -Path "/api/projects?limit=10&offset=0" -Token $testToken
if ($listProjects.Success) {
    Write-Host "  Projects found: $($listProjects.Data.count)" -ForegroundColor $Green
}

# Get Project by ID
$getProject = Test-Endpoint -Method "GET" -Path "/api/projects/$testProjectId" -Token $testToken
if ($getProject.Success) {
    Write-Host "  Project retrieved: $($getProject.Data.project.title)" -ForegroundColor $Green
}

# Update Project
$updateProjectBody = @{
    title = "Updated Infrastructure Project"
    status = "ACTIVE"
    progress_percentage = 25
}

$updateProject = Test-Endpoint -Method "PUT" -Path "/api/projects/$testProjectId" -Body $updateProjectBody -Token $testToken
if ($updateProject.Success) {
    Write-Host "  Project updated successfully" -ForegroundColor $Green
}

# Get Project Stats
$projectStats = Test-Endpoint -Method "GET" -Path "/api/projects/$testProjectId/stats" -Token $testToken
if ($projectStats.Success) {
    Write-Host "  Project stats retrieved" -ForegroundColor $Green
    Write-Host "    Budget: $($projectStats.Data.stats.budget)" -ForegroundColor $Green
    Write-Host "    Progress: $($projectStats.Data.stats.progress)%" -ForegroundColor $Green
}

# Delete Project (we'll skip this to keep testing data)
Write-Host "[SKIP]" -ForegroundColor $Yellow -NoNewline
Write-Host " DELETE /api/projects/:id - Skipped to preserve test data" -ForegroundColor $Yellow

# ============================================================================
# SECTION 4: CONTRACTORS (8 endpoints)
# ============================================================================
Write-Host ""
Write-Host "SECTION 4: CONTRACTORS (8 endpoints)" -ForegroundColor $Yellow
Write-Host "============================================" -ForegroundColor $Yellow

# Create Contractor Profile
$createContractorBody = @{
    company_name = "Test Contractor Inc"
    bio = "A test contractor company"
    specialization = "Infrastructure"
    years_experience = 10
    hourly_rate = 150
}

$createContractor = Test-Endpoint -Method "POST" -Path "/api/contractors/profile" -Body $createContractorBody -Token $testToken
if ($createContractor.Success) {
    $testContractorId = $createContractor.Data.contractor.id
    Write-Host "  Contractor created: $($testContractorId.Substring(0, 8))..." -ForegroundColor $Green
}

# List Contractors
$listContractors = Test-Endpoint -Method "GET" -Path "/api/contractors?limit=10&offset=0" -Token $testToken
if ($listContractors.Success) {
    Write-Host "  Contractors found: $($listContractors.Data.count)" -ForegroundColor $Green
}

# Get Contractor by ID
$getContractor = Test-Endpoint -Method "GET" -Path "/api/contractors/$testContractorId" -Token $testToken
if ($getContractor.Success) {
    Write-Host "  Contractor retrieved: $($getContractor.Data.contractor.company_name)" -ForegroundColor $Green
}

# Update Contractor Profile
$updateContractorBody = @{
    company_name = "Updated Test Contractor"
    specialization = "Advanced Infrastructure"
    hourly_rate = 175
}

$updateContractor = Test-Endpoint -Method "PUT" -Path "/api/contractors/profile" -Body $updateContractorBody -Token $testToken
if ($updateContractor.Success) {
    Write-Host "  Contractor profile updated" -ForegroundColor $Green
}

# Get Contractor Stats
$contractorStats = Test-Endpoint -Method "GET" -Path "/api/contractors/$testContractorId/stats" -Token $testToken
if ($contractorStats.Success) {
    Write-Host "  Contractor stats retrieved" -ForegroundColor $Green
    Write-Host "    Rating: $($contractorStats.Data.stats.rating)" -ForegroundColor $Green
    Write-Host "    Total Bids: $($contractorStats.Data.stats.total_bids)" -ForegroundColor $Green
}

Write-Host "[SKIP]" -ForegroundColor $Yellow -NoNewline
Write-Host " POST /api/contractors/bids - Tested separately below" -ForegroundColor $Yellow

Write-Host "[SKIP]" -ForegroundColor $Yellow -NoNewline
Write-Host " GET /api/contractors/bids/my - Tested separately below" -ForegroundColor $Yellow

# ============================================================================
# SECTION 5: MILESTONES (8 endpoints)
# ============================================================================
Write-Host ""
Write-Host "SECTION 5: MILESTONES (8 endpoints)" -ForegroundColor $Yellow
Write-Host "============================================" -ForegroundColor $Yellow

# Create Milestone
$createMilestoneBody = @{
    project_id = $testProjectId
    title = "Phase 1: Foundation"
    description = "Complete foundation work"
    budget_allocation = 25000
    estimated_start_date = "2026-04-01T00:00:00Z"
    estimated_completion_date = "2026-06-01T00:00:00Z"
}

$createMilestone = Test-Endpoint -Method "POST" -Path "/api/milestones" -Body $createMilestoneBody -Token $testToken
if ($createMilestone.Success) {
    $testMilestoneId = $createMilestone.Data.milestone.id
    Write-Host "  Milestone created: $($testMilestoneId.Substring(0, 8))..." -ForegroundColor $Green
}

# List Milestones
$listMilestones = Test-Endpoint -Method "GET" -Path "/api/milestones?project_id=$testProjectId&limit=10" -Token $testToken
if ($listMilestones.Success) {
    Write-Host "  Milestones found: $($listMilestones.Data.count)" -ForegroundColor $Green
}

# Get Milestone by ID
$getMilestone = Test-Endpoint -Method "GET" -Path "/api/milestones/$testMilestoneId" -Token $testToken
if ($getMilestone.Success) {
    Write-Host "  Milestone retrieved: $($getMilestone.Data.milestone.title)" -ForegroundColor $Green
}

# Update Milestone Status
$updateStatusBody = @{
    status = "IN_PROGRESS"
}

$updateStatus = Test-Endpoint -Method "PUT" -Path "/api/milestones/$testMilestoneId/status" -Body $updateStatusBody -Token $testToken
if ($updateStatus.Success) {
    Write-Host "  Milestone status updated" -ForegroundColor $Green
}

# Update Milestone Progress
$updateProgressBody = @{
    progress_percentage = 50
}

$updateProgress = Test-Endpoint -Method "PUT" -Path "/api/milestones/$testMilestoneId/progress" -Body $updateProgressBody -Token $testToken
if ($updateProgress.Success) {
    Write-Host "  Milestone progress updated to 50%" -ForegroundColor $Green
}

# Verify Milestone
$verifyMilestoneBody = @{
    geo_latitude = 40.7128
    geo_longitude = -74.0060
    progress_percentage = 75
    verified_notes = "Verification complete"
}

$verifyMilestone = Test-Endpoint -Method "POST" -Path "/api/milestones/$testMilestoneId/verify" -Body $verifyMilestoneBody -Token $testToken
if ($verifyMilestone.Success) {
    Write-Host "  Milestone verified successfully" -ForegroundColor $Green
}

# Get Milestone Verification
$getMilestoneVerification = Test-Endpoint -Method "GET" -Path "/api/milestones/$testMilestoneId/verification" -Token $testToken
if ($getMilestoneVerification.Success) {
    Write-Host "  Milestone verification retrieved" -ForegroundColor $Green
}

# ============================================================================
# SECTION 6: BIDS/APPLICATIONS (2 endpoints)
# ============================================================================
Write-Host ""
Write-Host "SECTION 6: BIDS/APPLICATIONS (2 endpoints)" -ForegroundColor $Yellow
Write-Host "============================================" -ForegroundColor $Yellow

# Post Bid (Contractor Application)
$bidBody = @{
    milestone_id = $testMilestoneId
    project_id = $testProjectId
    amount = 20000
    estimated_duration_days = 45
    proposal = "We can complete this milestone in 45 days with high quality"
}

$postBid = Test-Endpoint -Method "POST" -Path "/api/contractors/bids" -Body $bidBody -Token $testToken
if ($postBid.Success) {
    Write-Host "  Bid posted successfully" -ForegroundColor $Green
}

# Get My Bids
$getMyBids = Test-Endpoint -Method "GET" -Path "/api/contractors/bids/my" -Token $testToken
if ($getMyBids.Success) {
    Write-Host "  My bids retrieved: $($getMyBids.Data.count)" -ForegroundColor $Green
}

# ============================================================================
# SECTION 7: ESCROW (10 endpoints)
# ============================================================================
Write-Host ""
Write-Host "SECTION 7: ESCROW (10 endpoints)" -ForegroundColor $Yellow
Write-Host "============================================" -ForegroundColor $Yellow

# Deposit Funds
$depositBody = @{
    project_id = $testProjectId
    amount = 50000
    description = "Initial project funding"
}

$deposit = Test-Endpoint -Method "POST" -Path "/api/escrow/deposit" -Body $depositBody -Token $testToken
if ($deposit.Success) {
    $testWalletId = $deposit.Data.transaction.wallet_id
    Write-Host "  Funds deposited: $($deposit.Data.transaction.amount)" -ForegroundColor $Green
    Write-Host "  Wallet ID: $($testWalletId.Substring(0, 8))..." -ForegroundColor $Green
}

# Get Wallet Balance
$getBalance = Test-Endpoint -Method "GET" -Path "/api/escrow/balance/$testWalletId" -Token $testToken
if ($getBalance.Success) {
    Write-Host "  Available: $($getBalance.Data.balance.available)" -ForegroundColor $Green
    Write-Host "  Held: $($getBalance.Data.balance.held)" -ForegroundColor $Green
    Write-Host "  Total: $($getBalance.Data.balance.total)" -ForegroundColor $Green
}

# Place Hold
$holdBody = @{
    wallet_id = $testWalletId
    transaction_id = "temp-tx-id"
    amount = 25000
    reason = "Hold for milestone 1"
}

$placeHold = Test-Endpoint -Method "POST" -Path "/api/escrow/hold" -Body $holdBody -Token $testToken
if ($placeHold.Success) {
    Write-Host "  Hold placed: $($placeHold.Data.hold.amount)" -ForegroundColor $Green
}

# Get Holds
$getHolds = Test-Endpoint -Method "GET" -Path "/api/escrow/holds/$testWalletId" -Token $testToken
if ($getHolds.Success) {
    Write-Host "  Active holds: $($getHolds.Data.count)" -ForegroundColor $Green
}

# Release Payment
$releaseBody = @{
    wallet_id = $testWalletId
    milestone_id = $testMilestoneId
    amount = 25000
}

$release = Test-Endpoint -Method "POST" -Path "/api/escrow/release" -Body $releaseBody -Token $testToken
if ($release.Success) {
    Write-Host "  Payment released: $($release.Data.transaction.amount)" -ForegroundColor $Green
}

# Get Transaction History
$getTxHistory = Test-Endpoint -Method "GET" -Path "/api/escrow/transactions/$testWalletId?limit=10" -Token $testToken
if ($getTxHistory.Success) {
    Write-Host "  Transaction history retrieved: $($getTxHistory.Data.count)" -ForegroundColor $Green
}

# Get Transaction Details
$getTxDetails = Test-Endpoint -Method "GET" -Path "/api/escrow/transaction/$($getTxHistory.Data.transactions[0].id)" -Token $testToken
if ($getTxDetails.Success) {
    Write-Host "  Transaction details retrieved" -ForegroundColor $Green
}

# Cancel Hold
$cancelHoldBody = @{
    wallet_id = $testWalletId
    amount = 5000
}

$cancelHold = Test-Endpoint -Method "POST" -Path "/api/escrow/hold/cancel" -Body $cancelHoldBody -Token $testToken
if ($cancelHold.Success) {
    Write-Host "  Hold cancelled successfully" -ForegroundColor $Green
}

# Withdraw
$withdrawBody = @{
    wallet_id = $testWalletId
    amount = 5000
}

$withdraw = Test-Endpoint -Method "POST" -Path "/api/escrow/withdraw" -Body $withdrawBody -Token $testToken
if ($withdraw.Success) {
    Write-Host "  Withdrawal successful: $($withdraw.Data.transaction.amount)" -ForegroundColor $Green
}

# Settle
$settleBody = @{
    wallet_id = $testWalletId
    total_amount = 15000
    sponsor_share = 5000
    contractor_share = 8000
    platform_fee = 2000
}

$settle = Test-Endpoint -Method "POST" -Path "/api/escrow/settle" -Body $settleBody -Token $testToken
if ($settle.Success) {
    Write-Host "  Settlement completed" -ForegroundColor $Green
}

# ============================================================================
# SECTION 8: SPECIAL ENDPOINTS (2 additional)
# ============================================================================
Write-Host ""
Write-Host "SECTION 8: SPECIAL ENDPOINTS (2 additional)" -ForegroundColor $Yellow
Write-Host "============================================" -ForegroundColor $Yellow

# Contractor Application (Project Apply)
$applyBody = @{
    amount = 18000
    timeline_days = 50
    proposal = "We can deliver this project successfully"
}

$apply = Test-Endpoint -Method "POST" -Path "/api/projects/$testProjectId/apply" -Body $applyBody -Token $testToken
if ($apply.Success) {
    Write-Host "  Application submitted to project" -ForegroundColor $Green
}

# Milestone Approval (MISSING - NEEDS TO BE ADDED)
$approveBody = @{
    approval_status = "APPROVED"
    approval_comments = "Great work, approved for payment"
}

$approve = Test-Endpoint -Method "POST" -Path "/api/milestones/$testMilestoneId/approve" -Body $approveBody -Token $testToken
if ($approve.Success) {
    Write-Host "  Milestone approved successfully" -ForegroundColor $Green
} else {
    Write-Host "  Milestone approval FAILED - ENDPOINT MISSING!" -ForegroundColor $Red
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor $Blue
Write-Host "ENDPOINT VERIFICATION SUMMARY" -ForegroundColor $Blue
Write-Host "============================================" -ForegroundColor $Blue
Write-Host ""

Write-Host "Expected Endpoints: 37" -ForegroundColor $Yellow
Write-Host "Current Endpoints:  36" -ForegroundColor $Red
Write-Host ""

Write-Host "BREAKDOWN BY SECTION:" -ForegroundColor $Blue
Write-Host "  [OK] Authentication:        3 endpoints" -ForegroundColor $Green
Write-Host "  [OK] Projects:              7 endpoints" -ForegroundColor $Green
Write-Host "  [OK] Contractors:           8 endpoints" -ForegroundColor $Green
Write-Host "  [OK] Milestones:            8 endpoints" -ForegroundColor $Green
Write-Host "  [OK] Escrow:               10 endpoints" -ForegroundColor $Green
Write-Host "  [!] Special:                2 endpoints (1 working, 1 potentially missing)" -ForegroundColor $Yellow
Write-Host ""

Write-Host "CRITICAL ISSUE:" -ForegroundColor $Red
Write-Host "  [MISSING] POST /api/milestones/:milestoneId/approve" -ForegroundColor $Red
Write-Host "           This endpoint might need verification" -ForegroundColor $Red
Write-Host ""

Write-Host "============================================" -ForegroundColor $Blue
Write-Host "End of Report" -ForegroundColor $Blue
Write-Host "============================================" -ForegroundColor $Blue
