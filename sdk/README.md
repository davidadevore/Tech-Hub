# Tech Hub Module SDK

Tech Hub 1.0.1 separates the desktop host from installable applications. The host owns processes, web gateways, ports, shared navigation, access control, the Module Library, and persistent data directories. Modules provide a loopback HTTP server and device-specific functionality.

## Start a module

1. Copy `sdk/template` into your own repository. Use a stable, lowercase module ID such as `example-meter`.
2. Edit `techhub-app.json`: set the ID, display name, description, version, accent color, entry point, and required host version. IDs must not change after publication.
3. New modules use the shared Node runtime and `platforms: ["universal"]`. Test with the repository development runner in step 6; it supplies runtime paths, ports, and isolated settings.
4. Build your UI from the template's shared styles. The host injects its module switcher and supplies access control when your module is installed. Do not create a second login screen or module switcher.
5. Run `node sdk/validate.cjs /path/to/your/app`, then `node sdk/package.cjs /path/to/your/app /path/to/output.zip` from the Tech Hub repository.
6. To test host navigation and access control, clone the Tech Hub repository, install its root dependencies, and run `node sdk/run.cjs /path/to/your/app`. This starts a loopback-only development host with temporary settings and no other modules. Restart the runner after changing source. The standalone SDK ZIP supports validation/packaging; the development host runner requires the full repository.
7. Submit the source, package, test results, permissions, license, and screenshots for catalog review. For private testing, use **Module Library → Testing & evaluation → Review module package** to upload your ZIP, review its details, and confirm installation. Unofficial modules are labeled, support manual package updates/rollback/uninstall, and require a unique ID (they cannot replace official modules). Reopen the host once after the first installation. No catalog publication is required. Tech Hub does not run npm install scripts.

See [the module contract](APP-CONTRACT.md), [shared runtime](SHARED-RUNTIME.md), [design guide](DESIGN.md), and [AI-assisted development guide](AI-DEVELOPMENT.md).

## Distribution and compatibility

Use semantic versions for your module independently of the Tech Hub version. Build **one universal ZIP** for Mac and Windows. The host supplies Node 24 and a versioned helper API for settings, HTTP responses, administrative checks, and startup. Bundle only application code, assets, and pure-JavaScript dependencies. Do not include runtime executables or native add-ons. See [shared runtime](SHARED-RUNTIME.md) for requirements and examples.

D’san and Power Monitor use reserved host-managed compatibility engines; their native protocol implementations are installed once with Tech Hub, outside module packages. Engine updates require a host update. Legacy platform-specific v1.0.0 packages remain supported. Lux Link is paused and is not included in the v1.0.1 catalog or installers.

Published packages are checksum-verified against the official catalog and staged before activation. Updates retain one previous version for rollback. Persistent settings live outside the module package and survive updates and uninstallation. A module must remain usable without an internet connection after installation.

A separate process is a reliability boundary, not a security sandbox. Installed applications run as the desktop user. Permissions are declarations for review, not OS-enforced restrictions. Never claim a module is sandboxed. The official catalog is a trust boundary: third-party contributions require review before distribution.

## Independent module versions

Every module carries its own semantic `version`, independent of Tech Hub. Increment it when that module’s code or assets change; use `minHostVersion` for new host/runtime requirements. The official build reads each module’s version and minimum host version from root `modules.json` rather than copying the desktop version. The SDK starter’s version belongs to the starter module, not the SDK. Never publish different package contents under an already published module version.

Tech Hub compares installed and catalog versions. Checking is read-only; administrators choose updates. A module requiring a newer host is shown but excluded from Update all. Unofficial modules require a developer-provided ZIP and are never automatically replaced from the official catalog.

The on-disk filename `techhub-app.json`, `/api/apps` endpoints, archive filenames and existing data directories retain their original names for compatibility. “Module” is the product and SDK terminology.

## Submit for catalog inclusion

Use the [module submission form](https://github.com/horner516/Tech-Hub/issues/new?template=module-submission.yml) and follow the [submission and review process](SUBMITTING.md). Include the exact source commit, universal package, checksum, license, support link and test evidence. Inclusion requires maintainer review. Catalog-only releases let approved new modules appear without a host installer update.
