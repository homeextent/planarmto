import React, { useState } from 'react';
import { MTOReport, UnitCostRates, FloorplanState, CategoryInclusions, ItemInclusions } from '../types';
import { calculateEstimatedCost } from '../engine/estimator';
import { DEFAULT_UNIT_COST_RATES } from '../constants/rates';
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
  const costAnalysis = calculateEstimatedCost(mto, costRates, inclusions, itemInclusions, state.settings, state.stamps);
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
        '1/2" Standard Drywall Board',
        mto.drywall12Sf,
        'SF',
        r.drywall12PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywall12PerSf.material,
        r.drywall12PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywall12PerSf.labor,
        ((r.drywall12PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywall12PerSf.material) + (r.drywall12PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywall12PerSf.labor)).toFixed(2),
        (mto.drywall12Sf * (r.drywall12PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywall12PerSf.material) * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
        (mto.drywall12Sf * (r.drywall12PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywall12PerSf.labor) * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
        (mto.drywall12Sf * ((r.drywall12PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywall12PerSf.material) + (r.drywall12PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywall12PerSf.labor)) * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
      ],
      [
        '1. Board & Finishes',
        '5/8" Type X Fire-Rated Board',
        mto.drywall58Sf,
        'SF',
        r.drywall58PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywall58PerSf.material,
        r.drywall58PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywall58PerSf.labor,
        ((r.drywall58PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywall58PerSf.material) + (r.drywall58PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywall58PerSf.labor)).toFixed(2),
        (mto.drywall58Sf * (r.drywall58PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywall58PerSf.material) * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
        (mto.drywall58Sf * (r.drywall58PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywall58PerSf.labor) * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
        (mto.drywall58Sf * ((r.drywall58PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywall58PerSf.material) + (r.drywall58PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywall58PerSf.labor)) * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
      ],
      [
        '1. Board & Finishes',
        '1/2" Moisture Board / Greenboard',
        mto.drywallGreenboard12Sf,
        'SF',
        r.drywallGreenboard12PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywallGreenboard12PerSf.material,
        r.drywallGreenboard12PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywallGreenboard12PerSf.labor,
        ((r.drywallGreenboard12PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywallGreenboard12PerSf.material) + (r.drywallGreenboard12PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywallGreenboard12PerSf.labor)).toFixed(2),
        (mto.drywallGreenboard12Sf * (r.drywallGreenboard12PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywallGreenboard12PerSf.material) * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
        (mto.drywallGreenboard12Sf * (r.drywallGreenboard12PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywallGreenboard12PerSf.labor) * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
        (mto.drywallGreenboard12Sf * ((r.drywallGreenboard12PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywallGreenboard12PerSf.material) + (r.drywallGreenboard12PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywallGreenboard12PerSf.labor)) * (1 + state.settings.wasteFactorPercentage / 100)).toFixed(2),
      ],
      [
        '1. Board & Finishes',
        'Paint Coverage (Primer + 2 Coats)',
        mto.paintCoverageSf,
        'SF',
        r.paintPerSf?.material ?? DEFAULT_UNIT_COST_RATES.paintPerSf.material,
        r.paintPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.paintPerSf.labor,
        ((r.paintPerSf?.material ?? DEFAULT_UNIT_COST_RATES.paintPerSf.material) + (r.paintPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.paintPerSf.labor)).toFixed(2),
        (mto.paintCoverageSf * (r.paintPerSf?.material ?? DEFAULT_UNIT_COST_RATES.paintPerSf.material)).toFixed(2),
        (mto.paintCoverageSf * (r.paintPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.paintPerSf.labor)).toFixed(2),
        (mto.paintCoverageSf * ((r.paintPerSf?.material ?? DEFAULT_UNIT_COST_RATES.paintPerSf.material) + (r.paintPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.paintPerSf.labor))).toFixed(2),
      ],
      [
        '1. Board & Finishes',
        'Flooring Package',
        mto.flooringPackageSf,
        'SF',
        r.flooringPerSf?.material ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.material,
        r.flooringPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.labor,
        ((r.flooringPerSf?.material ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.material) + (r.flooringPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.labor)).toFixed(2),
        (mto.flooringPackageSf * (r.flooringPerSf?.material ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.material)).toFixed(2),
        (mto.flooringPackageSf * (r.flooringPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.labor)).toFixed(2),
        (mto.flooringPackageSf * ((r.flooringPerSf?.material ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.material) + (r.flooringPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.labor))).toFixed(2),
      ],
      [
        '1. Board & Finishes',
        'Ext. Wall Insulation (R-20)',
        mto.extWallInsulationSf,
        'SF',
        r.extInsulationPerSf?.material ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.material,
        r.extInsulationPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.labor,
        ((r.extInsulationPerSf?.material ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.material) + (r.extInsulationPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.labor)).toFixed(2),
        (mto.extWallInsulationSf * (r.extInsulationPerSf?.material ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.material)).toFixed(2),
        (mto.extWallInsulationSf * (r.extInsulationPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.labor)).toFixed(2),
        (mto.extWallInsulationSf * ((r.extInsulationPerSf?.material ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.material) + (r.extInsulationPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.labor))).toFixed(2),
      ],
      [
        '1. Board & Finishes',
        'Resilient Channel (RC-1)',
        mto.resilientChannelLf,
        'LF',
        r.resilientChannelPerLf?.material ?? DEFAULT_UNIT_COST_RATES.resilientChannelPerLf.material,
        r.resilientChannelPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.resilientChannelPerLf.labor,
        ((r.resilientChannelPerLf?.material ?? DEFAULT_UNIT_COST_RATES.resilientChannelPerLf.material) + (r.resilientChannelPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.resilientChannelPerLf.labor)).toFixed(2),
        (mto.resilientChannelLf * (r.resilientChannelPerLf?.material ?? DEFAULT_UNIT_COST_RATES.resilientChannelPerLf.material)).toFixed(2),
        (mto.resilientChannelLf * (r.resilientChannelPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.resilientChannelPerLf.labor)).toFixed(2),
        (mto.resilientChannelLf * ((r.resilientChannelPerLf?.material ?? DEFAULT_UNIT_COST_RATES.resilientChannelPerLf.material) + (r.resilientChannelPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.resilientChannelPerLf.labor))).toFixed(2),
      ],

      // 2. Carpentry
      [
        '2. Carpentry & Framing',
        'Wall Stud Framing',
        mto.wallStudFramingLf,
        'LF',
        r.studFramingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.material,
        r.studFramingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.labor,
        ((r.studFramingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.material) + (r.studFramingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.labor)).toFixed(2),
        (mto.wallStudFramingLf * (r.studFramingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.material)).toFixed(2),
        (mto.wallStudFramingLf * (r.studFramingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.labor)).toFixed(2),
        (mto.wallStudFramingLf * ((r.studFramingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.material) + (r.studFramingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.labor))).toFixed(2),
      ],
      [
        '2. Carpentry & Framing',
        'OSB Subfloor Decking',
        mto.osbSubfloorDeckingSf,
        'SF',
        r.osbSubfloorPerSf?.material ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.material,
        r.osbSubfloorPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.labor,
        ((r.osbSubfloorPerSf?.material ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.material) + (r.osbSubfloorPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.labor)).toFixed(2),
        (mto.osbSubfloorDeckingSf * (r.osbSubfloorPerSf?.material ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.material)).toFixed(2),
        (mto.osbSubfloorDeckingSf * (r.osbSubfloorPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.labor)).toFixed(2),
        (mto.osbSubfloorDeckingSf * ((r.osbSubfloorPerSf?.material ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.material) + (r.osbSubfloorPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.labor))).toFixed(2),
      ],
      [
        '2. Carpentry & Framing',
        'Structural Beams',
        mto.structuralBeamsLf,
        'LF',
        r.beamPerLf?.material ?? DEFAULT_UNIT_COST_RATES.beamPerLf.material,
        r.beamPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.beamPerLf.labor,
        ((r.beamPerLf?.material ?? DEFAULT_UNIT_COST_RATES.beamPerLf.material) + (r.beamPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.beamPerLf.labor)).toFixed(2),
        (mto.structuralBeamsLf * (r.beamPerLf?.material ?? DEFAULT_UNIT_COST_RATES.beamPerLf.material)).toFixed(2),
        (mto.structuralBeamsLf * (r.beamPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.beamPerLf.labor)).toFixed(2),
        (mto.structuralBeamsLf * ((r.beamPerLf?.material ?? DEFAULT_UNIT_COST_RATES.beamPerLf.material) + (r.beamPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.beamPerLf.labor))).toFixed(2),
      ],
      [
        '2. Carpentry & Framing',
        'Support Columns / Posts',
        mto.supportColumnsPosts,
        'POSTS',
        r.postPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.postPerUnit.material,
        r.postPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.postPerUnit.labor,
        ((r.postPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.postPerUnit.material) + (r.postPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.postPerUnit.labor)).toFixed(2),
        (mto.supportColumnsPosts * (r.postPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.postPerUnit.material)).toFixed(2),
        (mto.supportColumnsPosts * (r.postPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.postPerUnit.labor)).toFixed(2),
        (mto.supportColumnsPosts * ((r.postPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.postPerUnit.material) + (r.postPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.postPerUnit.labor))).toFixed(2),
      ],
      [
        '2. Carpentry & Framing',
        'Baseboard Trims',
        mto.baseboardTrimsLf,
        'LF',
        r.baseboardPerLf?.material ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.material,
        r.baseboardPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.labor,
        ((r.baseboardPerLf?.material ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.material) + (r.baseboardPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.labor)).toFixed(2),
        (mto.baseboardTrimsLf * (r.baseboardPerLf?.material ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.material)).toFixed(2),
        (mto.baseboardTrimsLf * (r.baseboardPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.labor)).toFixed(2),
        (mto.baseboardTrimsLf * ((r.baseboardPerLf?.material ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.material) + (r.baseboardPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.labor))).toFixed(2),
      ],
      [
        '2. Carpentry & Framing',
        'Aperture Casing',
        mto.apertureCasingLf,
        'LF',
        r.casingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.casingPerLf.material,
        r.casingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.casingPerLf.labor,
        ((r.casingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.casingPerLf.material) + (r.casingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.casingPerLf.labor)).toFixed(2),
        (mto.apertureCasingLf * (r.casingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.casingPerLf.material)).toFixed(2),
        (mto.apertureCasingLf * (r.casingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.casingPerLf.labor)).toFixed(2),
        (mto.apertureCasingLf * ((r.casingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.casingPerLf.material) + (r.casingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.casingPerLf.labor))).toFixed(2),
      ],
      [
        '2. Carpentry & Framing',
        'Calculated Stair Risers',
        mto.calculatedStairRisers,
        'RISERS',
        r.stairRiserPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.material,
        r.stairRiserPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.labor,
        ((r.stairRiserPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.material) + (r.stairRiserPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.labor)).toFixed(2),
        (mto.calculatedStairRisers * (r.stairRiserPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.material)).toFixed(2),
        (mto.calculatedStairRisers * (r.stairRiserPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.labor)).toFixed(2),
        (mto.calculatedStairRisers * ((r.stairRiserPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.material) + (r.stairRiserPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.labor))).toFixed(2),
      ],

      // 3. Fenestration
      [
        '3. Apertures & Fenestration',
        'Total Windows (6 SF Min Floor)',
        mto.totalWindowsSf,
        'SF',
        r.windowPerSf?.material ?? DEFAULT_UNIT_COST_RATES.windowPerSf.material,
        r.windowPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.windowPerSf.labor,
        ((r.windowPerSf?.material ?? DEFAULT_UNIT_COST_RATES.windowPerSf.material) + (r.windowPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.windowPerSf.labor)).toFixed(2),
        (mto.totalWindowsSf * (r.windowPerSf?.material ?? DEFAULT_UNIT_COST_RATES.windowPerSf.material)).toFixed(2),
        (mto.totalWindowsSf * (r.windowPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.windowPerSf.labor)).toFixed(2),
        (mto.totalWindowsSf * ((r.windowPerSf?.material ?? DEFAULT_UNIT_COST_RATES.windowPerSf.material) + (r.windowPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.windowPerSf.labor))).toFixed(2),
      ],
      [
        '3. Apertures & Fenestration',
        'Passage Doors',
        mto.passageDoorsUnits,
        'UNITS',
        r.passageDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.material,
        r.passageDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.labor,
        ((r.passageDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.material) + (r.passageDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.labor)).toFixed(2),
        (mto.passageDoorsUnits * (r.passageDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.material)).toFixed(2),
        (mto.passageDoorsUnits * (r.passageDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.labor)).toFixed(2),
        (mto.passageDoorsUnits * ((r.passageDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.material) + (r.passageDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.labor))).toFixed(2),
      ],
      [
        '3. Apertures & Fenestration',
        'Pocket Doors',
        mto.pocketDoorsUnits,
        'UNITS',
        r.pocketDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.material,
        r.pocketDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.labor,
        ((r.pocketDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.material) + (r.pocketDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.labor)).toFixed(2),
        (mto.pocketDoorsUnits * (r.pocketDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.material)).toFixed(2),
        (mto.pocketDoorsUnits * (r.pocketDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.labor)).toFixed(2),
        (mto.pocketDoorsUnits * ((r.pocketDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.material) + (r.pocketDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.labor))).toFixed(2),
      ],
      [
        '3. Apertures & Fenestration',
        'Exterior Doors',
        mto.exteriorDoorsUnits,
        'UNITS',
        r.exteriorDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.material,
        r.exteriorDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.labor,
        ((r.exteriorDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.material) + (r.exteriorDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.labor)).toFixed(2),
        (mto.exteriorDoorsUnits * (r.exteriorDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.material)).toFixed(2),
        (mto.exteriorDoorsUnits * (r.exteriorDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.labor)).toFixed(2),
        (mto.exteriorDoorsUnits * ((r.exteriorDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.material) + (r.exteriorDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.labor))).toFixed(2),
      ],
      [
        '3. Apertures & Fenestration',
        'Overhead Garage Bays',
        mto.overheadGarageBays,
        'BAYS',
        r.garageDoorPerBay?.material ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.material,
        r.garageDoorPerBay?.labor ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.labor,
        ((r.garageDoorPerBay?.material ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.material) + (r.garageDoorPerBay?.labor ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.labor)).toFixed(2),
        (mto.overheadGarageBays * (r.garageDoorPerBay?.material ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.material)).toFixed(2),
        (mto.overheadGarageBays * (r.garageDoorPerBay?.labor ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.labor)).toFixed(2),
        (mto.overheadGarageBays * ((r.garageDoorPerBay?.material ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.material) + (r.garageDoorPerBay?.labor ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.labor))).toFixed(2),
      ],
      [
        '3. Apertures & Fenestration',
        'Door Hardware Sets',
        mto.doorHardwareSets,
        'SETS',
        r.doorHardwarePerSet?.material ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.material,
        r.doorHardwarePerSet?.labor ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.labor,
        ((r.doorHardwarePerSet?.material ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.material) + (r.doorHardwarePerSet?.labor ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.labor)).toFixed(2),
        (mto.doorHardwareSets * (r.doorHardwarePerSet?.material ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.material)).toFixed(2),
        (mto.doorHardwareSets * (r.doorHardwarePerSet?.labor ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.labor)).toFixed(2),
        (mto.doorHardwareSets * ((r.doorHardwarePerSet?.material ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.material) + (r.doorHardwarePerSet?.labor ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.labor))).toFixed(2),
      ],

      // 4. Electrical
      [
        '4. Electrical & Safety',
        'Std Switches',
        mto.stdSwitchesUnits,
        'UNITS',
        r.switchPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.material,
        r.switchPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.labor,
        ((r.switchPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.material) + (r.switchPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.labor)).toFixed(2),
        (mto.stdSwitchesUnits * (r.switchPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.material)).toFixed(2),
        (mto.stdSwitchesUnits * (r.switchPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.labor)).toFixed(2),
        (mto.stdSwitchesUnits * ((r.switchPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.material) + (r.switchPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.labor))).toFixed(2),
      ],
      [
        '4. Electrical & Safety',
        '3-Way Switches',
        mto.switch3WayUnits,
        'UNITS',
        r.switch3Way?.material ?? DEFAULT_UNIT_COST_RATES.switch3Way.material,
        r.switch3Way?.labor ?? DEFAULT_UNIT_COST_RATES.switch3Way.labor,
        ((r.switch3Way?.material ?? DEFAULT_UNIT_COST_RATES.switch3Way.material) + (r.switch3Way?.labor ?? DEFAULT_UNIT_COST_RATES.switch3Way.labor)).toFixed(2),
        (mto.switch3WayUnits * (r.switch3Way?.material ?? DEFAULT_UNIT_COST_RATES.switch3Way.material)).toFixed(2),
        (mto.switch3WayUnits * (r.switch3Way?.labor ?? DEFAULT_UNIT_COST_RATES.switch3Way.labor)).toFixed(2),
        (mto.switch3WayUnits * ((r.switch3Way?.material ?? DEFAULT_UNIT_COST_RATES.switch3Way.material) + (r.switch3Way?.labor ?? DEFAULT_UNIT_COST_RATES.switch3Way.labor))).toFixed(2),
      ],
      [
        '4. Electrical & Safety',
        'Std Outlets (120V)',
        mto.stdOutletsUnits,
        'UNITS',
        r.outletPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.material,
        r.outletPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.labor,
        ((r.outletPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.material) + (r.outletPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.labor)).toFixed(2),
        (mto.stdOutletsUnits * (r.outletPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.material)).toFixed(2),
        (mto.stdOutletsUnits * (r.outletPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.labor)).toFixed(2),
        (mto.stdOutletsUnits * ((r.outletPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.material) + (r.outletPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.labor))).toFixed(2),
      ],
      [
        '4. Electrical & Safety',
        'GFCI Outlets',
        mto.gfciOutletsUnits,
        'UNITS',
        r.gfciPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.material,
        r.gfciPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.labor,
        ((r.gfciPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.material) + (r.gfciPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.labor)).toFixed(2),
        (mto.gfciOutletsUnits * (r.gfciPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.material)).toFixed(2),
        (mto.gfciOutletsUnits * (r.gfciPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.labor)).toFixed(2),
        (mto.gfciOutletsUnits * ((r.gfciPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.material) + (r.gfciPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.labor))).toFixed(2),
      ],
      [
        '4. Electrical & Safety',
        'EV Level 2 Chargers',
        mto.evChargersUnits,
        'UNITS',
        r.evChargerPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.evChargerPerUnit.material,
        r.evChargerPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.evChargerPerUnit.labor,
        ((r.evChargerPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.evChargerPerUnit.material) + (r.evChargerPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.evChargerPerUnit.labor)).toFixed(2),
        (mto.evChargersUnits * (r.evChargerPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.evChargerPerUnit.material)).toFixed(2),
        (mto.evChargersUnits * (r.evChargerPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.evChargerPerUnit.labor)).toFixed(2),
        (mto.evChargersUnits * ((r.evChargerPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.evChargerPerUnit.material) + (r.evChargerPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.evChargerPerUnit.labor))).toFixed(2),
      ],
      [
        '4. Electrical & Safety',
        'Potlights (Slim Recessed)',
        mto.potlightsUnits,
        'UNITS',
        r.potlightPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.material,
        r.potlightPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.labor,
        ((r.potlightPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.material) + (r.potlightPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.labor)).toFixed(2),
        (mto.potlightsUnits * (r.potlightPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.material)).toFixed(2),
        (mto.potlightsUnits * (r.potlightPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.labor)).toFixed(2),
        (mto.potlightsUnits * ((r.potlightPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.material) + (r.potlightPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.labor))).toFixed(2),
      ],
      [
        '4. Electrical & Safety',
        'Smoke & CO Alarms',
        mto.smokeCoAlarmsUnits,
        'UNITS',
        r.smokeAlarmPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.material,
        r.smokeAlarmPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.labor,
        ((r.smokeAlarmPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.material) + (r.smokeAlarmPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.labor)).toFixed(2),
        (mto.smokeCoAlarmsUnits * (r.smokeAlarmPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.material)).toFixed(2),
        (mto.smokeCoAlarmsUnits * (r.smokeAlarmPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.labor)).toFixed(2),
        (mto.smokeCoAlarmsUnits * ((r.smokeAlarmPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.material) + (r.smokeAlarmPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.labor))).toFixed(2),
      ],
      ...mto.panelBreakdown.map((panel: any) => {
        const isSub = panel.type === 'subpanel';
        const amp = panel.amperage;
        let rateKey: keyof UnitCostRates = 'electricalPanelMain200A';
        if (panel.type === 'main') {
          if (amp === '100A') rateKey = 'electricalPanelMain100A';
          else if (amp === '400A') rateKey = 'electricalPanelMain400A';
          else rateKey = 'electricalPanelMain200A';
        } else {
          if (amp === '60A') rateKey = 'electricalPanelSub60A';
          else if (amp === '125A') rateKey = 'electricalPanelSub125A';
          else if (amp === '100A') rateKey = 'electricalPanelSub100A';
          else rateKey = 'electricalPanelSub100A';
        }
        const rate = r[rateKey] || DEFAULT_UNIT_COST_RATES[rateKey];
        const material = rate?.material ?? DEFAULT_UNIT_COST_RATES[rateKey].material;
        const labor = rate?.labor ?? DEFAULT_UNIT_COST_RATES[rateKey].labor;
        return [
          '4. Electrical & Safety',
          `Electrical ${isSub ? 'Subpanel' : 'Main Panel'} - ${amp}`,
          panel.count,
          'UNITS',
          material,
          labor,
          (material + labor).toFixed(2),
          (panel.count * material).toFixed(2),
          (panel.count * labor).toFixed(2),
          (panel.count * (material + labor)).toFixed(2),
        ];
      }),

      // 5. Plumbing
      [
        '5. Plumbing & Civil',
        'Plumbing Fixtures',
        mto.plumbingFixturesUnits,
        'UNITS',
        r.plumbingPerFixture?.material ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.material,
        r.plumbingPerFixture?.labor ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.labor,
        ((r.plumbingPerFixture?.material ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.material) + (r.plumbingPerFixture?.labor ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.labor)).toFixed(2),
        (mto.plumbingFixturesUnits * (r.plumbingPerFixture?.material ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.material)).toFixed(2),
        (mto.plumbingFixturesUnits * (r.plumbingPerFixture?.labor ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.labor)).toFixed(2),
        (mto.plumbingFixturesUnits * ((r.plumbingPerFixture?.material ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.material) + (r.plumbingPerFixture?.labor ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.labor))).toFixed(2),
      ],
      [
        '5. Plumbing & Civil',
        'Utility Trenching',
        mto.utilityTrenchingLf,
        'LF',
        r.utilityTrenchPerLf?.material ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.material,
        r.utilityTrenchPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.labor,
        ((r.utilityTrenchPerLf?.material ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.material) + (r.utilityTrenchPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.labor)).toFixed(2),
        (mto.utilityTrenchingLf * (r.utilityTrenchPerLf?.material ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.material)).toFixed(2),
        (mto.utilityTrenchingLf * (r.utilityTrenchPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.labor)).toFixed(2),
        (mto.utilityTrenchingLf * ((r.utilityTrenchPerLf?.material ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.material) + (r.utilityTrenchPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.labor))).toFixed(2),
      ],

      // 6. Concrete
      [
        '6. Concrete & Foundations',
        'Poured Concrete',
        mto.pouredConcreteCy,
        'CY',
        r.concretePerCy?.material ?? DEFAULT_UNIT_COST_RATES.concretePerCy.material,
        r.concretePerCy?.labor ?? DEFAULT_UNIT_COST_RATES.concretePerCy.labor,
        ((r.concretePerCy?.material ?? DEFAULT_UNIT_COST_RATES.concretePerCy.material) + (r.concretePerCy?.labor ?? DEFAULT_UNIT_COST_RATES.concretePerCy.labor)).toFixed(2),
        (mto.pouredConcreteCy * (r.concretePerCy?.material ?? DEFAULT_UNIT_COST_RATES.concretePerCy.material)).toFixed(2),
        (mto.pouredConcreteCy * (r.concretePerCy?.labor ?? DEFAULT_UNIT_COST_RATES.concretePerCy.labor)).toFixed(2),
        (mto.pouredConcreteCy * ((r.concretePerCy?.material ?? DEFAULT_UNIT_COST_RATES.concretePerCy.material) + (r.concretePerCy?.labor ?? DEFAULT_UNIT_COST_RATES.concretePerCy.labor))).toFixed(2),
      ],
      [
        '6. Concrete & Foundations',
        'Helical Piers / Piles',
        mto.helicalPiersPiles,
        'PIERS',
        r.pierPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.material,
        r.pierPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.labor,
        ((r.pierPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.material) + (r.pierPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.labor)).toFixed(2),
        (mto.helicalPiersPiles * (r.pierPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.material)).toFixed(2),
        (mto.helicalPiersPiles * (r.pierPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.labor)).toFixed(2),
        (mto.helicalPiersPiles * ((r.pierPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.material) + (r.pierPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.labor))).toFixed(2),
      ],

      // 7. Roofing
      [
        '7. Roofing & Envelope',
        'Roofing Area',
        mto.roofingAreaSq,
        'SQ',
        r.roofingPerSq?.material ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.material,
        r.roofingPerSq?.labor ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.labor,
        ((r.roofingPerSq?.material ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.material) + (r.roofingPerSq?.labor ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.labor)).toFixed(2),
        (mto.roofingAreaSq * (r.roofingPerSq?.material ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.material)).toFixed(2),
        (mto.roofingAreaSq * (r.roofingPerSq?.labor ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.labor)).toFixed(2),
        (mto.roofingAreaSq * ((r.roofingPerSq?.material ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.material) + (r.roofingPerSq?.labor ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.labor))).toFixed(2),
      ],
      [
        '7. Roofing & Envelope',
        'Primary Exterior Siding',
        mto.primarySidingSf,
        'SF',
        r.sidingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.material,
        r.sidingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.labor,
        ((r.sidingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.material) + (r.sidingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.labor)).toFixed(2),
        (mto.primarySidingSf * (r.sidingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.material)).toFixed(2),
        (mto.primarySidingSf * (r.sidingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.labor)).toFixed(2),
        (mto.primarySidingSf * ((r.sidingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.material) + (r.sidingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.labor))).toFixed(2),
      ],
      [
        '7. Roofing & Envelope',
        'Timber Decking',
        mto.timberDeckingSf,
        'SF',
        r.deckingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.material,
        r.deckingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.labor,
        ((r.deckingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.material) + (r.deckingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.labor)).toFixed(2),
        (mto.timberDeckingSf * (r.deckingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.material)).toFixed(2),
        (mto.timberDeckingSf * (r.deckingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.labor)).toFixed(2),
        (mto.timberDeckingSf * ((r.deckingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.material) + (r.deckingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.labor))).toFixed(2),
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
          <button
            onClick={handleExportCSV}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs transition-colors cursor-pointer border border-slate-700"
            title="Export Detailed CSV"
          >
            <Download className="w-3.5 h-3.5" />
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
              {mto.drywall12Sf > 0 && (
                <MetricRow
                  label='1/2" Standard Drywall Board'
                  value={mto.drywall12Sf}
                  unit="SF"
                  subtext="Walls & Ceiling"
                  cost={
                    isIncluded('finishes') && isItemIncluded('drywallBoard')
                      ? mto.drywall12Sf * ((activeRates.drywall12PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywall12PerSf.material) + (activeRates.drywall12PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywall12PerSf.labor)) * (1 + state.settings.wasteFactorPercentage / 100)
                      : 0
                  }
                  isCategoryExcluded={!isIncluded('finishes')}
                  itemKey="drywallBoard"
                  isItemExcluded={!isItemIncluded('drywallBoard')}
                  onToggleItem={onToggleItemInclusion}
                />
              )}
              {mto.drywall58Sf > 0 && (
                <MetricRow
                  label='5/8" Type X Fire-Rated Board'
                  value={mto.drywall58Sf}
                  unit="SF"
                  subtext="Fire-rated assembly"
                  cost={
                    isIncluded('finishes') && isItemIncluded('drywallBoard')
                      ? mto.drywall58Sf * ((activeRates.drywall58PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywall58PerSf.material) + (activeRates.drywall58PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywall58PerSf.labor)) * (1 + state.settings.wasteFactorPercentage / 100)
                      : 0
                  }
                  isCategoryExcluded={!isIncluded('finishes')}
                  itemKey="drywallBoard"
                  isItemExcluded={!isItemIncluded('drywallBoard')}
                  onToggleItem={onToggleItemInclusion}
                />
              )}
              {mto.drywallGreenboard12Sf > 0 && (
                <MetricRow
                  label='1/2" Moisture Board / Greenboard'
                  value={mto.drywallGreenboard12Sf}
                  unit="SF"
                  subtext="Greenboard"
                  cost={
                    isIncluded('finishes') && isItemIncluded('drywallBoard')
                      ? mto.drywallGreenboard12Sf * ((activeRates.drywallGreenboard12PerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywallGreenboard12PerSf.material) + (activeRates.drywallGreenboard12PerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywallGreenboard12PerSf.labor)) * (1 + state.settings.wasteFactorPercentage / 100)
                      : 0
                  }
                  isCategoryExcluded={!isIncluded('finishes')}
                  itemKey="drywallBoard"
                  isItemExcluded={!isItemIncluded('drywallBoard')}
                  onToggleItem={onToggleItemInclusion}
                />
              )}
              <MetricRow
                label="Paint Coverage"
                value={mto.paintCoverageSf}
                unit="SF"
                cost={
                  isIncluded('finishes') && isItemIncluded('paintCoverage')
                    ? mto.paintCoverageSf * ((activeRates.paintPerSf?.material ?? DEFAULT_UNIT_COST_RATES.paintPerSf.material) + (activeRates.paintPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.paintPerSf.labor))
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
                    ? mto.flooringPackageSf * ((activeRates.flooringPerSf?.material ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.material) + (activeRates.flooringPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.labor))
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
                    ? mto.extWallInsulationSf * ((activeRates.extInsulationPerSf?.material ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.material) + (activeRates.extInsulationPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.labor))
                    : 0
                }
                isCategoryExcluded={!isIncluded('finishes')}
                itemKey="extWallInsulation"
                isItemExcluded={!isItemIncluded('extWallInsulation')}
                onToggleItem={onToggleItemInclusion}
              />
              {mto.resilientChannelLf > 0 && (
                <MetricRow
                  label="Resilient Channel (RC-1)"
                  value={mto.resilientChannelLf}
                  unit="LF"
                  subtext="Ceiling grid sound bar"
                  cost={
                    isIncluded('finishes')
                      ? mto.resilientChannelLf * ((activeRates.resilientChannelPerLf?.material ?? DEFAULT_UNIT_COST_RATES.resilientChannelPerLf.material) + (activeRates.resilientChannelPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.resilientChannelPerLf.labor))
                      : 0
                  }
                  isCategoryExcluded={!isIncluded('finishes')}
                />
              )}
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
                    ? mto.wallStudFramingLf * ((activeRates.studFramingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.material) + (activeRates.studFramingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.labor))
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
                    ? mto.osbSubfloorDeckingSf * ((activeRates.osbSubfloorPerSf?.material ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.material) + (activeRates.osbSubfloorPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.labor))
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
                    ? mto.structuralBeamsLf * ((activeRates.beamPerLf?.material ?? DEFAULT_UNIT_COST_RATES.beamPerLf.material) + (activeRates.beamPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.beamPerLf.labor))
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
                    ? mto.supportColumnsPosts * ((activeRates.postPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.postPerUnit.material) + (activeRates.postPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.postPerUnit.labor))
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
                    ? mto.baseboardTrimsLf * ((activeRates.baseboardPerLf?.material ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.material) + (activeRates.baseboardPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.labor))
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
                    ? mto.apertureCasingLf * ((activeRates.casingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.casingPerLf.material) + (activeRates.casingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.casingPerLf.labor))
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
                    ? mto.calculatedStairRisers * ((activeRates.stairRiserPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.material) + (activeRates.stairRiserPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.labor))
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
                value={mto.totalWindowsSf}
                unit="SF"
                subtext={`${mto.totalWindowsUnits} Units (6 SF Min)`}
                cost={
                  isIncluded('fenestration') && isItemIncluded('totalWindows')
                    ? mto.totalWindowsSf * ((activeRates.windowPerSf?.material ?? DEFAULT_UNIT_COST_RATES.windowPerSf.material) + (activeRates.windowPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.windowPerSf.labor))
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
                    ? mto.passageDoorsUnits * ((activeRates.passageDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.material) + (activeRates.passageDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.labor))
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
                    ? mto.pocketDoorsUnits * ((activeRates.pocketDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.material) + (activeRates.pocketDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.labor))
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
                    ? mto.exteriorDoorsUnits * ((activeRates.exteriorDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.material) + (activeRates.exteriorDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.labor))
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
                    ? mto.overheadGarageBays * ((activeRates.garageDoorPerBay?.material ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.material) + (activeRates.garageDoorPerBay?.labor ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.labor))
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
                    ? mto.doorHardwareSets * ((activeRates.doorHardwarePerSet?.material ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.material) + (activeRates.doorHardwarePerSet?.labor ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.labor))
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
                    ? mto.stdSwitchesUnits * ((activeRates.switchPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.material) + (activeRates.switchPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.labor))
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
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('dimmers')
                    ? mto.dimmersUnits * ((activeRates.switchPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.material) * 1.5 + (activeRates.switchPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.labor) * 1.2)
                    : 0
                }
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
                    ? mto.stdOutletsUnits * ((activeRates.outletPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.material) + (activeRates.outletPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.labor))
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
                    ? mto.gfciOutletsUnits * ((activeRates.gfciPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.material) + (activeRates.gfciPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.labor))
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
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('heavyOutlets24v')
                    ? mto.heavyOutlets24vUnits * ((activeRates.outletPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.material) * 2.5 + (activeRates.outletPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.labor) * 1.8)
                    : 0
                }
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
                    ? mto.evChargersUnits * ((activeRates.evChargerPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.evChargerPerUnit.material) + (activeRates.evChargerPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.evChargerPerUnit.labor))
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
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('fixturesSconces')
                    ? mto.fixturesSconcesUnits * ((activeRates.fixtureSconce?.material ?? DEFAULT_UNIT_COST_RATES.fixtureSconce.material) + (activeRates.fixtureSconce?.labor ?? DEFAULT_UNIT_COST_RATES.fixtureSconce.labor))
                    : 0
                }
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="fixturesSconces"
                isItemExcluded={!isItemIncluded('fixturesSconces')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Exterior Coach Lights"
                value={mto.exteriorCoachLightsUnits}
                unit="UNITS"
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('exteriorCoachLights')
                    ? mto.exteriorCoachLightsUnits * ((activeRates.exteriorCoachLight?.material ?? DEFAULT_UNIT_COST_RATES.exteriorCoachLight.material) + (activeRates.exteriorCoachLight?.labor ?? DEFAULT_UNIT_COST_RATES.exteriorCoachLight.labor))
                    : 0
                }
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="exteriorCoachLights"
                isItemExcluded={!isItemIncluded('exteriorCoachLights')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Soffit Lights"
                value={mto.soffitLightsUnits}
                unit="UNITS"
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('soffitLights')
                    ? mto.soffitLightsUnits * ((activeRates.soffitLight?.material ?? DEFAULT_UNIT_COST_RATES.soffitLight.material) + (activeRates.soffitLight?.labor ?? DEFAULT_UNIT_COST_RATES.soffitLight.labor))
                    : 0
                }
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
                    ? mto.potlightsUnits * ((activeRates.potlightPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.material) + (activeRates.potlightPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.labor))
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
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('ceilingFans')
                    ? mto.ceilingFansUnits * ((activeRates.ceilingFanPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.ceilingFanPerUnit.material) + (activeRates.ceilingFanPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.ceilingFanPerUnit.labor))
                    : 0
                }
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="ceilingFans"
                isItemExcluded={!isItemIncluded('ceilingFans')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Spot Exhaust Fans"
                value={mto.spotExhaustFansUnits}
                unit="UNITS"
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('spotExhaustFans')
                    ? mto.spotExhaustFansUnits * ((activeRates.exhaustFanPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.exhaustFanPerUnit.material) + (activeRates.exhaustFanPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.exhaustFanPerUnit.labor))
                    : 0
                }
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="spotExhaustFans"
                isItemExcluded={!isItemIncluded('spotExhaustFans')}
                onToggleItem={onToggleItemInclusion}
              />
              <MetricRow
                label="Range Hoods"
                value={mto.rangeHoodsUnits}
                unit="UNITS"
                cost={
                  isIncluded('electricalSafety') && isItemIncluded('rangeHoods')
                    ? mto.rangeHoodsUnits * ((activeRates.rangeHoodPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.rangeHoodPerUnit.material) + (activeRates.rangeHoodPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.rangeHoodPerUnit.labor))
                    : 0
                }
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
                    ? mto.smokeCoAlarmsUnits * ((activeRates.smokeAlarmPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.material) + (activeRates.smokeAlarmPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.labor))
                    : 0
                }
                isCategoryExcluded={!isIncluded('electricalSafety')}
                itemKey="smokeCoAlarms"
                isItemExcluded={!isItemIncluded('smokeCoAlarms')}
                onToggleItem={onToggleItemInclusion}
              />

              {mto.switch3WayUnits > 0 && (
                <MetricRow
                  label="3-Way Switches"
                  value={mto.switch3WayUnits}
                  unit="UNITS"
                  cost={
                    isIncluded('electricalSafety') && isItemIncluded('switch3Way')
                      ? mto.switch3WayUnits * ((activeRates.switch3Way?.material ?? DEFAULT_UNIT_COST_RATES.switch3Way.material) + (activeRates.switch3Way?.labor ?? DEFAULT_UNIT_COST_RATES.switch3Way.labor))
                      : 0
                  }
                  isCategoryExcluded={!isIncluded('electricalSafety')}
                  itemKey="switch3Way"
                  isItemExcluded={!isItemIncluded('switch3Way')}
                  onToggleItem={onToggleItemInclusion}
                />
              )}

              {mto.panelBreakdown.map((panel: any, idx: number) => {
                const isSub = panel.type === 'subpanel';
                const amp = panel.amperage;

                let rateKey: keyof UnitCostRates = 'electricalPanelMain200A';
                if (panel.type === 'main') {
                  if (amp === '100A') rateKey = 'electricalPanelMain100A';
                  else if (amp === '400A') rateKey = 'electricalPanelMain400A';
                  else rateKey = 'electricalPanelMain200A';
                } else {
                  if (amp === '60A') rateKey = 'electricalPanelSub60A';
                  else if (amp === '125A') rateKey = 'electricalPanelSub125A';
                  else if (amp === '100A') rateKey = 'electricalPanelSub100A';
                  else rateKey = 'electricalPanelSub100A';
                }

                const rate = activeRates[rateKey] || DEFAULT_UNIT_COST_RATES[rateKey];
                const panelLabel = `Electrical ${isSub ? 'Subpanel' : 'Main Panel'} - ${amp}`;

                return (
                  <MetricRow
                    key={`${panel.type}-${panel.amperage}-${idx}`}
                    label={panelLabel}
                    value={panel.count}
                    unit="UNIT"
                    cost={
                      isIncluded('electricalSafety') && isItemIncluded('electricalPanels')
                        ? panel.count * ((rate?.material ?? DEFAULT_UNIT_COST_RATES[rateKey].material) + (rate?.labor ?? DEFAULT_UNIT_COST_RATES[rateKey].labor))
                        : 0
                    }
                    isCategoryExcluded={!isIncluded('electricalSafety')}
                    itemKey="electricalPanels"
                    isItemExcluded={!isItemIncluded('electricalPanels')}
                    onToggleItem={onToggleItemInclusion}
                  />
                );
              })}
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
                    ? mto.plumbingFixturesUnits * ((activeRates.plumbingPerFixture?.material ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.material) + (activeRates.plumbingPerFixture?.labor ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.labor))
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
                    ? mto.utilityTrenchingLf * ((activeRates.utilityTrenchPerLf?.material ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.material) + (activeRates.utilityTrenchPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.labor))
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
                    ? mto.pouredConcreteCy * ((activeRates.concretePerCy?.material ?? DEFAULT_UNIT_COST_RATES.concretePerCy.material) + (activeRates.concretePerCy?.labor ?? DEFAULT_UNIT_COST_RATES.concretePerCy.labor))
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
                    ? mto.helicalPiersPiles * ((activeRates.pierPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.material) + (activeRates.pierPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.labor))
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
                    ? mto.roofingAreaSq * ((activeRates.roofingPerSq?.material ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.material) + (activeRates.roofingPerSq?.labor ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.labor))
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
                    ? mto.primarySidingSf * ((activeRates.sidingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.material) + (activeRates.sidingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.labor))
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
                    ? mto.timberDeckingSf * ((activeRates.deckingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.material) + (activeRates.deckingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.labor))
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
