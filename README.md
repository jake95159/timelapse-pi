# Timelapse-Pi

**Weatherproof, Battery-Powered Outdoor Timelapse Camera**

A low-power timelapse camera system built on Raspberry Pi Zero 2 W with intelligent power management for weeks-long outdoor deployments.

## Project Overview

Timelapse-Pi is a dual-mode outdoor camera system designed for long-duration timelapse photography:

- **AUTO Mode**: Ultra-low-power operation with hardware timer control (weeks of battery life)
- **BYPASS Mode**: Full-power continuous operation for configuration and testing
- **Future Mobile App**: React Native app for remote configuration and monitoring

### Key Features

- 🔋 **Long Battery Life**: 20+ days on single 3S LiPo charge (1-hour capture interval)
- 🌧️ **Weatherproof**: Sealed enclosure with acrylic camera window
- 📸 **High Quality**: Raspberry Pi HQ Camera (12.3MP) with interchangeable M12 lenses
- ⚡ **Dual Power Modes**: Low-power timer-controlled vs. always-on configuration mode
- 🔧 **Field Serviceable**: Easy battery swapping, no complex onboard charging
- 📱 **Remote Management**: Future mobile app for configuration and image access

## Hardware

### Core Components

- Raspberry Pi Zero 2 W (controller)
- Raspberry Pi HQ Camera (12.3MP, Sony IMX477)
- SparkFun Nano Power Timer (TPL5110)
- 3S LiPo battery + buck converter (5V @ 2A)
- DPDT switch (AUTO/BYPASS mode selection)
- Momentary wake button
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

- **Language**: Python 3
- **Camera**: libcamera / picamera2
- **GPIO Control**: RPi.GPIO
- **Service**: systemd auto-start

### Configuration

JSON-based configuration for:
- Capture interval
- Image resolution and quality
- Storage paths
- API settings

### Future API (Phase 3)

REST API for mobile app integration:
- System status and battery monitoring
- Configuration management
- Manual capture trigger
- Image gallery access

### Future Mobile App (Phase 4)

React Native app (iOS + Android) for:
- Remote configuration
- Status monitoring
- Image gallery
- Manual capture control

## Project Status

**Current Phase**: Phase 1 - Hardware Assembly

### Completed
- ✅ Enclosure preparation and camera mounting
- ✅ Power system design and buck converter installation
- ✅ Project documentation and GitHub repository

### In Progress
- ⏳ DPDT switch and wake button wiring
- ⏳ TPL5110 timer configuration

### Coming Soon
- 🔲 Raspberry Pi OS setup
- 🔲 Timelapse capture software
- 🔲 API development
- 🔲 Mobile app development
- 🔲 Field testing

## Documentation

Comprehensive project documentation maintained in Obsidian:

- **Dashboard**: Project overview and quick links
- **Current State**: Complete hardware/software configuration
- **Build Plan**: Phased development roadmap
- **Modification Log**: Detailed change history
- **Reference**: Guides, specs, and backups

## Use Case

Primary application: Long-duration garden photography

Capturing a plant growing up a trellis over weeks/months with hourly images to create growth timelapse video.

## Power Consumption

### AUTO Mode (Timer-Controlled)
- Sleep: 35 µA (timer only)
- Active: 300 mA avg (Pi + camera during 60s capture)
- Per cycle: ~5 mAh
- Daily (24 cycles): ~120 mAh
- **Battery life**: 25+ days on 3000 mAh battery

### BYPASS Mode (Continuous)
- Idle: 120 mA avg
- Daily: ~2880 mAh
- **Battery life**: ~1 day on 3000 mAh battery

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
