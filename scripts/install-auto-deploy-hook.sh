#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$ROOT_DIR/.git/hooks"

if [ ! -d "$ROOT_DIR/.git" ]; then
  echo "❌ Not a git repo: $ROOT_DIR"
  exit 1
fi

mkdir -p "$HOOKS_DIR"

echo "📌 Installing post-commit auto deploy hook..."
cp "$ROOT_DIR/scripts/git-hooks/post-commit" "$HOOKS_DIR/post-commit"
chmod +x "$HOOKS_DIR/post-commit"

echo "✅ Enabling auto deploy..."
touch "$HOOKS_DIR/aihost-auto-deploy.enabled"

echo ""
echo "✅ Done."
echo "- Trigger: every 'git commit' on branch 'main'"
echo "- Action: auto 'git push origin main' + run './ai-host-deploy.sh --deploy-only' in background"
echo "- Log: $ROOT_DIR/.git/aihost-auto-deploy.log"
echo ""
echo "Disable with:"
echo "  rm -f \"$HOOKS_DIR/aihost-auto-deploy.enabled\""

