# Changelog

All notable changes, architectural updates, and QA fixes for **PlanarMTO** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
