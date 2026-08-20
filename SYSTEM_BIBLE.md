# PlanarMTO System Architecture & Mathematical Specification ("System Bible")

---

## 1. Graph Data Model & Planar Topology

PlanarMTO models an architectural floorplan as an embedded **Planar Straight Line Graph (PSLG)** $G = (V, E)$, where:
- **Vertices (Nodes) $V$**: Set of points $v_i = (x_i, y_i) \in \mathbb{R}^2$ representing wall intersections, corners, and free endpoints.
- **Edges (Walls) $E$**: Set of line segments $e_{ij} = (v_i, v_j)$ with assigned geometric thickness $T_w$, height $H_w$, and framing specifications.

### 1.1 Collinear Snapping & Node Merging
When drafting or moving a node $v_{\text{new}}$ within a threshold radius $\epsilon_{\text{snap}} = 0.5\text{ ft}$ of an existing node $v_k$, $v_{\text{new}}$ is merged into $v_k$. When a node falls within $\epsilon_{\text{snap}}$ of a wall segment $(v_a, v_b)$, the wall is partitioned at the orthogonal projection point:
$$t = \frac{(v_{\text{new}} - v_a) \cdot (v_b - v_a)}{\|v_b - v_a\|^2}, \quad t \in [0, 1]$$
The original edge $(v_a, v_b)$ is replaced by two sub-edges $(v_a, v_{\text{new}})$ and $(v_{\text{new}}, v_b)$.

#### 1.1.1 Two-Phase Topology Cleanup
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

#### B. OSB Subfloor Decking
Subfloor is detached from net interior area to account for area under wall plates.
- **Interior/Shared Walls**: Offset = 0 (Centerline).
- **Exterior Walls**: Offset = $-(\text{CoreThickness} / 2)$ (Outer Rim Face).
$$A_{\text{subfloor}} = \text{Area}(\text{getVariableOffsetPolygon}(C, \text{offsets}))$$

### 4.2 Division 03 — Concrete Foundations
Foundation estimation relies on explicit volumetric variables assigned per-room or per-wall:
- **Slab Volume**: $V_{\text{slab}} = A_{\text{room}} \times T_{\text{slab}}$
- **Foundation Wall Volume**: $V_{\text{fnd}} = \sum (L_i \times T_i \times H_i)$
- **Footing Volume**: $V_{\text{ftg}} = \sum (L_i \times W_{\text{ftg}} \times T_{\text{ftg}})$
- **Total Poured Concrete (CY)**: $V_{\text{total, CY}} = \frac{V_{\text{slab}} + V_{\text{fnd}} + V_{\text{ftg}}}{27}$
- **Slab Insulation**: $A_{\text{insul}} = A_{\text{room}}$ (SF)

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

### 10.1 MySQL Schema: `wp_planarmto_projects`
Projects are stored in a dedicated table created via `dbDelta()` to ensure schema stability:
- **`id`**: Primary Key (UUID/String).
- **`tenant_id`**: Maps to the WordPress `user_id`. All queries are strictly filtered by this ID.
- **`name`**: Project title.
- **`project_data`**: `LONGTEXT` blob containing the serialized `FloorplanState` (nodes, walls, rooms, apertures, stamps, etc.).
- **`metrics`**: `JSON` or `TEXT` summary of Gross SF and project totals for directory performance.
- **`updated_at`**: Timestamp for versioning and sorting.

### 10.2 REST API Endpoint Specification
The system exposes a custom namespace `planarmto/v1` for authenticated communication:
- **`GET /projects`**: Retrieves all projects belonging to the current `tenant_id`.
- **`POST /projects`**: Upserts a project entry (creates new or updates existing based on ID).
- **`DELETE /projects/{id}`**: Permanently removes a project record if it belongs to the requester.

### 10.3 Authorization & X-WP-Nonce
To prevent Cross-Site Request Forgery (CSRF) and ensure tenant isolation:
1. **Nonce Verification**: Every request must include an `X-WP-Nonce` header generated via `wp_create_nonce('wp_rest')`.
2. **REST Authentication**: The API utilizes the built-in WordPress cookie authentication (`is_user_logged_in()`).
3. **Tenant Enforcement**: The backend controller explicitly retrieves the current user's ID via `get_current_user_id()` and injects it into all SQL `WHERE` clauses, preventing users from accessing projects belonging to other IDs even if the project UUID is known.

### 10.4 Async Storage Abstraction Layer
The frontend `storage.ts` utility implements an isomorphic interface:
- **`isWP()` Check**: Detects if the app is running within the WordPress environment (checks for `wpApiSettings`).
- **`wpFetch` Wrapper**: Standardizes error handling and nonce injection for all REST calls.
- **Fallback Logic**: If `isWP()` is false, the system transparently falls back to `localStorage` for zero-configuration local development.
