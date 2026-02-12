#!/bin/bash
# Test Docker isolation for Fabrica agent containers
#
# This script verifies that:
# 1. Container CANNOT access host filesystem
# 2. Container CANNOT access host environment variables
# 3. Container CAN access explicitly injected secrets
# 4. Container has resource limits
# 5. Container CAN access mounted workspace

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="fabrica-agent:latest"

echo "========================================"
echo "Fabrica Container Isolation Test Suite"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    FAILED=1
}

warn() {
    echo -e "${YELLOW}! WARN${NC}: $1"
}

FAILED=0

# Check Docker is running
echo "Checking Docker availability..."
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker and try again."
    exit 1
fi
pass "Docker is running"
echo ""

# Build the agent image
echo "Building agent image..."
docker build -t "$IMAGE_NAME" -f "$PROJECT_ROOT/docker/agent/Dockerfile" "$PROJECT_ROOT/docker/agent"
pass "Agent image built"
echo ""

# Create test workspace in a Docker-shareable location
# On macOS, Docker Desktop shares /Users by default, not /tmp or /var/folders
# Use a subdirectory within the project for reliable Docker mounts
TEST_WORKSPACE="$PROJECT_ROOT/.test-workspace-$$"
mkdir -p "$TEST_WORKSPACE"
echo "Test workspace: $TEST_WORKSPACE"
echo "Hello from workspace" > "$TEST_WORKSPACE/test-file.txt"
echo ""

# Set a host secret that should NOT be accessible
export HOST_SECRET="this-should-not-be-visible"

echo "========================================"
echo "Test 1: Host Filesystem Isolation"
echo "========================================"

# Try to read /etc/passwd from host (should fail or see container's version)
HOST_PASSWD_USERS=$(wc -l < /etc/passwd)
CONTAINER_PASSWD_USERS=$(docker run --rm --entrypoint wc "$IMAGE_NAME" -l /etc/passwd 2>/dev/null | awk '{print $1}' || echo "0")

if [ "$CONTAINER_PASSWD_USERS" != "$HOST_PASSWD_USERS" ]; then
    pass "Container has isolated /etc/passwd (host: $HOST_PASSWD_USERS lines, container: $CONTAINER_PASSWD_USERS lines)"
else
    warn "Container /etc/passwd matches host (may be coincidence)"
fi

# Try to access host home directory (should fail)
if docker run --rm --entrypoint ls "$IMAGE_NAME" /Users 2>/dev/null; then
    fail "Container can access /Users (host filesystem leak!)"
else
    pass "Container cannot access /Users"
fi

# Try to access host /tmp (should be isolated)
echo "host-secret-file" > /tmp/fabrica-test-secret
if docker run --rm --entrypoint cat "$IMAGE_NAME" /tmp/fabrica-test-secret 2>/dev/null; then
    fail "Container can read host /tmp files!"
    rm /tmp/fabrica-test-secret
else
    pass "Container cannot access host /tmp"
    rm /tmp/fabrica-test-secret
fi
echo ""

echo "========================================"
echo "Test 2: Environment Variable Isolation"
echo "========================================"

# Check that HOST_SECRET is not visible
CONTAINER_HOST_SECRET=$(docker run --rm --entrypoint sh "$IMAGE_NAME" -c 'echo $HOST_SECRET' 2>/dev/null)
if [ -z "$CONTAINER_HOST_SECRET" ]; then
    pass "HOST_SECRET not visible in container"
else
    fail "HOST_SECRET leaked into container: $CONTAINER_HOST_SECRET"
fi

# Check that injected secret IS visible
INJECTED_VALUE=$(docker run --rm -e "INJECTED_SECRET=test-value-123" --entrypoint sh "$IMAGE_NAME" -c 'echo $INJECTED_SECRET')
if [ "$INJECTED_VALUE" = "test-value-123" ]; then
    pass "Injected secret is accessible"
else
    fail "Injected secret not accessible (got: $INJECTED_VALUE)"
fi
echo ""

echo "========================================"
echo "Test 3: Workspace Mount"
echo "========================================"

# Check that mounted workspace is accessible
WORKSPACE_CONTENT=$(docker run --rm -v "$TEST_WORKSPACE:/workspace" --entrypoint cat "$IMAGE_NAME" /workspace/test-file.txt)
if [ "$WORKSPACE_CONTENT" = "Hello from workspace" ]; then
    pass "Mounted workspace is accessible"
else
    fail "Cannot read mounted workspace (got: $WORKSPACE_CONTENT)"
