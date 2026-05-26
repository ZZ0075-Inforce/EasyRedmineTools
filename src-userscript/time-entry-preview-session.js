/* ===== TimeEntryPreviewSession：兩階段預覽/提交（token + SHA-256 簽章 + TTL） =====
 * 把 preview/commit 兩個 handler 共用的 session 狀態集中在這裡：
 *   - create(spentOn, entries)  → { token }
 *   - validate(token, spentOn, entries)  → throws on mismatch（過期 / 日期不一 / 內容不一）
 *   - consume(token)  → 移除（idempotent）
 * randomToken 留在 runtime.js（其他 handler 還在用，視為共用 utility）。
 */
const TimeEntryPreviewSession = (() => {
  const SESSIONS = new Map();  // token → { spent_on, signature, ts }
  const TTL_MS = 30 * 60 * 1000;

  async function sha256Hex(text) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function canonicalSignature(spentOn, entries) {
    const canon = {
      spent_on: spentOn,
      entries: entries.map(e => ({
        issue_id: Number(e.issue_id),
        hours: String(e.hours || ""),
        activity_id: e.activity_id === "" || e.activity_id == null ? null : Number(e.activity_id),
        comments: String(e.comments || ""),
      })),
    };
    return sha256Hex(JSON.stringify(canon));
  }

  async function create(spentOn, entries) {
    const token = randomToken();
    const signature = await canonicalSignature(spentOn, entries);
    SESSIONS.set(token, { spent_on: spentOn, signature, ts: Date.now() });
    setTimeout(() => SESSIONS.delete(token), TTL_MS);
    return { token };
  }

  async function validate(token, spentOn, entries) {
    const session = SESSIONS.get(token);
    if (!session) throw new Error("預覽已過期，請重新預覽");
    if (session.spent_on !== spentOn) throw new Error("工時日期與預覽時不同，請重新預覽");
    const sig = await canonicalSignature(spentOn, entries);
    if (sig !== session.signature) throw new Error("內容與預覽時不同，請重新預覽");
  }

  function consume(token) {
    SESSIONS.delete(token);
  }

  return { create, validate, consume };
})();
