#!/bin/bash
# MCP Brunella Core Status Report Script (Linux/Mac)
# Run this script to generate a status report

echo "=== MCP Brunella Core Status Report ==="
echo ""
echo "Generated: $(date)"
echo ""

# Check Node.js
echo "## System Information"
echo ""
echo "Node.js: $(node --version 2>/dev/null || echo 'Not found')"
echo "npm: $(npm --version 2>/dev/null || echo 'Not found')"
echo "TypeScript: $(npx tsc --version 2>/dev/null || echo 'Not found')"
echo "OS: $(uname -s) $(uname -r)"
echo "Architecture: $(uname -m)"
echo ""

# Check dependencies
echo "## Dependencies"
echo ""
if [ -d "node_modules" ]; then
    echo "✓ node_modules exists"
    echo "  Packages installed: $(ls node_modules | wc -l)"
else
    echo "✗ node_modules not found - run 'npm install'"
fi
echo ""

# Check build
echo "## Build Status"
echo ""
if [ -d "build" ]; then
    echo "✓ build directory exists"
    echo "  Files: $(find build -type f | wc -l)"
    echo "  Last modified: $(stat -c %y build 2>/dev/null || stat -f %Sm build 2>/dev/null)"
else
    echo "✗ build directory not found - run 'npm run build'"
fi
echo ""

# Check logs
echo "## Logs"
echo ""
if [ -d "logs" ]; then
    echo "✓ logs directory exists"
    for log in logs/*; do
        if [ -f "$log" ]; then
            size=$(du -h "$log" | cut -f1)
            echo "  - $(basename $log): $size"
        fi
    done
else
    echo "! logs directory will be created on first run"
fi
echo ""

# Check configuration
echo "## Configuration"
echo ""
[ -f "config.yaml" ] && echo "✓ config.yaml found" || echo "! config.yaml not found"
[ -f ".env" ] && echo "✓ .env found" || echo "! .env not found (using defaults)"
[ -f "package.json" ] && echo "✓ package.json found" || echo "✗ package.json not found"
[ -f "tsconfig.json" ] && echo "✓ tsconfig.json found" || echo "! tsconfig.json not found"
echo ""

# Package info
if [ -f "package.json" ]; then
    echo "## Package Information"
    echo ""
    echo "Name: $(grep -m1 '"name"' package.json | cut -d'"' -f4)"
    echo "Version: $(grep -m1 '"version"' package.json | cut -d'"' -f4)"
    echo ""
fi

# Disk space
echo "## Disk Space"
echo ""
df -h . | tail -1
echo ""

# Memory usage
echo "## Memory Usage"
echo ""
if command -v free &> /dev/null; then
    free -h
elif command -v vm_stat &> /dev/null; then
    vm_stat | head -5
fi
echo ""

# CPU info
echo "## CPU Information"
echo ""
if [ -f "/proc/cpuinfo" ]; then
    echo "Model: $(grep -m1 'model name' /proc/cpuinfo | cut -d':' -f2 | xargs)"
    echo "Cores: $(grep -c processor /proc/cpuinfo)"
elif command -v sysctl &> /dev/null; then
    echo "Model: $(sysctl -n machdep.cpu.brand_string)"
    echo "Cores: $(sysctl -n hw.ncpu)"
fi
echo ""

# Process check
echo "## Running Processes"
echo ""
if pgrep -f "mcp-brunella-core" > /dev/null; then
    echo "✓ MCP Brunella Core is running"
    ps aux | grep -i "mcp-brunella-core" | grep -v grep
else
    echo "! MCP Brunella Core is not running"
fi
echo ""

# Git status
echo "## Git Status"
echo ""
if [ -d ".git" ]; then
    echo "Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
    echo "Last commit: $(git log -1 --format='%h - %s (%cr)' 2>/dev/null || echo 'unknown')"
    echo "Status: $(git status -s | wc -l) file(s) changed"
else
    echo "! Not a git repository"
fi
echo ""

# Recommendations
echo "## Recommendations"
echo ""
[ ! -d "node_modules" ] && echo "  - Run 'npm install' to install dependencies"
[ ! -d "build" ] && echo "  - Run 'npm run build' to compile TypeScript"
[ ! -f ".env" ] && echo "  - Copy .env.example to .env and configure"
echo ""

echo "=== Report Complete ==="
echo ""
echo "To start the server: npm start"
echo "To run in dev mode: npm run dev"
echo ""
