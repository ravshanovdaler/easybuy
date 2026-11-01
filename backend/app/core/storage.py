import os
import hashlib
import uuid
from pathlib import Path
from PIL import Image

from app.core.config import settings


def get_upload_path(subdir: str) -> Path:
    path = Path(settings.UPLOAD_DIR) / subdir
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_image(file_bytes: bytes, subdir: str, ext: str = ".webp") -> tuple[str, str]:
    """
    Save image to local storage, convert to WebP, strip EXIF.
    Returns (file_key, sha256).
    file_key = relative path like 'products/abc123.webp'
    """
    sha256 = hashlib.sha256(file_bytes).hexdigest()
    filename = uuid.uuid4().hex + ext
    dir_path = get_upload_path(subdir)
    file_path = dir_path / filename

    # Process with Pillow: resize max 1200px, convert to WebP, strip EXIF
    from io import BytesIO
    img = Image.open(BytesIO(file_bytes))
    img = img.convert("RGB")
    max_size = (1200, 1200)
    img.thumbnail(max_size, Image.LANCZOS)

    # Strip EXIF by re-creating image
    clean_img = Image.new(img.mode, img.size)
    clean_img.putdata(list(img.getdata()))

    out = BytesIO()
    clean_img.save(out, format="WEBP", quality=82)
    out.seek(0)
    file_path.write_bytes(out.read())

    file_key = f"{subdir}/{filename}"
    return file_key, sha256


def get_file_url(file_key: str) -> str:
    """Convert file_key to public URL."""
    return f"{settings.BASE_URL}/uploads/{file_key}"


def delete_file(file_key: str) -> None:
    """Delete a file from local storage."""
    path = Path(settings.UPLOAD_DIR) / file_key
    if path.exists():
        path.unlink()
