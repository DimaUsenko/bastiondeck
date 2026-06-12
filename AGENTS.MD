# AGENTS.MD

Guidance for coding agents working on BastionDeck.

## Product Goal

BastionDeck is a local web panel that helps developers expose private-network
services as stable `localhost` URLs through a standard OpenSSH bastion tunnel.

The service is for corporate/private-network environments where users already
have:

- VPN or private-network access.
- OpenSSH installed.
- SSH public-key access to a bastion/jump host.
- A private host/port they want to reach locally.

BastionDeck must not replace access control, VPN, SSH keys, or company policy.
It should make existing SSH local-forwarding workflows easier to configure,
observe, restart, and share with teammates.

## Current Product Decisions

- One global jump host is configured in Settings and used by every tunnel.
- SSH login and key path are configured only in Settings.
- Per-tunnel jump host and per-tunnel SSH login are legacy fields only. New
  tunnel creation, command previews, and runtime SSH sessions should use
  `Settings.jumpHost` and `Settings.sshLogin`.
- Settings use an explicit `Save settings` action. Do not reintroduce
  autosave-on-blur for critical connection settings.
- Tunnels may still have their own target host, target port, path, local port,
  name, type, and auto-restart setting.
- Persistent data lives outside the installed app in `~/.bastiondeck/state.json`
  unless `BD_DATA_DIR` overrides it.

## Repository Map

- `client/` - React/Vite frontend.
- `client/src/App.tsx` - app shell, settings/tunnel state, API calls, SSE setup.
- `client/src/screens/SettingsPage.tsx` - global jump host, SSH login, key path,
  port range, health-check interval.
- `client/src/screens/NewTunnelModal.tsx` - create/edit tunnel target and local
  port. It must not expose SSH login or jump-host selection.
- `client/src/screens/DetailDrawer.tsx` - tunnel details, logs, command preview.
- `client/src/components/Card.tsx` - dashboard cards, status dot, copy button.
- `client/src/lib/tm.ts` - UI formatting helpers, address parsing, command text.
- `client/src/styles.css` - global styling and design system conventions.
- `server/` - Fastify backend and SSH tunnel manager.
- `server/src/routes.ts` - REST/SSE routes and request normalization.
- `server/src/store.ts` - JSON state persistence and settings normalization.
- `server/src/manager.ts` - runtime tunnel lifecycle, logs, status, restart.
- `server/src/ssh.ts` - SSH argv builder, local port suggestion, TCP helpers.
- `server/src/preflight.ts` - VPN/jump-host reachability checks.
- `server/src/health.ts` - local tunnel target probes, including MCP probing.
- `server/src/parse.ts` - strict validators and server-side address parsing.
- `bin/bastiondeck.mjs` - CLI entrypoint used by installs.
- `packaging/homebrew/` - Homebrew formula template.
- `packaging/windows/` - Windows CMD installer/uninstaller.
- `.github/workflows/ci.yml` - required CI checks.
- `.github/workflows/release.yml` - tag-based release artifact workflow.
- `test/` - Node test suite.

## Development Commands

Use Node.js 22+.

```bash
npm ci
npm run dev
```

Open the app at:

```text
http://localhost:5173
```

Production path:

```bash
npm run build
npm run start:cli
```

Before pushing code, run the same checks as CI:

```bash
npm audit --omit=dev
npm run typecheck
npm run build
npm test
npm run release:dir
```

## Runtime And Data

Default server bind:

```text
127.0.0.1:8787
```

Useful runtime options:

```bash
bastiondeck --host 127.0.0.1 --port 8787
bastiondeck --url-host bastiondeck.local
bastiondeck --data-dir ~/.bastiondeck-team
bastiondeck --no-open
```

Environment variables:

```bash
BD_HOST
BD_PORT
BD_PUBLIC_HOST
BD_APP_URL
BD_DATA_DIR
```

State is intentionally outside the app install:

