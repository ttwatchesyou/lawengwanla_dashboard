#!/usr/bin/env bash
# Explicit build/deploy. The systemd service only starts the completed artifact.
set -euo pipefail
app_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
release_root="${XDG_DATA_HOME:-$HOME/.local/share}/lawengwanla-dashboard/releases"
mkdir -p "$release_root"
exec 9>"$release_root/update.lock"
flock -n 9 || { echo 'Another dashboard update is running' >&2; exit 1; }
mode="${1:-update}"
if [[ "$mode" == --activate ]]; then
  release_dir=$(realpath -- "${2:?release directory required}")
  case "$release_dir" in "$release_root"/*) ;; *) echo 'Release must be inside the dashboard release directory' >&2; exit 1;; esac
else
  [[ "$mode" == update || "$mode" == --build-only ]] || { echo 'Usage: update-dashboard.sh [--build-only | --activate RELEASE]' >&2; exit 1; }
  release_dir=$(mktemp -d "$release_root/$(date +%Y%m%d_%H%M%S).XXXXXX")
  stage=$(mktemp -d "${TMPDIR:-/tmp}/dashboard-build.XXXXXX")
  trap 'rm -rf -- "$stage"' EXIT
  rsync -a --exclude=.git --exclude=.next --exclude=node_modules --exclude='*.tsbuildinfo' "$app_dir/" "$stage/"
  ln -s "$app_dir/node_modules" "$stage/node_modules"
  (cd -- "$stage" && npm run build)
  test -s "$stage/.next/BUILD_ID"
  mv -- "$stage/.next" "$release_dir/.next"
  if [[ "$mode" == --build-only ]]; then printf 'Built release: %s\n' "$release_dir"; exit 0; fi
fi
[[ -s "$release_dir/.next/BUILD_ID" ]] || { echo 'Release has no completed build' >&2; exit 1; }
previous=$(mktemp -d "$release_root/previous.XXXXXX")
sudo -n systemctl stop lawengwanla_dashboard.service
if [[ -d "$app_dir/.next" ]]; then mv -- "$app_dir/.next" "$previous/.next"; fi
if ! mv -- "$release_dir/.next" "$app_dir/.next"; then
  [[ ! -d "$previous/.next" ]] || mv -- "$previous/.next" "$app_dir/.next"
  sudo -n systemctl start lawengwanla_dashboard.service
  exit 1
fi
sudo -n systemctl start lawengwanla_dashboard.service
for ((attempt=0;attempt<30;attempt++)); do
  if curl -fsS --max-time 2 http://127.0.0.1:3025/RobotTuner >/dev/null; then
    printf 'Dashboard deployed. Previous build: %s\n' "$previous"
    exit 0
  fi
  sleep 1
done
# Keep the rejected build and restore the last working artifact.
sudo -n systemctl stop lawengwanla_dashboard.service
mv -- "$app_dir/.next" "$release_dir/.next"
if [[ -d "$previous/.next" ]]; then mv -- "$previous/.next" "$app_dir/.next"; fi
sudo -n systemctl start lawengwanla_dashboard.service
echo 'Dashboard health check failed; restored previous build' >&2
exit 1
