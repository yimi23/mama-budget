# ChatGPT app: what the research found (Oct 7 2026)

Sources: developers.openai.com/plugins (the Apps SDK docs now live here), github.com/openai/openai-apps-sdk-examples,
the npm registry. Not confirmed: whether the old `text/html+skybridge` mime is still accepted at runtime; the Secure
MCP Tunnel CLI; plan tiers for custom MCP servers.

## The headline
OpenAI renamed apps to **plugins** and moved the UI layer to the cross-vendor **MCP Apps** standard. The `openai/*`
keys are now compatibility aliases. New work targets the standard keys.

## Protocol
- An MCP server over Streamable HTTP at `/mcp`, public HTTPS for submission.
- Tools: `registerAppTool` with zod input and output schemas, `annotations` (readOnlyHint, destructiveHint,
  openWorldHint all required). Handler returns `{ structuredContent, content: [{ type: 'text', text }], _meta }`.
  Only `structuredContent` and `content` reach the model.
- Widget: `registerAppResource` at a `ui://` URI, `mimeType: 'text/html;profile=mcp-app'`; link it from the tool with
  `_meta.ui.resourceUri` (alias `openai/outputTemplate`). CSP via `_meta.ui.csp: { connectDomains, resourceDomains }`.
- Widget bridge: `window.openai` (toolOutput, callTool, sendFollowUpMessage, setWidgetState, theme) or the `App`
  class from `@modelcontextprotocol/ext-apps`.

## Auth
- OAuth 2.1 authorization code + PKCE, discovery at `/.well-known/oauth-protected-resource` on the MCP server and
  `/.well-known/oauth-authorization-server` on the auth server. ChatGPT registers as a client by CIMD
  (`https://chatgpt.com/oauth/client.json`) or dynamic registration; redirect `https://chatgpt.com/connector_platform_oauth_redirect`.
- There is **no link-code flow**. A tool may declare `securitySchemes: [{ type: 'noauth' }, { type: 'oauth2', ... }]`
  so anonymous calls work and linking unlocks more. `_meta['openai/subject']` is an anonymized per-user id.
- Testing a private server: chatgpt.com/plugins > Add custom MCP server > public HTTPS URL ending in `/mcp`.

## Distribution and money
- Submission is a plugin ZIP (`plugin.json`, `mcp.json`), automated checks, 5 positive + 3 negative test cases, a
  video, demo credentials, privacy policy and terms URLs, identity verification. Few plugins get directory placement;
  the rest are reachable by exact name or link.
- Finance rules: no money movement or trades; bank data is "sensitive" (strict necessity, consent, disclosure).
  A budgeting companion reading its own envelopes is allowed.
- **Subscriptions cannot be sold or promoted inside ChatGPT.** A plugin may explain a plan limit and link out. So the
  ChatGPT app is a door, never a till: pricing stays on our own site and in the extension.

## Packages
`@modelcontextprotocol/sdk` 1.32.x (`server/streamableHttp.js`), `@modelcontextprotocol/ext-apps` 2.x
(`registerAppResource`, `registerAppTool`, `RESOURCE_MIME_TYPE`), `zod`. No `@openai/apps-sdk` package exists;
`@openai/apps-sdk-ui` is a design system only.

## What we built from this
`apps/chatgpt/`: an MCP server in plain Node that calls the Mama API with a per-subject device token, three read tools
(`week_left`, `weigh_purchase`, `shelf_items`), one card widget, `noauth` plus `oauth2` declared so anonymous use works
today and account linking can be added when OAuth lands on the API. See `apps/chatgpt/README.md`.
