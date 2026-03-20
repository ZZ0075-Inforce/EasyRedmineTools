from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any


def empty_defaults_document() -> dict[str, dict[str, dict[str, Any]]]:
    return {"issues": {}}


def normalize_decimal_string(value: Decimal) -> str:
    normalized = format(value.normalize(), "f")
    if "." in normalized:
        normalized = normalized.rstrip("0").rstrip(".")
    return normalized or "0"


def normalize_issue_id(value: Any) -> str:
    try:
        issue_id = int(str(value).strip())
    except (TypeError, ValueError) as exc:
        raise ValueError("issue_id 必須是正整數。") from exc
    if issue_id <= 0:
        raise ValueError("issue_id 必須是正整數。")
    return str(issue_id)


def normalize_default_fields(raw_value: Any) -> dict[str, Any]:
    if not isinstance(raw_value, dict):
        raise ValueError("issue 預設值必須是 object。")

    raw_hours = str(raw_value.get("hours") or "").strip()
    if raw_hours:
        try:
            parsed_hours = Decimal(raw_hours)
        except InvalidOperation as exc:
            raise ValueError("預設時數格式不正確。") from exc
        if parsed_hours <= 0:
            raise ValueError("預設時數必須大於 0。")
        hours = normalize_decimal_string(parsed_hours)
    else:
        hours = ""

    raw_activity_id = raw_value.get("activity_id")
    if raw_activity_id in (None, ""):
        activity_id: int | str = ""
    else:
        try:
            activity_id = int(str(raw_activity_id).strip())
        except ValueError as exc:
            raise ValueError("預設 activity_id 格式不正確。") from exc
        if activity_id <= 0:
            raise ValueError("預設 activity_id 必須大於 0。")

    return {
        "hours": hours,
        "activity_id": activity_id,
        "comments": str(raw_value.get("comments") or "").strip(),
    }


def normalize_document(raw_value: Any) -> dict[str, dict[str, dict[str, Any]]]:
    if raw_value in (None, ""):
        return empty_defaults_document()
    if not isinstance(raw_value, dict):
        raise ValueError("issue defaults 檔案最外層必須是 object。")

    raw_issues = raw_value.get("issues") or {}
    if not isinstance(raw_issues, dict):
        raise ValueError("issue defaults 檔案中的 issues 必須是 object。")

    issues: dict[str, dict[str, Any]] = {}
    for raw_issue_id, raw_defaults in raw_issues.items():
        issue_id = normalize_issue_id(raw_issue_id)
        issues[issue_id] = normalize_default_fields(raw_defaults)
    return {"issues": issues}


def load_document(path: Path) -> dict[str, dict[str, dict[str, Any]]]:
    if not path.exists():
        return empty_defaults_document()
    with path.open("r", encoding="utf-8") as handle:
        raw_value = json.load(handle)
    return normalize_document(raw_value)


def write_document(path: Path, document: dict[str, dict[str, dict[str, Any]]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def merged_defaults_for_issue(
    issue_id: int | str,
    shared_document: dict[str, dict[str, dict[str, Any]]],
    local_document: dict[str, dict[str, dict[str, Any]]],
) -> dict[str, Any]:
    issue_key = normalize_issue_id(issue_id)
    shared_value = shared_document["issues"].get(issue_key)
    local_value = local_document["issues"].get(issue_key)

    if local_value and shared_value:
        merged_value = local_value
        source = "local override"
    elif local_value:
        merged_value = local_value
        source = "local"
    elif shared_value:
        merged_value = shared_value
        source = "shared"
    else:
        merged_value = {"hours": "", "activity_id": "", "comments": ""}
        source = "none"

    return {
        "issue_id": int(issue_key),
        "hours": merged_value.get("hours", ""),
        "activity_id": merged_value.get("activity_id", ""),
        "comments": merged_value.get("comments", ""),
        "source": source,
        "has_shared": shared_value is not None,
        "has_local_override": local_value is not None,
    }


def merged_defaults_for_issues(
    issue_ids: list[int],
    shared_path: Path,
    local_path: Path,
) -> dict[str, dict[str, Any]]:
    shared_document = load_document(shared_path)
    local_document = load_document(local_path)
    return {
        str(issue_id): merged_defaults_for_issue(issue_id, shared_document, local_document)
        for issue_id in issue_ids
    }


def update_local_default(local_path: Path, issue_id: int | str, raw_value: Any) -> dict[str, Any]:
    document = load_document(local_path)
    issue_key = normalize_issue_id(issue_id)
    document["issues"][issue_key] = normalize_default_fields(raw_value)
    write_document(local_path, document)
    return document["issues"][issue_key]


def delete_local_default(local_path: Path, issue_id: int | str) -> bool:
    document = load_document(local_path)
    issue_key = normalize_issue_id(issue_id)
    removed = issue_key in document["issues"]
    if removed:
        document["issues"].pop(issue_key, None)
        write_document(local_path, document)
    return removed
