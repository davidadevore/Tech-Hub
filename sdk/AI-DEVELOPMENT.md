# Developing Tech Hub apps with AI tools

This guide applies to Codex, Claude Code, Cursor, Copilot, and other coding assistants. Give your assistant the app contract and design guide before asking it to change code. AI-generated code has the same review and testing requirements as handwritten code.

## 1. Give the assistant a precise task

Start with a small vertical slice: connect to one simulated device, display one real measurement, and show disconnected/stale/error states. Provide the device model, protocol documentation, supported firmware, permitted commands, app ID, supported operating systems, and a sample sanitized response. State which operations are read-only and which change device state.

Do not let the assistant guess undocumented registers, ports, packet layouts, units, byte order, or device commands. Ask it to identify the official source and test against recorded fixtures. Unknown values must stay unknown; never synthesize healthy values when communication fails.

## 2. Suggested initial prompt

> Build a Tech Hub app with ID `example-meter` using `sdk/template`. First read `sdk/APP-CONTRACT.md`, `sdk/DESIGN.md`, and `sdk/AI-DEVELOPMENT.md`. Implement [specific behavior] using [protocol documentation]. Bind the web interface only to TECH_HUB_BACKEND_HOST and TECH_HUB_BACKEND_PORT. Store settings only in TECH_HUB_DATA_DIR. Preserve shared navigation, authentication and the design system. Use simulated devices for development. Do not scan networks, connect to production devices, send control commands, publish packages, or create installers unless I explicitly authorize it. Explain assumptions, implement the smallest complete change, and run the validator plus meaningful tests.

Replace the placeholders with actual requirements. Do not copy example addresses into production configuration.

## 3. Repository instructions for your assistant

Create an `AGENTS.md` or the equivalent instruction file used by your tool. Include:

- Stable app identity and supported Tech Hub/Node versions.
- Commands for setup, development, validation, tests and packaging.
- The SDK contract and design-guide paths.
- Protocol references and fixture locations.
- Explicit hardware boundaries: offline tests by default; no scanning or destructive commands without authorization.
- Secret handling: no real passwords, tokens, serial numbers, facility addresses or private configuration in source, fixtures, screenshots, logs or packages.
- Paths that contain user settings and must never be overwritten or deleted by build scripts.
- A requirement to document observable behavior, limitations and validation evidence.

## 4. Keep changes reviewable

Ask the assistant to inspect existing code before replacing it. Work on one behavior at a time. Preserve configuration compatibility and add migrations explicitly. Avoid unrelated formatting changes, dependency churn, custom authentication, duplicate app navigation, or a different visual framework for every app.

Have the assistant list the files it changed and explain why. Review the diff yourself, particularly code that handles credentials, command execution, network destinations, firmware updates, formatting media, routing, power switching or recording controls.

## 5. Require meaningful tests

Ask for fixtures covering connected, disconnected, timeout, malformed response, stale data, reconnect, and clean shutdown. For control actions, verify the exact command and require deliberate user action. Ensure repeated polling never overlaps uncontrollably and that retries have bounded timeouts and backoff.

Validate app manifests, package paths, assets, entry points and version compatibility. Test from an unpacked package rather than only the development checkout. Test both target platforms before claiming support. Check the UI at desktop and phone widths and use keyboard navigation.

## 6. Review design consistency

Use shared surface, text, accent, spacing and status tokens. Keep settings inside the application and navigation in Tech Hub's shared header. Pair status colors with text. Show timestamps and units for measurements. Use ordinary language for errors and never display raw stack traces or credentials to viewers.

Give the assistant screenshots of the template and your changes; ask it to identify inconsistencies. A screenshot alone does not prove that the implementation works—test the real interactions too.

## 7. Before publishing

Run the validator, automated tests and package checks. Inspect package contents for secrets and unnecessary files. Include license notices for bundled dependencies. Confirm that the version changed, the minimum host version is accurate, settings survive upgrading, and rollback behavior is understood. Submit packages for catalog review; do not ask an assistant to bypass checksum, source, compatibility or access checks.

## 8. Useful review prompt

> Review this app against the Tech Hub SDK contract. Focus on unsafe device commands, credential exposure, unbounded retries, overlapping polls, incorrect stale-data handling, configuration loss, path traversal, shell injection, and UI/access-control inconsistencies. Cite the affected file and behavior. Distinguish verified defects from assumptions. Do not contact real devices or modify production settings.

## Testing outside the catalog

Package the app with `sdk/package.cjs`, then import the ZIP from App Library → Testing & evaluation. Review the app name, ID, version, declared access, and checksum before confirming. Use a distinct test ID instead of an official app ID. New apps require reopening the host once. Subsequent local package installs support the same version number for iterative development and retain a previous package for rollback. This is trusted-code execution under your account, not a sandbox; test unfamiliar apps on an isolated computer or VM. Catalog publication remains a separate reviewed step.
