# PDF blueprint import — Increment A

Status: release candidate, owner local functional acceptance recorded before final opacity/persistence changes. Final validation outstanding; do not deploy or merge until approved.

- Browser-only PDF.js worker, single-page bypass, 12-page thumbnail batches, 3400/5000/6000-pixel targets, 24-million-pixel cap, 80 MiB PDF cap, adaptive PNG/WebP/JPEG encoding and bounded downsampling.
- 850,000-character encoded image cap and 2,000,000-character serialized project cap. Browser quota probe is only a preflight. Actual imported resolution is displayed. New PDF and image imports default to 50% opacity; stored opacity remains unchanged.
- PDF filename, page and raster dimensions retained; canonical src avoids duplicate raster data for new PDFs. Manual two-point calibration, yellow calibration markers and amber wall/room previews. Existing underlay replaced only after successful import; cancellation preservation confirmed by owner.
- Explicit local save and autosave failure feedback, authenticated WP save acknowledgement, DB write failure HTTP response, guest/local persistence distinction. Local directory rollback is best effort; no database migration.
- No multi-level state, drawing library, external service or MTO formula changes. Title-block detection deferred. Independent floor workspaces are Increment B; level-aware consolidated MTO is Increment C.

## Validation before integration
Owner previously confirmed PDF import, optimization, calibration, drafting, local save/reload and cancellation; earlier npm audit reported zero findings. Re-run npm ci, npm run lint, npm run build, npm audit and php -l planar-mto.php for the final candidate. Verify ordinary image imports and PDF default opacity, previously saved opacity, local save/reload, guest saves, quota failure and unchanged MTO. Test authenticated WP save/reload and simulated DB failure in a nonproduction WP environment. Verify generated worker .mjs loads from the plugin dist/assets directory with JavaScript MIME type in production-style hosting, not a login page or HTML response. Test rotated, corrupt/password-protected and large scanned PDFs and cancellation during processing as applicable. No deployment without owner approval.
