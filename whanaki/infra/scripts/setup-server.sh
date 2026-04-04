#!/bin/bash
# One-command server setup for Whānaki app droplet (Ubuntu 22.04)
# This script automates the boring stuff: Docker, SSL, firewall, and repo clone.
#
# Usage:
#   export DOMAIN=whanaki.kaurilabs.kiwi
#   export GITHUB_REPO=https://github.com/YOUR_USERNAME/whanaki.git
#   bash <(curl -s https://raw.githubusercontent.com/YOUR_USERNAME/whanaki/main/infra/scripts/setup-server.sh)
#
# Or copy this file to your server and run it directly:
#   chmod +x setup-server.sh && ./setup-server.sh

set -euo pipefail

DOMAIN="${DOMAIN:-whanaki.kaurilabs.kiwi}"
GITHUB_REPO="${GITHUB_REPO:-}"
EMAIL="${EMAIL:-admin@$DOMAIN}"
APP_DIR="/opt/whanaki"

if [[ -z "$DOMAIN" ]]; then
    read -rp "Enter your domain (e.g. whanaki.kaurilabs.kiwi): " DOMAIN
fi

if [[ -z "$GITHUB_REPO" ]]; then
    read -rp "Enter your GitHub repo URL (e.g. https://github.com/you/whanaki.git): " GITHUB_REPO
fi

echo ""
echo "========================================"
echo "  Whānaki Server Setup"
echo "  Domain: $DOMAIN"
echo "  Repo:   $GITHUB_REPO"
echo "========================================"
echo ""

# ── 1. System basics ───────────────────────────────────────────────────────────
echo "[1/7] Updating system packages..."
apt-get update -q
apt-get install -y -q curl git ufw certbot

# ── 2. Docker ──────────────────────────────────────────────────────────────────
echo "[2/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

if ! docker compose version &> /dev/null; then
    apt-get install -y -q docker-compose-plugin
fi

echo "Docker version: $(docker --version)"
echo "Compose version: $(docker compose version)"

# ── 3. Firewall ────────────────────────────────────────────────────────────────
echo "[3/7] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── 4. SSL certificate ─────────────────────────────────────────────────────────
echo "[4/7] Obtaining SSL certificate for $DOMAIN and api.$DOMAIN..."
# Ensure nothing is on port 80
if ss -tlnp | grep -q ':80 '; then
    echo "ERROR: Something is already using port 80. Stop it before running this script."
    exit 1
fi

certbot certonly --standalone \
    -d "$DOMAIN" \
    -d "api.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

# Auto-renewal hook to reload nginx container
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<EOF
#!/bin/bash
cd $APP_DIR
if docker compose -f docker-compose.prod.yml ps | grep -q nginx; then
    docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
fi
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

systemctl enable certbot.timer
systemctl start certbot.timer

# ── 5. Clone repo ──────────────────────────────────────────────────────────────
echo "[5/7] Cloning repository..."
if [[ -d "$APP_DIR" ]]; then
    echo "Directory $APP_DIR already exists. Skipping clone."
else
    git clone "$GITHUB_REPO" "$APP_DIR"
fi

# ── 6. Verify nginx config ─────────────────────────────────────────────────────
echo "[6/7] Verifying nginx config..."
cd "$APP_DIR"
if [[ ! -f "infra/nginx/prod.conf" ]]; then
    echo "ERROR: infra/nginx/prod.conf not found. Is the repo cloned correctly?"
    exit 1
fi

# ── 7. Instructions ────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  ✅ Server setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Create your .env file:"
echo "       cd $APP_DIR"
echo "       cp .env.production.example .env"
echo "       nano .env"
echo ""
echo "  2. Start the app manually the first time:"
echo "       cd $APP_DIR"
echo "       docker compose -f docker-compose.prod.yml up -d --scale backend=2"
echo ""
echo "  3. Run the database migrations:"
echo "       docker compose -f docker-compose.prod.yml exec backend alembic upgrade head"
echo ""
echo "  4. Add these GitHub Secrets to enable auto-deploy:"
echo "       DO_PRODUCTION_IP  -> $(curl -s ifconfig.me)"
echo "       DO_SSH_USER       -> root"
echo "       DO_SSH_KEY        -> $(cat ~/.ssh/authorized_keys | head -1 | cut -d' ' -f1,2) ..."
echo ""
echo "  5. Push to main on GitHub — the app will deploy automatically."
echo ""
