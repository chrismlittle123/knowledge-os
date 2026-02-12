#!/bin/bash
# Integration test for Fabrica API
# Starts the server, creates a session, and monitors progress

set -e

API_URL="${API_URL:-http://localhost:3000}"
PLAN_FILE="${1:-examples/plans/simple.md}"

echo "======================================"
echo "Fabrica Integration Test"
echo "======================================"
echo ""
echo "API URL: $API_URL"
echo "Plan: $PLAN_FILE"
echo ""

# Read the plan file
PLAN_CONTENT=$(cat "$PLAN_FILE")

# Create session via /run endpoint
echo "Creating session..."
START_TIME=$(date +%s%N)

RESPONSE=$(curl -s -X POST "$API_URL/run" \
  -H "Content-Type: text/plain" \
  -d "$PLAN_CONTENT")

SESSION_ID=$(echo "$RESPONSE" | jq -r '.sessionId')
echo "Session created: $SESSION_ID"
echo ""

# Poll for completion
echo "Monitoring session progress..."
echo ""

while true; do
  STATUS_RESPONSE=$(curl -s "$API_URL/sessions/$SESSION_ID")
  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')

  echo "Status: $STATUS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] || [ "$STATUS" = "partial" ]; then
    break
  fi

  sleep 2
done

END_TIME=$(date +%s%N)
DURATION=$(( (END_TIME - START_TIME) / 1000000 ))

echo ""
echo "======================================"
echo "Session Complete"
echo "======================================"
echo ""
echo "Session ID: $SESSION_ID"
echo "Final Status: $STATUS"
echo "Duration: ${DURATION}ms"
echo ""

# Get final session details
echo "Session Details:"
echo "$STATUS_RESPONSE" | jq '.'

echo ""

# Get messages
echo "Session Messages:"
MESSAGES=$(curl -s "$API_URL/sessions/$SESSION_ID/messages")
echo "$MESSAGES" | jq '.messages[] | "\(.createdAt) [\(.type)] \(.content.message)"' -r 2>/dev/null | tail -15

echo ""
echo "======================================"
echo "Test Complete"
echo "======================================"
