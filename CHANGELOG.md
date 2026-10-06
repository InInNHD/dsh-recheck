# Changelog

## Unreleased — 0.1.0 preparation

- Keep beta.1 as the installable version while the planned three-user, one-week real-project trial remains pending; do not create a stable tag or move npm latest.
- Add a real packaged recovery drill: stopped-Host byte-verified backup, archive/restore, Markdown export, corrupt-store preservation, full history restore, stale-review rejection and fresh post-recovery checks/reviews.
- Wait for React-rendered filter, sort and selection results in shared Web/Desktop acceptance instead of instantaneous UI assertions. Add voluntary trial records and explicit manual backup/recovery instructions.

## 0.1.0-beta.1 — 2026-10-06

- Add combined assessment/freshness filters, stable attention/check/update sorting, explicit selections, separate project/display/selection counts and filter-change selection reset.
- Add bounded Host-side `check scope:selected` with 1–100 explicit ID/revision targets, shared reads, per-card validation, conflicts, cancellation observations and actual saved counts. Keep card/all requests and schema 1 compatible; do not automatically review cards.
- Show check/read/choose/save steps and explicit local reading confirmation. Temporary/incomplete checks cannot be used for a persisted review. Explain time/byte/target budget failures and preserve cancellation without claiming unsaved results were committed.
- Disable selected checking when Host list capabilities are absent. Reuse native controls and Harness theme tokens with no new runtime dependency.
- Extend real FS/ToolRuntime tests and shared Web/Desktop queue acceptance; keep 20-cycle lifecycle, actual tgz installation, data preservation, alpha.6 rollback and exact Host SDK checks. Validation procedure and boundaries: docs/19-beta1-acceptance.md. Distribute the same built tgz through npm beta and GitHub prereleases, gated by matching-commit CI. Refresh the bilingual install instructions and real beta.1 screenshots; add a four-state file-change/check/read/review demo.

## 0.1.0-alpha.6 — 2026-10-05

- Handle reproduced Windows ReplaceFileW error 1175 with two bounded retries through the same Host FS and original CAS guard; return a controlled WRITE_BUSY response if it persists. Preserve cancellation, concurrent updates, and failures for other error codes.

- Show per-line evidence format errors and actionable Host read failures; preserve inputs and focus the failing field or line. Re-read evidence on save through the existing FS/sandbox boundary and never save partial baselines.
- Add optional `reason.evidenceIssues` to rejected responses, verified through the real tool output schema; retain the eight actions and storage schema 1.
- Open current and historical version source sessions through the public workspace navigation service, with visible-catalog checks and cancellation. This opens the recording session, not a particular evidence message.
- Keep multiline path entry. The available composer file picker uploads attachments and does not provide a suitable project-relative evidence selection API, so no file-picker UI is added.
- Lock form inputs during submission and guard composition input from accidental saves. Add shared Web/Desktop entry checks, native navigation tests and alpha.5 rollback coverage. See docs/18-alpha6-acceptance.md for exact validation limits.

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
