#!/usr/bin/env python3
"""Build Tampermonkey userscript: dist/worklog.user.js.

流程：
1. 從 src-userscript/ui-template.html 抽取 HTML body + CSS
2. 移除 Google Fonts <link>（規避 Redmine CSP）
3. 自家 class 全部加 pj- 前綴避開 Easy Redmine 全域 CSS 撞名
4. 把 CSS 所有 selector 加上 #__worklog_root scope（避免與 Redmine 頁樣式衝突）
5. 讀 worklog_app.js，包進 __initWorklogApp() 函式
6. 把 fetchJson 改為呼叫 window.__worklog_fetchJson
7. 把主題 data-theme 改成套在 #__worklog_root 而不是 <html>
8. 注入 build-time 版號到 @version 與 APP_VERSION / APP_BUILD_TIME
9. 串接：header + runtime + settings-patch + overlay + app-core + bootstrap
10. 輸出 dist/worklog.user.js
"""
from __future__ import annotations

import argparse
import datetime
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src-userscript"
DIST = ROOT / "dist"
SCOPE = "#__worklog_root"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def extract_html_and_css(html: str) -> tuple[str, str]:
    """從 ui-template.html 抽出 body HTML + <style> 區塊 CSS。

    必須先把 <style>...</style> 整段抽掉再找 <body>，否則 CSS 註解裡若含
    "<body>" 字串，body regex 會錯抓起點。
    """
    style_match = re.search(r"<style>\s*(.*?)\s*</style>", html, re.DOTALL)
    if not style_match:
        raise SystemExit("找不到 <style> 區塊")
    css = style_match.group(1)

    # 把整個 <style>...</style> 從 html 移除，避免裡面的字面量干擾 body 抽取
    html_no_style = html[:style_match.start()] + html[style_match.end():]

    body_match = re.search(r"<body[^>]*>\s*(.*?)\s*</body>", html_no_style, re.DOTALL)
    if not body_match:
        raise SystemExit("找不到 <body>")
    body = body_match.group(1)

    # 移除 module script tag（我們會自己注入 app code）
    body = re.sub(r'<script\s+type="module"\s+src="/worklog-app\.js"[^>]*></script>', "", body)

    return body.strip(), css.strip()


def strip_css_comments(css: str) -> str:
    """粗暴移除 /* ... */ 區塊註解（CSS 沒有 // 行註解）。"""
    return re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)


