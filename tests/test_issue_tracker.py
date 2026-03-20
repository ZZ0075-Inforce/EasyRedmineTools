import unittest
from datetime import datetime, timedelta, timezone

import issue_tracker


class IssueTrackerTests(unittest.TestCase):
    def test_parse_issue_id_accepts_redmine_issue_urls(self) -> None:
        base_url = "https://lawpj.lawbroker.com.tw"
        self.assertEqual(
            issue_tracker.parse_issue_id("https://lawpj.lawbroker.com.tw/issues/195451", base_url),
            195451,
        )
        self.assertEqual(
            issue_tracker.parse_issue_id("https://lawpj.lawbroker.com.tw/issues/195451?tab=history", base_url),
            195451,
        )
        self.assertIsNone(
            issue_tracker.parse_issue_id("https://lawpj.lawbroker.com.tw/projects/demo", base_url)
        )
        self.assertIsNone(
            issue_tracker.parse_issue_id("https://example.com/issues/195451", base_url)
        )

    def test_resolve_day_range_supports_relative_labels(self) -> None:
        now = datetime(2026, 3, 20, 15, 0, tzinfo=timezone.utc)
        target_day, start, end = issue_tracker.resolve_day_range("yesterday", now=now)
        self.assertEqual(target_day.isoformat(), "2026-03-19")
        self.assertEqual(end - start, timedelta(days=1))

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


if __name__ == "__main__":
    unittest.main()
