# scripts/ index

Run everything from the repository root (`npx tsx scripts/<name>.ts`, or `powershell -File scripts/<name>.ps1`). Files are documented in place and not moved: `.ps1` files reference each other and `scripts/collect-full-accessories.ts` by path, `tsconfig.full-accessories.json` names `scripts/collect-full-accessories.ts`, and `docs/*.md` and `.env.example` cite these paths. Most `.ts` scripts read `data/` (not in Git) and need a populated data directory. The one-off audit and publish scripts were written for the 2026-10 accessory work and are kept as a record of how those results were produced.

## Collection (Windows-side, long-running)

| Script | Purpose |
|---|---|
| `collect-full-accessories.ts` | Resumable full crawl of the BOOTH 3D accessory category (`--recycle-after=N` recycles the process). |
| `resume-full-accessories.ps1` | Loop wrapper that restarts `collect-full-accessories.ts`; refuses to run while `data/vps-migration-active.json` exists. Also launched by `rollback-vps.ps1`. |
| `collect-accessory-expansion.ts` | Bounded crawl that adds accessory candidates (state in `data/accessory-expansion-crawl.json`). |
| `probe-full-accessories.ts` | Small read-only probe of the accessory search pages (4 requests max); writes a probe file under `data/raw/`. |
| `run-crawler.ps1` | Runs `npm run cli -- <initial, daily, sync or retry>` with logging to `data/logs`, then `sync` unless `-NoSync`. Used by the scheduled task. |
| `register-task.ps1` | Registers or removes the Windows scheduled task `VRCMensCatalogDaily` (calls `run-crawler.ps1`). |
| `publish-local-progress.ps1` | Every N seconds, snapshots `data/catalog.json` into the local D1 while a plan crawl runs. |
| `finalize-local-crawl.ps1` | Waits for a plan crawl and its publisher to finish, then runs `coverage-report` and `tests/ui.mjs`. |

## VPS operations (need the `VPS_*` environment variables, see `.env.example` and `docs/vps-collector-operations.md`)

| Script | Purpose |
|---|---|
| `vps-common.ps1` | Shared config loader (dot-sourced by the three scripts below). Not run directly. |
| `vps-collector.ps1` | `status`, `stop`, `start`, `logs`, `backup` against `vrc-mens-collector.service` (the resident first-crawl service). |
| `sync-vps.ps1` | Manual pull of the VPS change export into local JSON and D1. |
| `rollback-vps.ps1` | Stops the VPS service, recovers its state, and restarts local collection. |

## Audit, inspection and review helpers (read `data/`, write a report or candidate file under `data/`)

| Script | Purpose |
|---|---|
| `audit-floor-counts.ts` | Per-floor and per-avatar count audit; writes `data/floor-count-audit.json` (see `docs/floor-count-audit-2026-10-08.md`). |
| `audit-other-accessories.ts` | Audits accessories classified as other; writes `data/other-accessory-audit.json`. |
| `audit-saved-piercings.ts` | Finds piercing candidates in saved HTML; writes `data/saved-piercing-audit.json`. |
| `check-accessory-classification.ts` | Prints accessories that have no entry in `config/accessory-classification.json`. |
| `inspect-accessory-gaps.ts` | Lists accessories not yet published with author descriptions; writes `data/accessory-manual-audit.json`. |
| `inspect-new-accessories.ts` | Prints descriptions of newly crawled expansion accessories. |
| `review-unisex-accessories.ts` | Extracts accessory-like items from the unisex clothing floor; writes `data/unisex-accessory-candidates.json`. |
| `report-accessory-expansion.ts` | Writes `docs/accessory-expansion-2026-10-08.md` and `data/accessory-expansion-additions.json`. |

## Publish helpers (modify catalog data or the local D1; run only deliberately)

| Script | Purpose |
|---|---|
| `publish-reviewed-other-accessories.ts` | Applies reviewed classification of "other" accessories (optional review-file argument). |
| `publish-reviewed-piercings.ts` | Publishes reviewed piercings; writes `data/piercing-additions.json` and `data/piercing-update.sql`. |

## Test data

| Script | Purpose |
|---|---|
| `make-fixtures.mjs` | Builds the short metadata fixtures in `tests/fixtures/` from saved real HTML in `data/raw/`. Tests themselves need no network. |
