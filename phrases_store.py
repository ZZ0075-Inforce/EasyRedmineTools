from __future__ import annotations

import json
import secrets
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any


def empty_document() -> dict[str, list[dict[str, Any]]]:
    return {"phrases": []}


def normalize_decimal_string(value: Decimal) -> str:
    normalized = format(value.normalize(), "f")
    if "." in normalized:
        normalized = normalized.rstrip("0").rstrip(".")
    return normalized or "0"


def normalize_hours(raw_value: Any) -> str:
    value = str(raw_value or "").strip()
    if not value:
        return ""
    try:
        parsed = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("常用工時格式不正確。") from exc
    if parsed <= 0:
        raise ValueError("常用工時必須大於 0。")
    return normalize_decimal_string(parsed)


def normalize_activity_id(raw_value: Any) -> int | str:
    if raw_value in (None, ""):
        return ""
    try:
        parsed = int(str(raw_value).strip())
    except ValueError as exc:
        raise ValueError("常用 activity_id 必須是整數。") from exc
    if parsed <= 0:
        raise ValueError("常用 activity_id 必須大於 0。")
    return parsed


def normalize_phrase(raw_value: Any) -> dict[str, Any]:
    if not isinstance(raw_value, dict):
        raise ValueError("常用語句必須是 object。")
    label = str(raw_value.get("label") or "").strip()
    hours = normalize_hours(raw_value.get("hours"))
    activity_id = normalize_activity_id(raw_value.get("activity_id"))
    comments = str(raw_value.get("comments") or "").strip()
    if not (hours or activity_id or comments):
        raise ValueError("常用語句至少要設定工時、活動或備註其中一項。")
    return {
        "id": str(raw_value.get("id") or "").strip(),
        "label": label,
        "hours": hours,
        "activity_id": activity_id,
        "comments": comments,
    }


def load_document(path: Path) -> dict[str, list[dict[str, Any]]]:
    if not path.exists():
        return empty_document()
    with path.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)
    if not isinstance(raw, dict):
        raise ValueError("phrases 檔案最外層必須是 object。")
    items = raw.get("phrases") or []
    if not isinstance(items, list):
        raise ValueError("phrases 必須是陣列。")
    phrases: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            phrase = normalize_phrase(item)
        except ValueError:
            continue
        phrase["id"] = phrase["id"] or secrets.token_urlsafe(8)
        phrases.append(phrase)
    return {"phrases": phrases}


def write_document(path: Path, document: dict[str, list[dict[str, Any]]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def list_phrases(path: Path) -> list[dict[str, Any]]:
    return load_document(path)["phrases"]


def add_phrase(path: Path, raw_value: Any) -> dict[str, Any]:
    phrase = normalize_phrase(raw_value)
    phrase["id"] = secrets.token_urlsafe(8)
    document = load_document(path)
    document["phrases"].append(phrase)
    write_document(path, document)
    return phrase


def update_phrase(path: Path, phrase_id: str, raw_value: Any) -> dict[str, Any]:
    normalized = normalize_phrase(raw_value)
    document = load_document(path)
    for item in document["phrases"]:
        if item["id"] == phrase_id:
            item["label"] = normalized["label"]
            item["hours"] = normalized["hours"]
            item["activity_id"] = normalized["activity_id"]
            item["comments"] = normalized["comments"]
            write_document(path, document)
            return item
    raise ValueError("找不到指定的常用語句。")


def delete_phrase(path: Path, phrase_id: str) -> bool:
    document = load_document(path)
    before = len(document["phrases"])
    document["phrases"] = [item for item in document["phrases"] if item["id"] != phrase_id]
    removed = len(document["phrases"]) < before
    if removed:
        write_document(path, document)
    return removed
