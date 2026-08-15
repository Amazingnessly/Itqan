#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
BASE="$(cd "$(dirname "$0")/.." && pwd)"

copy_file() {
  mkdir -p "$(dirname "$ROOT/$2")"
  cp "$BASE/$1" "$ROOT/$2"
}

copy_file "src/learning/progressInsights.ts" "src/learning/progressInsights.ts"
copy_file "src/learning/reviewPlan.ts" "src/learning/reviewPlan.ts"
copy_file "src/learning/index.ts" "src/learning/index.ts"
copy_file "src/pages/Home/HomePage.tsx" "src/pages/Home/HomePage.tsx"
copy_file "src/pages/Path/PathPage.tsx" "src/pages/Path/PathPage.tsx"
copy_file "src/pages/Review/ReviewPage.tsx" "src/pages/Review/ReviewPage.tsx"
copy_file "src/pages/Profile/ProfilePage.tsx" "src/pages/Profile/ProfilePage.tsx"
copy_file "src/app/App.tsx" "src/app/App.tsx"
copy_file "scripts/validate-batch05-no-arabic.mjs" "scripts/validate-batch05-no-arabic.mjs"
copy_file "scripts/validate-batch05-connections.mjs" "scripts/validate-batch05-connections.mjs"
copy_file "docs/BATCH05_PROGRESS_REVIEW.md" "docs/BATCH05_PROGRESS_REVIEW.md"
copy_file "README-BATCH05.md" "README-BATCH05.md"

MARKER="/* ===== Itqān Batch 05 — adaptive review & mastery feedback ===== */"
if ! grep -Fq "$MARKER" "$ROOT/src/styles/global.css"; then
  cat "$BASE/styles_append.txt" >> "$ROOT/src/styles/global.css"
fi

echo "OK: Batch 05 files installed."
