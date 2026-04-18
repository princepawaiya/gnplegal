import os
import re
from urllib.parse import quote

BASE_STORAGE = "storage"


def get_safe_filename(filename: str) -> str:
    return os.path.basename(filename).replace(" ", "_")


def get_relative_path(full_path: str) -> str:
    if not full_path:
        return None

    full_path = os.path.normpath(full_path)
    base_path = os.path.normpath(BASE_STORAGE)

    if full_path.startswith(base_path):
        relative = os.path.relpath(full_path, base_path)
    else:
        relative = full_path

    return relative.replace("\\", "/")


def build_file_url(relative_path: str) -> str:
    if not relative_path:
        return None

    clean_path = relative_path.strip().lstrip("/")

    if ".." in clean_path:
        return None

    return f"/storage/{clean_path}"

def sanitize_name(name: str) -> str:
    if not name:
        return ""

    # ✅ remove all control characters (newline, tabs, etc.)
    name = re.sub(r'[\r\n\t]', ' ', name)

    return (
        name.strip()
        .replace("/", "_")
        .replace("\\", "_")
        .replace(" ", "_")
        .replace("(", "")
        .replace(")", "")
        .replace(".", "")
    )

def clean_text(value: str) -> str:
    if not value:
        return ""

    # remove line breaks, tabs
    value = re.sub(r'[\r\n\t]+', ' ', value)

    # remove extra spaces
    value = re.sub(r'\s+', ' ', value)

    return value.strip()