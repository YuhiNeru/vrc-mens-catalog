# Dependency update 2026-11-06

Updated Wrangler to4.158.0 within major4. Its bundled Miniflare now resolves undici7.30.1 instead of7.29.1, including upstream TLS and cache security fixes.

Validation: existing42 Node tests passed on the current working tree. Mens typecheck and Ranking check also passed where applicable. npm audit and lifecycle scripts were disabled during install. Production deployment and repository visibility unchanged. Existing user changes were excluded from this commit.

Official evidence: https://github.com/nodejs/undici/security/advisories/GHSA-qrxm-fqhp-jwvm and https://github.com/nodejs/undici/security/advisories/GHSA-4w7w-5xrc-9h26.
