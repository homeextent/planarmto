# PDF blueprint import — Increment A

Status: implementation candidate; dependency lockfile and validation outstanding. Do not merge or deploy.

- Browser-only PDF.js worker, selected-page rasterization, 12-page thumbnail batches, single-page bypass, 3400/5000/6000-pixel targets, 24-million-pixel cap and adaptive PNG/WebP/JPEG encoding.
- Conservative 700,000-character image cap and 2,000,000-character serialized project cap; localStorage probe is only a preflight, not a guarantee of persistence.
- Source filename, page and raster dimensions saved with the existing singular underlay. Imported sheets require manual two-point calibration. Existing underlay replaced only after successful rasterization and preflight.
- No multi-level state, drawing library, external service or MTO formula changes. Title-block detection deferred.
- Existing persistence fallback can swallow quota errors; explicit save failure handling and realistic WordPress payload tests remain acceptance requirements.

## Validation before integration
Run npm install --package-lock-only, npm ci, npm run lint, npm run build using the supported Node version. Commit the generated lockfile. Verify actual worker asset loading in WordPress production-style hosting. Review dependency security audit. Test existing image formats, single/multi-page PDFs, rotated sheets, large/scanned sheets, corrupt/password-protected files, cancel/failure, project switching, memory limits, calibration, project save/reload and unchanged MTO. Verify thumbnail rendering concurrency and cancellation. Test storage limits including duplicate autosave and directory payloads. Confirm no production deployment before approval.
