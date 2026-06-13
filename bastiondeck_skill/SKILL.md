---
name: bastiondeck
description: Operate BastionDeck through its local HTTP API. Use this skill when the user wants an agent to configure the global SSH jump host or login, create or edit localhost tunnels to private services, start/stop/restart tunnels, inspect tunnel health/status/logs, run VPN/jump-host preflight checks, or prepare local URLs for APIs, databases, dashboards, MCP servers, and other private-network services exposed through BastionDeck.
---

# BastionDeck

## Overview

Use BastionDeck as a local control plane for OpenSSH local-forwarding tunnels. Interact with the running service over HTTP, normally at `http://127.0.0.1:8787`.

Keep security boundaries clear: BastionDeck does not grant access by itself. The user's VPN, SSH keys, corporate policy, and existing OpenSSH configuration remain authoritative.

## Workflow

1. Discover the base URL. Use `BD_APP_URL` if the user provides it, otherwise try `http://127.0.0.1:8787`.
2. Call `GET /api/status` before making changes. Use it to learn current settings, tunnel IDs, health, and whether preflight is configured.
3. If `settings.jumpHost` or `settings.sshLogin` is missing or wrong, update settings with `PUT /api/settings`. Preserve existing fields unless the user asked to change them.
4. For a new target, parse or normalize the private address, suggest a local port when needed, then create the tunnel with `POST /api/tunnels`.
5. Report the resulting `localhost` URL and status. For API tunnels use `http://127.0.0.1:<localPort><path>`. For database or raw TCP targets, report `127.0.0.1:<localPort>`.

## API Quick Reference

Use JSON requests and responses. The service is local and currently has no HTTP authentication, so do not expose it beyond trusted loopback/local-network contexts.

```bash
BASE="${BD_APP_URL:-http://127.0.0.1:8787}"
curl -s "$BASE/api/status"
```

Core endpoints:

- `GET /api/status`: one-shot agent snapshot with `settings`, `tunnels`, and nullable `preflight`.
- `GET /api/settings`: current global jump host, SSH login, key path, port range, and health interval.
- `PUT /api/settings`: save settings explicitly.
- `GET /api/preflight?jumpHost=<host>`: DNS/TCP/login readiness check for the jump host.
- `POST /api/parse`: parse `address` into `{ host, port, path, type }`.
- `GET /api/suggest-port`: lowest free local port in the configured range.
- `GET /api/tunnels`: all tunnel configs with runtime status.
- `GET /api/tunnels/:id`: one tunnel with runtime status.
- `POST /api/tunnels`: create a tunnel; BastionDeck attempts to start it.
- `PATCH /api/tunnels/:id`: edit target/name/path/local port/auto-restart.
- `DELETE /api/tunnels/:id`: delete and stop a tunnel.
- `POST /api/tunnels/:id/start`, `/stop`, `/restart`: lifecycle actions.
- `GET /api/tunnels/:id/logs/snapshot`: current in-memory log buffer.
- `GET /api/stream` and `GET /api/tunnels/:id/logs`: Server-Sent Events streams.

## Settings

Settings are global. New runtime SSH sessions use `settings.jumpHost` and `settings.sshLogin`, not per-tunnel legacy fields.

Example:

```bash
curl -sS -X PUT "$BASE/api/settings" \
  -H 'Content-Type: application/json' \
  -d '{
    "jumpHost": "bastion.example.com",
    "jumpHosts": ["bastion.example.com"],
    "sshLogin": "jdoe",
    "keyPath": "",
    "portFrom": 8000,
    "portTo": 9999,
    "interval": 1800
  }'
```

Use generic examples in docs and responses. Do not invent or reveal real corporate hostnames, private domains, usernames, tokens, passwords, private keys, or `.env` values.

## Creating Tunnels

Prefer the parse/suggest/create sequence when the user gives a pasted address:

```bash
curl -sS -X POST "$BASE/api/parse" \
  -H 'Content-Type: application/json' \
  -d '{"address":"internal-api.example.com:8080/mcp"}'
curl -sS "$BASE/api/suggest-port"
curl -sS -X POST "$BASE/api/tunnels" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Internal API",
    "type": "API",
    "host": "internal-api.example.com",
    "port": 8080,
    "path": "",
    "localPort": 8000,
    "autoRestart": true
  }'
```

Valid tunnel `type` values are `API` and `MCP`. BastionDeck can infer MCP from `/mcp` paths or hostnames containing `mcp`, but send an explicit type when the user's intent is clear.

## Status And Troubleshooting

Use `GET /api/status` for summaries and `GET /api/tunnels/:id/logs/snapshot` for recent details. Status values are `inactive`, `connecting`, `active`, and `error`.

When a start fails:

1. Check `preflight.status` and `preflight.message`.
2. Confirm `settings.sshLogin` is present.
3. Check recent logs for the tunnel.
4. Suggest user-side fixes only within BastionDeck's boundaries: connect VPN, verify SSH key access, correct jump host/login, free the local port, or restart the tunnel.

Avoid constructing shell SSH commands for execution. BastionDeck itself spawns `ssh` without a shell and binds forwarded ports to `127.0.0.1`.
