from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def empty_document() -> dict[str, list[dict[str, Any]]]:
    return {"queries": []}


def normalize_query_id(value: Any) -> int:
    try:
        query_id = int(str(value).strip())
    except (TypeError, ValueError) as exc:
        raise ValueError("query_id 必須是正整數。") from exc
    if query_id <= 0:
        raise ValueError("query_id 必須是正整數。")
    return query_id


def normalize_query(raw_value: Any) -> dict[str, Any]:
    if not isinstance(raw_value, dict):
        raise ValueError("自訂查詢必須是 object。")
    query_id = normalize_query_id(raw_value.get("query_id"))
    name = str(raw_value.get("name") or "").strip()
    if not name:
        raise ValueError("自訂查詢必須有名稱。")
    return {"query_id": query_id, "name": name}


def load_document(path: Path) -> dict[str, list[dict[str, Any]]]:
    if not path.exists():
        return empty_document()
    with path.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)
    if not isinstance(raw, dict):
        raise ValueError("saved_queries 檔案最外層必須是 object。")
    items = raw.get("queries") or []
    if not isinstance(items, list):
        raise ValueError("queries 必須是陣列。")
    queries: list[dict[str, Any]] = []
    seen: set[int] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            query_id = normalize_query_id(item.get("query_id"))
        except ValueError:
            continue
        if query_id in seen:
            continue
        seen.add(query_id)
        queries.append(
            {
                "query_id": query_id,
                "name": str(item.get("name") or f"查詢 #{query_id}").strip(),
            }
        )
    return {"queries": queries}


def write_document(path: Path, document: dict[str, list[dict[str, Any]]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def list_queries(path: Path) -> list[dict[str, Any]]:
    return load_document(path)["queries"]


def add_query(path: Path, raw_value: Any) -> dict[str, Any]:
    query = normalize_query(raw_value)
    document = load_document(path)
    for item in document["queries"]:
        if item["query_id"] == query["query_id"]:
            item["name"] = query["name"]
            write_document(path, document)
            return item
    document["queries"].append(query)
    write_document(path, document)
    return query


def remove_query(path: Path, query_id: Any) -> bool:
    qid = normalize_query_id(query_id)
    document = load_document(path)
    before = len(document["queries"])
    document["queries"] = [item for item in document["queries"] if item["query_id"] != qid]
    removed = len(document["queries"]) < before
    if removed:
        write_document(path, document)
    return removed
