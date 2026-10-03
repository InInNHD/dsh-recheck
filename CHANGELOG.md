# Changelog

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
