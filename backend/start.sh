#!/usr/bin/env bash
set -e

# Provider configuration:
# If PROVIDER_BASE_URL is not set or points to localhost/127.0.0.1,
# reliably start the dummy provider in the background inside this container.
PROVIDER_URL="${PROVIDER_BASE_URL:-http://127.0.0.1:8001}"

if [[ "$PROVIDER_URL" == *"127.0.0.1"* ]] || [[ "$PROVIDER_URL" == *"localhost"* ]]; then
  echo "==> Detected co-located provider configuration ($PROVIDER_URL)."
  
  PROVIDER_SCRIPT=""
  if [ -f "../dummy-provider/server.py" ]; then
    PROVIDER_SCRIPT="../dummy-provider/server.py"
  elif [ -f "dummy-provider/server.py" ]; then
    PROVIDER_SCRIPT="dummy-provider/server.py"
  elif [ -f "./server.py" ]; then
    PROVIDER_SCRIPT="./server.py"
  fi

  if [ -n "$PROVIDER_SCRIPT" ]; then
    echo "==> Starting co-located dummy provider from $PROVIDER_SCRIPT on 127.0.0.1:8001..."
    DUMMY_PROVIDER_HOST="127.0.0.1" DUMMY_PROVIDER_PORT="8001" python "$PROVIDER_SCRIPT" 127.0.0.1 8001 &
    PROVIDER_PID=$!
    echo "==> Co-located provider started with PID $PROVIDER_PID"
    sleep 1
  else
    echo "==> WARNING: Could not locate dummy-provider/server.py"
  fi
else
  echo "==> Using external provider at $PROVIDER_URL"
fi

echo "==> Starting Gunicorn on port ${PORT:-8000}..."
exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}
