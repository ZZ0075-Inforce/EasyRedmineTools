/* ===== 把工時助手入口注入到 Redmine 頂部 menu「問題清單」後面 ============= */
const MENU_LI_ID = "worklog-helper-menu-item";

/* Single source of truth：sidebar 與頂部 menu 子項共用此陣列。
   要加新功能項只改這裡，sidebar 跟 menu 都會自動同步。 */
const SIDE_VIEWS = [
  { key: "worklog",         icon: "📝", iconClass: "icon icon-time",   label: "填寫工時" },
  { key: "schedule",        icon: "📅", iconClass: "icon icon-stats",  label: "兩週排程" },
  { key: "phrases",         icon: "✏️", iconClass: "icon icon-edit",   label: "工時模板" },
  { key: "sources",         icon: "🔍", iconClass: "icon icon-filter", label: "PJ 篩選器" },
  { key: "issue-batch",     icon: "➕", iconClass: "icon icon-add",    label: "批次建 issue" },
];
window.__worklog_SIDE_VIEWS = SIDE_VIEWS;

function injectTopMenu() {
  const topMenu = document.getElementById("top-menu-container");
  if (!topMenu) return false;
  if (document.getElementById(MENU_LI_ID)) return true;

  // 找「問題清單」<li>（class 含 issues 的 a 標籤的 parent li）
  const issuesAnchor = topMenu.querySelector('a.issues');
  const issuesLi = issuesAnchor ? issuesAnchor.closest("li") : null;

  const li = document.createElement("li");
  li.id = MENU_LI_ID;
  li.className = "with-easy-submenu";
  const childrenHtml = SIDE_VIEWS.map((v) =>
    `<li><a href="#" class="${v.iconClass}" data-worklog-mode="${v.key}">${v.label}</a></li>`
  ).join("");
  li.innerHTML = `
    <a class="worklog issues" href="#" id="worklog-helper-menu-link">⏱ 工時助手</a>
    <span class="easy-top-menu-more-toggler" data-menu-toggle="true" id="worklog-helper-menu-toggler">
      <i class="icon-arrow down"></i>
    </span>
    <ul class="menu-children easy-menu-children" id="worklog-helper-menu-children" style="display:none">
      ${childrenHtml}
    </ul>
  `;

  if (issuesLi && issuesLi.parentNode === topMenu) {
    issuesLi.insertAdjacentElement("afterend", li);
  } else {
    topMenu.appendChild(li);
  }

  // 主連結 → 開 overlay 預設 worklog
  document.getElementById("worklog-helper-menu-link").addEventListener("click", (e) => {
    e.preventDefault();
    openOverlayAt("worklog");
    closeMenuChildren();
  });

  // 子選單項目 → 開 overlay 並切到對應模式
  for (const a of li.querySelectorAll("[data-worklog-mode]")) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openOverlayAt(a.dataset.worklogMode);
      closeMenuChildren();
    });
  }

  // 子選單展開/收合（複製 Redmine 行為）
  const toggler = document.getElementById("worklog-helper-menu-toggler");
  const children = document.getElementById("worklog-helper-menu-children");
  toggler.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    children.style.display = children.style.display === "none" ? "block" : "none";
  });

  function closeMenuChildren() {
    if (children) children.style.display = "none";
  }

  // 點選單外部 / 按 ESC 自動關閉子選單
  document.addEventListener("click", (e) => {
    if (children.style.display === "none") return;
    if (li.contains(e.target)) return;
    closeMenuChildren();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && children.style.display !== "none") {
      closeMenuChildren();
    }
  });

  return true;
}

/* 打開 overlay 並切到指定模式（worklog / schedule）。
   無 overlay 時 mountOverlay；已 mount 過則 showOverlay 然後找對應 sidebar tab click。 */
function openOverlayAt(mode) {
  if (typeof __overlayMounted !== "undefined" && !__overlayMounted) {
    mountOverlay();
  } else {
    showOverlay();
  }
  // 等下個 frame 確保 DOM 已就緒（特別是首次 mount）
  requestAnimationFrame(() => {
    const target = document.querySelector(
      `#__worklog_root [data-side-view="${mode}"]`
    );
    if (target) target.click();
  });
}

window.__worklog_openAt = openOverlayAt;
window.__worklog_injectTopMenu = injectTopMenu;
