# App contract, version 1

Every package contains `techhub-app.json` at its root. Required fields:

- `schemaVersion`: 1
- `id`: lowercase letters, digits and hyphens, starting with a letter; 2–40 characters
- `name`: user-visible name, at most 80 characters
- `description`: plain text, at most 240 characters
- `version` and `minHostVersion`: numeric `major.minor.patch`
- `runtime`: `node` or `native`
- `entry`: a relative file path inside the package
- `accent`: a six-digit hexadecimal color
- `permissions`: an array of declared capabilities (`network`, `device-control`, `data-files`)
- `platforms`: supported platform IDs (`darwin-arm64`, `win32-x64`)

The host launches one process per enabled app and provides:

| Environment variable | Contract |
| --- | --- |
| TECH_HUB_BACKEND_HOST | Bind address, always 127.0.0.1 |
| TECH_HUB_BACKEND_PORT | Required assigned HTTP port; never select another port |
| TECH_HUB_DATA_DIR | Persistent app settings directory; create it if needed |
| TECH_HUB_PUBLIC_PORT | Assigned gateway port, not the internal listener |
| TECH_HUB_VERSION | Host version |
| TECH_HUB_MANAGED | `1` when run by Tech Hub |

Return HTTP 200 from `/` when ready. Keep HTTP responses bounded and handle client disconnects. Support termination with SIGTERM; Windows shutdown may terminate the process, so persist changes atomically when saved. Do not rely solely on shutdown to save settings.

Use root-relative asset/API paths, same-origin browser requests, and an HTML `head` element. The host injects shared navigation and browser activity tracking. Do not intercept `/__hub/*`; that namespace belongs to Tech Hub. WebSocket tunneling is not part of contract 1; use HTTP polling or SSE. Keep saved data outside the package. Use `x-techhub-local-client: 1` only as a host-provided indication on your loopback backend; never expose your backend to the network.

Settings routes that disclose credentials or modify privileged configuration must require the host-provided administrator indicator. Validate all input, keep credentials out of ordinary status responses, and return actionable errors. A service password is an access gate, not a read-only role; document app-specific control permissions.

Packages contain regular files and directories only. No symlinks, executables downloaded at runtime, install scripts, absolute paths, parent traversal, platform-reserved filenames, or secrets. The default updater cannot interpret your schema migrations; make them backwards compatible where possible and keep backups before irreversible changes.
