import subprocess


class WifiManager:
    """Wraps NetworkManager (nmcli) for WiFi AP/client management."""

    def get_status(self) -> dict:
        result = subprocess.run(
            ["nmcli", "-t", "-f", "GENERAL.TYPE,GENERAL.STATE,GENERAL.CONNECTION",
             "device", "show", "wlan0"],
            capture_output=True, text=True,
        )
        mode = "unknown"
        ssid = None
        ip = None

        # Check if AP is active
        ap_check = subprocess.run(
            ["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show", "--active"],
            capture_output=True, text=True,
        )
        for line in ap_check.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split(":")
            if len(parts) >= 2 and "wireless" in parts[1]:
                ssid = parts[0]

        # Check connection mode
        mode_check = subprocess.run(
            ["nmcli", "-t", "-f", "WIFI.MODE", "device", "show", "wlan0"],
            capture_output=True, text=True,
        )
        if "AP" in mode_check.stdout:
            mode = "ap"
        elif ssid:
            mode = "client"

        # Get IP
        ip_check = subprocess.run(
            ["nmcli", "-t", "-f", "IP4.ADDRESS", "device", "show", "wlan0"],
            capture_output=True, text=True,
        )
        for line in ip_check.stdout.strip().split("\n"):
            if "IP4.ADDRESS" in line:
                ip = line.split(":")[-1].split("/")[0]

        # Signal strength
        signal = None
        if mode == "client":
            sig_check = subprocess.run(
                ["nmcli", "-t", "-f", "IN-USE,SIGNAL", "dev", "wifi"],
                capture_output=True, text=True,
            )
            for line in sig_check.stdout.strip().split("\n"):
                if line.startswith("*:"):
                    signal = int(line.split(":")[1])

        return {"mode": mode, "ssid": ssid, "ip": ip, "signal_strength": signal}

    def scan(self) -> list:
        subprocess.run(
            ["nmcli", "dev", "wifi", "rescan"],
            capture_output=True, timeout=10,
        )
        result = subprocess.run(
            ["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list"],
            capture_output=True, text=True,
        )
        networks = []
        seen = set()
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split(":")
            if len(parts) >= 3 and parts[0] and parts[0] not in seen:
                seen.add(parts[0])
                networks.append({
                    "ssid": parts[0],
                    "signal": int(parts[1]) if parts[1].isdigit() else 0,
                    "security": parts[2] or "Open",
                })
        return sorted(networks, key=lambda n: n["signal"], reverse=True)

    def connect(self, ssid: str, password: str) -> bool:
        result = subprocess.run(
            ["sudo", "nmcli", "dev", "wifi", "connect", ssid,
             "password", password],
            capture_output=True, text=True, timeout=30,
        )
        return result.returncode == 0

    def start_ap(self, ssid: str = "TimelapsePi",
                 password: str = "timelapse") -> bool:
        # Remove existing AP connection if any
        subprocess.run(
            ["sudo", "nmcli", "connection", "delete", "timelapse-ap"],
            capture_output=True,
        )
        # Create AP connection
        result = subprocess.run(
            ["sudo", "nmcli", "connection", "add",
             "type", "wifi",
             "con-name", "timelapse-ap",
             "ssid", ssid,
             "wifi.mode", "ap",
             "wifi-sec.key-mgmt", "wpa-psk",
             "wifi-sec.psk", password,
             "ipv4.method", "shared",
             "ipv4.addresses", "10.42.0.1/24"],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            return False
        result = subprocess.run(
            ["sudo", "nmcli", "connection", "up", "timelapse-ap"],
            capture_output=True, text=True, timeout=15,
        )
        return result.returncode == 0

    def get_saved_networks(self) -> list:
        result = subprocess.run(
            ["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"],
            capture_output=True, text=True,
        )
        networks = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split(":")
            if len(parts) >= 2 and "wireless" in parts[1]:
                name = parts[0]
                if name != "timelapse-ap":
                    networks.append({"ssid": name, "priority": 0})
        return networks

    def remove_saved_network(self, ssid: str) -> bool:
        result = subprocess.run(
            ["sudo", "nmcli", "connection", "delete", ssid],
            capture_output=True, text=True,
        )
        return result.returncode == 0
