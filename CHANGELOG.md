# Changelog

All notable changes, architectural updates, and QA fixes for **PlanarMTO** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

---


## [Unreleased] — Increments B, C.1A and C.1B (staging release train)

### C.1C — Feature candidate and hybrid handoff (not staging integrated)
- R1–R4 foundation geometry, quantities, source-linked assemblies, scope/layers, precision, replacement, persistence and bounded angled runs implemented in draft PR #12. CI #186 at e5e9748, run 45670433567/job 139403930112, 288/288 independently verified.
- Owner calibration and basic rectangle/L walls and strip quantities passed; remaining functional and usability acceptance outstanding. Contractor-first R5 proposal and Codex transition recorded, no application changes in handoff. See docs/coding-agent-transition.md and docs/c1c-functional-findings.md. No merge/release authorization.
- R5.0A restores pointer access to roof polygon completion and canvas zoom, displays the foundation selection count and describes missing explicit scope decisions while preserving stored applicability. Independent source review and owner tests A–C passed at `cd782e7f1728d3e6377853677e29cc9611f08497`. Local regression 289/289, targeted Chromium 5/5, and CI #188 (run 45692683476, job 139481964301, including isolated WordPress) passed. [Acceptance and remaining R5 observations](docs/c1c-functional-findings.md#r50a-formal-acceptance).

- Registered the five [owner-approved R5 packages](docs/c1c-r5-coordinated-specification.md). R5.1–R5.2 are authorized, with a separate R5.3 persistence design review before implementation.

- R5.1 adds graphical foundation rectangles and explicit continuous perimeter tracing with endpoint/closure cues. R5.2 adds construction unit entry and context-sensitive materials inside the existing persisted contract. See [coverage and deferred requirements](docs/c1c-r5-1-r5-2-evidence.md).

- R5.3–R5.5 candidate adds optional v3 foundation assemblies, local presets, source-linked regeneration and a contractor assembly inspector. See the [technical register and remaining acceptance gates](docs/c1c-r5-technical-evidence.md).

