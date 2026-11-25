# PlanarMTO System Architecture & Mathematical Specification ("System Bible")

---

## Architectural direction and governing principles — C.1B staging; C.1C feature candidate

This section governs all subsequent development and takes precedence over older engine descriptions below. Production v2.15.1 is a separate baseline. Preserve valid historical floor formulas as regression references; do not infer roof, foundation or site quantities from floor gross area. Roof-specific measurement is integrated; generic CAD tools in foundation/site workspaces do not establish specialist measurement authority.

- Four optional typed workspaces (floor, roof, foundation, site), each with independent geometry, calibration and source evidence; project-level settings and rates shared. No automatic cross-sheet spatial registration.
- Floor retains existing valid framing, finishes, apertures, MEP and siding inputs. Roof owns independently drafted planes, classified edges, openings, soffit/fascia/eavestrough and roof thermal envelope quantities. Foundation owns explicit walls, footings, pads, slabs, building excavation, insulation, drainage and waterproofing. Site owns grading, hardscape, decks and site features. These are ownership boundaries; roof engine is integrated, foundation R1–R4 implemented on feature branch pending contractor workflow acceptance, dedicated site engine deferred.
- Persist source geometry and identities rather than authoritative derived totals. Canonical feet; pitch rise per 12. Quantities carry code, unit, basis, source and stable physical/assembly identity. Missing inputs remain unquantified; exclusions require reason; assignment is not completeness. Distinct layers may share physical features but duplicate contributions to the same assembly/code must be prevented. No structural design, automatic topographic modeling or unsupported geometric assumptions.
- Specialist engines must identify unsupported topology or incomplete inputs rather than invent quantities. Integrated cross-workspace ownership and completeness are C.1E; consolidated rates, single application of waste and reporting are C.2.
- Historical unsupported projects retained without automatic deletion; no further legacy compatibility development required. Preserve data safeguards. Project reports remain gated until C.2.
- Development follows [DEVELOPER.md](DEVELOPER.md); documentation and tests are part of every accepted increment.

The authoritative milestone sequence and release gates are in [ROADMAP.md](ROADMAP.md). Owner approved deferral of C.1D specialist site drafting beyond v2.16.0; retain optional site schema, existing records and existing floor/deck functionality. Do not require a site workspace for completeness. C.1C includes building-specific excavation/backfill, granular materials, drainage and waterproofing where explicitly measured and specified; detailed design remains subject to scope approval. C.1E must reconcile ownership and completeness including non-drafted applicable site scope; C.2 must support explicitly sourced contractor-entered quantities, allowances and quotations alongside measured geometry, without treating allowances as measured quantities or double counting. Site UI visibility is a future release-design decision, not a current code change. See ROADMAP.md.

