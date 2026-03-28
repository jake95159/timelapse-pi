#!/bin/bash
# WiFi startup: try saved networks, fall back to AP mode.
set -euo pipefail

CONFIG="/home/pi/timelapse/tl_config.json"
TIMEOUT=15

echo "WiFi: Checking for saved networks..."

# Check if already connected
if nmcli -t -f STATE general | grep -q "connected"; then
    echo "WiFi: Already connected"
    exit 0
fi

# Try connecting to any saved WiFi network
if nmcli dev wifi connect --wait "$TIMEOUT" 2>/dev/null; then
    echo "WiFi: Connected to saved network"
    exit 0
fi

# No saved network found — start AP mode
echo "WiFi: No saved network, starting AP..."

# Read AP config from tl_config.json
SSID="TimelapsePi"
PASSWORD="timelapse"
if [ -f "$CONFIG" ]; then
    SSID_FROM_CONFIG=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('ap',{}).get('ssid','TimelapsePi'))" 2>/dev/null || echo "TimelapsePi")
    PASSWORD_FROM_CONFIG=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('ap',{}).get('password','timelapse'))" 2>/dev/null || echo "timelapse")
    SSID="${SSID_FROM_CONFIG}"
    PASSWORD="${PASSWORD_FROM_CONFIG}"
fi

# Delete existing AP connection if any
nmcli connection delete timelapse-ap 2>/dev/null || true

# Create and activate AP
nmcli connection add type wifi con-name timelapse-ap ssid "$SSID" \
    wifi.mode ap wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PASSWORD" \
    ipv4.method shared ipv4.addresses 10.42.0.1/24

nmcli connection up timelapse-ap

echo "WiFi: AP mode active (SSID: $SSID)"
