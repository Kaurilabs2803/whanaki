#!/bin/bash
# Cloud-init for Whānaki Ollama droplet (Ubuntu 22.04)
# Runs automatically on first boot. Check progress: journalctl -u cloud-final

set -e

log() { echo "[whanaki-init] $*"; }

log "Starting Whānaki Ollama setup..."

# ── System update ──────────────────────────────────────────────────────────────
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q curl wget ufw htop

# ── NVIDIA drivers (GPU droplets only — skip on CPU droplets) ──────────────────
if lspci | grep -qi nvidia; then
  log "NVIDIA GPU detected — installing drivers..."
  distribution=$(. /etc/os-release; echo $ID$VERSION_ID | sed -e 's/\.//g')
  wget -q https://developer.download.nvidia.com/compute/cuda/repos/${distribution}/x86_64/cuda-keyring_1.0-1_all.deb
  dpkg -i cuda-keyring_1.0-1_all.deb
  apt-get update -q
  apt-get -y -q install cuda-drivers nvidia-container-toolkit
  log "NVIDIA drivers installed."
else
  log "No GPU detected — CPU-only mode."
fi

# ── Install Ollama ─────────────────────────────────────────────────────────────
log "Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

# Configure Ollama to listen on all interfaces (VPC internal only via firewall)
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/environment.conf <<EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=*"
Environment="OLLAMA_KEEP_ALIVE=10m"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
EOF

systemctl daemon-reload
systemctl enable ollama
systemctl restart ollama

# Wait for Ollama to be ready
log "Waiting for Ollama to start..."
sleep 5
for i in $(seq 1 12); do
  if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    log "Ollama is ready."
    break
  fi
  log "Attempt $i/12 — waiting..."
  sleep 5
done

# ── Pull default models ────────────────────────────────────────────────────────
log "Pulling embedding model (nomic-embed-text)..."
ollama pull nomic-embed-text

log "Pulling fast model (llama3.2:3b)..."
ollama pull llama3.2:3b

log "Pulling balanced model (llama3.1:8b)..."
ollama pull llama3.1:8b

# Note: qwen2.5:14b is large (9GB) — pull manually after verifying disk space
# ollama pull qwen2.5:14b

# ── Firewall ───────────────────────────────────────────────────────────────────
log "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh

# Allow Ollama only from the VPC subnet
ufw allow from 10.10.0.0/16 to any port 11434

ufw --force enable

# ── DigitalOcean monitoring agent ──────────────────────────────────────────────
curl -sSL https://repos.insights.digitalocean.com/install.sh | bash

log "Ollama droplet setup complete."
log "Models available:"
ollama list
