# Changelog

## 0.1.0-alpha.5 — 2026-10-04

- Add an authenticated, read-only diagnostics panel with client/Host loaded versions, installed bundle version when available, runtime host package version, session write policy and schema validation status.
- Copy only allowlisted diagnostic fields; omit workspace paths, session identifiers, card content, evidence and raw exceptions. Explain common rejection codes and version mismatches.
- Discard aborted client responses even when transport finishes late; prevent simultaneous UI submissions and cancel diagnostics on plugin disposal.
- Add explicit compatibility metadata and a two-host candidate CI matrix; validate real SDKs inside each isolated installation, repeat live enable/disable cycles and check startup-animation coexistence. Exact completed validation and limitations are recorded in docs/17-alpha5-acceptance.md.
- Keep schemaVersion 1 and the eight business actions unchanged. Distribute the same built package through npm alpha and GitHub Releases.

- Retain the known intermittent Host save-error investigation: final packaged checks and 100 extra conflict-recovery cycles passed, but the earlier failure has no confirmed root cause.

## 0.1.0-alpha.4 — 2026-10-04

- Redesign the main sidebar with compact controls, project context, statistics, scope buttons, search, status badges and useful empty states.
- Group create/edit forms into clear sections with Unicode character counters and concise draft guidance.
- Reuse Harness theme tokens for light/dark colors, control radii and interaction states; retain keyboard navigation and narrow-pane layouts.
- Keep the Host API, schemaVersion 1 and DSH 0.2.0-rc.2 requirements unchanged. Distribute the same built package through npm alpha and GitHub Releases.

## 0.1.0-alpha.3 — 2026-10-03

- Enable public npm distribution with explicit registry and alpha dist-tag, and document pinned npm installation.
- Remove private package metadata and keep npm/GitHub release artifacts aligned.
- Runtime code, DSH 0.2.0-rc.2 requirements and schemaVersion 1 remain unchanged from alpha.2. Validation scope: docs/14-npm-release-validation.md.

## 0.1.0-alpha.2 — 2026-10-03

- Prepare public GitHub distribution with bilingual documentation, installation instructions and a reproducible demo.
- Add Windows/Linux CI and packaged installation, unload/reinstall and data-preservation checks. CI also runs the real Web workflow on Linux.
- Add repository metadata, contribution and issue templates, a release guide, and portable desktop test configuration.
- Keep the runtime API, schemaVersion 1 and DSH 0.2.0-rc.2 peer requirements unchanged. The plugin remains alpha; detailed verified scope is recorded in docs/13-public-release-validation.md.

## 0.1.0-alpha.1 — 2026-10-03

- Implement the recheck tool and native right sidebar: create, list, get, edit, check, review, archive and export.
- Track full-file SHA-256 separately from review assessments; protect revisions, atomic storage, permissions and project boundaries.
- Verify 29 automated tests and Windows Web/Desktop flows. Preserve project data across uninstall/reinstall.
