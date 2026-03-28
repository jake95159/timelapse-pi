import os
import threading
import time


class CaptureLoop:
    """Software-timed capture loop for BYPASS mode.

    Creates a new batch when started, captures at the configured
    interval, stops on request. Uses a global sequence counter
    shared with AUTO mode captures.
    """

    def __init__(self, camera, batch_manager, sequence_file: str):
        self._camera = camera
        self._batch_manager = batch_manager
        self._sequence_file = sequence_file
        self._thread = None
        self._running = False
        self._capture_count = 0
        self._current_batch_id = None
        self._interval_sec = None

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def capture_count(self) -> int:
        return self._capture_count

    @property
    def current_batch_id(self) -> str:
        return self._current_batch_id

    @property
    def interval_sec(self) -> float:
        return self._interval_sec

    def start(self, interval_sec: float) -> str:
        if self._running:
            raise RuntimeError("Capture loop already running")
        batch = self._batch_manager.create_batch()
        self._current_batch_id = batch["id"]
        self._capture_count = 0
        self._interval_sec = interval_sec
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        return self._current_batch_id

    def stop(self) -> int:
        self._running = False
        if self._thread:
            self._thread.join(timeout=10)
            self._thread = None
        count = self._capture_count
        return count

    def capture_single(self) -> dict:
        if not self._current_batch_id:
            batch = self._batch_manager.create_batch()
            self._current_batch_id = batch["id"]
        return self._capture_one()

    def _loop(self):
        while self._running:
            self._capture_one()
            elapsed = 0.0
            while elapsed < self._interval_sec and self._running:
                step = min(0.5, self._interval_sec - elapsed)
                time.sleep(step)
                elapsed += step

    def _capture_one(self) -> dict:
        seq = self._next_sequence()
        batch_dir = self._batch_manager.get_batch_dir(self._current_batch_id)
        image_id = f"capture_{seq:05d}"
        filepath = os.path.join(batch_dir, f"{image_id}.jpg")

        self._camera.capture_still(filepath)
        self._batch_manager.generate_thumbnail(filepath)
        self._capture_count += 1

        return {
            "image_id": image_id,
            "batch_id": self._current_batch_id,
            "sequence": seq,
        }

    def _next_sequence(self) -> int:
        seq = 0
        try:
            with open(self._sequence_file, "r") as f:
                seq = int(f.read().strip())
        except (FileNotFoundError, ValueError):
            pass
        seq += 1
        with open(self._sequence_file, "w") as f:
            f.write(str(seq))
            f.flush()
            os.fsync(f.fileno())
        return seq
