from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib import parse

import phrases_store
import saved_queries_store
import time_entry_api
import worklog_ui


APP_DIR = Path(__file__).resolve().parent
WEB_DIR = APP_DIR / "web"
CONFIG_PATH = APP_DIR / "config.local.json"
WORKLOG_APP_PATH = APP_DIR / "worklog_app.js"
PHRASES_PATH = APP_DIR / "phrases.local.json"
SAVED_QUERIES_PATH = APP_DIR / "saved_queries.local.json"
PRIMARY_API_KEY_ENV = "LAWPJ_API_KEY"
LEGACY_API_KEY_ENV = "REDMINE_API_KEY"


def default_base_url() -> str:
    return "https://lawpj.lawbroker.com.tw"


def load_config() -> dict[str, Any]:
    config: dict[str, Any] = {
        "redmine_base_url": default_base_url(),
        "redmine_api_key": "",
        "phrases_path": PHRASES_PATH,
        "saved_queries_path": SAVED_QUERIES_PATH,
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

    config["redmine_base_url"] = str(config["redmine_base_url"]).rstrip("/")
    config["redmine_api_key"] = str(config.get("redmine_api_key") or "").strip()
    config["phrases_path"] = Path(str(config.get("phrases_path") or PHRASES_PATH))
    config["saved_queries_path"] = Path(str(config.get("saved_queries_path") or SAVED_QUERIES_PATH))
    return config


def local_timezone() -> timezone:
    tzinfo = datetime.now().astimezone().tzinfo
    if tzinfo is None:
        return timezone.utc
    return tzinfo


def resolve_day_label(day_label: str, now: datetime | None = None) -> date:
    tzinfo = local_timezone()
    current = now.astimezone(tzinfo) if now else datetime.now(tzinfo)
    normalized = (day_label or "").strip()
    if not normalized or normalized == "today":
        return current.date()
    if normalized == "yesterday":
        return (current - timedelta(days=1)).date()
    return date.fromisoformat(normalized)


def collect_mine_issues(day_label: str | None, config: dict[str, Any]) -> dict[str, Any]:
    target_date: date | None = None
    params: dict[str, Any] = {
        "assigned_to_id": "me",
        "sort": "updated_on:desc",
        "limit": "100",
    }
    if day_label:
        target_date = resolve_day_label(day_label)
        params["updated_on"] = f"><{target_date.isoformat()}|{target_date.isoformat()}"
        params["status_id"] = "*"
    else:
        params["status_id"] = "open"
    issues, warnings = time_entry_api.fetch_issue_list(params, config)
    return {
        "source": "mine",
        "target_date": target_date.isoformat() if target_date else None,
        "issue_count": len(issues),
        "issues": issues,
        "warnings": warnings,
    }


def collect_query_issues(
    query_id: int,
    day_label: str | None,
    config: dict[str, Any],
) -> dict[str, Any]:
    params: dict[str, Any] = {
        "query_id": query_id,
        "limit": "100",
    }
    target_date: date | None = None
    if day_label:
        target_date = resolve_day_label(day_label)
        params["updated_on"] = f"><{target_date.isoformat()}|{target_date.isoformat()}"
    issues, warnings = time_entry_api.fetch_issue_list(params, config)
    return {
        "source": "query",
        "query_id": query_id,
        "target_date": target_date.isoformat() if target_date else None,
        "issue_count": len(issues),
        "issues": issues,
        "warnings": warnings,
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


def parse_issues_query(query: dict[str, list[str]], config: dict[str, Any]) -> dict[str, Any]:
    source = (query.get("source", ["mine"])[0] or "mine").strip()
    date_value = (query.get("date", [""])[0] or "").strip() or None
    if source == "mine":
        return collect_mine_issues(date_value, config)
    if source == "query":
        raw_qid = query.get("query_id", [""])[0]
        try:
            query_id = int(raw_qid)
        except (TypeError, ValueError) as exc:
            raise ValueError("source=query 必須提供 query_id。") from exc
        if query_id <= 0:
            raise ValueError("query_id 必須是正整數。")
        return collect_query_issues(query_id, date_value, config)
    raise ValueError("source 必須是 mine 或 query。")


class TrackerRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, config: dict[str, Any], **kwargs: Any) -> None:
        self.config = config
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        parsed = parse.urlparse(self.path)
        try:
            path = parsed.path
            query = parse.parse_qs(parsed.query)

            if path in {"/", "/index.html"}:
                write_text_response(self, worklog_ui.INDEX_HTML, "text/html; charset=utf-8")
                return

            if path == "/worklog-app.js":
                write_text_response(
                    self,
                    WORKLOG_APP_PATH.read_text(encoding="utf-8"),
                    "text/javascript; charset=utf-8",
                )
                return

            if path == "/api/config":
                write_json_response(
                    self,
                    {
                        "redmine_base_url": self.config["redmine_base_url"],
                        "redmine_api_enabled": bool(self.config["redmine_api_key"]),
                        "time_entry_write_enabled": bool(self.config["redmine_api_key"]),
                        "preview_ttl_seconds": time_entry_api.PREVIEW_TTL_SECONDS,
                    },
                )
                return

            if path == "/api/time-entry-activities":
                write_json_response(self, time_entry_api.fetch_time_entry_activities(self.config))
                return

            if path == "/api/issues":
                write_json_response(self, parse_issues_query(query, self.config))
                return

            if path == "/api/saved-queries":
                write_json_response(
                    self,
                    {"queries": saved_queries_store.list_queries(self.config["saved_queries_path"])},
                )
                return

            if path == "/api/phrases":
                write_json_response(
                    self,
                    {"phrases": phrases_store.list_phrases(self.config["phrases_path"])},
                )
                return

            if path == "/api/curl-examples":
                raw_issue_id = query.get("issue_id", [None])[0]
                if raw_issue_id is None:
                    write_json_response(self, {"error": "issue_id is required"}, status=400)
                    return
                day = query.get("spent_on", [datetime.now(local_timezone()).date().isoformat()])[0]
                payload = build_curl_examples(
                    issue_id=int(raw_issue_id),
                    spent_on=day,
                    base_url=self.config["redmine_base_url"],
                    hours=query.get("hours", ["1.0"])[0],
                    activity_id=query.get("activity_id", ["9"])[0],
                    comments=query.get("comments", ["補登工時"])[0],
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
                payload = time_entry_api.preview_time_entries(
                    body.get("spent_on"), body.get("entries"), self.config
                )
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

            if parsed.path == "/api/schedule/apply-dates":
                payload = time_entry_api.apply_schedule_dates(body.get("entries"), self.config)
                write_json_response(self, payload)
                return

            if parsed.path == "/api/saved-queries":
                query = saved_queries_store.add_query(self.config["saved_queries_path"], body)
                write_json_response(self, {"query": query}, status=201)
                return

            if parsed.path == "/api/phrases":
                phrase = phrases_store.add_phrase(self.config["phrases_path"], body)
                write_json_response(self, {"phrase": phrase}, status=201)
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
        try:
            match = re.fullmatch(r"/api/phrases/([^/]+)", parsed.path)
            if match:
                body = read_json_request(self)
                phrase = phrases_store.update_phrase(
                    self.config["phrases_path"], match.group(1), body
                )
                write_json_response(self, {"phrase": phrase})
                return
        except ValueError as exc:
            write_json_response(self, {"error": str(exc)}, status=400)
            return
        write_json_response(self, {"error": "Not found"}, status=404)

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = parse.urlparse(self.path)
        try:
            match_query = re.fullmatch(r"/api/saved-queries/(\d+)", parsed.path)
            if match_query:
                removed = saved_queries_store.remove_query(
                    self.config["saved_queries_path"], match_query.group(1)
                )
                write_json_response(self, {"removed": removed})
                return
            match_phrase = re.fullmatch(r"/api/phrases/([^/]+)", parsed.path)
            if match_phrase:
                removed = phrases_store.delete_phrase(
                    self.config["phrases_path"], match_phrase.group(1)
                )
                write_json_response(self, {"removed": removed})
                return
        except ValueError as exc:
            write_json_response(self, {"error": str(exc)}, status=400)
            return
        write_json_response(self, {"error": "Not found"}, status=404)

    def log_message(self, format: str, *args: Any) -> None:
        message = "%s - - [%s] %s" % (self.address_string(), self.log_date_time_string(), format % args)
        print(message)


def print_issue_table(payload: dict[str, Any]) -> None:
    header = f"來源: {payload['source']}  共 {payload['issue_count']} 筆"
    if payload.get("target_date"):
        header += f"  (日期: {payload['target_date']})"
    if payload.get("query_id"):
        header += f"  (query_id: {payload['query_id']})"
    print(header)
    warnings = payload.get("warnings") or []
    if warnings:
        print("警告:")
        for item in warnings:
            print(f"  - {item}")
    if not payload["issues"]:
        print("沒有找到符合條件的 issue。")
        return
    print("-" * 110)
    for issue in payload["issues"]:
        subject = issue.get("subject") or f"Issue #{issue['issue_id']}"
        status = issue.get("status") or "-"
        project = issue.get("project") or "-"
        updated = (issue.get("updated_on") or "")[:10]
        print(f"#{issue['issue_id']:<8} {updated:<10} {status:<12} {project:<18} {subject}")


def command_issues(args: argparse.Namespace) -> int:
    config = load_config()
    if args.query_id:
        payload = collect_query_issues(args.query_id, args.day, config)
    else:
        payload = collect_mine_issues(args.day, config)
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
    parser = argparse.ArgumentParser(description="Easy Redmine worklog helper")
    subparsers = parser.add_subparsers(dest="command", required=True)

    issues_parser = subparsers.add_parser("issues", help="列出 issue（預設為我身上進行中的 issue）")
    issues_parser.add_argument("--day", default=None, help="today, yesterday 或 YYYY-MM-DD")
    issues_parser.add_argument("--query-id", type=int, default=None, help="用 Redmine 自訂 Query ID 查詢")
    issues_parser.add_argument("--json", action="store_true", help="輸出 JSON")
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
