export type UnitSystem = 'imperial' | 'metric'; // imperial: feet/inches & SF, metric: meters & m²
export type CanvasTheme = 'dark' | 'light' | 'blueprint';

export type WallType = 'exterior_2x6' | 'interior_2x4' | 'partition_2x4' | 'plumbing_2x6' | 'bearing_2x6' | 'foundation_wall';

export interface CadNode {
  id: string;
  x: number; // in feet (or meters if metric mode, internally normalized to feet: 1 unit = 1 ft)
  y: number;
}

export type ApertureType =
  | 'window_standard'
  | 'window_slider'
  | 'window_picture'
  | 'door_passage'
  | 'door_pocket'
  | 'door_exterior'
  | 'door_garage'
  | 'door_sliding_patio'
  | 'door_bifold';

export interface Aperture {
  id: string;
  wallId: string;
  offset: number; // distance from startNode along wall centerline in feet
  width: number; // in feet (e.g. 3.0 for 3ft door, 4.0 for window)
  height: number; // in feet (e.g. 6.67 for 80" door, 4.0 for window)
  sillHeight?: number; // in feet from floor (default 0 for doors, 3.0 for windows)
  type: ApertureType;
  label?: string;
  swingSide?: 'left' | 'right' | 'inward' | 'outward';
  hingeSide?: 'left' | 'right';
  casingSides?: 1 | 2; // 2 for interior passage doors, 1 for exterior doors
  rotation?: number;
}

export type StampCategory =
  | 'structural'
  | 'electrical_switch'
  | 'electrical_outlet'
  | 'lighting'
  | 'fan_vent'
  | 'safety'
  | 'plumbing'
  | 'civil_trench'
  | 'deck_hardscape';

export type StampType =
  // Structural
  | 'column_post'
  | 'helical_pier'
  | 'beam_segment'
  | 'stair_run'
  // Electrical
  | 'switch_std'
  | 'switch_dimmer'
  | 'switch_3way'
  | 'outlet_std'
  | 'outlet_gfci'
  | 'outlet_240v'
  | 'outlet_ev'
  // Lighting
  | 'light_fixture'
  | 'light_coach'
  | 'light_soffit'
  | 'light_potlight'
  // Fans / HVAC
  | 'fan_ceiling'
  | 'fan_exhaust'
  | 'fan_rangehood'
  // Safety
  | 'alarm_smoke_co'
  // Plumbing
  | 'plumbing_fixture'
  | 'plumbing_toilet'
  | 'plumbing_sink'
  | 'plumbing_shower'
  | 'plumbing_tub'
  | 'plumbing_hose_bib'
  | 'plumbing_water_heater'
  // Civil / Trenching
  | 'utility_trench'
  // Site
  | 'deck_point'
  | 'hardscape_point';

export interface CadStamp {
  id: string;
  type: StampType;
  x: number; // in feet
  y: number; // in feet
  parentType: 'wall' | 'room' | 'canvas';
  parentId?: string; // wallId or roomId if snapped
  rotation?: number; // in degrees (0, 90, 180, 270, etc.)
  label?: string;
  // Specific attributes:
  length?: number; // For beam or trench (in feet)
  points?: Array<{ x: number; y: number }>; // For multi-point paths like trenching or stair run
  stairRisers?: number; // Calculated or custom stair risers
  stairWidth?: number;
}

export interface CadWall {
  id: string;
  startNodeId: string;
  endNodeId: string;
  thickness: number; // in feet (e.g., 0.375 ft = 4.5", 0.54 ft = 6.5")
  height: number; // in feet (e.g., 8.0, 9.0, 10.0)
  wallType: WallType;
  isExteriorManualOverride?: boolean; // optional override
  customStudSpacing?: 16 | 24; // inches on center (default 16)
  finishExterior?: 'vinyl_siding' | 'brick_veneer' | 'stucco' | 'none';
  soundInsulated?: boolean;
}

export type FloorFinish =
  | 'hardwood'
  | 'engineered_wood'
  | 'porcelain_tile'
  | 'carpet'
  | 'luxury_vinyl_plank'
  | 'polished_concrete'
  | 'osb_subfloor_only';

