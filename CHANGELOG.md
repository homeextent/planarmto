# Changelog

All notable changes, architectural updates, and QA fixes for **PlanarMTO** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
