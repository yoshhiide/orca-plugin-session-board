// src/model.ts
var states = {
  input: "\u5165\u529B\u5F85\u3061",
  working: "\u4F5C\u696D\u4E2D",
  external: "\u5916\u90E8\u5F85\u3061",
  blocked: "\u30D6\u30ED\u30C3\u30AF\u4E2D",
  waiting: "\u5F85\u6A5F\u4E2D",
  planned: "\u4E88\u5B9A",
  failed: "\u5931\u6557",
  done: "\u5B8C\u4E86",
  cancelled: "\u4E2D\u6B62",
  unknown: "\u72B6\u614B\u4E0D\u660E"
};
var activityWindow = 120 * 60 * 60 * 1e3;
function isBot(row) {
  return row.source === "Bot Item" || row.source === "Bot \u30EF\u30FC\u30AB\u30FC";
}

// src/activity-view.ts
var day = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
var time = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" });
var make = (tag, text = "", className = "") => {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
};
function inline(target, text) {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    target.append(document.createTextNode(text.slice(last, index)));
    const token = match[0];
    if (token.startsWith("[")) {
      const parts = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
      if (parts && (index === 0 || text[index - 1] !== "!")) {
        const link = make("a", parts[1]);
        link.href = parts[2];
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        target.append(link);
      } else target.append(document.createTextNode(token));
    } else {
      const strong = token.startsWith("**") || token.startsWith("__");
      target.append(make(token.startsWith("`") ? "code" : strong ? "strong" : "em", token.slice(strong ? 2 : 1, strong ? -2 : -1)));
    }
    last = index + token.length;
  }
  target.append(document.createTextNode(text.slice(last)));
}
function markdown(text) {
  const root2 = make("div", "", "message-body");
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) {
      i++;
      continue;
    }
    if (/^\s*```/.test(lines[i])) {
      i++;
      const code = [];
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      const pre = make("pre");
      pre.append(make("code", code.join("\n")));
      root2.append(pre);
      continue;
    }
    if (/^>\s?/.test(lines[i])) {
      const quote = make("blockquote");
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        const p2 = make("p");
        inline(p2, lines[i++].replace(/^>\s?/, ""));
        quote.append(p2);
      }
      root2.append(quote);
      continue;
    }
    const heading2 = /^(#{1,4})\s+(.+)$/.exec(lines[i]);
    if (heading2) {
      const el = make("strong", "", "markdown-heading");
      inline(el, heading2[2]);
      root2.append(el);
      i++;
      continue;
    }
    const listMatch = /^\s*(?:([-*+])\s+|(\d+)\.\s+)(.*)$/.exec(lines[i]);
    if (listMatch) {
      const ordered = !!listMatch[2], list = make(ordered ? "ol" : "ul");
      while (i < lines.length) {
        const item = /^\s*(?:([-*+])\s+|(\d+)\.\s+)(.*)$/.exec(lines[i]);
        if (!item || !!item[2] !== ordered) break;
        const li = make("li");
        inline(li, item[3]);
        list.append(li);
        i++;
      }
      root2.append(list);
      continue;
    }
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^\s*```/.test(lines[i]) && !/^(#{1,4})\s+(.+)$/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !/^\s*(?:[-*+]\s+|\d+\.\s+)/.test(lines[i])) paragraph.push(lines[i++]);
    const p = make("p");
    inline(p, paragraph.join("\n"));
    root2.append(p);
  }
  return root2;
}
function validImage(src) {
  return src.length <= 8e6 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(src);
}
function imageButton(image) {
  const control = make("button", "", "activity-image");
  control.type = "button";
  control.setAttribute("aria-label", (image.alt || "\u753B\u50CF") + "\u3092\u62E1\u5927");
  const thumb = make("img");
  thumb.src = image.src;
  thumb.alt = image.alt;
  thumb.loading = "lazy";
  control.append(thumb);
  control.addEventListener("click", () => {
    const viewer = make("dialog", "", "image-viewer");
    viewer.setAttribute("aria-label", image.alt || "\u753B\u50CF\u30D7\u30EC\u30D3\u30E5\u30FC");
    const close = make("button", "\u9589\u3058\u308B", "image-close");
    close.type = "button";
    const full = make("img");
    full.src = image.src;
    full.alt = image.alt;
    close.addEventListener("click", () => viewer.close());
    viewer.addEventListener("cancel", (event) => {
      event.stopPropagation();
    });
    viewer.addEventListener("close", () => {
      viewer.remove();
      if (control.isConnected) control.focus();
      else {
        const fallback = document.querySelector('#activity-tab[aria-selected="true"]') ?? document.querySelector("#session-title");
        if (fallback && fallback.getClientRects().length) fallback.focus();
      }
    });
    viewer.append(close, full);
    document.body.append(viewer);
    viewer.showModal();
    close.focus();
  });
  if (!image.alt) return control;
  const figure = make("figure");
  figure.append(control, make("figcaption", image.alt));
  return figure;
}
function renderActivity(container, data, related, routeHint) {
  if (related) container.append(make("h3", "\u95A2\u9023\u3059\u308BBot\u30C1\u30E3\u30C3\u30C8", "activity-heading"));
  container.append(make("p", "\u51FA\u5178\uFF1A" + data.source, "small source"));
  if (data.issue) container.append(make("p", data.issue, "small"));
  if (data.navigationHint) container.append(make("p", data.navigationHint, "small image-route"));
  let previousDay = "";
  let previous;
  let unknownShown = false;
  let imageRouteShown = Boolean(data.navigationHint);
  for (const entry of data.entries) {
    const date2 = entry.at && Number.isFinite(entry.at) ? new Date(entry.at) : void 0;
    const valid = date2 && !Number.isNaN(date2.getTime()) ? date2 : void 0;
    const key = valid ? valid.toDateString() : "";
    if (valid && key !== previousDay) {
      container.append(make("h4", day.format(valid), "activity-day"));
    } else if (!valid && !unknownShown) {
      container.append(make("p", "\u65E5\u6642\u4E0D\u660E\u306EActivity\u3092\u542B\u307F\u307E\u3059", "small activity-unknown"));
      unknownShown = true;
    }
    const message = make("article", "", "message");
    const speaker = entry.kind ? void 0 : entry.speaker;
    message.dataset.side = entry.kind ? "event" : speaker?.side ?? "neutral";
    if (speaker && previous?.speaker && key === previousDay && speaker.id === previous.speaker.id && speaker.side === previous.speaker.side && entry.author === previous.author) message.dataset.repeat = "";
    previousDay = key;
    previous = speaker ? entry : void 0;
    const head = make("header");
    const label = entry.kind === "image-view" ? "\u753B\u50CF\u3092\u8868\u793A" + (entry.count && entry.count > 1 ? `\uFF08${entry.count}\u4EF6\uFF09` : "") : entry.author;
    head.append(make("strong", label));
    if (valid) {
      const clock = make("time", time.format(valid), "small");
      clock.dateTime = valid.toISOString();
      head.append(clock);
    }
    message.append(head);
    const surface = make("div", "", "message-surface");
    if (entry.kind === "image-view") {
      if (!imageRouteShown && (entry.body || routeHint)) {
        surface.append(make("p", entry.body || routeHint, "small image-route"));
        imageRouteShown = true;
      }
    } else if (entry.body) surface.append(entry.kind === "terminal-output" ? make("pre", entry.body, "terminal-output") : markdown(entry.body));
    const images = (entry.images ?? []).filter((image) => validImage(image.src));
    if (images.length) {
      const attachments = make("div", "", "activity-images");
      attachments.append(...images.map(imageButton));
      surface.append(attachments);
    }
    if (surface.hasChildNodes()) message.append(surface);
    container.append(message);
  }
  if (!data.entries.length && !data.issue) container.append(make("p", "\u8868\u793A\u3067\u304D\u308BActivity\u306F\u3042\u308A\u307E\u305B\u3093\u3002", "small source"));
}

