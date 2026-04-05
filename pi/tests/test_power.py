import pytest
from services.power import PowerService


class TestGetSoc:
    def test_full_charge(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(12.6) == 100.0

    def test_empty(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(9.0) == 0.0

    def test_below_empty_clamps(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(8.0) == 0.0

    def test_above_full_clamps(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(13.0) == 100.0

    def test_midpoint_interpolation(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(11.8) == pytest.approx(70.0)

    def test_low_battery(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(10.75) == pytest.approx(7.5)

    def test_exact_table_value(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(11.4) == 40.0


class TestEstimateRuntime:
    def test_bypass_full_charge(self):
        svc = PowerService(hw_enabled=False)
        config = {"battery_mah": 9700, "bypass_draw_ma": 180}
        hours = svc.estimate_runtime(100.0, "bypass", config)
        assert hours == pytest.approx(9700 / 180, rel=0.01)

    def test_bypass_half_charge(self):
        svc = PowerService(hw_enabled=False)
        config = {"battery_mah": 9700, "bypass_draw_ma": 180}
        hours = svc.estimate_runtime(50.0, "bypass", config)
        assert hours == pytest.approx(4850 / 180, rel=0.01)

    def test_auto_mode(self):
        svc = PowerService(hw_enabled=False)
        config = {
            "battery_mah": 9700,
            "auto_draw_ma": 180,
            "auto_on_time_sec": 25,
        }
        hours = svc.estimate_runtime(100.0, "auto", config, interval_sec=3600)
        assert hours > 1000

    def test_returns_none_when_soc_none(self):
        svc = PowerService(hw_enabled=False)
        config = {"battery_mah": 9700, "bypass_draw_ma": 180}
        assert svc.estimate_runtime(None, "bypass", config) is None