- macOS/Linux: `~/.bastiondeck/state.json`
- Windows: `%USERPROFILE%\.bastiondeck\state.json`

Preserve this behavior. Uninstalling or replacing the app should not remove
saved settings and tunnels.

## Architecture Notes

The backend owns all security-sensitive validation. Frontend validation is for
fast user feedback only.

The SSH process is spawned without a shell:

```text
spawn("ssh", args, { shell: false })
```

Keep that invariant. Do not build shell command strings for execution.

SSH tunnels use:

```text
ssh -N -L 127.0.0.1:<localPort>:<targetHost>:<targetPort> <sshLogin>@<jumpHost>
```

Important SSH options are set in `server/src/ssh.ts`:

- `BatchMode=yes`
- `ExitOnForwardFailure=yes`
- `ServerAliveInterval=15`
- `ServerAliveCountMax=3`
- `StrictHostKeyChecking=accept-new`
- `ConnectTimeout=12`

Settings validation should stay strict and aligned across frontend and backend.
Use existing helpers in `server/src/parse.ts` as the source of truth.

## UI Guidelines

The app is an operational developer tool, not a landing page. Keep UI dense,
quiet, and clear.

- Preserve the existing dark, utilitarian visual style.
- Prefer explicit status near the control it describes.
- Do not rely on toast messages as the only error signal.
- Avoid adding decorative UI that does not help the workflow.
- Keep cards simple; do not nest cards inside cards.
- Use existing `Icons` and button classes before adding new styling.
- Settings should require explicit save/approval for connection-critical fields.
- New tunnel flow should focus on target service address, local port, name, and
  command preview. SSH credentials belong in Settings.

## Security And Privacy

This is a public repository. Never commit:

- Real corporate hostnames, private domains, internal URLs, or user logins.
- Tokens, PATs, API keys, passwords, private keys, or `.env` files.
- Generated local state from `~/.bastiondeck`.
- User-specific scratch files such as local context notes.

Use generic examples such as:

```text
bastion.example.com
internal-api.example.com
jdoe
```

Keep `.gitignore` protections for private context files. Before public-facing
changes, search for sensitive strings if the edit touched examples, docs, or
defaults.

## Testing Expectations

Test scope should match risk:

- Pure parsing/validation changes: add or update focused Node tests.
- Settings persistence/migration changes: add or update `test/settings.test.mjs`.
- SSH argv or runtime behavior changes: add or update `test/ssh.test.mjs`.
- UI-only changes: run typecheck/build and do a browser smoke check when
  practical.
- Release/distribution changes: run `npm run release:dir`.

The CI workflow runs:

```bash
npm ci
npm audit --omit=dev
npm run typecheck
npm run build
npm test
npm run release:dir
```

Do not push with known failing CI-equivalent checks unless the user explicitly
asks for a partial/WIP state.

## Release And Packaging

Release tags use:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow uploads:

- `bastiondeck-source.tar.gz`
- `bastiondeck-windows.zip`
- `install.cmd`
- `uninstall.cmd`

Homebrew support is currently a formula template under
`packaging/homebrew/bastiondeck.rb`. Update checksums after real GitHub release
artifacts exist.

## Git Workflow

The default branch is `main`.

Before committing:

1. Check `git status --short --branch`.
2. Avoid staging unrelated user changes.
3. Run the relevant checks.
4. Commit with a concise imperative message.
5. Push from the repo when requested or when the task clearly includes publish.

If the worktree contains unrelated edits, leave them untouched and mention them
in the final response.

## Common Pitfalls

- Do not reintroduce multiple jump hosts unless the product direction changes.
- Do not store SSH login or jump host per tunnel for new writes.
- Do not make Settings auto-save while the user is still typing.
- Do not let a stale VPN/preflight ok state imply unsaved invalid settings are
  valid.
- Do not bind forwarded local ports to non-loopback addresses.
- Do not use shell execution for SSH.
- Do not make examples company-specific.
