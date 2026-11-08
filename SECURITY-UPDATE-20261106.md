# Dependency update 2026-11-06

Updated Wrangler to 4.158.0 within major 4. Its bundled Miniflare now resolves undici 7.30.1 instead of 7.29.1, including upstream TLS and cache security fixes.

Validation: existing 42 Node tests passed on the current working tree. Mens typecheck and Ranking check also passed where applicable. npm audit and lifecycle scripts were disabled during install. Production deployment and repository visibility unchanged. Existing user changes were excluded from this commit.

Official evidence: https://github.com/nodejs/undici/security/advisories/GHSA-qrxm-fqhp-jwvm and https://github.com/nodejs/undici/security/advisories/GHSA-4w7w-5xrc-9h26.

## Corrections (2026-11-08)

The text above is kept as the original record. Checked against the repository tree on 2026-11-08:

- Wrangler 4.158.0 and undici 7.30.1 are confirmed in `package.json` and `package-lock.json`.
- "42 Node tests" cannot be reproduced from this repository's tree. Current counts: `npm test` runs 30 tests (29 pass, 1 skipped because it needs `data/`); the Python collector tests in `deploy/vps/test_worker.py` are 8 (all pass).
- "Ranking check" refers to another project, not this repository.
- Spacing typos in the original text ("major4", "undici7.30.1", "existing42") were fixed in place.
