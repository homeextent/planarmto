# PlanarMTO: 2D Architectural CAD & Real-Time Material Take-Off (MTO) Engine

**PlanarMTO** is an interactive, browser-native 2D computer-aided drafting (CAD) environment and real-time quantity surveying / material take-off (MTO) estimation platform. Built on computational geometry and planar graph traversal principles, PlanarMTO bridges the gap between architectural sketch-level design and instant, cost-accurate bill-of-materials generation.

---

## Key Features

### 1. Interactive 2D Vector CAD Canvas
- **Planar Graph Drafting**: Automatic node snapping, collinear vertex intersection, orthogonal locking (90° Ortho), and live dimension overlays.
- **2D Blueprint Underlay & Scale Calibration**: Import floor plan images (`.png`, `.jpg`, `.webp`, `.svg`) with 2-point reference calibration for pixel-to-foot mapping. Includes opacity controls and canvas position locking.
- **Multi-Corner Drag Anchoring & Magnetic Snapping**: Enhanced room movement via specific corner nodes with multi-corner magnetic snapping and visual snap indicators.
- **Orthogonal Rectangular Corner Resizing**: Constrained corner dragging on 4-node rectangular rooms to automatically adjust adjacent nodes, preserving 90° wall joins.
- **Marquee Box Selection**: Click-and-drag box selection across canvas entities (walls, vertices, rooms, apertures, stamps, annotations) with support for multi-item group dragging.
- **Custom Canvas Context Menu**: A dark-themed, floating right-click context menu on the CAD canvas for rapid clipboard and item management.
- **Sub-Pixel Precision**: Enforces true interior clear-space drafting capabilities via a synchronized dual-geometry pipeline.
- **Active Wall Type Presets**: Pre-selection of wall framing assemblies (Interior 2x4, Exterior 2x6, Foundation 10") prior to drafting, ensuring new segments inherit correct thickness and cladding properties instantly.
- **Parametric Apertures**:
  - Doors: Passage, Exterior, Pocket (with slide direction toggle), Bifold Single (30"), Bifold Double (60"), and Overhead Garage.
  - Windows: Standard, Picture, Slider.
  - Openings: Cased wall openings / archways that preserve room topology for flooring and ceiling take-offs.
- **Architectural Stamps**: Placed fixtures with automatic clearance envelope visualization (toilets, sinks, bathtubs, kitchen islands, appliances, LED potlights, GFCI receptacles, 240V EV chargers, subpanels, HVAC condensing units).
- **Hardscapes & Decks**: Outer structural zones including composite decks with ledger boards, footings, framing, concrete driveways, and paver patios.
- **Dimensioning & Annotations**: Aligned dimension strings and leader text callouts.

### 2. Computational Geometry & Automatic Room Face Detection
- **PSLG Half-Edge Graph Traversal**: Computes interior polygonal cycles from undirected wall segments in real time.
- **Winding Order & Hole Subtraction**: Computes exterior boundary perimeters and interior room boundaries with Shoelace formula and point-in-polygon ray casting.
- **Dynamic Net & Gross Area**: Computes gross building footprint, net interior conditioned area, exterior wall linear footages, and individual room finish schedules.

### 3. Dual-Cost Estimation & Multi-Trade Quantity Surveying
- **Dual-Layer Rate Architecture**: Implements a strict separation between **Global Master Rates** (stored in WordPress user metadata for tenant-wide persistence) and **Project Cost Rates** (frozen snapshots stored within the project state). This allows users to update global pricing without unintentionally altering historically saved project estimates.
- **Split Material & Labor Rates**: Configurable unit rates for all items across 7 construction divisions.
- **Dual-Geometry Accuracy**: Synchronized calculation of structural framing vs. interior finishes using independent geometric layers for unmatched take-off precision. Defaults to **Interior Finish Mode** for trade-focused drywall and finish scheduling.
- **Enhanced Rate Customizer**: Integrated "Sync Master", "Save as Master Template", and "Apply to Project" actions for rapid pricing synchronization across multiple projects.
- **Commercial Markups & Financial Rollups**: Built-in logic for Company Overhead, Profit, Project Management, and Contingency percentages.
- **Ceiling Profiles & Area Multipliers**: Support for Flat (1.00x), Vaulted (1.18x), Tray (1.25x), Coffered (1.45x), and Custom ceiling profiles in the Room Face Properties inspector. Automatically scales ceiling drywall and paint quantities based on the selected profile multiplier.
- **Jobsite Waste Factors**: Adjustable Waste/Scrap multipliers applied directly to base quantities prior to markup.
- **Precise Deduction Formulas**:
  - Net Wall Drywall & Paint: Subtracts door/window rough openings and deductions based on interior/exterior wall configurations.
  - Stud & Plate Framing: Bottom sole plates, top double plates, corner studs, partition junctions, and jack/king/header timber framing for all openings.
  - Concrete & Substructure: Explicit foundation-driven volume calculations. Concrete is calculated strictly from walls set to **Foundation Wall** (including footing width/thickness and wall height). Interactive room-level controls for slab thickness and footing dimensions in the Inspector Panel enable real-time Poured Concrete CY and Slab Insulation SF evaluation. Standalone foundation polygons are excluded from interior finishes (drywall, paint, baseboard), wood subflooring, and auto-derived roofing.
  - Roofing Envelope: Pitch multiplier calculation ($\sqrt{1 + (P/12)^2}$), architectural shingles (bundles/squares), underlayment felt, drip edges, and ridge vents. Auto-roofing projects over non-foundation footprints only. Merging rooms via wall deletion automatically inherits the maximum ceiling height across parent room polygons for consistent roofing elevations.
  - Finishes & Insulation: Batt insulation with opening deductions, finish flooring with configurable waste factors (default 10%), interior wall paint (2 coats @ 350 SF/gal), and ceiling drywall. Foundation walls and rooms are automatically stripped of interior finishes. Interior face dimensioning provides clear-distance measurements from interior corners rather than centerline endpoints.
  - Electrical & Plumbing: Automated take-offs for fixtures, wiring homerun lengths, piping runs, and life safety devices.

### 4. Professional Export & Reporting Suite
- **Single-Source-of-Truth Top Header Bar**: Consolidated document controls (Settings, Rates, Print, Save) into a unified top-level bar, removing duplicate controls from the MTO matrix for a streamlined interface. Includes an instant "+ New Project" canvas reset button.
- **Direct Client-Side PDF Generation**: High-resolution rasterization to multi-page vector-styled PDF via `jsPDF` and `html2canvas`—no physical printer connection required.
- **Executive HTML Take-Off & Specification Export**: Standalone formatted HTML document complete with company branding, CSI trade breakdowns, unit costs, and room finish schedules.
- **In-App Project Directory Manager**: Multi-tenant persistence layer using WordPress MySQL database (via `wp_planarmto_projects`) with browser `localStorage` fallbacks for local development. Supports project duplication, renaming, auto-recovery, two-step deletion confirmation, and JSON exports.
- **Persistent Company Branding**: Multi-tenant company profile storage mapped to WordPress user metadata, ensuring branding and custom rates follow the user across devices.

### 5. Multi-Tenant WordPress Persistence
- **Secure Data Isolation**: Project data is strictly scoped by WordPress `user_id` (`tenant_id`), ensuring estimators only see and manage their own floor plans and project metrics.
- **MySQL Storage Engine**: Replaces fragile local storage with a robust `wp_planarmto_projects` table for long-term project persistence and cross-device accessibility.
- **REST API Pipeline**: Leverages the `planarmto/v1` namespace for authenticated CRUD operations, secured via `X-WP-Nonce` to prevent unauthorized cross-tenant data access.

---

## Installation & Deployment

### WordPress Plugin Deployment (Recommended)
PlanarMTO is optimized to run as a dedicated WordPress plugin, providing a full-page application experience independent of your WordPress theme.

1. **Build & Package**:
   ```bash
   # Compile production assets and bundle the plugin zip
   npm run build:zip
   ```
   This generates `planar-mto.zip` in the parent directory.

2. **Install**:
   - Upload `planar-mto.zip` via **WP Admin > Plugins > Add New**.
   - Activate the plugin.

3. **Configure Permalinks**:
   - Go to **WP Admin > Settings > Permalinks**.
   - Click **Save Changes** once to flush the rewrite rules.

4. **Launch**:
   - Click the **PlanarMTO** menu item in the WordPress sidebar and click "Launch PlanarMTO".
   - Alternatively, navigate directly to `yourdomain.com/planarmto`.

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
