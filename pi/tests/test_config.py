import json
import pytest
from services.config import ConfigService, DEFAULT_CONFIG


class TestConfigLoad:
    def test_returns_defaults_when_no_file(self, tmp_path):
        svc = ConfigService(str(tmp_path / "config.json"))
        config = svc.load()
        assert config["software_interval_sec"] == 60
        assert config["camera"]["iso"] == 100
        assert config["ap"]["ssid"] == "TimelapsePi"

    def test_reads_existing_file(self, tmp_path):
        path = tmp_path / "config.json"
        path.write_text('{"software_interval_sec": 30}')
        svc = ConfigService(str(path))
        config = svc.load()
        assert config["software_interval_sec"] == 30
        assert config["camera"]["iso"] == 100  # defaults filled in

    def test_power_defaults(self, tmp_path):
        svc = ConfigService(str(tmp_path / "config.json"))
        config = svc.load()
        assert config["power"]["volt_multiplier"] == 12.71
        assert config["power"]["battery_mah"] == 9700
        assert config["power"]["bypass_draw_ma"] == 180
        assert config["power"]["auto_draw_ma"] == 180
        assert config["power"]["auto_on_time_sec"] == 25

    def test_ignores_unknown_keys(self, tmp_path):
        path = tmp_path / "config.json"
        path.write_text('{"unknown_key": "value", "software_interval_sec": 5}')
        svc = ConfigService(str(path))
        config = svc.load()
        assert config["unknown_key"] == "value"
        assert config["software_interval_sec"] == 5


class TestConfigSave:
    def test_writes_json_file(self, tmp_path):
        path = tmp_path / "config.json"
        svc = ConfigService(str(path))
        svc.save({"test": True})
        assert json.loads(path.read_text()) == {"test": True}

    def test_creates_parent_dirs(self, tmp_path):
        path = tmp_path / "subdir" / "config.json"
        svc = ConfigService(str(path))
        svc.save({"test": True})
        assert path.exists()


class TestConfigMerge:
    def test_merges_top_level_field(self, tmp_path):
        path = tmp_path / "config.json"
        path.write_text(json.dumps(DEFAULT_CONFIG))
        svc = ConfigService(str(path))
        result = svc.merge({"software_interval_sec": 10})
        assert result["software_interval_sec"] == 10
        assert result["camera"]["iso"] == 100

    def test_merges_nested_field(self, tmp_path):
        path = tmp_path / "config.json"
        path.write_text(json.dumps(DEFAULT_CONFIG))
        svc = ConfigService(str(path))
        result = svc.merge({"camera": {"iso": 400}})
        assert result["camera"]["iso"] == 400
        assert result["camera"]["awb_mode"] == "auto"

    def test_merge_persists_to_disk(self, tmp_path):
        path = tmp_path / "config.json"
        path.write_text(json.dumps(DEFAULT_CONFIG))
        svc = ConfigService(str(path))
        svc.merge({"software_interval_sec": 10})
        reloaded = json.loads(path.read_text())
        assert reloaded["software_interval_sec"] == 10