def scope_css(css: str, scope: str) -> str:
    """把每條 CSS rule 的 selector 加上 scope 前綴。支援 @media 巢狀。

    簡單 tokenizer：逐字元讀，遇 '{' 處理 selector，遇 '}' 減深度。
    跳過字串內容 (' 和 ")。
    """
    css = strip_css_comments(css)
    out: list[str] = []
    i = 0
    n = len(css)
    depth = 0
    start = 0

    def transform_selector_list(sel: str) -> str:
        parts = split_selector_list(sel.strip())
        result = []
        for p in parts:
            p = p.strip()
            if not p:
                continue
            # 特殊選擇器
            if p in ("html", "body", ":root"):
                result.append(scope)
            elif p == "*":
                result.append(f"{scope} *")
            elif p.startswith(":root"):
                result.append(scope + p[len(":root"):])
            elif p.startswith("html[") or p.startswith("body["):
                # e.g. body[data-theme="dark"]  → #__worklog_root[data-theme="dark"]
                result.append(scope + p[4:])
            elif p.startswith("html ") or p.startswith("body "):
                rest = p.split(" ", 1)[1]
                result.append(f"{scope} {rest}")
            elif p.startswith("["):
                # 屬性選擇器當 root 自己，例如 [data-theme="dark"]
                result.append(f"{scope}{p}")
            elif p.startswith(scope):
                result.append(p)
            else:
                result.append(f"{scope} {p}")
        return ", ".join(result)

    while i < n:
        c = css[i]

        # 跳過字串
        if c in ('"', "'"):
            q = c
            i += 1
            while i < n and css[i] != q:
                if css[i] == "\\":
                    i += 1
                i += 1
            i += 1
            continue

        # 跳過註解
        if c == "/" and i + 1 < n and css[i + 1] == "*":
            end = css.find("*/", i + 2)
            i = end + 2 if end != -1 else n
            continue

        if c == "{":
            # 目前 start..i 是 selector 或 at-rule prelude
            prelude = css[start:i].strip()
            if prelude.startswith("@"):
                # at-rule block：照搬 prelude，裡面的規則遞迴處理
                if prelude.startswith("@media") or prelude.startswith("@supports"):
                    out.append(prelude + " {")
                    # 讀整個 block 內容
                    inner_start = i + 1
                    inner_depth = 1
                    j = i + 1
                    while j < n and inner_depth > 0:
                        cj = css[j]
                        if cj in ('"', "'"):
                            qj = cj
                            j += 1
                            while j < n and css[j] != qj:
                                if css[j] == "\\":
                                    j += 1
                                j += 1
                        elif cj == "{":
                            inner_depth += 1
                        elif cj == "}":
                            inner_depth -= 1
                            if inner_depth == 0:
                                break
                        j += 1
                    inner = css[inner_start:j]
                    out.append(scope_css(inner, scope))
                    out.append("}")
                    i = j + 1
                    start = i
                    continue
                else:
                    # @keyframes / @font-face / @charset / @import 等 — 不碰
                    j = i + 1
                    inner_depth = 1
                    while j < n and inner_depth > 0:
                        cj = css[j]
                        if cj in ('"', "'"):
                            qj = cj
                            j += 1
                            while j < n and css[j] != qj:
                                if css[j] == "\\":
                                    j += 1
                                j += 1
                        elif cj == "{":
                            inner_depth += 1
                        elif cj == "}":
                            inner_depth -= 1
                            if inner_depth == 0:
                                break
                        j += 1
                    out.append(css[start:j + 1])
                    i = j + 1
                    start = i
                    continue
            else:
                # 普通 rule：transform selector
                transformed = transform_selector_list(prelude)
                out.append(transformed + " ")
                # 讀 block 內容原封抄
                j = i
                inner_depth = 0
                while j < n:
                    cj = css[j]
                    if cj in ('"', "'"):
                        qj = cj
                        j += 1
                        while j < n and css[j] != qj:
                            if css[j] == "\\":
                                j += 1
                            j += 1
                    elif cj == "{":
                        inner_depth += 1
                    elif cj == "}":
                        inner_depth -= 1
                        if inner_depth == 0:
                            break
                    j += 1
                out.append(css[i:j + 1])
                i = j + 1
                start = i
                continue

        if c == ";" and depth == 0:
            # at-rule 沒有 block，例如 @import, @charset
            out.append(css[start:i + 1])
            i += 1
            start = i
            continue

        i += 1

    # 結尾殘留
    if start < n:
        out.append(css[start:])

    return "".join(out)


def split_selector_list(sel: str) -> list[str]:
    """在括弧外以逗號切 selector 列表。"""
    parts: list[str] = []
    depth = 0
    buf: list[str] = []
    for c in sel:
        if c in "([":
            depth += 1
        elif c in ")]":
            depth -= 1
        if c == "," and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(c)
    if buf:
        parts.append("".join(buf))
    return parts


def replace_between_sentinels(src: str, begin: str, end: str, new_content: str) -> str:
    """以 sentinel 註解為錨點替換中間內容（含兩個 sentinel 自身）。
    用法：在源碼裡夾 // @build:foo-begin ... // @build:foo-end，
    build 時整段（含註解）替換為 new_content。比對 function signature
    精準字串穩定——可改空白 / 參數預設值 / 函式名而 build 不會 silent fail。
    Sentinel 找不到時拋錯，build 大聲失敗而非默默產出壞 bundle。"""
    b = src.find(begin)
    if b < 0:
        raise SystemExit(f"build sentinel not found: {begin}")
    e = src.find(end, b + len(begin))
    if e < 0:
        raise SystemExit(f"build sentinel not found: {end} (after {begin})")
    return src[:b] + new_content + src[e + len(end):]


def transform_app_core(js_source: str) -> str:
    """把 worklog_app.js 改造成可在 overlay 掛載後才啟動的函式。"""

    # 1. fetchJson 改走轉接器（sentinel-wrapped 區塊整段換成 stub）
    js_source = replace_between_sentinels(
        js_source,
        "// @build:fetchJson-stub-begin",
        "// @build:fetchJson-stub-end",
        "async function fetchJson(url, options) { return window.__worklog_fetchJson(url, options); }",
    )

    # 2. 主題切換從 <html> 改到 #__worklog_root（sentinel-wrapped if/else 兩行）
    js_source = replace_between_sentinels(
        js_source,
        "// @build:theme-toggle-begin",
        "// @build:theme-toggle-end",
        '  if (theme === "dark") document.getElementById("__worklog_root")?.setAttribute("data-theme", "dark");\n'
        '  else document.getElementById("__worklog_root")?.removeAttribute("data-theme");',
    )

    # 3. 最後的 initializeApp().catch(...) 保留在函式內，第一次 mount 時會執行
    # 4. 整段包起來
    wrapped = (
        "let __worklogAppInited = false;\n"
        "function __initWorklogApp() {\n"
        "  if (__worklogAppInited) return;\n"
        "  __worklogAppInited = true;\n"
        + js_source
        + "\n}\n"
    )
    return wrapped


