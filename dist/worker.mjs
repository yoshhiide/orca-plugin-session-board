// src/language.ts
function language(locale) {
  if (typeof locale !== "string") return "en";
  try {
    return new Intl.Locale(locale).language === "ja" ? "ja" : "en";
  } catch {
    return "en";
  }
}
function copy(en, ja) {
  return { en, ja };
}
function display(value, locale) {
  return typeof value === "string" ? value : value[locale];
}
function joinCopy(parts, separator) {
  return copy(
    parts.map((part) => display(part, "en")).join(separator),
    parts.map((part) => display(part, "ja")).join(separator)
  );
}
var replyMessages = {
  changed: copy("The Item changed. Review the latest details.", "\u72B6\u614B\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"),
  "target-unavailable": copy("Could not identify a single local Bot and Item. Open the matching Item in Orca.", "\u30ED\u30FC\u30AB\u30EB\u306EBot\u3068\u9805\u76EE\u3092\u7279\u5B9A\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002Orca\u3067\u5BFE\u8C61\u9805\u76EE\u3092\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002"),
  "platform-unavailable": copy("Automatic reply navigation requires macOS. Open the Item manually.", "\u81EA\u52D5\u3067\u8FD4\u4FE1\u6B04\u3092\u958B\u304F\u306B\u306FmacOS\u304C\u5FC5\u8981\u3067\u3059\u3002\u3053\u306E\u74B0\u5883\u3067\u306F\u9805\u76EE\u3092\u624B\u52D5\u3067\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002"),
  "accessibility-required": copy("To open the reply, allow Orca Computer Use in macOS Accessibility settings.", "\u8FD4\u4FE1\u753B\u9762\u3092\u958B\u304F\u306B\u306F\u3001macOS\u306E\u30A2\u30AF\u30BB\u30B7\u30D3\u30EA\u30C6\u30A3\u8A2D\u5B9A\u3067Orca Computer Use\u3092\u8A31\u53EF\u3057\u3066\u304F\u3060\u3055\u3044\u3002"),
  "window-unavailable": copy("Keep one Orca window visible in the current Space, then try again.", "\u73FE\u5728\u306ESpace\u306BOrca\u306E\u30A6\u30A3\u30F3\u30C9\u30A6\u30921\u3064\u3060\u3051\u8868\u793A\u3057\u3066\u304B\u3089\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002"),
  "bot-home-unavailable": copy("Could not verify that Bot Home opened. Open the target Bot\u2019s Home Chat and try again.", "Bot\u306E\u30DB\u30FC\u30E0\u304C\u958B\u3044\u305F\u3053\u3068\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5BFE\u8C61Bot\u306EHome Chat\u3092\u958B\u3044\u3066\u304B\u3089\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002"),
  "item-unavailable": copy("Could not locate the Item in Bot Home. Check the Item filter in Orca and try again.", "Bot\u306E\u30DB\u30FC\u30E0\u3067\u9805\u76EE\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002Orca\u3067\u9805\u76EE\u306E\u7D5E\u308A\u8FBC\u307F\u3092\u78BA\u8A8D\u3057\u3066\u304B\u3089\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002"),
  "question-unavailable": copy("Could not verify the selected question. Check the draft or current answer selection in Orca, then choose the question there.", "\u9078\u3093\u3060\u8CEA\u554F\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u6A19\u6E96\u753B\u9762\u3067\u4E0B\u66F8\u304D\u3084\u9078\u629E\u4E2D\u306E\u56DE\u7B54\u3092\u78BA\u8A8D\u3057\u3001\u8CEA\u554F\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002"),
  "composer-unavailable": copy("Could not focus the input. Check the reply destination in Orca and select the input field.", "\u5165\u529B\u6B04\u306B\u30D5\u30A9\u30FC\u30AB\u30B9\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u6A19\u6E96\u753B\u9762\u3067\u8FD4\u4FE1\u5148\u3092\u78BA\u8A8D\u3057\u3001\u5165\u529B\u6B04\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002")
};

// src/worker.ts
import { execFile as execFile3 } from "node:child_process";

// src/model.ts
var states = {
  input: copy("Needs input", "\u5165\u529B\u5F85\u3061"),
  working: copy("In progress", "\u4F5C\u696D\u4E2D"),
  external: copy("Waiting externally", "\u5916\u90E8\u5F85\u3061"),
  blocked: copy("Blocked", "\u30D6\u30ED\u30C3\u30AF\u4E2D"),
  waiting: copy("Idle", "\u5F85\u6A5F\u4E2D"),
  planned: copy("Planned", "\u4E88\u5B9A"),
  failed: copy("Failed", "\u5931\u6557"),
  done: copy("Done", "\u5B8C\u4E86"),
  cancelled: copy("Canceled", "\u4E2D\u6B62"),
  unknown: copy("Unknown", "\u72B6\u614B\u4E0D\u660E")
};
var sourceNames = {
  "Bot Item": "Bot Item",
  "Bot \u30EF\u30FC\u30AB\u30FC": copy("Bot worker", "Bot \u30EF\u30FC\u30AB\u30FC"),
  "Orca \u30C1\u30E3\u30C3\u30C8": copy("Orca chat", "Orca \u30C1\u30E3\u30C3\u30C8"),
  "Orca \u30BF\u30FC\u30DF\u30CA\u30EB": copy("Orca terminal", "Orca \u30BF\u30FC\u30DF\u30CA\u30EB")
};
var activityWindow = 120 * 60 * 60 * 1e3;
function withinActivityWindow(at, now) {
  return typeof at === "number" && Number.isSafeInteger(at) && at > 0 && at >= now - activityWindow && at <= now;
}
function itemState(value) {
  switch (value) {
    case "needs_you":
      return "input";
    case "working":
    case "in_progress":
      return "working";
    case "waiting":
      return "external";
    case "planned":
      return "planned";
    case "done":
      return "done";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "unknown";
  }
}
function sessionState(value, outcome) {
  switch (value) {
    case "working":
    case "running":
      return "working";
    case "waiting":
    case "idle":
      return "waiting";
    case "blocked":
      return "blocked";
    case "failed":
    case "failure":
      return "failed";
    case "stopped":
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "done":
    case "completed":
      if (outcome === "failure") return "failed";
      if (outcome === "cancellation" || outcome === "superseded") return "cancelled";
      if (outcome === "interruption" || outcome === "unconfirmed") return "unknown";
      return "done";
    default:
      return "unknown";
  }
}
function visibleRows(rows) {
  const owned = new Set(rows.flatMap((row) => row.workers ?? []));
  return rows.filter((row) => row.source !== "Bot \u30EF\u30FC\u30AB\u30FC" || !owned.has(row.ref));
}
function transition(row, to, at, via) {
  return { from: row.state, to, at, via };
}

