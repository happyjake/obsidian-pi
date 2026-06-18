import * as f from "obsidian";
import { confirmWithModal } from "./modals/confirm-modal.mjs";

export function showThreadList() {
  ((this.showingThreadList = !0), this.renderThreadList());
}

export function renderThreadList() {
  var a;
  let e = this.containerEl.children[1],
    t = this.plugin.listThreads({ includeArchived: !0 }),
    n = this.plugin.getCurrentThread();
  ((a = this.suggestions) == null || a.close(),
    this.cleanupComposerBarObserver(),
    (this.messagesEl = void 0),
    (this.inputEl = void 0),
    (this.sendButtonEl = void 0),
    (this.composerBarEl = void 0),
    (this.composerBarExpandEl = void 0),
    (this.runSettings = void 0),
    (this.toolBadgesEl = void 0),
    (this.selectionPreviewEl = void 0),
    (this.threadTitleEl = void 0),
    (this.modePillEl = void 0),
    e.empty(),
    e.addClass("pi-agent-view"));
  this.renderThreadListPanelHeader(e);
  let s = e.createDiv({ cls: "pi-agent-thread-list-header" }),
    o = t.filter((m) => m.favorite).length,
    l = s.createDiv({ cls: "pi-agent-thread-list-heading" });
  (l.createDiv({ cls: "pi-agent-thread-list-title-heading", text: "Threads" }),
    l.createDiv({
      cls: "pi-agent-thread-list-subtitle",
      text: `${t.length} conversation${t.length === 1 ? "" : "s"} · ${o} starred`
    }));
  let d = s.createEl("button", {
    cls: "clickable-icon pi-agent-thread-list-new-button",
    attr: { "aria-label": "New chat", title: "New chat" }
  });
  ((0, f.setIcon)(d, "plus"),
    d.createSpan({ text: "New" }),
    d.addEventListener("click", () => {
      (this.plugin.startNewThread(), this.renderChatView());
    }));
  let h = e.createDiv({ cls: "pi-agent-thread-list" });
  t.length === 0
    ? h.createDiv({ cls: "pi-agent-empty", text: "No chat threads." })
    : t.forEach((m) => this.renderThreadListRow(h, m, m.id === n.id));
}

export function renderThreadListPanelHeader(e) {
  let t = e.createDiv({ cls: "pi-agent-header" }),
    n = t.createDiv({ cls: "pi-agent-brand" }),
    s = n.createSpan({
      cls: "pi-agent-brand-icon",
      attr: { title: "Pi Agent" }
    });
  (this.renderPiIcon(s),
    n.createSpan({ cls: "pi-agent-thread-title pi-agent-thread-title-static", text: "Pi Agent" }),
    (this.modePillEl = n.createSpan({ cls: "pi-agent-mode-pill" })),
    this.renderToolModePill());
  let a = t.createDiv({ cls: "pi-agent-header-actions" }),
    o = a.createEl("button", {
      cls: "clickable-icon pi-agent-header-action",
      attr: { "aria-label": "New chat", title: "New chat" }
    });
  ((0, f.setIcon)(o, "plus"),
    o.addEventListener("click", (d) => {
      (d.preventDefault(), this.plugin.startNewThread(), this.renderChatView());
    }));
  let l = a.createEl("button", {
    cls: "clickable-icon pi-agent-thread-menu is-active",
    attr: { "aria-label": "Back to chat", title: "Back to chat" }
  });
  ((0, f.setIcon)(l, "list"),
    l.addEventListener("click", (d) => {
      (d.preventDefault(), this.renderChatView());
    }));
  let u = a.createEl("button", {
    cls: "clickable-icon pi-agent-header-action",
    attr: { "aria-label": "Open Pi Agent settings", title: "Open Pi Agent settings" }
  });
  ((0, f.setIcon)(u, "settings"),
    u.addEventListener("click", (d) => {
      (d.preventDefault(), this.openPluginSettings());
    }));
}

