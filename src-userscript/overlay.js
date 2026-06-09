/* ===== Overlay mount ======================================================= */
const OVERLAY_ROOT_ID = "__worklog_root";
const BACKDROP_ID = "__worklog_backdrop";
const CLOSE_BTN_ID = "__worklog_close";

const LAUNCHER_CSS = `
#${BACKDROP_ID} {
  position: fixed !important;
  inset: 0 !important;
  background: rgba(0,0,0,.45);
  z-index: 2147483646 !important;
  animation: __worklog_fade_in 150ms ease-out;
}
@keyframes __worklog_fade_in { from { opacity: 0; } to { opacity: 1; } }
@keyframes __worklog_pop_in {
  from { opacity: 0; transform: scale(.97); }
  to { opacity: 1; transform: scale(1); }
}

#${OVERLAY_ROOT_ID} {
  position: fixed !important;
  top: 32px !important;
  left: 32px !important;
  right: 32px !important;
  bottom: 32px !important;
  /* 必須覆寫 body→__worklog_root scoping 帶來的 min-height: 100vh */
  min-height: 0 !important;
  height: auto !important;
  max-height: calc(100vh - 64px) !important;
  z-index: 2147483647 !important;
  background: var(--bg, #f9f5f1);
  border: 1px solid var(--panel-border, #e8e2da);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0,0,0,.3);
  overflow: hidden;  /* 外層不滾，內層 .shell 自己 scroll */
  animation: __worklog_pop_in 180ms ease-out;  /* 進場 scale-in；showOverlay 會重播 */
  transform-origin: center center;
}
#${OVERLAY_ROOT_ID} .app-shell {
  height: 100% !important;
  overflow: hidden !important;
}
#${OVERLAY_ROOT_ID} .shell {
  overflow: hidden !important;  /* 外層不滾, 內層 main-view / panel 自己滾 */
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  min-height: 0 !important;
}
#${OVERLAY_ROOT_ID} .shell > .main-toolbar { flex-shrink: 0 !important; }
/* main-view 撐滿 .shell 剩餘空間, 預設整 view 自己滾 (mobile / 簡單 view 用) */
#${OVERLAY_ROOT_ID} .shell > .main-view:not([hidden]) {
  flex: 1 !important;
  min-height: 0 !important;
  overflow-y: auto !important;
}
/* Desktop worklog view: panel 內部各自滾, main-view 不滾, .shell 不滾 */
@media (min-width: 768px) {
  #${OVERLAY_ROOT_ID} .shell > .main-view[data-view="worklog"]:not([hidden]) {
    overflow: hidden !important;
    display: flex !important;
    flex-direction: column !important;
  }
  #${OVERLAY_ROOT_ID} .main-view[data-view="worklog"] .layout {
    flex: 1 !important;
    min-height: 0 !important;
  }
  #${OVERLAY_ROOT_ID} .layout > .list-panel,
  #${OVERLAY_ROOT_ID} .layout > .details-panel {
    display: flex !important;
    flex-direction: column !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }
  #${OVERLAY_ROOT_ID} .list-panel .issue-list {
    flex: 1 !important;
    overflow-y: auto !important;
    min-height: 0 !important;
    max-height: none !important;
  }
  #${OVERLAY_ROOT_ID} .details-panel .table-wrap {
    flex: 1 !important;
    overflow: auto !important;
    min-height: 0 !important;
  }
}
/* 強制 sticky 元素留在 overlay 內，覆寫原本 mobile 的 position:fixed */
#${OVERLAY_ROOT_ID} .sticky-actions {
  position: sticky !important;
  bottom: 0 !important;
  left: auto !important;
  right: auto !important;
  margin: 0 !important;
  width: auto !important;
  z-index: 5;
}
/* details-panel 在 master 為應對 mobile 底部 tab bar 加了 80px padding，
   但 overlay 模式下 sticky-actions 已 sticky 到 overlay 底，不需要這麼大留白 */
#${OVERLAY_ROOT_ID} .details-panel { padding-bottom: 0 !important; }
/* master 的 .shell { max-width: 1280px } 在 overlay 大螢幕下會強制鎖寬，
   right 側留下大空白 → overlay 模式取消 max-width 撐滿 */
#${OVERLAY_ROOT_ID} .shell {
  max-width: none !important;
  padding: 16px !important;
  margin: 0 !important;
}

/* 防禦 Easy Redmine 頁面對 ul/li/label 的全域樣式可能干擾 issue-card 寬度。
   list-panel 內整條 chain 強制滿寬。 */
#${OVERLAY_ROOT_ID} .issue-list,
#${OVERLAY_ROOT_ID} .issue-list > li,
#${OVERLAY_ROOT_ID} .issue-card,
#${OVERLAY_ROOT_ID} .issue-select {
  width: 100% !important;
  box-sizing: border-box !important;
  margin-left: 0 !important;
  padding-left: 0 !important;
}
#${OVERLAY_ROOT_ID} .issue-card {
  padding: 10px 12px !important;
}
#${OVERLAY_ROOT_ID} .issue-select {
  display: grid !important;
  grid-template-columns: auto 1fr !important;
}
#${OVERLAY_ROOT_ID} .issue-select > span {
  display: block !important;
  width: auto !important;
  min-width: 0 !important;
}
#${OVERLAY_ROOT_ID}[hidden],
#${BACKDROP_ID}[hidden],
#${CLOSE_BTN_ID}[hidden] { display: none !important; }

#${CLOSE_BTN_ID} {
  position: fixed !important;
  top: 32px;
  right: 32px;
  z-index: 2147483648 !important;
  width: 40px; height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,.9);
  border: 1px solid rgba(0,0,0,.1);
  color: #2c2c2c;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
  transition: background 150ms ease-out, transform 150ms ease-out;
}
#${CLOSE_BTN_ID}:hover { background: #fff; transform: scale(1.05); }

/* Dark theme：build 把 data-theme 設在 #__worklog_root；close 鈕 / backdrop 是其
   body 層 sibling，無法用後代選擇器，改用 :has() 從 body 偵測 overlay 的主題。 */
body:has(#${OVERLAY_ROOT_ID}[data-theme="dark"]) #${CLOSE_BTN_ID} {
  background: rgba(40,36,32,.92);
  border-color: rgba(255,255,255,.14);
  color: #f2ede7;
}
body:has(#${OVERLAY_ROOT_ID}[data-theme="dark"]) #${CLOSE_BTN_ID}:hover {
  background: #2a2622;
}
body:has(#${OVERLAY_ROOT_ID}[data-theme="dark"]) #${BACKDROP_ID} {
  background: rgba(0,0,0,.6);
}

@media (max-width: 600px) {
  #${OVERLAY_ROOT_ID} {
    top: 12px !important; left: 12px !important;
    right: 12px !important; bottom: 12px !important;
  }
  #${CLOSE_BTN_ID} {
    top: 16px; right: 16px;
    width: 44px; height: 44px;
  }
}
`;

