# Mama Budget in ChatGPT

An MCP server over Streamable HTTP (`/mcp`) that calls the Mama API. Research and the spec it follows:
`docs/research/CHATGPT_APP.md`.

Tools, all read-only, all rendering the card (`card.html`):
- `week_left`: the envelope, spent, left, days to go, the jar, the streak.
- `weigh_purchase` (item, price, store?): her verdict and line through `/v2/judge`.
- `shelf_items`: what was put back, newest first.

Who the user is: ChatGPT sends an anonymized subject per user; the server derives a device token from it, so a person
who only meets her in ChatGPT still gets their own envelope on the API. Linking that to an extension account needs
OAuth on the API (`/.well-known/oauth-protected-resource` is already served, with no authorization server yet). Both
`noauth` and `oauth2` are declared on every tool, as the Apps SDK asks, so linking can be added without a new app.

No prices anywhere: ChatGPT forbids selling or promoting subscriptions inside an app. A locked plan reads as one
sentence and the site's address.

Run: `MAMA_API=http://localhost:8787 npm run chatgpt` (port 8790). Test: `npm test -w @mama/chatgpt`.
Try it in ChatGPT: expose the port over HTTPS (ngrok is fine), then chatgpt.com/plugins > Add custom MCP server >
`https://<host>/mcp` > no authentication > Create as a plugin. Submission needs the plugin ZIP, a privacy policy and
terms URL, a video and demo credentials (docs/research/CHATGPT_APP.md).
