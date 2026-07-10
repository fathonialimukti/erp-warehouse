FROM oven/bun:debian

# Config Bun
ENV PATH="~/.bun/bin:${PATH}"
RUN ln -s /usr/local/bin/bun /usr/local/bin/node

# Update packages
RUN apt-get update

# Install essential tools for dev and SSH port forwarding
RUN apt-get install -y \
    git \
    curl \
    wget \
    openssh-server \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*


# Install Copilot CLI (BYOK)
RUN bun install -g @githubnext/github-copilot-cli

