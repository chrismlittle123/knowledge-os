#!/bin/bash
set -e

# Required environment variables
: "${SESSION_ID:?SESSION_ID is required}"
: "${REPO_URL:?REPO_URL is required}"
: "${PLAN_MARKDOWN:?PLAN_MARKDOWN is required}"
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY is required}"

# Optional
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
DATABASE_URL="${DATABASE_URL:-}"

# Helper to send message to PostgreSQL (if configured)
send_message() {
    local type="$1"
    local message="$2"
    if [ -n "$DATABASE_URL" ]; then
        psql "$DATABASE_URL" -c "INSERT INTO messages (session_id, type, content) VALUES ('$SESSION_ID', '$type', '{\"message\": \"$message\"}')" 2>/dev/null || true
    fi
}

# Helper to update session
update_session() {
    local status="$1"
    local extra="$2"
    if [ -n "$DATABASE_URL" ]; then
        psql "$DATABASE_URL" -c "UPDATE sessions SET status = '$status'$extra WHERE id = '$SESSION_ID'" 2>/dev/null || true
    fi
}

# Decode the plan
PLAN=$(echo "$PLAN_MARKDOWN" | base64 -d)

# Extract repo name from URL
REPO_NAME=$(basename "$REPO_URL" .git)

# Configure git
git config --global user.email "fabrica@example.com"
git config --global user.name "Fabrica Agent"

# Configure git to use GitHub token for authentication
if [ -n "$GITHUB_TOKEN" ]; then
    # Set up git credential helper to use the token
    git config --global credential.helper store
    echo "https://x-access-token:${GITHUB_TOKEN}@github.com" > ~/.git-credentials

    # Also set up gh CLI authentication
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
fi

# Convert short-form repo URL to full URL if needed
if [[ "$REPO_URL" != http* && "$REPO_URL" != git@* ]]; then
    FULL_REPO_URL="https://github.com/${REPO_URL}.git"
else
    FULL_REPO_URL="$REPO_URL"
fi

# Clone the repository
send_message "progress" "Cloning repository..."
git clone "$FULL_REPO_URL" /workspace/repo
cd /workspace/repo

# Create a new branch
BRANCH_NAME="fabrica/${SESSION_ID:0:8}"
git checkout -b "$BRANCH_NAME"

# Update session with branch name
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -c "UPDATE sessions SET branch_name = '$BRANCH_NAME' WHERE id = '$SESSION_ID'" 2>/dev/null || true
fi

# Write plan to file
echo "$PLAN" > /workspace/plan.md

send_message "progress" "Starting Claude Code execution..."

# Run Claude Code with the plan
# Using --print for non-interactive mode
# Using --dangerously-skip-permissions to allow all operations
PROMPT="You are implementing a plan for a software project.

Read the plan at /workspace/plan.md and implement all the changes described.

IMPORTANT: After implementing code and tests:
1. Run the test suite (npm test, pytest, or appropriate test command for the project)
2. Fix any failing tests before committing
3. All tests MUST pass before you commit

After all tests pass, commit your changes with a descriptive message.

If you encounter any blockers that require human intervention, exit with code 2.

Work autonomously and complete all tasks in the plan."

claude --print --dangerously-skip-permissions "$PROMPT" || {
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 2 ]; then
        send_message "escalation" "Agent requires human assistance"
        update_session "escalated" ""
        exit 2
    else
        send_message "error" "Claude Code exited with code $EXIT_CODE"
        update_session "failed" ", completed_at = NOW()"
        exit 1
    fi
}

# Push the branch
send_message "progress" "Pushing changes..."
git push -u origin "$BRANCH_NAME"

# Create pull request if GitHub CLI is configured
if [ -n "$GITHUB_TOKEN" ]; then
    send_message "progress" "Creating pull request..."
    PR_URL=$(gh pr create --title "$(head -1 /workspace/plan.md | sed 's/^# //')" --body "$(cat /workspace/plan.md)" --head "$BRANCH_NAME" 2>/dev/null || echo "")

    if [ -n "$PR_URL" ]; then
        if [ -n "$DATABASE_URL" ]; then
            psql "$DATABASE_URL" -c "UPDATE sessions SET pr_url = '$PR_URL' WHERE id = '$SESSION_ID'" 2>/dev/null || true
        fi
        send_message "completion" "Pull request created: $PR_URL"
    else
        send_message "completion" "Changes pushed to branch $BRANCH_NAME (PR creation failed)"
    fi
else
    send_message "completion" "Changes pushed to branch $BRANCH_NAME"
fi

# Mark session as completed
update_session "completed" ", completed_at = NOW()"

echo "Done!"
