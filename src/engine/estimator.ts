import {
  FloorplanState,
  MTOReport,
  UnitCostRates,
  CategoryInclusions,
  DEFAULT_CATEGORY_INCLUSIONS,
  ItemInclusions,
  DEFAULT_ITEM_INCLUSIONS,
  CadNode,
  CadWall,
  Aperture,
  RoomPolygon,
} from '../types';
import {
  classifyWalls,
  getWallGeometry,
  getApertureGeometry,
  calculatePolygonPerimeter,
} from './cadMath';

export const DEFAULT_UNIT_COST_RATES: UnitCostRates = {
  drywallPerSf: { material: 2.25, labor: 1.0 },
  paintPerSf: { material: 0.5, labor: 0.65 },
  flooringPerSf: { material: 4.25, labor: 2.25 },
  extInsulationPerSf: { material: 1.1, labor: 0.75 },
  studFramingPerLf: { material: 2.6, labor: 2.2 },
  osbSubfloorPerSf: { material: 1.95, labor: 1.25 },
  beamPerLf: { material: 16.0, labor: 12.0 },
  postPerUnit: { material: 85.0, labor: 60.0 },
  baseboardPerLf: { material: 1.75, labor: 2.0 },
  casingPerLf: { material: 2.0, labor: 2.2 },
  stairRiserPerUnit: { material: 35.0, labor: 30.0 },
  windowPerUnit: { material: 270.0, labor: 110.0 },
  passageDoorPerUnit: { material: 135.0, labor: 85.0 },
  pocketDoorPerUnit: { material: 200.0, labor: 140.0 },
  exteriorDoorPerUnit: { material: 550.0, labor: 300.0 },
  garageDoorPerBay: { material: 950.0, labor: 500.0 },
  doorHardwarePerSet: { material: 32.0, labor: 16.0 },
  switchPerUnit: { material: 8.0, labor: 24.0 },
  outletPerUnit: { material: 6.0, labor: 22.0 },
  gfciPerUnit: { material: 22.0, labor: 30.0 },
  evChargerPerUnit: { material: 280.0, labor: 200.0 },
  potlightPerUnit: { material: 25.0, labor: 40.0 },
  plumbingPerFixture: { material: 220.0, labor: 230.0 },
  concretePerCy: { material: 115.0, labor: 60.0 },
  pierPerUnit: { material: 180.0, labor: 140.0 },
  roofingPerSq: { material: 180.0, labor: 160.0 },
  sidingPerSf: { material: 3.75, labor: 3.5 },
  deckingPerSf: { material: 10.5, labor: 8.0 },
  // Extra MEP & Envelope
  ceilingFanPerUnit: { material: 125.0, labor: 60.0 },
  exhaustFanPerUnit: { material: 85.0, labor: 55.0 },
  rangeHoodPerUnit: { material: 220.0, labor: 100.0 },
  smokeAlarmPerUnit: { material: 35.0, labor: 30.0 },
  utilityTrenchPerLf: { material: 10.0, labor: 25.0 },
  soffitPerLf: { material: 4.5, labor: 5.0 },
  fasciaPerLf: { material: 3.5, labor: 4.5 },
  eavestroughPerLf: { material: 5.5, labor: 6.5 },
  deckRailingPerLf: { material: 22.0, labor: 20.0 },
  hardscapePerSf: { material: 6.5, labor: 7.5 },
};

