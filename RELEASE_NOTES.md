Tech Hub 0.5.0 adds easier navigation, live configuration, backups, and troubleshooting across the six-service desktop app.

- Switch between enabled apps from the mobile-friendly dropdown at the top left. Recovery and sign-in pages keep the switcher available; D’san full-screen presentation stays uncluttered.
- Enable or disable services from the master page. Disabled services stop, retain their settings, and disappear from the dropdown.
- Configure Record Monitor inside the app with red accents. Settings apply live and preserve unchanged recorder connections; saving never starts or stops a recording.
- Configure Ultrix Panel inside the app with blue accents and forms for router connections, levels, labels, visibility, and profiles. Settings apply live; connection changes reconnect only the router.
- Validate configuration before saving, warn about unsaved edits, and prevent stale settings windows from overwriting newer changes in the Record/Ultrix forms and master configuration editor.
- Export password-encrypted configuration backups, restore saved settings, and keep ten automatic local snapshots. Restoring stops services and requires quitting and reopening Tech Hub.
- View service health, data freshness, and recent errors in Troubleshooting. Download a diagnostic report without credentials, device names/addresses, or raw logs.
- Mark Record Monitor data stale when requests stall and prevent overlapping browser polls.
- Check for updates at startup and show changes from the installed version through the latest desktop release. Updates remain manually downloaded and installed.
- Use the TH desktop/tray icon and master-page favicon, plus service-specific browser icons. Simplified the main header to Tech Hub.

Quit Tech Hub before updating. Existing settings and passwords are preserved. Both installers bundle the required runtimes. Companion 1.0.3 remains compatible and does not need updating.

macOS: Apple silicon, macOS 13 or later; ad-hoc signed, not notarized. Windows: x64, Windows 10 (1809+) or Windows 11; unsigned per-user installer.

Validation uses automated tests and disconnected local services/test devices. Live routing, recording, and physical-device discovery were not exercised for this release. Source attribution is in THIRD_PARTY.md.
