#!/bin/bash
# Test script to validate GitHub organization scripts

echo "🧪 Testing GitHub Organization Scripts..."

# Test 1: Check if bash script exists and is executable
echo "1. Checking bash script..."
if [ -x scripts/setup_github_org.sh ]; then
    echo "   ✅ setup_github_org.sh exists and is executable"
else
    echo "   ❌ setup_github_org.sh is missing or not executable"
    exit 1
fi

# Test 2: Check if batch script exists
echo "2. Checking batch script..."
if [ -f scripts/setup_github_org.bat ]; then
    echo "   ✅ setup_github_org.bat exists"
else
    echo "   ❌ setup_github_org.bat is missing"
    exit 1
fi

# Test 3: Check if documentation exists
echo "3. Checking documentation..."
if [ -f scripts/GITHUB_ORG_README.md ]; then
    echo "   ✅ GITHUB_ORG_README.md exists"
else
    echo "   ❌ GITHUB_ORG_README.md is missing"
    exit 1
fi

# Test 4: Validate bash script syntax
echo "4. Validating bash script syntax..."
if bash -n scripts/setup_github_org.sh 2>/dev/null; then
    echo "   ✅ Bash script syntax is valid"
else
    echo "   ❌ Bash script has syntax errors"
    exit 1
fi

# Test 5: Check for required commands in bash script
echo "5. Checking script content..."
if grep -q "gh label create" scripts/setup_github_org.sh && \
   grep -E "gh api repos/.*/milestones" scripts/setup_github_org.sh && \
   grep -q "gh issue create" scripts/setup_github_org.sh; then
    echo "   ✅ Script contains all required GitHub CLI commands"
else
    echo "   ❌ Script is missing required commands"
    exit 1
fi

# Test 6: Verify labels in script
echo "6. Verifying label definitions..."
if grep -q "mcp-tool" scripts/setup_github_org.sh && \
   grep -q "core-logic" scripts/setup_github_org.sh && \
   grep -q "database" scripts/setup_github_org.sh; then
    echo "   ✅ All required labels are defined"
else
    echo "   ❌ Some labels are missing"
    exit 1
fi

# Test 7: Verify milestones in script
echo "7. Verifying milestone definitions..."
if grep -q "Fázis 3: Stabilizálás" scripts/setup_github_org.sh && \
   grep -q "Fázis 4: Adat-Raj (Data Swarm)" scripts/setup_github_org.sh; then
    echo "   ✅ All required milestones are defined"
else
    echo "   ❌ Some milestones are missing"
    exit 1
fi

# Test 8: Verify issues in script
echo "8. Verifying issue definitions..."
if grep -q "Dashboard integráció véglegesítése" scripts/setup_github_org.sh && \
   grep -q "SQLite/LanceDB séma véglegesítése" scripts/setup_github_org.sh; then
    echo "   ✅ All required issues are defined"
else
    echo "   ❌ Some issues are missing"
    exit 1
fi

echo ""
echo "✅ All tests passed! GitHub organization scripts are ready to use."
echo ""
echo "To run the script:"
echo "  Linux/macOS/Git Bash: ./scripts/setup_github_org.sh"
echo "  Windows CMD:          scripts\\setup_github_org.bat"
