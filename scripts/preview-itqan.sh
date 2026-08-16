#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo ""
echo "Itqān local preview"
echo "-------------------"
echo "The Vite server will expose port 5173."
echo "In Codespaces, open the PORTS tab and use the browser icon on port 5173."
echo ""

npm run dev -- --host 0.0.0.0
