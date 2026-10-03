# Changelog

## 0.1.0-alpha.2 — 2026-10-03

- Prepare public GitHub distribution with bilingual documentation, installation instructions and a reproducible demo.
- Add Windows/Linux CI and packaged installation, unload/reinstall and data-preservation checks. CI also runs the real Web workflow on Linux.
- Add repository metadata, contribution and issue templates, a release guide, and portable desktop test configuration.
- Keep the runtime API, schemaVersion 1 and DSH 0.2.0-rc.2 peer requirements unchanged. The plugin remains alpha; detailed verified scope is recorded in docs/13-public-release-validation.md.

## 0.1.0-alpha.1 — 2026-10-03

- Implement the recheck tool and native right sidebar: create, list, get, edit, check, review, archive and export.
- Track full-file SHA-256 separately from review assessments; protect revisions, atomic storage, permissions and project boundaries.
- Verify 29 automated tests and Windows Web/Desktop flows. Preserve project data across uninstall/reinstall.
