#!/usr/bin/env pwsh
# .github/hooks/continual-learning/inject-learnings.ps1
# 
# Brunella Continual Learning — Munkamenet Inject Hook (Windows/PowerShell)
# Használat: .\\.github\\hooks\\continual-learning\\inject-learnings.ps1
# A Claude/Copilot munkamenet elején futtatandó — a releváns tanulságokat injektálja.

param(
    [string]$Category = "all",         # all | mistake | convention | pattern | tool_insight
    [string]$Priority = "high",        # all | critical | high | medium | low
    [switch]$Compact,                  # Tömörített kimenet
    [switch]$Update                    # Hit count frissítése az érintett learnings-eknél
)

$repoRoot = & git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { $repoRoot = $PSScriptRoot | Split-Path | Split-Path | Split-Path }

$memoryDir = Join-Path $repoRoot ".copilot-memory"
$learningsFile = Join-Path $memoryDir "learnings.json"
$conventionsFile = Join-Path $memoryDir "conventions.md"

# ─── Conventions inject ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🧠 BRUNELLA CONTINUAL LEARNING — MUNKAMENET KONTEXTUS      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if (-not $Compact) {
    Write-Host "📋 PROJEKT KONVENCIÓK (.copilot-memory/conventions.md)" -ForegroundColor Yellow
    Write-Host "────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    if (Test-Path $conventionsFile) {
        # Csak a kritikus és high szekciókat mutatja
        $lines = Get-Content $conventionsFile
        $inSection = $false
        foreach ($line in $lines) {
            if ($line -match "^## 🔴|^## 🟠") { $inSection = $true }
            if ($line -match "^## 🟡|^## 🔵|^## 🟢|^## ⚙️|^## 🧪|^## 📦|^## 📝") { $inSection = $false }
            if ($inSection) { Write-Host $line }
        }
    }
    Write-Host ""
}

# ─── Learnings inject ────────────────────────────────────────────────────────
if (Test-Path $learningsFile) {
    $data = Get-Content $learningsFile -Raw | ConvertFrom-Json

    # Szűrés
    $filtered = $data.learnings | Where-Object {
        ($Category -eq "all" -or $_.category -eq $Category) -and
        ($Priority -eq "all" -or $_.priority -in @("critical", "high") -or $Priority -eq "low")
    } | Sort-Object { @("critical","high","medium","low").IndexOf($_.priority) }

    Write-Host "🎯 TOP TANULSÁGOK (priority: $Priority, category: $Category)" -ForegroundColor Yellow
    Write-Host "────────────────────────────────────────────────────────" -ForegroundColor DarkGray

    $priorityColors = @{
        "critical" = "Red"
        "high"     = "DarkYellow"
        "medium"   = "Blue"
        "low"      = "DarkGray"
    }

    $categoryIcons = @{
        "mistake"      = "❌"
        "convention"   = "📐"
        "pattern"      = "🔄"
        "tool_insight" = "🔧"
        "preference"   = "⭐"
    }

    foreach ($l in $filtered) {
        $color = $priorityColors[$l.priority]
        $icon = $categoryIcons[$l.category]
        Write-Host "  [$($l.id)] $icon [$($l.priority.ToUpper())] $($l.content)" -ForegroundColor $color
        Write-Host ""
    }

    # Hit count frissítés
    if ($Update) {
        $today = (Get-Date).ToString("yyyy-MM-dd")
        foreach ($l in $filtered) {
            $l.hit_count = [int]$l.hit_count + 1
            $l.last_hit = $today
        }
        $data | ConvertTo-Json -Depth 10 | Set-Content $learningsFile -Encoding UTF8
        Write-Host "✅ Hit count frissítve: $($filtered.Count) learning" -ForegroundColor Green
    }

    Write-Host "────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "📊 Összesen $($data.learnings.Count) learning | Utolsó munkamenet: $($data.session_stats.last_session)" -ForegroundColor DarkGray
    Write-Host ""
}

Write-Host "💡 Teljes konvenciók: cat .copilot-memory/conventions.md" -ForegroundColor DarkGray
Write-Host "💡 Új learning hozzáadása: scripts/continual-learning-init.mjs add" -ForegroundColor DarkGray
Write-Host ""
