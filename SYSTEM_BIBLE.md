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

### 1.2 Half-Edge Data Structure & Face Traversal
Planar rooms (faces) are identified by converting undirected edges $E$ into paired directed half-edges $\vec{e}_{ij}$ and $\vec{e}_{ji}$.
1. For each node $v_i$, incoming and outgoing half-edges are sorted radially by polar angle:
   $$\theta = \text{atan2}(y_j - y_i, x_j - x_i)$$
2. The traversal executes the **"Next Counter-Clockwise (CCW) Edge"** rule: upon traversing $\vec{e}_{ij}$, the next edge selected from $v_j$ is the one immediately CCW from $\vec{e}_{ji}$.
3. Closed cycles $C = (v_1, v_2, \dots, v_k, v_1)$ are extracted.

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

### 2.3 Pre-Drafting Wall Presets
To optimize drafting efficiency, the system supports active wall type selection prior to instantiation.
- **Interior Partition (2x4)**: $\text{Thickness} = 3.5"$, $\text{Cladding} = \text{None}$.
- **Exterior Wall (2x6)**: $\text{Thickness} = 6.5"$, $\text{Cladding} = \text{Vinyl Siding / OSB}$.
- **Foundation Wall (10")**: $\text{Thickness} = 10"$, $\text{Cladding} = \text{Damp-proofing}$.

---

## 3. Dual-Cost Estimation & Take-Off Mathematical Formulations

Every take-off line item computes both **Material Cost** and **Labor Cost** with an adjustable **Waste Factor**:
$$\text{Cost}_{\text{Line}} = Q \times (1 + \text{Waste}_{\text{site}}) \times (\text{Rate}_{\text{Material}} + \text{Rate}_{\text{Labor}})$$
where $Q$ is the calculated engineering quantity and $\text{Waste}_{\text{site}}$ is the global project waste percentage (e.g., 0.10 for 10%).

### 3.5 Financial Rollup & Markups
The system aggregates base direct costs into a hierarchical contractor bid:
1. **Base Direct Cost**: $\sum \text{Cost}_{\text{Line}}$ (includes material/labor waste).
2. **Indirect Costs**:
   - Project Management: $\text{Base Direct Cost} \times \%_{\text{PM}}$
   - Contingency: $\text{Base Direct Cost} \times \%_{\text{Cont}}$
3. **Gross Margin**:
   - Company Overhead: $(\text{Base} + \text{Indirects}) \times \%_{\text{OH}}$
   - Company Profit: $(\text{Base} + \text{Indirects}) \times \%_{\text{Profit}}$
4. **Contractor Grand Total**: $\text{Subtotal} + \text{Overhead} + \text{Profit}$

### 3.1 Division 06 — Carpentry & Structural Framing

#### A. Wall Stud Quantity
For a wall of length $L$ (ft) with stud on-center spacing $S_{\text{oc}}$ (inches, default 16"):
$$N_{\text{studs, linear}} = \left\lceil \frac{L \times 12}{S_{\text{oc}}} \right\rceil + 1$$
Corner and junction stud additions:
$$N_{\text{studs, corners}} = 2 \times N_{\text{corners}} + 1 \times N_{\text{T-junctions}}$$
Aperture framing posts (2 king studs + 2 jack studs per opening):
$$N_{\text{studs, apertures}} = 4 \times N_{\text{apertures}}$$
Total Stud Count:
$$N_{\text{studs, total}} = N_{\text{studs, linear}} + N_{\text{studs, corners}} + N_{\text{studs, apertures}}$$

#### B. Wall Top & Bottom Plates
For 1 bottom sole plate and 2 top double plates (3 linear runs per wall):
$$L_{\text{plates}} = 3 \times \sum_{i} L_i \text{ (LF)}$$

#### C. Structural Headers
For each aperture of width $W_a$ (ft):
$$L_{\text{headers}} = \sum_{a} (W_a + 0.5) \times 2 \text{ (LF of 2x10/2x12 lumber)}$$

#### D. OSB Wall Exterior Sheathing
For exterior walls with height $H$:
$$A_{\text{sheathing}} = \sum_{\text{exterior}} (L_i \times H_i) - \sum_{\text{exterior apertures}} (W_a \times H_a)$$
$$\text{Sheets}_{\text{OSB 4x8}} = \left\lceil \frac{A_{\text{sheathing}} \times (1 + \text{Waste}_{\text{OSB}})}{32} \right\rceil$$

---

### 3.2 Division 09 — Architectural Finishes

#### A. Drywall Boards (4'x8' = 32 SF or 4'x12' = 48 SF)
Drywall coverage accounts for interior vs. exterior wall faces:
- **Interior Walls**: 2 active faces ($2 \times L \times H$).
- **Exterior Walls**: 1 interior face ($1 \times L \times H$).
- **Ceilings**: Sum of net room polygon areas $\sum A_{\text{room}}$ (if ceiling drywall enabled).

$$\text{Gross Drywall SF} = 2 \sum_{\text{interior}} (L_i H_i) + \sum_{\text{exterior}} (L_e H_e) + \sum_{\text{rooms}} A_{\text{room}}$$
$$\text{Net Drywall SF} = \text{Gross Drywall SF} - \sum_{\text{interior apertures}} 2(W_a H_a) - \sum_{\text{exterior apertures}} 1(W_a H_a)$$
$$\text{Sheets}_{\text{Drywall 4x8}} = \left\lceil \frac{\text{Net Drywall SF} \times (1 + \text{Waste}_{\text{Drywall}})}{32} \right\rceil$$

#### B. Interior Wall Paint
Two coats over net primed drywall surfaces at standard coverage rate ($350\text{ SF/gal}$):
$$\text{Gallons}_{\text{Paint}} = \left\lceil \frac{\text{Net Wall Drywall SF} \times 2}{350} \right\rceil$$

#### C. Finish Flooring (Hardwood / Tile / Carpet / LVP)
For each room $r$ with assigned floor finish and waste factor (default 10%):
$$A_{\text{floor, } r} = A(C_r) \times (1 + \text{Waste}_{\text{floor}})$$

#### D. Baseboard Moulding
For each room $r$ with perimeter $P_r$ and intersecting door openings:
$$L_{\text{baseboard, } r} = P_r - \sum_{d \in r} W_d$$

---

### 3.3 Division 03 — Concrete & Substructures

#### A. Explicit Foundation Wall & Footing Volume
Concrete metrics are driven strictly by walls explicitly set to **Foundation Wall**.
For each foundation wall $i$ with length $L_i$, wall height $H_{f,i}$, wall thickness $T_{f,i}$, footing width $W_{\text{ftg},i}$, and footing thickness $T_{\text{ftg},i}$:
- **Wall Volume**: $V_{\text{wall}, i} = L_i \times H_{f,i} \times T_{f,i}$
- **Footing Volume**: $V_{\text{footing}, i} = L_i \times W_{\text{ftg},i} \times T_{\text{ftg},i}$

#### B. Foundation Room Slab Volume
For each room polygon $r$ where at least one boundary edge is a **Foundation Wall**:
- **Slab Volume**: $V_{\text{slab}, r} = \frac{A_r \times (T_{\text{slab}, r} / 12)}{27} \text{ (Cubic Yards)}$
- **Slab Insulation**: $A_{\text{insul}, r} = A_r$

#### C. Concrete Reinforcement (Rebar & Welded Wire Mesh)
- **Perimeter Footing Rebar (2 continuous #4 runs + 15% overlap)**:
  $$L_{\text{rebar}} = 2 \times \sum L_{f,i} \times 1.15 \text{ (LF)}$$
- **Slab Welded Wire Fabric (6x6 W1.4/W1.4)**:
  $$A_{\text{mesh}} = \sum A_{\text{slab}, r} \times 1.10 \text{ (SF)}$$
- **Vapor Barrier (10 mil Polyethylene)**:
  $$A_{\text{vapor}} = \sum A_{\text{slab}, r} \times 1.10 \text{ (SF)}$$

---

### 3.4 Division 07 — Roofing & Thermal Envelope

#### A. Pitched Roof Surface Area
For pitch $P:12$ (rise over run) and eave overhang $d_{\text{overhang}} = 1.5\text{ ft}$:
$$\text{Slope Multiplier } M = \sqrt{1 + \left(\frac{P}{12}\right)^2}$$
$$A_{\text{roof, true}} = (A_{\text{superstructure}} + P_{\text{ext}} \cdot d_{\text{overhang}} + 4 \cdot d_{\text{overhang}}^2) \times M$$
where $A_{\text{superstructure}}$ excludes areas from rooms bounded by **Foundation Walls**.

---

### 3.6 Material Exclusion Rules for Foundation Walls
Setting a wall type to **Foundation Wall** automatically triggers the following exclusions:
- **Net Drywall & Paint**: $0\text{ sq ft}$ contribution.
- **Exterior Insulation & Siding**: $0\text{ sq ft}$ contribution.
- **Baseboard Length**: $0\text{ lin ft}$ contribution (subtracted from room perimeter).
- **Stud Framing**: $0\text{ lin ft}$ contribution.
- **Ceiling Finishes**: $0\text{ sq ft}$ for rooms bounded by foundation walls.
- **Subfloor Decking**: Excluded from OSB rollups for foundation rooms.
- **Auto-Roofing**: Excluded from auto-derived roofing footprints.
- **Flooring Package**: Excluded from overall Flooring Package totals for rooms with the "polished_concrete" finish in foundation zones.

#### B. Architectural Asphalt Shingles & Underlayment
- **Roofing Squares ($1\text{ Square} = 100\text{ SF}$)**:
  $$\text{Squares} = \frac{A_{\text{roof, true}} \times (1 + \text{Waste}_{\text{roof}})}{100}$$
- **Bundles ($3\text{ bundles/square}$)**:
  $$\text{Bundles} = \lceil \text{Squares} \times 3 \rceil$$
- **Underlayment Felt (Synthetic 10-sq rolls)**:
  $$\text{Rolls}_{\text{felt}} = \left\lceil \frac{A_{\text{roof, true}}}{1000} \right\rceil$$

---

## 4. PDF Generation & Client-Side Export Pipeline

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

## 5. Storage Schema & Local State Hydration

Persistent records are serialized to JSON in browser `localStorage`:

```typescript
// Company Branding Schema (Key: 'planarmto_persisted_branding')
interface CompanyBranding {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  estimatorName: string;
  logoUrl?: string; // Base64 Data URL or SVG string
  projectNumber?: string;
}

// Project Directory Entry Schema (Key: 'planarmto_saved_projects_directory')
interface SavedProjectEntry {
  id: string;
  name: string;
  projectNumber?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  grossSf: number;
  conditionedSf: number;
  roomCount: number;
  estimatedTotal: number;
  state: FloorplanState;
}

// Auto-Save Draft Schema (Key: 'planarmto_autosave_draft')
interface AutoSaveDraft {
  timestamp: number;
  state: FloorplanState;
}
```
