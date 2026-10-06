# Tech Hub 1.0.0

- Modular host with an in-app App Library: install one app, selected apps, or all six official apps.
- Separate Host and Full installers for macOS Apple silicon and Windows x64. Full includes every app for offline setup.
- Platform-specific all-apps ZIP downloads, individual app packages, an official catalog, and SDK download linked in the README.
- App updates, rollback, and uninstall retain settings. Downloads are checksum-verified and validated before activation; failed starts restore the previous package.
- Existing service configuration, passwords, port assignments, and enabled states survive migration. Previously enabled apps can be reinstalled together.
- Shared navigation lists installed, enabled apps. Host updates remain separate from app updates.
- Install local app ZIPs for testing outside the catalog, with a review/confirmation step, unofficial labels, manual updates, rollback, and settings retention.
- Developer SDK with a working Node starter, packaging/validation tools, app contract, design guide, and detailed AI development instructions.

Full installers require no internet to install the included apps. Offline ZIP imports must match a trusted catalog. New third-party catalog apps require reopening the host once after first installation. Installed apps run with the desktop user's permissions; catalog submissions require review.

Mac: macOS 13+, Apple silicon, ad-hoc signed. Windows: Windows 10 1809+/11 x64, unsigned per-user installer. Existing Companion 1.0.3 remains compatible.
