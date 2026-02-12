#!/bin/bash
# Test Fabrica with Docker runtime
#
# This script:
# 1. Starts the Fabrica API with Docker runtime config
# 2. Submits a test plan
# 3. Checks execution in Docker container

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}Fabrica Docker Runtime Test${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running. Start Docker Desktop first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker is running"

# Check agent image
if ! docker image inspect fabrica-agent:latest > /dev/null 2>&1; then
    echo -e "${YELLOW}Building fabrica-agent image...${NC}"
    docker build -t fabrica-agent:latest -f "$PROJECT_ROOT/docker/agent/Dockerfile" "$PROJECT_ROOT/docker/agent"
fi
echo -e "${GREEN}✓${NC} Agent image ready"

# Check if API is already running on port 3000
if lsof -i :3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}Port 3000 already in use. Using existing API server.${NC}"
    API_RUNNING=true
else
    API_RUNNING=false
fi

# If API not running, start it with Docker config
if [ "$API_RUNNING" = false ]; then
    echo ""
    echo "Starting Fabrica API with Docker runtime..."

    # Export config path
    export FABRICA_CONFIG="$PROJECT_ROOT/fabrica.docker.json"

    # Start the API in background
    cd "$PROJECT_ROOT/packages/control-plane"
    node dist/server.js &
    API_PID=$!

    # Wait for API to start
    echo "Waiting for API to start..."
    sleep 3

    # Check if API is running
    if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${RED}Failed to start API${NC}"
        kill $API_PID 2>/dev/null || true
        exit 1
    fi
    echo -e "${GREEN}✓${NC} API started (PID: $API_PID)"
fi

echo ""
echo "Checking runtime configuration..."
curl -s http://localhost:3000/runtime | jq '.'

echo ""
echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}Submitting Test Plan${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

# Create a simple test plan
TEST_PLAN='---
repo: test/test-repo
---

# Test Plan

## Task 1: Create a file
> Role: builder
> Depends on: none

Create a file called hello.txt with the content "Hello from Fabrica Docker!"

### Acceptance Criteria
- [ ] File hello.txt exists
- [ ] Contains the greeting message
'

# Submit the plan via /run endpoint
echo "Submitting plan..."
RESPONSE=$(curl -s -X POST http://localhost:3000/run \
    -H "Content-Type: text/plain" \
    -d "$TEST_PLAN")

echo "Response:"
echo "$RESPONSE" | jq '.'

SESSION_ID=$(echo "$RESPONSE" | jq -r '.sessionId')

if [ "$SESSION_ID" = "null" ] || [ -z "$SESSION_ID" ]; then
    echo -e "${RED}Failed to create session${NC}"
    [ "$API_RUNNING" = false ] && kill $API_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "Session ID: $SESSION_ID"
echo ""

# Wait and check status
echo "Waiting for execution (checking every 5 seconds)..."
for i in {1..24}; do  # Max 2 minutes
    sleep 5
    STATUS=$(curl -s "http://localhost:3000/sessions/$SESSION_ID" | jq -r '.status')
    echo "  Status: $STATUS"

    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
        break
    fi
done

echo ""
echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}Session Result${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

# Get final status
curl -s "http://localhost:3000/sessions/$SESSION_ID" | jq '.'

echo ""
echo "Messages:"
curl -s "http://localhost:3000/sessions/$SESSION_ID/messages" | jq '.messages'

# Cleanup
if [ "$API_RUNNING" = false ]; then
    echo ""
    echo "Stopping API server..."
    kill $API_PID 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}Test complete!${NC}"
