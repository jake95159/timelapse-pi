#!/bin/bash
# ============================================================
# Timelapse Pi - Sprint 2 Provisioning Script
# ============================================================
# Run from the workstation (WSL). SSHs into the Pi and sets up
# the full Sprint 2 stack: FastAPI, WiFi manager, systemd services.
#
# Usage: bash provision.sh
# ============================================================

set -euo pipefail

PI_HOST="timelapse-pi"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_DIR="$SCRIPT_DIR/pi"

echo "═══════════════════════════════════════════════════"
echo "  Timelapse Pi — Sprint 2 Provisioning"
echo "═══════════════════════════════════════════════════"

# ----------------------------------------------------------
# 1. Install system packages
# ----------------------------------------------------------
echo ""
echo "▸ [1/8] Installing system packages..."
ssh "$PI_HOST" "sudo apt-get update -qq && sudo apt-get install -y -qq \
    git ffmpeg \
    python3-pip python3-venv python3-picamera2 python3-lgpio python3-pil \
    libcamera-apps \
    network-manager avahi-daemon gpiod \
    2>&1 | tail -5"

# Ensure NetworkManager is active, disable dhcpcd
ssh "$PI_HOST" "
    sudo systemctl disable --now dhcpcd 2>/dev/null || true
    sudo systemctl enable --now NetworkManager
    sudo systemctl enable --now avahi-daemon
"
echo "  ✓ Packages installed, NetworkManager active"

# ----------------------------------------------------------
# 2. Create directory structure
# ----------------------------------------------------------
echo ""
echo "▸ [2/8] Creating directory structure..."
ssh "$PI_HOST" "mkdir -p ~/timelapse/{images/auto,videos,logs,systemd}"
echo "  ✓ Directory structure created"

# ----------------------------------------------------------
# 3. Deploy application code
# ----------------------------------------------------------
echo ""
echo "▸ [3/8] Deploying application code..."
rsync -az --delete \
    --exclude='venv/' --exclude='tests/' --exclude='__pycache__/' \
    "$PI_DIR/" "$PI_HOST:~/timelapse/"
echo "  ✓ Code deployed"

# ----------------------------------------------------------
# 4. Set up Python venv
# ----------------------------------------------------------
echo ""
echo "▸ [4/8] Setting up Python venv..."
ssh "$PI_HOST" "
    cd ~/timelapse
    python3 -m venv --system-site-packages venv 2>/dev/null || true
    venv/bin/pip install --quiet fastapi uvicorn python-multipart
"
echo "  ✓ Python venv ready"

# ----------------------------------------------------------
# 5. Deploy systemd services
# ----------------------------------------------------------
echo ""
echo "▸ [5/8] Installing systemd services..."
ssh "$PI_HOST" "
    # Remove old Sprint 1 services
    sudo systemctl disable --now timelapse-auto.service 2>/dev/null || true

    # Remove old rc.local and cron entries
    sudo rm -f /etc/rc.local
    (crontab -l 2>/dev/null | grep -v capture_auto) | crontab - 2>/dev/null || true

    # Install new services
    sudo cp ~/timelapse/systemd/timelapse-mode.service /etc/systemd/system/
    sudo cp ~/timelapse/systemd/timelapse-auto.service /etc/systemd/system/
    sudo cp ~/timelapse/systemd/timelapse-api.service /etc/systemd/system/
    sudo cp ~/timelapse/systemd/timelapse-wifi.service /etc/systemd/system/
    sudo cp ~/timelapse/systemd/timelapse-bypass.target /etc/systemd/system/

    # Make scripts executable
    chmod +x ~/timelapse/systemd/timelapse-mode.sh
    chmod +x ~/timelapse/systemd/wifi-startup.sh

    # Enable mode detection service (it starts everything else)
    sudo systemctl daemon-reload
    sudo systemctl enable timelapse-mode.service
"
echo "  ✓ Systemd services installed"

# ----------------------------------------------------------
# 6. Configure captive portal DNS
# ----------------------------------------------------------
echo ""
echo "▸ [6/8] Configuring captive portal DNS..."
ssh "$PI_HOST" "
    sudo mkdir -p /etc/NetworkManager/dnsmasq-shared.d
    sudo cp ~/timelapse/systemd/dnsmasq-captive.conf \
        /etc/NetworkManager/dnsmasq-shared.d/captive.conf
"
echo "  ✓ Captive portal DNS configured"

# ----------------------------------------------------------
# 7. Boot config (GPIO pull-downs)
# ----------------------------------------------------------
echo ""
echo "▸ [7/8] Applying boot config..."
ssh "$PI_HOST" "
    CONFIG=/boot/firmware/config.txt

    # GPIO17 pull-down (DONE signal) — Sprint 1
    grep -q 'gpio=17=pd' \$CONFIG || echo 'gpio=17=pd' | sudo tee -a \$CONFIG > /dev/null

    # GPIO27 pull-down (mode detection) — Sprint 2
    grep -q 'gpio=27=pd' \$CONFIG || echo 'gpio=27=pd' | sudo tee -a \$CONFIG > /dev/null

    # Bluetooth off, HDMI off, splash off — Sprint 1
    grep -q 'dtoverlay=disable-bt' \$CONFIG || echo 'dtoverlay=disable-bt' | sudo tee -a \$CONFIG > /dev/null
    grep -q 'hdmi_blanking=2' \$CONFIG || echo 'hdmi_blanking=2' | sudo tee -a \$CONFIG > /dev/null
    grep -q 'disable_splash=1' \$CONFIG || echo 'disable_splash=1' | sudo tee -a \$CONFIG > /dev/null

    # Set hostname for mDNS
    sudo hostnamectl set-hostname timelapse-pi
"
echo "  ✓ Boot config applied (GPIO17 pd, GPIO27 pd, hostname)"

# ----------------------------------------------------------
# 8. Verify installation
# ----------------------------------------------------------
echo ""
echo "▸ [8/8] Verifying installation..."
ssh "$PI_HOST" "
    echo '── Directory structure ──'
    ls ~/timelapse/
    echo ''
    echo '── Venv packages ──'
    ~/timelapse/venv/bin/pip list 2>/dev/null | grep -E 'fastapi|uvicorn|Pillow'
    echo ''
    echo '── Systemd services ──'
    systemctl is-enabled timelapse-mode.service 2>/dev/null || echo 'not enabled'
    echo ''
    echo '── Camera ──'
    libcamera-hello --list-cameras 2>&1 | head -3
    echo ''
    echo '── NetworkManager ──'
    nmcli general status
    echo ''
    echo '── Hostname ──'
    hostname
"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Sprint 2 provisioning complete!"
echo ""
echo "  Next steps:"
echo "  1. Wire GPIO27 mode detection (see design spec)"
echo "  2. Reboot: ssh timelapse-pi 'sudo reboot'"
echo "  3. Set BYPASS mode (DPDT switch)"
echo "  4. Test API: curl http://timelapse-pi.local:8000/api/status"
echo "═══════════════════════════════════════════════════"
