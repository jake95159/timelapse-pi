#!/usr/bin/env python3
"""
Timelapse AUTO Mode Capture Script
===================================
Runs on boot in AUTO mode (TPL5110 hardware timer).
Captures one image, syncs to disk, signals DONE to timer.

GPIO17 = DONE signal to TPL5110 (10kΩ pull-down on timer board)

v3 (2026-03-28):
- Sequence counter for filenames (Pi has no RTC, clock doesn't advance between boots)
- All logging/syncing moved before DONE signal (TPL5110 cuts power instantly on DONE)
- Camera warm-up: 2s
- Post-sync delay: 1s
"""

import os
import sys
import time
from datetime import datetime

# Configuration
BASE_DIR = "/home/pi/timelapse"
IMAGES_DIR = os.path.join(BASE_DIR, "images")
AUTO_BATCH_DIR = os.path.join(IMAGES_DIR, "auto")
LOG_FILE = os.path.join(BASE_DIR, "logs", "boot_trace.log")
SEQ_FILE = os.path.join(BASE_DIR, "logs", "sequence.txt")
LOCK_FILE = "/tmp/timelapse-capture.lock"
GPIO_DONE = 17

def acquire_lock():
    """Try to create lock file. Returns True if we got it, False if another instance already ran."""
    try:
        fd = os.open(LOCK_FILE, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        return True
    except FileExistsError:
        return False

def next_sequence():
    """Read, increment, and persist a monotonic capture counter."""
    seq = 0
    try:
        with open(SEQ_FILE, "r") as f:
            seq = int(f.read().strip())
    except (FileNotFoundError, ValueError):
        pass
    seq += 1
    with open(SEQ_FILE, "w") as f:
        f.write(str(seq))
        f.flush()
        os.fsync(f.fileno())
    return seq

def log(message):
    """Append timestamped message to boot_trace.log (survives power cycles)."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{timestamp}] {message}\n"
    try:
        with open(LOG_FILE, "a") as f:
            f.write(entry)
            f.flush()
            os.fsync(f.fileno())
    except Exception as e:
        print(f"Log error: {e}", file=sys.stderr)

def ensure_auto_batch():
    """Create the auto batch directory and metadata if they don't exist."""
    os.makedirs(AUTO_BATCH_DIR, exist_ok=True)
    meta_path = os.path.join(AUTO_BATCH_DIR, "batch.json")
    if not os.path.exists(meta_path):
        import json
        meta = {
            "id": "auto",
            "name": "Auto Captures",
            "created": datetime.now().isoformat(),
        }
        with open(meta_path, "w") as f:
            json.dump(meta, f, indent=2)
            f.flush()
            os.fsync(f.fileno())

def capture_image(seq):
    """Initialize camera, warm up, capture full-res JPEG, close camera."""
    ensure_auto_batch()
    from picamera2 import Picamera2

    log(f"AUTO: Camera init (capture #{seq})")
    camera = Picamera2()

    config = camera.create_still_configuration(
        main={"size": (4056, 3040), "format": "RGB888"}
    )
    camera.configure(config)

    log("AUTO: Camera starting (2s warm-up)")
    camera.start()
    time.sleep(2)

    # Filename uses sequence number (clock-independent) + timestamp for reference
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(AUTO_BATCH_DIR, f"capture_{seq:05d}_{timestamp}.jpg")

    log(f"AUTO: Capturing → {filename}")
    camera.capture_file(filename)

    camera.stop()
    camera.close()

    return filename

def signal_done():
    """Assert GPIO17 HIGH to tell TPL5110 we're done. Power is cut immediately."""
    import lgpio

    h = lgpio.gpiochip_open(0)
    lgpio.gpio_claim_output(h, GPIO_DONE, 0)
    lgpio.gpio_write(h, GPIO_DONE, 1)
    # TPL5110 cuts power on rising edge — nothing after this line executes in AUTO mode
    time.sleep(1)
    lgpio.gpiochip_close(h)

def main():
    # Prevent duplicate captures from systemd + rc.local + cron all firing
    if not acquire_lock():
        log("AUTO: Skipped (another instance already ran this boot)")
        return

    seq = next_sequence()
    log(f"AUTO: Boot detected (#{seq}) ─────────────────")

    try:
        filename = capture_image(seq)
        log(f"AUTO: Image saved: {filename}")
    except Exception as e:
        log(f"AUTO: ERROR during capture: {e}")

    # Sync and log completion BEFORE sending DONE signal
    # (TPL5110 cuts power instantly when it sees DONE — nothing after executes)
    log("AUTO: Syncing filesystem")
    os.sync()
    time.sleep(1)
    log("AUTO: Complete ─────────────────────────")
    os.sync()

    # DONE signal — this is the last thing that runs.
    # In AUTO mode, power is cut on the rising edge.
    # In BYPASS mode, this is a no-op (timer unpowered).
    try:
        signal_done()
    except Exception as e:
        log(f"AUTO: ERROR sending DONE: {e}")

if __name__ == "__main__":
    main()
