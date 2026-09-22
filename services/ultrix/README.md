# Ultrix Panel

A phone-first web panel for routing on a Ross Ultrix (or any SW-P-08 router). A small Node service holds the
router connection; browsers only talk to the service, so hundreds of sources/destinations, category filters,
per-profile visibility and live feedback all work without DashBoard.

```
phone / tablet  --HTTP + SSE-->  panel server (Node)  --SW-P-08 over TCP-->  Ultrix
```

No dependencies. Node 22 or newer (the current LTS), on macOS, Linux or Windows.

On Windows, install Node from nodejs.org, then run the same commands below in PowerShell. The first start shows a
Windows Firewall prompt: allow **Private networks** so phones on the LAN can reach port 8080. To keep it running
after logout or reboot, use a service wrapper such as NSSM or a Task Scheduler task that runs `node src/main.js`
from this folder.

```bash
npm start        # demo mode: starts a mock router and the panel on http://localhost:8080
npm test         # 53 tests (framing, commands, config, client vs mock router, HTTP/SSE)
```

## Pointing it at the real Ultrix

Edit `config.json`:

```json
"router": { "host": "10.0.0.50", "port": 2000, "matrix": 1, "extended": "auto", "nameChars": 12 },
"mock":   { "enabled": false }
```

Then restart. `router.*` and `levels` need a restart; everything else (visibility, categories, labels,
profiles) reloads when you save the file.

