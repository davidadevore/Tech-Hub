# Netgear Discovery — AI project handoff

## What this project is

Netgear Discovery is a Windows-hosted monitoring dashboard for NETGEAR AV switches. It discovers switches on a configured management subnet with SNMPv3, displays physical port layouts, VLAN colors, connected endpoints, errors, optical receive levels, bandwidth sampling, and LLDP-derived topology links. Multiple client devices open the dashboard served by the Windows computer.

The application intentionally shows **no devices found** when discovery returns nothing. Never restore demo or fake devices as a fallback.

## Runtime architecture

Two local services run together:

- Dashboard: Next.js on TCP port `3000`, normally available to LAN clients.
- Collector/settings server: Node.js in `collector/server.mjs` on TCP port `8787`.
- SNMP: the collector talks directly to switches over SNMPv3/UDP port `161`.
- Launcher/tray: Windows scripts start and supervise both processes and expose dashboard/settings shortcuts.

Important source locations:

- `app/page.tsx` — dashboard, switch detail, read-only port modal, VLAN display, and topology UI.
- `app/globals.css` — established dark NETGEAR Discovery visual system.
- `collector/server.mjs` — SNMP discovery, polling, cache, read-only AV profile import, and HTTP APIs.
- `collector/setup.html`, `setup.js`, `setup.css` — server-only settings interface.
- `lib/netgear-models.ts` — known NETGEAR model layouts and physical port arrangement.
- `scripts/installed-tray.ps1` — installed runtime supervisor/tray behavior.
- `installer/Netgear Discovery.iss` — Inno Setup installer definition and stable upgrade App ID.
- `installer/build-installer.ps1` and `finalize-installer.ps1` — packaging pipeline.

## Data and configuration

Development reads `collector/.env` when present. Installed copies store mutable data under:

`%ProgramData%\Netgear Discovery`

This includes `.env`, logs, discovery cache, saved VLAN color scheme, and other runtime state. Installer upgrades must never delete or overwrite this directory.

The collector cache allows devices to remain visible between scans, but stale switches age out. Dashboard requests use the current browser hostname to reach collector port `8787`.

## Discovery and port data

`collector/server.mjs` uses standard IF-MIB, BRIDGE/Q-BRIDGE MIB, LLDP, neighbor/FDB tables, PoE tables, and NETGEAR optical OIDs. A scan:

1. Enumerates IPv4 hosts from the configured subnet.
2. Performs concurrent SNMPv3 discovery.
3. Inspects responding NETGEAR switches.
4. Maps interface indexes to bridge ports and PVIDs.
5. Learns MAC/IP/LLDP endpoint information where the network exposes it.
6. Calculates bandwidth from counter deltas between samples.
7. Saves the resulting state to the local cache.

Endpoint names and IP addresses depend on switch FDB/LLDP/neighbor information and DNS visibility; they cannot always be inferred from SNMP alone. Optical readings depend on the installed transceiver exposing DDM and the model/firmware OID implementation.

## VLAN names and colors

The gear menu can pull NETGEAR AV profile names and colors from one selected switch's web API. The preview is not applied until the user selects **Use this scheme**. The saved scheme is reused until manually replaced. There is also a built-in scheme based on the user's current network.

Port hover text and line items display the VLAN ID and saved profile name. Physical port visuals use VLAN colors, with distinct SFP styling and connected/disconnected treatments.

## VLAN safety boundary

VLAN and AV profile assignment are intentionally read-only. The former SNMP PVID-only write path and dashboard administrator login were removed because changing a PVID does not apply the complete NETGEAR AV network profile, including associated PTP, QoS, multicast, and tagging settings.

Do not restore an SNMP PVID-only write. A future write implementation must use the switch's AV profile workflow, preserve the full network-profile configuration, and be verified across supported model and firmware combinations.

## Main HTTP APIs

- `GET /api/health` — collector health.
- `GET /api/switches` — live/cached switch, VLAN, and dashboard-address data.
- `POST /api/scan` — starts a network scan.
- `GET /api/interfaces` — local-server-only adapter discovery.
- `GET|POST /api/config` — local-server-only settings.
- `GET|POST /api/color-scheme` — read/apply saved AV profile scheme.
- `POST /api/color-scheme/pull` — local-server-only NETGEAR AV web API import.

## UI behavior worth preserving

- Dashboard and topology are tabs in the main header.
- Topology uses a large scrollable/zoomable canvas with saved browser-local node positions.
- Topology edges show local/remote ports, sampled bandwidth, optical values, and errors.
- Switch drawings use model layouts from `lib/netgear-models.ts`.
- SFP ports look different from RJ45 ports.
- Disconnected ports retain muted VLAN outlines; internal socket squares appear only when connected.
- Port errors appear on switch drawings and port line items.
- Port modal shows the current VLAN and saved profile color/name as a read-only value.

## Local development and verification

Install dependencies with `npm install` if needed. Common commands:

```powershell
npm run collector
npm run dev
node --check collector/server.mjs
npm run build
```

Dashboard: `http://localhost:3000`

Server settings: `http://localhost:8787/setup`

Before handing off a change:

1. Run the collector syntax check.
2. Run the production Next.js build.
3. Verify `/api/health` and the dashboard return successfully.
4. Verify that `/api/ports/vlan` is not available and that the dashboard contains no VLAN mutation controls.

The broad lint command may traverse staged installer build output; use build/type checking as the primary gate and scope linting to source when needed. There is a pre-existing React hooks lint finding in the topology local-storage initialization.

## Windows installer and upgrades

The installer bundles the production dashboard, collector, scripts, dependencies, and Node.js runtime. It creates shortcuts, optional startup behavior, and private-network firewall rules.

The Inno Setup `AppId` in `installer/Netgear Discovery.iss` must remain unchanged. That is what makes a newer installer upgrade the existing installation. Increase only the semantic version for releases.

Version locations that must agree:

- `package.json`
- root package entry in `package-lock.json`
- `installer/Netgear Discovery.iss`

Build with:

```powershell
npm run package:windows
```

Output is written to `installer-output/Netgear-Discovery-Setup-X.Y.Z.exe`. Record its SHA-256 after building. The installer is currently unsigned, so Windows may display a SmartScreen warning.

During upgrade the installer stops the installed Netgear Discovery processes, replaces application files, retains `%ProgramData%\Netgear Discovery`, and relaunches the app. Existing SNMP credentials, color scheme, and topology browser layout remain intact. Administrator credentials saved by version 0.2.1 are ignored and are removed from the local environment file the next time Server Settings are saved.

## Hosting note

The repository contains `.openai/hosting.json`, but the operational product must remain local because cloud hosting cannot directly perform raw SNMP/UDP discovery against the user's private switch network. Do not deploy a cloud copy as a replacement for the Windows collector. A future hosted companion would require an explicitly designed secure HTTP relay, which is outside the current architecture.

## Current release state

The dashboard is monitoring-only for VLAN/profile assignment. Version 0.2.1 briefly introduced an SNMP PVID-only write control; it has been removed from the source because it did not apply complete NETGEAR AV profiles.
