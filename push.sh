#!/usr/bin/env bash
# Uploads this folder to https://github.com/azu42968-maker/avatar-flag
# Usage: bash push.sh ["commit message"]
set -euo pipefail

REPO_URL="https://github.com/azu42968-maker/avatar-flag.git"
BRANCH="main"
MSG="${1:-Add avatar-flag tool}"

cd "$(dirname "$0")"

command -v git >/dev/null || { echo "git is not installed"; exit 1; }

[ -d .git ] || git init -q
git checkout -q -B "$BRANCH"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

# If the repo already has commits, build on top of them (keeps files, e.g. a default README)
if git fetch -q origin "$BRANCH" 2>/dev/null; then
  git reset -q "origin/$BRANCH"
fi

git add index.html style.css app.js README.md push.sh
if git diff --cached --quiet; then
  echo "Nothing to commit."
else
  git commit -q -m "$MSG"
fi

git push -u origin "$BRANCH"
echo "Done: https://github.com/azu42968-maker/avatar-flag"