C.1B staging integration: owner accepted `fb60747f83183016694f4c54ac2dbc609087f5e5` (10/10 local checks; CI #129, 127/127 tests). Documentation-only head `8d707902adbf7365ef6e78a64bdab90ce634732e` passed [CI #132](https://github.com/homeextent/planarmto/actions/runs/45544873706) (127/127, job 138971962757). [PR #10](https://github.com/homeextent/planarmto/pull/10) merged into staging at `3649f546cbf0a6e19b831753181cc8616330c22c`; owner confirmed clean synchronized local staging and successful post-merge CI #133. Merge and branch identity independently verified; CI #133 is owner-reported, with exact run ID/job logs not independently retrieved because the commit lookup omits push runs. No production promotion; main remains v2.15.1 at `0423cb6`.

PR #8 merged into staging at `c1a0bf7` after documentation-only candidate `3d0830e` passed CI #40 ([run 45462442984](https://github.com/homeextent/planarmto/actions/runs/45462442984)). Post-merge staging push [run 45462698052](https://github.com/homeextent/planarmto/actions/runs/45462698052), job 138689310248, completed successfully; owner CLI and job details verified. C.1A formally complete. Production `main` remains v2.15.1 at `0423cb6`.

## C.1C foundation candidate and contractor workflow boundary

Feature PR #12 implements specialist foundation authority per [approved C.1C specification](docs/c1c-foundation-measurement.md). R5.0A baseline stabilization was independently reviewed and accepted by the owner at `cd782e7`. [Acceptance evidence](docs/c1c-functional-findings.md#r50a-formal-acceptance) covers the bounded UI corrections. Full contractor-workflow acceptance remains open. Contractor-first product direction: trace calibrated plans and configure construction specifications, with internal calculation complexity abstracted. The [coordinated R5 specification](docs/c1c-r5-coordinated-specification.md) authorizes R5.1–R5.2 within the existing persisted contract and R5.3 design only. Preserve canonical feet, explicit geometry/reference, material ownership, validated physical overlaps, source links and atomic history. No silent structural assumptions; unsupported angled intersections pending, curved deferred; no consolidated pricing. New assembly orchestration must reuse current engine and preserve independent/manual scope. [Transition](docs/coding-agent-transition.md) governs current checkpoint.

## Typed project architecture — C.1A

Canonical ProjectDocument schema v3 supersedes B schema v2 and removes legacy calculation mode. Project owns identity, settings and rates; workspaces own calibrated geometry, annotations and typed specialist measurement entities. Existing floor CAD adapter retains immutable structural sharing, independent histories and committed geometry checks. Specialist contracts use feet, stable entity/physical/assembly identifiers and source references; contributions carry quantity code, unit, basis and measured or unquantified status. Explicit scope assignments are unquantified, assigned (matching workspace IDs), or excluded with reason. Assignment never establishes completeness. Duplicate physical contribution keys and same-workspace specialist identities are rejected by validation; geometry topology, cross-workspace ownership enforcement and specialist calculations are subsequent increments. No authoritative project cost/print output until C.2. Existing floor calculation formulas remain available internally; mathematical descriptions below document existing engine formulas, not active consolidated estimates.

Historical unversioned and legacy-mode records are unsupported for active estimation; explicit v2 previews may migrate only within bounded validation (no generic specialist geometry interpretation, old exclusions reset to unquantified). Retain original historical records and recovery slot; v3 recovery uses a separate key. Saved directory writes preserve unrelated raw entries; unsupported records cannot be opened, renamed or duplicated. Application overwrite safeguards are not a new server-side security boundary. Full document validation at persistence; provisional 850,000-character blueprint and 4,000,000-character document limits remain. Historical export UI testing waived; cursor performance investigated independently by owner, not established as an application regression. See [C.1A acceptance](docs/c1a-measurement-architecture.md). Production v2.15.1 unchanged; B/C release separately gated.

## 1. Graph Data Model & Planar Topology

PlanarMTO models an architectural floorplan as an embedded **Planar Straight Line Graph (PSLG)** $G = (V, E)$, where:
- **Vertices (Nodes) $V$**: Set of points $v_i = (x_i, y_i) \in \mathbb{R}^2$ representing wall intersections, corners, and free endpoints.
- **Edges (Walls) $E$**: Set of line segments $e_{ij} = (v_i, v_j)$ with assigned geometric thickness $T_w$, height $H_w$, and framing specifications.

### 1.1 Collinear Snapping, OSNAP & Node Merging
When drafting or moving a node $v_{\text{new}}$ within a threshold radius $\epsilon_{\text{snap}} = 0.5\text{ ft}$ of an existing node $v_k$, $v_{\text{new}}$ is merged into $v_k$. 

#### 1.1.0 Decoupled Grid vs. Object Snapping (OSNAP) Hierarchy
PlanarMTO decouples background grid quantization from geometric object snapping (OSNAP), executing in a strict priority pipeline:
1. **Calibration Bypass**: All snapping logic (grid and OSNAP) is bypassed entirely during 2-Point Reference Scale Calibration to ensure pixel-perfect alignment against blueprint underlays.
2. **OSNAP (Node & Wall Centerline)**: Always active during drawing tools (`wall_pen`, `wall_rect`, `room_box`, apertures, stamps, measurements) regardless of background grid snap setting. Turning off grid snap allows free-form wall lengths while retaining vertex-to-vertex magnetic snapping.
3. **Background Grid Snapping**: When `state.settings.gridSnap` is active (`true`), coordinates quantize to the configured `gridSnapSize` ($1'$, $6"$, or $1"$).
4. **Free-Floating Fallback**: When grid snap is disabled and no OSNAP target is captured, the cursor operates with raw, unconstrained floating-point coordinates.

#### 1.1.1 Sticky Node Locking & Hysteresis Mechanics
To eliminate cursor jitter and accidental snap detachment during drafting, vertex OSNAP employs a stateful hysteresis loop:
- **Capture Threshold ($R_{\text{capture}} = 15\text{px}$)**: In world space, $\epsilon_{\text{capture}} = \frac{15}{\text{scale}}\text{ ft}$. When the cursor falls within $R_{\text{capture}}$ of node $v_k$, the system captures and locks onto $v_k$ (`lockedSnapNodeRef.current = v_k`).
- **Breakout Threshold ($R_{\text{breakout}} = 30\text{px}$)**: Once locked to $v_k$, the endpoint remains rigidly bound to $v_k$ as long as the screen-space displacement satisfies:
  $$d_{\text{px}} = \|p_{\text{cursor}} - v_k\| \times \text{scale} \le R_{\text{breakout}}$$
- **Hysteresis State Transition**: The lock is only severed when the user deliberately moves the cursor beyond $30\text{px}$ ($d_{\text{px}} > 30\text{px}$), resetting the locked node reference to `null`.
- **Visual Feedback**: The canvas renders glowing concentric green target rings and a "LOCKED" badge over the anchored vertex whenever active.

#### 1.1.2 Collinear Wall Partitioning & Topology Cleanup
When a node falls within $\epsilon_{\text{snap}}$ of a wall segment $(v_a, v_b)$, the wall is partitioned at the orthogonal projection point:
$$t = \frac{(v_{\text{new}} - v_a) \cdot (v_b - v_a)}{\|v_b - v_a\|^2}, \quad t \in [0, 1]$$
The original edge $(v_a, v_b)$ is replaced by two sub-edges $(v_a, v_{\text{new}})$ and $(v_{\text{new}}, v_b)$.

To maintain graph integrity during complex room merges:
1. **`mergeCoincidentNodes`**: Unifies disparate node IDs within spatial threshold $\epsilon_{\text{snap}}$.
2. **`deduplicateWalls`**: Merges shared wall segments and remaps room `wallIds` references, ensuring topological consistency (e.g., collapsing 8 walls to 7 when merging $10'\times10'$ rooms).
3. **Orphan Cleanup**: Automatically purges degree-0 nodes from $V$ when attached walls or rooms are deleted.

### 1.2 Half-Edge Data Structure & Face Traversal
Planar rooms (faces) are identified by converting undirected edges $E$ into paired directed half-edges $\vec{e}_{ij}$ and $\vec{e}_{ji}$.
1. For each node $v_i$, incoming and outgoing half-edges are sorted radially by polar angle:
   $$\theta = \text{atan2}(y_j - y_i, x_j - x_i)$$
2. The traversal executes the **"Next Counter-Clockwise (CCW) Edge"** rule: upon traversing $\vec{e}_{ij}$, the next edge selected from $v_j$ is the one immediately CCW from $\vec{e}_{ji}$.
3. Closed cycles $C = (v_1, v_2, \dots, v_k, v_1)$ are extracted.
4. **Merge Inheritance**: Merging rooms via wall deletion preserves structural metadata by inheriting the maximum ceiling height ($H_{\text{merge}} = \max(H_1, H_2, \dots, H_n)$) across parent polygons.

### 1.3 Polygon Area & Winding Order
The signed area $A$ of cycle $C$ is computed via the **Shoelace Formula (Gauss's Area Formula)**:
$$A(C) = \frac{1}{2} \sum_{i=1}^{k} (x_i y_{i+1} - x_{i+1} y_i), \quad \text{where } (x_{k+1}, y_{k+1}) = (x_1, y_1)$$
- **Positive Signed Area ($A > 0$)**: Counter-clockwise interior room face.
- **Negative Signed Area ($A < 0$)**: Clockwise exterior boundless perimeter (discarded or used for exterior building envelope bounds).
- **Minimum Enclosed Threshold**: Cycles with $|A| < 4\text{ sq ft}$ are discarded as topological artifacts.

### 1.4 Selection & Multi-Item Interaction
PlanarMTO supports complex entity selection and group manipulation:
- **Marquee Box Selection**: Implemented via `calculateBoxSelection(startPoint, endPoint)`, which performs AABB (Axis-Aligned Bounding Box) intersection checks against all canvas entities.
- **Selection Modifiers**:
  - **`Shift`**: Toggles/inverts selection state of clicked or marquee-contained items.
  - **`Ctrl` / `Cmd`**: Additive selection mode.
  - **`Ctrl+Shift` / `Cmd+Shift`**: Subtractive selection mode.
- **Group Dragging**: Selected entities maintain relative spatial offsets during movement, with magnetic snapping applied to the primary anchor node of the selection group.

### 1.5 Clipboard Engine & UUID Regeneration
The CAD Clipboard Engine (`copyToClipboard`, `pasteFromClipboard`) manages entity serialization:
- **Deep Cloning**: All copied entities are deep-cloned into a memory buffer.
- **UUID Regeneration**: To prevent ID collisions, new UUIDs are generated for all pasted entities.
- **Spatial Offset**: Pasted items are offset by a fixed distance (e.g., $10', 10'$) from their original position to provide visual separation.
- **Relationship Mapping**: Parent-child relationships (e.g., apertures hosted on walls) are remapped to the newly generated UUIDs during the paste operation to maintain assembly integrity.

---

## 2. Parametric Aperture & Stamp Hosting

### 2.1 Aperture Vector Coordinates
Doors and windows are hosted parametrically along a parent wall $e = (v_a, v_b)$. An aperture's position is defined by normalized scalar offset $t \in [0, 1]$, where:
$$\mathbf{p}_{\text{aperture}} = v_a + t \cdot (v_b - v_a)$$
The local orientation angle $\theta_{\text{aperture}} = \text{atan2}(v_b.y - v_a.y, v_b.x - v_a.x)$.

### 2.2 Aperture Rough Opening Deductions
Each aperture has geometric width $W_a$ and height $H_a$. The rough opening area deducted from the wall surface is:
$$A_{\text{deduct}} = W_a \times H_a$$

### 2.3 Specialized Aperture Rendering & Logic
- **Bifold Doors (Single/Double)**: Features parametric chevron vector rendering. Single bifold (30") and Double bifold (60") use a `flipSwing` boolean to control fold direction. Double bifolds enforce leaf symmetry via mirrored normal vector calculations.
- **Cased Openings**: Non-door passages (`cased_opening`) that deduct framing and drywall but do not break room polygon cycles, ensuring continuous flooring and ceiling take-offs.
- **Pocket Doors**: Includes a `pocketDirection` toggle to determine which side of the wall segment hosts the sliding pocket frame.
- **Expanded Door Subtype Rate Model**: Doors are itemized by specific subtype (Passage, Exterior, Pocket, Bifold Single, Bifold Double, Patio Slider, Cased Opening, Overhead Garage) with independent rate keys.
- **Universal Aperture Type Switcher & Inch Presets**: Integrated switcher allowing instant conversion between door and window types. Supports inch-based dimension inputs (Width/Height) with automated architectural quick size presets. Standard window stamp initial placement defaults to 36" W × 48" H.
- **Canvas Label Formatting**: Professional CAD labels are formatted in rounded whole inches (e.g., `D32"x80"`, `W36"x48"`) derived from floating-point feet coordinates.

### 2.4 Aperture Boundary Clamping & Overlap Prevention
To prevent impossible architectural geometry (such as openings floating off wall corners or overlapping each other):
- **Jamb Clearance Clamp**: Enforces a minimum clearance $\epsilon_{\text{jamb}} = 1" = \frac{1}{12}\text{ ft}$ from wall endpoints $v_a$ and $v_b$:
  $$\text{Offset}_{\text{min}} = \epsilon_{\text{jamb}}, \quad \text{Offset}_{\text{max}} = L_{\text{wall}} - W_a - \epsilon_{\text{jamb}}$$
- **Dynamic Overlap Avoidance**: When placing an aperture along an edge with existing openings $[O_i, O_i + W_i]$, interval intersection is resolved by shifting the candidate opening to the nearest collision-free interval.

### 2.5 Structural Header Framing Take-Off
Every wall rough opening requires a doubled dimensional lumber header ($2\times10$ or $2\times12$) supported by jack studs on either jamb. The structural header lumber linear footage is modeled as:
$$L_{\text{header}} = 2 \times (W_a + 2 \times T_{\text{jack}}) = 2 \times (W_a + 0.5\text{ ft})$$
where $0.5\text{ ft} = 6"$ accounts for $2 \times 1.5"$ jack stud bearings plus end allowances.

---

## 3. Dual-Geometry Pipeline & Wall Justification

PlanarMTO employs a **Dual-Geometry Pipeline** to separate structural framing data from architectural finish surfaces, ensuring sub-pixel precision for both trades.

### 3.1 Wall Justification & Coordinate Translation
The engine maintains a 1D PSLG of `CadNode` and `CadWall` centerlines for structural framing while allowing users to draft using "clear space" dimensions.
- **`interior_face` (Default)**: User input acts as the clear interior space. The engine automatically executes `convertInputToCenterlineNodes`, pushing nodes outward by $+t/2$ (using full assembly thickness).
- **`centerline`**: User input matches the underlying PSLG nodes.
- **`exterior_face`**: User input acts as the outer envelope. Nodes are pulled inward by $-t/2$.

### 3.2 Derived Geometric Polygons
- **Inset Interior Polygon**: Derived via `getNetInteriorPolygon()`. This generates an inward parallel offset (shrunken by $t/2$) from the centerline cycle for strictly architectural finish calculations.
- **Variable Offset (Outer Envelope)**: Derived via `getVariableOffsetPolygon()`. Used for structural elements that wrap the framing core (e.g., OSB subfloor reaching the outer rim joist face).

### 3.3 Trade Calculation Matrix
Quantities are derived from specific geometric layers based on trade requirements:

| Trade / Material | Geometry Layer Used | Calculation Logic |
| :--- | :--- | :--- |
| **Finishes (Flooring, Paint, Drywall)** | Inset Clear Face (`getNetInteriorPolygon`) | Strict interior surface area and perimeter minus apertures. Hover overlays measure clear face distances. |
| **Carpentry (Studs, Plates, Headers)** | Centerline PSLG | Linear run of framing core regardless of cladding. Mode-specific rules for Interior vs Exterior (corner $+t$ wraps). |
| **Subfloor (OSB Decking)** | Outer Rim Envelope (`getVariableOffsetPolygon`) | Expanded to outer structural face on exterior walls; centerline on shared walls. |
| **Siding / Envelope** | Outer Rim Envelope | Wraps the entire exterior structural framing core. |

---

## 4. Take-Off Mathematical Formulations

Every take-off line item computes both **Material Cost** and **Labor Cost** with an adjustable **Waste Factor**:
$$\text{Cost}_{\text{Line}} = Q \times (1 + \text{Waste}_{\text{site}}) \times (\text{Rate}_{\text{Material}} + \text{Rate}_{\text{Labor}})$$
where $Q$ is the calculated engineering quantity and $\text{Waste}_{\text{site}}$ is the global project waste percentage.

### 4.1 Division 06 — Carpentry & Structural Framing

#### A. Wall Stud Quantity
For a wall of length $L$ (ft) with stud on-center spacing $S_{\text{oc}}$ (inches, default 16"):
$$N_{\text{studs, linear}} = \left\lceil \frac{L \times 12}{S_{\text{oc}}} \right\rceil + 1$$
Corner and junction stud additions:
$$N_{\text{studs, corners}} = 2 \times N_{\text{corners}} + 1 \times N_{\text{T-junctions}}$$
Aperture framing posts (2 king studs + 2 jack studs per opening):
$$N_{\text{studs, apertures}} = 4 \times N_{\text{apertures}}$$
Total Stud Count:
$$N_{\text{studs, total}} = N_{\text{studs, linear}} + N_{\text{studs, corners}} + N_{\text{studs, apertures}}$$

#### B. Resilient Channel (RC-1) Ceiling Grid
Acoustic and fire-rated ceiling assemblies utilize RC-1 channels spaced at $12"$-$16"$ on center. The engine approximates linear footage based on ceiling area:
$$L_{\text{RC-1}} = A_{\text{net\_interior}} \times 0.90\text{ LF/SF}$$

#### C. OSB Subfloor Decking
Subfloor is detached from net interior area to account for area under wall plates.
- **Interior/Shared Walls**: Offset = 0 (Centerline).
- **Exterior Walls**: Offset = $-(\text{CoreThickness} / 2)$ (Outer Rim Face).
$$A_{\text{subfloor}} = \text{Area}(\text{getVariableOffsetPolygon}(C, \text{offsets}))$$

#### D. Ceiling Surface Area (Profiles & Multipliers)
Ceiling take-offs support non-flat profiles using an area multiplier $M_{\text{ceil}}$:
- **Flat**: $M = 1.00$
- **Vaulted**: $M = 1.18$
- **Tray**: $M = 1.25$
- **Coffered**: $M = 1.45$
- **Custom**: User-defined scalar.

The net ceiling drywall and paint quantities are calculated as:
$$A_{\text{ceil, modified}} = A_{\text{net\_interior}} \times M_{\text{ceil}}$$

### 4.2 Division 08 — Fenestration & Enclosures

#### A. Window Pricing Model
Standard window units ($A_{\text{window}}$) are priced dynamically by square footage with a style and finish multiplier matrix:
$$P_{\text{window}} = \max(A_{\text{window}}, 6.0\text{ SF}) \times \text{Rate}_{\text{\$/SF}} \times M_{\text{style}} \times M_{\text{finish}}$$

**Style Multipliers ($M_{\text{style}}$):**
- **Slider**: 1.00x
- **Fixed Picture**: 0.85x
- **Casement Crank**: 1.25x

**Finish Multipliers ($M_{\text{finish}}$):**
- **White Vinyl**: 1.00x
- **Black Exterior**: 1.175x

#### B. Exterior Trim & Capping Engine
Linear foot (LF) exterior opening trim calculations are applied to Windows and Exterior Doors:
- **Standard Nailing Fin**: $0.00/LF
- **2" Vinyl Brickmold**: $5.00/LF
- **Aluminum Site-Brake Capping**: $13.00/LF
- **Vinyl Brickmold + Sub-Sill Nose**: $7.00/LF

Exterior door trim costs are isolated from window totals in `estimator.ts` to ensure independent trade categorization in the MTO matrix.

#### C. Unified Fenestration Itemization
The system utilizes `getFenestrationItemizedRows()` to extract and format Section 3 (Fenestration) data. This helper function:
- Iterates through all active door and window stamps.
- Applies subtype-specific material and labor unit rates.
- Calculates subtotals including waste adjustments.
- Synchronizes output across the Live MTO Matrix, PDF Export, and CSV spreadsheets.

#### D. Casing Trim
Interior and exterior casing trim linear footage is calculated as the rough opening perimeter:
$$L_{\text{trim}} = 2 \times (W_a + H_a)$$

### 4.3 Division 07 — Thermal Envelope & Insulation Engine

PlanarMTO implements a multi-tier thermal envelope takeoff engine covering exterior walls, cathedral hot roofs, vented attic spaces, sound partitions, and elevated/cantilevered floors.

#### A. Board Foot ($\text{BF}$) Volumetric Engine
For spray foam insulation assemblies (closed-cell and open-cell), pricing is quantified volumetrically in **Board Feet** ($1\text{ BF} = 1\text{ ft} \times 1\text{ ft} \times 1\text{ in} = \frac{1}{12}\text{ ft}^3$):
$$\text{BF} = A_{\text{surface}} \times D_{\text{in}}$$
where $A_{\text{surface}}$ is the net surface area in square feet ($\text{SF}$) and $D_{\text{in}}$ is the specified insulation application depth in inches ($1.0" - 12.0"$).

#### B. Multi-Tier Assembly Takeoffs & Formulas

1. **Exterior Wall Cavity Insulation**:
   - Calculated across all exterior wall segments using net exterior wall area ($A_{\text{ext, net}} = A_{\text{gross}} - A_{\text{aperture}}$).
   - Area-based ($\text{SF}$): $\text{Cost} = A_{\text{ext, net}} \times (1 + \text{Waste}) \times (\text{Rate}_{\text{mat, SF}} + \text{Rate}_{\text{lab, SF}})$ for Fiberglass Batt R-20 and Mineral Wool Batt R-22.
   - Volume-based ($\text{BF}$): $\text{Cost} = (A_{\text{ext, net}} \times D_{\text{in}}) \times (1 + \text{Waste}) \times (\text{Rate}_{\text{mat, BF}} + \text{Rate}_{\text{lab, BF}})$ for 2 lb Closed-Cell and 0.5 lb Open-Cell spray foam.

2. **Roof & Attic Insulation**:
   - **Cathedral Ceiling / Hot Roof (Closed-Cell Spray Foam)**: Calculated across sloped roof area incorporating pitch multiplier $M_{\text{pitch}} = \sqrt{1 + (P/12)^2}$:
     $$\text{BF}_{\text{roof}} = A_{\text{roof, proj}} \times M_{\text{pitch}} \times D_{\text{in}}$$
   - **Vented Flat Attic (Blown Cellulose R-50 / R-60)**: Calculated across projected horizontal footprint:
     $$A_{\text{attic}} = A_{\text{roof, proj}}$$

3. **Elevated & Cantilevered Floor Assemblies**:
   - Applied to rooms configured with elevated/crawlspace floor structures over unconditioned spaces ($A_{\text{floor}}$):
     - Fiberglass Batt R-31: Area-based $\text{SF}$ takeoff.
     - 2 lb Closed-Cell Floor Spray Foam: Volumetric $\text{BF} = A_{\text{floor}} \times D_{\text{in}}$ takeoff.

4. **Interior Acoustic Sound Partitions**:
   - Applied to interior walls flagged with `soundInsulated: true` or `insulationType: 'sound_batt'`:
     $$A_{\text{sound}} = A_{\text{gross}}$$
     priced per square foot using `insulationSoundBattPerSf`.

#### C. Rate Structure & Granular Keys
The engine maps distinct material and labor rates in `costRates` and `masterRates`:
- `insulationFiberglassBattPerSf`: Fiberglass Batt R-20 ($\text{\$/SF}$)
- `insulationMineralWoolBattPerSf`: Mineral Wool Batt R-22 ($\text{\$/SF}$)
- `insulationClosedCellWallPerBf`: 2 lb Closed-Cell Wall Foam ($\text{\$/BF}$)
- `insulationClosedCellFloorPerBf`: 2 lb Closed-Cell Floor Foam ($\text{\$/BF}$)
- `insulationClosedCellRoofPerBf`: 2 lb Closed-Cell Hot Roof Foam ($\text{\$/BF}$)
- `insulationOpenCellFoamPerBf`: 0.5 lb Open-Cell Foam ($\text{\$/BF}$)
- `insulationBlownCellulosePerSf`: Blown Attic Cellulose R-50/R-60 ($\text{\$/SF}$)
- `insulationSoundBattPerSf`: Sound Batt Partition ($\text{\$/SF}$)
- `insulationFiberglassFloorBattPerSf`: Fiberglass Floor Batt R-31 ($\text{\$/SF}$)

#### D. Global-to-Local Override Architecture & Ontario Baselines
The system applies a cascading inheritance hierarchy:
1. **Global Baseline**: Configured in `GlobalProjectSettingsModal` (`defaultWallInsulationType`, `defaultFloorInsulationType`, `defaultAtticInsulationType`).
   - Default Exterior Wall: **Fiberglass Batt R-20** (`fiberglass_batt_r20`)
   - Default Elevated Floor: **Uninsulated** (`'none'`)
   - Default Attic Assembly: **Blown Cellulose R-60** (`blown_cellulose_r60`)
2. **Local Inspector Overrides**: Individual `CadWall` segments and `CadRoom` polygons can override insulation type and depth directly in the Wall/Room Inspector panel.
   $$\text{Type}_{\text{effective}} = \text{Entity}.\text{insulationType} \parallel \text{Settings}.\text{defaultType} \parallel \text{Fallback}$$
3. **Suppression & Filtering**: Assemblies evaluated as `'none'` or `'uninsulated'`, or with zero area/volume, are automatically filtered from matrix rollups, PDF exports, and subcontract CSV schedules.

### 4.4 Division 09 — Finishes

#### A. Drywall Thickness Matrix
The engine supports a 3-tier drywall thickness matrix for wall and ceiling surfaces, mapping to independent rate keys:
- **Walls**: `1/2" Standard`, `5/8" Type X Fire-Rated`, `1/2" Moisture Board / Greenboard`.
- **Ceilings**: `1/2" Standard`, `5/8" Type X Fire-Rated`.

### 4.5 Division 03 — Concrete Foundations
Foundation estimation relies on explicit volumetric variables assigned per-room or per-wall:
- **Slab Volume**: $V_{\text{slab}} = A_{\text{room}} \times T_{\text{slab}}$
- **Foundation Wall Volume**: $V_{\text{fnd}} = \sum (L_i \times T_i \times H_i)$
- **Footing Volume**: $V_{\text{ftg}} = \sum (L_i \times W_{\text{ftg}} \times T_{\text{ftg}})$
- **Total Poured Concrete (CY)**: $V_{\text{total, CY}} = \frac{V_{\text{slab}} + V_{\text{fnd}} + V_{\text{ftg}}}{27}$
- **Slab Insulation**: $A_{\text{insul}} = A_{\text{room}}$ (SF)

### 4.6 Division 26 — Electrical & Life Safety
The electrical take-off engine supports granular itemization for devices and service equipment.

#### A. Granular Panel Amperage Tiers
Rate models for electrical panels are categorized by type and amperage:
- **Main Panels**: 100A, 200A, 400A
- **Subpanels**: 60A, 100A, 125A

Each tier is tracked as a distinct line item with dedicated material/labor unit rates, rather than a generic "Panel" rollup.

#### B. Lighting & Device Expansion
Expanded stamp suite includes specialized rate calculations for:
- **3-Way Switches ($3W)**: Itemized separately from standard single-pole switches.
- **Sconces & Interior Fixtures**: Dedicated labor rates for wall-mounted lighting.
- **Exterior Coach Lights**: Integrated with building envelope trade rules.
- **Soffit/Eaves Downlights**: Calculated based on placement within roof/eave projections.

#### C. Itemized Reporting Logic
In `PrintReportModal.tsx`, electrical items are itemized line-by-line. The aggregator bypasses generic category rollups for the Electrical division to ensure that different panel tiers and device types are clearly visible in the final contract document.

### 4.7 Division 22 — Plumbing & Civil Infrastructure

#### A. 4-Tier Water Heater Takeoff Engine
The system supports itemized equipment takeoffs for water heating units via a dedicated CAD stamp:
- **40-Gal Tank**
- **50-Gal Tank**
- **Tankless Gas/Electric**
- **Hybrid Heat Pump Tank**

Each tier maps to independent material and labor unit rates in the Master Rate Customizer.

### 4.8 Division 07/32 — Decks, Ledger Boards & Guardrails

#### A. Automated Deck Ledger Edge Detection
Decks attached to exterior residential walls are fastened via pressure-treated ledger boards with flashing and structural lag screws, eliminating the need for freestanding guardrails along those sides.
- **Edge-Wall Proximity & Orientation Filter (`computeDeckLedger`)**:
  For each edge $(p_i, p_{i+1})$ of a deck polygon with midpoint $m$ and unit direction $\vec{u}_{\text{deck}}$:
  1. The edge midpoint $m$ must project orthogonally onto an exterior wall segment within proximity threshold $d_{\text{ledger}} \le 0.75\text{ ft} = 9"$.
  2. The deck edge and wall segment must be collinear/parallel within angular divergence $\le 10^\circ$:
     $$|\vec{u}_{\text{deck}} \cdot \vec{u}_{\text{wall}}| \ge 0.985$$
  3. Matched edges contribute their linear footage directly to Ledger Board linear footage ($L_{\text{ledger}}$).
- **Freestanding Guardrail Perimeter**:
  $$L_{\text{railing, open}} = \max(0, P_{\text{deck}} - L_{\text{ledger}})$$
  ensuring open-air guardrail costs are never billed along building facade attachments.

---

## 5. Numerical Stability & Precision

To prevent 1-inch estimation gaps and grid-snap drift, the engine enforces:
- **Inch-Rounding**: Pre-expansion coordinates are rounded to the nearest inch ($1/12\text{ ft}$).
- **Precision Limits**: Math utilities (`distance`, `area`) are capped at 4 decimal places.
- **Unified Thickness**: Both node expansion and inset shrinkage utilize `getWallThickness()` to synchronize $t/2$ offsets perfectly.

---

## 6. PDF Generation & Client-Side Export Pipeline

```
[DOM Element / PrintReportModal]
            │
            ▼
[html2canvas Capture (scale: 1.8, useCORS: true, backgroundColor: #0B1120)]
            │
            ▼
[High-Res HTML5 2D Canvas Bitmap (Width: W_px, Height: H_px)]
            │
            ▼
[jsPDF Document Instance (format: 'letter' / 'a4', orientation: 'portrait')]
            │
            ├─ Calculate aspect ratio: imgHeight = (imgWidth / W_px) * H_px
            ├─ Apply Clean Bid Schedule Filtering:
            │    Suppress lines where (quantity === 0 || value === 0)
            ├─ Multi-page vertical slice calculation:
            │    position = 0
            │    while (heightLeft > 0):
            │       pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
            │       heightLeft -= pageHeight
            │       if (heightLeft > 0) pdf.addPage()
            ▼
[pdf.save("Architectural_MTO_Report_[JobRef].pdf")] (Direct File Stream Download)
```

---

## 7. Storage Schema & Local State Hydration

Persistent records are serialized to JSON in browser `localStorage`. The system tracks an `activeProjectId` to enable in-place overwrites via "Quick Save" (`Ctrl+S`) while allowing "Save As" (`Ctrl+Shift+S`) to fork new entries.

```typescript
interface SavedProjectEntry {
  id: string;
  name: string;
  projectNumber?: string;
  createdAt: number;
  updatedAt: number;
  grossSf: number;
  state: FloorplanState;
}
```

---

## 10. Multi-Tenant Data Architecture & REST API Pipeline

To support professional enterprise usage, PlanarMTO implements a multi-tenant storage architecture that transitions from client-side `localStorage` to a centralized WordPress MySQL backend.

### 10.1 Persistence Layers & Dual-Write Architecture
PlanarMTO utilizes a multi-layered storage strategy to balance project-level integrity with tenant-wide preferences. The system implements a **Dual-Write Storage Engine** to optimize performance:

1. **`PLANAR_MTO_PROJECTS_LIST` (Metadata Index)**: A lightweight index stored in `wp_usermeta` or `localStorage` containing project headers (IDs, names, timestamps). This allows for rapid population of the Project Directory without loading heavy geometric payloads.
2. **`PLANAR_MTO_PROJECT_<id>` (Full Payload)**: The complete serialized project state JSON blob.
3. **"Save As" Directory Registration**: When forking a project, the system ensures atomic registration in both the metadata index and the payload store, fixing historical issues with directory index desynchronization.
4. **`wp_planarmto_projects` Table**: (WordPress Mode) Stores serialized project states, metrics, and UUIDs strictly scoped by `tenant_id`.
5. **`wp_usermeta` (Global Metadata)**: Stores tenant-wide configuration independent of specific projects:
   - **`planarmto_company_branding`**: Persists company identity (name, logo, contact info) across all projects.
   - **`planarmto_global_rates` (Master Rates)**: Stores the single-source-of-truth unit price template for materials and labor.
   - **Per-Category Timestamps**: Tracks `categoryLastUpdated` for each trade division (e.g., Electrical, Framing) within the master rate object, enabling granular tracking of pricing expiration.

### 10.2 Dual-Layer Rate Architecture
The system maintains a strict separation between global templates and project-specific costs:
- **Master Rates (`masterRates`)**: The active template stored in `wp_usermeta`. These are the baseline prices applied to all new projects.
- **Project Cost Rates (`costRates`)**: A frozen snapshot of rates saved within the `project_state` JSON blob. This ensures that historical project estimates remain accurate even if global market material rates are updated later.
- **Matrix Inclusion Toggles**: Individual line items can be dynamically toggled (eye icon) to include/exclude them from cost rollups. This state is persisted within the `project_state`.
- **Synchronization Pipeline**: Users can manually "Sync Master" to pull current global pricing into an old project, or "Save as Master" to push a project's custom rates to the global template.

### 10.3 Live Google Sheets Rate Sync Pipeline & CORS-Safe Fetch
To pull live Home Depot Canada material & labor unit rates directly without downloading or uploading CSV files:
- **Cloud Retail Scraper Quick-Launch**: An environment-configurable external launcher button (`DEFAULT_TAKEOFF_SYNC_APP_URL` with optional `VITE_TAKEOFF_SYNC_APP_URL` override, defaulting to `https://planarmto-takeoff-sync.ai.studio/`) directly beside the sync action in `RateCustomizerModal` opens the Ontario Retail Takeoff Sync web app in a separate browser tab to refresh Home Depot Canada pricing into Google Sheets prior to initiating rate synchronization.
- **Endpoint**: Google Apps Script Web App URL (`DEFAULT_GSHEET_WEBAPP_URL` with optional `VITE_GSHEET_WEBAPP_URL` override) querying `?sheet=CSV_EXPORT` and returning `{ ok: true, values: string[][] }`.
- **CORS Preflight Bypass**: Direct browser `fetch()` is dispatched without custom request headers (`Content-Type`, `Authorization`, etc.), allowing Google Apps Script's 302 HTTP redirect chain to `script.googleusercontent.com` to succeed cleanly in the browser without triggering CORS preflight `OPTIONS` errors.
- **Quote-Normalized Fallback Matching**: Normalizes quotes (stripping `"` characters) and trims whitespace on both sides when comparing spreadsheet item labels against internal `RATE_FIELDS` (e.g., mapping `1/2 Standard Drywall Board"` reliably to `1/2" Standard Drywall Board`).
- **Timestamp Tracking**: Automatically stamps `categoryLastUpdated` with the current ISO timestamp across all updated trade divisions upon sync.
- **CSV Export/Import Utility**: `RateCustomizerModal` additionally implements a CSV serialization layer for exporting trade-specific price sheets (e.g., for RFQ distribution to subcontractors) and re-importing updated unit rates.

### 10.4 REST API Endpoint Specification
The system exposes a custom namespace `planarmto/v1` for authenticated communication:
- **`GET /projects`**: Retrieves all projects belonging to the current `tenant_id`.
- **`POST /projects`**: Upserts a project entry (creates new or updates existing based on ID).
- **`DELETE /projects/{id}`**: Permanently removes a project record.
- **`GET /rates`**: Retrieves the global master rate template from user metadata.
- **`POST /rates`**: Updates the global master rate template.

### 10.5 Authorization & X-WP-Nonce
To prevent Cross-Site Request Forgery (CSRF) and ensure tenant isolation:
1. **Nonce Verification**: Every request must include an `X-WP-Nonce` header generated via `wp_create_nonce('wp_rest')`.
2. **REST Authentication**: The API utilizes the built-in WordPress cookie authentication (`is_user_logged_in()`).
3. **Tenant Enforcement**: The backend controller explicitly retrieves the current user's ID via `get_current_user_id()` and injects it into all SQL `WHERE` clauses, preventing users from accessing projects belonging to other IDs even if the project UUID is known.

### 10.6 Async Storage Abstraction Layer
The frontend `storage.ts` utility implements an isomorphic interface:
- **`isWP()` Check**: Detects if the app is running within the WordPress environment (checks for `wpApiSettings`).
- **`wpFetch` Wrapper**: Standardizes error handling and nonce injection for all REST calls.
- **Fallback Logic**: If `isWP()` is false, the system transparently falls back to `localStorage` for zero-configuration local development.

---

## 11. WordPress Deployment Layer & Guest Passcode Gate

To protect beta deployments from unauthorized public access while allowing a sandbox "Guest" experience, PlanarMTO implements a server-side passcode gate.

### 11.1 Passcode Verification Pipeline
The gate is enforced within the `template_redirect` hook in `planar-mto.php` before any React assets are served:
1. **Unauthenticated Check**: If a visitor is not a logged-in WordPress user, the system checks for a valid `planarmto_guest_access` cookie.
2. **Passcode Challenge & WordPress Authentication**: If no cookie is present, the visitor is served the `planarmto_serve_passcode_form()` gate instead of the CAD application. The gate presents two clear entry paths:
   - **Direct WordPress Sign-In**: A prominent "Sign in with WordPress" action linking directly to `wp_login_url(home_url('/planarmto/'))`. Authenticating redirects users immediately back to the PlanarMTO frontend without ever exposing `/wp-admin/`, automatically enabling cloud MySQL project directory persistence and master-rate syncing (`currentUserId > 0`).
   - **Beta Passcode Entry**: Allows local guest access via `PLANARMTO_BETA_PASSCODE`. Submitting the code creates a 30-day `planarmto_guest_access` cookie for sandboxed local storage operation (`currentUserId = 0`).
3. **Instant Hydration**: Upon submitting the correct passcode (matching `PLANARMTO_BETA_PASSCODE`), the server instantly sets the root cookie and hydrates `$has_access = true`, allowing the app to render in the same request lifecycle.
4. **Guest Mode Indicator & One-Click Cloud Upgrade**: When running in guest mode (`currentUserId === 0`), `planar-mto.php` provides `loginUrl` inside `window.planarMTOConfig`. The client `HeaderBar` displays a compact **"Guest Mode • Sign In"** link badge so estimators can switch to their authenticated WordPress account in one click.

### 11.2 Cookie Persistence & Security
- **Cookie Name**: `planarmto_guest_access`
- **Scope**: Root path (`/`) to ensure access persists across all potential project endpoints.
- **Duration**: 7 days (default).
- **Verification**: The server verifies the presence of this cookie on every non-authenticated request to determine whether to serve the App or the Gate.

### 11.3 Cache-Bypass Architecture
Aggressive caching layers (SiteGround Optimizer, Nginx, Varnish) can often cache the passcode gate or redirect loops. To ensure the gate functions reliably:
- **`DONOTCACHEPAGE`**: The constant `define('DONOTCACHEPAGE', true)` is set globally within the plugin to signal to most WordPress caching plugins to skip the PlanarMTO endpoint.
- **`nocache_headers()`**: WordPress native `nocache_headers()` are issued to send standard HTTP headers (`Cache-Control: no-cache, must-revalidate, max-age=0`) to the browser and edge CDN layers.

### 11.4 Automated CI/CD Deployment & Cache Invalidation Pipeline
Production deployments are automated via GitHub Actions (`.github/workflows/deploy.yml`):
- **Staging to Main Promotion Trigger**: Pushing commits or merging pull requests from `staging` into `main` (or triggering manual `workflow_dispatch`) initiates the production deployment pipeline.
- **Concurrency Serialization**: Employs `group: deploy-planarmto-prod` with `cancel-in-progress: false` to ensure all production deployments queue and execute deterministically in sequential order without canceling ongoing transfers.
- **Verification & Build**: Executes clean dependency installation (`npm ci`), TypeScript type verification (`npm run lint`), and production compilation (`npm run build`).
- **Atomic Asset Synchronization**: Utilizes `rsync -avz --delete` over SSH port `18765` to atomically synchronize `planar-mto.php` and the compiled `dist/` bundle directly into the active WordPress plugin directory (`/wp-content/plugins/planar-mto/`) on SiteGround.
- **Automated Dynamic Cache Invalidation**: Following asset transfer, triggers SiteGround's server CLI (`site-tools-client domain update id=1 flush_cache=1`) over SSH to invalidate the SiteGround Dynamic Cache, guaranteeing immediate availability of the updated release without manual server administration.

---

## 8. Blueprint Underlay & Scale Calibration Pipeline

### 8.1 World Coordinate Bounding Box & Alignment
Blueprint underlays are anchored strictly to **CAD World Coordinates** (`worldX`, `worldY`, `feetPerPixel`) within the `FloorplanState.underlay` object. This ensures that the underlay remains stationary relative to the architectural geometry even when the canvas is panned or zoomed. 

To ensure seamless session restoration, the pipeline preserves:
- **`url`**: The absolute or relative source of the image.
- **`worldX`, `worldY`**: The top-left anchor point of the image in CAD feet.
- **`feetPerPixel`**: The native scale factor derived from calibration.
- **`opacity` & `isVisible`**: Rendering state properties.
- **`isLocked`**: Interaction state preventing accidental dragging.

### 8.2 Native Pixel Scale Calibration Pipeline
The calibration tool establishes a mapping $M: \text{pixel} \to \text{foot}$ by measuring a reference segment of known length $L_{\text{ref}}$.
- **Auto-Scaling Isolation**: Image auto-scaling logic is strictly isolated to initial file uploads. Post-calibration, the `feetPerPixel` property becomes the single source of truth, eliminating image inflation or misalignment during project reloads.
- **Free-Floating Selection**: By default, the tool allows 360° rotation for the reference line to accommodate skewed scans.
- **Shift-Key Ortho Lock**: Holding `Shift` constrains the calibration vector to the nearest 90° cardinal axis ($0^\circ, 90^\circ, 180^\circ, 270^\circ$).
- **Calibration Formula**:
  $$\text{scale} = \frac{L_{\text{ref}}}{\|P_2 - P_1\|_{\text{pixel}}}$$

### 8.3 Interaction & Hit-Testing
Rehydrated underlays maintain full interactivity.
- **Interactive Alignment**: Unlocked blueprints support real-time drag-and-move positioning on the canvas.
- **Center on Screen**: A dedicated action in the Inspector Panel calculates the viewport centroid and translates the underlay `worldX/worldY` to align the image center with the current view.
- **Hit-Testing**: Hit-testing is reconnected on project load, allowing for selection and transformation of the blueprint image until `isLocked` is enabled.

---

## 9. UI Architecture & Document Controls

### 9.1 Single-Source-of-Truth Top Header Bar
To streamline the user experience, all document-level controls are consolidated into the **Top Header Bar**:
- **Consolidated Control**: Global Settings, Master Rates, Printing, and Saving are managed exclusively from the header, removing duplicate action buttons from the MTO Matrix Panel.
- **Canvas Lifecycle Management**: Includes a dedicated **"+ New Project"** button that triggers a hard canvas reset and hydrates the new project with active **Master Rates**.

### 9.2 Blueprint Underlay Inspector (5-Control UI)
The underlay management interface is constrained to 5 primary functional controls to prevent configuration errors:
1. **Opacity Slider**: Granular Alpha blending.
2. **Visibility Toggle**: Instant layer suppression.
3. **Lock Toggle**: Prevents spatial transformation.
4. **Re-Calibrate Scale**: Re-triggers the 2-point calibration tool.
5. **Remove Image**: Purges the underlay from state.

### 9.3 Canvas Context Menu & Clipboard UI
A dedicated context menu provides rapid access to clipboard operations:
- **Floating Menu**: Dark-themed overlay triggered on `contextmenu` events within the `CadCanvas` viewport.
- **Selection Awareness**: Menu options (Cut, Copy, Duplicate, Delete) are dynamically enabled/disabled based on the current selection state.
- **Global Shortcut Sync**: Context menu actions dispatch the same internal commands as keyboard shortcuts (`Ctrl+X/C/V/D/Delete`), ensuring consistent application state logic.
- **Initialization Order**: Helper callbacks in `App.tsx` are ordered to prevent hoisting exceptions during keyboard and context menu event listener mounting.


## PDF blueprint import — Increment A (v2.15.1 production accepted)

The import adapter (`src/utils/pdfUnderlayImporter.ts`) lazy-loads a bundled PDF.js worker and renders only the chosen sheet at full resolution. Thumbnail batches contain at most 12 pages. Targets are 3,400/5,000/6,000 px with a 24-million-pixel raster cap, 80 MiB input cap and adaptive compression/downsampling to an 850,000-character data URI budget. At Increment A, the serialized project cap was 2,000,000 characters; the current staging cap is 4,000,000; browser quota preflight is not a persistence guarantee. New PDF underlays use canonical `src` and retain filename/page/raster dimensions; legacy URL fallback remains supported. New imports start at 50% opacity, and existing saved values are preserved. Existing world-coordinate calibration and MTO formulas are unchanged. Authenticated WordPress writes require server acknowledgement; guest/local saves surface quota errors. This Increment A description is historical; B and C.1A now supply independent workspace states and schema v3 on staging, while consolidation remains pending. Isolated WordPress/MariaDB integration passed in GitHub Actions run 45398914590 at ce10256, including authenticated REST round trip, guest isolation, forced database write failure and PDF worker JavaScript MIME and byte equality. Eight persistence regression tests also passed. This establishes isolated server-side persistence and HTTP asset delivery, not actual browser worker execution on SiteGround. SiteGround browser import and authenticated save/reload remain mandatory smoke tests following separately authorized production deployment.

Staging integration at 7ab225a was validated by post-merge CI run 45400095850. Owner authorized v2.15.0 production promotion on 2026-11-24. Production v2.15.0 merged at 6aa3734; live PDF import failed with a missing worker Content-Type response header. The v2.15.1 release retains PDF.js module semantics and changes only the emitted worker asset extension to .js. All new import requests clear earlier errors/notices and invalidate superseded asynchronous callbacks. Hotfix CI 45402796354, staging CI 45410797506 and production PR CI 45428422202 passed. PR #4 merged to main at 25cf167. Owner confirmed seven local and nine live production tests passed on 2026-11-24, including single/multi-page PDF execution, error clearance, calibration/MTO, authenticated and guest persistence, and existing project compatibility. The independent deployment workflow result and direct corrected-worker HTTP GET headers were not captured; live functional acceptance is owner-reported. Increment A is functionally complete. Increment B and C.1A are complete on staging; subsequent C increments remain pending.

## Evidence-driven interaction validation — governing standard

For all subsequent increments, browser interaction correctness is a distinct validation layer alongside mathematical, topology, persistence and server integration contracts. Follow the evidence-driven debugging and browser regression protocol in DEVELOPER.md. Reproduce defects, inspect actual traces/screenshots/state, identify evidence-supported causes, make bounded corrections, preserve regression assertions and verify exact-commit results before claiming resolution. Never substitute speculative edits or weakened assertions for demonstrated correctness. Use synthetic fixtures and isolated browser contexts; protect real project records.

C.1B-R3.8 established a verified feature baseline at f5d8bef (CI #78, run 45515709731, 9/9 Chromium tests and all existing validation stages passed). A delayed viewport auto-fit displaced an in-progress polygon's displayed starting vertex; removing the delay resolved the original unchanged closure test. This baseline does not establish full R3.8 coverage, staging integration, production acceptance or release authorization. Owner visual acceptance remains mandatory for interactive changes.

### C.1B roof engine — owner accepted and staging integrated

The roof engine on draft PR #10 uses canonical projected polygon geometry, optional pitch/direction/elevation, classified single physical edges, explicit opening deductions and separate soffit/insulation quantities. Rectangular generators are deterministic and preview-only until atomic apply; general irregular automatic skeleton generation is deferred. The shared precision command preserves anchor/quadrant and replaces the most recent eligible history transaction; unsafe connected edits are refused. Specialist quantities remain raw, without consolidated rates or reports. R4 derives disjoint horizontal soffit strips and explicitly confirmed horizontal/sloped insulation footprints from reconciled rectangular source boundaries, with bounded thermal exclusions. Pending strips persist without measured quantity; source references and reconstructed geometry are validated on mutation/import/history restore. Derived groups are revised atomically; invalid dependency changes are refused. Roof-only selection and confirmed deletion use a dependency closure that preserves unrelated geometry and other workspaces. Additive v3 metadata separates roof group IDs, derivation group IDs and quantity IDs; legacy groups are not inferred. Nonfoam CF is informational only. Owner reported all ten R4-L01–L10 local acceptance checks passed on candidate `fb60747f83183016694f4c54ac2dbc609087f5e5` (2026-11-24 Toronto local date); zero failures or deferred checks reported. A07 and A08 remediation accepted. [CI #129](https://github.com/homeextent/planarmto/actions/runs/45542671356), job 138964708488, passed 127/127 tests (87 engine/contract, 40 Chromium) and all validation stages on that exact commit. Owner authorized documentation-only closeout, staging integration and post-merge CI, subject to final exact-head CI and applicable protections. Production main/v2.15.1 remains separately gated. No application changes after owner-tested source are authorized. See docs/c1b-r4-specialist-usability.md. Staging integration completed; see ROADMAP.md for final evidence.