export interface RoomPolygon {
  id: string;
  name: string;
  nodeIds: string[]; // ordered node IDs forming the polygon boundary
  points: Array<{ x: number; y: number }>; // coordinate polygon
  wallIds: string[]; // corresponding wall IDs along edges
  area: number; // net interior square feet
  perimeter: number; // net interior linear feet
  centroid: { x: number; y: number };
  floorFinish: FloorFinish;
  ceilingHeight: number; // in feet (defaults to project default)
  hasCeilingDrywall?: boolean;
}

export interface DeckArea {
  id: string;
  name: string;
  points: Array<{ x: number; y: number }>;
  area: number; // SF
  perimeter: number; // LF
}

export interface HardscapeArea {
  id: string;
  name: string;
  points: Array<{ x: number; y: number }>;
  area: number; // SF
}

export interface CostRateItem {
  material: number;
  labor: number;
}

export interface UnitCostRates {
  drywallPerSf: CostRateItem;
  paintPerSf: CostRateItem;
  flooringPerSf: CostRateItem;
  extInsulationPerSf: CostRateItem;
  studFramingPerLf: CostRateItem;
  osbSubfloorPerSf: CostRateItem;
  beamPerLf: CostRateItem;
  postPerUnit: CostRateItem;
  baseboardPerLf: CostRateItem;
  casingPerLf: CostRateItem;
  stairRiserPerUnit: CostRateItem;
  windowPerUnit: CostRateItem;
  passageDoorPerUnit: CostRateItem;
  pocketDoorPerUnit: CostRateItem;
  exteriorDoorPerUnit: CostRateItem;
  garageDoorPerBay: CostRateItem;
  doorHardwarePerSet: CostRateItem;
  switchPerUnit: CostRateItem;
  outletPerUnit: CostRateItem;
  gfciPerUnit: CostRateItem;
  evChargerPerUnit: CostRateItem;
  potlightPerUnit: CostRateItem;
  plumbingPerFixture: CostRateItem;
  concretePerCy: CostRateItem;
  pierPerUnit: CostRateItem;
  roofingPerSq: CostRateItem;
  sidingPerSf: CostRateItem;
  deckingPerSf: CostRateItem;
  // Extra trades & envelope items
  ceilingFanPerUnit: CostRateItem;
  exhaustFanPerUnit: CostRateItem;
  rangeHoodPerUnit: CostRateItem;
  smokeAlarmPerUnit: CostRateItem;
  utilityTrenchPerLf: CostRateItem;
  soffitPerLf: CostRateItem;
  fasciaPerLf: CostRateItem;
  eavestroughPerLf: CostRateItem;
  deckRailingPerLf: CostRateItem;
  hardscapePerSf: CostRateItem;
}

export interface CadAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number; // e.g. 14, 18, 24, 32
  style?: 'title' | 'level_label' | 'note' | 'dimension_callout';
  rotation?: number; // 0, 90, 180, 270
  color?: string;
}

export type CalculationMode = 'interior_finish' | 'exterior_framing';

export interface CategoryInclusions {
  finishes: boolean;
  carpentryFraming: boolean;
  fenestration: boolean;
  electricalSafety: boolean;
  plumbingCivil: boolean;
  concreteFoundations: boolean;
  roofingEnvelope: boolean;
}

export const DEFAULT_CATEGORY_INCLUSIONS: CategoryInclusions = {
  finishes: true,
  carpentryFraming: true,
  fenestration: true,
  electricalSafety: true,
  plumbingCivil: true,
  concreteFoundations: true,
  roofingEnvelope: true,
};

export interface ItemInclusions {
  // Finishes
  drywallBoard?: boolean;
  paintCoverage?: boolean;
  flooringPackage?: boolean;
  extWallInsulation?: boolean;

  // Carpentry & Framing
  wallStudFraming?: boolean;
  osbSubfloorDecking?: boolean;
  structuralBeams?: boolean;
  supportColumnsPosts?: boolean;
  baseboardTrims?: boolean;
  apertureCasing?: boolean;
  stairHandGuardrail?: boolean;
  calculatedStairRisers?: boolean;

  // Fenestration
  totalWindows?: boolean;
  passageDoors?: boolean;
  pocketDoors?: boolean;
  exteriorDoors?: boolean;
  overheadGarageBays?: boolean;
  doorHardwareSets?: boolean;

