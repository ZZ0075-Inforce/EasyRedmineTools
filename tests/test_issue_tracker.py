import unittest
from datetime import datetime, timezone

import issue_tracker


class IssueTrackerTests(unittest.TestCase):
    def test_resolve_day_label_supports_relative_labels(self) -> None:
        now = datetime(2026, 3, 20, 15, 0, tzinfo=timezone.utc)
        self.assertEqual(issue_tracker.resolve_day_label("yesterday", now=now).isoformat(), "2026-03-19")
        self.assertEqual(issue_tracker.resolve_day_label("today", now=now).isoformat(), "2026-03-20")
        self.assertEqual(issue_tracker.resolve_day_label("2026-04-01", now=now).isoformat(), "2026-04-01")

    def test_build_curl_examples_uses_issue_and_date(self) -> None:
        examples = issue_tracker.build_curl_examples(
            issue_id=123,
            spent_on="2026-03-20",
            base_url="https://lawpj.lawbroker.com.tw",
            hours="1.5",
            activity_id="9",
            comments="補登工時",
        )
        self.assertIn("/issues/123.json", examples["get_issue"])
        self.assertIn("spent_on=2026-03-20", examples["get_time_entries"])
        self.assertIn("\"issue_id\":123", examples["post_time_entry"])
        self.assertIn("\"hours\":1.5", examples["post_time_entry"])

    def test_parse_issues_query_requires_query_id_for_query_source(self) -> None:
        with self.assertRaises(ValueError):
            issue_tracker.parse_issues_query({"source": ["query"]}, {"redmine_base_url": "https://x", "redmine_api_key": ""})

    def test_parse_issues_query_rejects_unknown_source(self) -> None:
        with self.assertRaises(ValueError):
            issue_tracker.parse_issues_query({"source": ["project"]}, {"redmine_base_url": "https://x", "redmine_api_key": ""})


if __name__ == "__main__":
    unittest.main()
