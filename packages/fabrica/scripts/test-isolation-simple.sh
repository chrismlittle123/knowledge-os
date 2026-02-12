#!/bin/bash
# Simple isolation test - no credentials needed
#
# Tests:
# 1. Can container see a secret file on host? (should: NO)
# 2. Can container see a host env var? (should: NO)
# 3. Can container see an injected env var? (should: YES)
# 4. Can container reach a port on host? (depends on network mode)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}Simple Container Isolation Test${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running. Start Docker Desktop first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker is running"

# Build a minimal test image (no need for full agent image)
echo ""
echo "Building minimal test image..."
docker build -t isolation-test -f - . <<'EOF'
FROM alpine:latest
RUN apk add --no-cache curl
CMD ["sh"]
EOF
echo -e "${GREEN}✓${NC} Test image built"

echo ""
echo -e "${CYAN}--- Test 1: Host file isolation ---${NC}"

# Create a secret file on host
SECRET_FILE="/tmp/host-secret-$$"
echo "TOP_SECRET_DATA" > "$SECRET_FILE"
echo "Created host file: $SECRET_FILE"

# Try to read it from container
if docker run --rm isolation-test cat "$SECRET_FILE" 2>/dev/null; then
    echo -e "${RED}✗ FAIL: Container can read host file!${NC}"
else
    echo -e "${GREEN}✓ PASS: Container cannot read host file${NC}"
fi
rm -f "$SECRET_FILE"

echo ""
echo -e "${CYAN}--- Test 2: Host env var isolation ---${NC}"

# Set a secret env var on host
export MY_HOST_SECRET="super-secret-value-12345"
echo "Set host env var: MY_HOST_SECRET=super-secret-value-12345"

# Check if container can see it
CONTAINER_VALUE=$(docker run --rm isolation-test sh -c 'echo $MY_HOST_SECRET')
if [ -z "$CONTAINER_VALUE" ]; then
    echo -e "${GREEN}✓ PASS: Container cannot see host env var${NC}"
else
    echo -e "${RED}✗ FAIL: Container sees host env var: $CONTAINER_VALUE${NC}"
fi

echo ""
echo -e "${CYAN}--- Test 3: Injected env var ---${NC}"

# Inject a specific env var
INJECTED=$(docker run --rm -e "INJECTED_VAR=hello-from-fabrica" isolation-test sh -c 'echo $INJECTED_VAR')
if [ "$INJECTED" = "hello-from-fabrica" ]; then
    echo -e "${GREEN}✓ PASS: Container can see injected env var${NC}"
else
    echo -e "${RED}✗ FAIL: Container cannot see injected env var${NC}"
fi

echo ""
echo -e "${CYAN}--- Test 4: Network isolation ---${NC}"

# Start a simple HTTP server on host
echo "Starting HTTP server on host port 9999..."
echo "Hello from host" > /tmp/test-server-response
cd /tmp && python3 -m http.server 9999 > /dev/null 2>&1 &
SERVER_PID=$!
sleep 1

# Test with network=bridge (default) - container uses host.docker.internal
echo ""
echo "Testing network=bridge (default):"
if docker run --rm --add-host=host.docker.internal:host-gateway isolation-test \
    curl -s --connect-timeout 2 http://host.docker.internal:9999/test-server-response 2>/dev/null | grep -q "Hello from host"; then
    echo -e "${YELLOW}! Container CAN reach host port 9999 (network=bridge)${NC}"
    echo "  This is expected - bridge mode allows host access via host.docker.internal"
else
    echo -e "${GREEN}✓ Container cannot reach host port 9999 (network=bridge)${NC}"
fi

# Test with network=none - should be fully isolated
echo ""
echo "Testing network=none (full isolation):"
if docker run --rm --network=none isolation-test \
    curl -s --connect-timeout 2 http://host.docker.internal:9999/test-server-response 2>/dev/null; then
    echo -e "${RED}✗ FAIL: Container with network=none can reach host!${NC}"
else
    echo -e "${GREEN}✓ PASS: Container with network=none cannot reach anything${NC}"
fi

# Cleanup
kill $SERVER_PID 2>/dev/null || true
rm -f /tmp/test-server-response

echo ""
echo -e "${CYAN}--- Test 5: Mounted volume ---${NC}"

# Create a workspace directory (use $HOME which is shared with Docker on macOS)
WORKSPACE="$HOME/.fabrica-test-workspace-$$"
mkdir -p "$WORKSPACE"
echo "workspace-file-content" > "$WORKSPACE/myfile.txt"
echo "Created workspace: $WORKSPACE"

# Container should be able to read mounted workspace
CONTENT=$(docker run --rm -v "$WORKSPACE:/workspace" isolation-test cat /workspace/myfile.txt)
if [ "$CONTENT" = "workspace-file-content" ]; then
    echo -e "${GREEN}✓ PASS: Container can read mounted workspace${NC}"
else
    echo -e "${RED}✗ FAIL: Container cannot read mounted workspace${NC}"
fi

# Container should be able to write to mounted workspace
docker run --rm -v "$WORKSPACE:/workspace" isolation-test sh -c 'echo "written-by-container" > /workspace/output.txt'
if [ -f "$WORKSPACE/output.txt" ] && [ "$(cat $WORKSPACE/output.txt)" = "written-by-container" ]; then
    echo -e "${GREEN}✓ PASS: Container can write to mounted workspace${NC}"
else
    echo -e "${RED}✗ FAIL: Container cannot write to mounted workspace${NC}"
fi

rm -rf "$WORKSPACE"

echo ""
echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}================================${NC}"
echo ""
echo "Container isolation properties:"
echo "  • Host filesystem: ISOLATED (container has own root)"
echo "  • Host env vars:   ISOLATED (not inherited)"
echo "  • Injected vars:   ACCESSIBLE (explicitly passed)"
echo "  • Network bridge:  Can reach host via host.docker.internal"
echo "  • Network none:    FULLY ISOLATED (no network)"
echo "  • Mounted volumes: ACCESSIBLE (explicitly mounted)"
echo ""
echo "For Fabrica, use:"
echo "  • network=none    for untrusted plans"
echo "  • network=bridge  when git/npm access needed"
echo ""

# Cleanup test image
docker rmi isolation-test > /dev/null 2>&1 || true
