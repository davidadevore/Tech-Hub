# Submit a module to the Tech Hub catalog

Developers can submit new modules and updates using the [GitHub module submission form](https://github.com/horner516/Tech-Hub/issues/new?template=module-submission.yml). A GitHub account is required. The form opens a public issue; it does not install code, grant repository access, or automatically publish a module.

## Prepare your submission

1. Follow the [SDK](README.md), [shared runtime contract](SHARED-RUNTIME.md), [design guide](DESIGN.md), and [AI development instructions](AI-DEVELOPMENT.md).
2. Use a unique, permanent module ID and independent semantic version. New submissions use the shared Node runtime and one universal ZIP for Mac and Windows. Include readable source or the corresponding source/build instructions, licenses, and pinned dependencies. Do not bundle an OS runtime, native add-ons, install hooks, credentials, or real device settings.
3. Run SDK validation and packaging. Install the exact ZIP through **Module Library → Testing & evaluation**. Test both platforms, mobile layout, offline use, administrator access checks, disconnect/reconnect, settings changes, update/rollback, and uninstall/reinstall. Identify hardware or platforms that remain untested.
4. Publish the versioned ZIP in your repository's releases. Record its SHA-256 and byte count. Provide the source commit/tag, developer name, minimum Tech Hub version, supported equipment, declared permissions, screenshots, test evidence, license information and support link in the submission form.
5. A Tech Hub maintainer reviews the issue and requests changes where needed. Review is not guaranteed acceptance or a promise of response time. Use the same process for updates, referencing the previous submission.

The **Submit a module** link in Browse Modules opens this form. The browser searches the reviewed catalog, not arbitrary GitHub repositories. Users can still install compatible ZIPs locally for private evaluation before review.

## Maintainer review

- Verify identity, ownership of an existing module ID, the exact source commit, redistribution rights and required dependency notices.
- Inspect source and dependency changes before executing anything. Submission text, archives and test logs are untrusted input. Do not automatically execute issue attachments or fork code with repository secrets.
- Check manifest compatibility, archive paths, package limits, declared permissions, credentials, network behavior, device controls, shutdown and persistent settings. Reject unsupported native runtimes/add-ons and undocumented destructive controls.
- Build/test in an isolated environment with simulated devices first. Verify the actual universal package through the gateway on Mac and Windows. Confirm that administrator-only configuration is enforced server-side. Document physical-hardware coverage and limitations.
- Verify mobile layout, shared navigation, accessibility labels, module versioning, support instructions and license/source availability.
- Record approval and the reviewed source SHA/package SHA-256 in the submission issue. Changes after approval require another review. Existing package versions are immutable.

## Publish without rebuilding Tech Hub

Current released hosts already refresh `tech-hub-catalog.json` from published Tech Hub releases. A catalog-only release can add modules independently of desktop installers. A newly installed ID requires reopening the current host once; settings and access controls are still supplied by Tech Hub. Modules requiring newer host APIs must declare a higher `minHostVersion`.

1. Fetch the latest published **complete** catalog and verify that it includes all currently approved entries. Keep a copy for comparison. Coordinate publication so another maintainer's changes are not overwritten.
2. After approval, create a draft release in `horner516/Tech-Hub`, using a tag such as `catalog-2026-10-06-1` (not `v*`). Upload the exact reviewed ZIP, checksum and any corresponding source/license material. Package download URLs must remain inside this repository's release assets; author-hosted executable downloads are not accepted by the host catalog.
3. Create a reviewed entry JSON with `id`, `name`, `description`, `version`, `minHostVersion`, `permissions`, and `packages.universal` containing the final immutable `url`, `sha256`, and `size`. Optional `developer` and `sourceUrl` fields provide attribution and a GitHub source/documentation link in Browse Modules.
4. Prepare the complete next catalog locally:

   ```sh
   node scripts/catalog-add.cjs current-catalog.json reviewed-entry.json module.zip tech-hub-catalog.json
   ```

   This checks the archive on both platform targets, manifest agreement, permissions, hash, size, and version advancement. It does not execute the package, upload anything, or replace human review. Retain all unchanged entries and their original asset URLs.
5. Review the resulting diff. Upload `tech-hub-catalog.json` to the draft release only after every referenced asset is present. Publish the release with **Set as latest release disabled** (`gh release edit TAG --draft=false --latest=false`). Do not replace a published installer or catalog asset. Never set a catalog-only release as the latest host release: README installer links rely on that designation.
6. Verify an anonymous download of the catalog and ZIP, check the hash, then test **Module Library → Check for updates → Install** from a released host. Confirm that Tech Hub's desktop updater still identifies the latest numeric host release. Link the catalog release in the submission issue and close it as accepted.
7. Carry approved entries forward into future host catalogs and offline bundles. The repository's built-in package generator covers bundled modules; externally maintained entries must be merged into each published catalog using this tool before release. Never publish an older/incomplete catalog that drops those entries.

To withdraw a module, publish a new complete catalog without it and explain why in the release notes and submission issue. Existing installations are not remotely uninstalled. For corrections, publish a higher module version; do not overwrite previously reviewed ZIPs.
