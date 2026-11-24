# PDF blueprint import — Increment A

Status: v2.15.0 merged to production; live PDF acceptance failed. v2.15.1 hotfix candidate pending staging and production validation.

- Browser-only PDF.js worker, single-page bypass, 12-page thumbnail batches, 3400/5000/6000-pixel targets, 24-million-pixel cap, 80 MiB PDF cap, adaptive PNG/WebP/JPEG encoding and bounded downsampling.
- 850,000-character encoded image cap and 2,000,000-character serialized project cap. Browser quota probe is only a preflight. Actual imported resolution is displayed. New PDF and image imports default to 50% opacity; stored opacity remains unchanged.
- PDF filename, page and raster dimensions retained; canonical src avoids duplicate raster data for new PDFs. Manual two-point calibration, yellow calibration markers and amber wall/room previews. Existing underlay replaced only after successful import; cancellation preservation confirmed by owner.
- Explicit local save and autosave failure feedback, authenticated WP save acknowledgement, DB write failure HTTP response, guest/local persistence distinction. Local directory rollback is best effort; no database migration.
- No multi-level state, drawing library, external service or MTO formula changes. Title-block detection deferred. Independent floor workspaces are Increment B; level-aware consolidated MTO is Increment C.

## Acceptance evidence — 2026-11-24

- Owner confirmed PDF import, optimization, calibration, drafting, cancellation, local save/reload, 50% default opacity for new PDF/image imports, preserved saved opacity and unchanged geometry/MTO.
- GitHub Actions run 45398914590 at ce1025645d06538d208bb07fe5c7abfd01edc5a0 passed TypeScript, build, dependency audit, PHP syntax, eight persistence regressions and disposable WordPress/MariaDB integration (authenticated REST round trip, guest isolation, forced database write failure, worker JavaScript MIME and byte equality).
- The isolated runtime uses PHP 8.3/Apache and MariaDB 11.4 with synthetic project data. Non-blocking startup retry and uploads-directory warning were observed. The integration fixture tests encoded bytes, not actual browser image decode or PDF worker execution.
- Rotated, corrupt and password-protected PDF coverage is not independently recorded as exhaustive. SiteGround browser import, authenticated save/reload and worker delivery require smoke testing after separately authorized production release.
- PR #1 merged to staging at 7ab225a5131ba93b46a9a77e61cdbb19e7db97b3; post-merge CI run 45400095850 passed all checks. Production promotion authorized by owner; release PR CI must pass before merge.

## Production compatibility incident — 2026-11-24

- Production PR #2 passed CI run 45400883528 and merged at 6aa3734. Live single- and multi-page PDF imports failed to load the PDF.js worker. PNG imported successfully, but the previous PDF error persisted.
- Owner HTTP HEAD diagnostic for the emitted .mjs worker returned HTTP 200, 1,375,838 bytes, nginx/SiteGround CDN, with no Content-Type header. Missing JavaScript MIME is the leading diagnosis; live browser retest is required.
- v2.15.1 uses Vite asset naming to emit the unchanged module worker bytes with a hashed .js filename. CI requires the new filename, absence of the old .mjs worker, importer URL reference, source byte equality, and real WordPress HTTP JavaScript MIME and byte equality.
- New PDF/image requests clear previous errors/notices and invalidate stale asynchronous image callbacks. No MTO, database schema, or project model changes.
- Validate locally with npm ci, npm run lint, npm run build and npm run preview (also test dev mode); try a malformed PDF then a valid PNG and verify the old error clears. Confirm both single/multi-page PDF import and saved-state recovery. Stage before production promotion. On SiteGround verify GET response MIME, browser worker execution and full acceptance checklist using non-sensitive fixtures.
