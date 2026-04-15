# ============================================================================
# INFRASTRUCTURE PLATFORM - AUTOMATED BACKEND IMPLEMENTATION SCRIPT
# ============================================================================
# This script automates the setup of all backend services, types, and modules
# Location: C:\Users\USER\Desktop\nested_ark\apps\backend\implement-backend.ps1
# Run: .\implement-backend.ps1
# ============================================================================

param(
    [string]$SourcePath = (Read-Host "Enter path to uploaded files (e.g., C:\Users\USER\Desktop\uploads)"),
    [string]$BackendPath = "C:\Users\USER\Desktop\nested_ark\apps\backend"
)

$ErrorActionPreference = "Continue"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-Status {
    param([string]$Message, [string]$Status = "Info")
    
    $color = switch ($Status) {
        "Success" { "Green" }
        "Error" { "Red" }
        "Warning" { "Yellow" }
        "Info" { "Cyan" }
        default { "White" }
    }
    
    $symbol = switch ($Status) {
        "Success" { "✅" }
        "Error" { "❌" }
        "Warning" { "⚠️" }
        "Info" { "ℹ️" }
        default { "•" }
    }
    
    Write-Host "$symbol $Message" -ForegroundColor $color
}

function Test-FilesExist {
    param([string]$Path, [string[]]$Files)
    
    $missing = @()
    foreach ($file in $Files) {
        $fullPath = Join-Path $Path $file
        if (-not (Test-Path $fullPath)) {
            $missing += $file
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Status "Missing files: $($missing -join ', ')" "Warning"
        return $false
    }
    return $true
}

function Copy-FilesToDirectory {
    param(
        [string]$SourceDir,
        [string]$DestDir,
        [string[]]$Files,
        [string]$FileType = "file"
    )
    
    # Ensure destination directory exists
    if (-not (Test-Path $DestDir)) {
        New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
        Write-Status "Created directory: $DestDir" "Success"
    }
    
    $successCount = 0
    foreach ($file in $Files) {
        $sourcePath = Join-Path $SourceDir $file
        
        if (Test-Path $sourcePath) {
            $destPath = Join-Path $DestDir (Split-Path $file -Leaf)
            
            # Rename .ts to .service.ts, .controller.ts, etc. if needed
            $destName = Split-Path $file -Leaf
            if ($file -match "_service\.ts$" -and $destName -notmatch "\.service\.ts$") {
                $destName = $destName -replace "\.ts$", ".service.ts"
            }
            elseif ($file -match "_controller\.ts$" -and $destName -notmatch "\.controller\.ts$") {
                $destName = $destName -replace "\.ts$", ".controller.ts"
            }
            elseif ($file -match "_routes\.ts$" -and $destName -notmatch "\.routes\.ts$") {
                $destName = $destName -replace "\.ts$", ".routes.ts"
            }
            elseif ($file -match "_types\.ts$" -and $destName -notmatch "\.types\.ts$") {
                $destName = $destName -replace "\.ts$", ".types.ts"
            }
            
            $destPath = Join-Path $DestDir $destName
            
            Copy-Item -Path $sourcePath -Destination $destPath -Force
            Write-Status "Copied $file" "Success"
            $successCount++
        } else {
            Write-Status "File not found: $file" "Warning"
        }
    }
    
    return @{ Success = $successCount; Total = $Files.Count }
}

# ============================================================================
# MAIN IMPLEMENTATION
# ============================================================================

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   INFRASTRUCTURE PLATFORM - BACKEND IMPLEMENTATION            ║" -ForegroundColor Cyan
Write-Host "║   Automated Setup Script                                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 0: Verify paths
Write-Status "Verifying paths..." "Info"

if (-not (Test-Path $SourcePath)) {
    Write-Status "Source path does not exist: $SourcePath" "Error"
    exit 1
}

if (-not (Test-Path $BackendPath)) {
    Write-Status "Backend path does not exist: $BackendPath" "Error"
    exit 1
}

Write-Status "Source: $SourcePath" "Success"
Write-Status "Backend: $BackendPath" "Success"

# Change to backend src directory
cd "$BackendPath\src"
Write-Status "Working directory: $((Get-Location).Path)" "Success"

# ============================================================================
# STEP 1: Copy Service Files
# ============================================================================

Write-Host ""
Write-Host "STEP 1: Copying Service Files" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════"

$serviceFiles = @(
    "auth_service.ts",
    "contractor_service.ts",
    "escrow_service.ts",
    "milestone_service.ts",
    "project_service.ts",
    "user_service.ts"
)

if (Test-FilesExist -Path $SourcePath -Files $serviceFiles) {
    $result = Copy-FilesToDirectory -SourceDir $SourcePath -DestDir "services" -Files $serviceFiles -FileType "service"
    Write-Status "Services: $($result.Success)/$($result.Total) files copied" "Success"
} else {
    Write-Status "Skipping services due to missing files" "Warning"
}

# ============================================================================
# STEP 2: Copy Type Definition Files
# ============================================================================

Write-Host ""
Write-Host "STEP 2: Copying Type Definition Files" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════"

$typeFiles = @(
    "auth_types.ts",
    "contractor_types.ts",
    "escrow_types.ts",
    "milestone_types.ts",
    "project_types.ts",
    "user_types.ts",
    "express_d.ts"
)

if (Test-FilesExist -Path $SourcePath -Files $typeFiles) {
    $result = Copy-FilesToDirectory -SourceDir $SourcePath -DestDir "types" -Files $typeFiles -FileType "type"
    Write-Status "Types: $($result.Success)/$($result.Total) files copied" "Success"
} else {
    Write-Status "Skipping types due to missing files" "Warning"
}

# ============================================================================
# STEP 3: Copy Module Files - Auth
# ============================================================================

Write-Host ""
Write-Host "STEP 3: Copying Module Files" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════"

Write-Host "`nAuth Module:" -ForegroundColor White
$authFiles = @("auth_controller.ts", "auth_routes.ts")
if (Test-FilesExist -Path $SourcePath -Files $authFiles) {
    Copy-FilesToDirectory -SourceDir $SourcePath -DestDir "modules\auth" -Files $authFiles | Out-Null
}

Write-Host "`nContractor Module:" -ForegroundColor White
$contractorFiles = @("contractor_controller.ts", "contractor_routes.ts")
if (Test-FilesExist -Path $SourcePath -Files $contractorFiles) {
    Copy-FilesToDirectory -SourceDir $SourcePath -DestDir "modules\contractor" -Files $contractorFiles | Out-Null
}

Write-Host "`nEscrow Module:" -ForegroundColor White
$escrowFiles = @("escrow_controller.ts", "escrow_routes.ts")
if (Test-FilesExist -Path $SourcePath -Files $escrowFiles) {
    Copy-FilesToDirectory -SourceDir $SourcePath -DestDir "modules\escrow" -Files $escrowFiles | Out-Null
}

Write-Host "`nMilestone Module:" -ForegroundColor White
$milestoneFiles = @("milestone_controller.ts", "milestone_routes.ts")
if (Test-FilesExist -Path $SourcePath -Files $milestoneFiles) {
    Copy-FilesToDirectory -SourceDir $SourcePath -DestDir "modules\milestone" -Files $milestoneFiles | Out-Null
}

Write-Host "`nProject Module:" -ForegroundColor White
$projectFiles = @("project_controller.ts", "project_routes.ts")
if (Test-FilesExist -Path $SourcePath -Files $projectFiles) {
    Copy-FilesToDirectory -SourceDir $SourcePath -DestDir "modules\project" -Files $projectFiles | Out-Null
}

Write-Status "All modules copied" "Success"

# ============================================================================
# STEP 4: Update Main index.ts File
# ============================================================================

Write-Host ""
Write-Host "STEP 4: Updating Main index.ts" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════"

if (Test-Path "$SourcePath\index.ts") {
    # Backup existing index.ts
    if (Test-Path "index.ts") {
        Copy-Item "index.ts" "index.ts.backup" -Force
        Write-Status "Created backup: index.ts.backup" "Success"
    }
    
    # Copy new index.ts
    Copy-Item "$SourcePath\index.ts" "index.ts" -Force
    Write-Status "Updated index.ts" "Success"
} else {
    Write-Status "index.ts not found in source" "Warning"
}

# ============================================================================
# STEP 5: Copy Environment File
# ============================================================================

Write-Host ""
Write-Host "STEP 5: Setting Up Environment Variables" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════"

if (Test-Path "$SourcePath\_env") {
    # Copy to backend root
    Copy-Item "$SourcePath\_env" "$BackendPath\.env" -Force
    Write-Status "Created $BackendPath\.env" "Success"
    
    # Copy to project root
    Copy-Item "$SourcePath\_env" "$BackendPath\..\..\..\.env" -Force
    Write-Status "Created project root .env" "Success"
} else {
    Write-Status "_env file not found" "Warning"
}

# ============================================================================
# STEP 6: Install Dependencies
# ============================================================================

Write-Host ""
Write-Host "STEP 6: Installing Dependencies" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════"

cd $BackendPath

Write-Status "Running npm install..." "Info"
npm install

Write-Status "Dependencies installed" "Success"

# ============================================================================
# VERIFICATION
# ============================================================================

Write-Host ""
Write-Host "STEP 7: Verification" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════"

cd "$BackendPath\src"

# Verify services
$serviceCount = (ls "services\*.service.ts" 2>/dev/null | Measure-Object).Count
Write-Status "Services found: $serviceCount/6" (if ($serviceCount -eq 6) { "Success" } else { "Warning" })

# Verify types
$typeCount = (ls "types\*.ts" 2>/dev/null | Measure-Object).Count
Write-Status "Type files found: $typeCount" (if ($typeCount -gt 0) { "Success" } else { "Warning" })

# Verify modules
$authCount = (ls "modules\auth\*.ts" 2>/dev/null | Measure-Object).Count
Write-Status "Auth module files: $authCount/2" (if ($authCount -eq 2) { "Success" } else { "Warning" })

$contractorCount = (ls "modules\contractor\*.ts" 2>/dev/null | Measure-Object).Count
Write-Status "Contractor module files: $contractorCount/2" (if ($contractorCount -eq 2) { "Success" } else { "Warning" })

$escrowCount = (ls "modules\escrow\*.ts" 2>/dev/null | Measure-Object).Count
Write-Status "Escrow module files: $escrowCount/2" (if ($escrowCount -eq 2) { "Success" } else { "Warning" })

$milestoneCount = (ls "modules\milestone\*.ts" 2>/dev/null | Measure-Object).Count
Write-Status "Milestone module files: $milestoneCount/2" (if ($milestoneCount -eq 2) { "Success" } else { "Warning" })

$projectCount = (ls "modules\project\*.ts" 2>/dev/null | Measure-Object).Count
Write-Status "Project module files: $projectCount/2" (if ($projectCount -eq 2) { "Success" } else { "Warning" })

# Verify main file
if (Test-Path "index.ts") {
    Write-Status "Main index.ts exists" "Success"
} else {
    Write-Status "Main index.ts missing" "Error"
}

# ============================================================================
# COMPLETION
# ============================================================================

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   IMPLEMENTATION COMPLETE                                     ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Navigate to backend: cd $BackendPath"
Write-Host "2. Start server: npm run dev"
Write-Host "3. Test endpoints in another PowerShell window"
Write-Host ""

Write-Host "Available Endpoints:" -ForegroundColor Yellow
Write-Host "  Auth:       POST /api/auth/register, POST /api/auth/login, GET /api/auth/me"
Write-Host "  Projects:   POST /api/projects, GET /api/projects, GET /api/projects/:id"
Write-Host "  Milestones: POST /api/milestones/:projectId, GET /api/milestones/:id"
Write-Host "  Escrow:     POST /api/escrow/deposit, GET /api/escrow/balance/:wallet"
Write-Host "  Contractors: POST /api/contractors/profile, GET /api/contractors"
Write-Host ""

Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "  Guide: COMPLETE_BACKEND_IMPLEMENTATION_GUIDE.md"
Write-Host "  Tests: Use PowerShell commands in the guide"
Write-Host ""

Write-Status "Backend setup successful!" "Success"
