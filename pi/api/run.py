import os

from api.main import create_app

app = create_app(
    config_path=os.environ.get("TL_CONFIG", "/home/pi/timelapse/tl_config.json"),
    images_dir=os.environ.get("TL_IMAGES", "/home/pi/timelapse/images"),
    sequence_file=os.environ.get(
        "TL_SEQUENCE", "/home/pi/timelapse/logs/sequence.txt"
    ),
)
