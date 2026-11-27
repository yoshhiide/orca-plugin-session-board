# Session Board

Track Bot work and regular Orca sessions together in the right sidebar. The list puts sessions that need input first. You can filter, search, switch to a board, and open a session to see its activity and state history.

## Installation

Session Board runs in Orca 1.4.277 or later on macOS. Turn on plugins in Orca Settings, then look for **Session Board** in Community. You can also install a tagged GitHub release.

```sh
orca plugin install yoshhiide/orca-plugin-session-board@v0.2.14 --json
```

Check that the publisher is `yoshhiide`, the plugin ID is `session-board`, and the execution profile is `trusted-worker`. When installing through the CLI, use the approval command it returns to confirm the installation.

## Permissions and data

- `agent:read` receives Orca agent state events.
- `notifications:show` delivers desktop notifications for state changes.
- The worker runs with your user permissions. It uses the local Orca CLI to read Bot, session, and terminal information. It reads Orca-managed local image files to create Bot Item attachment previews.
- Opening Orca's reply composer uses Orca Computer Use and requires macOS Accessibility permission. You write and send replies in Orca.
- The plugin keeps data local and does not send analytics.

## Use

Open **Session Board** from the right sidebar. You can also find **Open Session Board** in the Orca jump palette (⌘J by default on macOS).

- Use **List** or **Board** to group sessions by state. Open a row to switch between **Activity** and **State history**. Use Esc or **Sessions** to return focus to the original row. Resize the right sidebar to adjust the panel width.
- Select **Reply** on a Bot Item row or in its details to open Orca's composer. A single unanswered question opens directly. For multiple questions, select a question from the details. This needs an accessible Orca window and macOS Accessibility permission. If a draft or an answer choice is already present, the plugin leaves the current question selected.
- For a regular chat, use the tab name and workspace shown in the details to find the existing tab in Orca's jump palette. For a verified terminal, use **Open terminal** to return to it.
- The panel uses Japanese when Orca reports a Japanese display language and English otherwise. Reopen the panel after changing Orca's display language to apply it to the panel and subsequent notifications. Session titles, messages, questions, and terminal output appear in their original language.

## Refresh and notifications

- Session Board reads Bot Items, workers, Bot chat ownership, and regular sessions from Orca's CLI on this Mac. A worker linked to an Item is grouped with that Item. If Bot ownership cannot be verified, previously fetched regular sessions are marked unavailable.
- The list, board, and details use the same 120-hour window, including updates exactly 120 hours old. A session drops out of the list and count once it ages out and its open detail view closes. A fresh update brings it back. Activity and state history are subject to retrieval limits.
- Regular terminals use Orca state events where available. Bot work and regular chats refresh every 15 seconds. Session Board uses Orca's Bot Item history for consecutive state changes. Brief changes can be missed where detection relies on the difference between refreshes.
- Orca sends desktop notifications for detected state changes. On startup, after a session reappears, or after a fetch recovers, the latest result becomes the comparison baseline. After the panel has been opened once, monitoring continues while the worker runs, even when the panel is closed. The worker uses the most recent language supplied by the panel, with English as its startup fallback.
- Activity loads when you open a session. It identifies Bot Item comments, verified Bot and regular chats, terminal agent conversations, and terminal output by source. Owner and agent messages use opposite sides. The panel groups messages by date, shows message times when available, and calls out missing timestamps. Image-view events and terminal output have dedicated rows. When retrieval or transfer limits apply, the panel reports partial results. State history shows the official Item history or the last 100 observed changes. The plugin does not write conversation or terminal output to persistent storage.
- **Source status** shows when each source last refreshed successfully, along with fetch errors and retrieval or transfer limits.

## Development

```sh
npm ci
orca plugin types . --json
npm run typecheck
npm run build
orca plugin validate . --json
orca plugin test . --json
orca plugin check . --json
```

Source and tests with synthetic data are in `src/`. Orca loads the built files in `dist/` directly from the release tag. Run `npm run build` after changing the source.

[esbuild](https://github.com/evanw/esbuild) and [Node.js type definitions](https://www.npmjs.com/package/@types/node) are MIT-licensed. [TypeScript](https://github.com/microsoft/TypeScript) uses Apache-2.0. These development tools and types are excluded from the runtime bundles. The panel uses Orca's built-in `blocks` icon.

## License

[MIT](LICENSE)
