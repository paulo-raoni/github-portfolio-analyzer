#!/bin/bash
set -e

# Carrega variáveis de ambiente locais, se existirem
if [ -f /workspaces/github-portfolio-analyzer/.devcontainer/.env ]; then
  set -a
  source /workspaces/github-portfolio-analyzer/.devcontainer/.env
  set +a
  echo 'set -a; source /workspaces/github-portfolio-analyzer/.devcontainer/.env; set +a' >> ~/.bashrc
fi

# Instala dependências do projeto
npm install

# Instala Claude Code CLI
curl -fsSL https://claude.ai/install.sh | bash || true
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"

# Autentica GitHub CLI com o token do ambiente
if [ -n "$GITHUB_TOKEN" ]; then
  echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
fi

# Configura identidade git
if [ -n "$GIT_USER_EMAIL" ]; then
  git config --global user.email "$GIT_USER_EMAIL"
fi
if [ -n "$GIT_USER_NAME" ]; then
  git config --global user.name "$GIT_USER_NAME"
fi

echo "Setup complete."