  // Electrical
  stdSwitches?: boolean;
  dimmers?: boolean;
  stdOutlets?: boolean;
  gfciOutlets?: boolean;
  heavyOutlets24v?: boolean;
  evChargers?: boolean;
  potlights?: boolean;
  fixturesSconces?: boolean;
  exteriorCoachLights?: boolean;
  soffitLights?: boolean;
  ceilingFans?: boolean;
  spotExhaustFans?: boolean;
  rangeHoods?: boolean;
  smokeCoAlarms?: boolean;

  // Plumbing & Civil
  plumbingFixtures?: boolean;
  utilityTrenching?: boolean;

  // Concrete & Foundations
  pouredConcreteCy?: boolean;
  helicalPiersPiles?: boolean;
  foundationSlabInsulation?: boolean;

  // Roofing & Envelope
  roofingArea?: boolean;
  primarySiding?: boolean;
  stoneBrickVeneer?: boolean;
  soffitFasciaEaves?: boolean;
  timberDecking?: boolean;
  deckRailing?: boolean;
  siteHardscaping?: boolean;
}

export const DEFAULT_ITEM_INCLUSIONS: ItemInclusions = {
  drywallBoard: true,
  paintCoverage: true,
  flooringPackage: true,
  extWallInsulation: true,
  wallStudFraming: true,
  osbSubfloorDecking: true,
  structuralBeams: true,
  supportColumnsPosts: true,
  baseboardTrims: true,
  apertureCasing: true,
  stairHandGuardrail: true,
  calculatedStairRisers: true,
  totalWindows: true,
  passageDoors: true,
  pocketDoors: true,
  exteriorDoors: true,
  overheadGarageBays: true,
  doorHardwareSets: true,
  stdSwitches: true,
  dimmers: true,
  stdOutlets: true,
  gfciOutlets: true,
  heavyOutlets24v: true,
  evChargers: true,
  potlights: true,
  fixturesSconces: true,
  exteriorCoachLights: true,
  soffitLights: true,
  ceilingFans: true,
  spotExhaustFans: true,
  rangeHoods: true,
  smokeCoAlarms: true,
  plumbingFixtures: true,
  utilityTrenching: true,
  pouredConcreteCy: true,
  helicalPiersPiles: true,
  foundationSlabInsulation: true,
  roofingArea: true,
  primarySiding: true,
  stoneBrickVeneer: true,
  soffitFasciaEaves: true,
  timberDecking: true,
  deckRailing: true,
  siteHardscaping: true,
};

export interface CompanyBranding {
  companyName?: string;
  address?: string;
  contact?: string; // phone / email / website
  logoUrl?: string; // Data URL or Image URL
  estimatorName?: string;
  projectNumber?: string;
}

export interface ProjectSettings {
  unitSystem: UnitSystem;
  theme: CanvasTheme;
  calculationMode: CalculationMode;
  defaultWallHeight: number; // e.g. 9.0 ft
  defaultCeilingHeight: number; // e.g. 9.0 ft
  defaultWallThickness: number; // e.g. 0.375 ft (4.5")
  slabThicknessInches: number; // e.g. 4 inches (concrete CY calculation)
  roofPitchScale: number; // e.g. 4 (for 4:12 pitch -> sqrt(1 + (4/12)^2) = 1.054)
  roofOverhangInches: number; // e.g. 18 inches
  studSpacingInches: 16 | 24; // 16" or 24" O.C.
  gridSnapSize: number; // 0.5 ft (6") or 1.0 ft
  angleSnapIncrement: number; // 15, 45, or 90 degrees
  orthoMode: boolean;
  showDimensions: boolean;
  showRoomLabels: boolean;
  showMepIcons: boolean;
  wasteFactorPercentage: number; // e.g. 10 for 10%
  overheadPercentage: number;
  profitPercentage: number;
  projectContingencyPercentage: number;
  projectManagementPercentage: number;
  costRates?: UnitCostRates;
  categoryInclusions?: CategoryInclusions;
  itemInclusions?: ItemInclusions;
  companyBranding?: CompanyBranding;
}