let __overlayMounted = false;
let __overlayRoot = null;
let __backdrop = null;
let __closeBtn = null;

function addCss(text) {
  if (typeof GM_addStyle !== "undefined") { GM_addStyle(text); return; }
  const style = document.createElement("style");
  style.textContent = text;
  document.head.appendChild(style);
}

function mountOverlay() {
  if (__overlayMounted) {
    showOverlay();
    return;
  }

  // LAUNCHER_CSS 含 #__worklog_root 的 fixed 定位 + backdrop + close 按鈕樣式，
  // 必須在 mountOverlay 注入，否則 overlay 沒拿到 position: fixed 會掉到 body 末端。
  addCss(LAUNCHER_CSS);
  addCss(APP_CSS);

  // 半透明 backdrop（點擊可關閉）
  __backdrop = document.createElement("div");
  __backdrop.id = BACKDROP_ID;
  __backdrop.addEventListener("click", hideOverlay);
  document.body.appendChild(__backdrop);

  // Overlay root
  __overlayRoot = document.createElement("div");
  __overlayRoot.id = OVERLAY_ROOT_ID;
  __overlayRoot.innerHTML = APP_HTML;
  document.body.appendChild(__overlayRoot);

  // 關閉按鈕（永遠可見、最高 z-index）
  __closeBtn = document.createElement("button");
  __closeBtn.id = CLOSE_BTN_ID;
  __closeBtn.type = "button";
  __closeBtn.textContent = "✕";
  __closeBtn.title = "關閉（ESC）";
  __closeBtn.setAttribute("aria-label", "關閉工時助手");
  __closeBtn.addEventListener("click", hideOverlay);
  document.body.appendChild(__closeBtn);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && __overlayMounted && !__overlayRoot.hidden) {
      hideOverlay();
    }
  });

  // 用 SIDE_VIEWS 動態 render sidebar，跟 menu 子項共用同一份來源
  const sideBody = __overlayRoot.querySelector(".side-nav-body");
  if (sideBody && Array.isArray(SIDE_VIEWS)) {
    sideBody.innerHTML = SIDE_VIEWS.map((v) => `
      <button class="side-tab" data-side-view="${v.key}">
        <span class="side-tab-icon">${v.icon}</span>
        <span class="side-tab-label">${v.label}</span>
      </button>
    `).join("");
  }

  applySettingsPatches(__overlayRoot);
  __initWorklogApp();
  __overlayMounted = true;
}

function replayAnim(el, anim) {
  if (!el) return;
  el.style.animation = "none";
  // 強制 reflow，讓同一段 animation 能重新觸發（否則二次顯示不會重播）
  void el.offsetWidth;
  el.style.animation = anim;
}

function showOverlay() {
  if (!__overlayMounted) return;
  __overlayRoot.hidden = false;
  __backdrop.hidden = false;
  __closeBtn.hidden = false;
  // mount 時注入的 CSS animation 不會在二次顯示自動重跑，手動重播進場動畫
  replayAnim(__overlayRoot, "__worklog_pop_in 180ms ease-out");
  replayAnim(__backdrop, "__worklog_fade_in 150ms ease-out");
}

function hideOverlay() {
  if (!__overlayMounted) return;
  __overlayRoot.hidden = true;
  __backdrop.hidden = true;
  __closeBtn.hidden = true;
}

function toggleOverlay() {
  if (!__overlayMounted) { mountOverlay(); return; }
  if (__overlayRoot.hidden) showOverlay();
  else hideOverlay();
}
