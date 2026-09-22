# Netgear Discovery agent instructions

Read `AI-HANDOFF.md` completely before changing this project. It is the canonical description of the product, architecture, runtime, security model, verification steps, and installer workflow.

Important rules:

- Preserve the local Windows architecture. The collector must reach NETGEAR switches directly over SNMPv3/UDP 161; this is not a normal cloud-hosted dashboard.
- Never add fake switches or fake port data when discovery fails. Show the existing empty/offline states.
- Do not expose SNMP keys or switch web credentials through dashboard APIs.
- Keep VLAN/profile assignment read-only until it can be implemented through NETGEAR AV network profiles. Do not add an SNMP PVID-only write path.
- Preserve existing user data in `%ProgramData%\Netgear Discovery` during installer upgrades.
- Use `apply_patch` for source edits, preserve unrelated work, run `node --check collector/server.mjs` and `npm run build`, and verify the relevant local HTTP endpoints.
- When making a distributable build, bump the patch version consistently in `package.json`, `package-lock.json`, and `installer/Netgear Discovery.iss`, then run `npm run package:windows`.
