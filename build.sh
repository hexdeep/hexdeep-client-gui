#!/bin/bash
# build.sh
# Records build/version info to a single persistent log file, then runs the
# production build. Adapted from /root/build-logger.sh.

set -euo pipefail

# --- Configurable settings ---------------------------------------------
# Always write to the same file, located next to this script (not the
# caller's current working directory), so its location is predictable
# no matter where the build is triggered from.
LOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${LOG_DIR}/build_history.log"

# How many recent commits to record per build entry.
COMMIT_COUNT=16

# Optional cap on log file size (in bytes). Set to 0 to disable trimming.
MAX_LOG_BYTES=$((5 * 1024 * 1024))  # 5 MB
# -------------------------------------------------------------------------

branch=$(git rev-parse --abbrev-ref HEAD | awk -F/ '{print $NF}')
commitid=$(git describe --tags --always --long --dirty=-dirty --abbrev=8)
build_time=$(date '+%Y-%m-%d %H:%M:%S %z')

{
  echo "===================================================================="
  echo "Build time : ${build_time}"
  echo "Branch     : ${branch}"
  echo "Commit id  : ${commitid}"
  echo "--------------------------------------------------------------------"
  git log -n "${COMMIT_COUNT}" --date=iso --pretty="[%ad] %h %an: %s"
  echo ""
} >> "${LOG_FILE}"

echo "Build info appended to ${LOG_FILE}"

# --- Optional: trim the log file if it grows past MAX_LOG_BYTES ---------
if [ "${MAX_LOG_BYTES}" -gt 0 ] && [ -f "${LOG_FILE}" ]; then
  current_size=$(wc -c < "${LOG_FILE}")
  if [ "${current_size}" -gt "${MAX_LOG_BYTES}" ]; then
    # Keep only the last half of MAX_LOG_BYTES worth of content,
    # cut cleanly at a line boundary using tail -c then drop the partial
    # first line.
    tmp_file="$(mktemp)"
    tail -c "$((MAX_LOG_BYTES / 2))" "${LOG_FILE}" | tail -n +2 > "${tmp_file}"
    mv "${tmp_file}" "${LOG_FILE}"
    echo "Log trimmed (was ${current_size} bytes, exceeded ${MAX_LOG_BYTES} byte limit)"
  fi
fi

# --- Run the actual production build ------------------------------------
pnpm run build
