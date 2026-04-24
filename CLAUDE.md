# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LawPJ 是一個針對 Easy Redmine (ER 2019 / Redmine 4.0.3) 的工時登記輔助工具，提供本地 HTTP 伺服器與 Web UI，讓用戶查詢自己名下的 issue 並批次提交工時。

## Commands

### Run the server
```bash
python issue_tracker.py serve [--host 127.0.0.1] [--port 8765]
```

### CLI commands
```bash
python issue_tracker.py issues [--day today|yesterday|YYYY-MM-DD] [--query-id <ID>] [--json]
python issue_tracker.py curl-examples --issue-id <ID> [--spent-on <DATE>] [--hours <H>] [--activity-id <AID>] [--comments <TEXT>]
```

### Run tests
```bash
python -m unittest worklog_selftest        # 16 mock-based integration tests
python -m unittest tests.test_issue_tracker  # 4 unit tests (date parsing, curl examples)
```

## Configuration

No external dependencies — pure Python standard library (3.9+).

Config is read from `config.local.json` (gitignored). Copy `config.example.json` to start:
```json
{
  "redmine_base_url": "https://lawpj.lawbroker.com.tw",
  "redmine_api_key": "<your-personal-api-key>"
}
```

Environment variable overrides (higher priority than config file):
- `LAWPJ_API_KEY` — primary
- `REDMINE_API_KEY` — fallback
- `REDMINE_BASE_URL` — optional

Local-only data files (all gitignored):
- `config.local.json` — connection config
- `phrases.local.json` — user-defined phrase library
- `saved_queries.local.json` — saved Redmine custom query IDs

## Architecture

Data flow:
```
Browser → worklog_app.js (frontend)
        → issue_tracker.py (HTTP server / router)
        → time_entry_api.py (Redmine REST wrapper)
        → Easy Redmine API
```

### Module responsibilities

| File | Role |
|------|------|
| `issue_tracker.py` | CLI entry point + HTTP server; routes all `/api/*` requests |
| `time_entry_api.py` | Redmine API wrapper: issue queries, time entry preview/commit, activity list |
| `worklog_ui.py` | Generates the HTML shell (inline string) served at `/` |
| `worklog_app.js` | All frontend logic: state management, UI interaction, localStorage |
| `phrases_store.py` | CRUD for `phrases.local.json` with validation |
| `saved_queries_store.py` | CRUD for `saved_queries.local.json` with validation |

### Two-phase commit (preview → commit)

Time entries use a security token system:
1. `POST /api/time-entries/preview` — validates entries, returns a `preview_token` (SHA256 of content + timestamp)
2. `POST /api/time-entries/commit` — requires the same `preview_token`; fails if any field was changed

This prevents accidental double-submit and ensures what was previewed is exactly what gets written.

### API surface (served by `issue_tracker.py`)

**GET**
- `/api/issues?source=mine|query&date=YYYY-MM-DD&query_id=<ID>`
- `/api/time-entry-activities`
- `/api/saved-queries`, `/api/phrases`
- `/api/curl-examples`

**POST**
- `/api/time-entries/preview`, `/api/time-entries/commit`
- `/api/schedule/apply-dates`
- `/api/saved-queries`, `/api/phrases`

**PUT** `/api/phrases/{id}`

**DELETE** `/api/saved-queries/{query_id}`, `/api/phrases/{id}`

## Key behaviours to be aware of

- "我名下 + 更新日期" query returns issues updated on that day by anyone, not necessarily by the current user.
- Duplicate detection runs during preview: issues that already have a time entry on the target date are auto-deselected.
- `worklog_app.js` is large (~67 KB). Frontend state lives entirely in that file; there is no bundler or build step.
