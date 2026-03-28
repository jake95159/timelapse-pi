#!/bin/bash
# Read GPIO27 to determine AUTO vs BYPASS mode.
set -euo pipefail
GPIO=27
CHIP=/dev/gpiochip0
VALUE=$(gpioget "$CHIP" "$GPIO" 2>/dev/null || echo "0")
if [ "$VALUE" = "1" ]; then
    echo "Mode: AUTO (GPIO27=HIGH)"
    systemctl start timelapse-auto.service
else
    echo "Mode: BYPASS (GPIO27=LOW)"
    systemctl start timelapse-bypass.target
fi
