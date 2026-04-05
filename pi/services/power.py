import time
import logging

logger = logging.getLogger(__name__)

_SOC_TABLE = [
    (12.60, 100.0),
    (12.40, 95.0),
    (12.00, 80.0),
    (11.60, 60.0),
    (11.40, 40.0),
    (11.20, 20.0),
    (11.00, 10.0),
    (10.50, 5.0),
    (9.00, 0.0),
]


class PowerService:
    def __init__(self, volt_multiplier: float = 12.71, hw_enabled: bool = True):
        self._multiplier = volt_multiplier
        self._ads = None
        self._voltage_channel = None
        self._cache = None
        self._cache_time = 0.0
        self._cache_ttl = 5.0

        if hw_enabled:
            try:
                import board
                import busio
                import adafruit_ads1x15.ads1115 as ADS
                from adafruit_ads1x15.analog_in import AnalogIn

                i2c = busio.I2C(board.SCL, board.SDA)
                self._ads = ADS.ADS1115(i2c)
                self._ads.gain = 1
                self._voltage_channel = AnalogIn(self._ads, 0)
                logger.info("PowerService: ADS1115 initialized")
            except Exception as e:
                logger.warning(f"PowerService: ADS1115 unavailable ({e})")

    def read_voltage(self) -> float | None:
        if self._voltage_channel is None:
            return None

        now = time.monotonic()
        if self._cache is not None and (now - self._cache_time) < self._cache_ttl:
            return self._cache

        try:
            samples = []
            for _ in range(5):
                samples.append(self._voltage_channel.voltage)
                time.sleep(0.05)
            sense_v = sum(samples) / len(samples)
            voltage = sense_v * self._multiplier
            self._cache = voltage
            self._cache_time = now
            return voltage
        except Exception as e:
            logger.warning(f"PowerService: read error ({e})")
            return self._cache

    def get_soc(self, voltage: float) -> float:
        if voltage >= _SOC_TABLE[0][0]:
            return _SOC_TABLE[0][1]
        if voltage <= _SOC_TABLE[-1][0]:
            return _SOC_TABLE[-1][1]

        for i in range(len(_SOC_TABLE) - 1):
            v_high, soc_high = _SOC_TABLE[i]
            v_low, soc_low = _SOC_TABLE[i + 1]
            if v_low <= voltage <= v_high:
                ratio = (voltage - v_low) / (v_high - v_low)
                return soc_low + ratio * (soc_high - soc_low)

        return 0.0

    def get_status(self) -> dict:
        voltage = self.read_voltage()
        soc = self.get_soc(voltage) if voltage is not None else None
        return {
            "battery_voltage": round(voltage, 2) if voltage is not None else None,
            "battery_soc_pct": round(soc, 1) if soc is not None else None,
        }

    def estimate_runtime(
        self,
        soc: float | None,
        mode: str,
        config: dict,
        interval_sec: int = 3600,
    ) -> float | None:
        if soc is None:
            return None

        remaining_mah = config["battery_mah"] * (soc / 100.0)

        if mode == "bypass":
            draw_ma = config["bypass_draw_ma"]
        else:
            on_time = config.get("auto_on_time_sec", 25)
            duty = on_time / max(interval_sec, 1)
            draw_ma = config["auto_draw_ma"] * duty + 0.035 * (1 - duty)

        return remaining_mah / max(draw_ma, 0.01)
