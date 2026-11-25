# PlanarMTO: 2D Architectural CAD & Real-Time Material Take-Off (MTO) Engine

**PlanarMTO** is an interactive, browser-native 2D computer-aided drafting (CAD) environment and real-time quantity surveying / material take-off (MTO) estimation platform. Built on computational geometry and planar graph traversal principles, PlanarMTO connects architectural drafting to independently measured construction workspaces and, ultimately, consolidated material takeoff and pricing. The staging architecture is being developed in gated increments; current production and staging capabilities differ.

---

## Development status — C.1B staging; C.1C feature candidate

Increment B, C.1A and C.1B are integrated into staging. See [ROADMAP.md](ROADMAP.md) for the authoritative development sequence. C.1A establishes canonical schema v3, explicit-only scope assignments (unquantified, assigned, excluded with reason), specialist entity and quantity contracts, independent workspace geometry/calibration, shared settings/rates and validated complete-project persistence. Assignment is not measurement completeness. Historical legacy/unversioned projects are retired; unsupported saved records remain export-only, without automatic deletion. Bounded explicit v2 preview migration is supported without guessing specialist geometry. Existing floor formulas are retained; roof measurement is integrated, foundation C.1C is in feature development, C.1D site drafting is deferred, integration safeguards follow in C.1E and consolidated reporting/pricing (including manual quantities and allowances) in C.2. The feature descriptions below include existing floor engine capabilities, not an assertion that consolidated reporting is currently enabled. See [C.1A specification and acceptance](docs/c1a-measurement-architecture.md). Production remains v2.15.1; v2.16.0 is separately gated.

## C.1C foundation feature and Codex transition

Draft PR #12 contains R1–R4 foundation measurement, with 288/288 verified on pre-handoff CI #186. Owner verified calibration and basic rectangular/irregular wall and strip quantities. [R5.0A baseline stabilization](docs/c1c-functional-findings.md#r50a-baseline-stabilization) is at local review. Contractor-workflow acceptance and approval of the proposed assembly workflow remain pending. See [transition](docs/coding-agent-transition.md), [actual findings](docs/c1c-functional-findings.md) and [R5 proposal](docs/c1c-r5-contractor-workflow.md). No staging/production promotion.

## C.1B roof measurement (staging integrated)

Merged PR #10 implements roof-specific projected drafting, pitch/direction, classified edges, opening deductions, raw soffit/insulation quantities and deterministic rectangular roof generation. R4 adds direct edge selection, live precision dimensions, explicit bulk assembly assignments, confirmed rectangular soffit and thermal derivation with exclusions, pending applicability, group-controlled editing and dependency-safe roof assembly deletion (Shift-click, window/crossing and whole-assembly selection). Schema v3 is extended additively; legacy roofs are not silently grouped. Irregular outlines retain manual drafting. Owner reported all ten R4-L01–L10 local acceptance checks passed on candidate `fb60747f83183016694f4c54ac2dbc609087f5e5` (2026-11-24 Toronto local date); zero failures or deferred checks reported. A07 and A08 remediation accepted. [CI #129](https://github.com/homeextent/planarmto/actions/runs/45542671356), job 138964708488, passed 127/127 tests (87 engine/contract, 40 Chromium) and all validation stages on that exact commit. Owner authorized documentation-only closeout, staging integration and post-merge CI, subject to final exact-head CI and applicable protections. Production main/v2.15.1 remains separately gated. No application changes after owner-tested source are authorized. See the [R4 acceptance record](docs/c1b-r4-specialist-usability.md#r4-e-formal-owner-acceptance). C.1B staging integration: owner accepted `fb60747f83183016694f4c54ac2dbc609087f5e5` (10/10 local checks; CI #129, 127/127 tests). Documentation-only head `8d707902adbf7365ef6e78a64bdab90ce634732e` passed [CI #132](https://github.com/homeextent/planarmto/actions/runs/45544873706) (127/127, job 138971962757). [PR #10](https://github.com/homeextent/planarmto/pull/10) merged into staging at `3649f546cbf0a6e19b831753181cc8616330c22c`; owner confirmed clean synchronized local staging and successful post-merge CI #133. Merge and branch identity independently verified; CI #133 is owner-reported, with exact run ID/job logs not independently retrieved because the commit lookup omits push runs. No production promotion; main remains v2.15.1 at `0423cb6`. No consolidated reporting until C.2.