CLASS_PREFIX = "pj-"
# 我們已經用過的、不該被 prefix 的 class 名（例如 hover 已內建在 selector
# 寫法 `.foo:hover`，hover 不算 class；但保險起見硬不過濾這類）
RESERVED_NON_CLASSES: set[str] = set()


def extract_app_classes(css_text: str) -> set[str]:
    """從 CSS 字串抽出我們的 class 名稱集合。

    流程：
      1. 移除 /* 註解 */
      2. 移除字串內容（避免匹配到字串裡的 .foo）
      3. 移除 attribute selector [...]（避免 class*= 內 quote 干擾）
      4. 用 regex 找 `.kebab-case-name` 形式
    """
    text = strip_css_comments(css_text)
    text = re.sub(r"\"[^\"]*\"|'[^']*'", "", text)
    text = re.sub(r"\[[^\]]*\]", "", text)
    classes: set[str] = set()
    # kebab-case：開頭小寫字母，後續 -/小寫字母/數字
    for m in re.finditer(r"\.([a-z][a-z0-9-]*)", text):
        name = m.group(1)
        if name in RESERVED_NON_CLASSES:
            continue
        # 只處理含連字號的 class 名（如 issue-card / top-tabs / batch-meta）。
        # 單字 utility class（如 selected / muted / active / tag）跳過，
        # 因為它們可能跟 JS object key、property 名同名（如 entry.selected），
        # word-boundary 替換會壞 JS 語法。Redmine 撞名風險主要落在這類含連字號的
        # 命名空間 class，先解這層。
        if "-" not in name:
            continue
        classes.add(name)
    return classes


def prefix_classes(text: str, classes: set[str], prefix: str = CLASS_PREFIX) -> str:
    """對白名單中每個 class name `c`，做 token-boundary 替換 c → {prefix}{c}。

    用 `(?<![\\w-])` 和 `(?![\\w-])` 而非 `\\b`，把連字號也視為 token 一部分。
    這樣 `data-issue-id` 中的 `issue-id` 不會被誤匹配（避免破壞 dataset 屬性名）。
    為避免長 name 被短 name 提早覆寫，按長度由長到短排序。
    """
    if not classes:
        return text
    sorted_names = sorted(classes, key=len, reverse=True)
    pattern = re.compile(
        r"(?<![\w-])(" + "|".join(re.escape(n) for n in sorted_names) + r")(?![\w-])"
    )
    return pattern.sub(lambda m: prefix + m.group(1), text)


def js_string(text: str) -> str:
    """轉義成 JS template literal。"""
    return (
        text.replace("\\", "\\\\")
        .replace("`", "\\`")
        .replace("${", "\\${")
    )


