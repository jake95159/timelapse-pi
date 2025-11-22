# Timelapse-Pi

**Weatherproof, Battery-Powered Outdoor Timelapse Camera**

A low-power timelapse camera system built on Raspberry Pi Zero 2 W with intelligent power management for weeks-long outdoor deployments.

## Project Overview

Timelapse-Pi is a dual-mode outdoor camera system designed for long-duration timelapse photography:

- **AUTO Mode**: Ultra-low-power operation with hardware timer control (weeks of battery life)
- **BYPASS Mode**: Full-power continuous operation for configuration and testing
- **Web-Based UI**: Browser-accessible interface for configuration, gallery, and video rendering

### Key Features

- 🔋 **Long Battery Life**: 80+ days on single 3S LiPo charge (9700 mAh, 1-hour capture interval)
- 🌧️ **Weatherproof**: Sealed enclosure with acrylic camera window
- 📸 **High Quality**: Raspberry Pi HQ Camera (12.3MP) with 6mm wide-angle lens
- ⚡ **Dual Power Modes**: Low-power timer-controlled vs. always-on configuration mode
- 🔧 **Field Serviceable**: Easy battery swapping, no complex onboard charging
- 🌐 **Web-Based Control**: FastAPI web UI for configuration, gallery, and timelapse rendering

## Hardware

### Core Components

- Raspberry Pi Zero 2 W (controller)
- Raspberry Pi HQ Camera (12.3MP, Sony IMX477, M12 mount)
- M12 6mm wide-angle lens (Adafruit #4563)
- SparkFun Nano Power Timer (TPL5110)
- 3S LiPo battery (9700 mAh) + buck converter (5V @ 2A)
- 1000 µF smoothing capacitor
- DPDT switch (AUTO/BYPASS mode selection)
- Weatherproof enclosure with acrylic window

### Power Architecture

```
[3S LiPo 11.1V]
   ↓
[Buck Converter → 5V @ 2A]
   ↓
[DPDT AUTO/BYPASS Switch]
   ↓
 ┌────────────────────────────────┐
 │ AUTO → Timer → Pi (timed wake) │
 │ BYPASS → Pi (continuous power) │
 └────────────────────────────────┘
```

## Software

### Core Application

- **OS**: Raspberry Pi OS Lite (headless)
- **Language**: Python 3
- **Framework**: FastAPI (REST API + web UI)
- **Camera**: picamera2
- **Sun Calculations**: astral (sunrise/sunset)
- **Video Rendering**: ffmpeg (H.264 MP4)
- **Service**: systemd auto-start

### Configuration

JSON-based configuration (`tl_config.json`):
- Operating mode (AUTO/BYPASS)
- Capture intervals (hardware/software)
- Location (lat/lon) for sunrise/sunset
- Daylight-only and time window settings
- Battery capacity for runtime estimates
- Camera parameters (ISO, exposure, AWB)

### Web UI

Browser-based interface served from the Pi:
- **Dashboard**: Status, battery estimate, next capture time
- **Live Preview**: Camera view with adjustable settings
- **Timelapse Settings**: Intervals, daylight windows, location
- **Gallery**: Browse/download images, bulk ZIP export
- **Rendering**: Generate timelapse videos from image sequences
- **Network**: Wi-Fi AP/client mode switching, OTA updates

## Project Status

**Current Phase**: Phase 2 - Software Development

### Hardware Complete ✅
- ✅ Enclosure sealed and weatherproof
- ✅ Camera mount installed and aligned to window
- ✅ Power system wired (3S LiPo → Buck → Timer/Switch → Pi)
- ✅ DPDT switch for AUTO/BYPASS mode selection
- ✅ SparkFun TPL5110 timer configured
- ✅ 1000 µF smoothing capacitor installed
- ✅ All electrical connections tested

### Software Development (In Progress)
- 🔲 Raspberry Pi OS installation and configuration
- 🔲 FastAPI web application
- 🔲 AUTO mode capture script (timer-controlled)
- 🔲 BYPASS mode capture loop (software-timed)
- 🔲 Sunrise/sunset logic and time windows
- 🔲 Image gallery and timelapse rendering
- 🔲 Wi-Fi AP/client mode switching
- 🔲 OTA update mechanism

### Future
- 🔲 Field testing and deployment

## Documentation

Comprehensive project documentation maintained in Obsidian vault:

- **[SPEC.md](https://github.com/jake9results/timelapse-pi/blob/main/docs/SPEC.md)**: Complete technical specification (hardware, software, API)
- **[CHANGELOG.md](https://github.com/jake9results/timelapse-pi/blob/main/docs/CHANGELOG.md)**: Chronological modification history
- **Shared Memory**: AI session context for development continuity

See the [Obsidian vault](https://github.com/jake9results/timelapse-pi/tree/main/docs) for detailed technical documentation.

## Use Case

Primary application: Long-duration garden photography

Capturing a plant growing up a trellis over weeks/months with hourly images to create growth timelapse video.

## Power Consumption

### AUTO Mode (Timer-Controlled, 1-hour interval)
- Sleep: 35 µA (timer only)
- Active: 300 mA avg (Pi + camera during 60s capture)
- Per cycle: ~5 mAh
- Daily (24 cycles): ~120 mAh
- **Battery life**: 80+ days on 9700 mAh battery

### BYPASS Mode (Continuous)
- Idle: 120 mA avg
- Daily: ~2880 mAh
- **Battery life**: 3-4 days on 9700 mAh battery

## Contributing

This is a personal project, but design details and code are shared for others building similar systems.

## License

MIT License - See LICENSE file for details

## Author

Jake - Built with assistance from AI tools (ChatGPT for hardware design, Claude Code for software development)

## Acknowledgments

- SparkFun for excellent power timer documentation
- Raspberry Pi Foundation for comprehensive camera documentation
- Voron Design community for inspiration on project documentation structure
