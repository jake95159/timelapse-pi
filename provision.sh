#!/bin/bash
# ============================================================
# Timelapse Pi - Full Provisioning Script
# ============================================================
# Run from the workstation (WSL). SSHs into the Pi and sets up
# everything needed for Sprint 1: capture script, services,
# boot optimizations, and directory structure.
#
# Usage: bash provision.sh
# ============================================================

set -euo pipefail

PI_HOST="timelapse-pi"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "═══════════════════════════════════════════════════"
echo "  Timelapse Pi — Provisioning"
echo "═══════════════════════════════════════════════════"

# ----------------------------------------------------------
# 1. Install system packages
# ----------------------------------------------------------
echo ""
echo "▸ [1/6] Installing system packages..."
ssh "$PI_HOST" "sudo apt-get update -qq && sudo apt-get install -y -qq \
    git \
    ffmpeg \
    python3-pip \
    python3-picamera2 \
    python3-lgpio \
    libcamera-apps \
    2>&1 | tail -5"
echo "  ✓ Packages installed"

# ----------------------------------------------------------
# 2. Create directory structure
# ----------------------------------------------------------
echo ""
echo "▸ [2/6] Creating directory structure..."
ssh "$PI_HOST" "mkdir -p ~/timelapse/{images,videos,logs}"
echo "  ✓ ~/timelapse/{images,videos,logs} created"

# ----------------------------------------------------------
# 3. Deploy capture script
# ----------------------------------------------------------
echo ""
echo "▸ [3/6] Deploying capture_auto.py..."
scp -q "$SCRIPT_DIR/capture_auto.py" "$PI_HOST:~/timelapse/capture_auto.py"
ssh "$PI_HOST" "chmod +x ~/timelapse/capture_auto.py"
echo "  ✓ capture_auto.py deployed"

# ----------------------------------------------------------
# 4. Set up systemd service + rc.local + cron fallback
# ----------------------------------------------------------
echo ""
echo "▸ [4/6] Configuring boot services..."

# Systemd service (primary - runs early in boot)
ssh "$PI_HOST" "sudo tee /etc/systemd/system/timelapse-auto.service > /dev/null << 'UNIT'
[Unit]
Description=Timelapse Auto Capture Service
DefaultDependencies=no
After=local-fs.target
Before=sysinit.target

[Service]
Type=oneshot
User=pi
WorkingDirectory=/home/pi/timelapse
ExecStart=/usr/bin/python3 /home/pi/timelapse/capture_auto.py
StandardOutput=append:/home/pi/timelapse/logs/capture.log
StandardError=append:/home/pi/timelapse/logs/capture.log
RemainAfterExit=no
TimeoutStartSec=45

[Install]
WantedBy=sysinit.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable timelapse-auto.service"
echo "  ✓ timelapse-auto.service installed and enabled"

# rc.local fallback
ssh "$PI_HOST" "sudo tee /etc/rc.local > /dev/null << 'RCLOCAL'
#!/bin/bash
/usr/bin/python3 /home/pi/timelapse/capture_auto.py >> /home/pi/timelapse/logs/capture.log 2>&1
exit 0
RCLOCAL
sudo chmod +x /etc/rc.local"
echo "  ✓ /etc/rc.local fallback configured"

# Cron @reboot fallback (new - additional redundancy)
ssh "$PI_HOST" "(crontab -l 2>/dev/null | grep -v capture_auto; echo '@reboot sleep 5 && /usr/bin/python3 /home/pi/timelapse/capture_auto.py >> /home/pi/timelapse/logs/capture.log 2>&1') | crontab -"
echo "  ✓ cron @reboot fallback configured"

# ----------------------------------------------------------
# 5. Apply boot optimizations
# ----------------------------------------------------------
echo ""
echo "▸ [5/6] Applying boot optimizations..."

# Check which settings already exist and add missing ones
ssh "$PI_HOST" "
CONFIG=/boot/firmware/config.txt

# Bluetooth off (saves ~150mA)
grep -q 'dtoverlay=disable-bt' \$CONFIG || echo 'dtoverlay=disable-bt' | sudo tee -a \$CONFIG > /dev/null

# HDMI off (saves ~50-100mA)
grep -q 'hdmi_blanking=2' \$CONFIG || echo 'hdmi_blanking=2' | sudo tee -a \$CONFIG > /dev/null

# No boot splash
grep -q 'disable_splash=1' \$CONFIG || echo 'disable_splash=1' | sudo tee -a \$CONFIG > /dev/null

# GPIO17 pull-down at boot (prevents spurious DONE signal)
grep -q 'gpio=17=pd' \$CONFIG || echo 'gpio=17=pd' | sudo tee -a \$CONFIG > /dev/null

echo 'Boot config updated'
"
echo "  ✓ Boot optimizations applied (BT off, HDMI off, GPIO17 pull-down)"

# ----------------------------------------------------------
# 6. Verify installation
# ----------------------------------------------------------
echo ""
echo "▸ [6/6] Verifying installation..."

ssh "$PI_HOST" "
echo '── Directory structure ──'
ls -la ~/timelapse/
echo ''
echo '── Capture script ──'
ls -la ~/timelapse/capture_auto.py
echo ''
echo '── Systemd service ──'
sudo systemctl is-enabled timelapse-auto.service
echo ''
echo '── rc.local ──'
head -3 /etc/rc.local
echo ''
echo '── Cron jobs ──'
crontab -l 2>/dev/null | grep capture_auto || echo 'none'
echo ''
echo '── Camera detection ──'
libcamera-hello --list-cameras 2>&1 | head -5
echo ''
echo '── Key packages ──'
dpkg -l | grep -E 'picamera2|libcamera-apps' | awk '{print \$2, \$3}'
echo ''
echo '── Boot config additions ──'
grep -E 'disable-bt|hdmi_blanking|disable_splash|gpio=17' /boot/firmware/config.txt
"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Provisioning complete!"
echo ""
echo "  Next steps:"
echo "  1. Reboot Pi to apply boot config: ssh timelapse-pi 'sudo reboot'"
echo "  2. Test manual capture: ssh timelapse-pi 'python3 ~/timelapse/capture_auto.py'"
echo "  3. Reconnect DONE wire to GPIO17"
echo "  4. Run 10-cycle AUTO mode test"
echo "═══════════════════════════════════════════════════"
