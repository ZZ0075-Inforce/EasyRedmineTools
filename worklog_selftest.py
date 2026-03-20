import io
import json
import os
import shutil
import threading
import unittest
import warnings
from functools import partial
from pathlib import Path
from uuid import uuid4
from urllib import error as urlerror
from urllib import request as urlrequest

import issue_tracker
import time_entry_api

warnings.filterwarnings("ignore", category=ResourceWarning)


class WorklogSelfTests(unittest.TestCase):
    def setUp(self) -> None:
        time_entry_api.PREVIEW_STORE.clear()
        runtime_dir = Path(__file__).resolve().parent / ".runtime" / "selftests"
        runtime_dir.mkdir(parents=True, exist_ok=True)
        self.tempdir = runtime_dir / f"case_{os.getpid()}_{uuid4().hex}"
        self.tempdir.mkdir(parents=True, exist_ok=False)
        self.shared_path = self.tempdir / "issue_defaults.json"
        self.local_path = self.tempdir / "issue_defaults.local.json"
        self.shared_path.write_text('{"issues":{}}', encoding="utf-8")
        self.config = {
            "redmine_base_url": "https://example.test",
            "redmine_api_key": "demo-key",
            "issue_defaults_shared_path": self.shared_path,
            "issue_defaults_local_path": self.local_path,
        }

    def tearDown(self) -> None:
        shutil.rmtree(self.tempdir, ignore_errors=True)

    def sample_entries(self) -> list[dict[str, object]]:
        return [
            {
                "issue_id": 101,
                "hours": "1.5",
                "activity_id": "9",
                "comments": "補登工時",
                "selected": True,
            }
        ]

    def start_server(self) -> tuple[issue_tracker.ThreadingHTTPServer, threading.Thread, int]:
        handler = partial(issue_tracker.TrackerRequestHandler, config=self.config)
        server = issue_tracker.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        return server, thread, port

    def test_fetch_time_entry_activities_falls_back_to_manual_mode(self) -> None:
        def fake_request(url: str, config: dict[str, object], method: str = "GET", payload=None):
            raise urlerror.HTTPError(url, 404, "Not Found", hdrs=None, fp=io.BytesIO())

        original = time_entry_api.redmine_request_json
        time_entry_api.redmine_request_json = fake_request
        try:
            payload = time_entry_api.fetch_time_entry_activities(self.config)
        finally:
            time_entry_api.redmine_request_json = original

        self.assertTrue(payload["manual_entry"])
        self.assertEqual(payload["activities"], [])
        self.assertTrue(payload["warnings"])

    def test_preview_only_uses_get_requests(self) -> None:
        calls: list[tuple[str, str]] = []

        def fake_request(url: str, config: dict[str, object], method: str = "GET", payload=None):
            calls.append((method, url))
            if url.endswith("/issues/101.json"):
                return {"issue": {"subject": "Issue 101"}}
            if "time_entries.json?" in url:
                return {"time_entries": []}
            raise AssertionError(url)

        original = time_entry_api.redmine_request_json
        time_entry_api.redmine_request_json = fake_request
        try:
            payload = time_entry_api.preview_time_entries("2026-03-20", self.sample_entries(), self.config)
        finally:
            time_entry_api.redmine_request_json = original

        self.assertTrue(payload["preview_token"])
        self.assertFalse(any(method == "POST" for method, _ in calls))

    def test_preview_marks_duplicates_unselected(self) -> None:
        def fake_request(url: str, config: dict[str, object], method: str = "GET", payload=None):
            if url.endswith("/issues/101.json"):
                return {"issue": {"subject": "Issue 101"}}
            if "time_entries.json?" in url:
                return {
                    "time_entries": [
                        {
                            "id": 3001,
                            "spent_on": "2026-03-20",
                            "hours": 1.0,
                            "comments": "already logged",
                            "activity": {"name": "開發"},
                        }
                    ]
                }
            raise AssertionError(url)

        original = time_entry_api.redmine_request_json
        time_entry_api.redmine_request_json = fake_request
        try:
            payload = time_entry_api.preview_time_entries("2026-03-20", self.sample_entries(), self.config)
        finally:
            time_entry_api.redmine_request_json = original

        row = payload["entries"][0]
        self.assertTrue(row["duplicate"])
        self.assertFalse(row["selected"])
        self.assertEqual(len(row["duplicate_entries"]), 1)

    def test_commit_rejects_changed_top_level_date(self) -> None:
        def fake_request(url: str, config: dict[str, object], method: str = "GET", payload=None):
            if url.endswith("/issues/101.json"):
                return {"issue": {"subject": "Issue 101"}}
            if "time_entries.json?" in url:
                return {"time_entries": []}
            raise AssertionError(url)

        original = time_entry_api.redmine_request_json
        time_entry_api.redmine_request_json = fake_request
        try:
            preview = time_entry_api.preview_time_entries("2026-03-20", self.sample_entries(), self.config)
            with self.assertRaises(time_entry_api.ApiError) as context:
                time_entry_api.commit_time_entries(
                    preview["preview_token"],
                    "2026-03-21",
                    preview["entries"],
                    self.config,
                )
        finally:
            time_entry_api.redmine_request_json = original

        self.assertEqual(context.exception.status, 400)

    def test_commit_posts_only_selected_entries(self) -> None:
        entries = [
            {
                "issue_id": 101,
                "hours": "1.5",
                "activity_id": "9",
                "comments": "A",
                "selected": True,
            },
            {
                "issue_id": 102,
                "hours": "0.5",
                "activity_id": "9",
                "comments": "B",
                "selected": True,
            },
        ]
        calls: list[tuple[str, str]] = []

        def fake_request(url: str, config: dict[str, object], method: str = "GET", payload=None):
            calls.append((method, url))
            if url.endswith("/issues/101.json"):
                return {"issue": {"subject": "Issue 101"}}
            if url.endswith("/issues/102.json"):
                return {"issue": {"subject": "Issue 102"}}
            if "time_entries.json?" in url:
                return {"time_entries": []}
            if url.endswith("/time_entries.json") and method == "POST":
                issue_id = payload["time_entry"]["issue_id"]
                return {"time_entry": {"id": 9000 + issue_id}}
            raise AssertionError((method, url))

        original = time_entry_api.redmine_request_json
        time_entry_api.redmine_request_json = fake_request
        try:
            preview = time_entry_api.preview_time_entries("2026-03-20", entries, self.config)
            preview_entries = preview["entries"]
            preview_entries[1]["selected"] = False
            result = time_entry_api.commit_time_entries(
                preview["preview_token"],
                "2026-03-20",
                preview_entries,
                self.config,
            )
        finally:
            time_entry_api.redmine_request_json = original

        self.assertEqual(len([call for call in calls if call[0] == "POST"]), 1)
        self.assertEqual(result["results"][0]["created_time_entry_id"], 9101)
        self.assertTrue(result["results"][1]["skipped"])

    def test_http_preview_endpoint_uses_new_request_shape(self) -> None:
        def fake_request(url: str, config: dict[str, object], method: str = "GET", payload=None):
            if url.endswith("/issues/101.json"):
                return {"issue": {"subject": "Issue 101"}}
            if "time_entries.json?" in url:
                return {"time_entries": []}
            raise AssertionError((method, url))

        original = time_entry_api.redmine_request_json
        time_entry_api.redmine_request_json = fake_request
        server, thread, port = self.start_server()
        try:
            request_body = json.dumps({"spent_on": "2026-03-20", "entries": self.sample_entries()}).encode("utf-8")
            req = urlrequest.Request(
                f"http://127.0.0.1:{port}/api/time-entries/preview",
                data=request_body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlrequest.urlopen(req, timeout=5) as response:
                payload = json.loads(response.read().decode("utf-8"))
        finally:
            time_entry_api.redmine_request_json = original
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

        self.assertTrue(payload["preview_token"])
        self.assertEqual(payload["spent_on"], "2026-03-20")
        self.assertEqual(payload["entries"][0]["issue_subject"], "Issue 101")

    def test_http_issues_endpoint_prefers_date_query(self) -> None:
        calls: list[str] = []

        def fake_collect(day_label: str, config: dict[str, object], use_redmine_api: bool = True):
            calls.append(day_label)
            return {
                "day": day_label,
                "target_date": day_label,
                "range_start": f"{day_label}T00:00:00+08:00",
                "range_end": f"{day_label}T23:59:59+08:00",
                "issue_count": 0,
                "issues": [],
                "diagnostics": {"redmine_api_enabled": use_redmine_api, "checked_sources": [], "warnings": []},
            }

        original = issue_tracker.collect_issues
        issue_tracker.collect_issues = fake_collect
        server, thread, port = self.start_server()
        try:
            with urlrequest.urlopen(
                f"http://127.0.0.1:{port}/api/issues?day=today&date=2026-03-20",
                timeout=5,
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
        finally:
            issue_tracker.collect_issues = original
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

        self.assertEqual(calls, ["2026-03-20"])
        self.assertEqual(payload["target_date"], "2026-03-20")

    def test_ui_homepage_contains_date_navigation_and_loading_mask(self) -> None:
        server, thread, port = self.start_server()
        try:
            with urlrequest.urlopen(f"http://127.0.0.1:{port}/", timeout=5) as response:
                html = response.read().decode("utf-8")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

        self.assertIn('id="source-date-input"', html)
        self.assertIn('id="source-prev-button"', html)
        self.assertIn('id="source-next-button"', html)
        self.assertIn('id="loading-mask"', html)
        self.assertIn('id="loading-message"', html)

    def test_issue_defaults_endpoints_only_touch_local_file(self) -> None:
        self.shared_path.write_text(
            json.dumps(
                {
                    "issues": {
                        "101": {"hours": "1.0", "activity_id": 9, "comments": "shared"},
                    }
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        server, thread, port = self.start_server()
        try:
            with urlrequest.urlopen(f"http://127.0.0.1:{port}/api/issue-defaults?issue_ids=101", timeout=5) as response:
                initial_payload = json.loads(response.read().decode("utf-8"))

            put_body = json.dumps({"hours": "2.5", "activity_id": 11, "comments": "local"}).encode("utf-8")
            put_request = urlrequest.Request(
                f"http://127.0.0.1:{port}/api/issue-defaults/101",
                data=put_body,
                headers={"Content-Type": "application/json"},
                method="PUT",
            )
            with urlrequest.urlopen(put_request, timeout=5) as response:
                put_payload = json.loads(response.read().decode("utf-8"))

            delete_request = urlrequest.Request(
                f"http://127.0.0.1:{port}/api/issue-defaults/101",
                method="DELETE",
            )
            with urlrequest.urlopen(delete_request, timeout=5) as response:
                delete_payload = json.loads(response.read().decode("utf-8"))
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

        self.assertEqual(initial_payload["defaults"]["101"]["source"], "shared")
        self.assertEqual(put_payload["default"]["source"], "local override")
        self.assertEqual(delete_payload["default"]["source"], "shared")
        shared_document = json.loads(self.shared_path.read_text(encoding="utf-8"))
        self.assertEqual(shared_document["issues"]["101"]["comments"], "shared")
        local_document = json.loads(self.local_path.read_text(encoding="utf-8"))
        self.assertEqual(local_document["issues"], {})


if __name__ == "__main__":
    unittest.main(verbosity=2)
