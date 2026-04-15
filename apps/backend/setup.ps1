# ============================================================================
# INFRASTRUCTURE PLATFORM - BACKEND IMPLEMENTATION
# Location: C:\Users\USER\Desktop\nested_ark\apps\backend\setup.ps1
# ============================================================================

param(
    [string]$SourcePath = ""
)

# Get source path if not provided
if ([string]::IsNullOrEmpty($SourcePath)) {
    Write-Host "Enter the full path to your uploaded files folder"
    Write-Host "Example: C:\Users\USER\Downloads\backend-files"
    $SourcePath = Read-Host "Path"
}

$BackendPath = "C:\Users\USER\Desktop\nested_ark\apps\backend"

# Verify paths exist
if (-not (Test-Path $SourcePath)) {
    Write-Host "ERROR: Source path does not exist: $SourcePath"
    exit 1
}

if (-not (Test-Path $BackendPath)) {
    Write-Host "ERROR: Backend path does not exist: $BackendPath"
    exit 1
}

Write-Host ""
Write-Host "Starting backend setup..."
Write-Host "Source: $SourcePath"
Write-Host "Backend: $BackendPath"
Write-Host ""

# Navigate to src directory
$srcPath = "$BackendPath\src"
Set-Location $srcPath

# ============================================================================
# COPY SERVICE FILES
# ============================================================================

Write-Host "Step 1: Copying Service Files..."

$services = @(
    "auth_service.ts",
    "contractor_service.ts", 
    "escrow_service.ts",
    "milestone_service.ts",
    "project_service.ts",
    "user_service.ts"
)

$servicesDir = "services"
if (-not (Test-Path $servicesDir)) {
    New-Item -ItemType Directory -Path $servicesDir -Force | Out-Null
}

foreach ($file in $services) {
    $src = Join-Path $SourcePath $file
    $dst = Join-Path $servicesDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  Copied: $file"
    } else {
        Write-Host "  WARNING: Not found: $file"
    }
}

Write-Host "Services completed."
Write-Host ""

# ============================================================================
# COPY TYPE FILES
# ============================================================================

Write-Host "Step 2: Copying Type Definition Files..."

$types = @(
    "auth_types.ts",
    "contractor_types.ts",
    "escrow_types.ts", 
    "milestone_types.ts",
    "project_types.ts",
    "user_types.ts",
    "express_d.ts"
)

$typesDir = "types"
if (-not (Test-Path $typesDir)) {
    New-Item -ItemType Directory -Path $typesDir -Force | Out-Null
}

foreach ($file in $types) {
    $src = Join-Path $SourcePath $file
    $dst = Join-Path $typesDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  Copied: $file"
    } else {
        Write-Host "  WARNING: Not found: $file"
    }
}

Write-Host "Types completed."
Write-Host ""

# ============================================================================
# COPY MODULE FILES
# ============================================================================

Write-Host "Step 3: Copying Module Files..."

# Auth Module
$authFiles = @("auth_controller.ts", "auth_routes.ts")
$authDir = "modules\auth"
if (-not (Test-Path $authDir)) {
    New-Item -ItemType Directory -Path $authDir -Force | Out-Null
}
foreach ($file in $authFiles) {
    $src = Join-Path $SourcePath $file
    $dst = Join-Path $authDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  Copied Auth: $file"
    }
}

# Contractor Module
$contractorFiles = @("contractor_controller.ts", "contractor_routes.ts")
$contractorDir = "modules\contractor"
if (-not (Test-Path $contractorDir)) {
    New-Item -ItemType Directory -Path $contractorDir -Force | Out-Null
}
foreach ($file in $contractorFiles) {
    $src = Join-Path $SourcePath $file
    $dst = Join-Path $contractorDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  Copied Contractor: $file"
    }
}

# Escrow Module
$escrowFiles = @("escrow_controller.ts", "escrow_routes.ts")
$escrowDir = "modules\escrow"
if (-not (Test-Path $escrowDir)) {
    New-Item -ItemType Directory -Path $escrowDir -Force | Out-Null
}
foreach ($file in $escrowFiles) {
    $src = Join-Path $SourcePath $file
    $dst = Join-Path $escrowDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  Copied Escrow: $file"
    }
}

# Milestone Module
$milestoneFiles = @("milestone_controller.ts", "milestone_routes.ts")
$milestoneDir = "modules\milestone"
if (-not (Test-Path $milestoneDir)) {
    New-Item -ItemType Directory -Path $milestoneDir -Force | Out-Null
}
foreach ($file in $milestoneFiles) {
    $src = Join-Path $SourcePath $file
    $dst = Join-Path $milestoneDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  Copied Milestone: $file"
    }
}

