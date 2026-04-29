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

import datetime
import re
import sys
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
    "<body>" 字串（例如 "data-mobile-tab on <body>"），body regex 會錯抓起點。
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


def replace_function_body(src: str, signature_prefix: str, new_body: str) -> str:
    """找到以 signature_prefix 開頭的函式宣告，找到第一個 '{' 起算的整個 balanced block，替換成 new_body。"""
    idx = src.find(signature_prefix)
    if idx < 0:
        raise SystemExit(f"找不到函式：{signature_prefix}")
    brace_start = src.find("{", idx + len(signature_prefix))
    if brace_start < 0:
        raise SystemExit(f"函式 {signature_prefix} 缺少 '{{'")
    depth = 0
    i = brace_start
    n = len(src)
    while i < n:
        c = src[i]
        if c in ('"', "'", "`"):
            q = c
            i += 1
            while i < n and src[i] != q:
                if src[i] == "\\":
                    i += 1
                i += 1
            i += 1
            continue
        if c == "/" and i + 1 < n:
            if src[i + 1] == "/":
                i = src.find("\n", i)
                if i < 0:
                    i = n
                continue
            if src[i + 1] == "*":
                end = src.find("*/", i + 2)
                i = (end + 2) if end != -1 else n
                continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                # replace src[idx : i+1]
                return src[:idx] + signature_prefix + new_body + src[i + 1:]
        i += 1
    raise SystemExit(f"無法找到 {signature_prefix} 的結尾")


def transform_app_core(js_source: str) -> str:
    """把 worklog_app.js 改造成可在 overlay 掛載後才啟動的函式。"""

    # 1. fetchJson 改走轉接器（用 balanced brace 替換整個函式本體）
    js_source = replace_function_body(
        js_source,
        "async function fetchJson(url, options = {}) ",
        "{ return window.__worklog_fetchJson(url, options); }",
    )

    # 2. 主題切換從 <html> 改到 #__worklog_root
    js_source = js_source.replace(
        'document.documentElement.setAttribute("data-theme", "dark")',
        'document.getElementById("__worklog_root")?.setAttribute("data-theme", "dark")',
    )
    js_source = js_source.replace(
        'document.documentElement.removeAttribute("data-theme")',
        'document.getElementById("__worklog_root")?.removeAttribute("data-theme")',
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


def main() -> None:
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
    runtime_js = read(SRC / "runtime.js")
    settings_js = read(SRC / "settings-patch.js")
    overlay_js = read(SRC / "overlay.js")
    menu_injector_js = read(SRC / "menu-injector.js")
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
    menu_injector_js = prefix_classes(menu_injector_js, app_classes)

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
        runtime_js,
        "",
        settings_js,
        "",
        overlay_js,
        "",
        menu_injector_js,
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
        "  recordIssueVisit().catch(() => {});",
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


if __name__ == "__main__":
    main()
