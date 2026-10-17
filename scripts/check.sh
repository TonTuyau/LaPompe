#!/usr/bin/env bash
# Lints, type-checks, tests and builds LaPompe. Exit code != 0 on the first failure.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

# Node installed in the home folder (see README), if not already on PATH.
export PATH="$HOME/.local/node/bin:$PATH"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

step "install"
pnpm install --frozen-lockfile

step "lint"
pnpm run lint

step "typecheck"
pnpm run check

step "tests"
pnpm run test

step "build (Chrome and Firefox)"
pnpm run build

printf '\n\033[1;32mAll checks passed.\033[0m\n'