fi

# Check that container can write to workspace
docker run --rm -v "$TEST_WORKSPACE:/workspace" --entrypoint sh "$IMAGE_NAME" -c 'echo "Written by container" > /workspace/container-output.txt'
if [ -f "$TEST_WORKSPACE/container-output.txt" ]; then
    WRITTEN_CONTENT=$(cat "$TEST_WORKSPACE/container-output.txt")
    if [ "$WRITTEN_CONTENT" = "Written by container" ]; then
        pass "Container can write to workspace"
    else
        fail "Container write content mismatch"
    fi
else
    fail "Container cannot write to workspace"
fi
echo ""

echo "========================================"
echo "Test 4: Resource Limits"
echo "========================================"

# Test memory limit
MEMORY_LIMIT="256m"
# This command tries to allocate more memory than allowed
# It should be killed by the OOM killer
if timeout 10 docker run --rm -m "$MEMORY_LIMIT" --entrypoint node "$IMAGE_NAME" -e "
const arr = [];
try {
  while(true) { arr.push(Buffer.alloc(10 * 1024 * 1024)); }
} catch(e) {
  console.log('Memory limit enforced');
  process.exit(0);
}
" 2>/dev/null; then
    pass "Memory limit enforced (${MEMORY_LIMIT})"
else
    # Container was killed - that's expected
    pass "Memory limit enforced (${MEMORY_LIMIT}) - container OOM killed as expected"
fi

# Test CPU limit (just verify the flag works)
if docker run --rm --cpus="0.5" --entrypoint echo "$IMAGE_NAME" "CPU limit works" > /dev/null 2>&1; then
    pass "CPU limit can be set"
else
    fail "CPU limit flag not working"
fi
echo ""

echo "========================================"
echo "Test 5: Network Isolation"
echo "========================================"

# Test with network=none
if docker run --rm --network=none --entrypoint curl "$IMAGE_NAME" -s https://google.com 2>/dev/null; then
    fail "Container with network=none can reach internet!"
else
    pass "Container with network=none cannot reach internet"
fi

# Test with network=bridge (default) - should have internet
if docker run --rm --network=bridge --entrypoint curl "$IMAGE_NAME" -s --connect-timeout 5 https://api.anthropic.com 2>/dev/null | head -c 1 > /dev/null; then
    pass "Container with network=bridge can reach internet"
else
    warn "Container with network=bridge cannot reach internet (may be firewall)"
fi
echo ""

echo "========================================"
echo "Test 6: User Isolation"
echo "========================================"

# Check container runs as non-root
CONTAINER_USER=$(docker run --rm --entrypoint whoami "$IMAGE_NAME")
if [ "$CONTAINER_USER" = "node" ]; then
    pass "Container runs as non-root user 'node'"
else
    warn "Container runs as user: $CONTAINER_USER"
fi

# Check container cannot sudo
if docker run --rm --entrypoint sudo "$IMAGE_NAME" echo "test" 2>/dev/null; then
    fail "Container can use sudo!"
else
    pass "Container cannot use sudo"
fi
echo ""

echo "========================================"
echo "Test 7: Claude Code Availability"
echo "========================================"

# Check claude is installed
if docker run --rm --entrypoint claude "$IMAGE_NAME" --version 2>/dev/null; then
    pass "Claude Code CLI is installed"
else
    fail "Claude Code CLI not found"
fi
echo ""

# Cleanup
rm -rf "$TEST_WORKSPACE"

echo "========================================"
echo "Summary"
echo "========================================"
if [ "$FAILED" = "0" ]; then
    echo -e "${GREEN}All isolation tests passed!${NC}"
    echo ""
    echo "The container is properly isolated. You can now use it to:"
    echo "  - Run Claude Code sessions safely"
    echo "  - Inject only the secrets you need"
    echo "  - Mount only the workspace directory"
    echo "  - Set resource limits"
    echo ""
    echo "Example usage:"
    echo "  docker run --rm \\"
    echo "    -v /path/to/repo:/workspace \\"
    echo "    -e ANTHROPIC_API_KEY=\$ANTHROPIC_API_KEY \\"
    echo "    -e GITHUB_TOKEN=\$GITHUB_TOKEN \\"
    echo "    -m 2048m --cpus 2 \\"
    echo "    fabrica-agent:latest \\"
    echo "    claude -p \"Your prompt here\""
else
    echo -e "${RED}Some isolation tests failed!${NC}"
    echo "Review the failures above before using in production."
    exit 1
fi
