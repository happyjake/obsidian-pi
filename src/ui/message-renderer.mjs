import * as f from "obsidian";
import { formatToolStatus } from "./activity.mjs";

export function renderMessages() {
  this.syncCurrentRunFlags();
  if (!this.messagesEl) return;
  let e = this.messagesEl,
    t = this.stickToBottom,
    n = e.scrollTop;
  ((this.isRenderingMessages = !0),
    (this.activityItemEl = void 0),
    (this.activityInlineEl = void 0),
    (this.activityInlineTextEl = void 0),
    this.unloadMessageRenderComponents(),
    (this.activityDetailsEl = void 0),
    (this.activityDetailsSignature = ""),
    e.empty());
  let s = this.plugin.messages;
  if (s.length === 0) {
    (this.renderEmptyState(), this.restoreMessagesScroll(e, t, n), (this.isRenderingMessages = !1));
    return;
  }
  for (let a = 0; a < s.length; a++) this.renderMessage(s[a], a);
  (this.running && this.streamingAssistantContent
    ? this.renderStreamingAssistantMessage()
    : this.running && this.activityText && this.renderActivityMessage(),
    this.restoreMessagesScroll(e, t, n),
    (this.isRenderingMessages = !1));
}

export function restoreMessagesScroll(e, t, n) {
  t ? (e.scrollTop = e.scrollHeight) : (e.scrollTop = Math.min(n, e.scrollHeight));
}

export function renderEmptyState() {
  if (!this.messagesEl) return;
  let e = this.messagesEl.createDiv({ cls: "pi-agent-empty-state" }),
    t = e.createSpan({ cls: "pi-agent-empty-icon" });
  ((0, f.setIcon)(t, "sparkles"),
    e.createDiv({ cls: "pi-agent-empty-title", text: "Ask Pi about your notes" }));
  let n = e.createDiv({ cls: "pi-agent-empty-actions" }),
    s = [
      {
        icon: "file-text",
        label: "Summarize current note",
        prompt:
          "Use the active note as context. Summarize the key facts, assumptions, and useful follow-up questions."
      },
      {
        icon: "network",
        label: "Research around this note",
        prompt:
          "Research around the active note using backlinks, outgoing links, unresolved links, tags, and search results. Return concise findings with vault references."
      },
      {
        icon: "list-plus",
        label: "Suggest frontmatter",
        prompt:
          "Suggest useful YAML frontmatter for the active note. Preserve existing fields and return only the frontmatter block plus a brief rationale."
      }
    ];
  for (let a of s) {
    let o = n.createEl("button", {
      cls: "pi-agent-empty-action",
      attr: { type: "button" }
    });
    ((0, f.setIcon)(o, a.icon),
      o.createSpan({ text: a.label }),
      o.addEventListener("click", () => this.runPrompt(a.prompt)));
  }
}

export function renderMessage(e, t) {
  if (!this.messagesEl) return;
  let n = this.messagesEl.createDiv({
    cls: `pi-agent-message pi-agent-message-${e.role}`
  });
  this.renderRoleLabel(n, e.role === "user" ? "user" : "pi", e, t);
  let s = n.createDiv({ cls: "pi-agent-message-content" });
  this.renderPlainMessageContent(s, e.content);
}

export function renderPlainMessageContent(container, content) {
  container.empty();
  container.addClass("markdown-rendered");

  const component = new f.Component();
  component.load();
  this.messageRenderComponents.push(component);

  f.MarkdownRenderer.render(
    this.plugin.app,
    content || "",
    container,
    this.plugin.getCurrentContextFile()?.path ?? "",
    component
  ).catch((err) => {
    console.error("Pi Agent: Markdown render error", err);
    container.setText(content || "");
  });
}

export function unloadMessageRenderComponents() {
  for (const component of this.messageRenderComponents.splice(0)) component.unload();
}

export function renderStreamingAssistantMessage() {
  if (!this.messagesEl) return;
  let e = this.messagesEl.createDiv({
    cls: "pi-agent-message pi-agent-message-assistant pi-agent-message-streaming"
  });
  ((this.streamingItemEl = e), this.renderRoleLabel(e, "pi"));
  let t = e.createDiv({
    cls: "pi-agent-message-content pi-agent-message-content-streaming"
  });
  ((this.streamingTextEl = t.createSpan({
    cls: "pi-agent-streaming-text"
  })),
    this.streamingTextEl.setText(this.streamingAssistantContent),
    t.createSpan({ cls: "pi-agent-typing-cursor", text: "\u258C" }));
}

export function renderActivityMessage() {
  if (!this.messagesEl) return;
  let e = this.messagesEl.createDiv({
    cls: "pi-agent-message pi-agent-message-assistant pi-agent-message-activity"
  });
  this.activityItemEl = e;
  this.renderRoleLabel(e, "pi");
  let t = this.getVisibleActivityDetails();
  t.length > 0 && this.renderActivityDetails(e, t);
}

export function getVisibleActivityDetails() {
  if (this.activeToolCalls.size < 2) return [];
  return [...this.activeToolCalls.values()].map(
    (e) => formatToolStatus(e.name, e.args, "running").label
  );
}

export function renderActivityDetails(e, t) {
  let n = e.createDiv({ cls: "pi-agent-activity-details" });
  ((this.activityDetailsEl = n), (this.activityDetailsSignature = t.join("\n")));
  for (let s of t.slice(0, 5)) n.createDiv({ cls: "pi-agent-activity-detail", text: s });
}

export function renderRoleLabel(e, t, n, s) {
  let a = e.createDiv({ cls: "pi-agent-message-role" }),
    o = a.createSpan({ cls: "pi-agent-message-role-title" }),
    l = o.createSpan({
      cls: `pi-agent-role-icon pi-agent-role-icon-${t}`
    });
  if (t === "user") ((0, f.setIcon)(l, "user"), o.createSpan({ text: "You" }));
  else if (
    (this.renderPiIcon(l), o.createSpan({ text: "Agent" }), !n && this.running && this.activityText)
  ) {
    let h = o.createSpan({
      cls: `pi-agent-inline-activity pi-agent-activity-${this.activityKind}`,
      attr: { title: this.activityDetail || this.activityText }
    });
    ((this.activityInlineEl = h),
      (this.activityInlineTextEl = h.createSpan({
        cls: "pi-agent-inline-activity-text",
        text: this.activityText
      })));
  }
  if (n && s !== void 0) {
    let u = a.createEl("button", {
      cls: "clickable-icon pi-agent-message-actions",
      attr: { "aria-label": "Message actions" }
    });
    ((0, f.setIcon)(u, "ellipsis"),
      u.addEventListener("click", (g) => {
        var m;
        (g.preventDefault(),
          g.stopPropagation(),
          (m = this.messageActions) == null || m.showMessageMenu(g, n, s));
      }));
  }
}
