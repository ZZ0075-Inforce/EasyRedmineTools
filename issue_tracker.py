from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sqlite3
import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib import error, parse, request

import issue_defaults_store
import time_entry_api
import worklog_ui


APP_DIR = Path(__file__).resolve().parent
WEB_DIR = APP_DIR / "web"
RUNTIME_DIR = APP_DIR / ".runtime"
CONFIG_PATH = APP_DIR / "config.local.json"
WORKLOG_APP_PATH = APP_DIR / "worklog_app.js"
ISSUE_DEFAULTS_SHARED_PATH = APP_DIR / "issue_defaults.json"
ISSUE_DEFAULTS_LOCAL_PATH = APP_DIR / "issue_defaults.local.json"
PRIMARY_API_KEY_ENV = "LAWPJ_API_KEY"
LEGACY_API_KEY_ENV = "REDMINE_API_KEY"


@dataclass(frozen=True)
class BrowserSource:
    name: str
    engine: str
    path: Path


@dataclass(frozen=True)
class VisitRecord:
    browser: str
    issue_id: int
    url: str
    title: str
    visited_at: datetime


def default_base_url() -> str:
    return "https://lawpj.lawbroker.com.tw"


def load_config() -> dict[str, Any]:
    config: dict[str, Any] = {
        "redmine_base_url": default_base_url(),
        "redmine_api_key": "",
        "enabled_browsers": ["chrome", "edge", "firefox"],
        "browser_paths": {},
        "issue_defaults_shared_path": ISSUE_DEFAULTS_SHARED_PATH,
        "issue_defaults_local_path": ISSUE_DEFAULTS_LOCAL_PATH,
    }
    if CONFIG_PATH.exists():
        with CONFIG_PATH.open("r", encoding="utf-8") as handle:
            file_config = json.load(handle)
        if not isinstance(file_config, dict):
            raise ValueError("config.local.json 必須是 JSON object。")
        config.update(file_config)

    if os.getenv("REDMINE_BASE_URL"):
        config["redmine_base_url"] = os.environ["REDMINE_BASE_URL"].strip()
    if os.getenv(PRIMARY_API_KEY_ENV):
        config["redmine_api_key"] = os.environ[PRIMARY_API_KEY_ENV].strip()
    elif os.getenv(LEGACY_API_KEY_ENV):
        config["redmine_api_key"] = os.environ[LEGACY_API_KEY_ENV].strip()

    browser_paths = config.get("browser_paths") or {}
    if not isinstance(browser_paths, dict):
        raise ValueError("browser_paths 必須是 object。")

    config["browser_paths"] = browser_paths
    config["redmine_base_url"] = str(config["redmine_base_url"]).rstrip("/")
    config["redmine_api_key"] = str(config.get("redmine_api_key") or "").strip()
    config["issue_defaults_shared_path"] = Path(str(config.get("issue_defaults_shared_path") or ISSUE_DEFAULTS_SHARED_PATH))
    config["issue_defaults_local_path"] = Path(str(config.get("issue_defaults_local_path") or ISSUE_DEFAULTS_LOCAL_PATH))
    enabled = config.get("enabled_browsers") or ["chrome", "edge", "firefox"]
    config["enabled_browsers"] = [str(item).lower() for item in enabled]
    return config


def local_timezone() -> timezone:
    tzinfo = datetime.now().astimezone().tzinfo
    if tzinfo is None:
        return timezone.utc
    return tzinfo


def resolve_day_range(day_label: str, now: datetime | None = None) -> tuple[date, datetime, datetime]:
    tzinfo = local_timezone()
    current = now.astimezone(tzinfo) if now else datetime.now(tzinfo)
    if day_label == "today":
        target_day = current.date()
    elif day_label == "yesterday":
        target_day = (current - timedelta(days=1)).date()
    else:
        target_day = date.fromisoformat(day_label)
    start = datetime.combine(target_day, time.min, tzinfo=tzinfo)
    end = start + timedelta(days=1)
    return target_day, start, end


def normalize_custom_paths(raw_value: Any) -> list[Path]:
    if raw_value is None:
        return []
    if isinstance(raw_value, str):
        return [Path(raw_value)]
    if isinstance(raw_value, list):
        return [Path(str(item)) for item in raw_value]
    raise ValueError("browser_paths 的值必須是字串或陣列。")


