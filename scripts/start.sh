#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

# Railway sets PORT, fallback to 5000 for Coze sandbox
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-${PORT:-5000}}"


start_service() {
    cd "${COZE_WORKSPACE_PATH}"
    echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
    PORT=${DEPLOY_RUN_PORT} node dist/server.js
}

echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
start_service
