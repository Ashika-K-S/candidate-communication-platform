#!/usr/bin/env bash
set -eo pipefail

# -----------------------------------------------------------------------------
# TalentReach Production Startup Script
# -----------------------------------------------------------------------------
# 1. Inspects PROVIDER_BASE_URL (defaults to http://127.0.0.1:8001).
# 2. If configured for co-located mode (127.0.0.1 / localhost):
#    - Spawns dummy-provider/server.py on 127.0.0.1:8001 in the background.
#    - Actively polls http://127.0.0.1:8001/health with a bounded retry loop.
#    - Exits with an error if the provider process dies or fails health check.
# 3. Starts Gunicorn on 0.0.0.0:${PORT:-8000} with stdout/stderr logging,
#    2 workers (RAM-friendly for Render Free plan), and an extended 120s timeout.
# -----------------------------------------------------------------------------

PROVIDER_URL="${PROVIDER_BASE_URL:-http://127.0.0.1:8001}"
GUNICORN_PORT="${PORT:-8000}"

echo "=========================================================="
echo " Starting TalentReach Backend Deployment"
echo " Date: $(date -u)"
echo " Gunicorn Target Port: ${GUNICORN_PORT}"
echo " Configured Provider URL: ${PROVIDER_URL}"
echo "=========================================================="

if [[ "$PROVIDER_URL" == *"127.0.0.1"* ]] || [[ "$PROVIDER_URL" == *"localhost"* ]]; then
  echo "==> Detected co-located provider mode. Locating dummy-provider service..."

  PROVIDER_SCRIPT=""
  if [ -f "../dummy-provider/server.py" ]; then
    PROVIDER_SCRIPT="../dummy-provider/server.py"
  elif [ -f "dummy-provider/server.py" ]; then
    PROVIDER_SCRIPT="dummy-provider/server.py"
  elif [ -f "./server.py" ]; then
    PROVIDER_SCRIPT="./server.py"
  fi

  if [ -z "$PROVIDER_SCRIPT" ]; then
    echo "==> ERROR: Could not locate dummy-provider/server.py in repository." >&2
    echo "    Checked: ../dummy-provider/server.py, dummy-provider/server.py, ./server.py" >&2
    exit 1
  fi

  echo "==> Launching dummy provider from ${PROVIDER_SCRIPT} on 127.0.0.1:8001 in background..."
  DUMMY_PROVIDER_HOST="127.0.0.1" DUMMY_PROVIDER_PORT="8001" python "${PROVIDER_SCRIPT}" 127.0.0.1 8001 &
  PROVIDER_PID=$!

  echo "==> Dummy provider launched (PID: ${PROVIDER_PID}). Awaiting health check..."

  # Bounded health check loop (up to 10 attempts, 5 seconds total)
  PROVIDER_HEALTHY=0
  for attempt in $(seq 1 10); do
    if python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=1)" 2>/dev/null; then
      echo "==> Dummy provider is healthy and responding on http://127.0.0.1:8001/health (Attempt ${attempt}/10)."
      PROVIDER_HEALTHY=1
      break
    fi

    # Verify the background process is still alive
    if ! kill -0 "${PROVIDER_PID}" 2>/dev/null; then
      echo "==> ERROR: Dummy provider process (PID: ${PROVIDER_PID}) terminated unexpectedly on boot." >&2
      exit 1
    fi

    echo "    Waiting for dummy provider to accept connections (${attempt}/10)..."
    sleep 0.5
  done

  if [ "${PROVIDER_HEALTHY}" -ne 1 ]; then
    echo "==> ERROR: Dummy provider failed to respond to health checks within timeout window." >&2
    kill -9 "${PROVIDER_PID}" 2>/dev/null || true
    exit 1
  fi

else
  echo "==> Using external communication provider at ${PROVIDER_URL}."
fi

# -----------------------------------------------------------------------------
# Execute Gunicorn (Replaces shell process to handle OS signals cleanly)
# -----------------------------------------------------------------------------
echo "==> Launching Gunicorn WSGI application on 0.0.0.0:${GUNICORN_PORT}..."
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${GUNICORN_PORT}" \
  --workers 2 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile - \
  --log-level info
