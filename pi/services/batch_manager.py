import json
import os
import shutil
from datetime import datetime
from typing import Optional

from PIL import Image

BATCH_META_FILE = "batch.json"
THUMB_SUFFIX = "_thumb"
THUMB_MAX_WIDTH = 300


class BatchManager:
    def __init__(self, images_dir: str):
        self._images_dir = images_dir
        self._batch_seq_file = os.path.join(images_dir, ".batch_seq")
        os.makedirs(images_dir, exist_ok=True)

    def get_batch_dir(self, batch_id: str) -> str:
        return os.path.join(self._images_dir, batch_id)

    def create_batch(self, name: Optional[str] = None) -> dict:
        seq = self._next_batch_seq()
        date_str = datetime.now().strftime("%Y-%m-%d")
        batch_id = f"batch_{seq:03d}_{date_str}"
        batch_dir = os.path.join(self._images_dir, batch_id)
        os.makedirs(batch_dir)

        display_name = name or f"{date_str} Batch {seq}"
        meta = {
            "id": batch_id,
            "name": display_name,
            "created": datetime.now().isoformat(),
        }
        with open(os.path.join(batch_dir, BATCH_META_FILE), "w") as f:
            json.dump(meta, f, indent=2)
        return meta

    def list_batches(self) -> list:
        batches = []
        if not os.path.exists(self._images_dir):
            return batches
        for entry in sorted(os.listdir(self._images_dir)):
            batch_dir = os.path.join(self._images_dir, entry)
            if not os.path.isdir(batch_dir) or entry.startswith("."):
                continue
            meta_path = os.path.join(batch_dir, BATCH_META_FILE)
            if not os.path.exists(meta_path):
                continue
            with open(meta_path) as f:
                meta = json.load(f)
            images = self._list_images(batch_dir)
            meta["image_count"] = len(images)
            if images:
                meta["first_capture"] = images[0]
                meta["last_capture"] = images[-1]
            else:
                meta["first_capture"] = None
                meta["last_capture"] = None
            batches.append(meta)
        return batches

    def get_batch(self, batch_id: str) -> dict:
        batch_dir = os.path.join(self._images_dir, batch_id)
        with open(os.path.join(batch_dir, BATCH_META_FILE)) as f:
            meta = json.load(f)
        images = self._list_images(batch_dir)
        meta["images"] = []
        for img_name in images:
            img_path = os.path.join(batch_dir, img_name)
            img_id = os.path.splitext(img_name)[0]
            meta["images"].append(
                {
                    "id": img_id,
                    "filename": img_name,
                    "size_bytes": os.path.getsize(img_path),
                }
            )
        return meta

    def rename_batch(self, batch_id: str, new_name: str) -> dict:
        batch_dir = os.path.join(self._images_dir, batch_id)
        meta_path = os.path.join(batch_dir, BATCH_META_FILE)
        with open(meta_path) as f:
            meta = json.load(f)
        meta["name"] = new_name
        with open(meta_path, "w") as f:
            json.dump(meta, f, indent=2)
        return meta

    def split_batch(self, batch_id: str, after_image_id: str) -> tuple:
        batch_dir = os.path.join(self._images_dir, batch_id)
        images = self._list_images(batch_dir)
        split_name = f"{after_image_id}.jpg"
        split_idx = images.index(split_name)

        images_b = images[split_idx + 1 :]
        if not images_b:
            raise ValueError("Cannot split: no images after split point")

        new_meta = self.create_batch()
        new_dir = os.path.join(self._images_dir, new_meta["id"])

        for img_name in images_b:
            shutil.move(
                os.path.join(batch_dir, img_name),
                os.path.join(new_dir, img_name),
            )
            thumb_name = self._thumb_name(img_name)
            thumb_src = os.path.join(batch_dir, thumb_name)
            if os.path.exists(thumb_src):
                shutil.move(thumb_src, os.path.join(new_dir, thumb_name))

        return self.get_batch(batch_id), self.get_batch(new_meta["id"])

    def merge_batches(self, batch_id_a: str, batch_id_b: str) -> dict:
        dir_a = os.path.join(self._images_dir, batch_id_a)
        dir_b = os.path.join(self._images_dir, batch_id_b)

        for entry in os.listdir(dir_b):
            if entry == BATCH_META_FILE:
                continue
            shutil.move(os.path.join(dir_b, entry), os.path.join(dir_a, entry))
        shutil.rmtree(dir_b)
        return self.get_batch(batch_id_a)

    def delete_batch(self, batch_id: str) -> int:
        batch_dir = os.path.join(self._images_dir, batch_id)
        count = len(self._list_images(batch_dir))
        shutil.rmtree(batch_dir)
        return count

    def get_image_path(self, batch_id: str, image_id: str) -> str:
        return os.path.join(self._images_dir, batch_id, f"{image_id}.jpg")

    def get_thumb_path(self, batch_id: str, image_id: str) -> str:
        return os.path.join(self._images_dir, batch_id, f"{image_id}_thumb.jpg")

    def generate_thumbnail(self, image_path: str) -> str:
        base, ext = os.path.splitext(image_path)
        thumb_path = f"{base}_thumb{ext}"
        img = Image.open(image_path)
        ratio = THUMB_MAX_WIDTH / img.width
        new_size = (THUMB_MAX_WIDTH, int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)
        img.save(thumb_path, "JPEG", quality=80)
        return thumb_path

    def _list_images(self, batch_dir: str) -> list:
        return sorted(
            f
            for f in os.listdir(batch_dir)
            if f.endswith(".jpg") and THUMB_SUFFIX not in f
        )

    def _next_batch_seq(self) -> int:
        seq = 0
        try:
            with open(self._batch_seq_file, "r") as f:
                seq = int(f.read().strip())
        except (FileNotFoundError, ValueError):
            pass
        seq += 1
        with open(self._batch_seq_file, "w") as f:
            f.write(str(seq))
        return seq

    @staticmethod
    def _thumb_name(image_name: str) -> str:
        base, ext = os.path.splitext(image_name)
        return f"{base}_thumb{ext}"
