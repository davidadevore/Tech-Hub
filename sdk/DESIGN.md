# Shared design

Use the supplied `public/tech-hub.css` in your app. Keep the main dashboard compact and responsive. The host provides the app switcher, service access gate, and connection recovery UI.

- Use `--th-background`, `--th-surface`, `--th-text`, `--th-muted`, `--th-border`, and `--th-accent`. An app may choose its accent, not a completely separate design system.
- Use one page heading, labeled controls, clear sections, and readable units. Layouts must work at 320px and desktop widths without horizontal clipping.
- Use native buttons, inputs, dialogs and labels. Preserve keyboard focus. Pair colors with text and never rely on red/green alone.
- Place app-specific settings behind a Settings button. Require administrator access for credentials and device configuration. Keep service installation and update controls in Tech Hub.
- Show loading, empty, offline, stale and error states. Do not replace unavailable data with zeros or invented measurements.
- Avoid opening another browser window automatically, adding a tray icon, running another updater, or spawning an independent app shell.

The template uses orange by default; Router Panel uses blue and Record Monitor red. Shared components and tokens are versioned with the SDK so developers can adopt improvements without an unrelated app redesign.
