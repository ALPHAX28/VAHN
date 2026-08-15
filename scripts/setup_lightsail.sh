#!/usr/bin/env bash
# ============================================================
# VAHN AWS Lightsail One-Shot Provisioning Script
# OS: Ubuntu 24.04 LTS (x86_64 or ARM64)
# Configures Docker, 2GB Swapfile, AWS CLI, Firewall, S3 Backup Cron
# ============================================================

set -e

echo "============================================================"
echo " Starting VAHN Lightsail Server Setup"
echo "============================================================"

# 1. Update packages
echo "--> Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git ufw apt-transport-https ca-certificates gnupg lsb-release unzip

# 2. Configure 2GB Swap Memory (prevents OOM during builds)
if [ ! -f /swapfile ]; then
    echo "--> Configuring 2GB Swapfile..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✔ Swapfile created and activated."
fi

# 3. Install Docker and Docker Compose plugin
if ! command -v docker &> /dev/null; then
    echo "--> Installing Docker Engine..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Allow ubuntu user to run Docker without sudo
    sudo usermod -aG docker ubuntu
    echo "✔ Docker and Docker Compose installed."
fi

# 4. Install AWS CLI v2
if ! command -v aws &> /dev/null; then
    echo "--> Installing AWS CLI v2..."
    ARCH=$(uname -m)
    if [ "$ARCH" = "aarch64" ]; then
        curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
    else
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    fi
    unzip -q awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
    echo "✔ AWS CLI installed."
fi

# 5. Configure Firewall (UFW)
echo "--> Configuring Firewall (Ports 22, 80, 443)..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp # HTTP/3 QUIC
sudo ufw --force enable
echo "✔ Firewall configured."

# 6. Make scripts executable & install S3 Backup Cron
BACKUP_SCRIPT="/home/ubuntu/shopify-migration/nextjs-vahn/scripts/backup_db_to_s3.sh"
if [ -f "$BACKUP_SCRIPT" ]; then
    chmod +x "$BACKUP_SCRIPT"
    # Add to crontab if not already present
    (crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" ; echo "0 * * * * $BACKUP_SCRIPT >/dev/null 2>&1") | crontab -
    echo "✔ Hourly S3 Database Backup cron job installed."
fi

echo "============================================================"
echo " [SUCCESS] Lightsail Server Provisioning Complete!"
echo " Log out and log back in (or run 'newgrp docker') for Docker permissions."
echo "============================================================"
