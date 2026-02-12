#!/bin/bash
# Run a Fabrica agent locally with Docker
# Usage: ./scripts/run-agent.sh <role> <plan-file> [session-id]

set -e

ROLE=${1:-builder}
PLAN_FILE=${2}
SESSION_ID=${3:-$(date +%s)}

if [ -z "$PLAN_FILE" ]; then
    echo "Usage: ./scripts/run-agent.sh <role> <plan-file> [session-id]"
    echo ""
    echo "Roles: builder, reviewer, tester, debugger, deployer, architect"
    echo ""
    echo "Example:"
    echo "  ./scripts/run-agent.sh builder ./plans/feature.md"
    exit 1
fi

if [ ! -f "$PLAN_FILE" ]; then
    echo "Error: Plan file not found: $PLAN_FILE"
    exit 1
fi

# Check required environment variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY environment variable is required"
    exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN environment variable is required"
    exit 1
fi

echo "Running $ROLE agent with session: $SESSION_ID"
echo "Plan: $PLAN_FILE"
echo ""

# Export session ID for docker-compose
export SESSION_ID=$SESSION_ID

# Build the agent image
echo "Building agent image..."
docker compose build ${ROLE}-agent

# Run the agent with the plan file
echo "Starting $ROLE agent..."
docker compose run --rm \
    -v "$(pwd)/$PLAN_FILE:/app/plan.md:ro" \
    ${ROLE}-agent \
    /app/plan.md

echo ""
echo "Agent completed."
