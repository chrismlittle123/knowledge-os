# Fabrica Agent Container
# Runs Claude Code in an isolated environment

FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install Claude Code CLI and additional tools
RUN npm install -g @anthropic-ai/claude-code

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    jq \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
RUN mkdir -p /workspace && chown node:node /workspace

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /workspace
USER node

ENTRYPOINT ["/entrypoint.sh"]
