# CBC Quiz

Kahoot-style live quiz for Claude Builder Club meetings.

- `npm install` — install everything (workspaces)
- `npm run dev` — server on :3001, client on :5173 (proxied)
- `npm run build && npm start` — production: server serves the built client on :3001
- `ADMIN_PASSWORD` env var (default `cbc-admin`) protects `/admin`
- `PUBLIC_URL` env var overrides the join URL encoded in the QR code

Routes: `/` join · `/play` player · `/display/:code` projector · `/admin` control panel
