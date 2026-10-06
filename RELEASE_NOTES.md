Tech Hub 0.7.1 adds Settings, optional network administration and Connected Devices.

- Settings replaces the admin badge in the master page header. Local Network Names now lives inside Settings.
- Allow other computers on your local network to administer Tech Hub using a separate administrator password of 4 or more characters. Remote administration starts disabled.
- Remote administrators can manage services, passwords, configurations, backups, diagnostics and network names. Sign-in attempts are rate-limited; sessions last one hour. Changing the password or access setting signs out remote administrators.
- Connected Devices sits to the left of Settings and lists active browser IPs, applications, page counts and last activity. Browser pages check in every 15 seconds and expire after 60 seconds without activity. No network scan is performed; background browsers can suspend activity, and multiple clients can share an IP.
- Updates now appears directly above Backup & Restore. Removed the dashboard subtitle.

Quit Tech Hub before updating. Existing settings, service passwords, hostnames and assigned ports are preserved. Enable remote administration explicitly in Settings and use the displayed admin address. With the shared hostname listener enabled, tech.local/admin redirects to sign-in (custom names and identifiers also apply). These HTTP interfaces are intended for a trusted local network. Companion 1.0.3 remains compatible.

Mac: Apple silicon, macOS 13+; ad-hoc signed, not notarized. Windows: x64, Windows 10 (1809+) or Windows 11; unsigned per-user installer. Both installers bundle their runtimes.

Validated with automated tests, isolated HTTP fixtures, and browser checks of the Settings and Connected Devices dialogs. Physical show hardware was not exercised for this release.
