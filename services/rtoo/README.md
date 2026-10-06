# R-Too 1.0.0

A read-only d&b amplifier monitoring module for Tech Hub, adapted from [Devore’s D80-Panel](https://github.com/davidadevore/D80-Panel) at `0c802d95a14b33f10d8bd7e2943de6ef29825dcf`.

## Install and configure

1. Import `techhub-app-rtoo-1.0.0-universal.zip` through **Module Library → Testing & evaluation** in Tech Hub 1.0.1 or newer. Review the module and confirm installation. On currently released hosts this manual import is labeled unofficial.
2. Reopen Tech Hub after the first installation. Open R-Too from its card or the shared module dropdown.
3. As a Tech Hub administrator, open **Settings**. Enable network discovery and/or add one address per line. `10.1.1.150:30013` illustrates the address format, not a preconfigured device. Addresses without a port use 30013. Upstream reports D40 devices using 50014; use the device's configured OCA port.
4. Save settings. Changes persist in Tech Hub's module data directory and reconnect the monitoring sessions immediately, without restarting the module process. Discovery is off and the address list is empty on first installation.

The same ZIP runs on macOS arm64 and Windows x64 using Tech Hub's shared Node runtime. No Node installation, standalone application, second tray icon, or external `dns-sd` executable is needed. Once installed, the module works offline. Tech Hub supplies ports, passwords, module navigation, and remote administrator authentication. Settings and fault acknowledgement require administrator access; ordinary viewers can inspect telemetry. Acknowledgements are local monitoring state, clear when sessions are rebuilt or the module restarts, and do not change amplifier configuration.

## Monitoring

- Fleet view, input/output meters, channel details and faults retain Devore's OCA role-based getters and property subscriptions.
- The browser reads snapshots every 500 ms, without overlapping requests. Device telemetry still uses OCA subscriptions. HTTP snapshots work through the Tech Hub gateway without WebSocket support.
- Disconnected amplifiers show offline and clear old telemetry. Browser connection failures display a stale-data warning. Faults on online devices remain visible even when other amplifiers disconnect.
- Portable mDNS discovers `_oca._tcp` services carrying d&b serial metadata. Manual addresses remain available on networks where multicast discovery fails. There is no subnet port scan.
- Up to 128 amplifiers and four concurrent connection/tree-discovery attempts. Failed connections retry after five seconds; initial connection and object discovery are bounded. Reconfiguration and shutdown close old connections.
- This module never sends mute, gain, preset or power control commands. “R-Too” is a Tech Hub module name, not d&b's R1 software.

Upstream reports testing on D80 and D40. This integration is verified with simulated transports and HTTP fixtures; discovery and telemetry still need validation against physical amplifiers on both target operating systems. Upstream reported multi-interface multicast issues with JavaScript discovery on its rig, so use manual addresses if needed.

## Build and test

From the Tech Hub repository:

```sh
pnpm install --frozen-lockfile
node --test tests/rtoo.test.cjs
node scripts/package-rtoo.cjs
node sdk/run.cjs /path/to/extracted/rtoo-package
```

`package-rtoo.cjs` stages readable module source, UI, pinned pure-JavaScript dependencies and licenses, then validates and creates the universal ZIP. No platform binary, dependency install hook or native add-on is included. The module has its own version, independent of Tech Hub. For a module update, increment both `techhub-app.json`/`package.json` here and `modules.json` in the host repository.

## License and provenance

The combined R-Too module is distributed under **GPL-2.0-only**, matching its AES70.js dependency; see `LICENSE`. Devore's original dashboard and OCA role mapping are MIT-licensed; their notice is retained in `LICENSE-UPSTREAM`. The integration, portable discovery, settings, transport supervision and HTTP adaptation are provided under GPL-2.0-only. Dependency source and license files are included in the ZIP. All application JavaScript is readable source; no separate generated source is required.

Not affiliated with or endorsed by d&b audiotechnik. Device names and trademarks belong to their owners.