### C.1B — Staging integrated
- Independent roof planes, pitch/direction, classified boundaries, opening deductions, soffit and insulation measurements; deterministic rectangular hip/gable/shed/flat preview and atomic application. No irregular automatic skeleton, inferred assembly applicability or consolidated pricing.
- Keyboard-first exact floor/roof dimensions, guarded repeated correction, workspace-specific history, polygon closure and actionable geometry diagnostics. Fixed delayed viewport auto-fit following trace-supported investigation.
- R4: contextual drafting and edge slope diagnostics, explicit bulk fascia/eavestrough/soffit assignment, bounded rectangular soffit and horizontal/sloped thermal derivation with exclusions, independent pending applicability, stable validated group metadata, atomic replacement/removal and undo/redo. Roof-only Shift-click and directional marquee selection, complete assembly selection and confirmed dependency closure preserve unrelated geometry. Manual irregular drafting retained; no new runtime dependency or schema bump.
- Owner reported all ten R4-L01–L10 local acceptance checks passed on candidate `fb60747f83183016694f4c54ac2dbc609087f5e5` (2026-11-24 Toronto local date); zero failures or deferred checks reported. A07 and A08 remediation accepted. [CI #129](https://github.com/homeextent/planarmto/actions/runs/45542671356), job 138964708488, passed 127/127 tests (87 engine/contract, 40 Chromium) and all validation stages on that exact commit. Owner authorized documentation-only closeout, staging integration and post-merge CI, subject to final exact-head CI and applicable protections. Production main/v2.15.1 remains separately gated. No application changes after owner-tested source are authorized. C.1B staging integration: owner accepted `fb60747f83183016694f4c54ac2dbc609087f5e5` (10/10 local checks; CI #129, 127/127 tests). Documentation-only head `8d707902adbf7365ef6e78a64bdab90ce634732e` passed [CI #132](https://github.com/homeextent/planarmto/actions/runs/45544873706) (127/127, job 138971962757). [PR #10](https://github.com/homeextent/planarmto/pull/10) merged into staging at `3649f546cbf0a6e19b831753181cc8616330c22c`; owner confirmed clean synchronized local staging and successful post-merge CI #133. Merge and branch identity independently verified; CI #133 is owner-reported, with exact run ID/job logs not independently retrieved because the commit lookup omits push runs. No production promotion; main remains v2.15.1 at `0423cb6`.

### Documentation and roadmap reconciliation
- Created [ROADMAP.md](ROADMAP.md) as milestone authority; reconciled governing documents and established milestone-end review protocol.
- Owner approved deferral of C.1D specialist site drafting beyond v2.16.0; retain optional site schema, existing records and existing floor/deck functionality. Do not require a site workspace for completeness. C.1C includes building-specific excavation/backfill, granular materials, drainage and waterproofing where explicitly measured and specified; detailed design remains subject to scope approval. C.1E must reconcile ownership and completeness including non-drafted applicable site scope; C.2 must support explicitly sourced contractor-entered quantities, allowances and quotations alongside measured geometry, without treating allowances as measured quantities or double counting. Site UI visibility is a future release-design decision, not a current code change. See ROADMAP.md.

### C.1A — Schema v3 and specialist measurement architecture
- Canonical explicit-only document, typed roof/foundation/site entities, quantity contracts and structural validation; assignment separated from completeness and exclusions require reason.
- Retire legacy estimating authority without deleting historical records; bounded explicit v2 preview migration, separate v3 recovery slot and preservation of raw historical directory records. Unsupported records cannot be opened, renamed or duplicated; export retained.
- Preserve floor formulas, CAD workspace isolation and PDF underlays; consolidated pricing/reporting remains gated until C.2. Specialist drafting/measurement engines are sequenced by ROADMAP.md; integrated ownership checks C.1E.
- Owner accepted candidate `8e4a0e6` on 2026-11-24: 14 local checks passed, zero failed, cursor responsiveness N/A/deferred for independent investigation, two historical export checks waived (obsolete records). CI #38 run 45459637724/job 138678390424: 37/37 tests (17 persistence, 8 architecture, 7 lifecycle, 5 measurement), TypeScript/build/audit (zero vulnerabilities)/PHP/PDF worker and isolated WordPress round trip passed. Nonblocking Node url.parse deprecation warning. Owner authorized documentation-only closeout and staging merge subject to final CI; main remains unchanged.

- PR #8 merged into staging at `c1a0bf7` after documentation-only candidate `3d0830e` passed CI #40 ([run 45462442984](https://github.com/homeextent/planarmto/actions/runs/45462442984)). Post-merge staging push [run 45462698052](https://github.com/homeextent/planarmto/actions/runs/45462698052), job 138689310248, completed successfully; owner CLI and job details verified. C.1A formally complete. Production `main` remains v2.15.1 at `0423cb6`.

### Increment B (integrated; schema v2 superseded by C.1A)

### Added
- B.1 canonical schema v2, typed optional workspaces and explicit scope ownership; B.2 workspace management, independent geometry/calibration/history, shared rates, full-document save/export/import and session recovery.
### Fixed
- Clean startup hydration, recovery preservation, structural sharing in CAD updates and removal of unused cost calculations for unquantified typed projects.
### Validation
- B.1 PR #6 accepted; B.2 PR #7 candidate `5d821f7` passed CI #29 (run 45447983433), 29/29 tests, audit and three-workspace WordPress round trip. Owner passed 10/10 functional corrective checks; reported no cursor lag after matching displays near 60 Hz. Owner authorized proceeding; sustained and controlled baseline performance measurement not independently established. Final accepted B.2 candidate `32c1569` passed CI #32 (run 45453385544); PR #7 merged at `99c5985`, with successful post-merge push CI confirmed by owner CLI. No production promotion; specialist takeoff and consolidation remain Increment C.

## [2.15.1] - 2026-11-24 — Production compatibility hotfix

### Fixed
- Publish the unchanged PDF.js module worker bytes under a hashed .js asset name to avoid the missing Content-Type observed for .mjs on SiteGround CDN (HTTP 200).
- Clear prior import errors/notices on new PDF or image imports; guard stale asynchronous image callbacks and report image decoding failures.
- CI verifies emitted worker naming, importer reference, byte integrity and isolated WordPress JavaScript MIME delivery.

Production acceptance of v2.15.0 was suspended after live PDF imports failed. v2.15.1 passed seven owner-confirmed local tests, hotfix CI 45402796354, staging CI 45410797506, and production PR CI 45428422202. PR #4 merged at 25cf167. On 2026-11-24 the owner confirmed all nine live production tests passed, including PDF import, error recovery and persistence. Increment A is functionally complete. The separate deployment workflow result and corrected-worker HTTP GET headers were not independently captured.

## [2.15.0] - 2026-11-24 — PDF blueprint import (Increment A)

### Added
- Client-side PDF.js import, paginated sheet picker, adaptive raster encoding and resolution optimization, source metadata and actual resolution notification.
- High-contrast calibration and wall/room drafting previews; 50% default opacity for newly imported blueprints.
### Fixed
- Avoid duplicated raster data for new PDF underlays; preserve legacy image compatibility.
- Surface browser quota, automatic recovery and WordPress project-save failures rather than falsely acknowledging successful persistence.
- Updated dependency lockfile and scoped Express qs override; local audit previously reported zero findings.

### Validation
- Owner accepted local PDF import, calibration, drafting, persistence, default opacity and unchanged MTO.
- GitHub Actions run 45398914590 at ce10256 passed all eight persistence regressions, build, audit, PHP syntax and isolated WordPress REST/database/worker delivery tests.
- Added independent validation CI. Staging merge 7ab225a passed post-merge CI run 45400095850. Owner authorized production release on 2026-11-24. PR #2 passed CI 45400883528 and merged at 6aa3734. Live PDF acceptance failed; superseded by v2.15.1 hotfix, which passed owner live acceptance.

## [2.14.3] - 2026-11-23

### Added
- **Direct Front-End WordPress Authentication Gate**: Added a prominent "Sign in with WordPress" action to `planarmto_serve_passcode_form()` in `planar-mto.php` routing through `wp_login_url(home_url('/planarmto/'))`, allowing users to authenticate and return directly to the full-page CAD app without ever navigating through `/wp-admin/`.
- **Guest vs. Cloud Sync Clarity**: Added helper text explaining that signing in enables persistent MySQL cloud project directory storage and master-rate syncing, whereas entering a Beta Access Code provides local sandbox guest access.
- **One-Click Guest Mode Sign-In Badge**: Exposed `loginUrl` via `window.planarMTOConfig` and added a compact, interactive "Guest Mode • Sign In" badge in `HeaderBar` (`src/components/HeaderBar.tsx`) when `currentUserId === 0`, enabling estimators to upgrade to their WordPress account in a single click.

---

### Added
- **Automated SiteGround CI/CD Deployment Pipeline**: Added `.github/workflows/deploy.yml` to automatically type-check, build, `rsync` `planar-mto.php` + `dist/` over SSH (`port 18765`), and flush SiteGround Dynamic Cache on every push to `main` or manual `workflow_dispatch`.
- **Documentation Synchronization**: Updated `README.md`, `SYSTEM_BIBLE.md`, and `DEVELOPER.md` with the `staging` → `main` release workflow and CI/CD architecture.

---

## [2.14.1] - 2026-11-23

### Added
- **Direct Cloud Retail Scraper Quick-Launch**: Added an external link button ("Open HD Price Scraper") directly beside the "Sync Live Ontario Rates" button in `RateCustomizerModal` (`src/components/RateCustomizerModal.tsx`), allowing estimators to quickly launch the cloud retail scraper (`https://planarmto-takeoff-sync.ai.studio/`) in a new browser tab to refresh Home Depot Canada prices before pulling updated rates into PlanarMTO.
- **Environment-Configurable Takeoff Sync URL**: Added `VITE_TAKEOFF_SYNC_APP_URL` to `ImportMetaEnv` in `src/types.ts` with fallback to `https://planarmto-takeoff-sync.ai.studio/`.

---

## [2.14.0] - 2026-11-23

### Added
- **Live Google Sheets Ontario Rate Sync**: Integrated a one-click "Sync Live Ontario Rates" feature into `RateCustomizerModal` (`src/components/RateCustomizerModal.tsx`), directly querying live Home Depot Canada material & labor pricing via a Google Apps Script Web App endpoint (`CSV_EXPORT`).
- **CORS-Safe Browser Fetch Pipeline**: Utilized standard headerless browser `fetch()` to handle Google Apps Script 302 redirects to `script.googleusercontent.com` seamlessly without triggering CORS preflight `OPTIONS` rejections.
- **Quote-Normalized Robust Item Matching**: Implemented dual-sided quote stripping fallback to reliably match 100% of rows between Google Sheets item names and internal `RATE_FIELDS` labels (e.g., matching `1/2 Standard Drywall Board"` with `1/2" Standard Drywall Board`).
- **Automated Timestamp Tracking & Interactive UI States**: Automatic updating of `categoryLastUpdated` timestamps across all modified trade categories upon sync, complete with `isSyncing` loading state (`Loader2` animation) and instant feedback banners.

---

## [2.13.0] - 2026-11-21

### Added
- **Planar Graph Crossing Wall Partitioning**: Automatic intersection and splitting of crossing walls into continuous Planar Straight Line Graph (PSLG) sub-edges via `partitionCrossingWalls()`, ensuring accurate half-edge face cycle and room polygon detection.
- **Aperture Smart Boundary Clamping & Overlap Prevention**: Implemented geometric clamping to guarantee a minimum 1" jamb allowance from wall corners/ends during canvas click placement and InspectorPanel offset/preset adjustments. Added automatic overlap detection to prevent stacked apertures.
- **Structural Header Framing Take-Off**: Integrated doubled 2x structural header lumber linear footage (`apertureHeadersLf`) for all rough openings into Carpentry & Framing take-off metrics, live MTO matrix, and contractor bid exports.
- **Deck Ledger Edge-Detection Engine**: Added `computeDeckLedger()` to detect deck polygon edges parallel to and within $0.75\text{ ft}$ of exterior building walls, automatically separating structural ledger board attachment linear footage from open, freestanding perimeter guardrailing (`deckPerimeterRailingLf`).
- **Deck Inspector Metrics**: Added real-time House Ledger LF and Open Railing LF status cards to the Timber Deck inspector panel.

### Fixed
- **OSNAP Loop Closure & Termination**: Ending a wall chain back onto the starting vertex commits the wall cycle and terminates the drafting pen cleanly without trailing rubber-band micro-segments.
- **Drag History Stack Debouncing**: Repaired undo/redo stack flushing during canvas element dragging; drag frames update without polluting the undo stack, committing a single transaction on mouse-up.
- **Universal Aperture Offset Controls**: Unlocked wall position and offset slider controls for all aperture types, allowing fine-tuned placement of windows and doors alike.

## [2.12.0] - 2026-08-29

### Added
- **CAD Origin Axis Rendering**: Visualized red horizontal ($X$-axis, $Y=0$) and green vertical ($Y$-axis, $X=0$) CAD origin crosshairs with explicit $(0,0)$ labeling on canvas.
- **Interactive Blueprint Alignment**: Added real-time drag-and-move canvas positioning for unlocked blueprints and a one-click "Center on Screen" action in the Inspector Panel.

### Fixed
- **Blueprint World Axis Alignment & Scale Persistence**: Anchored underlay raster images strictly to CAD World Coordinates (`worldX`, `worldY`, `feetPerPixel`). Isolated auto-scaling to initial file uploads, eliminating post-calibration image inflation and misalignment upon project reload.
- **Dual-Write Storage Engine & "Save As" Directory Registration**: Refactored project storage architecture to separate master project metadata (`PLANAR_MTO_PROJECTS_LIST`) from full payload storage (`PLANAR_MTO_PROJECT_<id>`). Fixed "Save As" project directory index registration, persistence, and modal rehydration.

## [2.11.0] - 2026-08-25

### Added
- **Thermal Envelope & Insulation Engine**: Multi-tier insulation system covering exterior walls, cathedral hot roofs, blown attic spaces, sound partitions, and elevated floor assemblies.
- **Board Foot Volume Engine**: Real-time board foot calculations ($\text{BF} = \text{SF} \times \text{Depth}_{\text{in}}$) for open and closed-cell spray foam assemblies with custom depth sliders.
- **Southern Ontario Defaults**: Set default exterior wall insulation to Fiberglass Batt R-20 and default floor insulation to Uninsulated (`'none'`).
- **Global Settings & Local Inspector Overrides**: Central configuration in Global Settings with segment-level overrides on individual Wall and Room Inspector cards.

### Fixed
- **MTO Matrix & PDF Report Itemization**: Dynamic itemization of active $/SF$ and $/BF$ insulation line items with non-zero filtering to hide uninsulated assemblies.

## [2.10.0] - 2026-08-24

### Added
- **OSNAP Sticky Node Locking & Hysteresis**: Implemented a sticky node capture ($15\text{px}$) and breakout ($30\text{px}$) hysteresis mechanism for drawing tools, keeping endpoints bound to target vertices until explicitly pulled beyond the threshold.
- **Visual Node Lock Indicators**: Rendered bright green glowing target rings and a "LOCKED" indicator on canvas whenever an endpoint actively captures a vertex.

### Fixed
- **Decoupled Grid and Object Snapping (OSNAP)**: Separated background grid snap (1', 6", 1") from OSNAP node/endpoint snapping. Turning off grid snap now allows free-form wall lengths while retaining vertex-to-vertex snapping.
- **Tooltip Clarification**: Updated canvas snap banner tooltip to explicitly reflect `Grid Snap: ON/OFF (Node snap remains active)`.

## [2.9.0] - 2026-08-24

### Added
- **Shift-Key Ortho Lock for Scale Calibration**: Supported 360° free-floating reference line selection by default to handle skewed blueprint scans, with an optional `Shift`-key constraint for locking calibration lines to exact 90° horizontal or vertical axes.
- **Automatic Grid Snap Bypass**: Automatic bypass of all node, wall, and grid snapping while the scale calibration tool is active or when grid snap is toggled off (`isSnapEnabled === false`), ensuring pixel-perfect calibration.

### Fixed
- **Blueprint Underlay Persistence & Rehydration**: Fully preserved blueprint image URLs, visibility, opacity, position offsets, scale factor, and lock states across WordPress database and LocalStorage save/load cycles.
- **Streamlined Underlay Settings UI**: Cleaned up the Blueprint Underlay Inspector card to 5 mistake-proof controls (Opacity Slider, Visibility Toggle, Lock Toggle, Re-Calibrate Scale, Remove Image), eliminating raw floating-point numeric input fields.
- **Underlay Selection & Canvas Interactivity**: Reconnected canvas click hit-testing for rehydrated blueprint underlays, allowing instant selection, moving, scaling, and visibility toggling upon reopening saved projects.

## [2.8.0] - 2026-08-24

### Added
- **Expanded Door Subtype Rate Card**: Added explicit rate keys and Master Customizer inputs for Single Bifolds ($110 Mat / $75 Lab), Double Bifolds ($190 Mat / $110 Lab), Patio Sliders ($750 Mat / $400 Lab), and Cased Openings ($45 Mat / $45 Lab).
- **Dynamic Matrix Inclusion Toggles**: Integrated inclusion toggle switches (eye icons) for Patio Sliders, Bifold Closet Doors, and Cased Openings in the Live MTO Matrix sidebar.

### Fixed
- **Unified Fenestration Schedule & PDF Alignment**: Extracted Section 3 itemization into `getFenestrationItemizedRows()`, populating missing unit rates, material subtotals, labor subtotals, and waste adjustments for bifolds and patio sliders across modal previews, PDF exports, and CSV spreadsheets.
- **Exterior Door Trim Cost Isolation**: Fixed trim cost routing in `estimator.ts` to ensure exterior door capping and brickmold accumulate strictly into Exterior Doors subtotals rather than window totals.
- **Default Window Preset Dimensions**: Updated standard window stamp initial placement defaults to 36" W × 48" H.

## [2.7.0] - 2026-08-24

### Added
- **4-Tier Water Heater Takeoff Engine & CAD Stamp**: Integrated dedicated "Water Heater / Boiler" CAD stamp with 4 equipment tiers (40-Gal Tank, 50-Gal Tank, Tankless Gas/Electric, Hybrid Heat Pump Tank) itemized in the live MTO matrix sidebar and PDF estimates.
- **Dynamic Window Finish & Operation Multipliers**: Added inspector controls for Window Styles (Slider 1.0x, Fixed Picture 0.85x, Casement Crank 1.25x) and Exterior Color Finishes (White Vinyl 1.0x, Black Exterior 1.175x) scaling directly against master $/SF rates.
- **Exterior Trim & Capping Takeoff Engine**: Added dynamic linear foot (LF) exterior opening trim calculations for Windows and Exterior Doors:
  - Standard Nailing Fin ($0.00/LF)
  - 2" Vinyl Brickmold ($5.00/LF)
  - Aluminum Site-Brake Capping ($13.00/LF)
  - Vinyl Brickmold + Sub-Sill Nose ($7.00/LF)
- **Rate Customizer Integration**: Added editable material and labor rate fields for all exterior trim options in the Master Rate Customizer.
- **Universal Aperture Type Switcher & Inch Presets**: Integrated an Aperture Type switcher allowing instant conversion between door and window types, with inch-based dimension inputs (width/height in inches) and common architectural quick size presets.

### Fixed
- **Clean Bid Schedule Filtering**: Added dynamic zero-quantity (`quantity === 0`) and $0.00 value filtering across modal previews, PDF exports, HTML print documents, and CSV spreadsheets to suppress inactive trade line items and empty category headers.
- **Exterior Door Trim Cost Isolation**: Isolated exterior door trim calculations from window totals in `estimator.ts` so door trim changes register strictly under Exterior Doors in the MTO matrix.
- **Clean Canvas Label Formatting**: Formatted CAD canvas aperture labels in rounded whole inches (e.g., `D32"x80"`, `W36"x48"`) instead of raw unformatted floating-point feet.

## [2.6.0] - 2026-08-23

### Added
- **Independent Wall & Ceiling Drywall Thickness Selection**: Added room-level inspector dropdowns for Wall Drywall (`1/2" Standard`, `5/8" Type X Fire-Rated`, `1/2" Moisture Board / Greenboard`) and Ceiling Drywall (`1/2" Standard`, `5/8" Type X Fire-Rated`), mapped to independent rate keys in `DEFAULT_UNIT_COST_RATES`.
- **Resilient Channel (RC-1) Ceiling Grid Integration**: Added acoustic/fire ceiling metal framing calculation ($\text{Ceiling SF} \times 0.90\text{ LF/SF}$) with a master rate key (`resilientChannelPerLf`), set to toggle ON by default whenever ceiling drywall is enabled.
- **Dynamic Area-Based Window Pricing ($\text{\$/SF}$)**: Upgraded standard window stamps from flat unit costs to dynamic square-foot pricing with an automated $6.0\text{ SF}$ minimum billing floor per unit, maintaining independent linear feet perimeter calculations for interior/exterior casing trim.

### Fixed
- **Complete Rate Card Coverage**: Audited and restored missing rate fields (`switchDimmer`, `outlet240v`, `waterHeaterPerUnit`, and differentiated drywall thicknesses) across the customizer modal, print schedules, and subcontractor CSV exports.
- **Canvas Passive Event Listener Warnings**: Registered native `{ passive: false }` wheel and touch listeners in `CadCanvas.tsx` to prevent console `preventDefault` warnings during canvas pan and zoom interactions.
- **Vite Production Build Exports**: Exported `DEFAULT_UNIT_COST_RATES` explicitly from `estimator.ts` to resolve Rollup module resolution failures during production bundling.
- **Clean Bid Schedule Filtering**: Added dynamic zero-quantity and $0.00 value filtering across the report preview modal, PDF exports, HTML print documents, and CSV spreadsheets, automatically hiding unused line items and empty trade category headers.

## [2.5.0] - 2026-08-23

### Added
- **Subcontractor Rate CSV Export/Import & Category Timestamps**: Added trade-specific CSV export, print RFQ sheets, and CSV rate importing in `RateCustomizerModal` with independent per-category `categoryLastUpdated` timestamp tracking.
- **Granular Electrical Panel Amperage Tiers**: Added 6 distinct rate tiers (Main Panel 100A, 200A, 400A and Subpanel 60A, 100A, 125A) with dynamic configuration dropdowns in the Inspector card.
- **Lighting & Device Stamp Suite Expansion**: Added CAD stamps and rate models for 3-Way Switches ($3W), Wall Sconces/Interior Fixtures, Exterior Coach Lights, and Soffit/Eaves Downlights.
- **Itemized PDF & Print Take-Off Reports**: Updated `PrintReportModal.tsx` to itemize every active electrical device, light fixture, and panel tier with material/labor subtotals instead of collapsing them into summary rows.

### Fixed
- **Live MTO Matrix Cost Visibility**: Ensured all active electrical items and panel breakdown tiers display both unit counts and calculated dollar amounts ($) in the sidebar.
- **Electrical Panel Placement & Safety**: Resolved canvas placement white screen crash by adding default property initialization (`panelType: 'main'`, `panelAmperage: '200A'`) and fallback rate key lookups.
- **Sconce & Exterior Light Canvas Placement**: Fixed tool handlers in `CadCanvas.tsx` to enable direct canvas click placement for all light fixture stamps.
- **Passive Event Listener Fix**: Registered native { passive: false } event listeners on the canvas container for wheel and touchmove events to eliminate browser console preventDefault warnings during pan and zoom interactions.
- **Missing Rate Fields Sync**: Added missing switchDimmer, outlet240v, and waterHeaterPerUnit field configurations to RateCustomizerModal.tsx and the estimation engine, ensuring 100% field coverage across trade rate cards, print schedules, and CSV exports.

---

## [2.4.0] - 2026-08-22

### Added
- **Ceiling Profiles & Area Multipliers**: Added support for Flat (1.00x), Vaulted (1.18x), Tray (1.25x), Coffered (1.45x), and Custom ceiling profiles in the Room Face Properties inspector, automatically scaling ceiling drywall sheet and paint gallon takeoffs.
- **Marquee Box Selection**: Enabled click-and-drag box selection across canvas entities (walls, vertices, rooms, apertures, stamps, annotations) with multi-item group dragging.
- **SketchUp-Style Modifier Keys**: Integrated Shift (Toggle/Invert), Ctrl/Cmd (Add), and Ctrl+Shift/Cmd+Shift (Subtract) selection modifier behaviors.
- **CAD Clipboard Engine**: Added global keyboard shortcuts for Cut (`Ctrl+X`), Copy (`Ctrl+C`), Paste (`Ctrl+V`), Duplicate (`Ctrl+D`), and Delete (`Delete`/`Backspace`) with automatic UUID regeneration and spatial offsets.
- **Custom Canvas Context Menu**: Implemented a dark-themed, floating right-click context menu on the CAD canvas for rapid clipboard and item management.

### Fixed
- **Single-Click Room Inspector**: Preserved explicit single-room entity selection (`type: 'room'`) on single clicks without modifiers to immediately open the Room Face Properties card.
- **Initialization Order**: Reordered helper callbacks in `App.tsx` to resolve hoisting runtime exceptions during keyboard shortcut mounting.

---

## [2.3.0] - 2026-08-21

### Added
- **Global Master Rate Persistence**: Added `GET` and `POST` REST API routes (`planarmto/v1/rates`) to store tenant master unit pricing in `wp_usermeta` (`planarmto_global_rates`) with local fallback.
- **Enhanced Rate Customizer Modal**: Integrated "Sync Master", "Save as Master Template", and "Apply to Project" actions directly into `RateCustomizerModal`.
- **Top Header "+ New Project" Button**: Added a direct action button in the main header bar for instant canvas resets.
- **Two-Step Project Deletion**: Added a confirmation dialog overlay in `ProjectDirectoryModal` before deleting saved plans.

### Changed
- **Toolbar Streamlining**: Removed duplicate Settings, Rates, and Print buttons from `MtoMatrixPanel`, consolidating document controls exclusively into the Top Header Bar.
- **Default Startup View**: Set default app mounting state to open directly to a clean, interactive blank canvas.
- **Rate State Isolation**: Separated frozen project rate snapshots (`wp_planarmto_projects.project_state`) from active master rate templates (`wp_usermeta`).

### Fixed
- **Rate Hydration on Canvas Reset**: Fixed new project creation and canvas clearing so new drawings inherit active `masterRates` instead of static hardcoded defaults.
- **Project Deletion API Sync**: Fixed asynchronous deletion handling in `storage.ts` and `ProjectDirectoryModal` to ensure database records are removed upon confirmation.

---

## [2.1.1] - 2026-08-20

### Added
- **Beta Passcode Protection Gate**: Implemented an access gate (`PLANARMTO_BETA_PASSCODE`) restricting unauthenticated visitors to a guest sandbox environment behind a passcode.
- **Interactive Password Visibility Toggle**: Integrated an inline eye/eye-off SVG toggle button in `planarmto_serve_passcode_form()` to switch input types between hidden password and visible text.
- **Cache-Bypass Directives**: Added `nocache_headers()` and `define('DONOTCACHEPAGE', true)` in `planar-mto.php` to prevent SiteGround Optimizer and Nginx servers from caching guest access screens and redirect loops.

### Changed
- **Instant Guest Authentication**: Updated passcode validation in `planar-mto.php` to instantly hydrate `$has_access = true` and set the root cookie (`planarmto_guest_access`), rendering the React CAD app without relying on cached HTTP redirects.

---

## [2.1.0] - 2026-08-20

### Added
- **Multi-Tenant MySQL Database Storage**: Integrated custom `wp_planarmto_projects` database table using `dbDelta()` to persist CAD floor plans, project metrics, and user logs scoped strictly by WordPress `tenant_id` (`user_id`).
- **REST API Endpoint Engine**: Implemented `planarmto/v1` namespace with authenticated `GET`, `POST`, and `DELETE` endpoints for projects and user-specific company branding.
- **Async Storage Abstraction Layer**: Refactored `src/utils/storage.ts` with `wpFetch` and `isWP()` helpers, enabling seamless auto-switching between WordPress REST API persistence and browser `localStorage` fallbacks for local dev.
- **Directory Loading UI State**: Added asynchronous loading spinners in `ProjectDirectoryModal.tsx` for real-time visual feedback during database queries.

### Changed
- **Branding & Settings Hydration**: Updated `App.tsx`, `HeaderBar.tsx`, and `GlobalProjectSettingsModal.tsx` to handle async promise resolutions when loading company branding and custom rate profiles.

---

## [2.0.0] - 2026-08-20

### Added
- **WordPress Full-Page Endpoint Architecture**: Registered a custom rewrite rule (`/planarmto`) in `planar-mto.php` to serve the React CAD application on a clean, dedicated domain endpoint that bypasses WordPress themes, page builders (Elementor), and headers/footers.
- **WordPress Admin Dashboard Integration**: Added a dedicated WP Admin sidebar menu item ("PlanarMTO") rendering a management card with a single-click "Launch PlanarMTO" action button.
- **Automated Plugin Packaging Pipeline**: Added `scripts/zip-plugin.js` and the terminal command `npm run build:zip` to compile production assets and automatically bundle `planar-mto.zip` directly into the parent directory (`../planar-mto.zip`).
- **Dynamic Asset Resolution Engine**: Implemented direct HTML string replacement inside the `template_redirect` hook to map relative Vite asset paths (`./assets/`) to absolute WordPress plugin directory URLs (`plugin_dir_url`).

### Changed
- **Vite Build Base Path**: Updated `vite.config.ts` configuration to use relative asset pathing (`base: './'`).
- **Plugin Version**: Bumped version metadata to `2.0.0` across plugin headers and system files.

---

## [1.9.0] - 2026-08-17

### Added
- **2D Blueprint Underlay & Scale Calibration**: Integrated floor plan image import (`.png`, `.jpg`, `.webp`, `.svg`) with 2-point reference scale calibration (pixel-to-foot mapping), opacity controls, canvas position locking, and a persistent "Blueprint Options" control button in the header bar.
- **Bifold Closet Doors (Single & Double)**: Added 30" Single and 60" Double Bifold Door aperture presets featuring parametric chevron vector rendering, fold side controls (`flipSwing`), and trim takeoff calculations.
- **Cased Wall Openings / Archways**: Added `cased_opening` preset to create wall passages that deduct wall drywall and stud framing while preserving complete room polygon topology for flooring, ceiling, and net area calculations.
- **Pocket Door Slide Direction Toggle**: Added `pocketDirection` state property and UI toggle in `InspectorPanel.tsx` to flip the sliding pocket frame direction along the wall segment.
- **In-Place Project Overwrite Workflow**: Implemented `activeProjectId` tracking and in-place `localStorage` updates in `storage.ts`. Added keyboard shortcuts (`Ctrl+S` for Quick Save, `Ctrl+Shift+S` for Save As) and a reactive `isDirty` unsaved changes indicator (`*` and pulsing orange dot) in `HeaderBar.tsx`.

### Changed
- **Default Calculation Mode**: Set default project initialization and sample plan calculation mode to `'interior_finish'` (Drywall & Trade Focus).
- **Project Manager Persistence**: Saved projects now update their existing records in the project directory instead of creating duplicate timestamped entries.

### Fixed
- **Double Bifold Chevron Symmetry**: Fixed inverted normal vector calculations for `door_bifold_double`, ensuring both $30"$ leaf pairs fold symmetrically toward the same side of the wall.
- **Locked Underlay Access**: Ensured blueprint underlay opacity, visibility, and lock settings remain accessible via the header bar even when the image is locked on the canvas.

---

## [1.8.0] - 2026-08-16

### Added
- **Dynamic Foundation & Footing MTO Controls**: Integrated interactive room-level slab thickness, foundation wall height/thickness, and footing dimensions in `InspectorPanel.tsx`. Updated `estimator.ts` to dynamically evaluate Poured Concrete CY and Slab Insulation SF.
- **Contextual Header Bar Height Sync**: Bounded header wall height dropdown to be selection-aware—updates selected room `ceilingHeight` when a room is selected, or sets default height for new rooms when unselected. Added ceiling height input to `InspectorPanel.tsx`.
- **Max-Height Merge Inheritance**: Merging rooms via wall deletion now automatically inherits the maximum ceiling height (`Math.max(...parentHeights)`) across parent room polygons.
- **Multi-Corner Drag Anchoring & Magnetic Snapping**: Enabled room dragging via specific corner anchor nodes with multi-corner magnetic snapping (`calculateMultiCornerSnap()`) and visual snap ring indicators.
- **Orthogonal Rectangular Corner Resizing**: Constrained corner dragging on 4-node rectangular rooms to automatically adjust adjacent perpendicular nodes, preserving 90° wall joins without polygon skewing.
- **Automatic Wall Preset Thickness Sync**: Selecting wall presets (2x4 Partition, 2x6 Exterior, 10" Foundation) now instantly updates assembly thickness and exterior finish settings.

### Changed
- **Two-Phase Graph Topology Cleanup**: Implemented `mergeCoincidentNodes` (unifying node IDs within spatial threshold) followed by `deduplicateWalls` (merging shared wall segments and remapping room `wallIds` references). Joined $10'\times10'$ rooms now correctly collapse 8 walls to 7, reducing framing from $84.33\text{ LF}$ to $73.79\text{ LF}$.
- **Mode-Specific Trade Scoping**: Calibrated `estimator.ts` trade rules for *Interior Finish Mode* vs *Exterior Framing Mode* (handling $+t$ corner wraps for siding/sheathing, rim-to-rim subfloor decking, and eave/soffit projections).
- **Header Bar Snap Increment Integration**: Bounded all drawing, wall offset, node movement, and room resizing logic to strictly respect `state.settings.gridSnapSize` ($1'$, $6"$, $1"$).
- **Interior Face Hover Dimensioning**: Projected hover dimension overlays onto net interior face boundaries to measure clear distances from interior corners rather than centerline endpoints.

### Fixed
- **Orphan Node Cleanup**: Automatically purge degree-0 nodes from `state.nodes` when attached walls or rooms are deleted.
- **JSX Escape Render Crash**: Fixed React runtime render crash on the "Calculation Engine Mode" settings tab by removing raw LaTeX escape backslashes from JSX text nodes.

---

## [1.7.0] - 2026-08-16

### Added
- **Wall Justification System**: New `interior_face` default mode allows for true interior clear space drafting by pushing nodes outward by $+t/2$ using full assembly thickness.

### Changed
- **Dual-Geometry Pipeline Transition**: Refactored the MTO estimator to a Dual-Geometry pipeline, decoupling structural framing from architectural finish surfaces.
- **Precision OSB Subfloor Decking**: Subfloor now accurately calculates to the outer structural rim joist face instead of matching interior flooring.

### Fixed
- **Assembly Synchronization**: Synchronized wall thickness properties ($t/2$) between node expansion and inset shrinkage to prevent 1-inch estimation gaps.
- **Numerical Stability Patch**: Resolved IEEE 754 floating-point "dust" and grid-snap drift in 1-inch snap modes by enforcing pre-expansion inch-rounding and 4-decimal math utility limits.
- **Reactive Global State**: Wall Height global dropdown state is now fully reactive and instantly updates interior drywall matrix calculations.
- **Canvas Fidelity**: Canvas room text labels and wall dimensions now perfectly reflect net interior clear area and exact face-to-face dimensions.

---

## [1.6.1] - 2026-08-16

### Fixed
- **Foundation Footprint Leakage Patch**:
  - Eliminated **Ceiling Drywall & Paint Leak**: Rooms bounded by foundation walls now correctly report $0\text{ sq ft}$ for ceiling finishes.
  - Eliminated **OSB Subfloor Decking Leak**: Foundation rooms are now excluded from wood subfloor rollups, correctly assuming concrete slab construction.
  - Eliminated **Auto-Derived Roofing Leak**: Foundation-only footprints no longer contribute to automatic roofing area projections.
  - Eliminated **Flooring Package Leak**: Foundation rooms with polished concrete finishes are now excluded from interior finish flooring rollups.
- **Baseboard Deduction Correction**: Ensured foundation wall lengths are strictly subtracted from room perimeters for baseboard take-offs.

### Added
- **Explicit Foundation Engine (Iteration 12)**:
  - Shifted to explicit, foundation-driven estimation.
  - New **Foundation Dimensions** (Wall Height, Footing Width/Thickness, Slab Thickness) in Inspector Panel.
  - Foundation walls now automatically stripped from: Net Drywall, Insulation, Siding, Baseboard, and Stud Framing.
  - Concrete volume (CY) is now calculated strictly from explicit foundation wall and room parameters.
- **Automatic Foundation Room Detection**: New rooms formed by foundation walls automatically preset to "Basement / Foundation Space" with uncoated polished concrete and no ceiling drywall.

### Updated
- **Documentation**: Synchronized `README.md` and `SYSTEM_BIBLE.md` with explicit foundation logic and material exclusion rules.

---

## [1.5.0] - 2026-08-16

### Added
- **Pre-Drafting Tool Selectors (Wall Pen & Room Box)**:
  - New **Active Wall Type Preset Selector** in the CAD tool palette.
  - Supported Presets: **Interior Partition (2x4)**, **Exterior Wall (2x6)**, and **Foundation Wall (10")**.
  - Drafting workflow optimization: Newly drawn walls and 4-wall boxes now inherit selected assembly properties (thickness, framing, and cladding) instantly upon creation.
- **Repository Maintenance Protocol**:
  - Established a mandatory documentation synchronization rule.
  - Automated updates for `README.md`, `SYSTEM_BIBLE.md`, and `CHANGELOG.md` following feature completion.

---

## [1.4.0] - 2026-08-16

### Added
- **Financial Multipliers & Waste Factor Controls**:
  - Global project Waste/Scrap % factor applied directly to material and labor quantities.
  - Commercial Markups: Project Management, Project Contingency, Company Overhead, and Company Profit percentages.
  - New "Waste & Markups" settings tab for granular financial control.
- **Smart Wall Assembly Defaults**:
  - Intelligent preset logic based on Wall Framing Type selection in the Inspector Panel.
  - **Foundation Wall**: New framing type with 10" default thickness and damp-proofing label logic.
  - **Partition 2x4**: Automatically defaults exterior cladding skin to "None".
  - **Exterior 2x6**: Automatically defaults assembly thickness to 6.5".
- **Hierarchical Financial Rollup**:
  - New rollup hierarchy in MTO Matrix and PDF Reports: Base Direct Cost (w/ Waste) -> Indirect Costs -> Gross Margin -> Contractor Grand Total / Bid Price.

### Updated
- **Cost Estimation Engine**: Refactored `estimator.ts` to support global settings injection for waste and markup calculations.
- **Documentation**: Updated `README.md`, `SYSTEM_BIBLE.md`, and `CHANGELOG.md` with latest feature specifications and mathematical formulations.

---

## [1.3.0] - 2026-08-15

### Added
- **Direct Client-Side PDF Generation (`pdfGenerator.ts`)**: Integrated `jspdf` and `html2canvas` pipeline to stream and save multi-page PDF documents directly to the client's device without requiring a physical printer connection or pop-up blocker permissions.
- **In-App Project Directory Manager (`ProjectDirectoryModal.tsx`)**:
  - Multi-project persistent storage inside browser `localStorage`.
  - Live metric summaries for each saved project (Room count, Gross SF, Estimated Material + Labor total).
  - Project search, duplication, inline renaming, JSON archive export, and single-click workspace loading.
  - Automatic background draft recovery banner.
- **Global Company Branding Persistence (`storage.ts`)**:
  - Saved company name, address, phone, email, lead estimator, and logo data URL in `localStorage`.
  - Automatic hydration of branding on new blank project creation and template selection.
- **Comprehensive System Documentation**:
  - Created `README.md`, `CHANGELOG.md`, and `SYSTEM_BIBLE.md`.

### Fixed
- **Print / Save PDF Action Handler**: Fixed unresponsive button behavior by providing direct "Download / Save PDF" execution with high-resolution canvas scaling (`scale: 1.8`) and isolated iframe print fallback.
- **HTML Export Data Completeness**:
  - Restored Material Unit Rates and Labor Unit Rates columns for every line item in the exported HTML document.
  - Pushed the complete Room Finish Schedule (Flooring type, Ceiling drywall, Wall paint, Baseboard LF) into the exported standalone HTML file.
- **Room Finish Schedule Data Mapping Bug**: Fixed issue where Ceiling Drywall incorrectly displayed as "No" for all rooms despite being enabled in room properties.
- **Blank Canvas Branding Wipe**: Prevented company branding and firm credentials from being cleared when switching or clearing canvas state.

---

## [1.2.0] - 2026-08-14

### Added
- **Trade Category Inclusions & Cost Toggles**:
  - Real-time toggling of 7 construction divisions: Architectural Finishes, Carpentry & Structural Framing, Fenestration & Enclosures, Electrical & Life Safety, Plumbing & Civil Infrastructure, Concrete Foundations, and Roofing & Building Envelope.
  - Individual item exclusion checkboxes with instantaneous real-time recalculation.
- **Global Project Settings Modal (`GlobalProjectSettingsModal.tsx`)**:
  - Wall height cascading across all existing wall segments.
  - Default slab thickness, roof pitch multiplier, waste factors, and stud spacing selection.
  - Full company branding and logo image asset uploader.
- **Material & Labor Unit Rate Customizer (`RateCustomizerModal.tsx`)**:
  - Granular split rate controls for materials ($) and labor ($) across every single line item.
  - Quick-preset adjustments (+10%, +25%, -10%, Reset to Default).

---

## [1.1.0] - 2026-08-13

### Added
- **Parametric Aperture & Stamp Hosting**:
  - Doors (Passage, Pocket, Exterior Entry, Overhead Garage) and Windows hosted along wall vectors.
  - Plumbing, electrical, and appliance stamps with dynamic clearance envelopes and fixture-to-wall snapping.
- **Deck & Hardscape Modeling**:
  - Outer structural zones calculating composite decking, ledger boards, deck footings, 2x8 joists, and concrete driveway paving.
- **Dimensioning & Annotation Tools**:
  - Aligned linear dimension strings and text leader callouts on canvas.

---

## [1.0.0] - 2026-08-12

### Added
- **Core 2D CAD Canvas Engine**:
  - Planar Straight Line Graph (PSLG) node and wall vertex management.
  - Half-edge face cycle traversal and Shoelace formula polygon area calculation.
  - Real-time collinear node snapping and 90° Ortho mode lock.
  - 3 pre-built architectural templates: Modern 2-Bedroom Rancher, Studio Living Suite, and 2-Bay Garage Workshop.
