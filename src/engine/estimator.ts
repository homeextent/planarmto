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
  getNetInteriorPolygon,
  calculateSignedPolygonArea,
  getWallThickness,
  getVariableOffsetPolygon,
  getCoreThickness,
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
  switchDimmer: { material: 25.0, labor: 35.0 },
  switch3Way: { material: 18.0, labor: 35.0 },
  electricalPanelMain100A: { material: 900.0, labor: 1200.0 },
  electricalPanelMain200A: { material: 1200.0, labor: 1500.0 },
  electricalPanelMain400A: { material: 2800.0, labor: 3200.0 },
  electricalPanelSub60A: { material: 350.0, labor: 500.0 },
  electricalPanelSub100A: { material: 450.0, labor: 650.0 },
  electricalPanelSub125A: { material: 550.0, labor: 750.0 },
  fixtureSconce: { material: 35.0, labor: 45.0 },
  exteriorCoachLight: { material: 45.0, labor: 55.0 },
  soffitLight: { material: 30.0, labor: 40.0 },
  outletPerUnit: { material: 6.0, labor: 22.0 },
  gfciPerUnit: { material: 22.0, labor: 30.0 },
  outlet240v: { material: 65.0, labor: 95.0 },
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
  waterHeaterPerUnit: { material: 450.0, labor: 350.0 },
  utilityTrenchPerLf: { material: 10.0, labor: 25.0 },
  soffitPerLf: { material: 4.5, labor: 5.0 },
  fasciaPerLf: { material: 3.5, labor: 4.5 },
  eavestroughPerLf: { material: 5.5, labor: 6.5 },
  deckRailingPerLf: { material: 22.0, labor: 20.0 },
  hardscapePerSf: { material: 6.5, labor: 7.5 },
};

/**
 * Deep merges loaded rates over default rates to ensure no missing properties
 */