def build_once() -> None:
    # 版號每次 build 注入時間戳，確保 Tampermonkey 偵測到升版
    build_version = "1.0." + datetime.datetime.now().strftime("%Y%m%d%H%M")
    header = read(SRC / "header.meta.js")
    header = re.sub(
        r"^// @version\s+\S+",
        f"// @version      {build_version}",
        header,
        count=1,
        flags=re.MULTILINE,
    )
    tps_js = read(SRC / "time-entry-preview-session.js")
    time_entry_h_js = read(SRC / "time-entry-handlers.js")
    issue_h_js = read(SRC / "issue-handlers.js")
    catalog_h_js = read(SRC / "catalog-handlers.js")
    storage_h_js = read(SRC / "storage-handlers.js")
    runtime_js = read(SRC / "runtime.js")
    settings_js = read(SRC / "settings-patch.js")
    overlay_js = read(SRC / "overlay.js")
    menu_injector_js = read(SRC / "menu-injector.js")
    inline_injector_js = read(SRC / "inline-injector.js")
    ui_html = read(SRC / "ui-template.html")
    app_js = read(ROOT / "worklog_app.js")

    html_body, css_text = extract_html_and_css(ui_html)

    # 移除 Google Fonts / preconnect link（CSP + 已改用系統 fallback）
    html_body = re.sub(r'<link[^>]*(?:fonts\.googleapis|fonts\.gstatic)[^>]*>\s*', "", html_body)

    # 自家 class 全部加 pj- 前綴避開 Easy Redmine 全域 CSS 撞名
    # （例：Redmine 自有 .issue-card { max-width: 300px !important }）
    app_classes = extract_app_classes(css_text)
    css_text = prefix_classes(css_text, app_classes)
    html_body = prefix_classes(html_body, app_classes)
    app_js = prefix_classes(app_js, app_classes)
    overlay_js = prefix_classes(overlay_js, app_classes)
    settings_js = prefix_classes(settings_js, app_classes)
    runtime_js = prefix_classes(runtime_js, app_classes)
    tps_js = prefix_classes(tps_js, app_classes)
    time_entry_h_js = prefix_classes(time_entry_h_js, app_classes)
    issue_h_js = prefix_classes(issue_h_js, app_classes)
    catalog_h_js = prefix_classes(catalog_h_js, app_classes)
    storage_h_js = prefix_classes(storage_h_js, app_classes)
    menu_injector_js = prefix_classes(menu_injector_js, app_classes)
    inline_injector_js = prefix_classes(inline_injector_js, app_classes)

    # 把 worklog_app.js 內 APP_VERSION / APP_BUILD_TIME 替換為本次 build 時間戳
    # 讓設定→關於 顯示的版號跟 @version metadata 同步
    build_date = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    app_js = re.sub(
        r'const\s+APP_VERSION\s*=\s*"[^"]*";',
        f'const APP_VERSION = "{build_version}";',
        app_js,
        count=1,
    )
    app_js = re.sub(
        r'const\s+APP_BUILD_TIME\s*=\s*"[^"]*";',
        f'const APP_BUILD_TIME = "{build_date}";',
        app_js,
        count=1,
    )

    # CSS scope 化
    scoped_css = scope_css(css_text, SCOPE)

    # App core 包裝
    wrapped_app = transform_app_core(app_js)

    # 組合
    pieces = [
        header.rstrip(),
        "",
        "(function () {",
        "  'use strict';",
        "",
        f"const APP_HTML = `{js_string(html_body)}`;",
        f"const APP_CSS = `{js_string(scoped_css)}`;",
        "",
        tps_js,
        "",
        time_entry_h_js,
        "",
        issue_h_js,
        "",
        catalog_h_js,
        "",
        storage_h_js,
        "",
        runtime_js,
        "",
        settings_js,
        "",
        overlay_js,
        "",
        menu_injector_js,
        "",
        inline_injector_js,
        "",
        wrapped_app,
        "",
        "/* ===== Bootstrap =============================== */",
        "function boot() {",
        "  // 注入 Redmine 頂部 menu 入口（問題清單後面）",
        "  if (!injectTopMenu()) {",
        "    // 若 #top-menu-container 還沒就緒就稍等再試（Redmine 偶爾延遲）",
        "    setTimeout(injectTopMenu, 500);",
        "  }",
        "  // Inline 工具（整合自舊 PJ_startToEndDate + PJ_workingHours）",
        "  installInlineModal();  // 預先 inject mini modal 到 body（toolbar 點擊時用）",
        "  installInlineTools();  // 若當前是 /issues/{id} 詳細頁就 inject form + toolbar",
        "  VisitedIssuesRegistry.recordVisit().catch(() => {});",
        "  // 一次性清掉舊殘留（deprecated keys）",
        "  Store.del('launcher_pos');",
        "  // inline 工具改用 phrase 關聯後不再用獨立 activity / comment 設定",
        "  Store.del('inline_default_activity_id');",
        "  Store.del('inline_default_comment');",
        "  // 舊單一 toggle 已拆為 quick_edit / toolbar 兩個獨立 toggle",
        "  Store.del('inline_tools_enabled');",
        "  // Quick Edit 表單功能移除, 清舊獨立 toggle key",
        "  Store.del('inline_quick_edit_enabled');",
        "  // 移除舊版 inject 過的 quick edit form (本版已移除該功能, 不需等 F5)",
        "  document.getElementById('__worklog_inline_form')?.remove();",
        "  console.log('[LawPJ Worklog] userscript 已就緒（從上方 menu 進入工時助手）');",
        "}",
        "if (document.readyState === 'loading') {",
        "  document.addEventListener('DOMContentLoaded', boot, { once: true });",
        "} else {",
        "  boot();",
        "}",
        "",
        "})();",
        "",
    ]

    DIST.mkdir(parents=True, exist_ok=True)
    out_path = DIST / "worklog.user.js"
    out_path.write_text("\n".join(pieces), encoding="utf-8")
    kb = out_path.stat().st_size / 1024
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"[OK] 已輸出 {out_path} ({kb:.1f} KB) version={build_version}")

    # 同步產出本機開發用 loader（@require file:// 指向上面的產物）
    emit_dev_loader()


