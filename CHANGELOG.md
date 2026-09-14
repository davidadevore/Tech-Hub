# Changelog

## 0.2.2 — 2026-09-14

- Extended Power Monitor discovery with single-IP inspection, /24 and /23 scans, checked/open TCP ports, and live-reading previews.
- Verified DKM-411 low-word-first decoding against live web readings before release.
- Added read-only Modbus validation for recognized DKM-411 devices, with explicit distinction between open ports and verified data.
- Kept discovered devices opt-in through Add and Save changes.

## 0.2.0 — 2026-09-13

- Added a native Windows x64 system-tray app with control-page, updates, and log links.
- Added a per-user Windows installer, bundled runtimes, process-tree cleanup, and cross-platform release builds and smoke tests.

- Made password controls easier to find with explicit Set password buttons.

- Automatically selected and saved available TCP ports when master, service, or internal web ports are occupied. Updated Mac menu discovery to follow the active hub’s actual master port.

- Matched Tech Hub’s master page and service sign-in screens to Streamline’s orange, dark backgrounds, and white text; kept green, amber, and red for operational status.

- Fixed the D’san countdown colon rendering to the right of its centered slot, including the disconnected `--:--` view. Kept separator spacing fixed in full-screen, desktop, and mobile displays.

## 0.1.0 — 2026-09-08

- Introduced Tech Hub as a native Apple silicon Mac menu-bar app.
- Bundled D’san Ready, Lux Link, and Power Monitor, with independent web ports.
- Added a local master page with live service status, ports, copyable LAN URLs, and password controls.
- Added separate service authentication, protected loopback-only backends, port-conflict reporting, and coordinated shutdown.
- Kept configuration outside the app bundle and used empty defaults for new installations.
- Added a self-contained Mac DMG build with checksum and installation instructions.