# Project Module
$projectFiles = @("project_controller.ts", "project_routes.ts")
$projectDir = "modules\project"
if (-not (Test-Path $projectDir)) {
    New-Item -ItemType Directory -Path $projectDir -Force | Out-Null
}
foreach ($file in $projectFiles) {
    $src = Join-Path $SourcePath $file
    $dst = Join-Path $projectDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  Copied Project: $file"
    }
}

Write-Host "Modules completed."
Write-Host ""

# ============================================================================
# UPDATE MAIN INDEX FILE
# ============================================================================

Write-Host "Step 4: Updating Main index.ts..."

$indexSrc = Join-Path $SourcePath "index.ts"
$indexDst = "index.ts"

if (Test-Path $indexDst) {
    Copy-Item -Path $indexDst -Destination "index.ts.backup" -Force
    Write-Host "  Created backup: index.ts.backup"
}

if (Test-Path $indexSrc) {
    Copy-Item -Path $indexSrc -Destination $indexDst -Force
    Write-Host "  Copied: index.ts"
} else {
    Write-Host "  WARNING: index.ts not found in source"
}

Write-Host "Main file completed."
Write-Host ""

# ============================================================================
# SETUP ENVIRONMENT FILE
# ============================================================================

Write-Host "Step 5: Setting up Environment Files..."

$envSrc = Join-Path $SourcePath "_env"

# Copy to backend root
if (Test-Path $envSrc) {
    Copy-Item -Path $envSrc -Destination "$BackendPath\.env" -Force
    Write-Host "  Created: $BackendPath\.env"
} else {
    Write-Host "  WARNING: _env file not found"
}

# Copy to project root
if (Test-Path $envSrc) {
    Copy-Item -Path $envSrc -Destination "$BackendPath\..\..\..\.env" -Force
    Write-Host "  Created: Project root .env"
}

Write-Host "Environment setup completed."
Write-Host ""

# ============================================================================
# INSTALL DEPENDENCIES
# ============================================================================

Write-Host "Step 6: Installing npm dependencies..."
Write-Host "This may take a few minutes..."

Set-Location $BackendPath
npm install

Write-Host "npm install completed."
Write-Host ""

# ============================================================================
# VERIFICATION
# ============================================================================

Write-Host "Step 7: Verifying Installation..."

Set-Location "$BackendPath\src"

$serviceCount = @(Get-ChildItem -Path "services" -Filter "*.service.ts" -ErrorAction SilentlyContinue).Count
$typeCount = @(Get-ChildItem -Path "types" -Filter "*.ts" -ErrorAction SilentlyContinue).Count
$authCount = @(Get-ChildItem -Path "modules\auth" -Filter "*.ts" -ErrorAction SilentlyContinue).Count
$contractorCount = @(Get-ChildItem -Path "modules\contractor" -Filter "*.ts" -ErrorAction SilentlyContinue).Count
$escrowCount = @(Get-ChildItem -Path "modules\escrow" -Filter "*.ts" -ErrorAction SilentlyContinue).Count
$milestoneCount = @(Get-ChildItem -Path "modules\milestone" -Filter "*.ts" -ErrorAction SilentlyContinue).Count
$projectCount = @(Get-ChildItem -Path "modules\project" -Filter "*.ts" -ErrorAction SilentlyContinue).Count

Write-Host ""
Write-Host "Verification Results:"
Write-Host "  Services: $serviceCount/6 files"
Write-Host "  Types: $typeCount files"
Write-Host "  Auth Module: $authCount/2 files"
Write-Host "  Contractor Module: $contractorCount/2 files"
Write-Host "  Escrow Module: $escrowCount/2 files"
Write-Host "  Milestone Module: $milestoneCount/2 files"
Write-Host "  Project Module: $projectCount/2 files"

if (Test-Path "index.ts") {
    Write-Host "  index.ts: FOUND"
} else {
    Write-Host "  index.ts: MISSING"
}

Write-Host ""

# ============================================================================
# COMPLETION
# ============================================================================

Write-Host "========================================================================"
Write-Host "SETUP COMPLETED SUCCESSFULLY"
Write-Host "========================================================================"
Write-Host ""
Write-Host "Next Steps:"
Write-Host "1. Run: npm run dev"
Write-Host "2. Server will start on http://localhost:3001"
Write-Host "3. In another PowerShell, test with: Invoke-WebRequest http://localhost:3001/health"
Write-Host ""
Write-Host "Available Endpoints:"
Write-Host "  POST /api/auth/register"
Write-Host "  POST /api/auth/login"
Write-Host "  GET /api/auth/me"
Write-Host "  POST /api/projects"
Write-Host "  GET /api/projects"
Write-Host "  And 19 more endpoints..."
Write-Host ""
Write-Host "========================================================================"
