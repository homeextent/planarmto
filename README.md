# PlanarMTO: 2D Architectural CAD & Real-Time Material Take-Off (MTO) Engine

**PlanarMTO** is an interactive, browser-native 2D computer-aided drafting (CAD) environment and real-time quantity surveying / material take-off (MTO) estimation platform. Built on computational geometry and planar graph traversal principles, PlanarMTO bridges the gap between architectural sketch-level design and instant, cost-accurate bill-of-materials generation.

---

## Key Features

### 1. Interactive 2D Vector CAD Canvas
- **Planar Graph Drafting**: Automatic node snapping, collinear vertex intersection, orthogonal locking (90° Ortho), and live dimension overlays.
- **Active Wall Type Presets**: Pre-selection of wall framing assemblies (Interior 2x4, Exterior 2x6, Foundation 10") prior to drafting, ensuring new segments inherit correct thickness and cladding properties instantly.
- **Parametric Apertures**: Doors (passage, exterior, pocket, overhead garage) and Windows (standard, picture, slider) hosted parametrically on wall segments.
- **Architectural Stamps**: Placed fixtures with automatic clearance envelope visualization (toilets, sinks, bathtubs, kitchen islands, appliances, LED potlights, GFCI receptacles, 240V EV chargers, subpanels, HVAC condensing units).
- **Hardscapes & Decks**: Outer structural zones including composite decks with ledger boards, footings, framing, concrete driveways, and paver patios.
- **Dimensioning & Annotations**: Aligned dimension strings and leader text callouts.

### 2. Computational Geometry & Automatic Room Face Detection
- **PSLG Half-Edge Graph Traversal**: Computes interior polygonal cycles from undirected wall segments in real time.
- **Winding Order & Hole Subtraction**: Computes exterior boundary perimeters and interior room boundaries with Shoelace formula and point-in-polygon ray casting.
- **Dynamic Net & Gross Area**: Computes gross building footprint, net interior conditioned area, exterior wall linear footages, and individual room finish schedules.

### 3. Dual-Cost Estimation & Multi-Trade Quantity Surveying
- **Split Material & Labor Rates**: Configurable unit rates for all items across 7 construction divisions.
- **Commercial Markups & Financial Rollups**: Built-in logic for Company Overhead, Profit, Project Management, and Contingency percentages.
- **Jobsite Waste Factors**: Adjustable Waste/Scrap multipliers applied directly to base quantities prior to markup.
- **Precise Deduction Formulas**:
  - Net Wall Drywall & Paint: Subtracts door/window rough openings and deductions based on interior/exterior wall configurations.
  - Stud & Plate Framing: Bottom sole plates, top double plates, corner studs, partition junctions, and jack/king/header timber framing for all openings.
  - Concrete & Substructure: Slab volume ($V = A \times T$), continuous perimeter grade beams/footings, rebar linear feet, vapor barrier, and wire mesh.
  - Roofing Envelope: Pitch multiplier calculation ($\sqrt{1 + (P/12)^2}$), architectural shingles (bundles/squares), underlayment felt, drip edges, and ridge vents.
  - Finishes & Insulation: Batt insulation with opening deductions, finish flooring with configurable waste factors (default 10%), interior wall paint (2 coats @ 350 SF/gal), and ceiling drywall.
  - Electrical & Plumbing: Automated take-offs for fixtures, wiring homerun lengths, piping runs, and life safety devices.

### 4. Professional Export & Reporting Suite
- **Direct Client-Side PDF Generation**: High-resolution rasterization to multi-page vector-styled PDF via `jsPDF` and `html2canvas`—no physical printer connection required.
- **Executive HTML Take-Off & Specification Export**: Standalone formatted HTML document complete with company branding, CSI trade breakdowns, unit costs, and room finish schedules.
- **In-App Project Directory Manager**: Browser `localStorage` storage to save, duplicate, rename, auto-recover drafts, and export/import `.json` project bundles.
- **Persistent Company Branding**: Preserves firm name, logo (Base64 data URL), address, contact info, and lead estimator credentials across all sessions.

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
```bash
# Clone the repository and install dependencies
npm install
```

### Development
```bash
# Start local development server on port 3000
npm run dev
```

### Production Build
```bash
# Compile and build production bundle into dist/
npm run build

# Preview production build
npm run preview
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
| `Ctrl+Z` / `Cmd+Z` | Undo last action |
| `Ctrl+Y` / `Cmd+Y` | Redo last action |
| `Ctrl+S` / `Cmd+S` | Open Project Directory / Save Dialog |
| `Ctrl+P` / `Cmd+P` | Open Architectural Take-Off & PDF Report Modal |
| `Delete` / `Backspace` | Delete selected wall, aperture, stamp, deck, or annotation |
| `Shift` (Hold) | Toggle Orthogonal 90° Constraint while drafting walls |

---

## Technology Stack
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom slate CAD theme
- **Icons**: Lucide React
- **PDF Engine**: jsPDF & html2canvas
- **Data Persistence**: Browser localStorage with JSON export/import
