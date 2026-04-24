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
import phrases_store
import saved_queries_store
import time_entry_api

warnings.filterwarnings("ignore", category=ResourceWarning)


class WorklogSelfTests(unittest.TestCase):
    def setUp(self) -> None:
        time_entry_api.PREVIEW_STORE.clear()
        runtime_dir = Path(__file__).resolve().parent / ".runtime" / "selftests"
        runtime_dir.mkdir(parents=True, exist_ok=True)
        self.tempdir = runtime_dir / f"case_{os.getpid()}_{uuid4().hex}"
        self.tempdir.mkdir(parents=True, exist_ok=False)
        self.phrases_path = self.tempdir / "phrases.local.json"
        self.saved_queries_path = self.tempdir / "saved_queries.local.json"
        self.config = {
            "redmine_base_url": "https://example.test",
            "redmine_api_key": "demo-key",
            "phrases_path": self.phrases_path,
            "saved_queries_path": self.saved_queries_path,
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
            {"issue_id": 101, "hours": "1.5", "activity_id": "9", "comments": "A", "selected": True},
            {"issue_id": 102, "hours": "0.5", "activity_id": "9", "comments": "B", "selected": True},
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

    def test_apply_schedule_dates_puts_per_issue(self) -> None:
        put_calls: list[tuple[str, dict[str, object]]] = []

        def fake_request(url: str, config: dict[str, object], method: str = "GET", payload=None):
            if method == "PUT" and "/issues/" in url:
                put_calls.append((url, payload))
                return {}
            raise AssertionError((method, url))

        original = time_entry_api.redmine_request_json
        time_entry_api.redmine_request_json = fake_request
        try:
            result = time_entry_api.apply_schedule_dates(
                [
                    {"issue_id": 101, "start_date": "2026-04-21", "due_date": "2026-04-22"},
                    {"issue_id": 202, "start_date": "2026-04-23", "due_date": "2026-04-25"},
                ],
                self.config,
            )
        finally:
            time_entry_api.redmine_request_json = original

        self.assertEqual(len(put_calls), 2)
        self.assertIn("/issues/101.json", put_calls[0][0])
        self.assertEqual(put_calls[0][1]["issue"]["start_date"], "2026-04-21")
        self.assertEqual(put_calls[0][1]["issue"]["due_date"], "2026-04-22")
        self.assertTrue(all(r.get("ok") for r in result["results"]))

    def test_apply_schedule_dates_rejects_invalid_range(self) -> None:
        result = time_entry_api.apply_schedule_dates(
            [{"issue_id": 101, "start_date": "2026-04-25", "due_date": "2026-04-20"}],
            self.config,
        )
        self.assertEqual(result["results"][0]["error"], "起始日不得晚於結束日。")

    def test_issues_endpoint_delegates_to_mine_source(self) -> None:
        captured_params: list[dict[str, object]] = []

        def fake_fetch(params, config, max_results=100):
            captured_params.append(dict(params))
            return [{"issue_id": 101, "subject": "Sample", "issue_url": "https://example.test/issues/101"}], []

        original = time_entry_api.fetch_issue_list
        time_entry_api.fetch_issue_list = fake_fetch
        server, thread, port = self.start_server()
        try:
            with urlrequest.urlopen(
                f"http://127.0.0.1:{port}/api/issues?source=mine",
                timeout=5,
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
        finally:
            time_entry_api.fetch_issue_list = original
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

        self.assertEqual(payload["source"], "mine")
        self.assertEqual(payload["issue_count"], 1)
        self.assertEqual(captured_params[0]["assigned_to_id"], "me")
        self.assertEqual(captured_params[0]["status_id"], "open")

    def test_ui_homepage_contains_source_tabs_and_drawers(self) -> None:
        server, thread, port = self.start_server()
        try:
            with urlrequest.urlopen(f"http://127.0.0.1:{port}/", timeout=5) as response:
                html = response.read().decode("utf-8")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

        self.assertIn('id="source-tabs"', html)
        self.assertIn('id="settings-modal"', html)
        self.assertIn('id="phrases-list"', html)
        self.assertIn('id="saved-queries-list"', html)
        self.assertIn('id="filter-date"', html)
        self.assertIn('id="filter-search"', html)
        self.assertIn('id="loading-mask"', html)
        self.assertNotIn('id="project-picker"', html)

    def test_phrase_endpoints_crud(self) -> None:
        server, thread, port = self.start_server()
        try:
            create_body = json.dumps(
                {
                    "label": "daily",
                    "hours": "1.0",
                    "activity_id": 9,
                    "comments": "daily maintenance",
                }
            ).encode("utf-8")
            req = urlrequest.Request(
                f"http://127.0.0.1:{port}/api/phrases",
                data=create_body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlrequest.urlopen(req, timeout=5) as response:
                created = json.loads(response.read().decode("utf-8"))
            phrase_id = created["phrase"]["id"]

            with urlrequest.urlopen(f"http://127.0.0.1:{port}/api/phrases", timeout=5) as response:
                listed = json.loads(response.read().decode("utf-8"))

            update_body = json.dumps(
                {"label": "updated", "hours": "", "activity_id": "", "comments": "only comment"}
            ).encode("utf-8")
            req = urlrequest.Request(
                f"http://127.0.0.1:{port}/api/phrases/{phrase_id}",
                data=update_body,
                headers={"Content-Type": "application/json"},
                method="PUT",
            )
            with urlrequest.urlopen(req, timeout=5) as response:
                updated = json.loads(response.read().decode("utf-8"))

            req = urlrequest.Request(
                f"http://127.0.0.1:{port}/api/phrases/{phrase_id}",
                method="DELETE",
            )
            with urlrequest.urlopen(req, timeout=5) as response:
                deleted = json.loads(response.read().decode("utf-8"))
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

        self.assertEqual(created["phrase"]["hours"], "1")
        self.assertEqual(created["phrase"]["activity_id"], 9)
        self.assertEqual(created["phrase"]["comments"], "daily maintenance")
        self.assertEqual(len(listed["phrases"]), 1)
        self.assertEqual(updated["phrase"]["comments"], "only comment")
        self.assertEqual(updated["phrase"]["hours"], "")
        self.assertEqual(updated["phrase"]["activity_id"], "")
        self.assertTrue(deleted["removed"])
        self.assertEqual(phrases_store.list_phrases(self.phrases_path), [])

    def test_phrase_rejects_all_empty_payload(self) -> None:
        server, thread, port = self.start_server()
        try:
            body = json.dumps({"label": "空的"}).encode("utf-8")
            req = urlrequest.Request(
                f"http://127.0.0.1:{port}/api/phrases",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with self.assertRaises(urlerror.HTTPError) as context:
                urlrequest.urlopen(req, timeout=5)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)
        self.assertEqual(context.exception.code, 400)

    def test_saved_queries_endpoints_crud(self) -> None:
        server, thread, port = self.start_server()
        try:
            create_body = json.dumps({"name": "我的任務分組", "query_id": 762}).encode("utf-8")
            req = urlrequest.Request(
                f"http://127.0.0.1:{port}/api/saved-queries",
                data=create_body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlrequest.urlopen(req, timeout=5) as response:
                created = json.loads(response.read().decode("utf-8"))

            with urlrequest.urlopen(f"http://127.0.0.1:{port}/api/saved-queries", timeout=5) as response:
                listed = json.loads(response.read().decode("utf-8"))

            req = urlrequest.Request(
                f"http://127.0.0.1:{port}/api/saved-queries/762",
                method="DELETE",
            )
            with urlrequest.urlopen(req, timeout=5) as response:
                deleted = json.loads(response.read().decode("utf-8"))
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

        self.assertEqual(created["query"]["query_id"], 762)
        self.assertEqual(len(listed["queries"]), 1)
        self.assertTrue(deleted["removed"])
        self.assertEqual(saved_queries_store.list_queries(self.saved_queries_path), [])

    def test_issues_endpoint_query_source_passes_query_id(self) -> None:
        captured_params: list[dict[str, object]] = []

        def fake_fetch(params, config, max_results=100):
            captured_params.append(dict(params))
            return [], []

        original = time_entry_api.fetch_issue_list
        time_entry_api.fetch_issue_list = fake_fetch
        server, thread, port = self.start_server()
        try:
            with urlrequest.urlopen(
                f"http://127.0.0.1:{port}/api/issues?source=query&query_id=762",
                timeout=5,
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
        finally:
            time_entry_api.fetch_issue_list = original
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

        self.assertEqual(payload["source"], "query")
        self.assertEqual(payload["query_id"], 762)
        self.assertEqual(captured_params[0]["query_id"], 762)


if __name__ == "__main__":
    unittest.main(verbosity=2)