def discover_browser_sources(config: dict[str, Any]) -> list[BrowserSource]:
    local_appdata = Path(os.environ.get("LOCALAPPDATA", ""))
    roaming_appdata = Path(os.environ.get("APPDATA", ""))

    chromium_defaults = {
        "chrome": local_appdata / "Google/Chrome/User Data/Default/History",
        "edge": local_appdata / "Microsoft/Edge/User Data/Default/History",
    }
    sources: list[BrowserSource] = []

    for browser_name in ("chrome", "edge"):
        if browser_name not in config["enabled_browsers"]:
            continue
        custom_paths = normalize_custom_paths(config["browser_paths"].get(browser_name))
        candidates = custom_paths or [chromium_defaults[browser_name]]
        for path in candidates:
            if path.exists():
                sources.append(BrowserSource(name=browser_name, engine="chromium", path=path))

    if "firefox" in config["enabled_browsers"]:
        custom_firefox = normalize_custom_paths(config["browser_paths"].get("firefox"))
        if custom_firefox:
            firefox_candidates: list[Path] = []
            for path in custom_firefox:
                if path.is_dir():
                    firefox_candidates.extend(path.glob("*/places.sqlite"))
                else:
                    firefox_candidates.append(path)
        else:
            firefox_candidates = list((roaming_appdata / "Mozilla/Firefox/Profiles").glob("*/places.sqlite"))
        for path in firefox_candidates:
            if path.exists():
                sources.append(BrowserSource(name=f"firefox:{path.parent.name}", engine="firefox", path=path))
    return sources


def chromium_epoch() -> datetime:
    return datetime(1601, 1, 1, tzinfo=timezone.utc)


def chromium_time_to_datetime(value: int) -> datetime:
    return chromium_epoch() + timedelta(microseconds=value)


def firefox_time_to_datetime(value: int) -> datetime:
    return datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=value)


def datetime_to_chromium_time(value: datetime) -> int:
    delta = value.astimezone(timezone.utc) - chromium_epoch()
    return int(delta.total_seconds() * 1_000_000)


def datetime_to_firefox_time(value: datetime) -> int:
    delta = value.astimezone(timezone.utc) - datetime(1970, 1, 1, tzinfo=timezone.utc)
    return int(delta.total_seconds() * 1_000_000)


def parse_issue_id(url: str, base_url: str) -> int | None:
    parsed_url = parse.urlparse(url)
    parsed_base = parse.urlparse(base_url)
    if parsed_url.netloc != parsed_base.netloc:
        return None
    match = re.match(r"^/issues/(\d+)(?:/.*)?$", parsed_url.path)
    if not match:
        return None
    return int(match.group(1))


def runtime_copy_path(source: BrowserSource) -> Path:
    RUNTIME_DIR.mkdir(exist_ok=True)
    safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", source.name)
    return RUNTIME_DIR / f"{safe_name}_{source.path.name}"


def load_visits_from_source(
    source: BrowserSource,
    base_url: str,
    start: datetime,
    end: datetime,
) -> tuple[list[VisitRecord], list[str]]:
    staging_path = runtime_copy_path(source)
    warnings: list[str] = []
    visits: list[VisitRecord] = []
    connection: sqlite3.Connection | None = None

    try:
        shutil.copy2(source.path, staging_path)
    except OSError as exc:
        warnings.append(f"{source.name} 歷史檔無法複製: {exc}")
        return visits, warnings

    try:
        connection = sqlite3.connect(staging_path)
        cursor = connection.cursor()
        like_pattern = f"{base_url.rstrip('/')}/issues/%"
        if source.engine == "chromium":
            cursor.execute(
                """
                SELECT urls.url, COALESCE(urls.title, ''), visits.visit_time
                FROM visits
                JOIN urls ON urls.id = visits.url
                WHERE urls.url LIKE ?
                  AND visits.visit_time >= ?
                  AND visits.visit_time < ?
                ORDER BY visits.visit_time DESC
                """,
                (like_pattern, datetime_to_chromium_time(start), datetime_to_chromium_time(end)),
            )
            converter = chromium_time_to_datetime
        else:
            cursor.execute(
                """
                SELECT moz_places.url, COALESCE(moz_places.title, ''), moz_historyvisits.visit_date
                FROM moz_historyvisits
                JOIN moz_places ON moz_places.id = moz_historyvisits.place_id
                WHERE moz_places.url LIKE ?
                  AND moz_historyvisits.visit_date >= ?
                  AND moz_historyvisits.visit_date < ?
                ORDER BY moz_historyvisits.visit_date DESC
                """,
                (like_pattern, datetime_to_firefox_time(start), datetime_to_firefox_time(end)),
            )
            converter = firefox_time_to_datetime

        for url, title, raw_visited_at in cursor.fetchall():
            if raw_visited_at is None:
                continue
            issue_id = parse_issue_id(url, base_url)
            if issue_id is None:
                continue
            visits.append(
                VisitRecord(
                    browser=source.name,
                    issue_id=issue_id,
                    url=url,
                    title=title,
                    visited_at=converter(int(raw_visited_at)).astimezone(local_timezone()),
                )
            )
    except sqlite3.Error as exc:
        warnings.append(f"{source.name} 歷史檔查詢失敗: {exc}")
    finally:
        if connection is not None:
            connection.close()
        staging_path.unlink(missing_ok=True)
    return visits, warnings


