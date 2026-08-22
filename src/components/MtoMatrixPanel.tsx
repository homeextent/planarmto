import React, { useState } from 'react';
import { MTOReport, UnitCostRates, FloorplanState, CategoryInclusions, ItemInclusions } from '../types';
import { calculateEstimatedCost, DEFAULT_UNIT_COST_RATES } from '../engine/estimator';
import {
  Layers,
  Hammer,
  DoorOpen,
  Zap,
  Droplets,
  Building2,
  Home,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  DollarSign,
  TrendingUp,
  SlidersHorizontal,
  Settings,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface MtoMatrixPanelProps {
  state: FloorplanState;
  mto: MTOReport;
  costRates?: UnitCostRates;
  onOpenRateModal?: () => void;
  onOpenPrintModal?: () => void;
  onOpenSettingsModal?: () => void;
  onToggleCategoryInclusion?: (key: keyof CategoryInclusions) => void;
  onToggleItemInclusion?: (key: keyof ItemInclusions) => void;
  onToggleCalculationMode?: () => void;
}

export const MtoMatrixPanel: React.FC<MtoMatrixPanelProps> = ({
  state,
  mto,
  costRates = DEFAULT_UNIT_COST_RATES,
  onOpenRateModal,
  onOpenPrintModal,
  onOpenSettingsModal,
  onToggleCategoryInclusion,
  onToggleItemInclusion,
  onToggleCalculationMode,
}) => {
  const [showCostEstimates, setShowCostEstimates] = useState<boolean>(true);
  const [showLaborSplit, setShowLaborSplit] = useState<boolean>(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    section1: false,
    section2: false,
    section3: false,
    section4: false,
    section5: false,
    section6: false,
    section7: false,
  });

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const inclusions = state.settings.categoryInclusions;
  const itemInclusions = state.settings.itemInclusions;
  const costAnalysis = calculateEstimatedCost(mto, costRates, inclusions, itemInclusions, state.settings);
  const activeRates = costRates || DEFAULT_UNIT_COST_RATES;
  const isInteriorMode = state.settings.calculationMode === 'interior_finish';

  const isIncluded = (key: keyof CategoryInclusions) => inclusions?.[key] !== false;
  const isItemIncluded = (key: keyof ItemInclusions) => itemInclusions?.[key] !== false;

  const matPercent =
    costAnalysis.totalCost > 0
      ? Math.round((costAnalysis.materialSubtotal / costAnalysis.totalCost) * 100)
      : 55;
  const labPercent =
    costAnalysis.totalCost > 0
      ? Math.round((costAnalysis.laborSubtotal / costAnalysis.totalCost) * 100)
      : 45;

  // Export Comprehensive CSV
  const handleExportCSV = () => {
    const r = activeRates;
    const rows = [
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
        'Total Installed ($)',
      ],
      // 1. Finishes
      [
        '1. Board & Finishes',
        'Drywall Board (Tape & Sand)',
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
        'Paint Coverage (Primer + 2 Coats)',
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
        'Ext. Wall Insulation (R-20)',
        mto.extWallInsulationSf,
        'SF',
        r.extInsulationPerSf.material,
        r.extInsulationPerSf.labor,
        (r.extInsulationPerSf.material + r.extInsulationPerSf.labor).toFixed(2),
        (mto.extWallInsulationSf * r.extInsulationPerSf.material).toFixed(2),
        (mto.extWallInsulationSf * r.extInsulationPerSf.labor).toFixed(2),
        (mto.extWallInsulationSf * (r.extInsulationPerSf.material + r.extInsulationPerSf.labor)).toFixed(2),
      ],

      // 2. Carpentry
      [
        '2. Carpentry & Framing',
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
        '2. Carpentry & Framing',
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
        '2. Carpentry & Framing',
        'Structural Beams',
        mto.structuralBeamsLf,
        'LF',
        r.beamPerLf.material,
        r.beamPerLf.labor,
        (r.beamPerLf.material + r.beamPerLf.labor).toFixed(2),
        (mto.structuralBeamsLf * r.beamPerLf.material).toFixed(2),
        (mto.structuralBeamsLf * r.beamPerLf.labor).toFixed(2),
        (mto.structuralBeamsLf * (r.beamPerLf.material + r.beamPerLf.labor)).toFixed(2),
      ],
      [
        '2. Carpentry & Framing',
        'Support Columns / Posts',
        mto.supportColumnsPosts,
        'POSTS',
        r.postPerUnit.material,
        r.postPerUnit.labor,
        (r.postPerUnit.material + r.postPerUnit.labor).toFixed(2),
        (mto.supportColumnsPosts * r.postPerUnit.material).toFixed(2),
        (mto.supportColumnsPosts * r.postPerUnit.labor).toFixed(2),
        (mto.supportColumnsPosts * (r.postPerUnit.material + r.postPerUnit.labor)).toFixed(2),
      ],
      [
        '2. Carpentry & Framing',
        'Baseboard Trims',
        mto.baseboardTrimsLf,
        'LF',
        r.baseboardPerLf.material,
        r.baseboardPerLf.labor,
        (r.baseboardPerLf.material + r.baseboardPerLf.labor).toFixed(2),
        (mto.baseboardTrimsLf * r.baseboardPerLf.material).toFixed(2),
        (mto.baseboardTrimsLf * r.baseboardPerLf.labor).toFixed(2),
        (mto.baseboardTrimsLf * (r.baseboardPerLf.material + r.baseboardPerLf.labor)).toFixed(2),
      ],
      [
        '2. Carpentry & Framing',
        'Aperture Casing',
        mto.apertureCasingLf,
        'LF',
        r.casingPerLf.material,
        r.casingPerLf.labor,
        (r.casingPerLf.material + r.casingPerLf.labor).toFixed(2),
        (mto.apertureCasingLf * r.casingPerLf.material).toFixed(2),
        (mto.apertureCasingLf * r.casingPerLf.labor).toFixed(2),
        (mto.apertureCasingLf * (r.casingPerLf.material + r.casingPerLf.labor)).toFixed(2),
      ],
      [
        '2. Carpentry & Framing',
        'Calculated Stair Risers',
        mto.calculatedStairRisers,
        'RISERS',
        r.stairRiserPerUnit.material,
        r.stairRiserPerUnit.labor,
        (r.stairRiserPerUnit.material + r.stairRiserPerUnit.labor).toFixed(2),
        (mto.calculatedStairRisers * r.stairRiserPerUnit.material).toFixed(2),
        (mto.calculatedStairRisers * r.stairRiserPerUnit.labor).toFixed(2),
        (mto.calculatedStairRisers * (r.stairRiserPerUnit.material + r.stairRiserPerUnit.labor)).toFixed(2),
      ],

      // 3. Fenestration
      [
        '3. Apertures & Fenestration',
        'Total Windows',
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
        '3. Apertures & Fenestration',
        'Passage Doors',
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
        '3. Apertures & Fenestration',
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
        '3. Apertures & Fenestration',
        'Exterior Doors',
        mto.exteriorDoorsUnits,
        'UNITS',
        r.exteriorDoorPerUnit.material,
        r.exteriorDoorPerUnit.labor,
        (r.exteriorDoorPerUnit.material + r.exteriorDoorPerUnit.labor).toFixed(2),
        (mto.exteriorDoorsUnits * r.exteriorDoorPerUnit.material).toFixed(2),
        (mto.exteriorDoorsUnits * r.exteriorDoorPerUnit.labor).toFixed(2),
        (mto.exteriorDoorsUnits * (r.exteriorDoorPerUnit.material + r.exteriorDoorPerUnit.labor)).toFixed(2),
      ],
      [
        '3. Apertures & Fenestration',
        'Overhead Garage Bays',
        mto.overheadGarageBays,
        'BAYS',
        r.garageDoorPerBay.material,
        r.garageDoorPerBay.labor,
        (r.garageDoorPerBay.material + r.garageDoorPerBay.labor).toFixed(2),
        (mto.overheadGarageBays * r.garageDoorPerBay.material).toFixed(2),
        (mto.overheadGarageBays * r.garageDoorPerBay.labor).toFixed(2),
        (mto.overheadGarageBays * (r.garageDoorPerBay.material + r.garageDoorPerBay.labor)).toFixed(2),
      ],
      [
        '3. Apertures & Fenestration',
        'Door Hardware Sets',
        mto.doorHardwareSets,
        'SETS',
        r.doorHardwarePerSet.material,
        r.doorHardwarePerSet.labor,
        (r.doorHardwarePerSet.material + r.doorHardwarePerSet.labor).toFixed(2),
        (mto.doorHardwareSets * r.doorHardwarePerSet.material).toFixed(2),
        (mto.doorHardwareSets * r.doorHardwarePerSet.labor).toFixed(2),
        (mto.doorHardwareSets * (r.doorHardwarePerSet.material + r.doorHardwarePerSet.labor)).toFixed(2),
      ],

      // 4. Electrical
      [
        '4. Electrical & Safety',
        'Std Switches',
        mto.stdSwitchesUnits,
        'UNITS',
        r.switchPerUnit.material,
        r.switchPerUnit.labor,
        (r.switchPerUnit.material + r.switchPerUnit.labor).toFixed(2),
        (mto.stdSwitchesUnits * r.switchPerUnit.material).toFixed(2),
        (mto.stdSwitchesUnits * r.switchPerUnit.labor).toFixed(2),
        (mto.stdSwitchesUnits * (r.switchPerUnit.material + r.switchPerUnit.labor)).toFixed(2),
      ],
      [
        '4. Electrical & Safety',
        'Std Outlets (120V)',
        mto.stdOutletsUnits,
        'UNITS',
        r.outletPerUnit.material,
        r.outletPerUnit.labor,
        (r.outletPerUnit.material + r.outletPerUnit.labor).toFixed(2),
        (mto.stdOutletsUnits * r.outletPerUnit.material).toFixed(2),
        (mto.stdOutletsUnits * r.outletPerUnit.labor).toFixed(2),
        (mto.stdOutletsUnits * (r.outletPerUnit.material + r.outletPerUnit.labor)).toFixed(2),
      ],
      [
        '4. Electrical & Safety',
        'GFCI Outlets',
        mto.gfciOutletsUnits,
        'UNITS',
        r.gfciPerUnit.material,
        r.gfciPerUnit.labor,
        (r.gfciPerUnit.material + r.gfciPerUnit.labor).toFixed(2),
        (mto.gfciOutletsUnits * r.gfciPerUnit.material).toFixed(2),
        (mto.gfciOutletsUnits * r.gfciPerUnit.labor).toFixed(2),
        (mto.gfciOutletsUnits * (r.gfciPerUnit.material + r.gfciPerUnit.labor)).toFixed(2),
      ],
      [
        '4. Electrical & Safety',
        'EV Level 2 Chargers',
        mto.evChargersUnits,
        'UNITS',
        r.evChargerPerUnit.material,
        r.evChargerPerUnit.labor,
        (r.evChargerPerUnit.material + r.evChargerPerUnit.labor).toFixed(2),
        (mto.evChargersUnits * r.evChargerPerUnit.material).toFixed(2),
        (mto.evChargersUnits * r.evChargerPerUnit.labor).toFixed(2),
        (mto.evChargersUnits * (r.evChargerPerUnit.material + r.evChargerPerUnit.labor)).toFixed(2),
      ],
      [
        '4. Electrical & Safety',
        'Potlights (Slim Recessed)',
        mto.potlightsUnits,
        'UNITS',
        r.potlightPerUnit.material,
        r.potlightPerUnit.labor,
        (r.potlightPerUnit.material + r.potlightPerUnit.labor).toFixed(2),
        (mto.potlightsUnits * r.potlightPerUnit.material).toFixed(2),
        (mto.potlightsUnits * r.potlightPerUnit.labor).toFixed(2),
        (mto.potlightsUnits * (r.potlightPerUnit.material + r.potlightPerUnit.labor)).toFixed(2),
      ],
      [
        '4. Electrical & Safety',
        'Smoke & CO Alarms',
        mto.smokeCoAlarmsUnits,
        'UNITS',
        r.smokeAlarmPerUnit.material,
        r.smokeAlarmPerUnit.labor,
        (r.smokeAlarmPerUnit.material + r.smokeAlarmPerUnit.labor).toFixed(2),
        (mto.smokeCoAlarmsUnits * r.smokeAlarmPerUnit.material).toFixed(2),
        (mto.smokeCoAlarmsUnits * r.smokeAlarmPerUnit.labor).toFixed(2),
        (mto.smokeCoAlarmsUnits * (r.smokeAlarmPerUnit.material + r.smokeAlarmPerUnit.labor)).toFixed(2),
      ],

      // 5. Plumbing
      [
        '5. Plumbing & Civil',
        'Plumbing Fixtures',
        mto.plumbingFixturesUnits,
        'UNITS',
        r.plumbingPerFixture.material,
        r.plumbingPerFixture.labor,
        (r.plumbingPerFixture.material + r.plumbingPerFixture.labor).toFixed(2),
        (mto.plumbingFixturesUnits * r.plumbingPerFixture.material).toFixed(2),
        (mto.plumbingFixturesUnits * r.plumbingPerFixture.labor).toFixed(2),
        (mto.plumbingFixturesUnits * (r.plumbingPerFixture.material + r.plumbingPerFixture.labor)).toFixed(2),
      ],
      [
        '5. Plumbing & Civil',
        'Utility Trenching',
        mto.utilityTrenchingLf,
        'LF',
        r.utilityTrenchPerLf.material,
        r.utilityTrenchPerLf.labor,
        (r.utilityTrenchPerLf.material + r.utilityTrenchPerLf.labor).toFixed(2),
        (mto.utilityTrenchingLf * r.utilityTrenchPerLf.material).toFixed(2),
        (mto.utilityTrenchingLf * r.utilityTrenchPerLf.labor).toFixed(2),
        (mto.utilityTrenchingLf * (r.utilityTrenchPerLf.material + r.utilityTrenchPerLf.labor)).toFixed(2),
      ],

      // 6. Concrete
      [
        '6. Concrete & Foundations',
        'Poured Concrete',
        mto.pouredConcreteCy,
        'CY',
        r.concretePerCy.material,
        r.concretePerCy.labor,
        (r.concretePerCy.material + r.concretePerCy.labor).toFixed(2),
        (mto.pouredConcreteCy * r.concretePerCy.material).toFixed(2),
        (mto.pouredConcreteCy * r.concretePerCy.labor).toFixed(2),
        (mto.pouredConcreteCy * (r.concretePerCy.material + r.concretePerCy.labor)).toFixed(2),
      ],
      [
        '6. Concrete & Foundations',
        'Helical Piers / Piles',
        mto.helicalPiersPiles,
        'PIERS',
        r.pierPerUnit.material,
        r.pierPerUnit.labor,
        (r.pierPerUnit.material + r.pierPerUnit.labor).toFixed(2),
        (mto.helicalPiersPiles * r.pierPerUnit.material).toFixed(2),
        (mto.helicalPiersPiles * r.pierPerUnit.labor).toFixed(2),
        (mto.helicalPiersPiles * (r.pierPerUnit.material + r.pierPerUnit.labor)).toFixed(2),
      ],

      // 7. Roofing
      [
        '7. Roofing & Envelope',
        'Roofing Area',
        mto.roofingAreaSq,
        'SQ',
        r.roofingPerSq.material,
        r.roofingPerSq.labor,
        (r.roofingPerSq.material + r.roofingPerSq.labor).toFixed(2),
        (mto.roofingAreaSq * r.roofingPerSq.material).toFixed(2),
        (mto.roofingAreaSq * r.roofingPerSq.labor).toFixed(2),
        (mto.roofingAreaSq * (r.roofingPerSq.material + r.roofingPerSq.labor)).toFixed(2),
      ],
      [
        '7. Roofing & Envelope',
        'Primary Exterior Siding',
        mto.primarySidingSf,
        'SF',
        r.sidingPerSf.material,
        r.sidingPerSf.labor,
        (r.sidingPerSf.material + r.sidingPerSf.labor).toFixed(2),
        (mto.primarySidingSf * r.sidingPerSf.material).toFixed(2),
        (mto.primarySidingSf * r.sidingPerSf.labor).toFixed(2),
        (mto.primarySidingSf * (r.sidingPerSf.material + r.sidingPerSf.labor)).toFixed(2),
      ],
      [
        '7. Roofing & Envelope',
        'Timber Decking',
        mto.timberDeckingSf,
        'SF',
        r.deckingPerSf.material,
        r.deckingPerSf.labor,
        (r.deckingPerSf.material + r.deckingPerSf.labor).toFixed(2),
        (mto.timberDeckingSf * r.deckingPerSf.material).toFixed(2),
        (mto.timberDeckingSf * r.deckingPerSf.labor).toFixed(2),
        (mto.timberDeckingSf * (r.deckingPerSf.material + r.deckingPerSf.labor)).toFixed(2),
      ],

      // Rollups
      ['', 'MATERIAL SUBTOTAL', '', '', '', '', '', `$${costAnalysis.materialSubtotal.toLocaleString()}`, '', ''],
      ['', 'LABOR SUBTOTAL', '', '', '', '', '', '', `$${costAnalysis.laborSubtotal.toLocaleString()}`, ''],
      ['', 'GRAND TOTAL INSTALLED COST', '', '', '', '', '', '', '', `$${costAnalysis.totalCost.toLocaleString()}`],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TakeOff_Estimate_Detailed_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (onOpenPrintModal) {
      onOpenPrintModal();
    } else {
      window.print();
    }
  };

  return (
    <aside className="w-88 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden select-none shrink-0">
      {/* Header with Title and Quick Actions */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Live MTO Matrix
          </h2>
          <p className="text-[10px] text-slate-400">Dynamic take-offs & dual cost model</p>
        </div>

        <div className="flex items-center gap-1">
          {onOpenSettingsModal && (
            <button
              onClick={onOpenSettingsModal}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 rounded-md text-xs transition-colors cursor-pointer border border-slate-700"
              title="Global Project & Engine Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          {onOpenRateModal && (
            <button
              onClick={onOpenRateModal}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 rounded-md text-xs font-semibold flex items-center gap-1 border border-slate-700 cursor-pointer transition-colors"
              title="Project Unit Rates (Cost Model)"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Rates</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs transition-colors cursor-pointer"
            title="Export Detailed CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handlePrint}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs transition-colors cursor-pointer"
            title="Print Full Take-Off Report"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Calculation Mode Badge & Quick Toggle */}
      <div className="px-3.5 py-1.5 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-400">Mode:</span>
          <button
            onClick={onToggleCalculationMode || onOpenSettingsModal}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
              isInteriorMode
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25'
            }`}
            title="Click to toggle calculation engine mode"
          >
            {isInteriorMode ? 'Interior Finish' : 'Exterior Framing'}
          </button>
        </div>

        <span className="text-[10px] text-slate-400">
          Wall H: <strong className="text-slate-200">{state.settings.defaultWallHeight}ft</strong>
        </span>
      </div>

      {/* Grand Total Cost Summary Banner with Material & Labor Split */}
      <div className="p-3.5 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            Total Estimated Cost
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLaborSplit(!showLaborSplit)}
              className="text-[10px] text-sky-400 hover:underline cursor-pointer"
            >
              {showLaborSplit ? 'Compact' : 'Mat/Lab Split'}
            </button>
          </div>
        </div>

        <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
          ${costAnalysis.totalCost.toLocaleString()}
        </div>

        {/* Financial Rollup Details */}
        {showLaborSplit && (
          <div className="space-y-2 pt-1 border-t border-slate-800/40">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2">
                <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between">
                  <span className="text-emerald-400 font-semibold">Material ({matPercent}%)</span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-100 mt-0.5">
                  ${costAnalysis.materialSubtotal.toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2">
                <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between">
                  <span className="text-sky-400 font-semibold">Labor ({labPercent}%)</span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-100 mt-0.5">
                  ${costAnalysis.laborSubtotal.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/40 rounded-lg p-2 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400 font-semibold uppercase">Base Direct Cost:</span>
                <span className="text-slate-200 font-mono">${costAnalysis.baseDirectCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Project Management ({state.settings.projectManagementPercentage}%):</span>
                <span className="text-slate-400 font-mono">+${costAnalysis.indirectProjectManagement.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Contingency ({state.settings.projectContingencyPercentage}%):</span>
                <span className="text-slate-400 font-mono">+${costAnalysis.indirectContingency.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px] pt-1 border-t border-slate-800/40">
                <span className="text-slate-400 font-semibold uppercase">Gross Margin:</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Overhead ({state.settings.overheadPercentage}%):</span>
                <span className="text-slate-400 font-mono">+${costAnalysis.grossMarginOverhead.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Profit ({state.settings.profitPercentage}%):</span>
                <span className="text-slate-400 font-mono">+${costAnalysis.grossMarginProfit.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        <div className="text-[10px] text-slate-400 flex justify-between pt-0.5 border-t border-slate-800/60">
          <span>{mto.roomDetails.length} Rooms</span>
          <span>{mto.wallDetails.length} Wall Segments</span>
          <span>{mto.apertureCasingLf.toFixed(0)} LF Apertures</span>
        </div>
      </div>

      {/* Accordion List for all 7 Technical Take-Off Categories */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800">
        {/* Category 1: Board & Finishes */}
        <div
          className={`border rounded-xl overflow-hidden shadow-sm transition-opacity ${
            isIncluded('finishes')
              ? 'bg-slate-950/60 border-slate-800'
              : 'bg-slate-950/30 border-slate-850 opacity-70'
          }`}
        >
          <div className="w-full flex items-center justify-between p-2.5 hover:bg-slate-800/40 transition-colors">
            <button
              onClick={() => toggleSection('section1')}
              className="flex-1 flex items-center gap-2 text-left cursor-pointer"
            >
              <span
                className={`text-xs font-bold flex items-center gap-2 ${
                  isIncluded('finishes') ? 'text-slate-200' : 'text-slate-400 line-through'
                }`}
              >
                <Layers className="w-4 h-4 text-sky-400" />
                1. Board & Finishes
              </span>
            </button>
            <div className="flex items-center gap-2">
              {onToggleCategoryInclusion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCategoryInclusion('finishes');
                  }}
                  className="p-0.5 hover:opacity-100 opacity-80 cursor-pointer"
                  title={isIncluded('finishes') ? 'Exclude from financial total' : 'Include in financial total'}
                >
                  {isIncluded('finishes') ? (
                    <ToggleRight className="w-5 h-5 text-sky-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              )}
              {showCostEstimates && (
                <span
                  className={`text-xs font-mono font-semibold ${
                    isIncluded('finishes') ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {isIncluded('finishes')
                    ? `$${costAnalysis.subtotals.finishes.toLocaleString()}`
                    : '$0'}
                </span>
              )}
              <button
                onClick={() => toggleSection('section1')}
                className="cursor-pointer p-0.5"
              >
                {collapsedSections.section1 ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {!collapsedSections.section1 && (
            <div className="p-2.5 pt-0 border-t border-slate-800/60 space-y-1.5 text-xs">
              <MetricRow
                label="Drywall Board"
                value={mto.drywallBoardSf}
                unit="SF"
                subtext="Net walls + ceilings"
                cost={
                  isIncluded('finishes') && isItemIncluded('drywallBoard')
                    ? mto.drywallBoardSf * (activeRates.drywallPerSf.material + activeRates.drywallPerSf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('finishes')}
                itemKey="drywallBoard"
                isItemExcluded={!isItemIncluded('drywallBoard')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Paint Coverage"
                value={mto.paintCoverageSf}
                unit="SF"
                cost={
                  isIncluded('finishes') && isItemIncluded('paintCoverage')
                    ? mto.paintCoverageSf * (activeRates.paintPerSf.material + activeRates.paintPerSf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('finishes')}
                itemKey="paintCoverage"
                isItemExcluded={!isItemIncluded('paintCoverage')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Flooring Package"
                value={mto.flooringPackageSf}
                unit="SF"
                subtext="Room polygon areas"
                cost={
                  isIncluded('finishes') && isItemIncluded('flooringPackage')
                    ? mto.flooringPackageSf * (activeRates.flooringPerSf.material + activeRates.flooringPerSf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('finishes')}
                itemKey="flooringPackage"
                isItemExcluded={!isItemIncluded('flooringPackage')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Ext. Wall Insulation"
                value={mto.extWallInsulationSf}
                unit="SF"
                subtext="R-20 batts"
                cost={
                  isIncluded('finishes') && isItemIncluded('extWallInsulation')
                    ? mto.extWallInsulationSf * (activeRates.extInsulationPerSf.material + activeRates.extInsulationPerSf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('finishes')}
                itemKey="extWallInsulation"
                isItemExcluded={!isItemIncluded('extWallInsulation')}
                onToggleItem={onToggleItemInclusion}
              />
            </div>
          )}
        </div>

        {/* Category 2: Carpentry, Framing & Substructures */}
        <div
          className={`border rounded-xl overflow-hidden shadow-sm transition-opacity ${
            isIncluded('carpentryFraming')
              ? 'bg-slate-950/60 border-slate-800'
              : 'bg-slate-950/30 border-slate-850 opacity-70'
          }`}
        >
          <div className="w-full flex items-center justify-between p-2.5 hover:bg-slate-800/40 transition-colors">
            <button
              onClick={() => toggleSection('section2')}
              className="flex-1 flex items-center gap-2 text-left cursor-pointer"
            >
              <span
                className={`text-xs font-bold flex items-center gap-2 ${
                  isIncluded('carpentryFraming') ? 'text-slate-200' : 'text-slate-400 line-through'
                }`}
              >
                <Hammer className="w-4 h-4 text-amber-400" />
                2. Carpentry & Framing
              </span>
            </button>
            <div className="flex items-center gap-2">
              {onToggleCategoryInclusion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCategoryInclusion('carpentryFraming');
                  }}
                  className="p-0.5 hover:opacity-100 opacity-80 cursor-pointer"
                  title={isIncluded('carpentryFraming') ? 'Exclude from financial total' : 'Include in financial total'}
                >
                  {isIncluded('carpentryFraming') ? (
                    <ToggleRight className="w-5 h-5 text-sky-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              )}
              {showCostEstimates && (
                <span
                  className={`text-xs font-mono font-semibold ${
                    isIncluded('carpentryFraming') ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {isIncluded('carpentryFraming')
                    ? `$${costAnalysis.subtotals.carpentryFraming.toLocaleString()}`
                    : '$0'}
                </span>
              )}
              <button
                onClick={() => toggleSection('section2')}
                className="cursor-pointer p-0.5"
              >
                {collapsedSections.section2 ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {!collapsedSections.section2 && (
            <div className="p-2.5 pt-0 border-t border-slate-800/60 space-y-1.5 text-xs">
              <MetricRow
                label="Wall Stud Framing"
                value={mto.wallStudFramingLf}
                unit="LF"
                cost={
                  isIncluded('carpentryFraming') && isItemIncluded('wallStudFraming')
                    ? mto.wallStudFramingLf * (activeRates.studFramingPerLf.material + activeRates.studFramingPerLf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('carpentryFraming')}
                itemKey="wallStudFraming"
                isItemExcluded={!isItemIncluded('wallStudFraming')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow label="Calculated Studs" value={mto.wallStudCount} unit="STUDS" subtext="16&quot; OC + plates + jacks" />
              <MetricRow
                label="OSB Subfloor Decking"
                value={mto.osbSubfloorDeckingSf}
                unit="SF"
                cost={
                  isIncluded('carpentryFraming') && isItemIncluded('osbSubfloorDecking')
                    ? mto.osbSubfloorDeckingSf * (activeRates.osbSubfloorPerSf.material + activeRates.osbSubfloorPerSf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('carpentryFraming')}
                itemKey="osbSubfloorDecking"
                isItemExcluded={!isItemIncluded('osbSubfloorDecking')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Structural Beams"
                value={mto.structuralBeamsLf}
                unit="LF"
                cost={
                  isIncluded('carpentryFraming') && isItemIncluded('structuralBeams')
                    ? mto.structuralBeamsLf * (activeRates.beamPerLf.material + activeRates.beamPerLf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('carpentryFraming')}
                itemKey="structuralBeams"
                isItemExcluded={!isItemIncluded('structuralBeams')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Support Columns"
                value={mto.supportColumnsPosts}
                unit="POSTS"
                cost={
                  isIncluded('carpentryFraming') && isItemIncluded('supportColumnsPosts')
                    ? mto.supportColumnsPosts * (activeRates.postPerUnit.material + activeRates.postPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('carpentryFraming')}
                itemKey="supportColumnsPosts"
                isItemExcluded={!isItemIncluded('supportColumnsPosts')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Baseboard Trims"
                value={mto.baseboardTrimsLf}
                unit="LF"
                subtext="Perimeter - Door widths"
                cost={
                  isIncluded('carpentryFraming') && isItemIncluded('baseboardTrims')
                    ? mto.baseboardTrimsLf * (activeRates.baseboardPerLf.material + activeRates.baseboardPerLf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('carpentryFraming')}
                itemKey="baseboardTrims"
                isItemExcluded={!isItemIncluded('baseboardTrims')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Aperture Casing"
                value={mto.apertureCasingLf}
                unit="LF"
                subtext="Doors + Windows trim"
                cost={
                  isIncluded('carpentryFraming') && isItemIncluded('apertureCasing')
                    ? mto.apertureCasingLf * (activeRates.casingPerLf.material + activeRates.casingPerLf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('carpentryFraming')}
                itemKey="apertureCasing"
                isItemExcluded={!isItemIncluded('apertureCasing')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow label="Stair Hand & Guardrail" value={mto.stairHandGuardrailLf} unit="LF" />
              <MetricRow
                label="Calculated Stair Risers"
                value={mto.calculatedStairRisers}
                unit="RISERS"
                cost={
                  isIncluded('carpentryFraming') && isItemIncluded('calculatedStairRisers')
                    ? mto.calculatedStairRisers * (activeRates.stairRiserPerUnit.material + activeRates.stairRiserPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('carpentryFraming')}
                itemKey="calculatedStairRisers"
                isItemExcluded={!isItemIncluded('calculatedStairRisers')}
                onToggleItem={onToggleItemInclusion}
              />
            </div>
          )}
        </div>

        {/* Category 3: Apertures, Doors & Fenestration */}
        <div
          className={`border rounded-xl overflow-hidden shadow-sm transition-opacity ${
            isIncluded('fenestration')
              ? 'bg-slate-950/60 border-slate-800'
              : 'bg-slate-950/30 border-slate-850 opacity-70'
          }`}
        >
          <div className="w-full flex items-center justify-between p-2.5 hover:bg-slate-800/40 transition-colors">
            <button
              onClick={() => toggleSection('section3')}
              className="flex-1 flex items-center gap-2 text-left cursor-pointer"
            >
              <span
                className={`text-xs font-bold flex items-center gap-2 ${
                  isIncluded('fenestration') ? 'text-slate-200' : 'text-slate-400 line-through'
                }`}
              >
                <DoorOpen className="w-4 h-4 text-emerald-400" />
                3. Apertures & Doors
              </span>
            </button>
            <div className="flex items-center gap-2">
              {onToggleCategoryInclusion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCategoryInclusion('fenestration');
                  }}
                  className="p-0.5 hover:opacity-100 opacity-80 cursor-pointer"
                  title={isIncluded('fenestration') ? 'Exclude from financial total' : 'Include in financial total'}
                >
                  {isIncluded('fenestration') ? (
                    <ToggleRight className="w-5 h-5 text-sky-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              )}
              {showCostEstimates && (
                <span
                  className={`text-xs font-mono font-semibold ${
                    isIncluded('fenestration') ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {isIncluded('fenestration')
                    ? `$${costAnalysis.subtotals.fenestration.toLocaleString()}`
                    : '$0'}
                </span>
              )}
              <button
                onClick={() => toggleSection('section3')}
                className="cursor-pointer p-0.5"
              >
                {collapsedSections.section3 ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {!collapsedSections.section3 && (
            <div className="p-2.5 pt-0 border-t border-slate-800/60 space-y-1.5 text-xs">
              <MetricRow
                label="Total Windows"
                value={mto.totalWindowsUnits}
                unit="UNITS"
                cost={
                  isIncluded('fenestration') && isItemIncluded('totalWindows')
                    ? mto.totalWindowsUnits * (activeRates.windowPerUnit.material + activeRates.windowPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('fenestration')}
                itemKey="totalWindows"
                isItemExcluded={!isItemIncluded('totalWindows')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Passage Doors"
                value={mto.passageDoorsUnits}
                unit="UNITS"
                cost={
                  isIncluded('fenestration') && isItemIncluded('passageDoors')
                    ? mto.passageDoorsUnits * (activeRates.passageDoorPerUnit.material + activeRates.passageDoorPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('fenestration')}
                itemKey="passageDoors"
                isItemExcluded={!isItemIncluded('passageDoors')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Pocket Doors"
                value={mto.pocketDoorsUnits}
                unit="UNITS"
                cost={
                  isIncluded('fenestration') && isItemIncluded('pocketDoors')
                    ? mto.pocketDoorsUnits * (activeRates.pocketDoorPerUnit.material + activeRates.pocketDoorPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('fenestration')}
                itemKey="pocketDoors"
                isItemExcluded={!isItemIncluded('pocketDoors')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Exterior Doors"
                value={mto.exteriorDoorsUnits}
                unit="UNITS"
                cost={
                  isIncluded('fenestration') && isItemIncluded('exteriorDoors')
                    ? mto.exteriorDoorsUnits * (activeRates.exteriorDoorPerUnit.material + activeRates.exteriorDoorPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('fenestration')}
                itemKey="exteriorDoors"
                isItemExcluded={!isItemIncluded('exteriorDoors')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Overhead Garage Bays"
                value={mto.overheadGarageBays}
                unit="BAYS"
                cost={
                  isIncluded('fenestration') && isItemIncluded('overheadGarageBays')
                    ? mto.overheadGarageBays * (activeRates.garageDoorPerBay.material + activeRates.garageDoorPerBay.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('fenestration')}
                itemKey="overheadGarageBays"
                isItemExcluded={!isItemIncluded('overheadGarageBays')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Door Hardware Sets"
                value={mto.doorHardwareSets}
                unit="SETS"
                subtext="Locksets & hinges"
                cost={
                  isIncluded('fenestration') && isItemIncluded('doorHardwareSets')
                    ? mto.doorHardwareSets * (activeRates.doorHardwarePerSet.material + activeRates.doorHardwarePerSet.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('fenestration')}
                itemKey="doorHardwareSets"
                isItemExcluded={!isItemIncluded('doorHardwareSets')}
                onToggleItem={onToggleItemInclusion}
              />
            </div>
          )}
        </div>

        {/* Category 4: Electrical, Lighting & Safety */}
        <div
          className={`border rounded-xl overflow-hidden shadow-sm transition-opacity ${
            isIncluded('electricalSafety')
              ? 'bg-slate-950/60 border-slate-800'
              : 'bg-slate-950/30 border-slate-850 opacity-70'
          }`}
        >
          <div className="w-full flex items-center justify-between p-2.5 hover:bg-slate-800/40 transition-colors">
            <button
              onClick={() => toggleSection('section4')}
              className="flex-1 flex items-center gap-2 text-left cursor-pointer"
            >
              <span
                className={`text-xs font-bold flex items-center gap-2 ${
                  isIncluded('electricalSafety') ? 'text-slate-200' : 'text-slate-400 line-through'
                }`}
              >
                <Zap className="w-4 h-4 text-yellow-400" />
                4. Electrical & Safety
              </span>
            </button>
            <div className="flex items-center gap-2">
              {onToggleCategoryInclusion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCategoryInclusion('electricalSafety');
                  }}
                  className="p-0.5 hover:opacity-100 opacity-80 cursor-pointer"
                  title={isIncluded('electricalSafety') ? 'Exclude from financial total' : 'Include in financial total'}
                >
                  {isIncluded('electricalSafety') ? (
                    <ToggleRight className="w-5 h-5 text-sky-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              )}
              {showCostEstimates && (
                <span
                  className={`text-xs font-mono font-semibold ${
                    isIncluded('electricalSafety') ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {isIncluded('electricalSafety')
                    ? `$${costAnalysis.subtotals.electricalSafety.toLocaleString()}`
                    : '$0'}
                </span>
              )}
              <button
                onClick={() => toggleSection('section4')}
                className="cursor-pointer p-0.5"
              >
                {collapsedSections.section4 ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {!collapsedSections.section4 && (
            <div className="p-2.5 pt-0 border-t border-slate-800/60 space-y-1.5 text-xs">
              <MetricRow
                label="Std Switches"
                value={mto.stdSwitchesUnits}
                unit="UNITS"
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('stdSwitches')
                    ? mto.stdSwitchesUnits * (activeRates.switchPerUnit.material + activeRates.switchPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="stdSwitches"
                isItemExcluded={!isItemIncluded('stdSwitches')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Dimmers"
                value={mto.dimmersUnits}
                unit="UNITS"
                cost={0}
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="dimmers"
                isItemExcluded={!isItemIncluded('dimmers')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Std Outlets (120V)"
                value={mto.stdOutletsUnits}
                unit="UNITS"
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('stdOutlets')
                    ? mto.stdOutletsUnits * (activeRates.outletPerUnit.material + activeRates.outletPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="stdOutlets"
                isItemExcluded={!isItemIncluded('stdOutlets')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="GFCI Outlets"
                value={mto.gfciOutletsUnits}
                unit="UNITS"
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('gfciOutlets')
                    ? mto.gfciOutletsUnits * (activeRates.gfciPerUnit.material + activeRates.gfciPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="gfciOutlets"
                isItemExcluded={!isItemIncluded('gfciOutlets')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="24V/240V Heavy Outlets"
                value={mto.heavyOutlets24vUnits}
                unit="UNITS"
                cost={0}
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="heavyOutlets24v"
                isItemExcluded={!isItemIncluded('heavyOutlets24v')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="EV Level 2 Chargers"
                value={mto.evChargersUnits}
                unit="UNITS"
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('evChargers')
                    ? mto.evChargersUnits * (activeRates.evChargerPerUnit.material + activeRates.evChargerPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="evChargers"
                isItemExcluded={!isItemIncluded('evChargers')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Fixtures / Sconces"
                value={mto.fixturesSconcesUnits}
                unit="UNITS"
                cost={0}
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="fixturesSconces"
                isItemExcluded={!isItemIncluded('fixturesSconces')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Exterior Coach Lights"
                value={mto.exteriorCoachLightsUnits}
                unit="UNITS"
                cost={0}
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="exteriorCoachLights"
                isItemExcluded={!isItemIncluded('exteriorCoachLights')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Soffit Lights"
                value={mto.soffitLightsUnits}
                unit="UNITS"
                cost={0}
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="soffitLights"
                isItemExcluded={!isItemIncluded('soffitLights')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Potlights (Recessed)"
                value={mto.potlightsUnits}
                unit="UNITS"
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('potlights')
                    ? mto.potlightsUnits * (activeRates.potlightPerUnit.material + activeRates.potlightPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="potlights"
                isItemExcluded={!isItemIncluded('potlights')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Ceiling Fans"
                value={mto.ceilingFansUnits}
                unit="UNITS"
                cost={0}
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="ceilingFans"
                isItemExcluded={!isItemIncluded('ceilingFans')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Spot Exhaust Fans"
                value={mto.spotExhaustFansUnits}
                unit="UNITS"
                cost={0}
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="spotExhaustFans"
                isItemExcluded={!isItemIncluded('spotExhaustFans')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Range Hoods"
                value={mto.rangeHoodsUnits}
                unit="UNITS"
                cost={0}
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="rangeHoods"
                isItemExcluded={!isItemIncluded('rangeHoods')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Smoke / CO Alarms"
                value={mto.smokeCoAlarmsUnits}
                unit="UNITS"
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('smokeCoAlarms')
                    ? mto.smokeCoAlarmsUnits * (activeRates.smokeAlarmPerUnit.material + activeRates.smokeAlarmPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="smokeCoAlarms"
                isItemExcluded={!isItemIncluded('smokeCoAlarms')}
                onToggleItem={onToggleItemInclusion}
              />
            </div>
          )}
        </div>

        {/* Category 5: Mechanical Plumbing & Civil */}
        <div
          className={`border rounded-xl overflow-hidden shadow-sm transition-opacity ${
            isIncluded('plumbingCivil')
              ? 'bg-slate-950/60 border-slate-800'
              : 'bg-slate-950/30 border-slate-850 opacity-70'
          }`}
        >
          <div className="w-full flex items-center justify-between p-2.5 hover:bg-slate-800/40 transition-colors">
            <button
              onClick={() => toggleSection('section5')}
              className="flex-1 flex items-center gap-2 text-left cursor-pointer"
            >
              <span
                className={`text-xs font-bold flex items-center gap-2 ${
                  isIncluded('plumbingCivil') ? 'text-slate-200' : 'text-slate-400 line-through'
                }`}
              >
                <Droplets className="w-4 h-4 text-cyan-400" />
                5. Plumbing & Civil
              </span>
            </button>
            <div className="flex items-center gap-2">
              {onToggleCategoryInclusion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCategoryInclusion('plumbingCivil');
                  }}
                  className="p-0.5 hover:opacity-100 opacity-80 cursor-pointer"
                  title={isIncluded('plumbingCivil') ? 'Exclude from financial total' : 'Include in financial total'}
                >
                  {isIncluded('plumbingCivil') ? (
                    <ToggleRight className="w-5 h-5 text-sky-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              )}
              {showCostEstimates && (
                <span
                  className={`text-xs font-mono font-semibold ${
                    isIncluded('plumbingCivil') ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {isIncluded('plumbingCivil')
                    ? `$${costAnalysis.subtotals.plumbingCivil.toLocaleString()}`
                    : '$0'}
                </span>
              )}
              <button
                onClick={() => toggleSection('section5')}
                className="cursor-pointer p-0.5"
              >
                {collapsedSections.section5 ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {!collapsedSections.section5 && (
            <div className="p-2.5 pt-0 border-t border-slate-800/60 space-y-1.5 text-xs">
              <MetricRow
                label="Plumbing Fixtures"
                value={mto.plumbingFixturesUnits}
                unit="UNITS"
                cost={
                  isIncluded('plumbingCivil') && isItemIncluded('plumbingFixtures')
                    ? mto.plumbingFixturesUnits * (activeRates.plumbingPerFixture.material + activeRates.plumbingPerFixture.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('plumbingCivil')}
                itemKey="plumbingFixtures"
                isItemExcluded={!isItemIncluded('plumbingFixtures')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Utility Trenching"
                value={mto.utilityTrenchingLf}
                unit="LF"
                cost={
                  isIncluded('plumbingCivil') && isItemIncluded('utilityTrenching')
                    ? mto.utilityTrenchingLf * (activeRates.utilityTrenchPerLf.material + activeRates.utilityTrenchPerLf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('plumbingCivil')}
                itemKey="utilityTrenching"
                isItemExcluded={!isItemIncluded('utilityTrenching')}
                onToggleItem={onToggleItemInclusion}
              />
            </div>
          )}
        </div>

        {/* Category 6: Concrete & Foundations */}
        <div
          className={`border rounded-xl overflow-hidden shadow-sm transition-opacity ${
            isIncluded('concreteFoundations')
              ? 'bg-slate-950/60 border-slate-800'
              : 'bg-slate-950/30 border-slate-850 opacity-70'
          }`}
        >
          <div className="w-full flex items-center justify-between p-2.5 hover:bg-slate-800/40 transition-colors">
            <button
              onClick={() => toggleSection('section6')}
              className="flex-1 flex items-center gap-2 text-left cursor-pointer"
            >
              <span
                className={`text-xs font-bold flex items-center gap-2 ${
                  isIncluded('concreteFoundations') ? 'text-slate-200' : 'text-slate-400 line-through'
                }`}
              >
                <Building2 className="w-4 h-4 text-indigo-400" />
                6. Concrete & Foundations
              </span>
            </button>
            <div className="flex items-center gap-2">
              {onToggleCategoryInclusion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCategoryInclusion('concreteFoundations');
                  }}
                  className="p-0.5 hover:opacity-100 opacity-80 cursor-pointer"
                  title={isIncluded('concreteFoundations') ? 'Exclude from financial total' : 'Include in financial total'}
                >
                  {isIncluded('concreteFoundations') ? (
                    <ToggleRight className="w-5 h-5 text-sky-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              )}
              {showCostEstimates && (
                <span
                  className={`text-xs font-mono font-semibold ${
                    isIncluded('concreteFoundations') ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {isIncluded('concreteFoundations')
                    ? `$${costAnalysis.subtotals.concreteFoundations.toLocaleString()}`
                    : '$0'}
                </span>
              )}
              <button
                onClick={() => toggleSection('section6')}
                className="cursor-pointer p-0.5"
              >
                {collapsedSections.section6 ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {!collapsedSections.section6 && (
            <div className="p-2.5 pt-0 border-t border-slate-800/60 space-y-1.5 text-xs">
              <MetricRow
                label="Poured Concrete"
                value={mto.pouredConcreteCy}
                unit="CY"
                subtext={`${state.settings.slabThicknessInches}&quot; Slab + Footings`}
                cost={
                  isIncluded('concreteFoundations') && isItemIncluded('pouredConcreteCy')
                    ? mto.pouredConcreteCy * (activeRates.concretePerCy.material + activeRates.concretePerCy.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('concreteFoundations')}
                itemKey="pouredConcreteCy"
                isItemExcluded={!isItemIncluded('pouredConcreteCy')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Helical Piers / Piles"
                value={mto.helicalPiersPiles}
                unit="# PIERS"
                cost={
                  isIncluded('concreteFoundations') && isItemIncluded('helicalPiersPiles')
                    ? mto.helicalPiersPiles * (activeRates.pierPerUnit.material + activeRates.pierPerUnit.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('concreteFoundations')}
                itemKey="helicalPiersPiles"
                isItemExcluded={!isItemIncluded('helicalPiersPiles')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Foundation & Slab Insulation"
                value={mto.foundationSlabInsulationSf}
                unit="SF"
                cost={0}
                isCategoryExcluded={!isIncluded('concreteFoundations')}
                itemKey="foundationSlabInsulation"
                isItemExcluded={!isItemIncluded('foundationSlabInsulation')}
                onToggleItem={onToggleItemInclusion}
              />
            </div>
          )}
        </div>

        {/* Category 7: Roofing, Facades & Site Envelope */}
        <div
          className={`border rounded-xl overflow-hidden shadow-sm transition-opacity ${
            isIncluded('roofingEnvelope')
              ? 'bg-slate-950/60 border-slate-800'
              : 'bg-slate-950/30 border-slate-850 opacity-70'
          }`}
        >
          <div className="w-full flex items-center justify-between p-2.5 hover:bg-slate-800/40 transition-colors">
            <button
              onClick={() => toggleSection('section7')}
              className="flex-1 flex items-center gap-2 text-left cursor-pointer"
            >
              <span
                className={`text-xs font-bold flex items-center gap-2 ${
                  isIncluded('roofingEnvelope') ? 'text-slate-200' : 'text-slate-400 line-through'
                }`}
              >
                <Home className="w-4 h-4 text-rose-400" />
                7. Roofing & Site Envelope
              </span>
            </button>
            <div className="flex items-center gap-2">
              {onToggleCategoryInclusion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCategoryInclusion('roofingEnvelope');
                  }}
                  className="p-0.5 hover:opacity-100 opacity-80 cursor-pointer"
                  title={isIncluded('roofingEnvelope') ? 'Exclude from financial total' : 'Include in financial total'}
                >
                  {isIncluded('roofingEnvelope') ? (
                    <ToggleRight className="w-5 h-5 text-sky-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              )}
              {showCostEstimates && (
                <span
                  className={`text-xs font-mono font-semibold ${
                    isIncluded('roofingEnvelope') ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {isIncluded('roofingEnvelope')
                    ? `$${costAnalysis.subtotals.roofingEnvelope.toLocaleString()}`
                    : '$0'}
                </span>
              )}
              <button
                onClick={() => toggleSection('section7')}
                className="cursor-pointer p-0.5"
              >
                {collapsedSections.section7 ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {!collapsedSections.section7 && (
            <div className="p-2.5 pt-0 border-t border-slate-800/60 space-y-1.5 text-xs">
              <MetricRow
                label="Roofing Area"
                value={mto.roofingAreaSq}
                unit="SQ"
                subtext={`${mto.roofingAreaSf} SF (${state.settings.roofPitchScale}:12 pitch)`}
                cost={
                  isIncluded('roofingEnvelope') && isItemIncluded('roofingArea')
                    ? mto.roofingAreaSq * (activeRates.roofingPerSq.material + activeRates.roofingPerSq.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('roofingEnvelope')}
                itemKey="roofingArea"
                isItemExcluded={!isItemIncluded('roofingArea')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Primary Siding"
                value={mto.primarySidingSf}
                unit="SF"
                subtext="Net exterior walls"
                cost={
                  isIncluded('roofingEnvelope') && isItemIncluded('primarySiding')
                    ? mto.primarySidingSf * (activeRates.sidingPerSf.material + activeRates.sidingPerSf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('roofingEnvelope')}
                itemKey="primarySiding"
                isItemExcluded={!isItemIncluded('primarySiding')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Stone / Brick Veneer"
                value={mto.stoneBrickVeneerSf}
                unit="SF"
                cost={0}
                isCategoryExcluded={!isIncluded('roofingEnvelope')}
                itemKey="stoneBrickVeneer"
                isItemExcluded={!isItemIncluded('stoneBrickVeneer')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Soffit Total"
                value={mto.soffitTotalLf}
                unit="LF"
                cost={0}
                isCategoryExcluded={!isIncluded('roofingEnvelope')}
                itemKey="soffitFasciaEaves"
                isItemExcluded={!isItemIncluded('soffitFasciaEaves')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Fascia Total"
                value={mto.fasciaTotalLf}
                unit="LF"
                cost={0}
                isCategoryExcluded={!isIncluded('roofingEnvelope')}
                itemKey="soffitFasciaEaves"
                isItemExcluded={!isItemIncluded('soffitFasciaEaves')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Eavestroughs"
                value={mto.eavestroughsLf}
                unit="LF"
                cost={0}
                isCategoryExcluded={!isIncluded('roofingEnvelope')}
                itemKey="soffitFasciaEaves"
                isItemExcluded={!isItemIncluded('soffitFasciaEaves')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Timber Decking"
                value={mto.timberDeckingSf}
                unit="SF"
                cost={
                  isIncluded('roofingEnvelope') && isItemIncluded('timberDecking')
                    ? mto.timberDeckingSf * (activeRates.deckingPerSf.material + activeRates.deckingPerSf.labor)
                    : 0
                }
                isCategoryExcluded={!isIncluded('roofingEnvelope')}
                itemKey="timberDecking"
                isItemExcluded={!isItemIncluded('timberDecking')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Deck Perimeter Railing"
                value={mto.deckPerimeterRailingLf}
                unit="LF"
                cost={0}
                isCategoryExcluded={!isIncluded('roofingEnvelope')}
                itemKey="deckRailing"
                isItemExcluded={!isItemIncluded('deckRailing')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Site Hardscaping"
                value={mto.siteHardscapingSf}
                unit="SF"
                cost={0}
                isCategoryExcluded={!isIncluded('roofingEnvelope')}
                itemKey="siteHardscaping"
                isItemExcluded={!isItemIncluded('siteHardscaping')}
                onToggleItem={onToggleItemInclusion}
              />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

interface MetricRowProps {
  label: string;
  value: number;
  unit: string;
  subtext?: string;
  cost?: number;
  isCategoryExcluded?: boolean;
  itemKey?: keyof ItemInclusions;
  isItemExcluded?: boolean;
  onToggleItem?: (key: keyof ItemInclusions) => void;
}

const MetricRow: React.FC<MetricRowProps> = ({
  label,
  value,
  unit,
  subtext,
  cost,
  isCategoryExcluded,
  itemKey,
  isItemExcluded,
  onToggleItem,
}) => {
  const isExcluded = isCategoryExcluded || isItemExcluded;

  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-850/80 last:border-0 hover:bg-slate-900/60 px-1.5 rounded transition-colors group">
      <div className="flex items-center gap-1.5 min-w-0 pr-1">
        {itemKey && onToggleItem && (
          <button
            onClick={() => onToggleItem(itemKey)}
            disabled={isCategoryExcluded}
            className={`p-0.5 rounded cursor-pointer transition-colors ${
              isCategoryExcluded
                ? 'opacity-30 cursor-not-allowed text-slate-600'
                : isItemExcluded
                ? 'text-slate-600 hover:text-slate-400'
                : 'text-sky-400 hover:text-sky-300'
            }`}
            title={
              isCategoryExcluded
                ? 'Parent trade package is excluded'
                : isItemExcluded
                ? `Include ${label} in financial total`
                : `Exclude ${label} from financial total`
            }
          >
            {isItemExcluded || isCategoryExcluded ? (
              <ToggleLeft className="w-3.5 h-3.5" />
            ) : (
              <ToggleRight className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        <div className="min-w-0">
          <div
            className={`font-medium truncate ${
              isExcluded ? 'text-slate-500 line-through' : 'text-slate-300'
            }`}
          >
            {label}
          </div>
          {subtext && <div className="text-[10px] text-slate-500 truncate">{subtext}</div>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-baseline justify-end gap-1">
          <span className="font-mono font-bold text-sky-400">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          <span className="text-[10px] font-semibold text-slate-400">{unit}</span>
        </div>
        {isExcluded ? (
          <div className="text-[10px] font-mono text-slate-500 italic">
            {isCategoryExcluded ? '(Trade Excluded)' : '(Line Excluded)'}
          </div>
        ) : cost !== undefined && cost > 0 ? (
          <div className="text-[10px] font-mono text-emerald-400 font-medium">
            ${Math.round(cost).toLocaleString()}
          </div>
        ) : null}
      </div>
    </div>
  );
};
