FROM oven/bun:debian

# Config Bun
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

# Install OpenCode via bun (agent CLI + web UI, BYOK).
# Pre-seed bun's global package.json so opencode-ai's postinstall (binary wiring) is trusted.
ENV PATH="${HOME}/.bun/bin:${PATH}"
ENV PATH="${HOME}/.bun/bin:${PATH}"

# Bun's global bin dir is /usr/local/bin but it does not create symlinks when
# a global package.json is pre-seeded, so link pm2 manually.
RUN mkdir -p "${HOME}/.bun/install/global" \
    && printf '{"name":"bun-global","private":true,"trustedDependencies":["opencode-ai"]}\n' > "${HOME}/.bun/install/global/package.json" \
    && bun add -g opencode-ai pm2 \
    && ln -sf "${HOME}/.bun/install/global/node_modules/pm2/bin/pm2" /usr/local/bin/pm2 \
    && opencode --version \
    && pm2 --version