export function renderThreadListRow(e, t, n) {
  let s = e.createDiv({
      cls: `pi-agent-thread-list-row${n ? " is-current" : ""}`
    }),
    a = s.createSpan({
      cls: `pi-agent-thread-list-row-icon${this.isThreadRunning(t.id) ? " is-running" : ""}`
    }),
    o = s.createDiv({ cls: "pi-agent-thread-list-info" }),
    l = o.createDiv({
      cls: "pi-agent-thread-list-title",
      attr: { title: "Open chat" }
    });
  (0, f.setIcon)(a, this.isThreadRunning(t.id) ? "loader" : "message-circle");
  if (t.favorite) {
    let h = l.createSpan({
      cls: "pi-agent-thread-list-favorite-indicator",
      attr: { title: "Favorite chat" }
    });
    (0, f.setIcon)(h, "star");
  }
  l.createSpan({ text: t.title });
  (s.addEventListener("click", () => {
    (this.plugin.switchThread(t.id), this.renderChatView());
  }),
    o.createDiv({ cls: "pi-agent-thread-list-meta", text: this.formatThreadMeta(t, n) }));
  let d = s.createDiv({ cls: "pi-agent-thread-list-actions" }),
    h = d.createEl("button", {
      cls: "clickable-icon pi-agent-thread-list-action",
      attr: { "aria-label": "Thread actions", title: "Thread actions" }
    });
  ((0, f.setIcon)(h, "more-vertical"),
    h.addEventListener("click", (u) => {
      (u.preventDefault(), u.stopPropagation(), this.showThreadRowMenu(u, t, n, l));
    }));
}

export function showThreadRowMenu(e, t, n, s) {
  let a = new f.Menu();
  (a.addItem((o) =>
    o
      .setTitle(n ? "Current chat" : "Open")
      .setIcon(n ? "check" : "arrow-right")
      .setDisabled(n)
      .onClick(() => {
        (this.plugin.switchThread(t.id), this.renderChatView());
      })
  ),
    a.addItem((o) =>
      o
        .setTitle(t.favorite ? "Remove favorite" : "Mark as favorite")
        .setIcon("star")
        .onClick(() => this.toggleThreadFavorite(t))
    ),
    a.addItem((o) =>
      o
        .setTitle("Rename")
        .setIcon("pencil")
        .onClick(() => this.startThreadListRename(t, s))
    ),
    a.addSeparator(),
    a.addItem((o) =>
      o
        .setTitle("Delete")
        .setIcon("trash-2")
        .onClick(() => this.deleteThreadFromList(t))
    ),
    a.showAtMouseEvent(e));
}

export function startThreadListRename(e, t) {
  let n = document.createElement("input");
  (n.addClass("pi-agent-thread-list-title-input"),
    n.setAttr("type", "text"),
    n.setAttr("aria-label", "Chat title"),
    (n.value = e.title),
    t.replaceWith(n));
  let s = (a) => {
    let o = n.value.trim();
    (a && o && o !== e.title && this.plugin.renameThread(e.id, o), this.renderThreadList());
  };
  (n.addEventListener("click", (a) => a.stopPropagation()),
    n.addEventListener("keydown", (a) => {
      a.key === "Enter"
        ? (a.preventDefault(), s(!0))
        : a.key === "Escape" && (a.preventDefault(), s(!1));
    }),
    n.addEventListener("blur", () => s(!0)),
    n.focus(),
    n.select());
}

export function toggleThreadFavorite(e) {
  this.plugin.toggleThreadFavorite(e.id)
    ? this.renderThreadList()
    : new f.Notice("Chat thread was not found.");
}

export async function deleteThreadFromList(e) {
  if (this.isThreadRunning(e.id)) {
    new f.Notice("Wait for the agent run to finish before deleting this chat.");
    return;
  }
  let t = await confirmWithModal(this.plugin.app, {
    title: "Delete chat?",
    message: `Delete chat "${e.title}" from plugin history?`,
    confirmText: "Delete",
    warning: true
  });
  if (!t) return;
  this.plugin.deleteThread(e.id)
    ? (new f.Notice("Chat deleted."), this.renderThreadList())
    : new f.Notice("Chat thread was not found.");
}

export function formatThreadMeta(e, t) {
  let n = this.plugin.getThreadDisplayMessageCount
      ? this.plugin.getThreadDisplayMessageCount(e)
      : e.messages.length,
    s = `${n} message${n === 1 ? "" : "s"} • Updated ${this.formatThreadDate(e.updatedAt)}`;
  return t ? `Current • ${s}` : s;
}

export function formatThreadDate(e) {
  try {
    return new Date(e).toLocaleString();
  } catch {
    return "unknown date";
  }
}