export function calculateMTO(state: FloorplanState): MTOReport {
  const { nodes, walls, apertures, stamps, rooms, decks, hardscapes, settings } = state;
  const isInteriorFinishMode = settings.calculationMode === 'interior_finish';

  const nodeMap = new Map<string, CadNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const wallClassification = classifyWalls(walls, rooms);

  // Group apertures by wallId
  const aperturesByWall = new Map<string, Aperture[]>();
  apertures.forEach((ap) => {
    const list = aperturesByWall.get(ap.wallId) || [];
    list.push(ap);
    aperturesByWall.set(ap.wallId, list);
  });

  // Detailed breakdowns
  const wallDetails: MTOReport['wallDetails'] = [];

  let totalWallStudFramingLf = 0;
  let totalStudCount = 0;
  let totalDrywallBoardSf = 0;
  let totalExtWallInsulationSf = 0;
  let totalPrimarySidingSf = 0;
  let totalStoneBrickVeneerSf = 0;
  let totalExteriorWallLf = 0;

  walls.forEach((wall) => {
    const geom = getWallGeometry(wall, nodeMap);
    if (!geom) return;

    const wallLength = geom.length;
    const wallHeight = wall.height || settings.defaultWallHeight;
    const grossArea = wallLength * wallHeight;

    const wallAps = aperturesByWall.get(wall.id) || [];
    let apertureTotalArea = 0;
    wallAps.forEach((ap) => {
      apertureTotalArea += ap.width * ap.height;
    });

    const classificationInfo = wallClassification.get(wall.id) || {
      classification: 'partition',
      adjacentRoomsCount: 0,
    };
    const { classification, adjacentRoomsCount } = classificationInfo;

    // Studs calculation
    const studSpacingFt = (wall.customStudSpacing || settings.studSpacingInches) / 12;
    const studsInWall = Math.ceil(wallLength / studSpacingFt) + 2 + wallAps.length * 2;
    totalStudCount += studsInWall;
    totalWallStudFramingLf += wallLength;

    // Drywall & Siding faces:
    // Exterior: 1 interior face drywall, 1 exterior siding/insulation wrapping outer envelope
    // Shared interior: 2 interior faces drywall
    // Partition: 2 faces drywall
    let drywallFaces = 2;
    if (classification === 'exterior') {
      drywallFaces = 1;
      totalExteriorWallLf += wallLength;

      // In Exterior Framing mode, account for structural framing thickness & corner wraps
      const wallThickness = wall.thickness || settings.defaultWallThickness || 0.537;
      const extFaceLength = isInteriorFinishMode ? wallLength : wallLength + wallThickness * 2;
      const extGrossArea = extFaceLength * wallHeight;
      const extNetArea = Math.max(0, extGrossArea - apertureTotalArea);

      totalExtWallInsulationSf += extNetArea;

      if (wall.finishExterior === 'brick_veneer') {
        totalStoneBrickVeneerSf += extNetArea;
      } else {
        totalPrimarySidingSf += extNetArea;
      }
    } else if (classification === 'shared_interior') {
      drywallFaces = 2;
      if (wall.soundInsulated) {
        totalExtWallInsulationSf += grossArea; // Sound batt insulation
      }
    } else {
      drywallFaces = 2;
    }

    const netDrywallForWall = Math.max(0, grossArea * drywallFaces - apertureTotalArea * drywallFaces);
    totalDrywallBoardSf += netDrywallForWall;

    wallDetails.push({
      wallId: wall.id,
      length: Math.round(wallLength * 100) / 100,
      height: wallHeight,
      grossArea: Math.round(grossArea * 100) / 100,
      apertureDeduction: Math.round(apertureTotalArea * 100) / 100,
      netDrywallArea: Math.round(netDrywallForWall * 100) / 100,
      classification,
      adjacentRoomsCount,
      studsCalculated: studsInWall,
    });
  });

  // Rooms & Flooring & Baseboards
  let totalFlooringPackageSf = 0;
  let totalCeilingDrywallSf = 0;
  let totalBaseboardTrimsLf = 0;
  const roomDetails: MTOReport['roomDetails'] = [];

  rooms.forEach((room) => {
    totalFlooringPackageSf += room.area;
    if (room.hasCeilingDrywall !== false) {
      totalCeilingDrywallSf += room.area;
    }

    // Door width deductions for baseboard
    let doorDeductionLf = 0;
    room.wallIds.forEach((wid) => {
      const aps = aperturesByWall.get(wid) || [];
      aps.forEach((ap) => {
        if (ap.type.includes('door')) {
          doorDeductionLf += ap.width;
        }
      });
    });

    const roomBaseboard = Math.max(0, room.perimeter - doorDeductionLf);
    totalBaseboardTrimsLf += roomBaseboard;

    roomDetails.push({
      roomId: room.id,
      name: room.name,
      area: room.area,
      perimeter: room.perimeter,
      floorFinish: room.floorFinish,
      baseboardLf: Math.round(roomBaseboard * 100) / 100,
      hasCeilingDrywall: room.hasCeilingDrywall !== false,
    });
  });

  // OSB Subfloor Decking extends under exterior framing to the rim board edge in exterior mode.
  // In interior finish mode, we calculate strictly face-to-face net interior area.
  const avgExtWallThickness = settings.defaultWallThickness || 0.5;
  const framingOffsetSf = (!isInteriorFinishMode && totalExteriorWallLf > 0)
    ? (totalExteriorWallLf * (avgExtWallThickness / 2)) + (4 * Math.pow(avgExtWallThickness / 2, 2))
    : 0;
  const totalOsbSubfloorDeckingSf = totalFlooringPackageSf > 0
    ? totalFlooringPackageSf + framingOffsetSf
    : 0;

  // Add ceiling drywall to total drywall board
  totalDrywallBoardSf += totalCeilingDrywallSf;
  const totalPaintCoverageSf = totalDrywallBoardSf; // Standard 1-to-1 paintable surface

  // Apertures, Casing, and Door Hardware
  let totalWindowsUnits = 0;
  let passageDoorsUnits = 0;
  let pocketDoorsUnits = 0;
  let exteriorDoorsUnits = 0;
  let overheadGarageBays = 0;
  let totalApertureCasingLf = 0;

  apertures.forEach((ap) => {
    if (ap.type.startsWith('window_')) {
      totalWindowsUnits++;
      // Window casing = 2 * (W + H)
      totalApertureCasingLf += 2 * (ap.width + ap.height);
    } else if (ap.type === 'door_passage') {
      passageDoorsUnits++;
      // Interior door casing = 2 sides * (W + 2*H)
      const sides = ap.casingSides ?? 2;
      totalApertureCasingLf += sides * (ap.width + 2 * ap.height);
    } else if (ap.type === 'door_pocket') {
      pocketDoorsUnits++;
      const sides = ap.casingSides ?? 2;
      totalApertureCasingLf += sides * (ap.width + 2 * ap.height);
    } else if (ap.type === 'door_exterior') {
      exteriorDoorsUnits++;
      // Exterior door casing = 1 interior trim + 1 exterior brickmould = 2 sides
      totalApertureCasingLf += 2 * (ap.width + 2 * ap.height);
    } else if (ap.type === 'door_garage') {
      overheadGarageBays++;
      // Garage exterior jamb casing = W + 2*H
      totalApertureCasingLf += ap.width + 2 * ap.height;
    } else if (ap.type === 'door_sliding_patio' || ap.type === 'door_bifold') {
      passageDoorsUnits++;
      totalApertureCasingLf += 2 * (ap.width + 2 * ap.height);
    }
  });

  const doorHardwareSets =
    passageDoorsUnits + pocketDoorsUnits + exteriorDoorsUnits;

  // Stamps categorization
  let structuralBeamsLf = 0;
  let supportColumnsPosts = 0;
  let helicalPiersPiles = 0;
  let stairHandGuardrailLf = 0;
  let calculatedStairRisers = 0;

  let stdSwitchesUnits = 0;
  let dimmersUnits = 0;
  let stdOutletsUnits = 0;
  let gfciOutletsUnits = 0;
  let heavyOutlets24vUnits = 0;
  let evChargersUnits = 0;
  let fixturesSconcesUnits = 0;
  let exteriorCoachLightsUnits = 0;
  let soffitLightsUnits = 0;
  let potlightsUnits = 0;
  let ceilingFansUnits = 0;
  let spotExhaustFansUnits = 0;
  let rangeHoodsUnits = 0;
  let smokeCoAlarmsUnits = 0;

  let plumbingFixturesUnits = 0;
  let utilityTrenchingLf = 0;

  stamps.forEach((st) => {
    switch (st.type) {
      case 'column_post':
        supportColumnsPosts++;
        break;
      case 'helical_pier':
        helicalPiersPiles++;
        break;
      case 'beam_segment':
        structuralBeamsLf += st.length || 10.0;
        break;
      case 'stair_run':
        const stairLength = st.length || 12.0;
        stairHandGuardrailLf += stairLength * 2; // handrail + guardrail
        calculatedStairRisers += st.stairRisers || Math.round((settings.defaultWallHeight * 12) / 7.5);
        break;
      case 'switch_std':
      case 'switch_3way':
        stdSwitchesUnits++;
        break;
      case 'switch_dimmer':
        dimmersUnits++;
        break;
      case 'outlet_std':
        stdOutletsUnits++;
        break;
      case 'outlet_gfci':
        gfciOutletsUnits++;
        break;
      case 'outlet_240v':
        heavyOutlets24vUnits++;
        break;
      case 'outlet_ev':
        evChargersUnits++;
        break;
      case 'light_fixture':
        fixturesSconcesUnits++;
        break;
      case 'light_coach':
        exteriorCoachLightsUnits++;
        break;
      case 'light_soffit':
        soffitLightsUnits++;
        break;
      case 'light_potlight':
        potlightsUnits++;
        break;
      case 'fan_ceiling':
        ceilingFansUnits++;
        break;
      case 'fan_exhaust':
        spotExhaustFansUnits++;
        break;
      case 'fan_rangehood':
        rangeHoodsUnits++;
        break;
      case 'alarm_smoke_co':
        smokeCoAlarmsUnits++;
        break;
      case 'plumbing_fixture':
      case 'plumbing_toilet':
      case 'plumbing_sink':
      case 'plumbing_shower':
      case 'plumbing_tub':
      case 'plumbing_hose_bib':
      case 'plumbing_water_heater':
        plumbingFixturesUnits++;
        break;
      case 'utility_trench':
        utilityTrenchingLf += st.length || 20.0;
        break;
    }
  });

  // Concrete & Foundations (CY)
  // Slab CY = (Gross Footprint Area * (slabThickness / 12)) / 27
  // Thickened perimeter footing CY = (Exterior Wall LF * 1ft * 1ft) / 27
  const grossFootprintSf = totalOsbSubfloorDeckingSf > 0 ? totalOsbSubfloorDeckingSf : totalFlooringPackageSf;
  const slabThicknessFt = settings.slabThicknessInches / 12;
  const slabVolumeCf = grossFootprintSf * slabThicknessFt;
  const footingVolumeCf = (!isInteriorFinishMode && totalExteriorWallLf > 0)
    ? totalExteriorWallLf * 1.0 * 1.0
    : 0;
  const pouredConcreteCy = Math.round(((slabVolumeCf + footingVolumeCf) / 27) * 10) / 10;
  const foundationSlabInsulationSf = Math.round(grossFootprintSf + (isInteriorFinishMode ? 0 : totalExteriorWallLf * slabThicknessFt));

  // Roofing, Facades & Site Envelope
  // Pitch multiplier: sqrt(1 + (pitch / 12)^2)
  const pitchMultiplier = Math.sqrt(1 + Math.pow(settings.roofPitchScale / 12, 2));
  const overhangFt = settings.roofOverhangInches / 12;
  const roofOverhangAreaSf = (!isInteriorFinishMode && totalExteriorWallLf > 0)
    ? (totalExteriorWallLf * overhangFt + 4 * Math.pow(overhangFt, 2))
    : 0;
  const grossRoofingAreaSf = (grossFootprintSf + roofOverhangAreaSf) * pitchMultiplier;
  const roofingAreaSq = Math.round((grossRoofingAreaSf / 100) * 10) / 10;
  const soffitTotalLf = Math.round(totalExteriorWallLf * 10) / 10;
  const fasciaTotalLf = Math.round(totalExteriorWallLf * (1 + (settings.roofPitchScale / 12) * 0.15) * 10) / 10;
  const eavestroughsLf = Math.round(totalExteriorWallLf * 0.9 * 10) / 10;

  // Deck & Hardscape
  let timberDeckingSf = 0;
  let deckPerimeterRailingLf = 0;
  decks.forEach((deck) => {
    timberDeckingSf += deck.area;
    deckPerimeterRailingLf += deck.perimeter;
  });

  let siteHardscapingSf = 0;
  hardscapes.forEach((h) => {
    siteHardscapingSf += h.area;
  });

  return {
    grossFootprintSf: Math.round(grossFootprintSf * 10) / 10,
    netFloorAreaSf: Math.round(totalFlooringPackageSf * 10) / 10,

    drywallBoardSf: Math.round(totalDrywallBoardSf * 10) / 10,
    paintCoverageSf: Math.round(totalPaintCoverageSf * 10) / 10,
    flooringPackageSf: Math.round(totalFlooringPackageSf * 10) / 10,
    extWallInsulationSf: Math.round(totalExtWallInsulationSf * 10) / 10,

    wallStudFramingLf: Math.round(totalWallStudFramingLf * 10) / 10,
    wallStudCount: totalStudCount,
    osbSubfloorDeckingSf: Math.round(totalOsbSubfloorDeckingSf * 10) / 10,
    structuralBeamsLf: Math.round(structuralBeamsLf * 10) / 10,
    supportColumnsPosts,
    baseboardTrimsLf: Math.round(totalBaseboardTrimsLf * 10) / 10,
    apertureCasingLf: Math.round(totalApertureCasingLf * 10) / 10,
    stairHandGuardrailLf: Math.round(stairHandGuardrailLf * 10) / 10,
    calculatedStairRisers,

    totalWindowsUnits,
    passageDoorsUnits,
    pocketDoorsUnits,
    exteriorDoorsUnits,
    overheadGarageBays,
    doorHardwareSets,

    stdSwitchesUnits,
    dimmersUnits,
    stdOutletsUnits,
    gfciOutletsUnits,
    heavyOutlets24vUnits,
    evChargersUnits,
    fixturesSconcesUnits,
    exteriorCoachLightsUnits,
    soffitLightsUnits,
    potlightsUnits,
    ceilingFansUnits,
    spotExhaustFansUnits,
    rangeHoodsUnits,
    smokeCoAlarmsUnits,

    plumbingFixturesUnits,
    utilityTrenchingLf: Math.round(utilityTrenchingLf * 10) / 10,

    pouredConcreteCy,
    helicalPiersPiles,
    foundationSlabInsulationSf,

    roofingAreaSq,
    roofingAreaSf: Math.round(grossRoofingAreaSf * 10) / 10,
    primarySidingSf: Math.round(totalPrimarySidingSf * 10) / 10,
    stoneBrickVeneerSf: Math.round(totalStoneBrickVeneerSf * 10) / 10,
    soffitTotalLf,
    fasciaTotalLf,
    eavestroughsLf,
    timberDeckingSf: Math.round(timberDeckingSf * 10) / 10,
    deckPerimeterRailingLf: Math.round(deckPerimeterRailingLf * 10) / 10,
    siteHardscapingSf: Math.round(siteHardscapingSf * 10) / 10,

    wallDetails,
    roomDetails,
  };
}

