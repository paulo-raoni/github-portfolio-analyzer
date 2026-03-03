FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Ferramentas básicas
RUN apt-get update && apt-get install -y --no-install-recommends \
  git \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*