// src/sources.ts
import { execFile } from "node:child_process";
import { accessSync, constants } from "node:fs";
function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_response");
  return value;
}
function optional(value) {
  return value == null ? {} : record(value);
}
function list(value) {
  if (!Array.isArray(value)) throw new Error("invalid_response");
  return value.map(record);
}
function text(value, limit = 240) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
function identifier(value) {
  const id = text(value);
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_:.~-]{0,239}$/.test(id)) throw new Error("invalid_identifier");
  return id;
}
function time(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
function executable() {
  const bundled = "/Applications/Orca.app/Contents/Resources/bin/orca";
  try {
    accessSync(bundled, constants.X_OK);
    return bundled;
  } catch {
    if (process.platform !== "darwin") throw new Error("local_macos_required");
    return "orca";
  }
}
var cli = (...args) => new Promise((resolve2, reject) => {
  const env = Object.fromEntries(Object.entries(process.env).filter(
    ([key]) => !key.startsWith("ORCA_")
  ));
  execFile(executable(), [...args, "--environment", "local", "--json"], {
    env,
    timeout: 5500,
    maxBuffer: 16 * 1024 * 1024,
    encoding: "utf8"
  }, (error, stdout) => {
    try {
      const response = record(JSON.parse(stdout));
      if (response.ok !== true) throw new Error(text(optional(response.error).code) || "cli_failure");
      if (error) throw new Error("cli_failure");
      resolve2(record(response.result));
    } catch (cause) {
      reject(cause instanceof SyntaxError ? new Error(error?.killed ? "timeout" : "cli_unavailable") : cause);
    }
  });
});
function errorLabel(error) {
  const code = error instanceof Error ? error.message : "";
  if (code === "timeout") return copy("Fetch timed out", "\u53D6\u5F97\u304C\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F");
  if (/^[a-z][a-z0-9_]{1,63}$/.test(code)) return copy("Could not fetch (" + code + ")", "\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\uFF08" + code + "\uFF09");
  return copy("Could not fetch", "\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093");
}
async function capture(key, label, get) {
  try {
    return { key, label, ok: true, rows: await get() };
  } catch (error) {
    return { key, label, ok: false, rows: [], issue: errorLabel(error) };
  }
}
function dispatch(value) {
  return identifier(value).replace(/^dispatch:/, "");
}
function session(value) {
  return identifier(value).replace(/^orca_session_id:/, "");
}
async function items(run, bot, origin, clock, settlements, hasWorkers) {
  const rows = [];
  const seen = /* @__PURE__ */ new Set();
  const cursors = /* @__PURE__ */ new Set();
  let cursor = "";
  for (; ; ) {
    const data = await run(
      "bot",
      "item",
      "list",
      "--bot",
      bot,
      "--all",
      "--limit",
      "100",
      ...cursor ? ["--cursor", cursor] : []
    );
    if (data.botId !== bot) throw new Error("source_mismatch");
    const now = clock();
    const page = list(data.items);
    for (const item of page) {
      const uid = identifier(item.uid);
      if (seen.has(uid)) throw new Error("pagination_changed");
      seen.add(uid);
      const links = list(item.links).filter((link) => link.kind === "dispatch");
      for (const link of links) {
        const ref = dispatch(link.latest ?? link.ref);
        if (withinActivityWindow(link.settledAt, now)) {
          settlements.set(ref, Math.max(settlements.get(ref) ?? 0, link.settledAt));
        }
      }
      const updated = time(item.updatedAt);
      const at = Number.isSafeInteger(updated) && updated > 0 && updated <= now ? updated : time(item.lastActivityAt);
      if (!withinActivityWindow(at, now)) continue;
      const state = itemState(item.status);
      const reason = state === "input" ? text(optional(item.question).gist, Infinity) : state === "external" ? text(optional(item.wait).text ?? optional(item.wait).reason, Infinity) : "";
      rows.push({
        id: "item:" + bot + ":" + uid,
        source: "Bot Item",
        title: text(item.title) || copy("Item", "\u9805\u76EE"),
        origin: origin + " \xB7 #" + String(item.number ?? uid),
        state,
        at,
        ref: uid,
        bot,
        questionId: text(item.waitingAsk) || (state === "input" ? text(optional(item.question).eventId) : "") || void 0,
        workers: links.flatMap((link) => link.latest ? [dispatch(link.ref), dispatch(link.latest)] : [dispatch(link.ref)]),
        cursor: text(item.lastEventId) || void 0,
        reason: reason || void 0
      });
    }
    const next = text(data.nextCursor ?? data.cursor);
    if (!next) return rows;
    const lastActivity = time(page.at(-1)?.lastActivityAt);
    if (lastActivity && lastActivity < now - activityWindow && !await hasWorkers) return rows;
    if (cursors.has(next)) throw new Error("pagination_changed");
    cursors.add(next);
    cursor = next;
  }
}
async function workerInventory(run) {
  const entries = /* @__PURE__ */ new Map();
  const cursors = /* @__PURE__ */ new Set();
  let cursor = "";
  for (; ; ) {
    const data = await run(
      "orchestration",
      "worker-list",
      "--full",
      "--limit",
      "100",
      ...cursor ? ["--cursor", cursor] : []
    );
    for (const entry of list(data.workers)) entries.set(dispatch(entry.dispatchId), entry);
    const next = text(optional(data.page).nextCursor, Infinity);
    if (!next) return entries;
    if (cursors.has(next)) throw new Error("pagination_changed");
    cursors.add(next);
    cursor = next;
  }
}
async function workers(run, work, bot, origin, now, inventory, settlements) {
  const rows = [];
  const panes = /* @__PURE__ */ new Set();
  const handles = /* @__PURE__ */ new Set();
  const sessions = /* @__PURE__ */ new Set();
  const uncertainWorkspaces = /* @__PURE__ */ new Set();
  let incomplete = false;
  for (const entry of work) {
    const ref = dispatch(entry.dispatchId ?? entry.id);
    const info = inventory.get(ref);
    const projection = optional(info?.projection);
    const evidence = optional(projection.evidence);
    const handle = text(info?.agentTerminalHandle ?? optional(info?.resource).terminalHandle);
    if (handle) handles.add(identifier(handle));
    const workspace = text(optional(projection.workspace).id, Infinity);
    const state = sessionState(entry.state);
    const uncertain = () => {
      if (workspace && (!handle || handle.startsWith("structworker_"))) uncertainWorkspaces.add(workspace);
      else if (!handle && ["working", "blocked", "waiting"].includes(state)) incomplete = true;
    };
    const at = Math.max(
      withinActivityWindow(evidence.lastObservedAt, now) && evidence.liveStatus !== "redacted_restore" ? evidence.lastObservedAt : 0,
      settlements.get(ref) ?? 0
    );
    if (!withinActivityWindow(at, now)) {
      uncertain();
      continue;
    }
    const row = {
      id: "worker:" + bot + ":" + ref,
      source: "Bot \u30EF\u30FC\u30AB\u30FC",
      title: text(entry.title) || copy("Worker", "\u30EF\u30FC\u30AB\u30FC"),
      origin,
      state,
      at,
      ref
    };
    let verified = false;
    try {
      const detail = await run("orchestration", "worker-show", "--dispatch", ref, "--full");
      const info2 = record(detail.dispatch);
      const observed = optional(detail.observation);
      verified = info2.id === ref && observed.exactWorker === true;
      if (verified) {
        if (info2.assigneePaneKey) panes.add(String(info2.assigneePaneKey));
        if (info2.assigneeHandle) handles.add(identifier(info2.assigneeHandle));
        if (info2.assigneeSessionId) sessions.add(session(info2.assigneeSessionId));
        if (observed.agentWait && ["working", "blocked", "waiting"].includes(row.state)) {
          row.state = "input";
        }
      }
    } catch {
      verified = false;
    }
    if (!verified) uncertain();
    rows.push(row);
  }
  return { rows, panes, handles, sessions, uncertainWorkspaces, incomplete };
}
async function collect(run, clock = Date.now) {
  const batches = [];
  const botSessions = /* @__PURE__ */ new Set();
  const botPanes = /* @__PURE__ */ new Set();
  const botHandles = /* @__PURE__ */ new Set();
  const uncertainWorkspaces = /* @__PURE__ */ new Set();
  let inventory;
  let complete = false;
  let membership = false;
  let terminalIssue;
  const agentResult = capture("agents", copy("Regular sessions", "\u901A\u5E38\u30BB\u30C3\u30B7\u30E7\u30F3"), async () => {
    const [data, terminals] = await Promise.all([
      run("agent", "list"),
      run("terminal", "list").then(async (value) => {
        if (value.truncated && typeof value.totalCount === "number" && Number.isSafeInteger(value.totalCount) && value.totalCount > 0) value = await run("terminal", "list", "--limit", String(value.totalCount));
        if (value.truncated) throw new Error("list_truncated");
        return list(value.terminals).filter((terminal) => terminal.executionHostId === "local" && terminal.connected === true && terminal.orphaned === false && text(terminal.worktreeId)).flatMap((terminal) => {
          const tab = text(terminal.tabId);
          const leaf = text(terminal.leafId);
          const paneKey = tab && leaf ? tab + ":" + leaf : text(terminal.recordedPaneKey);
          return paneKey ? [{ ...terminal, paneKey }] : [];
        });
      }).catch((error) => {
        terminalIssue = errorLabel(error);
        return [];
      })
    ]);
    if (data.truncated) throw new Error("list_truncated");
    const now = clock();
    const agents2 = list(data.agents);
    const occupied = /* @__PURE__ */ new Set();
    const rows = agents2.flatMap((agent) => {
      if (agent.kind !== "chat" && agent.kind !== "terminal") throw new Error("unknown_session_kind");
      const pane = text(agent.paneKey);
      const id = agent.orcaSessionId ? session(agent.orcaSessionId) : "";
      const host = agent.hostId === "local" ? "local" : text(agent.hostId);
      if (host !== "local" || !id && !pane) throw new Error("source_mismatch");
      const targets = terminals.filter((terminal) => terminal.paneKey === pane && terminal.worktreeId === agent.worktreeId);
      const target = agent.kind === "terminal" && pane && targets.length === 1 ? targets[0] : void 0;
      if (agent.kind === "terminal") targets.forEach((target2) => occupied.add(identifier(target2.handle)));
      const at = Math.max(...[agent.updatedAt, target?.lastOutputAt].filter((value) => withinActivityWindow(value, now)), 0);
      if (!at) return [];
      return [{
        id: agent.kind === "chat" ? "chat:" + id : "terminal:" + JSON.stringify([id, pane]),
        source: agent.kind === "chat" ? "Orca \u30C1\u30E3\u30C3\u30C8" : "Orca \u30BF\u30FC\u30DF\u30CA\u30EB",
        title: text(agent.title) || text(agent.agent) || copy("Session", "\u30BB\u30C3\u30B7\u30E7\u30F3"),
        origin: text(agent.workspace) || text(agent.repo) || copy("This Mac", "\u3053\u306EMac"),
        state: sessionState(agent.state),
        at,
        ref: id ? "orca_session_id:" + id : pane,
        pane,
        workspace: text(agent.worktreeId),
        target: target ? identifier(target.handle) : void 0,
        stateAt: agent.kind === "terminal" && time(agent.updatedAt) <= now ? time(agent.updatedAt) : void 0,
        targetIncarnation: text(target?.incarnationId) || void 0
      }];
    });
    for (const terminal of terminals) {
      const handle = identifier(terminal.handle);
      if (occupied.has(handle) || !withinActivityWindow(terminal.lastOutputAt, now)) continue;
      rows.push({
        id: "terminal-ui:" + handle,
        source: "Orca \u30BF\u30FC\u30DF\u30CA\u30EB",
        title: text(terminal.title) || copy("Terminal", "\u30BF\u30FC\u30DF\u30CA\u30EB"),
        origin: text(terminal.branch) || copy("This Mac", "\u3053\u306EMac"),
        state: "unknown",
        at: terminal.lastOutputAt,
        ref: handle,
        pane: terminal.paneKey,
        target: handle,
        workspace: text(terminal.worktreeId),
        targetIncarnation: text(terminal.incarnationId) || void 0
      });
    }
    return rows;
  });
  try {
    const root = await run("bot", "list");
    const bots = list(root.bots).filter((bot) => bot.server == null);
    complete = Array.isArray(root.unreachable) && root.unreachable.length === 0;
    membership = complete;
    if (!complete) batches.push({ key: "bots", label: copy("Bot list", "Bot\u4E00\u89A7"), ok: false, rows: [], issue: copy("Could not connect to some Bots", "\u4E00\u90E8\u306EBot\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093") });
    for (let i = 0; i < bots.length; i += 3) {
      await Promise.all(bots.slice(i, i + 3).map(async (entry) => {
        const bot = identifier(entry.id);
        const origin = text(entry.name) || bot;
        const settlements = /* @__PURE__ */ new Map();
        const workResult = run("bot", "work", "list", "--bot", bot).then((data) => list(data.items));
        const hasWorkers = workResult.then((work) => work.length > 0, () => false);
        const itemResult = capture(
          bot + ":items",
          joinCopy([origin, copy("Items", "\u9805\u76EE")], " / "),
          () => items(run, bot, origin, clock, settlements, hasWorkers)
        );
        const [itemBatch, workerBatch, chats] = await Promise.all([
          itemResult,
          capture(bot + ":workers", joinCopy([origin, copy("Workers", "\u30EF\u30FC\u30AB\u30FC")], " / "), async () => {
            const work = await workResult;
            if (!work.length) return [];
            inventory ??= workerInventory(run);
            const [entries] = await Promise.all([inventory, itemResult]);
            const result = await workers(run, work, bot, origin, clock(), entries, settlements);
            result.panes.forEach((pane) => botPanes.add(pane));
            result.handles.forEach((handle) => botHandles.add(handle));
            result.sessions.forEach((id) => botSessions.add(id));
            result.uncertainWorkspaces.forEach((id) => uncertainWorkspaces.add(id));
            if (result.incomplete) membership = false;
            return result.rows;
          }),
          run("bot", "chats", "--bot", bot, "--all").then((data) => {
            if (entry.name && data.bot !== entry.name) throw new Error("source_mismatch");
            return list(data.chats);
          }).catch(() => null)
        ]);
        batches.push(itemBatch, workerBatch);
        if (!workerBatch.ok || !chats) membership = false;
        else chats.forEach((chat) => botSessions.add(session(chat.id)));
      }));
    }
  } catch (error) {
    complete = false;
    membership = false;
    batches.push({ key: "bots", label: copy("Bot list", "Bot\u4E00\u89A7"), ok: false, rows: [], issue: errorLabel(error) });
  }
  const agents = await agentResult;
  if (!membership && agents.ok) {
    agents.ok = false;
    agents.issue = copy("Could not verify Bot ownership", "Bot\u3078\u306E\u6240\u5C5E\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093");
  }
  agents.rows = agents.rows.filter((row) => !botSessions.has(row.ref.replace(/^orca_session_id:/, "")) && !(row.workspace && uncertainWorkspaces.has(row.workspace) && row.pane?.startsWith("structured-agent-session-")) && !(row.pane && botPanes.has(row.pane)) && !(row.target && botHandles.has(row.target)));
  const plain = agents.rows.filter((row) => row.id.startsWith("terminal-ui:"));
  agents.rows = agents.rows.filter((row) => !row.id.startsWith("terminal-ui:"));
  batches.push(agents, {
    key: "terminal-list",
    label: copy("Terminal list", "\u30BF\u30FC\u30DF\u30CA\u30EB\u4E00\u89A7"),
    ok: agents.ok && !terminalIssue,
    rows: plain,
    issue: terminalIssue ?? agents.issue
  });
  return { batches, complete };
}
async function terminalStillMatches(run, row) {
  const data = await run("agent", "list");
  if (data.truncated) return false;
  const matches = list(data.agents).filter((agent) => agent.kind === "terminal" && agent.hostId === "local" && agent.paneKey === row.pane);
  return matches.length === 1 && Boolean(matches[0].orcaSessionId) && row.ref === "orca_session_id:" + session(matches[0].orcaSessionId);
}
async function itemPage(run, row, after) {
  const data = await run(
    "bot",
    "item",
    "show",
    identifier(row.ref),
    ...after ? ["--after", identifier(after)] : []
  );
  const item = record(data.item);
  if (item.uid !== row.ref || row.bot && optional(item.owner).botId !== row.bot) {
    throw new Error("source_mismatch");
  }
  return { item, events: list(data.events), next: text(data.nextCursor) };
}
function itemTransitions(events, after) {
  const seen = /* @__PURE__ */ new Set();
  const entries = [];
  for (const event of events) {
    if (event.kind !== "status") continue;
    const id = identifier(event.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const fields = record(event.data);
    const from = itemState(fields.from);
    const to = itemState(fields.to);
    const at = time(event.at);
    if (at && from !== to && id !== after) entries.push({
      id,
      transition: { from, to, at, via: copy("Bot Item history", "Bot Item \u5C65\u6B74") }
    });
  }
  return entries;
}
async function itemHistory(run, row, after) {
  const { item, events, next } = await itemPage(run, row, after);
  if (next) throw new Error("history_incomplete");
  return { entries: itemTransitions(events, after), cursor: text(item.lastEventId) };
}

// src/item-images.ts
import { execFile as execFile2 } from "node:child_process";
import { constants as constants2 } from "node:fs";
import { lstat, mkdtemp, open, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
var exec = promisify(execFile2);
var maxBytes = 8 * 1024 * 1024;
var maxPreview = 64 * 1024;
var extensions = { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp" };
function mediaType(data) {
  if (data.length < 16) return;
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return "jpeg";
  if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "webp";
}
async function readCommittedFile(root, path, bytes) {
  const upload = dirname(path);
  if (path !== resolve(path) || dirname(upload) !== root || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(basename(upload))) return;
  if (await realpath(root) !== root || !(await lstat(upload)).isDirectory() || await realpath(path) !== path) return;
  const before = await lstat(path);
  if (!before.isFile() || before.nlink !== 1 || before.size !== bytes) return;
  const file = await open(path, constants2.O_RDONLY | constants2.O_NOFOLLOW | constants2.O_NONBLOCK);
  try {
    const current = await file.stat();
    if (!current.isFile() || current.nlink !== 1 || current.size !== bytes || current.dev !== before.dev || current.ino !== before.ino || await realpath(path) !== path) return;
    const buffer = Buffer.alloc(bytes + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead === bytes) return buffer.subarray(0, bytes);
  } finally {
    await file.close();
  }
}
async function thumbnail(data, format) {
  if (process.platform !== "darwin") return;
  const work = await mkdtemp(join(tmpdir(), "session-board-image-"));
  try {
    const source = join(work, "image." + format);
    const preview = join(work, "preview.jpg");
    await writeFile(source, data, { mode: 384 });
    const { stdout } = await exec("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", source], { timeout: 2e3 });
    const width = Number(/^\s*pixelWidth:\s+(\d+)$/m.exec(stdout)?.[1]);
    const height = Number(/^\s*pixelHeight:\s+(\d+)$/m.exec(stdout)?.[1]);
    if (!width || !height || width * height > 24e6) return;
    if (data.length <= maxPreview && width <= 640 && height <= 640) return { data, format };
    await exec("/usr/bin/sips", [
      "-Z",
      "512",
      "-s",
      "format",
      "jpeg",
      "-s",
      "formatOptions",
      "60",
      source,
      "--out",
      preview
    ], { timeout: 3e3 });
    const size = (await lstat(preview)).size;
    if (!size || size > maxPreview) return;
    return { data: await readFile(preview), format: "jpeg" };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
async function itemImage(value, root = join(homedir(), "Library", "Application Support", "orca", "agent-session-attachments")) {
  if (!value || typeof value !== "object" || !("path" in value) || !("name" in value) || !("bytes" in value) || typeof value.path !== "string" || typeof value.name !== "string" || typeof value.bytes !== "number" || !Number.isSafeInteger(value.bytes) || value.bytes < 16 || value.bytes > maxBytes) return;
  const { path, name, bytes } = value;
  const format = extensions[extname(path).toLowerCase()];
  if (!format || basename(path) !== name || path.includes("\0")) return;
  try {
    const data = await readCommittedFile(root, path, bytes);
    if (!data || mediaType(data) !== format) return;
    const result = await thumbnail(data, format);
    if (result) return { alt: name.slice(0, 160), src: "data:image/" + result.format + ";base64," + result.data.toString("base64") };
  } catch {
    return;
  }
}

// src/conversation.ts
var commentSource = copy("Bot Item comments", "Bot Item \u306E\u30B3\u30E1\u30F3\u30C8");
var bodiesLimit = 32e3;
function body(value) {
  return typeof value === "string" && value.trim() ? value : "";
}
function timestamp(value) {
  const at = time(value);
  return at && at <= 864e13 ? at : void 0;
}
function recent(source, entries, limited) {
  let remaining = bodiesLimit;
  const visible = [];
  for (const entry of entries.slice(-30).reverse()) {
    if (remaining <= 0) break;
    visible.push({ ...entry, body: entry.body.slice(-remaining) });
    remaining -= entry.body.length;
  }
  return {
    source,
    entries: visible.reverse(),
    issue: limited || entries.length > visible.length || remaining < 0 ? copy("Showing part of the retrieved history.", "\u53D6\u5F97\u3057\u305F\u5C65\u6B74\u306E\u4E00\u90E8\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002") : void 0
  };
}
function decisions(value, isAsk) {
  return (value == null ? [] : list(value)).flatMap((decision) => {
    const prompt = text(isAsk ? decision.prompt : decision.question, Infinity);
    const options = list((isAsk ? decision.options : decision.replies) ?? []).flatMap((option) => {
      const label = text(option.label, Infinity);
      const detail = text(option.detail, Infinity);
      return label ? [detail ? label + " \u2014 " + detail : label] : [];
    });
    return prompt ? [{ prompt, options }] : [];
  });
}
function currentQuestion(item, events) {
  const current = optional(item.question);
  const questionEvent = item.status === "needs_you" ? text(current.eventId) : "";
  const eventId = pendingQuestionId(item);
  if (!eventId) return;
  const event = events.find((entry) => entry.id === eventId && entry.kind === "commented" && optional(entry.actor).kind !== "owner");
  const data = optional(event?.data);
  const ask = optional(data.ask);
  const source = eventId === questionEvent ? current : {};
  const lines = decisions(source.decisions ?? ask.questions, source.decisions == null);
  const context = text(ask.context, Infinity);
  const prompt = context || (lines.length ? "" : text(source.text ?? data.text, Infinity));
  if (!prompt && !lines.length) return;
  if (!context && lines.length === 1) return { eventId, ...lines[0] };
  return { eventId, prompt, options: [], ...lines.length ? { decisions: lines } : {} };
}
function replyQuestions(item, event) {
  const owner = optional(item.owner);
  const question = optional(item.question);
  const data = optional(event?.data);
  if (item.status !== "needs_you" || time(item.snoozedUntil) > Date.now() || question.eventId !== event?.id || event?.kind !== "commented" || optional(event.actor).kind !== "bot" || optional(event.actor).botId !== owner.botId || data.answers != null || !time(event.at) || time(event.at) > 864e13 || !Array.isArray(question.decisions) || !Array.isArray(optional(data.ask).questions)) return [];
  const normalized = (value) => text(value, Infinity);
  const singleLine = (value) => !!value && !/[\r\n\t]/.test(value);
  const fromSnapshot = list(question.decisions);
  const fromEvent = list(optional(data.ask).questions);
  if (fromEvent.length !== fromSnapshot.length) return [];
  const prompts = fromSnapshot.map((value) => normalized(value.question));
  if (prompts.some((prompt) => !singleLine(prompt)) || new Set(prompts).size !== prompts.length) return [];
  return fromSnapshot.map((decision, index) => {
    const eventLine = fromEvent[index];
    const prompt = prompts[index];
    if (prompt !== normalized(eventLine.prompt)) return;
    const choices = (options) => list(options).map((option) => {
      const label = normalized(option.label);
      const detail = normalized(option.detail);
      return detail ? { label, detail } : { label };
    });
    const expected = choices(decision.replies ?? []);
    if (expected.some((choice) => !singleLine(choice.label) || choice.detail && !singleLine(choice.detail)) || new Set(expected.map((choice) => choice.label)).size !== expected.length || JSON.stringify(expected) !== JSON.stringify(choices(eventLine.options ?? []))) return;
    return { prompt, choices: expected };
  });
}
async function readReplyTarget(run, row, questionId, index) {
  if (!row.bot || row.source !== "Bot Item" || !/^e[1-9]\d{0,14}$/.test(questionId) || !Number.isSafeInteger(index) || index < 0) return;
  const { item, events } = await itemPage(run, row, "e" + (Number(questionId.slice(1)) - 1));
  if (pendingQuestionId(item) !== questionId) return;
  const event = events.find((entry) => entry.id === questionId);
  const question = replyQuestions(item, event)[index];
  if (!event || !question || events.some((entry) => optional(entry.data).answers === questionId)) return;
  const bot = text(optional(item.owner).name, Infinity);
  const title = text(item.title, Infinity);
  const number = item.number;
  if (!bot || !title || typeof number !== "number" || !Number.isSafeInteger(number) || number < 1) return;
  return { bot, title, number, at: time(event.at), question };
}
async function readItemReplyTarget(run, row, questionId, index) {
  if (!row.bot || row.source !== "Bot Item" || questionId === void 0 !== (index === void 0)) return;
  if (questionId !== void 0 && index !== void 0) {
    return await readReplyTarget(run, row, questionId, index) ?? "changed";
  }
  const { item } = await itemPage(run, row);
  const state = itemState(item.status);
  const active = pendingQuestionId(item);
  if (state !== row.state || active !== (row.questionId ?? "")) return "changed";
  if (state === "input" || active) {
    const decisions2 = optional(item.question).decisions;
    if (!active || !Array.isArray(decisions2) || decisions2.length !== 1) return "choose";
    return await readReplyTarget(run, row, active, 0) ?? "choose";
  }
  if (state === "unknown") return;
  const bot = text(optional(item.owner).name, Infinity);
  const title = text(item.title, Infinity);
  const number = item.number;
  if (!bot || !title || typeof number !== "number" || !Number.isSafeInteger(number) || number < 1) return;
  return { bot, title, number, state, snoozed: time(item.snoozedUntil) > Date.now() };
}
function pendingQuestionId(item) {
  return text(item.waitingAsk) || (item.status === "needs_you" ? text(optional(item.question).eventId) : "");
}
async function itemActivity(events, snapshot, partial) {
  const comments = events.filter((event) => event.kind === "commented");
  const newest = comments.slice(-30);
  const attachments = newest.flatMap((event, index) => {
    const images = optional(event.data).images;
    return Array.isArray(images) ? images.map((value) => ({ index, value })) : [];
  });
  const visible = await Promise.all(attachments.slice(-4).map(async ({ index, value }) => ({ index, preview: await itemImage(value) })));
  const entries = newest.flatMap((event, index) => {
    const message = body(optional(event.data).text);
    const images = visible.flatMap((entry) => entry.index === index && entry.preview ? [entry.preview] : []);
    return message || images.length ? [{
      ...itemSpeaker(optional(event.actor), snapshot),
      body: message,
      at: timestamp(event.at),
      ...images.length ? { images } : {}
    }] : [];
  });
  const activity = recent(commentSource, entries, partial || newest.length < comments.length);
  if (attachments.length !== visible.filter((entry) => entry.preview).length) {
    activity.issue = joinCopy([
      ...activity.issue ? [activity.issue] : [],
      copy("Open the Item in Orca to see the remaining attachments.", "\u4E00\u90E8\u306E\u6DFB\u4ED8\u753B\u50CF\u306FOrca\u6A19\u6E96\u306E\u9805\u76EE\u3067\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002")
    ], " ");
  }
  return activity;
}
function itemSpeaker(actor, item) {
  const owner = optional(item.owner);
  const maker = optional(item.madeBy);
  switch (actor.kind) {
    case "owner":
      return { author: copy("You", "\u3042\u306A\u305F"), speaker: { side: "owner", id: "owner" } };
    case "orca":
      return { author: "Orca", kind: "system" };
    case "bot": {
      const id = typeof actor.botId === "string" && actor.botId;
      if (!id) return { author: copy("Bot", "\u5BFE\u8C61Bot") };
      const author = id === owner.botId ? text(owner.name) || copy("Bot", "\u5BFE\u8C61Bot") : id === maker.botId ? text(maker.name) || copy("Bot", "\u5BFE\u8C61Bot") : copy("Another Bot", "\u5225\u306EBot");
      return { author, speaker: { side: "agent", id } };
    }
    default:
      return { author: copy("Unknown speaker", "\u767A\u8A00\u8005\u4E0D\u660E") };
  }
}
async function botDetail(run, row, observed, shownQuestion, current = () => true) {
  let page = await itemPage(run, row);
  const snapshot = page.item;
  const events = [...page.events];
  const cursors = /* @__PURE__ */ new Set();
  const sameItem = (current2) => current2.lastEventId === snapshot.lastEventId && current2.version === snapshot.version;
  while (page.next && cursors.size < 4) {
    if (cursors.has(page.next)) throw new Error("pagination_changed");
    cursors.add(page.next);
    page = await itemPage(run, row, page.next);
    if (!sameItem(page.item)) throw new Error("pagination_changed");
    events.push(...page.events);
  }
  const activeId = pendingQuestionId(snapshot);
  if (page.next && /^e[1-9]\d{0,14}$/.test(activeId) && !events.some((event) => event.id === activeId)) {
    const activePage = await itemPage(run, row, "e" + (Number(activeId.slice(1)) - 1));
    if (!sameItem(activePage.item)) throw new Error("pagination_changed");
    events.push(...activePage.events);
  }
  const unique = [...new Map(events.map((event) => [event.id, event])).values()];
  const state = itemState(snapshot.status);
  const question = currentQuestion(snapshot, unique);
  const targets = replyQuestions(snapshot, unique.find((event) => event.id === activeId)).flatMap((entry, index) => entry ? [index] : []);
  const previous = shownQuestion || row.questionId;
  const changed = previous && previous !== question?.eventId;
  const answered = previous && unique.some((event) => event.kind === "commented" && optional(event.actor).kind === "owner" && optional(event.data).answers === previous);
  const questionStatus = changed && question ? "replaced" : changed && answered && state !== "input" ? "answered" : !question && (state === "input" || previous) ? "unverified" : void 0;
  if (question && targets.length && !answered && process.platform === "darwin") question.targets = targets;
  const botName = text(optional(snapshot.owner).name) || row.bot || copy("Bot", "\u5BFE\u8C61Bot");
  const itemName = typeof snapshot.number === "number" ? "#" + String(snapshot.number) : row.ref;
  const home = copy("Bot \u201C" + botName + "\u201D Home", "Bot\u300C" + botName + "\u300D\u306E Home");
  const step = state === "input" ? copy("Needs you", "\u5165\u529B\u5F85\u3061") : copy("Items", "\u9805\u76EE");
  const itemTitle = text(snapshot.title);
  const snoozed = time(snapshot.snoozedUntil) > Date.now();
  if (!current()) throw new Error("outside_activity_window");
  const [canOpen, relatedActivity, activity] = await Promise.all([
    row.bot && !snoozed ? uniqueLocalBot(run, row.bot).catch(() => false) : false,
    relatedBotConversation(run, row, optional(snapshot.chat), display(botName, "en")),
    itemActivity(unique, snapshot, Boolean(page.next))
  ]);
  const transitions = itemTransitions(unique).map((entry) => entry.transition).sort((a, b) => b.at - a.at);
  if (page.next) {
    for (const move of observed) {
      if (!transitions.some((entry) => entry.at === move.at && entry.from === move.from && entry.to === move.to)) {
        transitions.push(move);
      }
    }
    transitions.sort((a, b) => b.at - a.at);
  }
  return {
    state,
    question,
    questionStatus,
    transitions: transitions.slice(0, 100),
    reason: state === "external" ? text(optional(snapshot.wait).text ?? optional(snapshot.wait).reason, Infinity) || void 0 : void 0,
    activity,
    relatedActivity,
    issue: page.next ? copy("Showing part of the Bot Item history.", "Bot Item\u5C65\u6B74\u306E\u4E00\u90E8\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002") : void 0,
    action: canOpen ? "bot-home" : void 0,
    navigationHint: snoozed ? copy(
      "Open " + display(home, "en") + " and check whether " + itemName + " is still snoozed.",
      display(home, "ja") + " \u306E\u9805\u76EE\u3067 " + itemName + " \u306E\u30B9\u30CC\u30FC\u30BA\u72B6\u614B\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
    ) : joinCopy([
      home,
      step,
      copy(itemName + " \u201C" + itemTitle + "\u201D", itemName + "\u300C" + itemTitle + "\u300D"),
      ...question ? [copy("Question card", "\u8CEA\u554F\u30AB\u30FC\u30C9")] : []
    ], " \u2192 ")
  };
}
async function uniqueLocalBot(run, botId) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(botId) || botId === "access-request") return false;
  const data = await run("bot", "list");
  const matches = list(data.bots).filter((bot) => bot.id === botId);
  return Array.isArray(data.unreachable) && data.unreachable.length === 0 && matches.length === 1 && matches[0].server == null;
}
async function relatedBotConversation(run, row, chat, botName) {
  const id = text(chat.id, 256);
  if (!row.bot || !id || chat.gone === true) return;
  const source = copy("Bot chat", "Bot \u30C1\u30E3\u30C3\u30C8");
  try {
    const data = await run("bot", "chats", "--bot", row.bot, "--all");
    const matches = list(data.chats).filter((entry) => entry.id === id);
    if (data.bot !== botName || matches.length !== 1) throw new Error("source_mismatch");
    const conversation = matches[0];
    const activity = await agentConversation(run, "orca_session_id:" + identifier(id), "chat", source);
    const title = text(conversation.title);
    if (conversation.closed === false) {
      const home = copy("Bot \u201C" + botName + "\u201D", "Bot\u300C" + botName + "\u300D");
      if (conversation.home === true) activity.navigationHint = joinCopy([home, "Home Chat"], " \u2192 ");
      else if (title && list(data.chats).filter((entry) => text(entry.title) === title && entry.closed === false).length === 1) {
        activity.navigationHint = joinCopy([home, "Chats", copy("\u201C" + title + "\u201D", "\u300C" + title + "\u300D")], " \u2192 ");
      }
    }
    return activity;
  } catch (error) {
    return { source, entries: [], issue: errorLabel(error) };
  }
}
function chatSpeaker(value) {
  switch (value) {
    case "user":
      return { author: copy("You", "\u3042\u306A\u305F"), speaker: { side: "owner", id: "user" } };
    case "assistant":
      return { author: copy("Agent", "\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8"), speaker: { side: "agent", id: "assistant" } };
    case "system":
      return { author: copy("System", "\u30B7\u30B9\u30C6\u30E0"), kind: "system" };
    default:
      return { author: copy("Unknown speaker", "\u767A\u8A00\u8005\u4E0D\u660E") };
  }
}
function sameSession(value, ref) {
  const prefix = /^orca_session_id:/;
  return typeof value === "string" && Boolean(value) && value.replace(prefix, "") === ref.replace(prefix, "");
}
function sameDay(first, next) {
  if (first === void 0 || next === void 0) return first === next;
  return new Date(first).toDateString() === new Date(next).toDateString();
}
async function agentConversation(run, ref, kind, source) {
  const data = await run("agent", "read", ref, "--limit", "100");
  if (!sameSession(data.orcaSessionId, ref) || data.kind !== kind || data.source !== (kind === "chat" ? "chat" : "transcript")) throw new Error("source_mismatch");
  const entries = list(data.entries);
  const messages = [];
  let consecutive = false;
  for (const entry of entries) {
    const message = body(entry.text);
    const at = timestamp(entry.at);
    const legacyView = kind === "chat" && data.agent === "codex" && entry.kind === "message" && entry.role === "assistant" && /^(?:Viewed image\r?\n\[image\]|Image view: preview unavailable)$/.test(message.trim());
    if (legacyView || entry.kind === "tool" && entry.name === "view_image") {
      const previous = messages.at(-1);
      if (consecutive && previous?.kind === "image-view" && sameDay(previous.at, at)) {
        previous.count = (previous.count ?? 1) + 1;
      } else {
        messages.push({ author: copy("Image viewed", "\u753B\u50CF\u95B2\u89A7"), body: "", at, kind: "image-view", count: 1 });
      }
      consecutive = true;
      continue;
    }
    consecutive = false;
    if (!message) continue;
    if (entry.kind === "message") messages.push({ ...chatSpeaker(entry.role), body: message, at });
    if (entry.kind === "question") messages.push({
      ...chatSpeaker("assistant"),
      author: copy("Agent question", "\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u306E\u8CEA\u554F"),
      body: message,
      at
    });
  }
  return recent(source, messages, data.limited === true || entries.some((entry) => entry.shortened === true));
}
async function sessionDetail(run, row) {
  const chat = row.source === "Orca \u30C1\u30E3\u30C3\u30C8";
  const terminalOutput = !chat && row.target === row.ref;
  const source = chat ? sourceNames[row.source] : terminalOutput ? copy("Terminal output", "\u7AEF\u672B\u51FA\u529B") : copy("Terminal agent conversation", "\u7AEF\u672B\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u306E\u4F1A\u8A71");
  const detail = {};
  if (chat && row.ref.startsWith("orca_session_id:")) {
    const unverified = copy("Could not verify the matching chat tab. Look for the existing tab in Orca using its workspace and title.", "\u540C\u3058\u30C1\u30E3\u30C3\u30C8\u306E\u30BF\u30D6\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u6240\u5C5E\u3068\u30BF\u30A4\u30C8\u30EB\u3092\u78BA\u8A8D\u3057\u3066Orca\u306E\u65E2\u5B58\u30BF\u30D6\u3092\u63A2\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    detail.navigationHint = unverified;
    try {
      const session2 = await run("agent", "show", row.ref);
      if (!sameSession(session2.orcaSessionId, row.ref) || session2.kind !== "chat") throw new Error("source_mismatch");
      const matches = list(session2.places).filter((place) => sameSession(place.orcaSessionId, row.ref) && place.kind === "chat" && place.hostId === "local" && place.paneKey === row.pane && place.worktreeId === row.workspace);
      if (matches.length === 1 && row.pane && row.workspace) {
        const tab = text(matches[0].title) || row.title;
        const where = [text(matches[0].repo), text(matches[0].workspace)].filter(Boolean).join(" / ") || row.origin;
        detail.navigationHint = copy(
          "Search for \u201C" + display(tab, "en") + "\u201D in the Orca jump palette (\u2318J by default) and open the existing chat in \u201C" + display(where, "en") + "\u201D on this Mac.",
          "Orca\u306E\u30B8\u30E3\u30F3\u30D7\u30D1\u30EC\u30C3\u30C8\uFF08\u65E2\u5B9A \u2318J\uFF09\u3067\u300C" + display(tab, "ja") + "\u300D\u3092\u691C\u7D22\u3057\u3001\u3053\u306EMac\u306E\u300C" + display(where, "ja") + "\u300D\u306B\u3042\u308B\u65E2\u5B58\u30C1\u30E3\u30C3\u30C8\u3092\u958B\u304D\u307E\u3059\u3002"
        );
      }
    } catch {
    }
  }
  try {
    if (row.target && await terminalMatches(run, row).catch(() => false)) detail.action = "terminal";
    if (row.ref.startsWith("orca_session_id:")) {
      detail.activity = await agentConversation(run, row.ref, chat ? "chat" : "terminal", source);
    } else if (terminalOutput && detail.action) {
      const data = record((await run("terminal", "read", "--terminal", row.ref, "--limit", "40")).terminal);
      if (data.handle !== row.ref || data.source !== "stream" || !Array.isArray(data.tail) || data.tail.some((line) => typeof line !== "string") || !await terminalMatches(run, row)) {
        throw new Error("source_mismatch");
      }
      detail.activity = recent(
        source,
        data.tail.length ? [{
          author: copy("Terminal output", "\u7AEF\u672B\u51FA\u529B"),
          kind: "terminal-output",
          body: data.tail.join("\n")
        }] : [],
        data.truncated === true || data.limited === true
      );
    } else throw new Error("source_unavailable");
  } catch (error) {
    detail.activity = { source, entries: [], issue: errorLabel(error) };
  }
  return detail;
}
async function workerConversation(run, row) {
  const source = copy("Bot worker conversation", "Bot \u30EF\u30FC\u30AB\u30FC\u306E\u4F1A\u8A71");
  try {
    const data = await run("orchestration", "worker-show", "--dispatch", row.ref, "--full");
    const worker = record(data.dispatch);
    if (worker.id !== row.ref || optional(data.observation).exactWorker !== true) throw new Error("source_mismatch");
    const ref = "orca_session_id:" + identifier(worker.assigneeSessionId).replace(/^orca_session_id:/, "");
    const result = await run("agent", "show", ref);
    if (!sameSession(result.orcaSessionId, ref) || result.kind !== "chat" && result.kind !== "terminal") {
      throw new Error("source_mismatch");
    }
    const activity = await agentConversation(run, ref, result.kind, source);
    const places = list(result.places ?? []).filter((place) => place.hostId === "local" && place.kind === result.kind && sameSession(place.orcaSessionId, ref) && text(place.title) && text(place.workspace));
    if (places.length === 1) {
      const place = places[0];
      activity.navigationHint = copy(
        "Reply in the existing " + (result.kind === "chat" ? "chat" : "terminal") + " \u201C" + text(place.title) + "\u201D in \u201C" + text(place.workspace) + "\u201D.",
        "\u300C" + text(place.workspace) + "\u300D\u306B\u3042\u308B\u65E2\u5B58\u306E" + (result.kind === "chat" ? "\u30C1\u30E3\u30C3\u30C8" : "\u30BF\u30FC\u30DF\u30CA\u30EB") + "\u300C" + text(place.title) + "\u300D\u304C\u30EF\u30FC\u30AB\u30FC\u306E\u5165\u529B\u5148\u3067\u3059\u3002"
      );
    }
    return activity;
  } catch (error) {
    return { source, entries: [], issue: errorLabel(error) };
  }
}
async function terminalMatches(run, row) {
  if (!row.target || !row.pane || !row.workspace) return false;
  const info = record((await run("terminal", "show", "--terminal", row.target)).terminal);
  const pane = info.tabId && info.leafId ? info.tabId + ":" + info.leafId : info.recordedPaneKey;
  return info.handle === row.target && info.connected === true && info.orphaned === false && info.executionHostId === "local" && info.worktreeId === row.workspace && pane === row.pane && (text(info.incarnationId) || void 0) === row.targetIncarnation;
}

// src/native-reply.ts
import { randomUUID } from "node:crypto";
var statusNames = {
  input: ["Needs you"],
  working: ["In progress"],
  external: ["Waiting"],
  planned: ["Planned"],
  done: ["Done"],
  cancelled: ["Canceled", "Cancelled"],
  blocked: [],
  waiting: [],
  failed: [],
  unknown: []
};
var groupNames = ["Needs you", "In progress", "Waiting", "Planned", "Snoozed", "Stale", "Closed"];
var app = "com.stablyai.orca";
var placeholder = "Reply in your own words, or pick an option";
var homeToolbar = /^button (?:ホーム, 要対応 [0-9]+ 件|Home, [0-9]+ needs you|ホーム|Home)$/;
var sessionBoardTool = /^button (?:Session Board|セッションボード)$/;
var choiceText = (choice) => choice.detail ? choice.label + " " + choice.detail : choice.label;
function one(values) {
  return values.length === 1 ? values[0] : void 0;
}
function under(node, ancestor) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent === ancestor) return true;
  }
  return false;
}
function parse(result, window) {
  const snapshot = optional(result.snapshot);
  const frame = optional(snapshot.window);
  if (frame.id !== window || frame.isMinimized !== false || frame.isOffscreen !== false || optional(snapshot.app).bundleId !== app || optional(snapshot.truncation).truncated !== false || snapshot.treeDiff || typeof snapshot.treeText !== "string" || !Array.isArray(snapshot.disabledElementIndexes)) {
    throw new Error("native_snapshot_unavailable");
  }
  const nodes = [];
  const ancestors = [];
  for (const line of snapshot.treeText.split("\n")) {
    const match = /^(\t+)(\d+) (.*)$/.exec(line);
    if (!match) continue;
    const depth = match[1].length;
    while (ancestors.length && ancestors.at(-1).depth >= depth) ancestors.pop();
    const node = { depth, index: match[2], label: match[3], parent: ancestors.at(-1) };
    ancestors.push(node);
    nodes.push(node);
  }
  return { nodes, focused: String(snapshot.focusedElementId), disabled: new Set(snapshot.disabledElementIndexes.map(String)) };
}
function sameHome({ nodes }, bot) {
  const composers = new Set(nodes.filter((node) => /^text entry area \(settable\)(?: |$)/.test(node.label)).map((node) => node.parent).filter(Boolean));
  const attachments = new Set(nodes.filter((node) => /^button (?:\(disabled\) )?(?:Attach files?|ファイルを添付する)$/.test(node.label)).map((node) => node.parent));
  const footers = nodes.filter((node) => composers.has(node.parent) && attachments.has(node.parent) && (node.label.startsWith("button Copy ") || /^button .+ をコピー$/.test(node.label)));
  if (footers.length) {
    const footer = one(footers)?.label;
    return footer === "button Copy " + bot || footer === "button " + bot + " \u3092\u30B3\u30D4\u30FC";
  }
  return !!one(nodes.filter((node) => node.label === "button Open " + bot + "'s page" || node.label === "button " + bot + "\u306E\u30DA\u30FC\u30B8\u3092\u958B\u304F"));
}
function homeBack({ nodes }) {
  return one(nodes.filter((node) => {
    if (node.label !== "button \u30DB\u30FC\u30E0" && node.label !== "button Home") return false;
    const panel = node.parent;
    if (!panel?.parent || !/^(?:container|container ホーム|container Home)$/.test(panel.label)) return false;
    return nodes.some((sibling) => sibling.parent === panel.parent && homeToolbar.test(sibling.label)) && nodes.some((sibling) => sibling.parent === panel.parent && sessionBoardTool.test(sibling.label)) && nodes.some((heading) => under(heading, panel) && /^heading #[0-9]+ /.test(heading.label));
  }));
}
function itemScope(state, target) {
  const heading = one(state.nodes.filter((node) => node.label === "heading #" + target.number + " " + target.title));
  const scope = heading?.parent?.parent?.parent;
  const home = homeBack(state)?.parent;
  const statuses = statusNames["question" in target ? "input" : target.state];
  if (!home || !scope || scope.parent !== home || !state.nodes.some((node) => node.parent === heading?.parent && statuses.some((status) => node.label === "pop up button " + status))) return;
  return scope;
}
function homePanel({ nodes }, bot) {
  return one(nodes.filter((node) => node.label === "text " + bot && node.parent && nodes.some((sibling) => sibling.parent === node.parent && sibling.label === "pop up button Edit bot picture")))?.parent;
}
function homeItem(state, target) {
  const prefix = "button #" + target.number + " " + target.title;
  const panel = homePanel(state, target.bot);
  if (!panel) return;
  const lists = state.nodes.filter((node) => under(node, panel) && groupNames.some((group) => node.label === "content list " + group));
  return one(state.nodes.filter((node) => (node.label === prefix || node.label.startsWith(prefix + " ")) && lists.some((group) => under(node, group))));
}
function itemGroups(target) {
  if ("question" in target) return ["Needs you"];
  if (target.snoozed) return ["Snoozed"];
  if (target.state === "done" || target.state === "cancelled") return ["Closed"];
  return [...statusNames[target.state], "Stale"];
}
function listControl(state, target, matches) {
  const panel = homePanel(state, target.bot);
  if (!panel) return;
  for (const group of itemGroups(target)) {
    const heading = one(state.nodes.filter((node) => node.label === "heading " + group && under(node, panel)));
    if (!heading?.parent?.parent) continue;
    const control = one(state.nodes.filter((node) => (node.parent === heading.parent || node.parent === heading.parent.parent) && matches(node.label, group)));
    if (control) return control;
  }
}
function collapsedGroup(label, group) {
  const prefix = "button " + group + " ";
  return label === "button (collapsed)" || label.startsWith(prefix) && /^[0-9]+$/.test(label.slice(prefix.length));
}
function exactQuestion(state, scope, target) {
  const names = ["ja-JP", "en-US", Intl.DateTimeFormat().resolvedOptions().locale].map((locale) => "container " + target.bot + ", " + new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "long" }).format(target.at));
  const card = one(state.nodes.filter((node) => under(node, scope) && names.includes(node.label)));
  if (!card) return;
  const children = state.nodes.filter((node) => node.parent === card);
  if (!children.some((node) => node.label === "text Needs you")) return;
  const prompt = one(children.filter((node) => node.label === "text " + target.question.prompt));
  if (!prompt) return;
  const start = children.indexOf(prompt) + 1;
  const controls = children.slice(start, start + target.question.choices.length + 1);
  const button = controls.at(-1);
  if (!target.question.choices.length && button?.label !== "button Type your answer") {
    const reply = "button Replying to: " + target.question.prompt + ". Show question";
    if (one(state.nodes.filter((node) => under(node, scope) && node.label === reply))) return "already-bound";
  }
  if (controls.length !== target.question.choices.length + 1 || button?.label !== "button Type your answer") return;
  const matches = (label) => target.question.choices.every((choice, index) => controls[index].label === label(choice));
  if (!matches((choice) => "button " + choiceText(choice)) && !matches((choice) => "toggle button " + choiceText(choice) + ", Value: 0")) return;
  return button;
}
function boundQuestion(state, scope, target) {
  const reply = "button Replying to: " + target.question.prompt + ". Show question";
  return !!one(state.nodes.filter((node) => under(node, scope) && node.label === reply));
}
function emptyComposer(state, scope, bot) {
  const nodes = state.nodes.filter((node) => under(node, scope));
  const input = commentComposer(state, scope);
  if (!input || ![placeholder, "Reply to " + bot + "\u2026"].some((text2) => (input.label === "text entry area (settable) \u30B3\u30E1\u30F3\u30C8 " + text2 || input.label === "text entry area (settable) Comment " + text2) && nodes.some((node) => node.parent === input && node.label === "text " + text2))) return;
  if (!nodes.some((node) => /^button \(disabled\) (?:コメント|Comment)$/.test(node.label))) return;
  return input;
}
function commentComposer(state, scope) {
  return one(state.nodes.filter((node) => under(node, scope) && /^text entry area \(settable\) (?:コメント|Comment)(?: |$)/.test(node.label) && !state.disabled.has(node.index)));
}
async function prepareNativeReply(run, signal) {
  if (process.platform !== "darwin") return "platform-unavailable";
  if (signal.aborted) return false;
  const shared = ["--app", app, "--session", "board-reply-" + randomUUID(), "--no-screenshot"];
  try {
    const [windowList, observed] = await Promise.all([
      run("computer", "list-windows", "--app", app),
      run("computer", "get-app-state", ...shared).catch((error) => {
        if (error instanceof Error && ["window_not_found", "window_stale"].includes(error.message)) return void 0;
        throw error;
      })
    ]);
    if (signal.aborted) return false;
    const window = one(list(windowList.windows).filter((frame) => optional(frame.app).bundleId === app && frame.isOffscreen === false && frame.isMinimized === false));
    if (!window || typeof window.id !== "number") return "window-unavailable";
    const windowId = window.id;
    const args = [...shared, "--window-id", String(windowId)];
    const observedWindow = optional(optional(observed?.snapshot).window);
    const selected = observed && observedWindow.id === windowId ? observed : await run("computer", "get-app-state", ...args);
    return { windowId, args, first: parse(selected, windowId) };
  } catch (error) {
    if (error instanceof Error && error.message === "permission_denied") return "accessibility-required";
    throw error;
  }
}
async function nativeReply(run, target, stillCurrent, signal, openHome, stage, preflight) {
  const deadline = Date.now() + 22e3;
  const active = () => !signal.aborted && Date.now() < deadline;
  stage?.("preflight");
  if (!active()) return false;
  const [initial, current] = await Promise.all([preflight ?? prepareNativeReply(run, signal), stillCurrent()]);
  if (typeof initial !== "object") return initial;
  if (!active() || !current) return false;
  const { windowId, args, first } = initial;
  const read = async () => parse(await run("computer", "get-app-state", ...args), windowId);
  async function waitFor(predicate, initial2) {
    if (typeof initial2 === "object" && active() && predicate(initial2)) return initial2;
    for (let attempt = 0; attempt < 5 && active(); attempt++) {
      const state2 = await read();
      if (predicate(state2)) return state2;
      await new Promise((resolve2) => setTimeout(resolve2, 160));
    }
  }
  async function press(state2, find) {
    for (let attempt = 0; attempt < 2 && active() && sameHome(state2, target.bot); attempt++) {
      const node = find(state2);
      if (!node || state2.disabled.has(node.index)) return false;
      try {
        const result = await run(
          "computer",
          "perform-secondary-action",
          ...args,
          "--element-index",
          node.index,
          "--action",
          "AXPress",
          "--full-tree"
        );
        const action = optional(result.action);
        if (action.path !== "accessibility" || action.delivery !== "background" || action.targetWindowId !== windowId) return false;
        try {
          return parse(result, windowId);
        } catch {
          return true;
        }
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "element_not_found") throw error;
        if (attempt || !active() || !await stillCurrent()) return false;
        state2 = await read();
      }
    }
    return false;
  }
  let state = first;
  stage?.("bot-home");
  if (!sameHome(state, target.bot)) {
    if (!active() || !await openHome()) return "bot-home-unavailable";
    const home = await waitFor((view) => sameHome(view, target.bot));
    if (!home) return "bot-home-unavailable";
    state = home;
  }
  stage?.("item");
  let afterItem = state;
  if (!itemScope(state, target)) {
    const homeVisible = (view) => sameHome(view, target.bot) && !!(itemScope(view, target) || homePanel(view, target.bot) || homeBack(view));
    if (!homeVisible(state)) {
      const opened2 = await press(state, ({ nodes }) => one(nodes.filter((node) => homeToolbar.test(node.label) && nodes.some((sibling) => sibling.parent === node.parent && sessionBoardTool.test(sibling.label)))));
      if (!opened2) return "bot-home-unavailable";
      const home = await waitFor(homeVisible, opened2);
      if (!home) return "bot-home-unavailable";
      state = home;
      afterItem = home;
    }
    if (!itemScope(state, target)) {
      if (homeBack(state)) {
        const opened2 = await press(state, homeBack);
        if (!opened2) return "item-unavailable";
        const home = await waitFor((view) => sameHome(view, target.bot) && !!homePanel(view, target.bot), opened2);
        if (!home) return "item-unavailable";
        state = home;
      }
      for (let page = 0; page < 8 && !homeItem(state, target); page++) {
        const disclosure = listControl(state, target, collapsedGroup);
        const opened2 = await press(state, (view) => listControl(view, target, disclosure ? collapsedGroup : (label) => /^button Show [0-9]+ more$/.test(label)));
        if (!opened2) return "item-unavailable";
        const before = state.nodes.filter((node) => /^button #[0-9]+ /.test(node.label)).length;
        const next = await waitFor((view) => sameHome(view, target.bot) && !!homePanel(view, target.bot) && (!!homeItem(view, target) || view.nodes.filter((node) => /^button #[0-9]+ /.test(node.label)).length !== before || Boolean(disclosure && listControl(view, target, (label) => label === "button (expanded)"))), opened2);
        if (!next) return "item-unavailable";
        state = next;
      }
      afterItem = await press(state, (view) => homeItem(view, target));
      if (!afterItem) return "item-unavailable";
    }
  }
  if (!("question" in target)) {
    stage?.("composer");
    const ready = (view2) => {
      const scope3 = itemScope(view2, target);
      return scope3 && sameHome(view2, target.bot) && view2.nodes.some((node) => under(node, scope3) && node.label === "heading Activity") ? scope3 : void 0;
    };
    const [editable, unchanged2] = await Promise.all([waitFor((view2) => {
      const scope3 = ready(view2);
      return !!scope3 && !!commentComposer(view2, scope3);
    }, afterItem), stillCurrent()]);
    if (!active() || !unchanged2) return false;
    const view = editable ?? await read();
    const scope2 = ready(view);
    if (!scope2) return false;
    const input2 = commentComposer(view, scope2);
    if (!input2) return editable ? false : "read-only";
    const focusedView = view.focused === input2.index ? view : await press(view, (next) => {
      const pane = ready(next);
      return pane && commentComposer(next, pane);
    });
    if (!focusedView) return "composer-unavailable";
    const focused = await waitFor((current2) => {
      const pane = ready(current2);
      const field = pane && commentComposer(current2, pane);
      return !!field && current2.focused === field.index;
    }, focusedView);
    return !focused ? "composer-unavailable" : active() && await stillCurrent();
  }
  stage?.("question");
  const [detail, unchanged] = await Promise.all([waitFor((view) => {
    const scope2 = itemScope(view, target);
    return sameHome(view, target.bot) && !!scope2 && !!emptyComposer(view, scope2, target.bot) && !!exactQuestion(view, scope2, target);
  }, afterItem), stillCurrent()]);
  if (!active() || !unchanged) return false;
  if (!detail) return "question-unavailable";
  const scope = itemScope(detail, target);
  const input = emptyComposer(detail, scope, target.bot);
  stage?.("composer");
  const opened = boundQuestion(detail, scope, target) && detail.focused === input.index ? detail : await press(detail, (next) => {
    const pane = itemScope(next, target);
    if (!pane) return;
    const field = emptyComposer(next, pane, target.bot);
    const control = field && exactQuestion(next, pane, target);
    if (!control) return;
    if (boundQuestion(next, pane, target)) return field;
    if (control !== "already-bound") return control;
  });
  if (!opened) return "composer-unavailable";
  const replied = await waitFor((view) => {
    const current2 = itemScope(view, target);
    if (!current2 || !sameHome(view, target.bot) || !exactQuestion(view, current2, target)) return false;
    return emptyComposer(view, current2, target.bot)?.index === view.focused && boundQuestion(view, current2, target);
  }, opened);
  return !replied ? "composer-unavailable" : active() && await stillCurrent();
}

// src/worker.ts
function createMonitor(run, notify, clock = Date.now) {
  const cache = /* @__PURE__ */ new Map();
  const history = /* @__PURE__ */ new Map();
  const eventAt = /* @__PURE__ */ new Map();
  let notificationIssue;
  function allRows() {
    const now = clock();
    return visibleRows([...cache.values()].flatMap((source) => source.rows.filter((row) => withinActivityWindow(row.at, now)).map((row) => ({ ...row, stale: !source.ok }))));
  }
  function expiresIn() {
    const rows = allRows();
    if (!rows.length) return void 0;
    return rows.reduce((oldest, row) => Math.min(oldest, row.at), Infinity) + activityWindow + 1 - clock();
  }
  function board() {
    const records = [...cache.values()];
    const sorted = allRows().sort((a, b) => Number(b.state === "input") - Number(a.state === "input") || b.at - a.at || display(a.title, "en").localeCompare(display(b.title, "en"), "ja"));
    const rows = [];
    let size = 0;
    for (const row of sorted) {
      size += Buffer.byteLength(JSON.stringify(row), "utf8") + 1;
      if (size >= 18e4) break;
      rows.push(row);
    }
    const snapshot = {
      rows,
      hiddenRows: sorted.length - rows.length,
      sources: records.map(({ label, at, issue }) => ({ label, at, issue })),
      notificationIssue
    };
    return JSON.parse(JSON.stringify(snapshot));
  }
  async function report(row, move) {
    const entries = history.get(row.id) ?? [];
    history.set(row.id, [...entries.slice(-99), move]);
    try {
      if (!await notify(row, move)) notificationIssue = copy("Orca could not deliver the notification.", "Orca\u304C\u901A\u77E5\u3092\u914D\u4FE1\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F");
    } catch {
      notificationIssue = copy("The Orca notification request failed.", "Orca\u306E\u901A\u77E5\u547C\u3073\u51FA\u3057\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  }
  async function ingest({ batches, complete }) {
    const before = new Map(allRows().map((row) => [row.id, row]));
    const touched = new Set(batches.map((batch) => batch.key));
    for (const batch of batches) {
      const old = cache.get(batch.key);
      const rows = batch.ok ? batch.rows.map((row) => {
        const previous = old?.rows.find((entry) => entry.id === row.id);
        return previous && (eventAt.get(row.id) ?? 0) > (row.stateAt ?? row.at) ? { ...row, state: previous.state, stateAt: previous.stateAt, at: Math.max(previous.at, row.at) } : row;
      }) : old?.rows ?? [];
      cache.set(batch.key, { ...batch, rows, at: batch.ok ? clock() : old?.at });
    }
    for (const [key, source] of cache) {
      if (touched.has(key)) continue;
      if (complete) cache.delete(key);
      else cache.set(key, { ...source, ok: false, issue: copy("Could not refresh", "\u518D\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093") });
    }
    const current = allRows();
    const present = new Set([...cache.values()].flatMap((source) => source.rows.map((row) => row.id)));
    for (const id of history.keys()) if (!present.has(id)) history.delete(id);
    for (const id of eventAt.keys()) if (!present.has(id)) eventAt.delete(id);
    const changes = await Promise.all(current.map(async (row) => {
      const previous = before.get(row.id);
      if (!previous || previous.stale || row.stale || previous.at && row.at && row.at < previous.at) return [];
      if (withinActivityWindow(row.at, clock()) && row.source === "Bot Item" && previous.cursor && row.cursor && previous.cursor !== row.cursor) {
        try {
          const official = await itemHistory(run, row, previous.cursor);
          const moves = official.entries.map((entry) => entry.transition);
          let state = previous.state;
          const continuous = moves.every((move) => {
            if (move.from !== state) return false;
            state = move.to;
            return true;
          });
          if (official.cursor === row.cursor && continuous && state === row.state) return moves;
        } catch {
        }
      }
      return previous.state !== row.state ? [
        transition(
          previous,
          row.state,
          row.at > previous.at ? row.at : clock(),
          joinCopy([sourceNames[row.source], copy("refresh", "\u53D6\u5F97\u5DEE\u5206")], " ")
        )
      ] : [];
    }));
    for (const [index, row] of current.entries()) {
      for (const move of changes[index]) {
        if (withinActivityWindow(row.at, clock())) await report(row, move);
      }
    }
  }
  async function event(payload, verify) {
    const source = cache.get("agents");
    if (!source?.ok) return false;
    const matches = source.rows.filter((row2) => row2.source === "Orca \u30BF\u30FC\u30DF\u30CA\u30EB" && row2.pane === payload.paneKey);
    if (matches.length !== 1) return false;
    const row = matches[0];
    const main = payload.mainAgent;
    if (!main || !withinActivityWindow(main.stateStartedAt, clock()) || main.stateStartedAt <= Math.max(row.stateAt ?? row.at, eventAt.get(row.id) ?? 0)) return false;
    if (!payload.sessionId || !row.ref.startsWith("orca_session_id:") || row.ref.replace(/^orca_session_id:/, "") !== payload.sessionId.replace(/^orca_session_id:/, "")) {
      if (!verify || !await verify(row)) return false;
    }
    if (!withinActivityWindow(main.stateStartedAt, clock())) return false;
    const to = sessionState(main.state, main.outcome);
    if (to === row.state) return false;
    const wasVisible = withinActivityWindow(row.at, clock());
    const move = transition(row, to, main.stateStartedAt, copy("Orca event", "Orca \u30A4\u30D9\u30F3\u30C8"));
    eventAt.set(row.id, move.at);
    row.state = to;
    row.at = Math.max(row.at, move.at);
    row.stateAt = move.at;
    if (wasVisible) await report(row, move);
    return true;
  }
  async function detail(id, questionId) {
    const missing = { transitions: [], issue: copy("Session unavailable", "\u5BFE\u8C61\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093") };
    const find = () => allRows().find((item) => item.id === id);
    const row = find();
    if (!row) return missing;
    const transitions = [...history.get(id) ?? []].reverse();
    if (row.stale) return { transitions, issue: copy("Could not load the latest details. Select Refresh to try again.", "\u5BFE\u8C61\u306E\u6700\u65B0\u60C5\u5831\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3002\u66F4\u65B0\u3057\u3066\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002") };
    const current = () => withinActivityWindow(row.at, clock()) && find()?.stale === false;
    const guarded = (...args) => current() ? run(...args) : Promise.reject(new Error("outside_activity_window"));
    try {
      const result = row.source === "Bot \u30EF\u30FC\u30AB\u30FC" ? { transitions, activity: await workerConversation(guarded, row) } : row.source === "Bot Item" ? await botDetail(guarded, row, transitions, questionId, current) : { transitions, ...await sessionDetail(guarded, row) };
      return current() ? result : missing;
    } catch {
      if (!current()) return missing;
      return {
        transitions,
        issue: copy("Could not load Bot Item details. Select Refresh to try again.", "Bot Item\u306E\u8A73\u7D30\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3002\u66F4\u65B0\u3057\u3066\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002"),
        questionStatus: row.state === "input" ? "unverified" : void 0
      };
    }
  }
  return { board, expiresIn, ingest, event, detail };
}
var stop;
function openBotHome(bot, signal) {
  if (process.platform !== "darwin" || signal.aborted) return Promise.resolve(false);
  return new Promise((resolve2) => {
    execFile3("/usr/bin/open", ["-g", "-b", "com.stablyai.orca", "orca://bot/" + bot], {
      timeout: 3e3,
      signal
    }, (error) => resolve2(!error));
  });
}
async function openBoard(run, signal, currentLanguage = () => "en") {
  if (signal.aborted) return display(copy("Could not open Session Board.", "\u30BB\u30C3\u30B7\u30E7\u30F3\u30DC\u30FC\u30C9\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F\u3002"), currentLanguage());
  try {
    const data = await run("plugin", "list");
    const pluginKey = "yoshhiide.session-board";
    const plugins = list(data.plugins).filter((plugin) => plugin.pluginKey === pluginKey && plugin.status === "running" && list(plugin.commands).some((command) => command.id === "open-board") && list(plugin.panels).some((panel) => panel.id === "session-board"));
    if (plugins.length === 1 && !signal.aborted) {
      const result = await run("plugin", "open", pluginKey, "--panel", "session-board");
      if (result.kind === "panel" && result.pluginKey === pluginKey && result.panelId === "session-board") {
        return display(copy("Opened Session Board.", "\u30BB\u30C3\u30B7\u30E7\u30F3\u30DC\u30FC\u30C9\u3092\u958B\u304D\u307E\u3057\u305F\u3002"), currentLanguage());
      }
    }
  } catch {
  }
  return display(copy(
    "Could not open Session Board. Open it from the right sidebar.",
    "\u30BB\u30C3\u30B7\u30E7\u30F3\u30DC\u30FC\u30C9\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u53F3\u5074\u30C4\u30FC\u30EB\u304B\u3089\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
  ), currentLanguage());
}
function setupWorker(orca, run, interval = 15e3, openBot = openBotHome, clock = Date.now) {
  let locale = "en";
  const label = (value) => display(value, locale);
  const monitor = createMonitor(run, async (row, move) => {
    const result = await orca.host.call("notifications.show", {
      title: label(states[move.to]) + " \xB7 " + label(row.title),
      body: label(states[move.from]) + " \u2192 " + label(states[move.to]) + " \xB7 " + label(row.origin)
    });
    return result.delivered;
  }, clock);
  let timer;
  let expiry;
  let refresh;
  let queue = Promise.resolve();
  let stopped = false;
  let replying = false;
  const post = () => {
    const value = monitor.board();
    if (!stopped) {
      orca.panels.post("board.changed", value);
      clearTimeout(expiry);
      const delay = monitor.expiresIn();
      if (delay !== void 0) {
        expiry = setTimeout(post, Math.max(1, delay));
        expiry.unref();
      }
    }
    return value;
  };
  function serialize(fn) {
    const next = queue.then(fn);
    queue = next.then(() => void 0, () => void 0);
    return next;
  }
  function poll() {
    if (refresh) return refresh;
    refresh = collect(run, clock).then((snapshot) => serialize(async () => {
      if (!stopped) await monitor.ingest(snapshot);
      return post();
    })).finally(() => {
      refresh = void 0;
    });
    return refresh;
  }
  function background() {
    void poll().catch(() => orca.log(label(copy("Session Board refresh failed", "\u30BB\u30C3\u30B7\u30E7\u30F3\u30DC\u30FC\u30C9\u306E\u53D6\u5F97\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F"))));
  }
  function start() {
    if (!timer && interval > 0) {
      timer = setInterval(background, interval);
      timer.unref();
    }
  }
  const events = orca.events.on("agent.status.changed", async (payload) => {
    start();
    const applied = await serialize(async () => {
      if (stopped) return;
      const changed = await monitor.event(payload, async (row) => {
        if (!payload.workspaceListId || !payload.terminalId) return false;
        try {
          const { agents } = await orca.host.call("agents.list", { workspaceId: payload.workspaceListId });
          const matches = agents.filter((agent) => agent.terminalId === payload.terminalId && agent.sessionId === payload.sessionId);
          return matches.length === 1 && await terminalStillMatches(run, row);
        } catch {
          return false;
        }
      });
      post();
      return changed;
    });
    if (!applied && (!monitor.board().sources.length || withinActivityWindow(payload.mainAgent?.stateStartedAt, clock()))) background();
  });
  orca.panels.handle("board.start", (input) => {
    locale = language(input?.locale);
    start();
    background();
    return monitor.board();
  });
  orca.panels.handle("board.refresh", (input) => {
    locale = language(input?.locale);
    start();
    return poll();
  });
  const command = orca.commands.register("open-board", (_args, { signal }) => openBoard(run, signal, () => locale));
  orca.panels.handle("board.detail", async ({ id, questionId }) => JSON.parse(JSON.stringify(await monitor.detail(id, questionId))));
  orca.panels.handle("board.reply", async ({ id, questionId, index }, { signal }) => {
    const row = monitor.board().rows.find((item) => item.id === id);
    const botId = row?.bot;
    if (replying || stopped || signal.aborted || !row || row.stale || !botId) return { opened: false };
    replying = true;
    const start2 = performance.now();
    let phase = "target";
    let phaseStart = start2;
    const timings = {};
    let outcome = "not-verified";
    const mark = (next) => {
      const now = performance.now();
      timings[phase] = Math.round(now - phaseStart);
      phase = next;
      phaseStart = now;
    };
    try {
      const preflight = prepareNativeReply(run, signal);
      void preflight.catch(() => {
      });
      const [data, target] = await Promise.all([run("bot", "list"), readItemReplyTarget(run, row, questionId, index)]);
      const bots = list(data.bots);
      if (target === "choose" || target === "changed") {
        outcome = target;
        return { opened: false, reason: target };
      }
      if (!target || !Array.isArray(data.unreachable) || data.unreachable.length || bots.filter((bot) => bot.name === target.bot || bot.id === botId).length !== 1 || !bots.some((bot) => bot.id === botId && bot.name === target.bot && bot.server == null)) {
        outcome = "target-unavailable";
        return { opened: false, reason: "target-unavailable" };
      }
      const stillCurrent = async () => !stopped && !signal.aborted && withinActivityWindow(row.at, clock()) && JSON.stringify(await readItemReplyTarget(run, row, questionId, index)) === JSON.stringify(target);
      const result = await nativeReply(run, target, stillCurrent, signal, () => openBot(botId, signal), mark, preflight);
      if (typeof result === "string") {
        outcome = result;
        if (!signal.aborted && (result === "item-unavailable" || result === "question-unavailable" || result === "composer-unavailable")) {
          void orca.host.call("notifications.show", {
            title: label(copy("Reply did not open", "\u8FD4\u4FE1\u6B04\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F")),
            body: label(replyMessages[result])
          }).catch(() => {
          });
        }
        return { opened: result === "read-only", reason: result };
      }
      if (result) outcome = "focused";
      return { opened: result };
    } catch (error) {
      orca.log(label(copy("Could not verify the reply destination in Orca: ", "\u6A19\u6E96\u306E\u56DE\u7B54\u5148\u3092\u7167\u5408\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F: ")) + (error instanceof Error && /^[a-z][a-z0-9_]{1,63}$/.test(error.message) ? error.message : "navigation_failed"));
      return { opened: false };
    } finally {
      const end = performance.now();
      timings[phase] = Math.round(end - phaseStart);
      orca.log("board.reply: " + JSON.stringify({
        outcome: signal.aborted ? "cancelled" : outcome,
        stage: phase,
        elapsedMs: Math.round(end - start2),
        stageMs: timings
      }));
      replying = false;
    }
  });
  orca.panels.handle("board.focus", async ({ id, questionId }, { signal }) => {
    const original = monitor.board().rows.find((row) => row.id === id);
    if (!original || original.stale || signal.aborted) return false;
    try {
      if (original.bot && original.source === "Bot Item") {
        if (!await uniqueLocalBot(run, original.bot)) return false;
        const { item } = await itemPage(run, original);
        if (signal.aborted || !withinActivityWindow(original.at, clock()) || time(item.snoozedUntil) > clock() || questionId && questionId !== pendingQuestionId(item)) return false;
        return await openBot(original.bot, signal);
      }
      if (!original.target) return false;
      const fresh = (await collect(run, clock)).batches;
      const row = fresh.filter((batch) => batch.ok).flatMap((batch) => batch.rows).find((row2) => row2.id === id);
      if (signal.aborted || !row?.target || row.target !== original.target || row.targetIncarnation !== original.targetIncarnation || row.pane !== original.pane || row.workspace !== original.workspace || !await terminalMatches(run, row) || signal.aborted || !withinActivityWindow(row.at, clock())) return false;
      const result = optional((await run("terminal", "switch", "--terminal", row.target)).focus);
      return result.handle === row.target && result.worktreeId === row.workspace && result.navigated === true;
    } catch {
      return false;
    }
  });
  return () => {
    stopped = true;
    clearInterval(timer);
    clearTimeout(expiry);
    events.dispose();
    command.dispose();
  };
}
function activate(orca) {
  stop = setupWorker(orca, cli);
}
function deactivate() {
  stop?.();
}
export {
  createMonitor,
  deactivate,
  activate as default,
  openBoard,
  setupWorker
};