export interface CategoryCost {
  material: number;
  labor: number;
  total: number;
  included: boolean;
}

export interface EstimatedCostResult {
  materialSubtotal: number;
  laborSubtotal: number;
  totalCost: number;
  subtotals: {
    finishes: number;
    carpentryFraming: number;
    fenestration: number;
    electricalSafety: number;
    plumbingCivil: number;
    concreteFoundations: number;
    roofingEnvelope: number;
  };
  categoryBreakdown: {
    finishes: CategoryCost;
    carpentryFraming: CategoryCost;
    fenestration: CategoryCost;
    electricalSafety: CategoryCost;
    plumbingCivil: CategoryCost;
    concreteFoundations: CategoryCost;
    roofingEnvelope: CategoryCost;
  };
}

export function calculateEstimatedCost(
  mto: MTOReport,
  rates: UnitCostRates = DEFAULT_UNIT_COST_RATES,
  inclusions: CategoryInclusions = DEFAULT_CATEGORY_INCLUSIONS,
  itemInclusions: ItemInclusions = DEFAULT_ITEM_INCLUSIONS
): EstimatedCostResult {
  const inc = { ...DEFAULT_CATEGORY_INCLUSIONS, ...inclusions };
  const itemInc = { ...DEFAULT_ITEM_INCLUSIONS, ...itemInclusions };

  // Helper to accumulate material and labor
  let matFinishes = 0;
  let labFinishes = 0;

  // 1. Finishes
  if (itemInc.drywallBoard !== false) {
    matFinishes += mto.drywallBoardSf * rates.drywallPerSf.material;
    labFinishes += mto.drywallBoardSf * rates.drywallPerSf.labor;
  }

  if (itemInc.paintCoverage !== false) {
    matFinishes += mto.paintCoverageSf * rates.paintPerSf.material;
    labFinishes += mto.paintCoverageSf * rates.paintPerSf.labor;
  }

  if (itemInc.flooringPackage !== false) {
    matFinishes += mto.flooringPackageSf * rates.flooringPerSf.material;
    labFinishes += mto.flooringPackageSf * rates.flooringPerSf.labor;
  }

  if (itemInc.extWallInsulation !== false) {
    matFinishes += mto.extWallInsulationSf * rates.extInsulationPerSf.material;
    labFinishes += mto.extWallInsulationSf * rates.extInsulationPerSf.labor;
  }

  // 2. Carpentry & Framing
  let matCarpentry = 0;
  let labCarpentry = 0;

  if (itemInc.wallStudFraming !== false) {
    matCarpentry += mto.wallStudFramingLf * rates.studFramingPerLf.material;
    labCarpentry += mto.wallStudFramingLf * rates.studFramingPerLf.labor;
  }

  if (itemInc.osbSubfloorDecking !== false) {
    matCarpentry += mto.osbSubfloorDeckingSf * rates.osbSubfloorPerSf.material;
    labCarpentry += mto.osbSubfloorDeckingSf * rates.osbSubfloorPerSf.labor;
  }

  if (itemInc.structuralBeams !== false) {
    matCarpentry += mto.structuralBeamsLf * rates.beamPerLf.material;
    labCarpentry += mto.structuralBeamsLf * rates.beamPerLf.labor;
  }

  if (itemInc.supportColumnsPosts !== false) {
    matCarpentry += mto.supportColumnsPosts * rates.postPerUnit.material;
    labCarpentry += mto.supportColumnsPosts * rates.postPerUnit.labor;
  }

  if (itemInc.baseboardTrims !== false) {
    matCarpentry += mto.baseboardTrimsLf * rates.baseboardPerLf.material;
    labCarpentry += mto.baseboardTrimsLf * rates.baseboardPerLf.labor;
  }

  if (itemInc.apertureCasing !== false) {
    matCarpentry += mto.apertureCasingLf * rates.casingPerLf.material;
    labCarpentry += mto.apertureCasingLf * rates.casingPerLf.labor;
  }

  if (itemInc.calculatedStairRisers !== false) {
    matCarpentry += mto.calculatedStairRisers * rates.stairRiserPerUnit.material;
    labCarpentry += mto.calculatedStairRisers * rates.stairRiserPerUnit.labor;
  }

  // 3. Fenestration
  let matFenestration = 0;
  let labFenestration = 0;

  if (itemInc.totalWindows !== false) {
    matFenestration += mto.totalWindowsUnits * rates.windowPerUnit.material;
    labFenestration += mto.totalWindowsUnits * rates.windowPerUnit.labor;
  }

  if (itemInc.passageDoors !== false) {
    matFenestration += mto.passageDoorsUnits * rates.passageDoorPerUnit.material;
    labFenestration += mto.passageDoorsUnits * rates.passageDoorPerUnit.labor;
  }

  if (itemInc.pocketDoors !== false) {
    matFenestration += mto.pocketDoorsUnits * rates.pocketDoorPerUnit.material;
    labFenestration += mto.pocketDoorsUnits * rates.pocketDoorPerUnit.labor;
  }

  if (itemInc.exteriorDoors !== false) {
    matFenestration += mto.exteriorDoorsUnits * rates.exteriorDoorPerUnit.material;
    labFenestration += mto.exteriorDoorsUnits * rates.exteriorDoorPerUnit.labor;
  }

  if (itemInc.overheadGarageBays !== false) {
    matFenestration += mto.overheadGarageBays * rates.garageDoorPerBay.material;
    labFenestration += mto.overheadGarageBays * rates.garageDoorPerBay.labor;
  }

  if (itemInc.doorHardwareSets !== false) {
    matFenestration += mto.doorHardwareSets * rates.doorHardwarePerSet.material;
    labFenestration += mto.doorHardwareSets * rates.doorHardwarePerSet.labor;
  }

  // 4. Electrical & Safety
  let matElectrical = 0;
  let labElectrical = 0;

  if (itemInc.stdSwitches !== false) {
    matElectrical += mto.stdSwitchesUnits * rates.switchPerUnit.material;
    labElectrical += mto.stdSwitchesUnits * rates.switchPerUnit.labor;
  }

  if (itemInc.dimmers !== false) {
    matElectrical += mto.dimmersUnits * rates.switchPerUnit.material * 1.5;
    labElectrical += mto.dimmersUnits * rates.switchPerUnit.labor * 1.2;
  }

  if (itemInc.stdOutlets !== false) {
    matElectrical += mto.stdOutletsUnits * rates.outletPerUnit.material;
    labElectrical += mto.stdOutletsUnits * rates.outletPerUnit.labor;
  }

  if (itemInc.gfciOutlets !== false) {
    matElectrical += mto.gfciOutletsUnits * rates.gfciPerUnit.material;
    labElectrical += mto.gfciOutletsUnits * rates.gfciPerUnit.labor;
  }

  if (itemInc.heavyOutlets24v !== false) {
    matElectrical += mto.heavyOutlets24vUnits * rates.outletPerUnit.material * 2.5;
    labElectrical += mto.heavyOutlets24vUnits * rates.outletPerUnit.labor * 1.8;
  }

  if (itemInc.potlights !== false) {
    matElectrical += mto.potlightsUnits * rates.potlightPerUnit.material;
    labElectrical += mto.potlightsUnits * rates.potlightPerUnit.labor;
  }

  if (itemInc.fixturesSconces !== false) {
    matElectrical += mto.fixturesSconcesUnits * rates.potlightPerUnit.material * 1.2;
    labElectrical += mto.fixturesSconcesUnits * rates.potlightPerUnit.labor * 1.0;
  }

  if (itemInc.ceilingFans !== false) {
    matElectrical += mto.ceilingFansUnits * rates.ceilingFanPerUnit.material;
    labElectrical += mto.ceilingFansUnits * rates.ceilingFanPerUnit.labor;
  }

  if (itemInc.spotExhaustFans !== false) {
    matElectrical += mto.spotExhaustFansUnits * rates.exhaustFanPerUnit.material;
    labElectrical += mto.spotExhaustFansUnits * rates.exhaustFanPerUnit.labor;
  }

  if (itemInc.smokeCoAlarms !== false) {
    matElectrical += mto.smokeCoAlarmsUnits * rates.smokeAlarmPerUnit.material;
    labElectrical += mto.smokeCoAlarmsUnits * rates.smokeAlarmPerUnit.labor;
  }

  // 5. Plumbing & Civil
  let matPlumbing = 0;
  let labPlumbing = 0;

  if (itemInc.plumbingFixtures !== false) {
    matPlumbing += mto.plumbingFixturesUnits * rates.plumbingPerFixture.material;
    labPlumbing += mto.plumbingFixturesUnits * rates.plumbingPerFixture.labor;
  }

  if (itemInc.utilityTrenching !== false) {
    matPlumbing += mto.utilityTrenchingLf * rates.utilityTrenchPerLf.material;
    labPlumbing += mto.utilityTrenchingLf * rates.utilityTrenchPerLf.labor;
  }

  // 6. Concrete & Foundations
  let matConcrete = 0;
  let labConcrete = 0;

  if (itemInc.pouredConcreteCy !== false) {
    matConcrete += mto.pouredConcreteCy * rates.concretePerCy.material;
    labConcrete += mto.pouredConcreteCy * rates.concretePerCy.labor;
  }

  if (itemInc.helicalPiersPiles !== false) {
    matConcrete += mto.helicalPiersPiles * rates.pierPerUnit.material;
    labConcrete += mto.helicalPiersPiles * rates.pierPerUnit.labor;
  }

  if (itemInc.foundationSlabInsulation !== false) {
    matConcrete += mto.foundationSlabInsulationSf * 0.85;
    labConcrete += mto.foundationSlabInsulationSf * 0.55;
  }

  // 7. Roofing & Facades
  let matRoofing = 0;
  let labRoofing = 0;

  if (itemInc.roofingArea !== false) {
    matRoofing += mto.roofingAreaSq * rates.roofingPerSq.material;
    labRoofing += mto.roofingAreaSq * rates.roofingPerSq.labor;
  }

  if (itemInc.primarySiding !== false) {
    matRoofing += mto.primarySidingSf * rates.sidingPerSf.material;
    labRoofing += mto.primarySidingSf * rates.sidingPerSf.labor;
  }

  if (itemInc.stoneBrickVeneer !== false) {
    matRoofing += mto.stoneBrickVeneerSf * rates.sidingPerSf.material * 2.2;
    labRoofing += mto.stoneBrickVeneerSf * rates.sidingPerSf.labor * 2.0;
  }

  if (itemInc.soffitFasciaEaves !== false) {
    matRoofing += mto.soffitTotalLf * rates.soffitPerLf.material;
    labRoofing += mto.soffitTotalLf * rates.soffitPerLf.labor;
    matRoofing += mto.fasciaTotalLf * rates.fasciaPerLf.material;
    labRoofing += mto.fasciaTotalLf * rates.fasciaPerLf.labor;
    matRoofing += mto.eavestroughsLf * rates.eavestroughPerLf.material;
    labRoofing += mto.eavestroughsLf * rates.eavestroughPerLf.labor;
  }

  if (itemInc.timberDecking !== false) {
    matRoofing += mto.timberDeckingSf * rates.deckingPerSf.material;
    labRoofing += mto.timberDeckingSf * rates.deckingPerSf.labor;
  }

  if (itemInc.deckRailing !== false) {
    matRoofing += mto.deckPerimeterRailingLf * rates.deckRailingPerLf.material;
    labRoofing += mto.deckPerimeterRailingLf * rates.deckRailingPerLf.labor;
  }

  if (itemInc.siteHardscaping !== false) {
    matRoofing += mto.siteHardscapingSf * rates.hardscapePerSf.material;
    labRoofing += mto.siteHardscapingSf * rates.hardscapePerSf.labor;
  }

  const catFinishes: CategoryCost = {
    material: Math.round(matFinishes),
    labor: Math.round(labFinishes),
    total: Math.round(matFinishes + labFinishes),
    included: inc.finishes,
  };
  const catCarpentry: CategoryCost = {
    material: Math.round(matCarpentry),
    labor: Math.round(labCarpentry),
    total: Math.round(matCarpentry + labCarpentry),
    included: inc.carpentryFraming,
  };
  const catFenestration: CategoryCost = {
    material: Math.round(matFenestration),
    labor: Math.round(labFenestration),
    total: Math.round(matFenestration + labFenestration),
    included: inc.fenestration,
  };
  const catElectrical: CategoryCost = {
    material: Math.round(matElectrical),
    labor: Math.round(labElectrical),
    total: Math.round(matElectrical + labElectrical),
    included: inc.electricalSafety,
  };
  const catPlumbing: CategoryCost = {
    material: Math.round(matPlumbing),
    labor: Math.round(labPlumbing),
    total: Math.round(matPlumbing + labPlumbing),
    included: inc.plumbingCivil,
  };
  const catConcrete: CategoryCost = {
    material: Math.round(matConcrete),
    labor: Math.round(labConcrete),
    total: Math.round(matConcrete + labConcrete),
    included: inc.concreteFoundations,
  };
  const catRoofing: CategoryCost = {
    material: Math.round(matRoofing),
    labor: Math.round(labRoofing),
    total: Math.round(matRoofing + labRoofing),
    included: inc.roofingEnvelope,
  };

  // Grand totals sum only active/included categories
  const materialSubtotal =
    (inc.finishes ? matFinishes : 0) +
    (inc.carpentryFraming ? matCarpentry : 0) +
    (inc.fenestration ? matFenestration : 0) +
    (inc.electricalSafety ? matElectrical : 0) +
    (inc.plumbingCivil ? matPlumbing : 0) +
    (inc.concreteFoundations ? matConcrete : 0) +
    (inc.roofingEnvelope ? matRoofing : 0);

  const laborSubtotal =
    (inc.finishes ? labFinishes : 0) +
    (inc.carpentryFraming ? labCarpentry : 0) +
    (inc.fenestration ? labFenestration : 0) +
    (inc.electricalSafety ? labElectrical : 0) +
    (inc.plumbingCivil ? labPlumbing : 0) +
    (inc.concreteFoundations ? labConcrete : 0) +
    (inc.roofingEnvelope ? labRoofing : 0);

  const totalCost = materialSubtotal + laborSubtotal;

  return {
    materialSubtotal: Math.round(materialSubtotal),
    laborSubtotal: Math.round(laborSubtotal),
    totalCost: Math.round(totalCost),
    subtotals: {
      finishes: catFinishes.total,
      carpentryFraming: catCarpentry.total,
      fenestration: catFenestration.total,
      electricalSafety: catElectrical.total,
      plumbingCivil: catPlumbing.total,
      concreteFoundations: catConcrete.total,
      roofingEnvelope: catRoofing.total,
    },
    categoryBreakdown: {
      finishes: catFinishes,
      carpentryFraming: catCarpentry,
      fenestration: catFenestration,
      electricalSafety: catElectrical,
      plumbingCivil: catPlumbing,
      concreteFoundations: catConcrete,
      roofingEnvelope: catRoofing,
    },
  };
}