// src/panel.ts
var doc = document;
var date = new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "medium" });
var stamp = (at) => at ? date.format(at) : "\u65E5\u6642\u4E0D\u660E";
var relativeTime = new Intl.RelativeTimeFormat("ja-JP", { numeric: "auto" });
var kinds = {
  "Bot Item": "Bot",
  "Bot \u30EF\u30FC\u30AB\u30FC": "\u30EF\u30FC\u30AB\u30FC",
  "Orca \u30C1\u30E3\u30C3\u30C8": "\u30C1\u30E3\u30C3\u30C8",
  "Orca \u30BF\u30FC\u30DF\u30CA\u30EB": "\u7AEF\u672B"
};
function age(at, now) {
  const minutes = Math.trunc((at - now) / 6e4);
  if (!minutes) return "\u305F\u3063\u305F\u4ECA";
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  if (Math.abs(minutes) < 1440) return relativeTime.format(Math.trunc(minutes / 60), "hour");
  return relativeTime.format(Math.trunc(minutes / 1440), "day");
}
function node(tag, content = "", className = "") {
  const element = doc.createElement(tag);
  element.textContent = content;
  if (className) element.className = className;
  return element;
}
function button(label, run, className = "") {
  const element = node("button", label, className);
  element.type = "button";
  element.addEventListener("click", run);
  return element;
}
var style = doc.createElement("link");
style.rel = "stylesheet";
style.href = new URL("./panel.css", import.meta.url).href;
doc.head.append(style);
doc.documentElement.lang = "ja";
doc.title = "\u30BB\u30C3\u30B7\u30E7\u30F3\u30DC\u30FC\u30C9";
var root = node("main");
var header = node("header");
var heading = node("div", "", "bar top");
var title = node("h1", "\u30BB\u30C3\u30B7\u30E7\u30F3");
var refresh = button("\u66F4\u65B0", async () => {
  refresh.disabled = true;
  try {
    accept(await orca.plugin.request("board.refresh"));
  } catch {
    status.textContent = "\u30EF\u30FC\u30AB\u30FC\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093\u3002\u66F4\u65B0\u3067\u518D\u8A66\u884C\u3067\u304D\u307E\u3059\u3002";
  } finally {
    refresh.disabled = false;
  }
});
heading.append(title, refresh);
var tabbar = node("div", "", "bar");
tabbar.setAttribute("role", "group");
tabbar.setAttribute("aria-label", "\u8868\u793A\u3059\u308B\u5BFE\u8C61");
var viewbar = node("div", "", "bar");
viewbar.setAttribute("role", "group");
viewbar.setAttribute("aria-label", "\u8868\u793A\u5F62\u5F0F");
var query = node("input");
query.type = "search";
query.placeholder = "\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u691C\u7D22";
query.setAttribute("aria-label", query.placeholder);
query.oninput = render;
var status = node("p", "\u53D6\u5F97\u4E2D\u2026", "status");
status.setAttribute("role", "status");
var health = node("details", "", "health");
var healthTitle = node("summary", "\u53D6\u5F97\u72B6\u6CC1");
var healthList = node("ul");
health.append(healthTitle, healthList);
var results = node("section");
results.setAttribute("aria-label", "\u30BB\u30C3\u30B7\u30E7\u30F3\u4E00\u89A7");
header.append(heading, tabbar, query, viewbar, status, health);
root.append(header, results);
doc.body.append(root);
var dialog = node("section", "", "detail");
dialog.id = "session-detail";
var dialogHead = node("header", "", "detail-head");
var dialogTitle = node("h2");
dialogTitle.id = "session-title";
dialog.setAttribute("aria-labelledby", dialogTitle.id);
var back = button("\u2190 \u30BB\u30C3\u30B7\u30E7\u30F3\u4E00\u89A7", closeDetail, "back");
var detailControls = node("div", "", "bar top");
var retryDetail = button("\u66F4\u65B0", () => loadDetail(opened, viewedQuestionId));
dialogTitle.tabIndex = -1;
detailControls.append(back, retryDetail);
dialogHead.append(detailControls, dialogTitle);
var details = node("div", "", "detail-meta");
var action = node("div", "", "bar");
var detailStatus = node("p", "", "status");
detailStatus.setAttribute("role", "status");
var question = node("section", "", "question");
var tabs = node("div", "", "tabs");
tabs.setAttribute("role", "tablist");
tabs.setAttribute("aria-label", "\u8A73\u7D30\u8868\u793A");
var activity = node("section", "", "activity");
var timeline = node("section", "", "timeline");
activity.id = "activity";
timeline.id = "history";
activity.setAttribute("role", "tabpanel");
timeline.setAttribute("role", "tabpanel");
var activityTab = button("Activity", () => selectDetailTab(true), "tab");
var historyTab = button("\u72B6\u614B\u5C65\u6B74", () => selectDetailTab(false), "tab");
activityTab.id = "activity-tab";
historyTab.id = "history-tab";
activityTab.setAttribute("role", "tab");
historyTab.setAttribute("role", "tab");
activityTab.setAttribute("aria-controls", activity.id);
historyTab.setAttribute("aria-controls", timeline.id);
activity.setAttribute("aria-labelledby", activityTab.id);
timeline.setAttribute("aria-labelledby", historyTab.id);
tabs.append(activityTab, historyTab);
dialog.append(dialogHead, details, detailStatus, question, action, tabs, activity, timeline);
dialog.hidden = true;
root.after(dialog);
function selectDetailTab(showActivity) {
  activity.hidden = !showActivity;
  timeline.hidden = showActivity;
  activityTab.setAttribute("aria-selected", String(showActivity));
  historyTab.setAttribute("aria-selected", String(!showActivity));
  activityTab.tabIndex = showActivity ? 0 : -1;
  historyTab.tabIndex = showActivity ? -1 : 0;
}
selectDetailTab(true);
tabs.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const showActivity = event.key === "Home" || event.key !== "End" && doc.activeElement === historyTab;
  selectDetailTab(showActivity);
  (showActivity ? activityTab : historyTab).focus();
});
var board;
var filter = "all";
var layout = "list";
var opened = "";
var generation = 0;
var viewedQuestionId;
function closeDetail() {
  const previous = rowButton(opened);
  opened = "";
  viewedQuestionId = void 0;
  generation++;
  currentDetail = void 0;
  details.replaceChildren();
  question.replaceChildren();
  action.replaceChildren();
  activity.replaceChildren();
  timeline.replaceChildren();
  dialog.hidden = true;
  root.hidden = false;
  (previous ?? query).focus();
}
dialog.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeDetail();
});
for (const [key, label] of [["all", "\u3059\u3079\u3066"], ["bot", "Bot"], ["session", "\u901A\u5E38"]]) {
  const control = button(label, () => {
    filter = key;
    render();
  });
  control.dataset.value = key;
  tabbar.append(control);
}
for (const [key, label] of [["list", "\u30EA\u30B9\u30C8"], ["board", "\u30DC\u30FC\u30C9"]]) {
  const control = button(label, () => {
    layout = key;
    render();
  });
  control.dataset.value = key;
  viewbar.append(control);
}
function selectControls(group, value) {
  for (const control of group.querySelectorAll("button")) {
    control.setAttribute("aria-pressed", String(control.dataset.value === value));
  }
}
function accept(value) {
  if (!value.sources.length && board?.sources.length) return;
  const previous = board?.rows.find((row) => row.id === opened);
  const next = value.rows.find((row) => row.id === opened);
  board = value;
  render();
  if (!opened) return;
  if (!next) {
    closeDetail();
    return;
  }
  const changed = !previous || previous.cursor !== next.cursor || previous.state !== next.state || previous.stale !== next.stale || previous.questionId !== next.questionId;
  if (!changed) return;
  if (!next.stale) loadDetail(opened, viewedQuestionId);
  else {
    generation++;
    currentDetail = void 0;
    detailStatus.textContent = "\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3002\u66F4\u65B0\u3057\u3066\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
    activity.replaceChildren();
    timeline.replaceChildren();
    renderDetails();
  }
}
function rowButton(id) {
  return [...results.querySelectorAll("button")].find((control) => control.dataset.row === id);
}
function render() {
  selectControls(tabbar, filter);
  selectControls(viewbar, layout);
  if (!board) return;
  const { rows, sources, notificationIssue, hiddenRows } = board;
  const unavailable = sources.filter((source) => source.issue).length;
  const input = rows.filter((row) => row.state === "input" && !row.stale).length;
  status.textContent = !sources.length ? "\u53D6\u5F97\u4E2D\u2026" : "\u5165\u529B\u5F85\u3061 " + input + " \u4EF6" + (unavailable ? " \xB7 \u53D6\u5F97\u3067\u304D\u306A\u3044\u30BD\u30FC\u30B9 " + unavailable + " \u4EF6" : "") + (notificationIssue ? " \xB7 \u901A\u77E5\u30A8\u30E9\u30FC" : "");
  healthList.replaceChildren(...sources.map((source) => node("li", source.label + " \xB7 " + (source.at ? stamp(source.at) : "\u672A\u53D6\u5F97") + (source.issue ? " \xB7 " + source.issue : ""))));
  if (notificationIssue) healthList.append(node("li", notificationIssue));
  if (hiddenRows) healthList.append(node("li", "\u8868\u793A\u4E0A\u9650\u306B\u3088\u308A " + hiddenRows + " \u4EF6\u3092\u7701\u7565\u3057\u307E\u3057\u305F\u3002"));
  healthList.append(node("li", "Bot\u3068\u30C1\u30E3\u30C3\u30C8\u306F15\u79D2\u3054\u3068\u306B\u53D6\u5F97\u3057\u307E\u3059\u3002\u5DEE\u5206\u53D6\u5F97\u3067\u306F\u77ED\u3044\u9077\u79FB\u3092\u898B\u843D\u3068\u3059\u5834\u5408\u304C\u3042\u308A\u307E\u3059\u3002"));
  healthList.append(node("li", "\u4E00\u5EA6\u958B\u304F\u3068\u3001\u30EF\u30FC\u30AB\u30FC\u7A3C\u50CD\u4E2D\u306F\u30D1\u30CD\u30EB\u3092\u9589\u3058\u3066\u3082\u76E3\u8996\u3057\u307E\u3059\u3002"));
  const words = query.value.normalize("NFKC").toLocaleLowerCase("ja").trim().split(/\s+/).filter(Boolean);
  const filtered = rows.filter((row) => {
    if (filter !== "all" && filter === "bot" !== isBot(row)) return false;
    const searchable = [row.title, row.origin, row.ref, row.source, states[row.state], row.reason].join(" ").normalize("NFKC").toLocaleLowerCase("ja");
    return words.every((word) => searchable.includes(word));
  });
  const focusedElement = doc.activeElement;
  const focused = focusedElement?.dataset.row;
  const focusedReply = focusedElement?.dataset.rowReply;
  const now = Date.now();
  results.classList.toggle("board", layout === "board");
  const groups = Object.keys(states).flatMap((state) => {
    const group = filtered.filter((row) => row.state === state);
    if (!group.length) return [];
    const block = node("section", "", "group " + state);
    const groupTitle = node("h2", states[state]);
    groupTitle.append(node("span", String(group.length), "count"));
    const list = node("ul");
    for (const row of group) {
      const control = button("", () => open(row.id), "entry");
      control.dataset.row = row.id;
      control.setAttribute("aria-controls", dialog.id);
      const primary = node("span", "", "row-line");
      primary.append(node("span", kinds[row.source], "row-kind"), node("span", row.title, "row-title"));
      const secondary = node("span", "", "row-line meta");
      secondary.append(node("span", row.origin, "row-origin"));
      if (row.reason) secondary.append(node("span", row.reason, "row-reason"));
      if (row.stale) secondary.append(node("span", "\u53D6\u5F97\u4E0D\u80FD", "row-age"));
      else if (row.at) {
        const time2 = node("time", age(row.at, now), "row-age");
        time2.dateTime = new Date(row.at).toISOString();
        secondary.append(time2);
      }
      control.append(primary, secondary);
      const item = node("li");
      item.className = "entry-row";
      item.append(control);
      if (row.source === "Bot Item") {
        const reply = button("\u8FD4\u4FE1", () => void replyToItem(row.id), "row-reply");
        reply.dataset.rowReply = row.id;
        reply.setAttribute("aria-label", row.title + "\u306B\u8FD4\u4FE1\uFF08" + row.origin + "\uFF09");
        reply.disabled = row.stale;
        item.append(reply);
      }
      list.append(item);
    }
    block.append(groupTitle, list);
    return [block];
  });
  results.replaceChildren(...groups);
  if (!groups.length && sources.length) results.append(node(
    "p",
    unavailable ? "\u8868\u793A\u3067\u304D\u308B\u30BB\u30C3\u30B7\u30E7\u30F3\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u53D6\u5F97\u72B6\u6CC1\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : "\u8A72\u5F53\u3059\u308B\u30BB\u30C3\u30B7\u30E7\u30F3\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
    "status"
  ));
  if (focused || focusedReply) {
    const next = focusedReply && [...results.querySelectorAll(".row-reply")].find((control) => control.dataset.rowReply === focusedReply) || focused && rowButton(focused) || query;
    next.focus({ preventScroll: true });
  }
}
async function replyToItem(id, questionId, index) {
  try {
    const result = await orca.plugin.request("board.reply", questionId === void 0 ? { id } : { id, questionId, index });
    if (result.reason === "choose") {
      if (opened !== id) open(id);
      else loadDetail(id);
      return;
    }
    if (result.reason === "read-only") {
      if (opened === id) detailStatus.textContent = "\u6A19\u6E96\u753B\u9762\u3092\u958B\u304D\u307E\u3057\u305F\u3002\u7DE8\u96C6\u306F\u3067\u304D\u307E\u305B\u3093\u3002";
      else status.textContent = "\u6A19\u6E96\u753B\u9762\u3092\u958B\u304D\u307E\u3057\u305F\u3002\u7DE8\u96C6\u306F\u3067\u304D\u307E\u305B\u3093\u3002";
    } else if (!result.opened) {
      const message = result.reason === "changed" ? "\u72B6\u614B\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : "\u6A19\u6E96\u306E\u8FD4\u4FE1\u753B\u9762\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002";
      if (opened === id) loadDetail(id, questionId, message);
      else open(id, message);
    }
  } catch {
    if (opened === id) detailStatus.textContent = "\u8FD4\u4FE1\u753B\u9762\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u66F4\u65B0\u3057\u3066\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
    else status.textContent = "\u8FD4\u4FE1\u753B\u9762\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u66F4\u65B0\u3057\u3066\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
  }
}
var currentDetail;
function renderDetails() {
  const row = board?.rows.find((entry) => entry.id === opened);
  if (!row) {
    const hadActionFocus2 = action.contains(doc.activeElement);
    dialogTitle.textContent = "\u5BFE\u8C61\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093";
    details.replaceChildren();
    question.replaceChildren();
    action.replaceChildren();
    if (hadActionFocus2) back.focus({ preventScroll: true });
    return;
  }
  dialogTitle.textContent = row.title;
  const meta = node("p", [kinds[row.source], row.origin, row.at ? age(row.at, Date.now()) : "\u65E5\u6642\u4E0D\u660E"].join(" \xB7 "), "muted");
  const state = currentDetail?.state ?? row.state;
  const badge = node("span", states[state] + (row.stale ? "\uFF08\u53D6\u5F97\u4E0D\u80FD\uFF09" : ""), "badge " + state);
  details.replaceChildren(meta, badge);
  if (row.at) details.append(node("p", "\u66F4\u65B0\uFF1A" + stamp(row.at), "small detail-updated"));
  const reason = currentDetail?.reason ?? (state === "external" && !row.stale ? row.reason : void 0);
  if (reason && reason !== currentDetail?.question?.prompt) details.append(node("p", reason, "detail-reason"));
  const focusedReply = doc.activeElement?.dataset.replyIndex;
  const hadActionFocus = action.contains(doc.activeElement);
  question.replaceChildren();
  const q = currentDetail?.question;
  if (q && !row.stale && currentDetail?.questionStatus !== "answered" && currentDetail?.questionStatus !== "unverified") {
    question.append(node("h3", currentDetail?.questionStatus === "replaced" ? "\u73FE\u5728\u306E\u8CEA\u554F" : "\u56DE\u7B54\u3092\u5F85\u3063\u3066\u3044\u307E\u3059"));
    const addPrompt = (prompt, options, index) => {
      const group = node("div", "", "question-prompt");
      if (prompt) group.append(node("p", prompt));
      if (options.length) {
        const choices = node("ul", "", "read-choices");
        choices.append(...options.map((choice) => node("li", choice)));
        group.append(choices);
      }
      if (row.source === "Bot Item" && state === "input" && q.eventId && q.targets?.includes(index)) {
        const control = button("\u6A19\u6E96\u753B\u9762\u3067\u56DE\u7B54", () => void replyToItem(opened, q.eventId, index), "primary reply");
        control.dataset.replyIndex = String(index);
        group.append(control);
      }
      question.append(group);
    };
    if (q.decisions?.length) {
      if (q.prompt) question.append(node("p", q.prompt));
      if (q.options.length) {
        const choices = node("ul", "", "read-choices");
        choices.append(...q.options.map((choice) => node("li", choice)));
        question.append(choices);
      }
      q.decisions.forEach((decision, index) => addPrompt(decision.prompt, decision.options, index));
    } else addPrompt(q.prompt, q.options, 0);
  }
  question.hidden = !question.childElementCount;
  action.replaceChildren();
  if (row.source === "Bot Item") {
    const reply = button("\u8FD4\u4FE1", () => void replyToItem(row.id), "primary");
    reply.disabled = row.stale;
    action.append(reply);
  }
  const kind = currentDetail?.action;
  const label = kind === "bot-home" ? "Bot Home\u3092\u958B\u304F \u2197" : kind === "terminal" ? "\u30BF\u30FC\u30DF\u30CA\u30EB\u3092\u958B\u304F \u2197" : "";
  if (label && !row.stale && row.source !== "Bot Item") action.append(button(label, async () => {
    const targetId = opened;
    try {
      const questionId = currentDetail?.question?.eventId;
      const input = questionId ? { id: targetId, questionId } : { id: targetId };
      const result = await orca.plugin.request("board.focus", input);
      if (targetId !== opened) return;
      if (!result) {
        detailStatus.textContent = "\u79FB\u52D5\u5148\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u8A73\u7D30\u3092\u66F4\u65B0\u3057\u307E\u3059\u3002";
        loadDetail(targetId, questionId, "\u79FB\u52D5\u5148\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u8868\u793A\u3057\u305F\u7D4C\u8DEF\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      }
    } catch {
      if (targetId === opened) detailStatus.textContent = "\u79FB\u52D5\u5148\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u66F4\u65B0\u3057\u3066\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
    }
  }, "primary"));
  if (currentDetail?.navigationHint && row.source !== "Bot Item" && !question.querySelector(".reply")) action.append(node("p", currentDetail.navigationHint, "route"));
  if (!question.hidden) question.append(action);
  else dialog.insertBefore(action, tabs);
  if (focusedReply !== void 0) (question.querySelector(`[data-reply-index="${focusedReply}"]`) ?? back).focus({ preventScroll: true });
  else if (hadActionFocus) (action.querySelector("button") ?? back).focus({ preventScroll: true });
}
function loadDetail(id, questionId, actionIssue) {
  const replyFocus = doc.activeElement?.dataset.replyIndex;
  const restoreActionFocus = action.contains(doc.activeElement) || replyFocus !== void 0;
  const request = ++generation;
  currentDetail = void 0;
  detailStatus.textContent = "\u8A73\u7D30\u3092\u53D6\u5F97\u4E2D\u2026";
  activity.replaceChildren();
  timeline.replaceChildren();
  renderDetails();
  void orca.plugin.request("board.detail", questionId ? { id, questionId } : { id }).then((result) => {
    if (request !== generation) return;
    currentDetail = result;
    viewedQuestionId = result.question?.eventId ?? viewedQuestionId;
    const notices = { answered: "\u3053\u306E\u8CEA\u554F\u306F\u56DE\u7B54\u6E08\u307F\u3067\u3059\u3002", replaced: "\u8CEA\u554F\u304C\u66F4\u65B0\u3055\u308C\u3066\u3044\u307E\u3059\u3002", unverified: "\u8CEA\u554F\u306E\u72B6\u614B\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002" };
    detailStatus.textContent = [
      result.questionStatus ? notices[result.questionStatus] : "",
      result.issue ?? actionIssue
    ].filter(Boolean).join(" ");
    activity.replaceChildren();
    if (result.activity) renderActivity(activity, result.activity, false, result.activity.navigationHint ?? result.navigationHint);
    else activity.append(node("p", "Activity\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3002", "small source"));
    if (result.relatedActivity) renderActivity(activity, result.relatedActivity, true, result.relatedActivity.navigationHint);
    timeline.replaceChildren(...result.transitions.map((move) => {
      const item = node("div", "", "history-row");
      item.append(node("span", states[move.from] + " \u2192 " + states[move.to]), node("p", stamp(move.at) + " \xB7 " + move.via, "small"));
      return item;
    }));
    if (!result.transitions.length) timeline.append(node("p", "\u78BA\u8A8D\u3067\u304D\u308B\u9077\u79FB\u306F\u3042\u308A\u307E\u305B\u3093\u3002", "small source"));
    renderDetails();
    if (restoreActionFocus && doc.activeElement === back) {
      const reply = replyFocus === void 0 ? null : question.querySelector(`[data-reply-index="${replyFocus}"]`);
      (reply ?? action.querySelector("button") ?? back).focus({ preventScroll: true });
    }
  }).catch(() => {
    if (request === generation) {
      currentDetail = void 0;
      detailStatus.textContent = "\u8A73\u7D30\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3002";
      activity.replaceChildren();
      timeline.replaceChildren();
      renderDetails();
    }
  });
}
function open(id, actionIssue) {
  opened = id;
  viewedQuestionId = void 0;
  currentDetail = void 0;
  activity.replaceChildren();
  timeline.replaceChildren();
  detailStatus.textContent = "\u8A73\u7D30\u3092\u53D6\u5F97\u4E2D\u2026";
  renderDetails();
  root.hidden = true;
  dialog.hidden = false;
  selectDetailTab(true);
  dialogTitle.focus();
  loadDetail(id, void 0, actionIssue);
}
render();
var subscription = orca.plugin.on("board.changed", accept);
window.addEventListener("pagehide", () => subscription.dispose(), { once: true });
void orca.plugin.request("board.start").then(accept).catch(() => {
  status.textContent = "\u30EF\u30FC\u30AB\u30FC\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093\u3002\u66F4\u65B0\u3067\u518D\u8A66\u884C\u3067\u304D\u307E\u3059\u3002";
});
