def detect_mode() -> str:
    """Read GPIO27 to determine AUTO or BYPASS mode.

    Returns 'auto' if GPIO27 is HIGH (SparkFun VDD = 5V),
    'bypass' if GPIO27 is LOW (SparkFun VDD floating).
    Falls back to 'bypass' if lgpio is unavailable (dev/testing).
    """
    try:
        import lgpio

        h = lgpio.gpiochip_open(0)
        lgpio.gpio_claim_input(h, 27, lgpio.SET_PULL_DOWN)
        value = lgpio.gpio_read(h, 27)
        lgpio.gpiochip_close(h)
        return "auto" if value == 1 else "bypass"
    except Exception:
        return "bypass"
