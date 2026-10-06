# Additional Tech Hub services

These applications run as separate local services under Tech Hub's supervisor.

- **NETGEAR AV Switchboard** — https://github.com/lukeirves/netgear-av-switchboard. Imported with redistribution permission confirmed by the Tech Hub owner on September 22, 2026. The upstream repository does not supply a general open-source license. This notice does not grant additional rights. Tech Hub adaptations serve the exported dashboard and collector on one assigned port, preserve local-only setup permissions, and keep settings in Tech Hub's per-user data directory. VLAN/profile assignment remains read-only.
- **Record Monitor** — https://github.com/davidadevore/Record_Monitor. GPL-3.0; see `services/record/LICENSE`. Complete service source and Tech Hub modifications are in `services/record/`, with packaging instructions and scripts in this repository. Modifications made September 22, 2026: managed listener configuration, per-user baseline storage, and preservation of local-only controls behind the proxy. No warranty is provided.
- **Router Panel** (formerly Ultrix Panel) — supplied by the Tech Hub owner. Original source is preserved in `services/ultrix/`, with managed ports and disconnected startup until a router is configured. Blackmagic Videohub support implements Blackmagic Design's published Videohub Ethernet Protocol; no Blackmagic code is included. Facility configuration and exported router data are not distributed.

NETGEAR's runtime dependencies retain their own licenses in their package directories. Its dashboard is built with Next.js and React. Source distributions retain the dependency lockfiles needed to rebuild it.
# LAN hostname discovery

Tech Hub bundles [bonjour-service](https://github.com/onlxltd/bonjour-service) (MIT) and its dependencies for Bonjour/mDNS service advertisements. Dependency license files are included alongside the bundled modules.

## adm-zip

App archive creation and validation use adm-zip 0.6.1 (MIT). Its license is included with the bundled dependency. Source: https://github.com/cthackers/adm-zip

## R-Too

Adapted from [Devore’s D80-Panel](https://github.com/davidadevore/D80-Panel), commit `0c802d95a14b33f10d8bd7e2943de6ef29825dcf` (MIT; notice retained in `services/rtoo/LICENSE-UPSTREAM`). Uses AES70.js 2.0.20 (GPL-2.0-only) and bonjour-service 1.4.4 (MIT). The combined R-Too module is distributed under GPL-2.0-only, with the upstream MIT notice retained. Its package contains readable source and complete dependency source/license files; see `services/rtoo/README.md`. It runs in a separate module process. No d&b affiliation or endorsement is implied.
