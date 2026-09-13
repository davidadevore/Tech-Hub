# Tech Hub

One desktop application for **D’san Ready**, **Lux Link**, and **Power Monitor**. Tech Hub runs all three services and provides a local master page with their status, ports, and shareable network URLs.

## Downloads

**[Download Tech Hub for Windows — x64](https://github.com/horner516/Tech-Hub/releases/latest/download/Tech-Hub-Windows-x64-Setup.exe)**

Windows 10 (1809+) or Windows 11, x64. Run the installer, then open Tech Hub from Start. The **TH** system-tray menu provides **Open Control Page**, **Check for Updates**, **Open Logs**, and **Quit Tech Hub**. Double-click TH to open the control page. There is no floating widget or Windows Widgets-board integration. The app includes its runtimes and does not require a separate .NET installation.

The Windows installer installs for the current user and preserves settings during upgrades/uninstall. It is unsigned. On trusted show networks, allow the bundled Node runtime through Windows Firewall when sharing dashboards; the installer does not change firewall settings.

### Mac

**[Download Tech Hub for macOS — Apple silicon](https://github.com/horner516/Tech-Hub/releases/latest/download/Tech-Hub-macOS-arm64.dmg)**

[Release notes and all downloads](https://github.com/horner516/Tech-Hub/releases/latest) · [SHA-256 checksum](https://github.com/horner516/Tech-Hub/releases/latest/download/Tech-Hub-macOS-arm64.dmg.sha256)

Requires **macOS 13 or later on an Apple silicon Mac (M1 or later)**. Intel Macs are not supported by this installer. Python, Node.js, and the Power Monitor binary are bundled; no development tools are needed to run it.

1. Open the DMG and drag **Tech Hub** into **Applications**.
2. Open Tech Hub. Click **TH** in the menu bar, then **Open Master Page**.
3. Add your devices in each service. New installations start with empty device lists.
4. Copy the service’s network URL from the master page to share with your crew.

This initial build is **ad-hoc signed, not Apple Developer ID signed or notarized**. macOS may require **System Settings → Privacy & Security → Open Anyway** on first launch. See [installation details](INSTALL.md).

## Dashboard ports

| Application | Default URL on the host computer | Availability |
| --- | --- | --- |
| Master page | `http://127.0.0.1:8700` | Admin, this computer only |
| D’san Ready | `http://127.0.0.1:8701` | Limitimer, PerfectCue, full-screen view at `/full` |
| Lux Link | `http://127.0.0.1:8702` | Lighting devices, sACN and Art-Net monitoring |
| Power Monitor | `http://127.0.0.1:8703` | Power devices, phases, services, and alerts |

For another computer, replace `127.0.0.1` with the Tech Hub computer’s LAN IP. The master page lists each available IPv4 network address and offers a Copy button. The service pages do not include navigation to the other services or master page.

At startup, Tech Hub tries each saved TCP port. If another application occupies it, Tech Hub binds an available replacement and saves it for future launches. This applies to the master page, service URLs, and internal web servers. The master page and desktop menus follow the actual assignments. Check the master page for updated URLs after a conflict; previously shared URLs may change. Lighting protocol UDP ports remain fixed.

## Access control

The master page listens only on loopback and validates the request host. It cannot be opened by other computers on the LAN.

Each service has an optional, independent password, configured using **Set password** on its master-page card. Use different passwords for different crews. Password changes sign out existing viewers of that service. Passwords are stored as salted scrypt hashes, and sessions expire after 12 hours or when Tech Hub exits. All service pages and APIs pass through that service’s access gate.

New installs allow access without a password until configured. **Separate URLs and ports are not authorization by themselves.** Anyone on the same network can try another port. Set service passwords when visibility must be restricted. These are HTTP interfaces: traffic and passwords are not encrypted in transit. Use a trusted show LAN; use an HTTPS gateway or VPN for untrusted networks.

The underlying servers listen only on `127.0.0.1` (default ports `18701–18703`); remote clients cannot bypass the service gateways. Local users of the host computer can reach those internal servers and are trusted administrators. A service password grants access to that service’s existing controls, not a new read-only role. Set passwords in Tech Hub; D’san’s inherited standalone network-auth setting is not used behind Tech Hub’s loopback gateway.

## Data, updates, and troubleshooting

Settings live in `~/Library/Application Support/Tech Hub/` on Mac and `%LOCALAPPDATA%\Streamline\Tech Hub\` on Windows:

- `config.json`: public ports, internal ports, bind host, and service password hashes.
- `dsan/`, `lux/`, `power/`: each service’s own saved configuration.
- `logs/`: the hub and service logs.

Use the TH menu to open configuration or logs. To change ports, quit Tech Hub, edit `config.json`, and reopen it. All seven ports must be unique integers between 1024 and 65535. Set `host` to `127.0.0.1` for local-only service access or `0.0.0.0` for LAN access.

Use **Downloads & Updates** in the TH menu to download a new complete Tech Hub app. Quit Tech Hub before replacing it. Saved configuration survives updates. The original standalone apps and their saved settings are left separate; Tech Hub does not automatically import them. Stop a standalone Lux Link instance when using Tech Hub to avoid competing for lighting protocol UDP ports (sACN 5568 and Art-Net 6454).

Tech Hub runs while its menu-bar or system-tray app is open. It does not install a system daemon or enable login startup. Quitting the app stops its child services. Startup failures appear in the master page and logs. Network status indicates that a web service is running, not that physical show devices have been validated.

## Build from source

On an Apple silicon Mac with Xcode Command Line Tools, Node.js 22 or later, Go 1.26, and Python 3.12:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-build.txt
cd services/lux
pnpm install --frozen-lockfile
cd ../..
PYTHON_BINARY="$PWD/.venv/bin/python" bash scripts/build-mac.sh
```

The build creates `dist/Tech Hub.app`, `dist/Tech-Hub-macOS-arm64.dmg`, and its checksum. Set `NODE_BINARY` or `GO_BINARY` to override compiler/runtime paths. The source includes the three applications and their regression tests; their individual documentation remains under `services/`.

```sh
node --test tests/*.test.cjs
go -C services/power test ./...
.venv/bin/python -m unittest discover -s services/dsan -p 'test_*.py'
cd services/lux && node --test tests/*.test.cjs tests/*.test.mjs
```

### Windows build

On Windows x64, install Node.js 24, Go 1.26, Python 3.12, .NET SDK 10, pnpm 11.19, and Inno Setup 6. Then run:

```powershell
python -m pip install -r requirements-build.txt
pnpm --dir services/lux install --frozen-lockfile
./scripts/build-windows.ps1
```

GitHub Actions builds and smoke-tests both platforms. A `v*` tag publishes both installers together after both builds pass. Windows host tests verify tray-only startup and process cleanup. The installer is `dist/Tech-Hub-Windows-x64-Setup.exe`.

## Source origins

Integrated from the user’s existing D’san Master View 0.3.3, Lux Link 0.4.0 workspace, and Power Monitor 2.10.0 sources. Tech Hub adds orchestration, per-service access gates, a native Mac menu-bar host, isolated storage, and combined packaging. Lux Link’s grandMA Web Remote screen reader uses macOS APIs and is Mac-only; Windows still reports console reachability and lighting-network traffic. The standalone D’san floating desktop widgets are not included; its browser dashboard and full-screen display are included. Device behavior still depends on the hardware, network interface, and permissions available on the host Mac.
