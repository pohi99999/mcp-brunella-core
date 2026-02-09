# FILE: scripts/nightly_train.ps1
# PURPOSE: G4.3 — Nightly batch training job for Brunella fine-tuning
# Run via Windows Task Scheduler or manually: pwsh scripts/nightly_train.ps1
# Follows Gold Protocol RULE-GD4: min 5 new samples required for training

param(
    [int]$MinSamples = 5,
    [string]$PythonUrl = "http://localhost:8000",
    [string]$OllamaUrl = "http://localhost:11434",
    [string]$ModelName = "brunella-v1",
    [string]$BaseModel = "llama3.1:8b",
    [switch]$Force,
    [switch]$DryRun
)

# ============================================================================
# CONFIGURATION
# ============================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $ProjectRoot -or -not (Test-Path $ProjectRoot)) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
}
$TrainingLogDir = Join-Path $ProjectRoot "data" "training"
$TrainingLog = Join-Path $TrainingLogDir "training_log.jsonl"
$ModelfilePath = Join-Path $ProjectRoot "scripts" "Modelfile.nightly"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

# Ensure log directory exists
if (-not (Test-Path $TrainingLogDir)) {
    New-Item -ItemType Directory -Path $TrainingLogDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $entry = "[$Timestamp][$Level] $Message"
    Write-Host $entry
}

function Write-TrainingLog {
    param([hashtable]$Entry)
    $Entry["timestamp"] = (Get-Date -Format "o")
    $json = $Entry | ConvertTo-Json -Compress
    Add-Content -Path $TrainingLog -Value $json -Encoding UTF8
}

# ============================================================================
# STEP 1: Check data availability
# ============================================================================

Write-Log "=== Brunella Nightly Training ==="
Write-Log "Checking golden dataset stats..."

try {
    $statsResponse = Invoke-RestMethod -Uri "$PythonUrl/incubator/stats" -Method GET -TimeoutSec 10
    $totalSamples = $statsResponse.total_samples
    $newSamples = if ($statsResponse.PSObject.Properties.Name -contains 'new_since_last_train') {
        $statsResponse.new_since_last_train
    } else {
        $totalSamples
    }
    Write-Log "Total samples: $totalSamples, New since last train: $newSamples"
} catch {
    Write-Log "Python backend not reachable at $PythonUrl — aborting" "ERROR"
    Write-TrainingLog @{ event = "abort"; reason = "python_unreachable" }
    exit 1
}

if ($newSamples -lt $MinSamples -and -not $Force) {
    Write-Log "Not enough new samples ($newSamples < $MinSamples). Skipping training."
    Write-TrainingLog @{ event = "skip"; reason = "insufficient_data"; new_samples = $newSamples }
    exit 0
}

# ============================================================================
# STEP 2: GPU availability check
# ============================================================================

Write-Log "Checking GPU availability..."
$gpuAvailable = $false

try {
    $nvidiaSmi = & nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>$null
    if ($LASTEXITCODE -eq 0 -and $nvidiaSmi) {
        $freeMemMB = [int]($nvidiaSmi.Trim().Split("`n")[0])
        if ($freeMemMB -gt 2048) {
            $gpuAvailable = $true
            Write-Log "GPU available with ${freeMemMB}MB free memory"
        } else {
            Write-Log "GPU memory too low: ${freeMemMB}MB (need > 2048MB)" "WARN"
        }
    }
} catch {
    Write-Log "nvidia-smi not found or failed — CPU training only" "WARN"
}

# ============================================================================
# STEP 3: Run training
# ============================================================================

if ($DryRun) {
    Write-Log "[DRY RUN] Would run training with $newSamples samples (GPU: $gpuAvailable)"
    Write-TrainingLog @{ event = "dry_run"; new_samples = $newSamples; gpu = $gpuAvailable }
    exit 0
}

Write-Log "Starting training..."
$trainStart = Get-Date

try {
    $trainArgs = @("$ProjectRoot/myai/incubator/train.py", "--auto")
    if ($gpuAvailable) { $trainArgs += "--gpu" }

    $trainResult = & python @trainArgs 2>&1
    $trainExitCode = $LASTEXITCODE
    $trainDuration = ((Get-Date) - $trainStart).TotalSeconds

    if ($trainExitCode -eq 0) {
        Write-Log "Training completed successfully in ${trainDuration}s"
    } else {
        Write-Log "Training failed (exit code: $trainExitCode)" "ERROR"
        Write-Log "Output: $trainResult" "ERROR"
        Write-TrainingLog @{
            event = "train_fail"
            exit_code = $trainExitCode
            duration_s = [math]::Round($trainDuration, 1)
            output = "$trainResult"
        }
        exit 1
    }
} catch {
    Write-Log "Training exception: $_" "ERROR"
    Write-TrainingLog @{ event = "train_exception"; error = "$_" }
    exit 1
}

# ============================================================================
# STEP 4: Create Ollama model (if Modelfile exists)
# ============================================================================

if (Test-Path $ModelfilePath) {
    Write-Log "Creating Ollama model '$ModelName' from Modelfile..."
    try {
        & ollama create $ModelName -f $ModelfilePath 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Ollama model '$ModelName' created successfully"
        } else {
            Write-Log "Ollama model creation failed" "WARN"
        }
    } catch {
        Write-Log "Ollama model creation error: $_" "WARN"
    }
} else {
    Write-Log "No Modelfile found at $ModelfilePath — skipping model creation" "WARN"
}

# ============================================================================
# STEP 5: Log results
# ============================================================================

Write-TrainingLog @{
    event = "train_success"
    new_samples = $newSamples
    total_samples = $totalSamples
    gpu = $gpuAvailable
    duration_s = [math]::Round($trainDuration, 1)
    model_name = $ModelName
}

Write-Log "=== Nightly training complete ==="