def emit_dev_loader() -> None:
    """產生 dist/dev-loader.user.js：只含 metadata 的本機開發 loader。

    透過 @require file://<絕對路徑> 直接讀本機 dist/worklog.user.js，
    搭配 Tampermonkey「外部 @require 更新間隔=總是」即可 build 完 F5 生效，
    免 commit / push。@require 進來的檔案 metadata 不生效，故 @grant 在此重複宣告。
    file:// URI 由 Path.as_uri() 產生，跨機器重 build 路徑自動正確。
    """
    header = read(SRC / "header.meta.js")

    def pick(field: str) -> list[str]:
        return re.findall(rf"^// @{field}\s+(.+?)\s*$", header, flags=re.MULTILINE)

    require_uri = (DIST / "worklog.user.js").resolve().as_uri()
    lines = ["// ==UserScript=="]
    lines.append("// @name         LawPJ Worklog Helper (DEV loader)")
    for ns in pick("namespace"):
        lines.append(f"// @namespace    {ns}")
    lines.append("// @version      0.0.0-dev")
    lines.append("// @description  本機開發 loader：實際邏輯由 @require 的 dist/worklog.user.js 提供")
    for m in pick("match"):
        lines.append(f"// @match        {m}")
    for g in pick("grant"):
        lines.append(f"// @grant        {g}")
    for c in pick("connect"):
        lines.append(f"// @connect      {c}")
    for r in pick("run-at"):
        lines.append(f"// @run-at       {r}")
    if re.search(r"^// @noframes\b", header, flags=re.MULTILINE):
        lines.append("// @noframes")
    lines.append(f"// @require      {require_uri}")
    lines.append("// ==/UserScript==")
    lines.append("")
    lines.append("// loader：本檔不含邏輯，實際程式由上方 @require 的本機 dist/worklog.user.js 提供。")
    lines.append("")

    loader_path = DIST / "dev-loader.user.js"
    loader_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] 已輸出 {loader_path}（@require {require_uri}）")


def watch_paths() -> list[Path]:
    """build 來源檔清單：src-userscript 下的 .js/.html + worklog_app.js + 本 build script。"""
    paths = sorted(SRC.glob("*.js")) + sorted(SRC.glob("*.html"))
    paths.append(ROOT / "worklog_app.js")
    paths.append(Path(__file__).resolve())
    return [p for p in paths if p.exists()]


def watch_loop() -> None:
    """polling 監看來源檔 mtime，有變動就重 build。Ctrl+C 結束。"""
    sys.stdout.reconfigure(encoding="utf-8")
    print("[watch] 監看來源檔變動中… (Ctrl+C 結束)")
    last: dict[Path, float] = {}
    for p in watch_paths():
        last[p] = p.stat().st_mtime
    while True:
        try:
            time.sleep(0.5)
            changed = []
            for p in watch_paths():
                mtime = p.stat().st_mtime
                if last.get(p) != mtime:
                    last[p] = mtime
                    changed.append(p.name)
            if changed:
                stamp = datetime.datetime.now().strftime("%H:%M:%S")
                print(f"\n[watch {stamp}] 偵測到變動：{', '.join(changed)} → 重新 build")
                try:
                    build_once()
                except Exception as exc:  # noqa: BLE001 — build 失敗不該中斷 watch
                    print(f"[watch] build 失敗：{exc}")
        except KeyboardInterrupt:
            print("\n[watch] 結束。")
            return


def main() -> None:
    parser = argparse.ArgumentParser(description="Build LawPJ Tampermonkey userscript")
    parser.add_argument(
        "--watch",
        action="store_true",
        help="監看來源檔變動，存檔自動重 build（配合 dev-loader + F5）",
    )
    args = parser.parse_args()
    build_once()
    if args.watch:
        watch_loop()


if __name__ == "__main__":
    main()