## Key Features

### 1. Interactive 2D Vector CAD Canvas
- **Planar Graph Drafting**: Automatic node snapping, collinear vertex intersection, orthogonal locking (90° Ortho), and live dimension overlays.
- **Decoupled Grid & Object Snapping (OSNAP)**: Separated background grid snapping (1', 6", 1") from object vertex snapping (OSNAP). Disabling grid snap allows drafting free-form wall lengths and precise fractional dimensions while retaining magnetic node-to-node snapping.
- **OSNAP Sticky Node Locking & Hysteresis**: Implemented a sticky node capture ($15\text{px}$) and breakout ($30\text{px}$) hysteresis mechanism for drafting tools. Endpoints stay firmly bound to target vertices until intentionally pulled beyond the breakout threshold, accompanied by bright green glowing target rings and a "LOCKED" visual indicator on the canvas.
- **2D Blueprint Underlay & World Coordinate Alignment**: Import floor plan images (`.png`, `.jpg`, `.webp`, `.svg`) with **World Coordinate Bounding Box** anchoring. Underlays are strictly bound to CAD world coordinates (`worldX`, `worldY`, `feetPerPixel`), ensuring they remain perfectly aligned with drafted walls regardless of canvas zoom or pan.
- **Native Pixel Scale Calibration Pipeline**: Establish a precise pixel-to-foot mapping using a 2-point reference scale tool. Features **360° free-floating reference selection** (default) or **Shift-key Ortho locking** for exact 90° axes. Includes **automatic grid snap bypass** during calibration. Auto-scaling is isolated to initial file uploads, preventing post-calibration image inflation during project reloads.
- **Interactive Blueprint Alignment**: Support for real-time drag-and-move canvas positioning for unlocked blueprints and a one-click "Center on Screen" action in the Inspector Panel.
- **Streamlined Underlay Inspector Card**: Replaced complex numeric fields with 5 mistake-proof controls: Opacity Slider, Visibility Toggle, Lock Toggle, Re-Calibrate Scale, and Remove Image.
- **Multi-Corner Drag Anchoring & Magnetic Snapping**: Enhanced room movement via specific corner nodes with multi-corner magnetic snapping and visual snap indicators.
- **Orthogonal Rectangular Corner Resizing**: Constrained corner dragging on 4-node rectangular rooms to automatically adjust adjacent nodes, preserving 90° wall joins.
- **Marquee Box Selection**: Click-and-drag box selection across canvas entities (walls, vertices, rooms, apertures, stamps, annotations) with support for multi-item group dragging.
- **Custom Canvas Context Menu**: A dark-themed, floating right-click context menu on the CAD canvas for rapid clipboard and item management.
- **Sub-Pixel Precision**: Enforces true interior clear-space drafting capabilities via a synchronized dual-geometry pipeline.
- **Active Wall Type Presets**: Pre-selection of wall framing assemblies (Interior 2x4, Exterior 2x6, Foundation 10") prior to drafting, ensuring new segments inherit correct thickness and cladding properties instantly.
- **Universal Aperture Type Switcher & Inch Presets**: Integrated an Aperture Type switcher allowing instant conversion between door and window types, with inch-based dimension inputs (width/height in inches) and common architectural quick size presets.
- **Parametric Apertures & Smart Boundary Clamping**:
  - Doors: Passage, Exterior, Pocket (with slide direction toggle), Bifold Single (30"), Bifold Double (60"), Patio Sliders, and Overhead Garage. Features an **Expanded 8-Tier Door Rate Model** with unique rate keys for each subtype.
  - Windows: Standard, Picture, Slider with dynamic style multipliers (Slider 1.0x, Fixed Picture 0.85x, Casement Crank 1.25x) and exterior color finish scaling (White Vinyl 1.0x, Black Exterior 1.175x). Standard window stamp initial placement defaults to 36" W × 48" H.
  - Openings: Cased wall openings / archways that preserve room topology for flooring and ceiling take-offs.
  - **Boundary Clamping & Overlap Prevention**: Enforces a minimum 1" jamb allowance from corners/ends during placement and property adjustments; automatically pushes overlapping apertures along the wall to maintain physical realism.
  - **Structural Header Framing Take-Off**: Automatically calculates doubled 2x header lumber linear footage (`apertureHeadersLf`) for every window and door rough opening.
- **Exterior Trim & Capping Engine**: Dynamic linear foot (LF) exterior opening trim calculations for Windows and Exterior Doors, supporting Standard Nailing Fin, 2" Vinyl Brickmold, Aluminum Site-Brake Capping, and Vinyl Brickmold + Sub-Sill Nose.
- **Architectural Stamps**: Placed fixtures with automatic clearance envelope visualization (toilets, sinks, bathtubs, kitchen islands, appliances, LED potlights, GFCI receptacles, 240V EV chargers, subpanels, HVAC condensing units). Includes **4-Tier Water Heater Spec Engine** (40-Gal Tank, 50-Gal Tank, Tankless Gas/Electric, Hybrid Heat Pump Tank).
- **Hardscapes & Decks (Ledger vs. Freestanding Railing)**: Outer structural zones including composite decks with automatic house ledger edge detection (`computeDeckLedger`), separating structural ledger board attachment LF from open perimeter railing LF.
- **Dimensioning & Annotations**: Aligned dimension strings and leader text callouts. Canvas aperture labels are formatted in rounded whole inches (e.g., `D32"x80"`, `W36"x48"`) for professional clarity.

### 2. Computational Geometry & Automatic Room Face Detection
- **PSLG Half-Edge Graph Traversal**: Computes interior polygonal cycles from undirected wall segments in real time.
- **Winding Order & Hole Subtraction**: Computes exterior boundary perimeters and interior room boundaries with Shoelace formula and point-in-polygon ray casting.
- **Dynamic Net & Gross Area**: Computes gross building footprint, net interior conditioned area, exterior wall linear footages, and individual room finish schedules.

### 3. Dual-Cost Estimation & Multi-Trade Quantity Surveying
- **Dual-Layer Rate Architecture**: Implements a strict separation between **Global Master Rates** (stored in WordPress user metadata for tenant-wide persistence) and **Project Cost Rates** (frozen snapshots stored within the project state). This allows users to update global pricing without unintentionally altering historically saved project estimates.
- **One-Click Live Ontario Rates Sync & Cloud Scraper Quick-Launch**: Integrated direct live rate synchronization in the Rate Customizer modal (`RateCustomizerModal`) with a quick-launch link button to the **Ontario Retail Takeoff Sync** web app (`https://planarmto-takeoff-sync.ai.studio/` or `VITE_TAKEOFF_SYNC_APP_URL`) for refreshing Home Depot Canada pricing into Google Sheets before pulling updated rates. Establishes a zero-header, CORS-safe browser fetch to a Google Apps Script Web App querying live material & labor unit rates for Ontario, automatically normalizing item names (handling quotes and trade naming variances) and updating trade timestamps without requiring manual CSV exports or uploads.
- **Split Material & Labor Rates**: Configurable unit rates for all items across 7 construction divisions with independent per-category `categoryLastUpdated` timestamp tracking and trade-specific CSV export/import for RFQ distribution. Includes **Dynamic Matrix Inclusion Toggles** (eye icons) for individual line items like Patio Sliders, Bifold Doors, and Cased Openings.
- **Granular Electrical Panel Amperage Tiers**: Support for 6 distinct rate tiers (Main Panel 100A, 200A, 400A and Subpanel 60A, 100A, 125A) with dynamic configuration dropdowns in the Inspector card.
- **Lighting & Device Stamp Suite Expansion**: Added CAD stamps and rate models for 3-Way Switches ($3W), Wall Sconces/Interior Fixtures, Exterior Coach Lights, and Soffit/Eaves Downlights.
- **Dual-Geometry Accuracy**: Synchronized calculation of structural framing vs. interior finishes using independent geometric layers for unmatched take-off precision. Defaults to **Interior Finish Mode** for trade-focused drywall and finish scheduling.
- **Enhanced Rate Customizer**: Integrated "Sync Master", "Save as Master Template", and "Apply to Project" actions for rapid pricing synchronization across multiple projects.
- **Commercial Markups & Financial Rollups**: Built-in logic for Company Overhead, Profit, Project Management, and Contingency percentages.
- **Ceiling Profiles & Area Multipliers**: Support for Flat (1.00x), Vaulted (1.18x), Tray (1.25x), Coffered (1.45x), and Custom ceiling profiles in the Room Face Properties inspector. Automatically scales ceiling drywall and paint quantities based on the selected profile multiplier.
- **Jobsite Waste Factors**: Adjustable Waste/Scrap multipliers applied directly to base quantities prior to markup.
- **Precise Deduction Formulas**:
  - Net Wall Drywall & Paint: Subtracts door/window rough openings and deductions based on interior/exterior wall configurations. Supports independent thickness selection (1/2" Standard, 5/8" Type X Fire-Rated, 1/2" Moisture Board / Greenboard) with mapped unit rates.
  - Stud & Plate Framing: Bottom sole plates, top double plates, corner studs, partition junctions, and jack/king/header timber framing for all openings. Includes integrated Resilient Channel (RC-1) ceiling grid calculation ($\text{Ceiling SF} \times 0.90\text{ LF/SF}$) for acoustic/fire-rated assemblies.
  - Fenestration & Enclosures: Dynamic area-based window pricing ($\text{\$/SF}$) with an automated $6.0\text{ SF}$ minimum billing floor per unit, plus independent linear feet perimeter calculations for interior/exterior casing trim.
  - Concrete & Substructure: Explicit foundation-driven volume calculations. Concrete is calculated strictly from walls set to **Foundation Wall** (including footing width/thickness and wall height). Interactive room-level controls for slab thickness and footing dimensions in the Inspector Panel enable real-time Poured Concrete CY and Slab Insulation SF evaluation. Standalone foundation polygons are excluded from interior finishes (drywall, paint, baseboard), wood subflooring, and auto-derived roofing.
  - Roofing Envelope: Pitch multiplier calculation ($\sqrt{1 + (P/12)^2}$), architectural shingles (bundles/squares), underlayment felt, drip edges, and ridge vents. Auto-roofing projects over non-foundation footprints only. Merging rooms via wall deletion automatically inherits the maximum ceiling height across parent room polygons for consistent roofing elevations.
  - Finishes & Thermal Envelope: Multi-tier insulation system covering exterior walls, cathedral hot roofs, blown attic spaces, sound partitions, and elevated floor assemblies. Supports real-time Board Foot volume calculations ($\text{BF} = \text{SF} \times \text{Depth}_{\text{in}}$) for open-cell and closed-cell spray foam with custom depth sliders. Finish flooring with configurable waste factors (default 10%), interior wall paint (2 coats @ 350 SF/gal), and ceiling drywall (1/2" Standard or 5/8" Type X). Foundation walls and rooms are automatically stripped of interior finishes. Interior face dimensioning provides clear-distance measurements from interior corners rather than centerline endpoints.
- **Thermal Envelope & Insulation Engine**:
  - **Comprehensive Multi-Tier Assemblies**: Covers exterior walls, cathedral ceilings/hot roofs, unconditioned attic flat blown assemblies, interior acoustic partitions (sound batts), and elevated/cantilevered floors.
  - **Board Foot ($\text{BF}$) Volumetric Pricing**: Automatic board-foot calculations ($\text{BF} = \text{SF} \times \text{Depth}_{\text{in}}$) for spray foam assemblies (2 lb Closed-Cell @ wall/floor/roof rates, 0.5 lb Open-Cell) with dynamic thickness depth sliders ($1.0" - 12.0"$).
  - **Southern Ontario Defaults**: Central defaults configured to Fiberglass Batt R-20 for exterior walls and Uninsulated (`'none'`) for floors, matching local building code baselines.
  - **Global-to-Local Override Architecture**: Global project-level defaults in Global Settings seamlessly overridden at the individual segment or room level via Wall and Room Inspector cards.
  - **Dynamic Schedule Itemization**: Real-time line-by-line itemization of active $\text{\$/SF}$ and $\text{\$/BF}$ insulation takeoffs in the MTO matrix, print schedule, and subcontractor exports with non-zero filtering.
  - Electrical & Plumbing: Automated take-offs for fixtures, wiring homerun lengths, piping runs, and life safety devices. Itemized reporting for every active electrical device, light fixture, and panel tier with material/labor subtotals instead of collapsing them into summary rows.
  
- **Professional Export & Reporting Suite**:
  - **Unified Fenestration Print Schedule**: Integrated `getFenestrationItemizedRows()` helper to ensure perfectly aligned unit rates, subtotals, and waste adjustments across modal previews, PDF exports, and CSV spreadsheets.
  - **Clean Bid Schedule Filtering**: Automatically suppresses inactive trade line items (zero-quantity or $0.00 value) and empty category headers across all export formats (PDF, HTML, CSV) for professional clarity.
  - **Single-Source-of-Truth Top Header Bar**: Consolidated document controls (Settings, Rates, Print, Save) into a unified top-level bar, removing duplicate controls from the MTO matrix for a streamlined interface. Includes an instant "+ New Project" canvas reset button.
  - **Direct Client-Side PDF Generation**: High-resolution rasterization to multi-page vector-styled PDF via `jsPDF` and `html2canvas`—no physical printer connection required.
  - **Executive HTML Take-Off & Specification Export**: Standalone formatted HTML document complete with company branding, CSI trade breakdowns, unit costs, and room finish schedules.
  - **In-App Project Directory Manager**: Multi-tenant persistence layer using WordPress MySQL database (via `wp_planarmto_projects`) with browser `localStorage` fallbacks for local development. Supports project duplication, renaming, auto-recovery, two-step deletion confirmation, and JSON exports.
  - **Persistent Company Branding**: Multi-tenant company profile storage mapped to WordPress user metadata, ensuring branding and custom rates follow the user across devices.
  - **Master Rate Customizer Integration**: Direct editing of material and labor rates for all assemblies, including new 4-tier water heaters and exterior trim capping options.

### 5. Multi-Tenant WordPress Persistence & Dual-Write Storage
- **Secure Data Isolation**: Project data is strictly scoped by WordPress `user_id` (`tenant_id`), ensuring estimators only see and manage their own floor plans and project metrics.
- **Dual-Write Storage Architecture**: Refactored storage engine to separate high-frequency project directory metadata (`PLANAR_MTO_PROJECTS_LIST`) from the heavy project payload (`PLANAR_MTO_PROJECT_<id>`). This ensures rapid directory loading and reliable "Save As" registration while maintaining database integrity.
- **MySQL Storage Engine**: Replaces fragile local storage with a robust `wp_planarmto_projects` table for long-term project persistence and cross-device accessibility.
- **REST API Pipeline**: Leverages the `planarmto/v1` namespace for authenticated CRUD operations, secured via `X-WP-Nonce` to prevent unauthorized cross-tenant data access.

---

## Installation & Deployment

### WordPress Plugin Deployment (Recommended)
PlanarMTO is optimized to run as a dedicated WordPress plugin, providing a full-page application experience independent of your WordPress theme.

1. **Automated CI/CD Deployment (`staging` → `main`)**:
   Development occurs on isolated feature branches from validated `staging`, with PR CI, local production-preview acceptance for visible changes, owner-authorized integration and post-merge validation. Only a separately authorized release PR from staging into main triggers `.github/workflows/deploy.yml`, which runs `npm ci`, `npm run lint`, and `npm run build`, syncs `planar-mto.php` and `dist/` directly into `/wp-content/plugins/planar-mto/` on SiteGround over SSH (`port 18765`), and flushes the SiteGround Dynamic Cache automatically.

2. **First-Time Plugin Activation & Permalinks**:
   The initial `planar-mto` plugin folder must remain installed and active in WordPress. Navigating to **WP Admin > Settings > Permalinks** and clicking **Save Changes** is only required once on initial setup to register the custom rewrite rule for `/planarmto`.

3. **Manual Offline Backup (`npm run build:zip`)**:
   `npm run build:zip` remains available as an offline backup generator (`../../builds/planar-mto.zip`) for manual upload via **WP Admin > Plugins > Add New** if needed.

### Manual / Standard Deployment
For standalone web hosting or local development:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Development**:
   ```bash
   # Start local development server on port 3000
   npm run dev
   ```

3. **Production Build**:
   ```bash
   # Compile and build production bundle into dist/
   npm run build
   ```

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `V` / `Escape` | Switch to Pointer / Select Tool |
| `W` | Activate Wall Drafting Tool |
| `D` | Activate Door Placement Tool |
| `N` | Activate Window Placement Tool |
| `S` | Activate Fixture / Stamp Tool |
| `K` | Activate Deck Drawing Tool |
| `H` | Activate Hardscape Drawing Tool |
| `M` | Activate Dimension Tool |
| `A` | Activate Text Annotation Tool |
| `Ctrl+X` / `Cmd+X` | Cut selected entities to clipboard |
| `Ctrl+C` / `Cmd+C` | Copy selected entities to clipboard |
| `Ctrl+V` / `Cmd+V` | Paste entities from clipboard (with offset and new UUIDs) |
| `Ctrl+D` / `Cmd+D` | Duplicate selection instantly |
| `Delete` / `Backspace` | Delete selection |
| `Shift` (Hold) | Toggle Selection / Ortho Lock (Drafting) |
| `Ctrl` / `Cmd` (Hold) | Add to Selection |
| `Ctrl+Shift` / `Cmd+Shift` | Subtract from Selection |

---

## Technology Stack
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom slate CAD theme
- **Icons**: Lucide React
- **PDF Engine**: jsPDF & html2canvas
- **Data Persistence**: Browser localStorage with JSON export/import


## PDF blueprint import (Increment A — v2.15.1 production accepted)

Import a PDF via **Import Blueprint**; single-page files bypass the picker, while multi-page files show paginated thumbnails. Choose a sheet and a target longest edge (3,400 / 5,000 / 6,000 pixels). The browser rasterizes and optimizes the selected sheet locally, displays the actual dimensions, and uses the existing two-point calibration workflow. New PDF and image underlays default to 50% opacity; saved opacity is preserved. Production v2.15.1 supports one underlay per project. Staging schema v3 supports one independently calibrated underlay per workspace; consolidated measurement and pricing remain gated until C.2. See [validation and deployment notes](docs/pdf-blueprint-import.md).

GitHub Actions run 45398914590 at ce1025645d06538d208bb07fe5c7abfd01edc5a0 passed TypeScript, build, dependency audit, PHP syntax, eight persistence regressions and disposable WordPress/MariaDB integration (authenticated REST round trip, guest isolation, forced DB write failure, worker JavaScript MIME and byte equality). Staging commit 7ab225a passed post-merge CI run 45400095850. The owner authorized the v2.15.0 production release on 2026-11-24; v2.15.0 merged to main at 6aa3734. Live PDF import failed; the worker returned HTTP 200 without a Content-Type header on SiteGround. v2.15.1 emits the same module worker bytes as a hashed .js asset and clears stale import notifications. Hotfix PR #3 passed CI 45402796354, staging merge 490ecf1 passed CI 45410797506, and production PR #4 passed CI 45428422202 before merging at 25cf167. Owner confirmed all seven local hotfix tests and all nine live production acceptance tests on 2026-11-24. Increment A is functionally complete; the separate SiteGround deployment workflow result and direct corrected-worker HTTP GET headers have not been independently captured. See the acceptance record for details.
