#!/bin/bash
# SafeExtension Project Verification Script
# Run this to verify all project files are in place

echo "🔍 SafeExtension Project Verification"
echo "===================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
PASSED=0
FAILED=0

# Check function
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $1"
        ((FAILED++))
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $1/"
        ((FAILED++))
    fi
}

# Backend files
echo "📁 Backend Files:"
check_file "backend/package.json"
check_file "backend/.env.example"
check_file "backend/.gitignore"
check_file "backend/Dockerfile"
check_dir "backend/src"
check_file "backend/src/index.js"
check_file "backend/src/cache.js"
check_file "backend/src/logger.js"
check_file "backend/src/scoring.js"
check_file "backend/src/scoring.test.js"
check_file "backend/src/api.test.js"
check_dir "backend/src/services"
check_file "backend/src/services/safebrowsing.js"
check_file "backend/src/services/whois.js"

echo ""
echo "🎨 Extension Files:"
check_dir "extension"
check_file "extension/manifest.json"
check_file "extension/popup.html"
check_file "extension/popup.js"
check_file "extension/popup.css"
check_file "extension/background.js"
check_file "extension/content.js"
check_dir "extension/icons"
check_file "extension/icons/icon-16.png"
check_file "extension/icons/icon-48.png"
check_file "extension/icons/icon-128.png"

echo ""
echo "📚 Documentation:"
check_file "README.md"
check_file "QUICK_START.md"
check_file "API_SPECIFICATION.md"
check_file "PROJECT_STRUCTURE.md"
check_file "COMPLETION_CHECKLIST.md"

echo ""
echo "⚙️  Configuration:"
check_file ".env.example"
check_file ".gitignore"
check_file "docker-compose.yml"

echo ""
echo "===================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All files verified!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Read QUICK_START.md for 5-minute setup"
    echo "2. Get API keys from:"
    echo "   - https://console.cloud.google.com/ (Safe Browsing)"
    echo "   - https://api-ninjas.com/api/whois (WHOIS)"
    echo "3. Create .env file: cp backend/.env.example backend/.env"
    echo "4. Install dependencies: cd backend && npm install"
    echo "5. Start server: npm run dev"
    echo "6. Load extension in chrome://extensions/"
    exit 0
else
    echo -e "${RED}❌ Some files are missing!${NC}"
    exit 1
fi
