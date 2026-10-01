Tech Hub 0.6.0 merges davidadevore’s contributions and adds clearer service controls.

- Router Panel (formerly Ultrix Panel) now supports Blackmagic Videohub over TCP 9990 alongside Ross Ultrix / SW-P-08.
- Save multiple routers and select one active router. Each retains its own levels, sources, destinations, categories and profiles. Existing single-router settings migrate automatically.
- Configure routers on the new local-only settings page, with live category previews. Revert recalls the previous route on changed levels, subject to profile permissions.
- Find HyperDecks from Record Monitor settings by scanning one private IP or a /24 or /23 range. Discovery reads TCP 9993 greetings without sending recorder commands. Add results explicitly, then save settings. AJA Ki Pro devices still require manual entry.
- Select NETGEAR SNMPv3 security levels, including authentication without encryption. Trunk ports have clearer indicators and tagged-VLAN details; VLAN assignment remains read-only.
- Improved D’san full-screen clock fitting and centered the clock when PerfectCue is disabled.
- Service enabled/disabled controls now use visible slider switches, with keyboard focus and reduced-motion support.

Quit Tech Hub before updating. Settings, passwords and assigned ports are preserved. Router Panel retains the existing ultrix service identity and default port 8706. Companion 1.0.3 remains compatible.

Mac: Apple silicon, macOS 13+; ad-hoc signed, not notarized. Windows: x64, Windows 10 (1809+) or Windows 11; unsigned per-user installer. Both installers bundle their runtimes.

Validation uses automated tests, simulated routers and disconnected service checks. Physical Videohub, HyperDeck, AJA and NETGEAR hardware were not exercised for this release. Thanks to davidadevore for the fork contributions.
