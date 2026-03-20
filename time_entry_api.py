from __future__ import annotations

import hashlib
import json
import secrets
import time as time_module
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib import error, parse, request


PREVIEW_TTL_SECONDS = 30 * 60
PREVIEW_STORE: dict[str, dict[str, Any]] = {}


@dataclass
class ApiError(Exception):
    status: int
    message: str
    details: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        super().__init__(self.message)
        if self.details is None:
            self.details = {}


def dedupe_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for item in values:
        if item and item not in seen:
            seen.add(item)
            output.append(item)
    return output


def ensure_api_key(config: dict[str, Any], action_label: str) -> None:
    if not config.get("redmine_api_key"):
        raise ApiError(400, f"未設定 API key，不能{action_label}。")


def redmine_headers(config: dict[str, Any]) -> dict[str, str]:
    headers = {"Accept": "application/json"}
    api_key = str(config.get("redmine_api_key") or "").strip()
    if api_key:
        headers["X-Redmine-API-Key"] = api_key
    return headers


def redmine_request_json(
    url: str,
    config: dict[str, Any],
    method: str = "GET",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    headers = redmine_headers(config)
    data: bytes | None = None
    if payload is not None:
        headers = {**headers, "Content-Type": "application/json"}
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    req = request.Request(url=url, headers=headers, data=data, method=method)
    with request.urlopen(req, timeout=10) as response:
        raw_body = response.read().decode("utf-8")
    if not raw_body.strip():
        return {}
    return json.loads(raw_body)


def normalize_activity_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_activities = payload.get("time_entry_activities")
    if not isinstance(raw_activities, list):
        raw_activities = payload.get("enumerations")
    if not isinstance(raw_activities, list):
        return []

    activities: list[dict[str, Any]] = []
    for item in raw_activities:
        if not isinstance(item, dict):
            continue
        raw_id = item.get("id")
        raw_name = str(item.get("name") or "").strip()
        try:
            activity_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if activity_id <= 0 or not raw_name:
            continue
        activities.append(
            {
                "id": activity_id,
                "name": raw_name,
                "is_default": bool(item.get("is_default", False)),
            }
        )
    return activities


def fetch_time_entry_activities(config: dict[str, Any]) -> dict[str, Any]:
    warnings: list[str] = []
    if not config.get("redmine_api_key"):
        return {
            "activities": [],
            "manual_entry": True,
            "warnings": ["未設定 API key，改為手動輸入 activity_id。"],
        }

    candidate_paths = [
        "/enumerations/time_entry_activities.json",
        "/time_entry_activities.json",
    ]
    for candidate_path in candidate_paths:
        url = f"{config['redmine_base_url'].rstrip('/')}{candidate_path}"
        try:
            payload = redmine_request_json(url, config, method="GET")
        except error.HTTPError as exc:
            if exc.code in (404, 405):
                warnings.append(f"{candidate_path} 不支援，改試下一個端點。")
                continue
            warnings.append(f"載入工時活動失敗: HTTP {exc.code}")
            return {"activities": [], "manual_entry": True, "warnings": dedupe_strings(warnings)}
        except error.URLError as exc:
            warnings.append(f"載入工時活動失敗: {exc.reason}")
            return {"activities": [], "manual_entry": True, "warnings": dedupe_strings(warnings)}
        except Exception as exc:
            warnings.append(f"載入工時活動發生例外: {exc}")
            return {"activities": [], "manual_entry": True, "warnings": dedupe_strings(warnings)}

        activities = normalize_activity_payload(payload)
        if activities:
            activities.sort(key=lambda item: (not item["is_default"], item["name"].lower(), item["id"]))
            return {"activities": activities, "manual_entry": False, "warnings": dedupe_strings(warnings)}

    warnings.append("Easy Redmine 沒有提供可用的工時活動清單 API，改為手動輸入 activity_id。")
    return {"activities": [], "manual_entry": True, "warnings": dedupe_strings(warnings)}


def fetch_redmine_details(issue_ids: list[int], config: dict[str, Any]) -> tuple[dict[int, dict[str, Any]], list[str]]:
    details: dict[int, dict[str, Any]] = {}
    warnings: list[str] = []
    if not config.get("redmine_api_key"):
        return details, warnings

    base_url = config["redmine_base_url"].rstrip("/")
    for issue_id in issue_ids:
        url = f"{base_url}/issues/{issue_id}.json"
        try:
            payload = redmine_request_json(url, config, method="GET")
        except error.HTTPError as exc:
            warnings.append(f"Issue #{issue_id} API 回應失敗: HTTP {exc.code}")
            continue
        except error.URLError as exc:
            warnings.append(f"Issue #{issue_id} API 連線失敗: {exc.reason}")
            continue
        except Exception as exc:
            warnings.append(f"Issue #{issue_id} API 發生例外: {exc}")
            continue

        issue = payload.get("issue") or {}
        details[issue_id] = {
            "subject": issue.get("subject"),
            "status": (issue.get("status") or {}).get("name"),
            "project": (issue.get("project") or {}).get("name"),
            "tracker": (issue.get("tracker") or {}).get("name"),
            "priority": (issue.get("priority") or {}).get("name"),
            "assigned_to": (issue.get("assigned_to") or {}).get("name"),
            "spent_hours": issue.get("spent_hours"),
            "estimated_hours": issue.get("estimated_hours"),
        }
    return details, warnings


def normalize_existing_time_entry(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": entry.get("id"),
        "spent_on": entry.get("spent_on"),
        "hours": entry.get("hours"),
        "comments": entry.get("comments") or "",
        "activity_name": (entry.get("activity") or {}).get("name"),
    }


def fetch_existing_time_entries(issue_id: int, spent_on: str, config: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    if not config.get("redmine_api_key"):
        return [], warnings

    query = parse.urlencode({"issue_id": issue_id, "spent_on": spent_on, "user_id": "me"})
    url = f"{config['redmine_base_url'].rstrip('/')}/time_entries.json?{query}"
    try:
        payload = redmine_request_json(url, config, method="GET")
    except error.HTTPError as exc:
        warnings.append(f"查詢 Issue #{issue_id} 既有工時失敗: HTTP {exc.code}")
        return [], warnings
    except error.URLError as exc:
        warnings.append(f"查詢 Issue #{issue_id} 既有工時失敗: {exc.reason}")
        return [], warnings
    except Exception as exc:
        warnings.append(f"查詢 Issue #{issue_id} 既有工時發生例外: {exc}")
        return [], warnings

    raw_entries = payload.get("time_entries")
    if not isinstance(raw_entries, list):
        return [], warnings
    return [normalize_existing_time_entry(item) for item in raw_entries if isinstance(item, dict)], warnings


def normalize_decimal_string(value: Decimal) -> str:
    normalized = format(value.normalize(), "f")
    if "." in normalized:
        normalized = normalized.rstrip("0").rstrip(".")
    return normalized or "0"


def normalize_spent_on(raw_spent_on: Any) -> str:
    value = str(raw_spent_on or "").strip()
    if not value:
        raise ApiError(400, "請選擇工時日期。")
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise ApiError(400, "工時日期格式必須是 YYYY-MM-DD。") from exc


def coerce_positive_int(raw_value: Any, field_name: str, errors: dict[str, str], blank_message: str) -> int | None:
    value = str(raw_value if raw_value is not None else "").strip()
    if not value:
        errors[field_name] = blank_message
        return None
    try:
        parsed_value = int(value)
    except ValueError:
        errors[field_name] = "格式不正確。"
        return None
    if parsed_value <= 0:
        errors[field_name] = "必須大於 0。"
        return None
    return parsed_value


def normalize_preview_entry(raw_entry: Any) -> dict[str, Any]:
    if not isinstance(raw_entry, dict):
        raise ApiError(400, "entries 中的每一筆都必須是 object。")

    errors: dict[str, str] = {}
    issue_id = coerce_positive_int(raw_entry.get("issue_id"), "issue_id", errors, "缺少 issue_id。")

    raw_hours = str(raw_entry.get("hours") or "").strip()
    if not raw_hours:
        errors["hours"] = "請輸入工時。"
        hours = ""
    else:
        try:
            parsed_hours = Decimal(raw_hours)
        except InvalidOperation:
            errors["hours"] = "工時格式不正確。"
            hours = raw_hours
        else:
            if parsed_hours <= 0:
                errors["hours"] = "工時必須大於 0。"
            hours = normalize_decimal_string(parsed_hours)

    activity_id = coerce_positive_int(
        raw_entry.get("activity_id"),
        "activity_id",
        errors,
        "請選擇或輸入工時活動。",
    )

    comments = str(raw_entry.get("comments") or "").strip()
    selected = bool(raw_entry.get("selected", True))

    return {
        "issue_id": issue_id,
        "issue_subject": f"Issue #{issue_id}" if issue_id else "未知 issue",
        "issue_url": "",
        "hours": hours,
        "activity_id": activity_id,
        "comments": comments,
        "selected": selected,
        "errors": errors,
        "duplicate": False,
        "duplicate_entries": [],
    }


def canonical_preview_entry(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "issue_id": entry.get("issue_id"),
        "hours": str(entry.get("hours") or ""),
        "activity_id": entry.get("activity_id"),
        "comments": str(entry.get("comments") or ""),
    }


def preview_signature(spent_on: str, entries: list[dict[str, Any]]) -> str:
    canonical = {
        "spent_on": spent_on,
        "entries": [canonical_preview_entry(entry) for entry in entries],
    }
    payload = json.dumps(canonical, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def prune_preview_store(now_ts: float | None = None) -> None:
    current = now_ts or time_module.time()
    expired_tokens = [
        token
        for token, session in PREVIEW_STORE.items()
        if current - float(session.get("created_at", 0)) > PREVIEW_TTL_SECONDS
    ]
    for token in expired_tokens:
        PREVIEW_STORE.pop(token, None)


def create_preview_session(spent_on: str, entries: list[dict[str, Any]]) -> str:
    prune_preview_store()
    token = secrets.token_urlsafe(24)
    PREVIEW_STORE[token] = {
        "created_at": time_module.time(),
        "spent_on": spent_on,
        "entries": [dict(entry) for entry in entries],
        "signature": preview_signature(spent_on, entries),
    }
    return token


def get_preview_session(preview_token: str) -> dict[str, Any]:
    prune_preview_store()
    session = PREVIEW_STORE.get(preview_token)
    if session is None:
        raise ApiError(400, "preview_token 無效或已過期，請重新預覽。")
    return session


def build_time_entry_payload(entry: dict[str, Any], spent_on: str) -> dict[str, Any]:
    return {
        "time_entry": {
            "issue_id": entry["issue_id"],
            "spent_on": spent_on,
            "hours": float(entry["hours"]),
            "activity_id": int(entry["activity_id"]),
            "comments": entry["comments"],
        }
    }


def preview_time_entries(spent_on: Any, raw_entries: Any, config: dict[str, Any]) -> dict[str, Any]:
    normalized_spent_on = normalize_spent_on(spent_on)
    if not isinstance(raw_entries, list) or not raw_entries:
        raise ApiError(400, "entries 必須是非空陣列。")

    normalized_entries = [normalize_preview_entry(item) for item in raw_entries]
    warnings: list[str] = []

    valid_issue_ids = sorted({entry["issue_id"] for entry in normalized_entries if entry["issue_id"]})
    issue_details: dict[int, dict[str, Any]] = {}
    if valid_issue_ids and config.get("redmine_api_key"):
        issue_details, issue_warnings = fetch_redmine_details(valid_issue_ids, config)
        warnings.extend(issue_warnings)

    duplicate_cache: dict[int, list[dict[str, Any]]] = {}
    base_url = config["redmine_base_url"].rstrip("/")
    for entry in normalized_entries:
        issue_id = entry["issue_id"]
        if issue_id:
            entry["issue_url"] = f"{base_url}/issues/{issue_id}"
            redmine_detail = issue_details.get(issue_id) or {}
            entry["issue_subject"] = redmine_detail.get("subject") or f"Issue #{issue_id}"

        if entry["errors"] or not issue_id:
            continue

        if issue_id not in duplicate_cache:
            duplicates, duplicate_warnings = fetch_existing_time_entries(issue_id, normalized_spent_on, config)
            duplicate_cache[issue_id] = duplicates
            warnings.extend(duplicate_warnings)
        entry["duplicate_entries"] = duplicate_cache[issue_id]
        entry["duplicate"] = bool(entry["duplicate_entries"])
        if entry["duplicate"]:
            entry["selected"] = False

    preview_token = create_preview_session(normalized_spent_on, normalized_entries)
    return {
        "preview_token": preview_token,
        "spent_on": normalized_spent_on,
        "entries": normalized_entries,
        "warnings": dedupe_strings(warnings),
    }


def create_time_entry(entry: dict[str, Any], spent_on: str, config: dict[str, Any]) -> dict[str, Any]:
    ensure_api_key(config, "提交工時")
    payload = build_time_entry_payload(entry, spent_on)
    url = f"{config['redmine_base_url'].rstrip('/')}/time_entries.json"
    return redmine_request_json(url, config, method="POST", payload=payload)


def commit_time_entries(preview_token: str, spent_on: Any, raw_entries: Any, config: dict[str, Any]) -> dict[str, Any]:
    ensure_api_key(config, "提交工時")
    normalized_spent_on = normalize_spent_on(spent_on)
    if not isinstance(raw_entries, list) or not raw_entries:
        raise ApiError(400, "entries 必須是非空陣列。")

    session = get_preview_session(preview_token)
    preview_entries = session["entries"]
    if len(preview_entries) != len(raw_entries):
        raise ApiError(400, "提交筆數與預覽結果不一致，請重新預覽。")
    if normalized_spent_on != session["spent_on"]:
        raise ApiError(400, "工時日期已變更，請重新預覽後再送出。")

    normalized_submitted_entries = [normalize_preview_entry(item) for item in raw_entries]
    submitted_signature = preview_signature(normalized_spent_on, normalized_submitted_entries)
    if submitted_signature != session["signature"]:
        raise ApiError(400, "預覽內容已變更，請重新預覽後再送出。")

    selected_flags = [bool(item.get("selected", False)) if isinstance(item, dict) else False for item in raw_entries]
    if not any(selected_flags):
        raise ApiError(400, "沒有勾選要送出的工時。")

    results: list[dict[str, Any]] = []
    PREVIEW_STORE.pop(preview_token, None)

    for preview_entry, selected in zip(preview_entries, selected_flags):
        result = {
            "issue_id": preview_entry["issue_id"],
            "spent_on": normalized_spent_on,
            "selected": selected,
        }
        if not selected:
            result["skipped"] = True
            results.append(result)
            continue

        if preview_entry["errors"]:
            result["error"] = "這筆資料仍有欄位錯誤，請重新預覽。"
            results.append(result)
            continue

        try:
            payload = create_time_entry(preview_entry, normalized_spent_on, config)
        except error.HTTPError as exc:
            result["error"] = f"HTTP {exc.code}"
        except error.URLError as exc:
            result["error"] = str(exc.reason)
        except Exception as exc:
            result["error"] = str(exc)
        else:
            created_entry = payload.get("time_entry") or {}
            result["created_time_entry_id"] = created_entry.get("id")
        results.append(result)

    return {"spent_on": normalized_spent_on, "results": results}
