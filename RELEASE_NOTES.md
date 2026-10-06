Tech Hub 0.7.0 adds editable local network addresses for every application.

- Open services with short names: dsan.local, lux.local, pd.local, netgear.local, record.local, and router.local. tech.local provides a directory of enabled apps.
- Edit each service hostname under Local network names on the master page. Enter dsan1 or dsan1.local; both work. Duplicate and invalid names are rejected.
- Add an optional machine identifier, such as stage1, to produce dsan1-stage1.local. Give each Tech Hub computer on your network distinct names.
- Use addresses without port numbers through a shared HTTP port 80 listener. If port 80 is occupied or unavailable, Tech Hub retains hostname-and-port links and shows a retry option. Existing IP-and-port links remain available.
- The app switcher follows each destination service's hostname. Password checks and local-only administrative controls remain in place.
- Bonjour/mDNS names follow enabled services and network changes, withdraw on shutdown, and report detected name conflicts. Changes apply live; reopen shared pages using their updated links.

Quit Tech Hub before updating. Existing service settings, passwords and assigned ports are preserved. The new controls appear on the local master page. Companion 1.0.3 remains compatible.

Use explicit http:// addresses on a trusted local network. Clients need mDNS support and access to UDP 5353; port-free links also require TCP 80. VLAN isolation, VPNs and firewall settings may prevent access. HTTPS is not configured. The master administration page remains available only on the host computer.

Mac: Apple silicon, macOS 13+; ad-hoc signed, not notarized. Windows: x64, Windows 10 (1809+) or Windows 11; unsigned per-user installer. Both installers bundle their runtimes.

Validation includes automated tests, isolated service fixtures, and a live port-free .local resolution/HTTP check on macOS. Cross-device hostname resolution depends on your network; physical show hardware was not exercised for this release.