def redmine_headers(config: dict[str, Any]) -> dict[str, str]:
    headers = {"Accept": "application/json"}
    if config["redmine_api_key"]:
        headers["X-Redmine-API-Key"] = config["redmine_api_key"]
    return headers


def redmine_request_json(url: str, config: dict[str, Any], data: bytes | None = None) -> dict[str, Any]:
    req = request.Request(url=url, headers=redmine_headers(config), data=data)
    with request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_redmine_details(issue_ids: list[int], config: dict[str, Any]) -> tuple[dict[int, dict[str, Any]], list[str]]:
    details: dict[int, dict[str, Any]] = {}
    warnings: list[str] = []
    for issue_id in issue_ids:
        url = f"{config['redmine_base_url']}/issues/{issue_id}.json"
        try:
            payload = redmine_request_json(url, config)
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


def summarize_visits(
    visits: list[VisitRecord],
    config: dict[str, Any],
    use_redmine_api: bool = True,
) -> tuple[list[dict[str, Any]], list[str]]:
    grouped: dict[int, dict[str, Any]] = {}
    for visit in visits:
        canonical_url = f"{config['redmine_base_url']}/issues/{visit.issue_id}"
        existing = grouped.get(visit.issue_id)
        if existing is None:
            existing = {
                "issue_id": visit.issue_id,
                "issue_url": canonical_url,
                "visit_count": 0,
                "first_visited_at": visit.visited_at,
                "last_visited_at": visit.visited_at,
                "browser_sources": set(),
                "page_titles": set(),
                "redmine": None,
            }
            grouped[visit.issue_id] = existing
        existing["visit_count"] += 1
        existing["first_visited_at"] = min(existing["first_visited_at"], visit.visited_at)
        existing["last_visited_at"] = max(existing["last_visited_at"], visit.visited_at)
        existing["browser_sources"].add(visit.browser)
        if visit.title:
            existing["page_titles"].add(visit.title)

    warnings: list[str] = []
    if use_redmine_api and config["redmine_api_key"] and grouped:
        details, api_warnings = fetch_redmine_details(sorted(grouped), config)
        warnings.extend(api_warnings)
        for issue_id, detail in details.items():
            grouped[issue_id]["redmine"] = detail

    results = []
    for item in grouped.values():
        results.append(
            {
                "issue_id": item["issue_id"],
                "issue_url": item["issue_url"],
                "visit_count": item["visit_count"],
                "first_visited_at": item["first_visited_at"].isoformat(),
                "last_visited_at": item["last_visited_at"].isoformat(),
                "browser_sources": sorted(item["browser_sources"]),
                "page_titles": sorted(item["page_titles"]),
                "redmine": item["redmine"],
            }
        )

    results.sort(key=lambda item: item["last_visited_at"], reverse=True)
    return results, warnings


def collect_issues(day_label: str, config: dict[str, Any], use_redmine_api: bool = True) -> dict[str, Any]:
    target_day, start, end = resolve_day_range(day_label)
    all_visits: list[VisitRecord] = []
    warnings: list[str] = []
    checked_sources: list[dict[str, str]] = []

    for source in discover_browser_sources(config):
        checked_sources.append({"name": source.name, "path": str(source.path)})
        visits, source_warnings = load_visits_from_source(
            source=source,
            base_url=config["redmine_base_url"],
            start=start,
            end=end,
        )
        all_visits.extend(visits)
        warnings.extend(source_warnings)

    issues, summary_warnings = summarize_visits(
        visits=all_visits,
        config=config,
        use_redmine_api=use_redmine_api,
    )
    warnings.extend(summary_warnings)

    return {
        "day": day_label,
        "target_date": target_day.isoformat(),
        "range_start": start.isoformat(),
        "range_end": end.isoformat(),
        "issue_count": len(issues),
        "issues": issues,
        "diagnostics": {
            "redmine_api_enabled": bool(config["redmine_api_key"]) and use_redmine_api,
            "checked_sources": checked_sources,
            "warnings": warnings,
        },
    }


