# Power Monitoring via ADS1115 + Pixhawk Power Brick Mini

## Summary

Add battery voltage monitoring to the timelapse Pi using an ADS1115 16-bit ADC reading the voltage sense output of a CubePilot Hex Power Brick Mini. Provides state-of-charge estimation via a 3S LiPo discharge curve lookup table and runtime estimates based on fixed power consumption constants per operating mode. No current sensing — runtime estimates use calibratable constants refined through future discharge tests.

## Hardware

- **ADC**: ADS1115 on I2C bus 1, address 0x48
- **Power module**: CubePilot Hex Power Brick Mini, inline between 3S LiPo and buck converter
- **Voltage sense**: Power module pin 4 → ADS1115 channel A0
- **Calibrated voltage multiplier**: 12.71 (measured: 22.11V actual / 1.739V sense)
- **Current sense**: Not used (pin 3 left unconnected to ADC)

## New File: `pi/services/power.py`

### Class: `PowerService`

**Constructor**: accepts config dict with calibration values. Initializes I2C and ADS1115. If hardware not present, sets a flag and all reads return None.

**`read_voltage() -> float | None`**: Reads ADS1115 channel A0 (gain=1, ±4.096V range), multiplies by `volt_multiplier`. Averages 5 samples over 250ms to reduce noise. Returns None if hardware unavailable.

**`get_soc(voltage: float) -> float`**: Maps voltage to 0-100% state of charge using a 3S LiPo lookup table with linear interpolation:

| Voltage (V) | SoC (%) |
|-------------|---------|
| 12.60       | 100     |
| 12.40       | 95      |
| 12.00       | 80      |
| 11.60       | 60      |
| 11.40       | 40      |
| 11.20       | 20      |
| 11.00       | 10      |
| 10.50       | 5       |
| 9.00        | 0       |

Values below 9.0V clamp to 0%. Values above 12.6V clamp to 100%.

**`estimate_runtime(soc: float, mode: str, config: dict) -> float | None`**: Returns estimated hours remaining.

- **BYPASS mode**: `(battery_mah * soc/100) / bypass_draw_ma`
- **AUTO mode**: Duty cycle calculation — `on_time / interval` fraction draws `auto_draw_ma`, remainder draws ~0.035mA (TPL5110 quiescent). `(battery_mah * soc/100) / avg_draw_ma`

**`get_status() -> dict`**: Returns a dict with `voltage`, `soc_pct`, and `raw_sense_voltage`. Caches the last reading for 5 seconds (no need to hit I2C on every API request).

### Graceful degradation

All methods return None when hardware is unavailable. The constructor catches I2C/OSError exceptions and logs a warning. No crashes, no retries — just null values in the API response.

## Config Changes: `pi/services/config.py`

Add `power` section to `DEFAULT_CONFIG`:

```python
"power": {
    "volt_multiplier": 12.71,
    "battery_mah": 9700,
    "bypass_draw_ma": 180,
    "auto_draw_ma": 180,
    "auto_on_time_sec": 25,
}
```

Remove the existing top-level `"battery_mah": 5000` default (moved into `power` section).

## Dependency Injection: `pi/api/dependencies.py`

Add `PowerService` to `ServiceContainer`. Instantiated with config values from the `power` section. No special constructor args beyond config.

## API Changes: `pi/api/routers/status.py`

The `/api/status` endpoint adds three fields to the response:

```json
{
    "battery_voltage": 11.84,
    "battery_soc_pct": 72.5,
    "runtime_estimate_hours": 150.0,
    ...existing fields unchanged...
}
```

- `battery_voltage`: null if ADS1115 unavailable, otherwise float
- `battery_soc_pct`: null if voltage unavailable, otherwise 0-100 float
- `runtime_estimate_hours`: calculated from SoC when available, falls back to existing capacity-based estimate when voltage unavailable

The existing hardcoded `180` mA values and top-level `battery_mah` references in the status router are replaced with values from `config["power"]`.

## Provisioning Changes: `provision.sh`

- Add `dtparam=i2c_arm=on` to boot config (fix the grep to not match commented lines)
- Add `i2c-dev` to `/etc/modules-load.d/i2c.conf`
- Install `adafruit-circuitpython-ads1x15` in the venv pip install step

## Files Changed

| File | Change |
|------|--------|
| `pi/services/power.py` | New — PowerService class |
| `pi/services/config.py` | Add `power` config defaults, remove top-level `battery_mah` |
| `pi/api/dependencies.py` | Add PowerService to ServiceContainer |
| `pi/api/routers/status.py` | Add voltage/SoC/runtime fields, use config power values |
| `pi/requirements.txt` | Add `adafruit-circuitpython-ads1x15` |
| `provision.sh` | Enable I2C, install pip dependency |

## Not In Scope

- Current sensing (shunt too noisy at low currents)
- New API endpoints (power data is part of existing `/api/status`)
- Mobile app UI changes (separate task)
- Low-battery alerts/shutdown (future enhancement)
- Charging detection (no onboard charging)