export type ActiveTool =
  | 'select'
  | 'wall_pen'
  | 'wall_rect'
  | 'room_box'
  | 'text_label'
  | 'aperture_window'
  | 'aperture_door'
  | 'aperture_pocket_door'
  | 'aperture_exterior_door'
  | 'aperture_garage'
  | 'aperture_patio_slider'
  | 'stamp_column'
  | 'stamp_pier'
  | 'stamp_beam'
  | 'stamp_stair'
  | 'stamp_switch'
  | 'stamp_dimmer'
  | 'stamp_3way'
  | 'stamp_outlet'
  | 'stamp_gfci'
  | 'stamp_240v'
  | 'stamp_ev'
  | 'stamp_potlight'
  | 'stamp_light_fixture'
  | 'stamp_coach_light'
  | 'stamp_soffit_light'
  | 'stamp_fan_ceiling'
  | 'stamp_fan_exhaust'
  | 'stamp_rangehood'
  | 'alarm_smoke_co'
  | 'stamp_plumbing_toilet'
  | 'stamp_plumbing_sink'
  | 'stamp_plumbing_shower'
  | 'stamp_plumbing_tub'
  | 'stamp_plumbing_hose_bib'
  | 'stamp_plumbing_water_heater'
  | 'stamp_plumbing_fixture'
  | 'stamp_utility_trench'
  | 'polygon_deck'
  | 'polygon_hardscape'
  | 'ruler_measure';

export interface SelectionState {
  type: 'none' | 'node' | 'wall' | 'aperture' | 'stamp' | 'room' | 'deck' | 'hardscape' | 'annotation';
  id?: string;
}

export interface MTOReport {
  // Global Floor Area Metrics
  grossFootprintSf: number;
  netFloorAreaSf: number;

  // 1. Board & Finishes
  drywallBoardSf: number;
  paintCoverageSf: number;
  flooringPackageSf: number;
  extWallInsulationSf: number;

  // 2. Carpentry, Framing & Substructures
  wallStudFramingLf: number;
  wallStudCount: number;
  osbSubfloorDeckingSf: number;
  structuralBeamsLf: number;
  supportColumnsPosts: number;
  baseboardTrimsLf: number;
  apertureCasingLf: number;
  stairHandGuardrailLf: number;
  calculatedStairRisers: number;

  // 3. Apertures, Doors & Fenestration
  totalWindowsUnits: number;
  passageDoorsUnits: number;
  pocketDoorsUnits: number;
  exteriorDoorsUnits: number;
  overheadGarageBays: number;
  doorHardwareSets: number;

  // 4. Electrical, Lighting & Safety
  stdSwitchesUnits: number;
  dimmersUnits: number;
  stdOutletsUnits: number;
  gfciOutletsUnits: number;
  heavyOutlets24vUnits: number;
  evChargersUnits: number;
  fixturesSconcesUnits: number;
  exteriorCoachLightsUnits: number;
  soffitLightsUnits: number;
  potlightsUnits: number;
  ceilingFansUnits: number;
  spotExhaustFansUnits: number;
  rangeHoodsUnits: number;
  smokeCoAlarmsUnits: number;

  // 5. Mechanical Plumbing & Civil
  plumbingFixturesUnits: number;
  utilityTrenchingLf: number;

  // 6. Concrete & Foundations
  pouredConcreteCy: number;
  helicalPiersPiles: number;
  foundationSlabInsulationSf: number;

  // 7. Roofing, Facades & Site Envelope
  roofingAreaSq: number;
  roofingAreaSf: number;
  primarySidingSf: number;
  stoneBrickVeneerSf: number;
  soffitTotalLf: number;
  fasciaTotalLf: number;
  eavestroughsLf: number;
  timberDeckingSf: number;
  deckPerimeterRailingLf: number;
  siteHardscapingSf: number;

  // Detailed breakdowns for inspector / itemization
  wallDetails: Array<{
    wallId: string;
    length: number;
    height: number;
    grossArea: number;
    apertureDeduction: number;
    netDrywallArea: number;
    classification: 'exterior' | 'shared_interior' | 'partition';
    adjacentRoomsCount: number;
    studsCalculated: number;
  }>;
  roomDetails: Array<{
    roomId: string;
    name: string;
    area: number;
    perimeter: number;
    floorFinish: string;
    baseboardLf: number;
    hasCeilingDrywall?: boolean;
  }>;
}

export interface FloorplanState {
  nodes: CadNode[];
  walls: CadWall[];
  apertures: Aperture[];
  stamps: CadStamp[];
  annotations?: CadAnnotation[];
  rooms: RoomPolygon[];
  decks: DeckArea[];
  hardscapes: HardscapeArea[];
  settings: ProjectSettings;
}
