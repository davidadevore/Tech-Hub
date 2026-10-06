# Tech Hub App SDK

Tech Hub 1.0 separates the desktop host from installable applications. The host owns processes, web gateways, ports, shared navigation, access control, the App Library, and persistent data directories. Apps provide a loopback HTTP server and device-specific functionality.

## Start an app

1. Copy `sdk/template` into your own repository. Use a stable, lowercase app ID such as `example-meter`.
2. Edit `techhub-app.json`: set the ID, display name, description, version, accent color, entry point, and required host version. IDs must not change after publication.
3. Run `TECH_HUB_BACKEND_PORT=18900 TECH_HUB_DATA_DIR=/tmp/example-meter node server.cjs` (PowerShell: set the corresponding `$env:` values first). Open `http://127.0.0.1:18900`.
4. Build your UI from the template's shared styles. The host injects its app switcher and supplies access control when your app is installed. Do not create a second login screen or app switcher.
5. Run `node sdk/validate.cjs /path/to/your/app`, then `node sdk/package.cjs /path/to/your/app /path/to/output.zip` from the Tech Hub repository.
6. To test host navigation and access control, clone the Tech Hub repository, install its root dependencies, and run `node sdk/run.cjs /path/to/your/app`. This starts a loopback-only development host with temporary settings and no other apps. Restart the runner after changing source. The standalone SDK ZIP supports validation/packaging; the development host runner requires the full repository.
7. Submit the source, package, test results, permissions, license, and screenshots for catalog review. For private testing, use **App Library → Testing & evaluation → Review app package** to upload your ZIP, review its details, and confirm installation. Unofficial apps are labeled, support manual package updates/rollback/uninstall, and require a unique ID (they cannot replace official apps). Reopen the host once after the first installation. No catalog publication is required. Tech Hub does not run npm install scripts.

See [the app contract](APP-CONTRACT.md), [design guide](DESIGN.md), and [AI-assisted development guide](AI-DEVELOPMENT.md).

## Distribution and compatibility

Use semantic versions for your app independently of the Tech Hub version. Build separate `darwin-arm64` and `win32-x64` packages for native programs; a pure Node application can use the same source in both packages. Bundle all dependencies and runtime assets. The host supplies Node 24; it does not supply Python or run package-manager installation scripts. Native apps must bundle their runtime.

Published packages are checksum-verified against the official catalog and staged before activation. Updates retain one previous version for rollback. Persistent settings live outside the app package and survive updates and uninstallation. An app must remain usable without an internet connection after installation.

A separate process is a reliability boundary, not a security sandbox. Installed applications run as the desktop user. Permissions are declarations for review, not OS-enforced restrictions. Never claim an app is sandboxed. The official catalog is a trust boundary: third-party contributions require review before distribution.