export function safeMergeRates(loadedRates?: Partial<UnitCostRates>): UnitCostRates {
  const base = { ...DEFAULT_UNIT_COST_RATES };
  if (!loadedRates) return base;

  const result = { ...base };
  (Object.keys(base) as Array<keyof UnitCostRates>).forEach((key) => {
    if (typeof base[key] === 'object' && base[key] !== null) {
      const loaded = loadedRates[key];
      if (loaded && typeof loaded === 'object') {
        result[key] = {
          ...base[key],
          ...loaded,
        } as any;
      }
    }
  });

  return result;
}

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
    const studsInWall = wall.wallType === 'foundation_wall' ? 0 : (Math.ceil(wallLength / studSpacingFt) + 2 + wallAps.length * 2);
    totalStudCount += studsInWall;
    if (wall.wallType !== 'foundation_wall') {
      totalWallStudFramingLf += wallLength;
    }

    // Drywall & Siding faces:
    // Exterior: 1 interior face drywall, 1 exterior siding/insulation wrapping outer envelope
    // Shared interior: 2 interior faces drywall
    // Partition: 2 faces drywall
    let drywallFaces = 2;
    if (wall.wallType === 'foundation_wall') {
      drywallFaces = 0;
    } else if (classification === 'exterior') {
      drywallFaces = 1;
      totalExteriorWallLf += wallLength;

      // In Exterior Framing mode, account for structural framing thickness & corner wraps
      const wallThickness = wall.thickness || settings.defaultWallThickness || 0.537;
      // +t per exterior corner means for a simple box we add 2 * thickness to each wall's calculated exterior length
      // more precisely, it's about the outer envelope. The current implementation uses wallLength + wallThickness * 2
      // for all exterior walls if not in interior_finish mode.
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

    const netDrywallForWall = 0; // Moved to room-based calculation for interior precision
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
    // PHASE 3: Derived Inset Finishes Geometry
    // Flooring, Baseboards, Interior Paint MUST calculate strictly using getNetInteriorPolygon()
    const wallThicknesses = room.wallIds.map(wid => {
      const wall = walls.find(w => w.id === wid);
      return wall ? getWallThickness(wall) : (settings.defaultWallThickness || 0.375);
    });
    const netInteriorPoints = getNetInteriorPolygon(room.points, wallThicknesses);
    const netArea = Math.abs(calculateSignedPolygonArea(netInteriorPoints));
    const netPerimeter = calculatePolygonPerimeter(netInteriorPoints);

    // Wall Drywall calculation (interior faces per room)
    let roomApertureArea = 0;
    let roomWallPerimeterExcludingFoundation = 0;

    room.wallIds.forEach((wid, idx) => {
      const wall = walls.find(w => w.id === wid);
      const isFoundation = wall?.wallType === 'foundation_wall';

      // Get the length of this specific segment of the net interior polygon
      const p1 = netInteriorPoints[idx];
      const p2 = netInteriorPoints[(idx + 1) % netInteriorPoints.length];
      const segmentLength = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

      if (!isFoundation) {
        roomWallPerimeterExcludingFoundation += segmentLength;
        const aps = aperturesByWall.get(wid) || [];
        aps.forEach((ap) => {
          roomApertureArea += ap.width * ap.height;
        });
      }
    });

    const roomWallDrywallArea = Math.max(0, roomWallPerimeterExcludingFoundation * (room.ceilingHeight || settings.defaultWallHeight) - roomApertureArea);
    totalDrywallBoardSf += roomWallDrywallArea;

    // Check if it's a foundation room
    let isFoundationRoom = false;
    room.wallIds.forEach((wid) => {
      const wall = walls.find((w) => w.id === wid);
      if (wall?.wallType === 'foundation_wall') {
        isFoundationRoom = true;
      }
    });

    totalFlooringPackageSf += (isFoundationRoom && room.floorFinish === 'polished_concrete') ? 0 : netArea;
    
    const ceilingMultiplier = room.ceilingMultiplier || 1.0;
    const effectiveCeilingArea = netArea * ceilingMultiplier;

    if (room.hasCeilingDrywall !== false && !isFoundationRoom) {
      totalCeilingDrywallSf += effectiveCeilingArea;
    }

    // Door width deductions for baseboard
    let doorDeductionLf = 0;
    let foundationWallLengthInRoom = 0;
    room.wallIds.forEach((wid) => {
      const wall = walls.find(w => w.id === wid);
      if (wall?.wallType === 'foundation_wall') {
        const geom = getWallGeometry(wall, nodeMap);
        if (geom) foundationWallLengthInRoom += geom.length;
      }
      const aps = aperturesByWall.get(wid) || [];
      aps.forEach((ap) => {
        if (ap.type.includes('door')) {
          doorDeductionLf += ap.width;
        }
      });
    });

    const roomBaseboard = Math.max(0, netPerimeter - doorDeductionLf - foundationWallLengthInRoom);
    totalBaseboardTrimsLf += roomBaseboard;

    roomDetails.push({
      roomId: room.id,
      name: room.name,
      area: Math.round(netArea * 100) / 100,
      perimeter: Math.round(netPerimeter * 100) / 100,
      floorFinish: room.floorFinish,
      baseboardLf: Math.round(roomBaseboard * 100) / 100,
      hasCeilingDrywall: room.hasCeilingDrywall !== false && !isFoundationRoom,
    });
  });

  // OSB Subfloor Decking logic:
  // 1. Detached from net interior area; starts at the raw centerline room polygon.
  // 2. For shared interior walls, we stay at centerline (covering the area under the plates).
  // 3. For exterior walls, we expand outward by (coreFramingThickness / 2) to reach the rim face.
  // 4. Foundation rooms (slabs) are excluded.
  let totalOsbSubfloorDeckingSf = 0;
  rooms.forEach((room) => {
    let isFoundationRoom = false;
    room.wallIds.forEach((wid) => {
      const wall = walls.find((w) => w.id === wid);
      if (wall?.wallType === 'foundation_wall') isFoundationRoom = true;
    });
    if (isFoundationRoom) return;

    const edgeOffsets: number[] = room.wallIds.map((wid) => {
      const wall = walls.find((w) => w.id === wid);
      const classification = wallClassification.get(wid)?.classification;

      // In interior_finish mode, evaluate subflooring using net interior clear space
      if (isInteriorFinishMode) {
        const t = wall ? getWallThickness(wall) : (settings.defaultWallThickness || 0.375);
        return t / 2; // Inward offset from centerline
      }

      // Expand outward if wall is exterior OR if we are in global exterior framing mode
      if (classification === 'exterior' || settings.calculationMode === 'exterior_framing') {
        const coreT = getCoreThickness({ thickness: wall?.thickness || settings.defaultWallThickness || 0.375 });
        return -(coreT / 2); // negative = outward expansion from centerline
      }
      return 0; // centerline for partition/shared walls
    });

    const subfloorPolygon = getVariableOffsetPolygon(room.points, edgeOffsets);
    const subfloorArea = Math.abs(calculateSignedPolygonArea(subfloorPolygon));
    totalOsbSubfloorDeckingSf += subfloorArea;
  });

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
    } else if (ap.type === 'door_bifold_single' || ap.type === 'door_bifold_double') {
      passageDoorsUnits++;
      totalApertureCasingLf += 2 * (ap.width + 2 * ap.height);
    } else if (ap.type === 'cased_opening') {
      // Cased opening has casing on both sides, but no door unit
      totalApertureCasingLf += 2 * (ap.width + 2 * ap.height);
    } else if (ap.type === 'door_sliding_patio') {
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
  let electricalPanelsUnits = 0;
  const panelBreakdown: Array<{ type: 'main' | 'subpanel'; amperage: string; count: number }> = [];
  let switch3WayUnits = 0;
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
        stdSwitchesUnits++;
        break;
      case 'switch_3way':
        switch3WayUnits++;
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
      case 'stamp_electrical_panel' as any:
      case 'electrical_panel':
        electricalPanelsUnits++;
        const pType = st.panelType || 'main';
        const pAmp = st.panelAmperage || (pType === 'main' ? '200A' : '100A');
        const existing = panelBreakdown.find(p => p.type === pType && p.amperage === pAmp);
        if (existing) {
          existing.count++;
        } else {
          panelBreakdown.push({ type: pType, amperage: pAmp, count: 1 });
        }
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

  const grossFootprintSf = totalOsbSubfloorDeckingSf > 0 ? totalOsbSubfloorDeckingSf : totalFlooringPackageSf;

  // Concrete & Foundations (CY)
  let totalFoundationWallVolumeCf = 0;
  let totalFootingVolumeCf = 0;
  let totalExplicitSlabVolumeCf = 0;
  let totalExplicitSlabInsulationSf = 0;

  walls.forEach((wall) => {
    if (wall.wallType === 'foundation_wall') {
      const geom = getWallGeometry(wall, nodeMap);
      if (!geom) return;

      const wallLength = geom.length;
      const f = wall.foundationDetails || {};
      
      const fWallHeight = f.wallHeight ?? 8; // ft
      const fWallThickness = wall.thickness || (10 / 12); // ft
      const fFootingWidth = (f.footingWidth ?? 16) / 12; // ft (Default 16" wide)
      const fFootingThickness = (f.footingThickness ?? 8) / 12; // ft (Default 8" thick)

      // In exterior_framing mode, include footing projection overhangs and thickened-edge slab beams
      // Current logic uses wallLength which is centerline.
      // For exterior framing we should ideally use the exterior perimeter of the foundation.
      const foundationLength = isInteriorFinishMode ? wallLength : (wallLength + fWallThickness);

      // Wall Volume
      totalFoundationWallVolumeCf += foundationLength * fWallHeight * fWallThickness;
      // Footing Volume
      totalFootingVolumeCf += foundationLength * fFootingWidth * fFootingThickness;
    }
  });

  // Let's refine: Slabs and Slab insulation should probably still be area-based but only for rooms bounded by foundation walls.
  rooms.forEach(room => {
    let isFoundationRoom = room.roomType === 'Basement / Foundation Space';
    let roomSlabThickness = room.slabThickness ?? settings.slabThicknessInches; // use room override or global default

    if (!isFoundationRoom) {
      room.wallIds.forEach(wid => {
        const wall = walls.find(w => w.id === wid);
        if (wall?.wallType === 'foundation_wall') {
          isFoundationRoom = true;
          if (wall.foundationDetails?.slabThickness && !room.slabThickness) {
            roomSlabThickness = wall.foundationDetails.slabThickness;
          }
        }
      });
    }

    if (isFoundationRoom) {
      const slabT = roomSlabThickness || 4; // fallback to 4"
      totalExplicitSlabVolumeCf += room.area * (slabT / 12);
      totalExplicitSlabInsulationSf += room.area;
    }
  });

  const pouredConcreteCy = Math.round(((totalFoundationWallVolumeCf + totalFootingVolumeCf + totalExplicitSlabVolumeCf) / 27) * 10) / 10;
  const foundationSlabInsulationSf = Math.round(totalExplicitSlabInsulationSf);


  // Roofing, Facades & Site Envelope
  // Pitch multiplier: sqrt(1 + (pitch / 12)^2)
  // Foundation rooms are excluded from auto-derived roofing.
  const roofingFootprintSf = rooms.reduce((acc, r) => {
    let isFoundationRoom = false;
    r.wallIds.forEach(wid => {
      if (walls.find(w => w.id === wid)?.wallType === 'foundation_wall') isFoundationRoom = true;
    });
    return isFoundationRoom ? acc : acc + r.area;
  }, 0);

  const pitchMultiplier = Math.sqrt(1 + Math.pow(settings.roofPitchScale / 12, 2));
  const overhangFt = settings.roofOverhangInches / 12;
  // In interior_finish mode, suppress roof/eave projections
  const roofOverhangAreaSf = (isInteriorFinishMode || totalExteriorWallLf === 0)
    ? 0
    : (totalExteriorWallLf * overhangFt + 4 * Math.pow(overhangFt, 2));
  
  const grossRoofingAreaSf = (roofingFootprintSf + roofOverhangAreaSf) * pitchMultiplier;
  const roofingAreaSq = Math.round((grossRoofingAreaSf / 100) * 10) / 10;
  
  // Calculate fascia LF, soffit area (represented here as LF for now), and eave overhangs based on the exterior wall perimeter
  const soffitTotalLf = isInteriorFinishMode ? 0 : Math.round(totalExteriorWallLf * 10) / 10;
  const fasciaTotalLf = isInteriorFinishMode ? 0 : Math.round(totalExteriorWallLf * (1 + (settings.roofPitchScale / 12) * 0.15) * 10) / 10;
  const eavestroughsLf = isInteriorFinishMode ? 0 : Math.round(totalExteriorWallLf * 0.9 * 10) / 10;

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
    grossFootprintSf: Math.round(grossFootprintSf * 100) / 100,
    netFloorAreaSf: Math.round(totalFlooringPackageSf * 100) / 100,

    drywallBoardSf: Math.round(totalDrywallBoardSf * 100) / 100,
    paintCoverageSf: Math.round(totalPaintCoverageSf * 100) / 100,
    flooringPackageSf: Math.round(totalFlooringPackageSf * 100) / 100,
    extWallInsulationSf: Math.round(totalExtWallInsulationSf * 100) / 100,

    wallStudFramingLf: Math.round(totalWallStudFramingLf * 100) / 100,
    wallStudCount: totalStudCount,
    osbSubfloorDeckingSf: Math.round(totalOsbSubfloorDeckingSf * 100) / 100,
    structuralBeamsLf: Math.round(structuralBeamsLf * 100) / 100,
    supportColumnsPosts,
    baseboardTrimsLf: Math.round(totalBaseboardTrimsLf * 100) / 100,
    apertureCasingLf: Math.round(totalApertureCasingLf * 100) / 100,
    stairHandGuardrailLf: Math.round(stairHandGuardrailLf * 100) / 100,
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
    electricalPanelsUnits,
    panelBreakdown,
    switch3WayUnits,
    smokeCoAlarmsUnits,

    plumbingFixturesUnits,
    utilityTrenchingLf: Math.round(utilityTrenchingLf * 100) / 100,

    pouredConcreteCy,
    helicalPiersPiles,
    foundationSlabInsulationSf,

    roofingAreaSq,
    roofingAreaSf: Math.round(grossRoofingAreaSf * 100) / 100,
    primarySidingSf: Math.round(totalPrimarySidingSf * 100) / 100,
    stoneBrickVeneerSf: Math.round(totalStoneBrickVeneerSf * 100) / 100,
    soffitTotalLf: Math.round(soffitTotalLf * 100) / 100,
    fasciaTotalLf: Math.round(fasciaTotalLf * 100) / 100,
    eavestroughsLf: Math.round(eavestroughsLf * 100) / 100,
    timberDeckingSf: Math.round(timberDeckingSf * 100) / 100,
    deckPerimeterRailingLf: Math.round(deckPerimeterRailingLf * 100) / 100,
    siteHardscapingSf: Math.round(siteHardscapingSf * 100) / 100,

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
  // Financial Rollup
  baseDirectCost: number;
  indirectProjectManagement: number;
  indirectContingency: number;
  grossMarginOverhead: number;
  grossMarginProfit: number;
  contractorGrandTotal: number;
}

