# Recheck

[![CI](https://github.com/InInNHD/dsh-recheck/actions/workflows/ci.yml/badge.svg)](https://github.com/InInNHD/dsh-recheck/actions/workflows/ci.yml)

[简体中文](README.md) · [Releases](https://github.com/InInNHD/dsh-recheck/releases) · [Installation](docs/12-installation.md) · [Issues](https://github.com/InInNHD/dsh-recheck/issues)

**Unofficial community project, independently developed and maintained.**

Bind project conclusions to evidence files and revisit them when those files change. Recheck contributes one `recheck` tool and a native DSH right sidebar. Card operations require no additional model calls.

Version: **0.1.0-alpha.6**, distributed through npm `alpha` and GitHub Releases. Adds per-line evidence feedback, failure focus and native source-session navigation. The eight business actions and schema 1 remain unchanged. See [alpha.6 scope and validation](docs/18-alpha6-acceptance.md) and the [compatibility manifest](compatibility.json). Verified on Windows with Harness 0.2.0-rc.2 Web/Desktop and 0.2.1-alpha.1 Web. Release CI covers Windows/Ubuntu and both exact hosts. Web validation does not imply other Desktop combinations are verified.

![Recheck alpha.4 sidebar](docs/assets/recheck-alpha4-main.png)

![Recheck alpha.4 create form](docs/assets/recheck-alpha4-create.png)

## Install

The commands below pin alpha.6 with the baseline Harness 0.2.0-rc.2. Consult the [acceptance notes](docs/18-alpha6-acceptance.md) for other verified combinations and rollback. The screenshots above are from alpha.4.

Install the pinned npm version with the matching Web host:

```sh
npx --yes --package=@deepseek-ai/dsh@0.2.0-rc.2 dsh plugin --profile web add dsh-recheck@0.1.0-alpha.6
npx --yes --package=@deepseek-ai/dsh@0.2.0-rc.2 dsh web
```

Download the tgz and SHA-256 checksum from Releases. For Web, run these commands from the download directory with the matching host:

```sh
npx --yes --package=@deepseek-ai/dsh@0.2.0-rc.2 dsh plugin --profile web add ./dsh-recheck-0.1.0-alpha.6.tgz
npx --yes --package=@deepseek-ai/dsh@0.2.0-rc.2 dsh web
```

Use `npx.cmd` in Windows PowerShell. Desktop users install into the `desktop` profile through the application's bundled CLI or plugin manager, then restart Desktop. Do not start the Electron desktop profile with a standalone Web CLI. [Full install, backup, removal and rollback instructions](docs/12-installation.md).

The release tgz includes built files. GitHub's automatically generated source ZIP requires a build. This version supports the npm `alpha` channel as well as GitHub Release distribution.

## Demo

Create a conclusion card with 1–8 relative evidence paths. Check the files, change a disposable evidence file and check again. Read the evidence before explicitly choosing supported, refuted or uncertain and entering a review note. Inspect history and export Markdown.

**Unchanged files do not prove a conclusion is true.** Freshness and review assessments are independent. Reviews re-read evidence and reject stale revisions or checks.

Actions: `create/list/get/edit/check/review/archive/export`. Edits, reviews, archive operations and single-card checks use the latest `expectedRevision`. Reviews also reference the latest persisted `checkId`. The host supplies workspace identity, actor, fingerprints and timestamps.

## Data and limits

Data lives in the project's `.dsh/recheck/cards.json`; evidence contents are not stored. Business I/O uses host file-system policies and the sandbox. No business network requests, automatic tests, watchers or semantic judgments. Atomic version-guarded writes preserve existing files on corruption, future schemas and capacity errors. Uninstall preserves project data.

Limits: 100 active / 200 total cards, 20 versions per card, 2 MiB per evidence file, 8 MiB storage. A batch has a 200 unique-file, 64 MiB and 10-second budget; uncovered evidence is unknown. Read-only checks must explicitly use `persist:false` and cannot authorize a persisted review. Files are observed separately, not as a simultaneous project snapshot. Drafts are memory-only. Multiple hosts writing one store, shared network disks and remote file systems are unverified.

## Develop

```sh
git clone https://github.com/InInNHD/dsh-recheck.git
cd dsh-recheck
npm ci
npm run check
npm run test:package
npm pack
```

`check` runs Host/Client type checks, build and 37 real FS/Native/Node PTC, diagnostics and evidence-feedback tests. `test:package` installs the actual tgz, runs tests against that host's SDK, toggles the live plugin 20 times, and verifies uninstall/reinstall, rollback to alpha.5, upgrade again and unchanged data/history. Use `npm run test:package -- --host 0.2.1-alpha.1 --web` for the second host. Test data stays in ignored `.integration`. Desktop tests require `--app` or `RECHECK_DESKTOP_APP`.

The collapsed diagnostics panel reads status on demand. Its copyable summary excludes workspace paths, session identifiers and business content. A permissive session policy does not override filesystem permissions. Host-version support is distinct from platform validation; consult the compatibility manifest.

[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Version management](docs/11-version-management.md) · [Historical acceptance](docs/09-implementation-and-acceptance.md)

MIT License. Learning documents are historical examples, not current project configuration.
