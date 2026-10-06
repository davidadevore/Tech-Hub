# Tech Hub 1.0.1

- One universal app package per service, usable on Mac and Windows, plus a single **Tech-Hub-All-Apps.zip** offline download.
- Shared host runtime: Node 24 and versioned SDK helpers for persistent settings, bounded JSON requests, administrator checks, and HTTP startup.
- D’san and Power Monitor use host-managed native compatibility engines. Their tested protocol implementations are retained; UI packages no longer carry platform runtimes. Protocol-engine updates require a host update.
- Lux Link is paused and removed from the catalog, navigation, and new installers. Existing Lux settings and installed package data are retained.
- SDK updated with a universal starter, shared-runtime contract, packaging rules, and detailed instructions for AI-assisted development.
- Existing service ports, passwords and settings are preserved. Legacy v1.0.0 packages remain supported for the five active apps; update them through App Library.

Choose **Host** to install apps from the App Library or **Full** for the five apps included offline. Mac and Windows installers remain separate. The universal ZIP works on either supported host. Protocol engines have not been rewritten; device behavior still depends on your hardware and network.