export function calculateEstimatedCost(
  mto: MTOReport,
  rates: UnitCostRates = DEFAULT_UNIT_COST_RATES,
  inclusions: CategoryInclusions = DEFAULT_CATEGORY_INCLUSIONS,
  itemInclusions: ItemInclusions = DEFAULT_ITEM_INCLUSIONS,
  settings?: FloorplanState['settings'],
  stamps: any[] = []
): EstimatedCostResult {
  const inc = { ...DEFAULT_CATEGORY_INCLUSIONS, ...inclusions };
  const itemInc = { ...DEFAULT_ITEM_INCLUSIONS, ...itemInclusions };

  const wasteMultiplier = 1 + (settings?.wasteFactorPercentage || 0) / 100;

  // Helper to accumulate material and labor
  let matFinishes = 0;
  let labFinishes = 0;

  // 1. Finishes
  if (itemInc.drywallBoard !== false) {
    matFinishes += mto.drywallBoardSf * (rates.drywallPerSf?.material ?? DEFAULT_UNIT_COST_RATES.drywallPerSf.material) * wasteMultiplier;
    labFinishes += mto.drywallBoardSf * (rates.drywallPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.drywallPerSf.labor) * wasteMultiplier;
  }

  if (itemInc.paintCoverage !== false) {
    matFinishes += mto.paintCoverageSf * (rates.paintPerSf?.material ?? DEFAULT_UNIT_COST_RATES.paintPerSf.material) * wasteMultiplier;
    labFinishes += mto.paintCoverageSf * (rates.paintPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.paintPerSf.labor) * wasteMultiplier;
  }

  if (itemInc.flooringPackage !== false) {
    matFinishes += mto.flooringPackageSf * (rates.flooringPerSf?.material ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.material) * wasteMultiplier;
    labFinishes += mto.flooringPackageSf * (rates.flooringPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.flooringPerSf.labor) * wasteMultiplier;
  }

  if (itemInc.extWallInsulation !== false) {
    matFinishes += mto.extWallInsulationSf * (rates.extInsulationPerSf?.material ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.material) * wasteMultiplier;
    labFinishes += mto.extWallInsulationSf * (rates.extInsulationPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.extInsulationPerSf.labor) * wasteMultiplier;
  }

  // 2. Carpentry & Framing
  let matCarpentry = 0;
  let labCarpentry = 0;

  if (itemInc.wallStudFraming !== false) {
    matCarpentry += mto.wallStudFramingLf * (rates.studFramingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.material) * wasteMultiplier;
    labCarpentry += mto.wallStudFramingLf * (rates.studFramingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.studFramingPerLf.labor) * wasteMultiplier;
  }

  if (itemInc.osbSubfloorDecking !== false) {
    matCarpentry += mto.osbSubfloorDeckingSf * (rates.osbSubfloorPerSf?.material ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.material) * wasteMultiplier;
    labCarpentry += mto.osbSubfloorDeckingSf * (rates.osbSubfloorPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.osbSubfloorPerSf.labor) * wasteMultiplier;
  }

  if (itemInc.structuralBeams !== false) {
    matCarpentry += mto.structuralBeamsLf * (rates.beamPerLf?.material ?? DEFAULT_UNIT_COST_RATES.beamPerLf.material) * wasteMultiplier;
    labCarpentry += mto.structuralBeamsLf * (rates.beamPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.beamPerLf.labor) * wasteMultiplier;
  }

  if (itemInc.supportColumnsPosts !== false) {
    matCarpentry += mto.supportColumnsPosts * (rates.postPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.postPerUnit.material) * wasteMultiplier;
    labCarpentry += mto.supportColumnsPosts * (rates.postPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.postPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.baseboardTrims !== false) {
    matCarpentry += mto.baseboardTrimsLf * (rates.baseboardPerLf?.material ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.material) * wasteMultiplier;
    labCarpentry += mto.baseboardTrimsLf * (rates.baseboardPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.baseboardPerLf.labor) * wasteMultiplier;
  }

  if (itemInc.apertureCasing !== false) {
    matCarpentry += mto.apertureCasingLf * (rates.casingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.casingPerLf.material) * wasteMultiplier;
    labCarpentry += mto.apertureCasingLf * (rates.casingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.casingPerLf.labor) * wasteMultiplier;
  }

  if (itemInc.calculatedStairRisers !== false) {
    matCarpentry += mto.calculatedStairRisers * (rates.stairRiserPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.material) * wasteMultiplier;
    labCarpentry += mto.calculatedStairRisers * (rates.stairRiserPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.stairRiserPerUnit.labor) * wasteMultiplier;
  }

  // 3. Fenestration
  let matFenestration = 0;
  let labFenestration = 0;

  if (itemInc.totalWindows !== false) {
    matFenestration += mto.totalWindowsUnits * (rates.windowPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.windowPerUnit.material) * wasteMultiplier;
    labFenestration += mto.totalWindowsUnits * (rates.windowPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.windowPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.passageDoors !== false) {
    matFenestration += mto.passageDoorsUnits * (rates.passageDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.material) * wasteMultiplier;
    labFenestration += mto.passageDoorsUnits * (rates.passageDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.passageDoorPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.pocketDoors !== false) {
    matFenestration += mto.pocketDoorsUnits * (rates.pocketDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.material) * wasteMultiplier;
    labFenestration += mto.pocketDoorsUnits * (rates.pocketDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pocketDoorPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.exteriorDoors !== false) {
    matFenestration += mto.exteriorDoorsUnits * (rates.exteriorDoorPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.material) * wasteMultiplier;
    labFenestration += mto.exteriorDoorsUnits * (rates.exteriorDoorPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.exteriorDoorPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.overheadGarageBays !== false) {
    matFenestration += mto.overheadGarageBays * (rates.garageDoorPerBay?.material ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.material) * wasteMultiplier;
    labFenestration += mto.overheadGarageBays * (rates.garageDoorPerBay?.labor ?? DEFAULT_UNIT_COST_RATES.garageDoorPerBay.labor) * wasteMultiplier;
  }

  if (itemInc.doorHardwareSets !== false) {
    matFenestration += mto.doorHardwareSets * (rates.doorHardwarePerSet?.material ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.material) * wasteMultiplier;
    labFenestration += mto.doorHardwareSets * (rates.doorHardwarePerSet?.labor ?? DEFAULT_UNIT_COST_RATES.doorHardwarePerSet.labor) * wasteMultiplier;
  }

  // 4. Electrical & Safety
  let matElectrical = 0;
  let labElectrical = 0;

  if (itemInc.stdSwitches !== false) {
    matElectrical += mto.stdSwitchesUnits * (rates.switchPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.material) * wasteMultiplier;
    labElectrical += mto.stdSwitchesUnits * (rates.switchPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.switchPerUnit.labor) * wasteMultiplier;
  }

  if (mto.switch3WayUnits > 0 && itemInc.switch3Way !== false) {
    matElectrical += mto.switch3WayUnits * (rates.switch3Way?.material ?? DEFAULT_UNIT_COST_RATES.switch3Way.material) * wasteMultiplier;
    labElectrical += mto.switch3WayUnits * (rates.switch3Way?.labor ?? DEFAULT_UNIT_COST_RATES.switch3Way.labor) * wasteMultiplier;
  }

  if (itemInc.dimmers !== false) {
    matElectrical += mto.dimmersUnits * (rates.switchDimmer?.material ?? DEFAULT_UNIT_COST_RATES.switchDimmer.material) * wasteMultiplier;
    labElectrical += mto.dimmersUnits * (rates.switchDimmer?.labor ?? DEFAULT_UNIT_COST_RATES.switchDimmer.labor) * wasteMultiplier;
  }

  if (itemInc.stdOutlets !== false) {
    matElectrical += mto.stdOutletsUnits * (rates.outletPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.material) * wasteMultiplier;
    labElectrical += mto.stdOutletsUnits * (rates.outletPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.outletPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.gfciOutlets !== false) {
    matElectrical += mto.gfciOutletsUnits * (rates.gfciPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.material) * wasteMultiplier;
    labElectrical += mto.gfciOutletsUnits * (rates.gfciPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.gfciPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.heavyOutlets24v !== false) {
    matElectrical += mto.heavyOutlets24vUnits * (rates.outlet240v?.material ?? DEFAULT_UNIT_COST_RATES.outlet240v.material) * wasteMultiplier;
    labElectrical += mto.heavyOutlets24vUnits * (rates.outlet240v?.labor ?? DEFAULT_UNIT_COST_RATES.outlet240v.labor) * wasteMultiplier;
  }

  if (itemInc.potlights !== false) {
    matElectrical += mto.potlightsUnits * (rates.potlightPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.material) * wasteMultiplier;
    labElectrical += mto.potlightsUnits * (rates.potlightPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.potlightPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.fixturesSconces !== false) {
    matElectrical += mto.fixturesSconcesUnits * (rates.fixtureSconce?.material ?? DEFAULT_UNIT_COST_RATES.fixtureSconce.material) * wasteMultiplier;
    labElectrical += mto.fixturesSconcesUnits * (rates.fixtureSconce?.labor ?? DEFAULT_UNIT_COST_RATES.fixtureSconce.labor) * wasteMultiplier;
  }

  if (mto.exteriorCoachLightsUnits > 0 && itemInc.exteriorCoachLights !== false) {
    matElectrical += mto.exteriorCoachLightsUnits * (rates.exteriorCoachLight?.material ?? DEFAULT_UNIT_COST_RATES.exteriorCoachLight.material) * wasteMultiplier;
    labElectrical += mto.exteriorCoachLightsUnits * (rates.exteriorCoachLight?.labor ?? DEFAULT_UNIT_COST_RATES.exteriorCoachLight.labor) * wasteMultiplier;
  }

  if (mto.soffitLightsUnits > 0 && itemInc.soffitLights !== false) {
    matElectrical += mto.soffitLightsUnits * (rates.soffitLight?.material ?? DEFAULT_UNIT_COST_RATES.soffitLight.material) * wasteMultiplier;
    labElectrical += mto.soffitLightsUnits * (rates.soffitLight?.labor ?? DEFAULT_UNIT_COST_RATES.soffitLight.labor) * wasteMultiplier;
  }

  if (itemInc.ceilingFans !== false) {
    matElectrical += mto.ceilingFansUnits * (rates.ceilingFanPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.ceilingFanPerUnit.material) * wasteMultiplier;
    labElectrical += mto.ceilingFansUnits * (rates.ceilingFanPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.ceilingFanPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.spotExhaustFans !== false) {
    matElectrical += mto.spotExhaustFansUnits * (rates.exhaustFanPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.exhaustFanPerUnit.material) * wasteMultiplier;
    labElectrical += mto.spotExhaustFansUnits * (rates.exhaustFanPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.exhaustFanPerUnit.labor) * wasteMultiplier;
  }

  if (mto.rangeHoodsUnits > 0 && itemInc.rangeHoods !== false) {
    matElectrical += mto.rangeHoodsUnits * (rates.rangeHoodPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.rangeHoodPerUnit.material) * wasteMultiplier;
    labElectrical += mto.rangeHoodsUnits * (rates.rangeHoodPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.rangeHoodPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.smokeCoAlarms !== false) {
    matElectrical += mto.smokeCoAlarmsUnits * (rates.smokeAlarmPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.material) * wasteMultiplier;
    labElectrical += mto.smokeCoAlarmsUnits * (rates.smokeAlarmPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.smokeAlarmPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.electricalPanels !== false) {
    // Dynamically calculate based on individual panel types and amperages from the MTO breakdown
    let panelMaterial = 0;
    let panelLabor = 0;
    mto.panelBreakdown.forEach(panel => {
      const type = panel.type || 'main';
      const amp = panel.amperage || (type === 'main' ? '200A' : '100A');
      
      let rateKey: keyof UnitCostRates = 'electricalPanelMain200A'; // Safe fallback
      
      if (type === 'main') {
        if (amp === '100A') rateKey = 'electricalPanelMain100A';
        else if (amp === '400A') rateKey = 'electricalPanelMain400A';
        else rateKey = 'electricalPanelMain200A';
      } else {
        if (amp === '60A') rateKey = 'electricalPanelSub60A';
        else if (amp === '125A') rateKey = 'electricalPanelSub125A';
        else if (amp === '100A') rateKey = 'electricalPanelSub100A';
        else rateKey = 'electricalPanelSub100A';
      }

      const rate = rates[rateKey] || DEFAULT_UNIT_COST_RATES[rateKey];
      if (rate) {
        panelMaterial += (rate.material ?? DEFAULT_UNIT_COST_RATES[rateKey].material) * panel.count;
        panelLabor += (rate.labor ?? DEFAULT_UNIT_COST_RATES[rateKey].labor) * panel.count;
      }
    });
    matElectrical += panelMaterial * wasteMultiplier;
    labElectrical += panelLabor * wasteMultiplier;
  }

  // 5. Plumbing & Civil
  let matPlumbing = 0;
  let labPlumbing = 0;

  if (itemInc.plumbingFixtures !== false) {
    matPlumbing += mto.plumbingFixturesUnits * (rates.plumbingPerFixture?.material ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.material) * wasteMultiplier;
    labPlumbing += mto.plumbingFixturesUnits * (rates.plumbingPerFixture?.labor ?? DEFAULT_UNIT_COST_RATES.plumbingPerFixture.labor) * wasteMultiplier;
  }

  if (itemInc.utilityTrenching !== false) {
    matPlumbing += mto.utilityTrenchingLf * (rates.utilityTrenchPerLf?.material ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.material) * wasteMultiplier;
    labPlumbing += mto.utilityTrenchingLf * (rates.utilityTrenchPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.utilityTrenchPerLf.labor) * wasteMultiplier;
  }

  // 6. Concrete & Foundations
  let matConcrete = 0;
  let labConcrete = 0;

  if (itemInc.pouredConcreteCy !== false) {
    matConcrete += mto.pouredConcreteCy * (rates.concretePerCy?.material ?? DEFAULT_UNIT_COST_RATES.concretePerCy.material) * wasteMultiplier;
    labConcrete += mto.pouredConcreteCy * (rates.concretePerCy?.labor ?? DEFAULT_UNIT_COST_RATES.concretePerCy.labor) * wasteMultiplier;
  }

  if (itemInc.helicalPiersPiles !== false) {
    matConcrete += mto.helicalPiersPiles * (rates.pierPerUnit?.material ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.material) * wasteMultiplier;
    labConcrete += mto.helicalPiersPiles * (rates.pierPerUnit?.labor ?? DEFAULT_UNIT_COST_RATES.pierPerUnit.labor) * wasteMultiplier;
  }

  if (itemInc.foundationSlabInsulation !== false) {
    matConcrete += mto.foundationSlabInsulationSf * 0.85 * wasteMultiplier;
    labConcrete += mto.foundationSlabInsulationSf * 0.55 * wasteMultiplier;
  }

  // 7. Roofing & Facades
  let matRoofing = 0;
  let labRoofing = 0;

  if (itemInc.roofingArea !== false) {
    matRoofing += mto.roofingAreaSq * (rates.roofingPerSq?.material ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.material) * wasteMultiplier;
    labRoofing += mto.roofingAreaSq * (rates.roofingPerSq?.labor ?? DEFAULT_UNIT_COST_RATES.roofingPerSq.labor) * wasteMultiplier;
  }

  if (itemInc.primarySiding !== false) {
    matRoofing += mto.primarySidingSf * (rates.sidingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.material) * wasteMultiplier;
    labRoofing += mto.primarySidingSf * (rates.sidingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.labor) * wasteMultiplier;
  }

  if (itemInc.stoneBrickVeneer !== false) {
    matRoofing += mto.stoneBrickVeneerSf * (rates.sidingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.material) * 2.2 * wasteMultiplier;
    labRoofing += mto.stoneBrickVeneerSf * (rates.sidingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.sidingPerSf.labor) * 2.0 * wasteMultiplier;
  }

  if (itemInc.soffitFasciaEaves !== false) {
    matRoofing += mto.soffitTotalLf * (rates.soffitPerLf?.material ?? DEFAULT_UNIT_COST_RATES.soffitPerLf.material) * wasteMultiplier;
    labRoofing += mto.soffitTotalLf * (rates.soffitPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.soffitPerLf.labor) * wasteMultiplier;
    matRoofing += mto.fasciaTotalLf * (rates.fasciaPerLf?.material ?? DEFAULT_UNIT_COST_RATES.fasciaPerLf.material) * wasteMultiplier;
    labRoofing += mto.fasciaTotalLf * (rates.fasciaPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.fasciaPerLf.labor) * wasteMultiplier;
    matRoofing += mto.eavestroughsLf * (rates.eavestroughPerLf?.material ?? DEFAULT_UNIT_COST_RATES.eavestroughPerLf.material) * wasteMultiplier;
    labRoofing += mto.eavestroughsLf * (rates.eavestroughPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.eavestroughPerLf.labor) * wasteMultiplier;
  }

  if (itemInc.timberDecking !== false) {
    matRoofing += mto.timberDeckingSf * (rates.deckingPerSf?.material ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.material) * wasteMultiplier;
    labRoofing += mto.timberDeckingSf * (rates.deckingPerSf?.labor ?? DEFAULT_UNIT_COST_RATES.deckingPerSf.labor) * wasteMultiplier;
  }

  if (itemInc.deckRailing !== false) {
    matRoofing += mto.deckPerimeterRailingLf * (rates.deckRailingPerLf?.material ?? DEFAULT_UNIT_COST_RATES.deckRailingPerLf.material) * wasteMultiplier;
    labRoofing += mto.deckPerimeterRailingLf * (rates.deckRailingPerLf?.labor ?? DEFAULT_UNIT_COST_RATES.deckRailingPerLf.labor) * wasteMultiplier;
  }

  if (itemInc.siteHardscaping !== false) {
    matRoofing += mto.siteHardscapingSf * (rates.hardscapePerSf?.material ?? DEFAULT_UNIT_COST_RATES.hardscapePerSf.material) * wasteMultiplier;
    labRoofing += mto.siteHardscapingSf * (rates.hardscapePerSf?.labor ?? DEFAULT_UNIT_COST_RATES.hardscapePerSf.labor) * wasteMultiplier;
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

  const baseDirectCost = materialSubtotal + laborSubtotal;

  // Indirect Costs & Markups
  const pmPct = (settings?.projectManagementPercentage || 0) / 100;
  const contPct = (settings?.projectContingencyPercentage || 0) / 100;
  const ohPct = (settings?.overheadPercentage || 0) / 100;
  const profitPct = (settings?.profitPercentage || 0) / 100;

  const indirectProjectManagement = baseDirectCost * pmPct;
  const indirectContingency = baseDirectCost * contPct;
  const subtotalBeforeOH = baseDirectCost + indirectProjectManagement + indirectContingency;

  const grossMarginOverhead = subtotalBeforeOH * ohPct;
  const grossMarginProfit = subtotalBeforeOH * profitPct;
  const contractorGrandTotal = subtotalBeforeOH + grossMarginOverhead + grossMarginProfit;

  return {
    materialSubtotal: Math.round(materialSubtotal),
    laborSubtotal: Math.round(laborSubtotal),
    totalCost: Math.round(contractorGrandTotal),
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
    baseDirectCost: Math.round(baseDirectCost),
    indirectProjectManagement: Math.round(indirectProjectManagement),
    indirectContingency: Math.round(indirectContingency),
    grossMarginOverhead: Math.round(grossMarginOverhead),
    grossMarginProfit: Math.round(grossMarginProfit),
    contractorGrandTotal: Math.round(contractorGrandTotal),
  };
}