Things to confirm on the frame, none of which I could verify without one:
- SW-P-08 is enabled on the Ultrix and which TCP port it listens on (2000 is only the mock's default).
- Matrix number (usually 1) and how many levels you want (Ultrix level 1 = video, further levels = audio).
- Whether it answers the tally dump. If not, the panel automatically falls back to interrogating every
  destination; set `destinations.count` so it knows how many.
- `nameChars`: 12 works on most routers; try 8 or 16 if names come back truncated or the router NAKs.

Port and destination numbers are 1-based, matching Companion's SW-P-08 module.

## Getting the router's names out (for categories and cleanup)

With `mock.enabled` set to `false` and `router.host` pointing at the Ultrix:

```bash
npm run dump
```

This is read-only (it never sends a route). It writes to an `exports` folder next to `config.json`:
`sources.csv`, `destinations.csv` (with each destination's current source), `summary.txt` and `router-dump.json`.
`summary.txt` lists unnamed ports, sources that are routed but have no name, and a paste-ready `categories` block
built from name prefixes (CAM, SAT, ...).

## Many levels (video + 16 audio)

List every level in `levels` in order (level 1 first), then add `levelGroups` so the phone shows presets instead of
17 chips. The "Levels..." button still expands to per-level chips for odd breakaways.

```json
"levels": [
  { "name": "Video", "short": "V" },
  { "name": "Audio 1", "short": "A1" }, { "name": "Audio 2", "short": "A2" }
  // ... up to Audio 16
],
"levelGroups": [
  { "name": "All", "levels": "1-17" },
  { "name": "Video", "levels": [1] },
  { "name": "Audio", "levels": "2-17" }
]
```

## When names change on the router

Names are downloaded when the panel connects, and never on a timer. After that they refresh two ways:

- **Automatically**, if the router announces a rename (SW-P-08 "names updated"). The panel waits about 3 seconds so a
  burst of renames causes one refresh. Whether a given Ultrix sends this notice is not confirmed.
- **By hand**: the **Refresh names** button on the Route screen shows when names were last loaded and how many
  changed. It is limited to one refresh every 5 seconds.

A refresh re-requests names only. It never changes a crosspoint, and it works on a read-only connection.
Open phones pick up the new names on their own; nobody needs to reload the page. Restarting the panel also
reloads everything.

## Choosing what is available

```jsonc
"sources": {
  "hidden": "232-*",                      // ranges: "1-10,15,200-*"
  "labels": { "1": "CAM 01 (Main)" },     // override the router's name
  "categories": [                         // first match wins; "match" is a regex on the name
    { "name": "Cameras", "match": "^CAM" },
    { "name": "Satellite", "range": "100-115" }
  ]
},
"destinations": { "protected": "1-2" },   // visible but cannot be taken from the panel
```

Also available per section: `include` (allow-list), `hideUnnamed`, `count`.

`profiles` narrow the base config per audience. A profile may set `sources`/`destinations` overrides, `levels`
(which levels it may route), `readOnly`, `title`, and `pin`. Switch profile from the dropdown, or open
`/?profile=engineer`. Profiles are enforced on the server: a take outside the profile's sources, destinations
or levels is refused.

## What the UI does

- Pick a destination, pick a source, press TAKE. Both pickers have search (name or number), category chips,
  recents, and show what is currently routed. Protected destinations are greyed out.
- Level chips (V / A1 / A2 ...) route breakaway. They reset to all levels after every take.
- After a take the server sends the connect(s), interrogates the destination, and only reports ROUTED once the
  router confirms. A protected or rejected route shows NOT CONFIRMED with what the router actually did.
- Changes made by anyone else (DashBoard, panels, other phones) appear live, and the Activity tab lists them.

## Read-only switch (optional)

Routing is on by default. To make a copy of the panel view-only, set `"allowRouting": false` in the `router`
block: takes are refused, the UI shows read-only, and the connection can only transmit read queries (interrogate,
tally dump, protocol info, names); connect, protect and salvo commands are blocked in code. A profile can also be
made read-only with `"readOnly": true`. `npm run dump` never routes.

## Real-Ultrix config and offline preview

`config.ultrix.json` has categories built from the names exported from the facility's Ultrix, three profiles
(`all`, `operator`, `viewer`), 17 levels with All/Video/Audio presets, and `nameChars: "auto"`.

`nameChars: "auto"` asks for 32-character names and steps down (16, 12, 8) if the router refuses. A fixed
`nameChars: 12` cuts long names off, which is easy to miss.

The simulator can replay a recorded `router-dump.json`, so real names and routes can be previewed with no router
involved: set `"mock": { "enabled": true, "replay": "path/to/router-dump.json" }` and point `router.host` at
`127.0.0.1`.

## Start automatically on Windows

`start-panel.cmd` runs the panel with `config.ultrix.json` and restarts it if it exits; output goes to
`%ProgramData%\ultrix-panel.log`. In an **administrator** Command Prompt, from this folder:

```
schtasks /create /tn "Ultrix Panel" /tr "\"%cd%\start-panel.cmd\"" /sc onstart /ru SYSTEM /rl HIGHEST
schtasks /run /tn "Ultrix Panel"
```

Remove it with `schtasks /delete /tn "Ultrix Panel" /f`. If the folder lives in Dropbox, mark it "Available
offline" so the files exist at boot before Dropbox starts.

## Security

The PIN is a speed bump, not real authentication. There is no TLS. Keep this on a trusted control VLAN, do not
expose it to the internet, and treat any profile without a `pin` as open to everyone who can reach the port.

## Layout

```
src/swp08/frame.js      DLE/STX framing, checksum, streaming decoder
src/swp08/commands.js   message builders/parsers (standard + extended)
src/swp08/client.js     connection, ACK queue, names, tally dump, route + confirm, reconnect
src/config.js           ranges, categories, profiles -> what each user may see/do
src/server.js           HTTP API, SSE, PIN sessions
src/mock-router.js      SW-P-08 simulator (used by demo mode and the tests)
public/                 the UI
```

Protocol details follow the Companion `generic-swp08` module, and the framing was cross-checked byte for byte
against the `probel-swp-08` library. The one deliberate difference: if the length or checksum byte happens to
equal 0x10 (DLE), this code doubles it like any other body byte.

## Not built yet

Multi-destination take, salvos (Ultrix salvos can be fired with RossTalk `GPI n` on port 7788), destination
lock/protect from the panel, HTTPS, saved favourites on the server.
