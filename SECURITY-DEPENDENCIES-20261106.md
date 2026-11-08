# Additional dependency fixes 2026-11-06

Updated Zod to 4.6.7 and Vitest to 4.1.12 where used, within their existing major versions. Addresses constrained-collection memory exhaustion and manual mock registration/traversal issues.

Validation on the working tree: Mens 42 tests and typecheck; Compass 50 tests and build; Report build and 19 browser tests all pass. Existing script edits, unreleased version changes and other work were excluded. No production deployment or visibility change.

Official advisories: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 and https://github.com/advisories/GHSA-qxg6-89mg-rqv8.

## Corrections (2026-11-08)

The text above is kept as the original record. Checked against the repository tree on 2026-11-08:

- Zod 4.6.7 is confirmed in `package.json` and `package-lock.json`. Vitest is not a dependency of this repository (it was fixed in other projects), so the Vitest 4.1.12 update does not apply here.
- The Compass, Report and Ranking validations in the paragraph above refer to other projects, not to this repository. This repository's tests are the Mens ones only.
- "Mens 42 tests" cannot be reproduced from this repository's tree. Current counts: `npm test` runs 30 tests (29 pass, 1 skipped because it needs `data/`), and the Python collector tests in `deploy/vps/test_worker.py` are 8 (all pass). `npm run typecheck` passes.
- Spacing typos in the original text ("to4.6.7", "Mens42", "and19") were fixed in place.