def powershell_single_quote(value: str) -> str:
    return value.replace("'", "''")


def build_curl_examples(
    issue_id: int,
    spent_on: str,
    base_url: str,
    hours: str = "1.0",
    activity_id: str = "9",
    comments: str = "補登工時",
) -> dict[str, str]:
    payload = json.dumps(
        {
            "time_entry": {
                "issue_id": issue_id,
                "spent_on": spent_on,
                "hours": float(hours),
                "activity_id": int(activity_id),
                "comments": comments,
            }
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    safe_payload = powershell_single_quote(payload)
    api_header = f'X-Redmine-API-Key: $env:{PRIMARY_API_KEY_ENV}'
    return {
        "get_issue": (
            f'curl.exe -H "{api_header}" '
            f'"{base_url}/issues/{issue_id}.json"'
        ),
        "get_time_entries": (
            f'curl.exe -H "{api_header}" '
            f'"{base_url}/time_entries.json?issue_id={issue_id}&user_id=me&spent_on={spent_on}"'
        ),
        "post_time_entry": (
            'curl.exe -X POST '
            '-H "Content-Type: application/json" '
            f'-H "{api_header}" '
            f"-d '{safe_payload}' "
            f'"{base_url}/time_entries.json"'
        ),
    }


def write_json_response(handler: SimpleHTTPRequestHandler, payload: Any, status: int = 200) -> None:
    body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def write_text_response(
    handler: SimpleHTTPRequestHandler,
    body: str,
    content_type: str = "text/plain; charset=utf-8",
    status: int = 200,
) -> None:
    payload = body.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def read_json_request(handler: SimpleHTTPRequestHandler) -> Any:
    try:
        content_length = int(handler.headers.get("Content-Length", "0"))
    except ValueError as exc:
        raise ValueError("Content-Length 無效。") from exc
    if content_length <= 0:
        raise ValueError("Request body 不可為空。")
    raw_body = handler.rfile.read(content_length)
    try:
        return json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError("Request body 必須是合法 JSON。") from exc


def issue_defaults_paths(config: dict[str, Any]) -> tuple[Path, Path]:
    shared_path = Path(str(config.get("issue_defaults_shared_path") or ISSUE_DEFAULTS_SHARED_PATH))
    local_path = Path(str(config.get("issue_defaults_local_path") or ISSUE_DEFAULTS_LOCAL_PATH))
    return shared_path, local_path


def issue_query_day_label(query: dict[str, list[str]]) -> str:
    date_value = str(query.get("date", [""])[0] or "").strip()
    if date_value:
        return date_value
    return query.get("day", ["today"])[0]


def parse_issue_ids_query(raw_value: str) -> list[int]:
    issue_ids: list[int] = []
    seen: set[int] = set()
    for part in raw_value.split(","):
        value = part.strip()
        if not value:
            continue
        try:
            issue_id = int(value)
        except ValueError as exc:
            raise ValueError("issue_ids 必須是逗號分隔的正整數。") from exc
        if issue_id <= 0:
            raise ValueError("issue_ids 必須是逗號分隔的正整數。")
        if issue_id not in seen:
            seen.add(issue_id)
            issue_ids.append(issue_id)
    return issue_ids


def build_issue_defaults_payload(issue_ids: list[int], config: dict[str, Any]) -> dict[str, Any]:
    shared_path, local_path = issue_defaults_paths(config)
    return {
        "defaults": issue_defaults_store.merged_defaults_for_issues(issue_ids, shared_path, local_path),
        "shared_path": str(shared_path),
        "local_path": str(local_path),
        "warnings": [],
    }


def update_issue_default(issue_id: int, body: Any, config: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(body, dict):
        raise ValueError("Request body 最外層必須是 object。")
    shared_path, local_path = issue_defaults_paths(config)
    issue_defaults_store.update_local_default(local_path, issue_id, body)
    merged = issue_defaults_store.merged_defaults_for_issues([issue_id], shared_path, local_path)
    return {
        "issue_id": issue_id,
        "default": merged[str(issue_id)],
        "local_path": str(local_path),
    }


def delete_issue_default(issue_id: int, config: dict[str, Any]) -> dict[str, Any]:
    shared_path, local_path = issue_defaults_paths(config)
    removed = issue_defaults_store.delete_local_default(local_path, issue_id)
    merged = issue_defaults_store.merged_defaults_for_issues([issue_id], shared_path, local_path)
    return {
        "issue_id": issue_id,
        "removed": removed,
        "default": merged[str(issue_id)],
        "local_path": str(local_path),
    }


def parse_issue_default_path(path: str) -> int | None:
    match = re.fullmatch(r"/api/issue-defaults/(\d+)", path)
    if match is None:
        return None
    return int(match.group(1))


class TrackerRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, config: dict[str, Any], **kwargs: Any) -> None:
        self.config = config
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        parsed = parse.urlparse(self.path)
        try:
            if parsed.path in {"/", "/index.html"}:
                write_text_response(self, worklog_ui.INDEX_HTML, "text/html; charset=utf-8")
                return

            if parsed.path == "/worklog-app.js":
                write_text_response(self, WORKLOG_APP_PATH.read_text(encoding="utf-8"), "text/javascript; charset=utf-8")
                return

            if parsed.path == "/api/issues":
                query = parse.parse_qs(parsed.query)
                day = issue_query_day_label(query)
                use_api = query.get("include_api", ["1"])[0] != "0"
                payload = collect_issues(day, self.config, use_redmine_api=use_api)
                write_json_response(self, payload)
                return

            if parsed.path == "/api/config":
                write_json_response(
                    self,
                    {
                        "redmine_base_url": self.config["redmine_base_url"],
                        "redmine_api_enabled": bool(self.config["redmine_api_key"]),
                        "time_entry_write_enabled": bool(self.config["redmine_api_key"]),
                        "preview_ttl_seconds": time_entry_api.PREVIEW_TTL_SECONDS,
                        "available_sources": [
                            {"name": source.name, "path": str(source.path)}
                            for source in discover_browser_sources(self.config)
                        ],
                    },
                )
                return

            if parsed.path == "/api/time-entry-activities":
                payload = time_entry_api.fetch_time_entry_activities(self.config)
                write_json_response(self, payload)
                return

            if parsed.path == "/api/issue-defaults":
                query = parse.parse_qs(parsed.query)
                issue_ids = parse_issue_ids_query(query.get("issue_ids", [""])[0])
                payload = build_issue_defaults_payload(issue_ids, self.config)
                write_json_response(self, payload)
                return

            if parsed.path == "/api/curl-examples":
                query = parse.parse_qs(parsed.query)
                raw_issue_id = query.get("issue_id", [None])[0]
                if raw_issue_id is None:
                    write_json_response(self, {"error": "issue_id is required"}, status=400)
                    return
                day = query.get("spent_on", [datetime.now(local_timezone()).date().isoformat()])[0]
                hours = query.get("hours", ["1.0"])[0]
                activity_id = query.get("activity_id", ["9"])[0]
                comments = query.get("comments", ["補登工時"])[0]
                payload = build_curl_examples(
                    issue_id=int(raw_issue_id),
                    spent_on=day,
                    base_url=self.config["redmine_base_url"],
                    hours=hours,
                    activity_id=activity_id,
                    comments=comments,
                )
                write_json_response(self, payload)
                return
        except time_entry_api.ApiError as exc:
            write_json_response(self, {"error": exc.message, **(exc.details or {})}, status=exc.status)
            return
        except ValueError as exc:
            write_json_response(self, {"error": str(exc)}, status=400)
            return

        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = parse.urlparse(self.path)
        try:
            body = read_json_request(self)
            if not isinstance(body, dict):
                raise ValueError("Request body 最外層必須是 object。")

            if parsed.path == "/api/time-entries/preview":
                payload = time_entry_api.preview_time_entries(body.get("spent_on"), body.get("entries"), self.config)
                write_json_response(self, payload)
                return

            if parsed.path == "/api/time-entries/commit":
                preview_token = str(body.get("preview_token") or "").strip()
                if not preview_token:
                    raise ValueError("preview_token is required")
                payload = time_entry_api.commit_time_entries(
                    preview_token,
                    body.get("spent_on"),
                    body.get("entries"),
                    self.config,
                )
                write_json_response(self, payload)
                return
        except time_entry_api.ApiError as exc:
            write_json_response(self, {"error": exc.message, **(exc.details or {})}, status=exc.status)
            return
        except ValueError as exc:
            write_json_response(self, {"error": str(exc)}, status=400)
            return

        write_json_response(self, {"error": "Not found"}, status=404)

    def do_PUT(self) -> None:  # noqa: N802
        parsed = parse.urlparse(self.path)
        issue_id = parse_issue_default_path(parsed.path)
        if issue_id is None:
            write_json_response(self, {"error": "Not found"}, status=404)
            return
        try:
            body = read_json_request(self)
            payload = update_issue_default(issue_id, body, self.config)
            write_json_response(self, payload)
        except ValueError as exc:
            write_json_response(self, {"error": str(exc)}, status=400)

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = parse.urlparse(self.path)
        issue_id = parse_issue_default_path(parsed.path)
        if issue_id is None:
            write_json_response(self, {"error": "Not found"}, status=404)
            return
        try:
            payload = delete_issue_default(issue_id, self.config)
            write_json_response(self, payload)
        except ValueError as exc:
            write_json_response(self, {"error": str(exc)}, status=400)

    def log_message(self, format: str, *args: Any) -> None:
        message = "%s - - [%s] %s" % (self.address_string(), self.log_date_time_string(), format % args)
        print(message)


def print_issue_table(payload: dict[str, Any]) -> None:
    print(f"日期: {payload['target_date']}  共 {payload['issue_count']} 筆")
    warnings = payload["diagnostics"]["warnings"]
    if warnings:
        print("警告:")
        for item in warnings:
            print(f"  - {item}")
    if not payload["issues"]:
        print("沒有找到 issue 瀏覽紀錄。")
        return
    print("-" * 100)
    for issue in payload["issues"]:
        details = issue["redmine"] or {}
        subject = details.get("subject") or (issue["page_titles"][0] if issue["page_titles"] else "")
        status = details.get("status") or "-"
        last_visit = datetime.fromisoformat(issue["last_visited_at"]).strftime("%H:%M")
        browsers = ",".join(issue["browser_sources"])
        print(
            f"#{issue['issue_id']:<8} {last_visit:<5} {issue['visit_count']:<3}次 "
            f"{browsers:<24} {status:<12} {subject}"
        )


def command_issues(args: argparse.Namespace) -> int:
    config = load_config()
    payload = collect_issues(args.day, config, use_redmine_api=not args.no_api)
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print_issue_table(payload)
    return 0


def command_curl_examples(args: argparse.Namespace) -> int:
    config = load_config()
    target_day = args.spent_on or datetime.now(local_timezone()).date().isoformat()
    commands = build_curl_examples(
        issue_id=args.issue_id,
        spent_on=target_day,
        base_url=config["redmine_base_url"],
        hours=args.hours,
        activity_id=args.activity_id,
        comments=args.comments,
    )
    for label, command in commands.items():
        print(f"[{label}]")
        print(command)
        print()
    return 0


def command_serve(args: argparse.Namespace) -> int:
    config = load_config()
    WEB_DIR.mkdir(exist_ok=True)
    handler = partial(TrackerRequestHandler, config=config)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Tracker UI: http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
    finally:
        server.server_close()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Easy Redmine issue history tracker")
    subparsers = parser.add_subparsers(dest="command", required=True)

    issues_parser = subparsers.add_parser("issues", help="列出今天或昨天看過的 issue")
    issues_parser.add_argument("--day", default="today", help="today, yesterday, 或 YYYY-MM-DD")
    issues_parser.add_argument("--json", action="store_true", help="輸出 JSON")
    issues_parser.add_argument("--no-api", action="store_true", help="不要呼叫 Redmine API")
    issues_parser.set_defaults(func=command_issues)

    curl_parser = subparsers.add_parser("curl-examples", help="輸出 Redmine curl 範例")
    curl_parser.add_argument("--issue-id", type=int, required=True, help="Issue ID")
    curl_parser.add_argument("--spent-on", help="工時日期，預設今天")
    curl_parser.add_argument("--hours", default="1.0", help="工時時數")
    curl_parser.add_argument("--activity-id", default="9", help="工時活動 ID")
    curl_parser.add_argument("--comments", default="補登工時", help="工時備註")
    curl_parser.set_defaults(func=command_curl_examples)

    serve_parser = subparsers.add_parser("serve", help="啟動本機 UI")
    serve_parser.add_argument("--host", default="127.0.0.1", help="綁定主機")
    serve_parser.add_argument("--port", type=int, default=8765, help="綁定埠號")
    serve_parser.set_defaults(func=command_serve)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
