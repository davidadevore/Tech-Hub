# Record Monitor

Local status dashboard for 6 Blackmagic HyperDecks and 2 AJA Ki Pro units: recording / stopped, timecode,
time in state, and free space per drive, with warning/critical highlighting. No dependencies.

## Setup on the Windows machine

1. Install **Node.js LTS** (18 or newer) from https://nodejs.org, defaults are fine.
2. Copy this whole folder to the PC (e.g. `C:\record-monitor`).
3. Edit `config.json`: set each device's IP address.
4. Double-click **`start.bat`**. It opens http://localhost:8080 in your browser (always use `localhost`;
   `0.0.0.0` only means "listening on every network interface" and is not an address you can browse to). Any other machine on the network can use
   `http://<this-pc-ip>:8080` (the console prints the addresses). Allow Node through the Windows Firewall
   when prompted (Private networks) if you want other machines to see it.

Try it without hardware first: **`start-demo.bat`** runs simulated devices (HyperDeck 6 is intentionally offline).

**Run at login:** press `Win+R`, type `shell:startup`, and drop a shortcut to `start.bat` in that folder.

## HyperDecks

Uses the HyperDeck Ethernet Protocol (TCP 9993). Enable *Remote control* / Ethernet control if the model has that setting.
Record/stop, timecode and remaining record time come from this connection.

Drive percentage, in order of preference:

1. **Exact**: from the HyperDeck REST API (`/control/api/v1/media/workingset`, needs firmware with REST support).
   Shown as e.g. `78% free`.
2. **Estimated** (shown with `~`): older firmware only reports remaining record *time*, not capacity. Two options:
   - set `"fullCapacityMinutes": 240` on that device (record time of an empty drive at your usual format), or
   - do nothing: the dashboard learns the capacity as the largest remaining time it has seen for that
     volume and format (saved in `data/baselines.json`). If a drive is already partly full the first time
     the dashboard sees it, it will read high until the drive is swapped for an empty one.

Optional per-device keys: `port` (9993), `restPort` (80), `useRest` (false to skip REST), `slots` (2).

## Ki Pro

Uses AJA's HTTP interface (`/config?action=get&paramid=...`). Record/stop works out of the box via
`eParamID_TransportState`. AJA does not publish the parameter names for media free space, so set them once:

1. Double-click **`probe.bat`**, enter the Ki Pro IP. It lists likely parameters with current values.
2. Pick the ones that read like % free (or % used) and time remaining for each media slot.
3. Add them to that Ki Pro in `config.json`:

```json
{ "name": "Ki Pro 1", "type": "kipro", "host": "192.168.1.111",
  "media": [
    { "label": "SSD 1", "freePercent": "eParamID_...", "remainingMinutes": "eParamID_..." },
    { "label": "SSD 2", "usedPercent": "eParamID_..." }
  ] }
```

Until `media` is set, the Ki Pro card shows status only, with a note.

## Controls

The dashboard can also control the units (set `"controlEnabled": false` in `config.json` for view-only):

- **Status badge**: click a STOPPED unit to start recording. Click a REC unit and the badge turns amber
  ("TAP AGAIN TO STOP"); click again within 3 seconds to stop. The first click only arms it so a stray
  touch can't cut a recording (`"confirmStop": false` makes it one click).
- **MAKE ACTIVE** (HyperDecks): switches the active recording slot. Refused while recording, or if the slot has no media.
- **FORMAT** (each drive): erases and formats that drive. It opens a warning that names the unit, slot, volume and how full
  it is; the confirm button is locked for 2 seconds and Cancel is selected by default. It is refused while the unit is
  recording, playing back or offline, and if the drive in the slot has changed since the dialog opened. Set
  `"allowFormat": false` to remove the buttons. Drives are formatted as macOS (HFS+) by default; set `"formatFilesystem": "exFAT"` (top level of `config.json`, or on one device) to use exFAT instead.
  HyperDecks keep the existing volume name. On a Ki Pro the chosen file system is written to the unit's File System Formatting setting.
  The card shows "Formatting..." while it runs.
- **ALL START / ALL STOP** (header): opens a confirmation listing exactly which units will be affected.
  ALL START only touches idle units, ALL STOP only recording ones; offline or playing units are skipped and reported.

Safety: control requests must be same-origin JSON POSTs, so other web pages can't trigger them. Anyone who can open the
dashboard page can use the buttons; set `"controlLocalOnly": true` to allow control only from the PC running the server
(other machines then see a read-only view). Every command is logged in the console window with who sent it.

HyperDecks use `record` / `stop` / `slot select` over the control connection. Ki Pros use AJA's
`eParamID_TransportCommand` (3 = record, 4 = stop).

## Thresholds

`warnFreePercent` (default 20) and `criticalFreePercent` (default 10) in `config.json` drive the LOW / CRITICAL
markers and the summary bar. Restart `start.bat` after editing the config.

## Notes

- The dashboard opens its own connection to each HyperDeck (they allow only a few simultaneous control
  connections, so it will share with Companion etc. but count it if you have many controllers).
- `?theme=light` or `?theme=dark` in the URL overrides the system theme.
- If the page can't reach this server, it dims and shows a banner rather than showing stale data as current.
