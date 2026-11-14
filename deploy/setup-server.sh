#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu 22.04/24.04 server (Oracle Cloud Ampere A1 or any VPS).
# Run on the server:  bash setup-server.sh
set -euo pipefail

echo "==> Installing Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "==> Opening HTTP/HTTPS in the host firewall (Oracle images block them by default)"
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 5 -p tcp --dport "$port" -m state --state NEW -j ACCEPT
  fi
done
sudo apt-get install -y -q netfilter-persistent >/dev/null 2>&1 || true
sudo netfilter-persistent save >/dev/null 2>&1 || true

echo "==> Automatic security updates"
sudo apt-get install -y -q unattended-upgrades >/dev/null 2>&1 || true

mkdir -p ~/thyrotrack-ai
echo "Done. Log out and back in once so the docker group applies."
