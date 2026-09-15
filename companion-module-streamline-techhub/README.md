# Companion module: Streamline Tech Hub

Offline Companion 5.0+ module for D’san Limitimer clocks and PerfectCue arrow displays.
See [setup, variables, and presets](companion/HELP.md).

Import the release .tgz from Companion’s **Modules** page on the Companion
computer. Do not extract it. Then add a Streamline Tech Hub connection.

## Build from source

Use Node 22.20+ and pnpm 11. Run pnpm install --frozen-lockfile, pnpm test,
pnpm check, and pnpm package from this directory.

The official Companion build tool creates a .tgz with runtime dependencies
bundled. pkg/ is generated output. Source is MIT licensed.
