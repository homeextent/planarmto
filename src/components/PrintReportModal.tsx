import React, { useRef, useState } from 'react';
import { FloorplanState, MTOReport, UnitCostRates } from '../types';
import { calculateEstimatedCost, DEFAULT_UNIT_COST_RATES } from '../engine/estimator';
import { getRoomCategory, ROOM_CATEGORIES } from '../engine/roomCategories';
import { generatePdfFromElement } from '../utils/pdfGenerator';
import {
  Printer,
  Download,
  X,
  Building,
  Layers,
  DollarSign,
  Calendar,
  CheckCircle2,
  MapPin,
  Phone,
  User,
  Palette,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: FloorplanState;
  mto: MTOReport;
  costRates?: UnitCostRates;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  state,
  mto,
  costRates = DEFAULT_UNIT_COST_RATES,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgressStatus, setPdfProgressStatus] = useState<string>('');

  if (!isOpen) return null;

  const activeRates = costRates || DEFAULT_UNIT_COST_RATES;
  const costAnalysis = calculateEstimatedCost(
    mto,
    activeRates,
    state.settings.categoryInclusions,
    state.settings.itemInclusions,
    state.settings
  );
  const printDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const branding = state.settings.companyBranding;
  const grossFootprint = mto.grossFootprintSf || mto.osbSubfloorDeckingSf || mto.flooringPackageSf || 0;
  const netConditioned = mto.netFloorAreaSf || mto.flooringPackageSf || 0;
  const firmTitle = branding?.companyName || 'PlanarMTO Construction Group';
  const jobRef = branding?.projectNumber || 'PRJ-2026-MTO';

  const generateFullReportHTML = () => {
    const r = activeRates;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${firmTitle} - Architectural Take-Off & Specification Report</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 28px auto;
      max-width: 1040px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.5;
      font-size: 12px;
      padding: 0 20px;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .company-logo {
      max-height: 52px;
      max-width: 220px;
      object-fit: contain;
      margin-bottom: 6px;
      display: block;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 2px 0;
    }
    .brand-subtitle {
      font-size: 12px;
      color: #475569;
      margin: 0;
      font-weight: 500;
    }
    .brand-meta {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
      line-height: 1.4;
    }
    .meta-box {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      color: #334155;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
      border-radius: 8px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    .kpi-title {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kpi-val {
      font-size: 18px;
      font-weight: 800;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
      color: #0f172a;
      margin-top: 3px;
    }
    .total-banner {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .total-banner-title {
      font-size: 12px;
      font-weight: 800;
      color: #166534;
      text-transform: uppercase;
    }
    .total-banner-val {
      font-size: 24px;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, monospace;
      color: #15803d;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e293b;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin: 24px 0 10px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .legend-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10.5px;
      font-weight: 600;
      color: #334155;
    }
    .legend-swatch {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      border: 1px solid rgba(0,0,0,0.15);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11.5px;
    }
    th {
      background: #f1f5f9;
      text-align: left;
      padding: 7px 10px;
      border-bottom: 1.5px solid #cbd5e1;
      font-weight: 700;
      font-size: 11px;
      color: #334155;
    }
    td {
      padding: 6px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    .num {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .category-row {
      background: #f8fafc;
      font-weight: 700;
      color: #0284c7;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
    }
    .total-row {
      font-weight: 800;
      background: #f1f5f9;
      border-top: 2px solid #94a3b8;
    }
    .grand-total-row {
      font-weight: 900;
      font-size: 13px;
      background: #e2e8f0;
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .footer-notes {
      font-size: 10.5px;
      color: #64748b;
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { margin: 10px; padding: 0; font-size: 10.5px; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      ${
        branding?.logoUrl
          ? `<img class="company-logo" src="${branding.logoUrl}" alt="${firmTitle}" />`
          : ''
      }
      <h1 class="brand-title">${firmTitle}</h1>
      <p class="brand-subtitle">Architectural Take-Off & Specification Schedule</p>
      <div class="brand-meta">
        ${branding?.address ? `<div><strong>Address:</strong> ${branding.address}</div>` : ''}
        ${branding?.contact ? `<div><strong>Contact:</strong> ${branding.contact}</div>` : ''}
        ${branding?.estimatorName ? `<div><strong>Lead Estimator:</strong> ${branding.estimatorName}</div>` : ''}
      </div>
    </div>
    <div class="meta-box">
      <div><strong>Date:</strong> ${printDate}</div>
      <div><strong>Job Ref:</strong> ${jobRef}</div>
      <div><strong>Units:</strong> ${state.settings.unitSystem.toUpperCase()}</div>
      <div><strong>Wall Height:</strong> ${state.settings.defaultWallHeight} ft | <strong>Slab:</strong> ${state.settings.slabThicknessInches}"</div>
      <div><strong>Calculation Mode:</strong> ${state.settings.calculationMode.replace(/_/g, ' ').toUpperCase()}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Gross Footprint</div>
      <div class="kpi-val">${grossFootprint} SF</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Conditioned Floor</div>
      <div class="kpi-val">${netConditioned} SF</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Material Subtotal</div>
      <div class="kpi-val">$${costAnalysis.materialSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Labor Subtotal</div>
      <div class="kpi-val">$${costAnalysis.laborSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    </div>
  </div>

  <div class="total-banner">
    <div>
      <div class="total-banner-title">Contractor Grand Total / Bid Price</div>
      <div style="font-size: 11px; color: #15803d; margin-top: 2px;">Includes Material/Labor Waste (${state.settings.wasteFactorPercentage}%), Indirects, Overhead & Profit</div>
    </div>
    <div class="total-banner-val">$${costAnalysis.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
  </div>

  <!-- Room Finish Schedule -->
  <div class="section-title">
    <span>1. Room Finish Schedule & Usage Mapping</span>
    <span style="font-size: 11px; font-weight: 600; color: #64748b;">${mto.roomDetails.length} Enclosed Spaces</span>
  </div>

  <!-- Color-coded usage legend -->
  <div class="legend-grid">
    ${Object.values(ROOM_CATEGORIES)
      .map(
        (cat) => `
      <div class="legend-item">
        <span class="legend-swatch" style="background-color: ${cat.color};"></span>
        <span>${cat.name}</span>
      </div>`
      )
      .join('')}
  </div>

  <table>
    <thead>
      <tr>
        <th>Room Label</th>
        <th>Category</th>
        <th>Floor Finish</th>
        <th class="num">Net Area</th>
        <th class="num">Perimeter</th>
        <th class="num">Baseboard LF</th>
        <th style="text-align: center;">Ceiling Drywall</th>
      </tr>
    </thead>
    <tbody>
      ${mto.roomDetails
        .map((rm) => {
          const cat = getRoomCategory(rm.name);
          const hasCeil = rm.hasCeilingDrywall !== false;
          return `
        <tr>
          <td><strong>${rm.name}</strong></td>
          <td>
            <span class="badge" style="background-color: ${cat.color}22; color: ${cat.color}; border: 1px solid ${cat.color}55;">
              ${cat.name}
            </span>
          </td>
          <td style="text-transform: capitalize;">${rm.floorFinish.replace(/_/g, ' ')}</td>
          <td class="num">${rm.area} SF</td>
          <td class="num">${rm.perimeter} LF</td>
          <td class="num">${rm.baseboardLf || rm.perimeter} LF</td>
          <td style="text-align: center; font-weight: 700; color: ${hasCeil ? '#166534' : '#991b1b'};">
            ${hasCeil ? 'Yes' : 'No'}
          </td>
        </tr>`;
        })
        .join('')}
    </tbody>
  </table>

  <!-- Master MTO Dual Cost Breakdown Schedule -->
  <div class="section-title">
    <span>2. Master Material & Labor Specification Schedule</span>
    <span style="font-size: 11px; font-weight: 600; color: #64748b;">7 Trade Packages</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item Description</th>
        <th class="num">Quantity</th>
        <th class="num">Unit</th>
        <th class="num">Mat. Rate</th>
        <th class="num">Labor Rate</th>
        <th class="num">Mat. Subtotal</th>
        <th class="num">Labor Subtotal</th>
        <th class="num">Installed Total</th>
      </tr>
    </thead>
    <tbody>
      <!-- Division 1 -->
      <tr class="category-row">
        <td colspan="8">1. Drywall, Paint & Architectural Finishes</td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Drywall Board (Walls + Ceilings)</td>
        <td class="num">${mto.drywallBoardSf}</td>
        <td class="num">SF</td>
        <td class="num">$${r.drywallPerSf.material.toFixed(2)}</td>
        <td class="num">$${r.drywallPerSf.labor.toFixed(2)}</td>
        <td class="num">$${(mto.drywallBoardSf * r.drywallPerSf.material).toFixed(2)}</td>
        <td class="num">$${(mto.drywallBoardSf * r.drywallPerSf.labor).toFixed(2)}</td>
        <td class="num"><strong>$${(mto.drywallBoardSf * (r.drywallPerSf.material + r.drywallPerSf.labor)).toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Interior Paint Coverage (2 Coats)</td>
        <td class="num">${mto.paintCoverageSf}</td>
        <td class="num">SF</td>
        <td class="num">$${r.paintPerSf.material.toFixed(2)}</td>
        <td class="num">$${r.paintPerSf.labor.toFixed(2)}</td>
        <td class="num">$${(mto.paintCoverageSf * r.paintPerSf.material).toFixed(2)}</td>
        <td class="num">$${(mto.paintCoverageSf * r.paintPerSf.labor).toFixed(2)}</td>
        <td class="num"><strong>$${(mto.paintCoverageSf * (r.paintPerSf.material + r.paintPerSf.labor)).toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Flooring Package (Hardwood, Tile, Carpet)</td>
        <td class="num">${mto.flooringPackageSf}</td>
        <td class="num">SF</td>
        <td class="num">$${r.flooringPerSf.material.toFixed(2)}</td>
        <td class="num">$${r.flooringPerSf.labor.toFixed(2)}</td>
        <td class="num">$${(mto.flooringPackageSf * r.flooringPerSf.material).toFixed(2)}</td>
        <td class="num">$${(mto.flooringPackageSf * r.flooringPerSf.labor).toFixed(2)}</td>
        <td class="num"><strong>$${(mto.flooringPackageSf * (r.flooringPerSf.material + r.flooringPerSf.labor)).toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Exterior Envelope Batt Insulation</td>
        <td class="num">${mto.extWallInsulationSf}</td>
        <td class="num">SF</td>
        <td class="num">$${r.extInsulationPerSf.material.toFixed(2)}</td>
        <td class="num">$${r.extInsulationPerSf.labor.toFixed(2)}</td>
        <td class="num">$${(mto.extWallInsulationSf * r.extInsulationPerSf.material).toFixed(2)}</td>
        <td class="num">$${(mto.extWallInsulationSf * r.extInsulationPerSf.labor).toFixed(2)}</td>
        <td class="num"><strong>$${(mto.extWallInsulationSf * (r.extInsulationPerSf.material + r.extInsulationPerSf.labor)).toFixed(2)}</strong></td>
      </tr>

      <!-- Division 2 -->
      <tr class="category-row">
        <td colspan="8">2. Carpentry & Structural Framing</td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Wall Stud Framing (${mto.wallStudCount} studs)</td>
        <td class="num">${mto.wallStudFramingLf}</td>
        <td class="num">LF</td>
        <td class="num">$${r.studFramingPerLf.material.toFixed(2)}</td>
        <td class="num">$${r.studFramingPerLf.labor.toFixed(2)}</td>
        <td class="num">$${(mto.wallStudFramingLf * r.studFramingPerLf.material).toFixed(2)}</td>
        <td class="num">$${(mto.wallStudFramingLf * r.studFramingPerLf.labor).toFixed(2)}</td>
        <td class="num"><strong>$${(mto.wallStudFramingLf * (r.studFramingPerLf.material + r.studFramingPerLf.labor)).toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">OSB Subfloor Decking (3/4" T&G)</td>
        <td class="num">${mto.osbSubfloorDeckingSf}</td>
        <td class="num">SF</td>
        <td class="num">$${r.osbSubfloorPerSf.material.toFixed(2)}</td>
        <td class="num">$${r.osbSubfloorPerSf.labor.toFixed(2)}</td>
        <td class="num">$${(mto.osbSubfloorDeckingSf * r.osbSubfloorPerSf.material).toFixed(2)}</td>
        <td class="num">$${(mto.osbSubfloorDeckingSf * r.osbSubfloorPerSf.labor).toFixed(2)}</td>
        <td class="num"><strong>$${(mto.osbSubfloorDeckingSf * (r.osbSubfloorPerSf.material + r.osbSubfloorPerSf.labor)).toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Baseboard & Aperture Casing Trims</td>
        <td class="num">${mto.baseboardTrimsLf + mto.apertureCasingLf}</td>
        <td class="num">LF</td>
        <td class="num">$${r.baseboardPerLf.material.toFixed(2)}</td>
        <td class="num">$${r.baseboardPerLf.labor.toFixed(2)}</td>
        <td class="num">$${((mto.baseboardTrimsLf + mto.apertureCasingLf) * r.baseboardPerLf.material).toFixed(2)}</td>
        <td class="num">$${((mto.baseboardTrimsLf + mto.apertureCasingLf) * r.baseboardPerLf.labor).toFixed(2)}</td>
        <td class="num"><strong>$${(((mto.baseboardTrimsLf + mto.apertureCasingLf) * (r.baseboardPerLf.material + r.baseboardPerLf.labor))).toFixed(2)}</strong></td>
      </tr>

      <!-- Division 3 -->
      <tr class="category-row">
        <td colspan="8">3. Fenestration & Enclosure Apertures</td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Standard Double-Glazed Windows</td>
        <td class="num">${mto.totalWindowsUnits}</td>
        <td class="num">UNITS</td>
        <td class="num">$${r.windowPerUnit.material.toFixed(2)}</td>
        <td class="num">$${r.windowPerUnit.labor.toFixed(2)}</td>
        <td class="num">$${(mto.totalWindowsUnits * r.windowPerUnit.material).toFixed(2)}</td>
        <td class="num">$${(mto.totalWindowsUnits * r.windowPerUnit.labor).toFixed(2)}</td>
        <td class="num"><strong>$${(mto.totalWindowsUnits * (r.windowPerUnit.material + r.windowPerUnit.labor)).toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Interior Passage Doors</td>
        <td class="num">${mto.passageDoorsUnits}</td>
        <td class="num">UNITS</td>
        <td class="num">$${r.passageDoorPerUnit.material.toFixed(2)}</td>
        <td class="num">$${r.passageDoorPerUnit.labor.toFixed(2)}</td>
        <td class="num">$${(mto.passageDoorsUnits * r.passageDoorPerUnit.material).toFixed(2)}</td>
        <td class="num">$${(mto.passageDoorsUnits * r.passageDoorPerUnit.labor).toFixed(2)}</td>
        <td class="num"><strong>$${(mto.passageDoorsUnits * (r.passageDoorPerUnit.material + r.passageDoorPerUnit.labor)).toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Pocket / Sliding Doors</td>
        <td class="num">${mto.pocketDoorsUnits}</td>
        <td class="num">UNITS</td>
        <td class="num">$${r.pocketDoorPerUnit.material.toFixed(2)}</td>
        <td class="num">$${r.pocketDoorPerUnit.labor.toFixed(2)}</td>
        <td class="num">$${(mto.pocketDoorsUnits * r.pocketDoorPerUnit.material).toFixed(2)}</td>
        <td class="num">$${(mto.pocketDoorsUnits * r.pocketDoorPerUnit.labor).toFixed(2)}</td>
        <td class="num"><strong>$${(mto.pocketDoorsUnits * (r.pocketDoorPerUnit.material + r.pocketDoorPerUnit.labor)).toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Exterior Entry & Security Doors</td>
        <td class="num">${mto.exteriorDoorsUnits}</td>
        <td class="num">UNITS</td>
        <td class="num">$${r.exteriorDoorPerUnit.material.toFixed(2)}</td>
        <td class="num">$${r.exteriorDoorPerUnit.labor.toFixed(2)}</td>
        <td class="num">$${(mto.exteriorDoorsUnits * r.exteriorDoorPerUnit.material).toFixed(2)}</td>
        <td class="num">$${(mto.exteriorDoorsUnits * r.exteriorDoorPerUnit.labor).toFixed(2)}</td>
        <td class="num"><strong>$${(mto.exteriorDoorsUnits * (r.exteriorDoorPerUnit.material + r.exteriorDoorPerUnit.labor)).toFixed(2)}</strong></td>
      </tr>

      <!-- Division 4 & 5 -->
      <tr class="category-row">
        <td colspan="8">4 & 5. MEP, Electrical, Safety & Plumbing</td>
      </tr>
      ${[
        { name: 'Standard Switches', qty: mto.stdSwitchesUnits, unit: 'UNITS', mat: r.switchPerUnit.material, lab: r.switchPerUnit.labor, inc: state.settings.itemInclusions?.stdSwitches },
        { name: 'Dimmers', qty: mto.dimmersUnits, unit: 'UNITS', mat: r.switchPerUnit.material * 1.5, lab: r.switchPerUnit.labor * 1.2, inc: state.settings.itemInclusions?.dimmers },
        { name: '3-Way Switches', qty: mto.switch3WayUnits, unit: 'UNITS', mat: r.switch3Way.material, lab: r.switch3Way.labor, inc: state.settings.itemInclusions?.switch3Way },
        { name: 'Standard 120V Outlets', qty: mto.stdOutletsUnits, unit: 'UNITS', mat: r.outletPerUnit.material, lab: r.outletPerUnit.labor, inc: state.settings.itemInclusions?.stdOutlets },
        { name: 'GFCI Outlets', qty: mto.gfciOutletsUnits, unit: 'UNITS', mat: r.gfciPerUnit.material, lab: r.gfciPerUnit.labor, inc: state.settings.itemInclusions?.gfciOutlets },
        { name: '240V Heavy Outlets', qty: mto.heavyOutlets24vUnits, unit: 'UNITS', mat: r.outletPerUnit.material * 2.5, lab: r.outletPerUnit.labor * 1.8, inc: state.settings.itemInclusions?.heavyOutlets24v },
        { name: 'EV Level 2 Chargers', qty: mto.evChargersUnits, unit: 'UNITS', mat: r.evChargerPerUnit.material, lab: r.evChargerPerUnit.labor, inc: state.settings.itemInclusions?.evChargers },
        { name: 'Potlights', qty: mto.potlightsUnits, unit: 'UNITS', mat: r.potlightPerUnit.material, lab: r.potlightPerUnit.labor, inc: state.settings.itemInclusions?.potlights },
        { name: 'Sconces / Fixtures', qty: mto.fixturesSconcesUnits, unit: 'UNITS', mat: r.fixtureSconce.material, lab: r.fixtureSconce.labor, inc: state.settings.itemInclusions?.fixturesSconces },
        { name: 'Exterior Coach Lights', qty: mto.exteriorCoachLightsUnits, unit: 'UNITS', mat: r.exteriorCoachLight.material, lab: r.exteriorCoachLight.labor, inc: state.settings.itemInclusions?.exteriorCoachLights },
        { name: 'Soffit Lights', qty: mto.soffitLightsUnits, unit: 'UNITS', mat: r.soffitLight.material, lab: r.soffitLight.labor, inc: state.settings.itemInclusions?.soffitLights },
        { name: 'Ceiling Fans', qty: mto.ceilingFansUnits, unit: 'UNITS', mat: r.ceilingFanPerUnit.material, lab: r.ceilingFanPerUnit.labor, inc: state.settings.itemInclusions?.ceilingFans },
        { name: 'Exhaust Fans', qty: mto.spotExhaustFansUnits, unit: 'UNITS', mat: r.exhaustFanPerUnit.material, lab: r.exhaustFanPerUnit.labor, inc: state.settings.itemInclusions?.spotExhaustFans },
        { name: 'Range Hoods', qty: mto.rangeHoodsUnits, unit: 'UNITS', mat: r.rangeHoodPerUnit.material, lab: r.rangeHoodPerUnit.labor, inc: state.settings.itemInclusions?.rangeHoods },
        { name: 'Smoke Alarms', qty: mto.smokeCoAlarmsUnits, unit: 'UNITS', mat: r.smokeAlarmPerUnit.material, lab: r.smokeAlarmPerUnit.labor, inc: state.settings.itemInclusions?.smokeCoAlarms },
        ...mto.panelBreakdown.map(p => {
          let rateKey: keyof UnitCostRates = 'electricalPanelMain200A';
          if (p.type === 'main') {
            if (p.amperage === '100A') rateKey = 'electricalPanelMain100A';
            else if (p.amperage === '400A') rateKey = 'electricalPanelMain400A';
            else rateKey = 'electricalPanelMain200A';
          } else {
            if (p.amperage === '60A') rateKey = 'electricalPanelSub60A';
            else if (p.amperage === '125A') rateKey = 'electricalPanelSub125A';
            else rateKey = 'electricalPanelSub100A';
          }
          const rate = r[rateKey];
          return { name: `Electrical ${p.type === 'main' ? 'Main Panel' : 'Subpanel'} - ${p.amperage}`, qty: p.count, unit: 'UNITS', mat: rate.material, lab: rate.labor, inc: state.settings.itemInclusions?.electricalPanels };
        })
      ]
        .filter(item => item.qty > 0 && item.inc !== false)
        .map(item => `
      <tr>
        <td style="padding-left: 18px;">${item.name}</td>
        <td class="num">${item.qty}</td>
        <td class="num">${item.unit}</td>
        <td class="num">$${item.mat.toFixed(2)}</td>
        <td class="num">$${item.lab.toFixed(2)}</td>
        <td class="num">$${(item.qty * item.mat * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2)}</td>
        <td class="num">$${(item.qty * item.lab * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2)}</td>
        <td class="num"><strong>$${(item.qty * (item.mat + item.lab) * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2)}</strong></td>
      </tr>`).join('')}
      <tr>
        <td style="padding-left: 18px;">Plumbing Fixtures, Drains & Civil Trenching</td>
        <td class="num">${mto.plumbingFixturesUnits}</td>
        <td class="num">FIXTURES</td>
        <td class="num">$${r.plumbingPerFixture.material.toFixed(2)}</td>
        <td class="num">$${r.plumbingPerFixture.labor.toFixed(2)}</td>
        <td class="num">$${costAnalysis.categoryBreakdown.plumbingCivil.material.toFixed(2)}</td>
        <td class="num">$${costAnalysis.categoryBreakdown.plumbingCivil.labor.toFixed(2)}</td>
        <td class="num"><strong>$${costAnalysis.subtotals.plumbingCivil.toFixed(2)}</strong></td>
      </tr>

      <!-- Division 6 & 7 -->
      <tr class="category-row">
        <td colspan="8">6 & 7. Concrete Foundations, Roofing & Envelope</td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Poured Concrete Slab & Footings</td>
        <td class="num">${mto.pouredConcreteCy}</td>
        <td class="num">CY</td>
        <td class="num">$${r.concretePerCy.material.toFixed(2)}</td>
        <td class="num">$${r.concretePerCy.labor.toFixed(2)}</td>
        <td class="num">$${costAnalysis.categoryBreakdown.concreteFoundations.material.toFixed(2)}</td>
        <td class="num">$${costAnalysis.categoryBreakdown.concreteFoundations.labor.toFixed(2)}</td>
        <td class="num"><strong>$${costAnalysis.subtotals.concreteFoundations.toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding-left: 18px;">Roofing Surface & Siding Envelope</td>
        <td class="num">${mto.roofingAreaSq} SQ</td>
        <td class="num">ENVELOPE</td>
        <td class="num">$${r.roofingPerSq.material.toFixed(2)}</td>
        <td class="num">$${r.roofingPerSq.labor.toFixed(2)}</td>
        <td class="num">$${costAnalysis.categoryBreakdown.roofingEnvelope.material.toFixed(2)}</td>
        <td class="num">$${costAnalysis.categoryBreakdown.roofingEnvelope.labor.toFixed(2)}</td>
        <td class="num"><strong>$${costAnalysis.subtotals.roofingEnvelope.toFixed(2)}</strong></td>
      </tr>

      <!-- Totals -->
      <tr class="total-row">
        <td colspan="5">MATERIAL DIRECT COST SUBTOTAL (w/ Waste)</td>
        <td class="num" colspan="3">$${costAnalysis.materialSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
      <tr class="total-row">
        <td colspan="5">LABOR INSTALLATION COST SUBTOTAL (w/ Waste)</td>
        <td class="num" colspan="3">$${costAnalysis.laborSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
      <tr class="total-row">
        <td colspan="5">BASE DIRECT COST (Material + Labor)</td>
        <td class="num" colspan="3">$${costAnalysis.baseDirectCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
      <tr class="total-row">
        <td colspan="5">PROJECT MANAGEMENT (${state.settings.projectManagementPercentage}%) + CONTINGENCY (${state.settings.projectContingencyPercentage}%)</td>
        <td class="num" colspan="3">$${(costAnalysis.indirectProjectManagement + costAnalysis.indirectContingency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
      <tr class="total-row">
        <td colspan="5">OVERHEAD (${state.settings.overheadPercentage}%) + PROFIT (${state.settings.profitPercentage}%)</td>
        <td class="num" colspan="3">$${(costAnalysis.grossMarginOverhead + costAnalysis.grossMarginProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
      <tr class="grand-total-row">
        <td colspan="5">CONTRACTOR GRAND TOTAL / BID PRICE</td>
        <td class="num" colspan="3" style="color: #15803d;">$${costAnalysis.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-notes">
    <div><strong>Generated via:</strong> Planar Straight-Line Graph (PSLG) Algorithmic Engine</div>
    <div>${firmTitle}</div>
  </div>
</body>
</html>`;
  };

  /**
   * Generates and downloads a real, multi-page vector/raster PDF directly on the client.
   */
  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    setPdfProgressStatus('Initializing high-resolution PDF renderer...');

    try {
      const firmSlug = firmTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${firmSlug}_TakeOff_Report_${jobRef}_${new Date().toISOString().slice(0, 10)}.pdf`;

      await generatePdfFromElement(reportRef.current, {
        fileName,
        onProgress: (status) => setPdfProgressStatus(status),
      });
    } catch (err) {
      console.error('PDF Generation error, attempting print dialog fallback:', err);
      handlePrintDialog();
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgressStatus('');
    }
  };

  /**
   * Browser Print Dialog fallback
   */
  const handlePrintDialog = () => {
    try {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const doc = printFrame.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(generateFullReportHTML());
        doc.close();
        printFrame.contentWindow?.focus();
        setTimeout(() => {
          try {
            printFrame.contentWindow?.print();
          } catch (e) {
            window.print();
          }
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
          }, 2000);
        }, 400);
      } else {
        window.print();
      }
    } catch (err) {
      console.warn('Iframe print error, invoking direct window.print:', err);
      window.print();
    }
  };

  const handleExportHTML = () => {
    const reportHtml = generateFullReportHTML();
    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const firmSlug = firmTitle.replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `${firmSlug}_TakeOff_Report_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const r = activeRates;
    const rows = [
      ['Firm / Contractor', firmTitle],
      ['Address', branding?.address || '-'],
      ['Contact', branding?.contact || '-'],
      ['Lead Estimator', branding?.estimatorName || '-'],
      ['Job Reference', jobRef],
      ['Generated Date', printDate],
      ['Units', state.settings.unitSystem.toUpperCase()],
      ['Default Wall Height', `${state.settings.defaultWallHeight} ft`],
      ['Total Footprint (Gross SF)', `${grossFootprint} SF`],
      ['Total Net Conditioned Area', `${netConditioned} SF`],
      ['Material Subtotal ($)', `$${costAnalysis.materialSubtotal.toFixed(2)}`],
      ['Labor Subtotal ($)', `$${costAnalysis.laborSubtotal.toFixed(2)}`],
      ['Grand Total Installed ($)', `$${costAnalysis.totalCost.toFixed(2)}`],
      [''],
      ['=== ROOM FINISH SCHEDULE ==='],
      ['Room ID', 'Room Name', 'Usage Category', 'Floor Finish', 'Net Area (SF)', 'Perimeter (LF)', 'Baseboard (LF)', 'Ceiling Drywall'],
      ...mto.roomDetails.map((rm) => [
        rm.roomId,
        rm.name,
        getRoomCategory(rm.name).name,
        rm.floorFinish,
        rm.area,
        rm.perimeter,
        rm.baseboardLf || rm.perimeter,
        rm.hasCeilingDrywall !== false ? 'Yes' : 'No',
      ]),
      [''],
      ['=== MASTER MATERIAL & LABOR ESTIMATE SCHEDULE ==='],
      [
        'Category',
        'Item Description',
        'Quantity',
        'Unit',
        'Material Rate ($)',
        'Labor Rate ($)',
        'Total Rate ($)',
        'Material Subtotal ($)',
        'Labor Subtotal ($)',
        'Line Total ($)',
      ],
      [
        '1. Board & Finishes',
        'Drywall Board (Walls + Ceilings)',
        mto.drywallBoardSf,
        'SF',
        r.drywallPerSf.material,
        r.drywallPerSf.labor,
        (r.drywallPerSf.material + r.drywallPerSf.labor).toFixed(2),
        (mto.drywallBoardSf * r.drywallPerSf.material).toFixed(2),
        (mto.drywallBoardSf * r.drywallPerSf.labor).toFixed(2),
        (mto.drywallBoardSf * (r.drywallPerSf.material + r.drywallPerSf.labor)).toFixed(2),
      ],
      [
        '1. Board & Finishes',
        'Interior Paint Coverage (2 Coats)',
        mto.paintCoverageSf,
        'SF',
        r.paintPerSf.material,
        r.paintPerSf.labor,
        (r.paintPerSf.material + r.paintPerSf.labor).toFixed(2),
        (mto.paintCoverageSf * r.paintPerSf.material).toFixed(2),
        (mto.paintCoverageSf * r.paintPerSf.labor).toFixed(2),
        (mto.paintCoverageSf * (r.paintPerSf.material + r.paintPerSf.labor)).toFixed(2),
      ],
      [
        '1. Board & Finishes',
        'Flooring Package',
        mto.flooringPackageSf,
        'SF',
        r.flooringPerSf.material,
        r.flooringPerSf.labor,
        (r.flooringPerSf.material + r.flooringPerSf.labor).toFixed(2),
        (mto.flooringPackageSf * r.flooringPerSf.material).toFixed(2),
        (mto.flooringPackageSf * r.flooringPerSf.labor).toFixed(2),
        (mto.flooringPackageSf * (r.flooringPerSf.material + r.flooringPerSf.labor)).toFixed(2),
      ],
      [
        '1. Board & Finishes',
        'Exterior Wall Insulation (R-20)',
        mto.extWallInsulationSf,
        'SF',
        r.extInsulationPerSf.material,
        r.extInsulationPerSf.labor,
        (r.extInsulationPerSf.material + r.extInsulationPerSf.labor).toFixed(2),
        (mto.extWallInsulationSf * r.extInsulationPerSf.material).toFixed(2),
        (mto.extWallInsulationSf * r.extInsulationPerSf.labor).toFixed(2),
        (mto.extWallInsulationSf * (r.extInsulationPerSf.material + r.extInsulationPerSf.labor)).toFixed(2),
      ],
      [
        '2. Framing & Carpentry',
        'Wall Stud Framing',
        mto.wallStudFramingLf,
        'LF',
        r.studFramingPerLf.material,
        r.studFramingPerLf.labor,
        (r.studFramingPerLf.material + r.studFramingPerLf.labor).toFixed(2),
        (mto.wallStudFramingLf * r.studFramingPerLf.material).toFixed(2),
        (mto.wallStudFramingLf * r.studFramingPerLf.labor).toFixed(2),
        (mto.wallStudFramingLf * (r.studFramingPerLf.material + r.studFramingPerLf.labor)).toFixed(2),
      ],
      [
        '2. Framing & Carpentry',
        'OSB Subfloor Decking',
        mto.osbSubfloorDeckingSf,
        'SF',
        r.osbSubfloorPerSf.material,
        r.osbSubfloorPerSf.labor,
        (r.osbSubfloorPerSf.material + r.osbSubfloorPerSf.labor).toFixed(2),
        (mto.osbSubfloorDeckingSf * r.osbSubfloorPerSf.material).toFixed(2),
        (mto.osbSubfloorDeckingSf * r.osbSubfloorPerSf.labor).toFixed(2),
        (mto.osbSubfloorDeckingSf * (r.osbSubfloorPerSf.material + r.osbSubfloorPerSf.labor)).toFixed(2),
      ],
      [
        '2. Framing & Carpentry',
        'Baseboard & Casing Trim',
        mto.baseboardTrimsLf + mto.apertureCasingLf,
        'LF',
        r.baseboardPerLf.material,
        r.baseboardPerLf.labor,
        (r.baseboardPerLf.material + r.baseboardPerLf.labor).toFixed(2),
        ((mto.baseboardTrimsLf + mto.apertureCasingLf) * r.baseboardPerLf.material).toFixed(2),
        ((mto.baseboardTrimsLf + mto.apertureCasingLf) * r.baseboardPerLf.labor).toFixed(2),
        (((mto.baseboardTrimsLf + mto.apertureCasingLf) * (r.baseboardPerLf.material + r.baseboardPerLf.labor))).toFixed(2),
      ],
      [
        '3. Fenestration',
        'Standard Windows',
        mto.totalWindowsUnits,
        'UNITS',
        r.windowPerUnit.material,
        r.windowPerUnit.labor,
        (r.windowPerUnit.material + r.windowPerUnit.labor).toFixed(2),
        (mto.totalWindowsUnits * r.windowPerUnit.material).toFixed(2),
        (mto.totalWindowsUnits * r.windowPerUnit.labor).toFixed(2),
        (mto.totalWindowsUnits * (r.windowPerUnit.material + r.windowPerUnit.labor)).toFixed(2),
      ],
      [
        '3. Fenestration',
        'Passage Interior Doors',
        mto.passageDoorsUnits,
        'UNITS',
        r.passageDoorPerUnit.material,
        r.passageDoorPerUnit.labor,
        (r.passageDoorPerUnit.material + r.passageDoorPerUnit.labor).toFixed(2),
        (mto.passageDoorsUnits * r.passageDoorPerUnit.material).toFixed(2),
        (mto.passageDoorsUnits * r.passageDoorPerUnit.labor).toFixed(2),
        (mto.passageDoorsUnits * (r.passageDoorPerUnit.material + r.passageDoorPerUnit.labor)).toFixed(2),
      ],
      [
        '3. Fenestration',
        'Pocket Doors',
        mto.pocketDoorsUnits,
        'UNITS',
        r.pocketDoorPerUnit.material,
        r.pocketDoorPerUnit.labor,
        (r.pocketDoorPerUnit.material + r.pocketDoorPerUnit.labor).toFixed(2),
        (mto.pocketDoorsUnits * r.pocketDoorPerUnit.material).toFixed(2),
        (mto.pocketDoorsUnits * r.pocketDoorPerUnit.labor).toFixed(2),
        (mto.pocketDoorsUnits * (r.pocketDoorPerUnit.material + r.pocketDoorPerUnit.labor)).toFixed(2),
      ],
      [
        '3. Fenestration',
        'Exterior Entry Doors',
        mto.exteriorDoorsUnits,
        'UNITS',
        r.exteriorDoorPerUnit.material,
        r.exteriorDoorPerUnit.labor,
        (r.exteriorDoorPerUnit.material + r.exteriorDoorPerUnit.labor).toFixed(2),
        (mto.exteriorDoorsUnits * r.exteriorDoorPerUnit.material).toFixed(2),
        (mto.exteriorDoorsUnits * r.exteriorDoorPerUnit.labor).toFixed(2),
        (mto.exteriorDoorsUnits * (r.exteriorDoorPerUnit.material + r.exteriorDoorPerUnit.labor)).toFixed(2),
      ],
      ...[
        { name: 'Standard Switches', qty: mto.stdSwitchesUnits, unit: 'UNITS', mat: r.switchPerUnit.material, lab: r.switchPerUnit.labor, inc: state.settings.itemInclusions?.stdSwitches },
        { name: 'Dimmers', qty: mto.dimmersUnits, unit: 'UNITS', mat: r.switchPerUnit.material * 1.5, lab: r.switchPerUnit.labor * 1.2, inc: state.settings.itemInclusions?.dimmers },
        { name: '3-Way Switches', qty: mto.switch3WayUnits, unit: 'UNITS', mat: r.switch3Way.material, lab: r.switch3Way.labor, inc: state.settings.itemInclusions?.switch3Way },
        { name: 'Standard 120V Outlets', qty: mto.stdOutletsUnits, unit: 'UNITS', mat: r.outletPerUnit.material, lab: r.outletPerUnit.labor, inc: state.settings.itemInclusions?.stdOutlets },
        { name: 'GFCI Outlets', qty: mto.gfciOutletsUnits, unit: 'UNITS', mat: r.gfciPerUnit.material, lab: r.gfciPerUnit.labor, inc: state.settings.itemInclusions?.gfciOutlets },
        { name: '240V Heavy Outlets', qty: mto.heavyOutlets24vUnits, unit: 'UNITS', mat: r.outletPerUnit.material * 2.5, lab: r.outletPerUnit.labor * 1.8, inc: state.settings.itemInclusions?.heavyOutlets24v },
        { name: 'EV Level 2 Chargers', qty: mto.evChargersUnits, unit: 'UNITS', mat: r.evChargerPerUnit.material, lab: r.evChargerPerUnit.labor, inc: state.settings.itemInclusions?.evChargers },
        { name: 'Potlights', qty: mto.potlightsUnits, unit: 'UNITS', mat: r.potlightPerUnit.material, lab: r.potlightPerUnit.labor, inc: state.settings.itemInclusions?.potlights },
        { name: 'Sconces / Fixtures', qty: mto.fixturesSconcesUnits, unit: 'UNITS', mat: r.fixtureSconce.material, lab: r.fixtureSconce.labor, inc: state.settings.itemInclusions?.fixturesSconces },
        { name: 'Exterior Coach Lights', qty: mto.exteriorCoachLightsUnits, unit: 'UNITS', mat: r.exteriorCoachLight.material, lab: r.exteriorCoachLight.labor, inc: state.settings.itemInclusions?.exteriorCoachLights },
        { name: 'Soffit Lights', qty: mto.soffitLightsUnits, unit: 'UNITS', mat: r.soffitLight.material, lab: r.soffitLight.labor, inc: state.settings.itemInclusions?.soffitLights },
        { name: 'Ceiling Fans', qty: mto.ceilingFansUnits, unit: 'UNITS', mat: r.ceilingFanPerUnit.material, lab: r.ceilingFanPerUnit.labor, inc: state.settings.itemInclusions?.ceilingFans },
        { name: 'Exhaust Fans', qty: mto.spotExhaustFansUnits, unit: 'UNITS', mat: r.exhaustFanPerUnit.material, lab: r.exhaustFanPerUnit.labor, inc: state.settings.itemInclusions?.spotExhaustFans },
        { name: 'Range Hoods', qty: mto.rangeHoodsUnits, unit: 'UNITS', mat: r.rangeHoodPerUnit.material, lab: r.rangeHoodPerUnit.labor, inc: state.settings.itemInclusions?.rangeHoods },
        { name: 'Smoke Alarms', qty: mto.smokeCoAlarmsUnits, unit: 'UNITS', mat: r.smokeAlarmPerUnit.material, lab: r.smokeAlarmPerUnit.labor, inc: state.settings.itemInclusions?.smokeCoAlarms },
        ...mto.panelBreakdown.map(p => {
          let rateKey: keyof UnitCostRates = 'electricalPanelMain200A';
          if (p.type === 'main') {
            if (p.amperage === '100A') rateKey = 'electricalPanelMain100A';
            else if (p.amperage === '400A') rateKey = 'electricalPanelMain400A';
            else rateKey = 'electricalPanelMain200A';
          } else {
            if (p.amperage === '60A') rateKey = 'electricalPanelSub60A';
            else if (p.amperage === '125A') rateKey = 'electricalPanelSub125A';
            else rateKey = 'electricalPanelSub100A';
          }
          const rate = r[rateKey];
          return { name: `Electrical ${p.type === 'main' ? 'Main Panel' : 'Subpanel'} - ${p.amperage}`, qty: p.count, unit: 'UNITS', mat: rate.material, lab: rate.labor, inc: state.settings.itemInclusions?.electricalPanels };
        })
      ].filter(item => item.qty > 0 && item.inc !== false).map(item => [
        '4. Electrical & Safety',
        item.name,
        item.qty,
        item.unit,
        item.mat.toFixed(2),
        item.lab.toFixed(2),
        (item.mat + item.lab).toFixed(2),
        (item.qty * item.mat * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
        (item.qty * item.lab * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
        (item.qty * (item.mat + item.lab) * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
      ]),
      [
        '5. Plumbing & Civil',
        'Plumbing Fixtures & Civil Trenching',
        mto.plumbingFixturesUnits,
        'FIXTURES',
        r.plumbingPerFixture.material,
        r.plumbingPerFixture.labor,
        (r.plumbingPerFixture.material + r.plumbingPerFixture.labor).toFixed(2),
        costAnalysis.categoryBreakdown.plumbingCivil.material.toFixed(2),
        costAnalysis.categoryBreakdown.plumbingCivil.labor.toFixed(2),
        costAnalysis.subtotals.plumbingCivil.toFixed(2),
      ],
      [
        '6. Concrete & Foundations',
        'Poured Concrete Slab & Footings',
        mto.pouredConcreteCy,
        'CY',
        r.concretePerCy.material,
        r.concretePerCy.labor,
        (r.concretePerCy.material + r.concretePerCy.labor).toFixed(2),
        costAnalysis.categoryBreakdown.concreteFoundations.material.toFixed(2),
        costAnalysis.categoryBreakdown.concreteFoundations.labor.toFixed(2),
        costAnalysis.subtotals.concreteFoundations.toFixed(2),
      ],
      [
        '7. Roofing & Envelope',
        'Roofing, Siding & Exterior Decks',
        mto.roofingAreaSq,
        'SQ',
        r.roofingPerSq.material,
        r.roofingPerSq.labor,
        (r.roofingPerSq.material + r.roofingPerSq.labor).toFixed(2),
        costAnalysis.categoryBreakdown.roofingEnvelope.material.toFixed(2),
        costAnalysis.categoryBreakdown.roofingEnvelope.labor.toFixed(2),
        costAnalysis.subtotals.roofingEnvelope.toFixed(2),
      ],
      ['', 'MATERIAL SUBTOTAL', '', '', '', '', '', `$${costAnalysis.materialSubtotal.toFixed(2)}`, '', ''],
      ['', 'LABOR SUBTOTAL', '', '', '', '', '', '', `$${costAnalysis.laborSubtotal.toFixed(2)}`, ''],
      ['', 'ESTIMATED GRAND TOTAL', '', '', '', '', '', '', '', `$${costAnalysis.totalCost.toFixed(2)}`],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const firmSlug = firmTitle.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `${firmSlug}_TakeOff_Contractor_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-auto print:m-0 print:border-none print:shadow-none print:w-full print:max-w-none print:bg-white print:text-black">
        {/* Modal Header Controls */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Architectural Take-Off & Specification Report
              </h2>
              <p className="text-[11px] text-slate-400">
                Dual Material & Labor Schedules with Company Branding
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
              title="Download spreadsheet CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportHTML}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
              title="Download standalone printable HTML file"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>HTML Doc</span>
            </button>
            <button
              onClick={handlePrintDialog}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
              title="Open browser print dialog"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Print Dialog</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-600/30 cursor-pointer transition-all disabled:cursor-not-allowed"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download / Save PDF</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Generation Status Banner */}
        {isGeneratingPdf && (
          <div className="bg-sky-950/60 border-b border-sky-500/30 px-4 py-2 flex items-center justify-between text-xs text-sky-200">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              <span>{pdfProgressStatus || 'Generating high-resolution multi-page PDF...'}</span>
            </div>
            <span className="text-[10px] text-sky-400/80 uppercase font-mono tracking-wider">
              Rasterizing Canvas & Pages
            </span>
          </div>
        )}

        {/* Printable Document Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 print:text-black bg-slate-900">
          <div
            ref={reportRef}
            className="p-6 bg-slate-950/90 text-slate-100 rounded-xl border border-slate-800 space-y-6 shadow-inner"
          >
            {/* Document Header & Company Branding */}
            <div className="border-b border-slate-800 pb-4 flex justify-between items-start">
              <div className="space-y-1">
                {branding?.logoUrl ? (
                  <div className="h-12 max-w-[220px] mb-2">
                    <img
                      src={branding.logoUrl}
                      alt={firmTitle}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-sky-400" />
                  <h1 className="text-lg font-bold text-slate-100">
                    {firmTitle}
                  </h1>
                </div>
                <p className="text-xs text-slate-400">
                  Planar Straight-Line Graph (PSLG) Material Quantity Take-Off & Costing Schedule
                </p>
                {branding && (branding.address || branding.contact || branding.estimatorName) && (
                  <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
                    {branding.address && (
                      <div>
                        <MapPin className="w-3 h-3 inline mr-1 text-slate-500" />
                        {branding.address}
                      </div>
                    )}
                    {branding.contact && (
                      <div>
                        <Phone className="w-3 h-3 inline mr-1 text-slate-500" />
                        {branding.contact}
                      </div>
                    )}
                    {branding.estimatorName && (
                      <div>
                        <User className="w-3 h-3 inline mr-1 text-slate-500" />
                        Lead Estimator: {branding.estimatorName}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right text-xs text-slate-400 space-y-0.5 font-mono">
                <div className="flex items-center gap-1.5 justify-end text-slate-300 font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  <span>{printDate}</span>
                </div>
                <div>Job Ref: <span className="text-sky-300 font-bold">{jobRef}</span></div>
                <div>Units: {state.settings.unitSystem.toUpperCase()}</div>
                <div>Wall H: {state.settings.defaultWallHeight} ft | Slab: {state.settings.slabThicknessInches}"</div>
                <div>Mode: {state.settings.calculationMode.replace(/_/g, ' ').toUpperCase()}</div>
              </div>
            </div>

            {/* Project Footprint KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  Gross Footprint
                </div>
                <div className="text-base font-bold font-mono text-emerald-400">
                  {grossFootprint} SF
                </div>
                <div className="text-[10px] text-slate-500">Outer envelope area</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  Conditioned Floor
                </div>
                <div className="text-base font-bold font-mono text-sky-400">
                  {netConditioned} SF
                </div>
                <div className="text-[10px] text-slate-500">{mto.roomDetails.length} detected rooms</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-emerald-400">
                  Material Subtotal
                </div>
                <div className="text-base font-bold font-mono text-emerald-400">
                  ${costAnalysis.materialSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-500">Materials only</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-sky-400">
                  Labor Subtotal
                </div>
                <div className="text-base font-bold font-mono text-sky-400">
                  ${costAnalysis.laborSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-500">Trade installation</div>
              </div>
            </div>

            {/* Grand Installed Total Callout Banner */}
            <div className="bg-emerald-950/20 border border-emerald-500/30 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide font-bold text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Total Installed Project Cost
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Includes all materials, carpentry framing, fenestration, MEP, concrete, and envelope trade labor
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">
                ${costAnalysis.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Room Schedule Table & Usage Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  1. Room Finish Schedule & Usage Categorization
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {mto.roomDetails.length} Rooms
                </span>
              </div>

              {/* Color Key Legend */}
              <div className="mb-3 p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center gap-3 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Palette className="w-3 h-3 text-sky-400" />
                  Usage Key:
                </span>
                {Object.values(ROOM_CATEGORIES).map((cat) => (
                  <div key={cat.id} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/30 shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-slate-300">{cat.name}</span>
                  </div>
                ))}
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 font-semibold">
                      <th className="p-2.5">Room Label</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Floor Finish</th>
                      <th className="p-2.5 text-right">Net Area</th>
                      <th className="p-2.5 text-right">Perimeter</th>
                      <th className="p-2.5 text-right">Baseboard LF</th>
                      <th className="p-2.5 text-center">Ceiling Drywall</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {mto.roomDetails.map((rm) => {
                      const cat = getRoomCategory(rm.name);
                      const hasCeil = rm.hasCeilingDrywall !== false;
                      return (
                        <tr key={rm.roomId} className="hover:bg-slate-900/50">
                          <td className="p-2.5 font-semibold text-slate-200 flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span>{rm.name}</span>
                          </td>
                          <td className="p-2.5">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{
                                backgroundColor: `${cat.color}22`,
                                color: cat.color,
                                border: `1px solid ${cat.color}44`,
                              }}
                            >
                              {cat.name}
                            </span>
                          </td>
                          <td className="p-2.5 capitalize text-slate-400">
                            {rm.floorFinish.replace(/_/g, ' ')}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-400 font-semibold">
                            {rm.area} SF
                          </td>
                          <td className="p-2.5 text-right font-mono text-sky-400">
                            {rm.perimeter} LF
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-300">
                            {rm.baseboardLf || rm.perimeter} LF
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                hasCeil
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
                              }`}
                            >
                              {hasCeil ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Master 7-Division Take-Off Matrix with Material and Labor Split */}
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                2. Master Material Take-Off Matrix & Costing Breakdown
              </h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 font-semibold">
                      <th className="p-2.5">Item Description</th>
                      <th className="p-2.5 text-right">Quantity</th>
                      <th className="p-2.5">Unit</th>
                      <th className="p-2.5 text-right">Mat. Rate</th>
                      <th className="p-2.5 text-right">Labor Rate</th>
                      <th className="p-2.5 text-right">Mat. Subtotal</th>
                      <th className="p-2.5 text-right">Labor Subtotal</th>
                      <th className="p-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {/* Division 1 */}
                    <tr className="bg-slate-900/60 font-bold text-sky-300">
                      <td colSpan={8} className="p-2">1. Drywall, Paint & Finishes</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Drywall Board (Walls + Ceilings)</td>
                      <td className="p-2 text-right font-mono">{mto.drywallBoardSf}</td>
                      <td className="p-2 text-slate-400">SF</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.drywallPerSf.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.drywallPerSf.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${(mto.drywallBoardSf * activeRates.drywallPerSf.material).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${(mto.drywallBoardSf * activeRates.drywallPerSf.labor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${(mto.drywallBoardSf * (activeRates.drywallPerSf.material + activeRates.drywallPerSf.labor)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Interior Paint (2 Coats)</td>
                      <td className="p-2 text-right font-mono">{mto.paintCoverageSf}</td>
                      <td className="p-2 text-slate-400">SF</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.paintPerSf.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.paintPerSf.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${(mto.paintCoverageSf * activeRates.paintPerSf.material).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${(mto.paintCoverageSf * activeRates.paintPerSf.labor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${(mto.paintCoverageSf * (activeRates.paintPerSf.material + activeRates.paintPerSf.labor)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Flooring Package</td>
                      <td className="p-2 text-right font-mono">{mto.flooringPackageSf}</td>
                      <td className="p-2 text-slate-400">SF</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.flooringPerSf.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.flooringPerSf.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${(mto.flooringPackageSf * activeRates.flooringPerSf.material).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${(mto.flooringPackageSf * activeRates.flooringPerSf.labor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${(mto.flooringPackageSf * (activeRates.flooringPerSf.material + activeRates.flooringPerSf.labor)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Exterior Wall Batt Insulation</td>
                      <td className="p-2 text-right font-mono">{mto.extWallInsulationSf}</td>
                      <td className="p-2 text-slate-400">SF</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.extInsulationPerSf.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.extInsulationPerSf.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${(mto.extWallInsulationSf * activeRates.extInsulationPerSf.material).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${(mto.extWallInsulationSf * activeRates.extInsulationPerSf.labor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${(mto.extWallInsulationSf * (activeRates.extInsulationPerSf.material + activeRates.extInsulationPerSf.labor)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>

                    {/* Division 2 */}
                    <tr className="bg-slate-900/60 font-bold text-sky-300">
                      <td colSpan={8} className="p-2">2. Framing & Carpentry</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Wall Stud Framing ({mto.wallStudCount} studs)</td>
                      <td className="p-2 text-right font-mono">{mto.wallStudFramingLf}</td>
                      <td className="p-2 text-slate-400">LF</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.studFramingPerLf.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.studFramingPerLf.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${(mto.wallStudFramingLf * activeRates.studFramingPerLf.material).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${(mto.wallStudFramingLf * activeRates.studFramingPerLf.labor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${(mto.wallStudFramingLf * (activeRates.studFramingPerLf.material + activeRates.studFramingPerLf.labor)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">OSB Subfloor Decking (3/4")</td>
                      <td className="p-2 text-right font-mono">{mto.osbSubfloorDeckingSf}</td>
                      <td className="p-2 text-slate-400">SF</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.osbSubfloorPerSf.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.osbSubfloorPerSf.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${(mto.osbSubfloorDeckingSf * activeRates.osbSubfloorPerSf.material).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${(mto.osbSubfloorDeckingSf * activeRates.osbSubfloorPerSf.labor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${(mto.osbSubfloorDeckingSf * (activeRates.osbSubfloorPerSf.material + activeRates.osbSubfloorPerSf.labor)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Baseboard & Casing Trim</td>
                      <td className="p-2 text-right font-mono">{mto.baseboardTrimsLf + mto.apertureCasingLf}</td>
                      <td className="p-2 text-slate-400">LF</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.baseboardPerLf.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.baseboardPerLf.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${((mto.baseboardTrimsLf + mto.apertureCasingLf) * activeRates.baseboardPerLf.material).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${((mto.baseboardTrimsLf + mto.apertureCasingLf) * activeRates.baseboardPerLf.labor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${((mto.baseboardTrimsLf + mto.apertureCasingLf) * (activeRates.baseboardPerLf.material + activeRates.baseboardPerLf.labor)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>

                    {/* Division 3 */}
                    <tr className="bg-slate-900/60 font-bold text-sky-300">
                      <td colSpan={8} className="p-2">3. Fenestration & Enclosure Openings</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Standard Windows</td>
                      <td className="p-2 text-right font-mono">{mto.totalWindowsUnits}</td>
                      <td className="p-2 text-slate-400">UNITS</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.windowPerUnit.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.windowPerUnit.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${(mto.totalWindowsUnits * activeRates.windowPerUnit.material).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${(mto.totalWindowsUnits * activeRates.windowPerUnit.labor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${(mto.totalWindowsUnits * (activeRates.windowPerUnit.material + activeRates.windowPerUnit.labor)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Interior Passage Doors</td>
                      <td className="p-2 text-right font-mono">{mto.passageDoorsUnits}</td>
                      <td className="p-2 text-slate-400">UNITS</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.passageDoorPerUnit.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.passageDoorPerUnit.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${(mto.passageDoorsUnits * activeRates.passageDoorPerUnit.material).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${(mto.passageDoorsUnits * activeRates.passageDoorPerUnit.labor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${(mto.passageDoorsUnits * (activeRates.passageDoorPerUnit.material + activeRates.passageDoorPerUnit.labor)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Pocket / Sliding Doors</td>
                      <td className="p-2 text-right font-mono">{mto.pocketDoorsUnits}</td>
                      <td className="p-2 text-slate-400">UNITS</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.pocketDoorPerUnit.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.pocketDoorPerUnit.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${(mto.pocketDoorsUnits * activeRates.pocketDoorPerUnit.material).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${(mto.pocketDoorsUnits * activeRates.pocketDoorPerUnit.labor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${(mto.pocketDoorsUnits * (activeRates.pocketDoorPerUnit.material + activeRates.pocketDoorPerUnit.labor)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Exterior Entry & Security Doors</td>
                      <td className="p-2 text-right font-mono">{mto.exteriorDoorsUnits}</td>
                      <td className="p-2 text-slate-400">UNITS</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.exteriorDoorPerUnit.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.exteriorDoorPerUnit.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${(mto.exteriorDoorsUnits * activeRates.exteriorDoorPerUnit.material).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${(mto.exteriorDoorsUnits * activeRates.exteriorDoorPerUnit.labor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${(mto.exteriorDoorsUnits * (activeRates.exteriorDoorPerUnit.material + activeRates.exteriorDoorPerUnit.labor)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>

                    {/* Division 4 & 5 */}
                    <tr className="bg-slate-900/60 font-bold text-sky-300">
                      <td colSpan={8} className="p-2">4 & 5. MEP, Plumbing & Electrical</td>
                    </tr>
                    {[
                      { name: 'Standard Switches', qty: mto.stdSwitchesUnits, unit: 'UNITS', mat: activeRates.switchPerUnit.material, lab: activeRates.switchPerUnit.labor, inc: state.settings.itemInclusions?.stdSwitches },
                      { name: 'Dimmers', qty: mto.dimmersUnits, unit: 'UNITS', mat: activeRates.switchPerUnit.material * 1.5, lab: activeRates.switchPerUnit.labor * 1.2, inc: state.settings.itemInclusions?.dimmers },
                      { name: '3-Way Switches', qty: mto.switch3WayUnits, unit: 'UNITS', mat: activeRates.switch3Way.material, lab: activeRates.switch3Way.labor, inc: state.settings.itemInclusions?.switch3Way },
                      { name: 'Standard 120V Outlets', qty: mto.stdOutletsUnits, unit: 'UNITS', mat: activeRates.outletPerUnit.material, lab: activeRates.outletPerUnit.labor, inc: state.settings.itemInclusions?.stdOutlets },
                      { name: 'GFCI Outlets', qty: mto.gfciOutletsUnits, unit: 'UNITS', mat: activeRates.gfciPerUnit.material, lab: activeRates.gfciPerUnit.labor, inc: state.settings.itemInclusions?.gfciOutlets },
                      { name: '240V Heavy Outlets', qty: mto.heavyOutlets24vUnits, unit: 'UNITS', mat: activeRates.outletPerUnit.material * 2.5, lab: activeRates.outletPerUnit.labor * 1.8, inc: state.settings.itemInclusions?.heavyOutlets24v },
                      { name: 'EV Level 2 Chargers', qty: mto.evChargersUnits, unit: 'UNITS', mat: activeRates.evChargerPerUnit.material, lab: activeRates.evChargerPerUnit.labor, inc: state.settings.itemInclusions?.evChargers },
                      { name: 'Potlights', qty: mto.potlightsUnits, unit: 'UNITS', mat: activeRates.potlightPerUnit.material, lab: activeRates.potlightPerUnit.labor, inc: state.settings.itemInclusions?.potlights },
                      { name: 'Sconces / Fixtures', qty: mto.fixturesSconcesUnits, unit: 'UNITS', mat: activeRates.fixtureSconce.material, lab: activeRates.fixtureSconce.labor, inc: state.settings.itemInclusions?.fixturesSconces },
                      { name: 'Exterior Coach Lights', qty: mto.exteriorCoachLightsUnits, unit: 'UNITS', mat: activeRates.exteriorCoachLight.material, lab: activeRates.exteriorCoachLight.labor, inc: state.settings.itemInclusions?.exteriorCoachLights },
                      { name: 'Soffit Lights', qty: mto.soffitLightsUnits, unit: 'UNITS', mat: activeRates.soffitLight.material, lab: activeRates.soffitLight.labor, inc: state.settings.itemInclusions?.soffitLights },
                      { name: 'Ceiling Fans', qty: mto.ceilingFansUnits, unit: 'UNITS', mat: activeRates.ceilingFanPerUnit.material, lab: activeRates.ceilingFanPerUnit.labor, inc: state.settings.itemInclusions?.ceilingFans },
                      { name: 'Exhaust Fans', qty: mto.spotExhaustFansUnits, unit: 'UNITS', mat: activeRates.exhaustFanPerUnit.material, lab: activeRates.exhaustFanPerUnit.labor, inc: state.settings.itemInclusions?.spotExhaustFans },
                      { name: 'Range Hoods', qty: mto.rangeHoodsUnits, unit: 'UNITS', mat: activeRates.rangeHoodPerUnit.material, lab: activeRates.rangeHoodPerUnit.labor, inc: state.settings.itemInclusions?.rangeHoods },
                      { name: 'Smoke Alarms', qty: mto.smokeCoAlarmsUnits, unit: 'UNITS', mat: activeRates.smokeAlarmPerUnit.material, lab: activeRates.smokeAlarmPerUnit.labor, inc: state.settings.itemInclusions?.smokeCoAlarms },
                      ...mto.panelBreakdown.map(p => {
                        let rateKey: keyof UnitCostRates = 'electricalPanelMain200A';
                        if (p.type === 'main') {
                          if (p.amperage === '100A') rateKey = 'electricalPanelMain100A';
                          else if (p.amperage === '400A') rateKey = 'electricalPanelMain400A';
                          else rateKey = 'electricalPanelMain200A';
                        } else {
                          if (p.amperage === '60A') rateKey = 'electricalPanelSub60A';
                          else if (p.amperage === '125A') rateKey = 'electricalPanelSub125A';
                          else rateKey = 'electricalPanelSub100A';
                        }
                        const rate = activeRates[rateKey];
                        return { name: `Electrical ${p.type === 'main' ? 'Main Panel' : 'Subpanel'} - ${p.amperage}`, qty: p.count, unit: 'UNITS', mat: rate.material, lab: rate.labor, inc: state.settings.itemInclusions?.electricalPanels };
                      })
                    ].filter(item => item.qty > 0 && item.inc !== false).map((item, idx) => (
                      <tr key={`elec-${idx}`}>
                        <td className="p-2 pl-4 text-slate-300">{item.name}</td>
                        <td className="p-2 text-right font-mono">{item.qty}</td>
                        <td className="p-2 text-slate-400">{item.unit}</td>
                        <td className="p-2 text-right font-mono text-slate-400">${item.mat.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono text-slate-400">${item.lab.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">${(item.qty * item.mat * (1 + state.settings.wasteFactorPercentage / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right font-mono">${(item.qty * item.lab * (1 + state.settings.wasteFactorPercentage / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right font-mono font-semibold">${(item.qty * (item.mat + item.lab) * (1 + state.settings.wasteFactorPercentage / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Plumbing Fixtures & Civil Trenching</td>
                      <td className="p-2 text-right font-mono">{mto.plumbingFixturesUnits}</td>
                      <td className="p-2 text-slate-400">FIXTURES</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.plumbingPerFixture.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.plumbingPerFixture.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${costAnalysis.categoryBreakdown.plumbingCivil.material.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${costAnalysis.categoryBreakdown.plumbingCivil.labor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${costAnalysis.subtotals.plumbingCivil.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    {/* Division 6 & 7 */}
                    <tr className="bg-slate-900/60 font-bold text-sky-300">
                      <td colSpan={8} className="p-2">6 & 7. Foundation, Roof & Exterior Envelope</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Poured Concrete Slab & Piers</td>
                      <td className="p-2 text-right font-mono">{mto.pouredConcreteCy}</td>
                      <td className="p-2 text-slate-400">CY</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.concretePerCy.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.concretePerCy.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${costAnalysis.categoryBreakdown.concreteFoundations.material.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${costAnalysis.categoryBreakdown.concreteFoundations.labor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${costAnalysis.subtotals.concreteFoundations.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4 text-slate-300">Exterior Siding & Pitched Roof</td>
                      <td className="p-2 text-right font-mono">{mto.primarySidingSf} SF / {mto.roofingAreaSq} SQ</td>
                      <td className="p-2 text-slate-400">ENVELOPE</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.roofingPerSq.material.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">${activeRates.roofingPerSq.labor.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">${costAnalysis.categoryBreakdown.roofingEnvelope.material.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${costAnalysis.categoryBreakdown.roofingEnvelope.labor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono font-semibold">${costAnalysis.subtotals.roofingEnvelope.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>

                    {/* Grand Total */}
                    <tr className="bg-slate-900 text-slate-100 font-bold text-sm border-t-2 border-slate-700">
                      <td colSpan={5} className="p-3 text-right">
                        ESTIMATED GRAND TOTAL:
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-400">
                        ${costAnalysis.materialSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono text-sky-400">
                        ${costAnalysis.laborSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-400 text-base">
                        ${costAnalysis.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Notes */}
            <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Calculated geometrically by PlanarMTO PSLG Take-Off Engine.</span>
              </div>
              <div>{firmTitle}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
