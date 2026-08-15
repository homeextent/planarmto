import { FloorplanState, ProjectSettings, DEFAULT_CATEGORY_INCLUSIONS } from '../types';
import { detectRoomFaces } from './cadMath';

export const DEFAULT_SETTINGS: ProjectSettings = {
  unitSystem: 'imperial',
  theme: 'blueprint',
  calculationMode: 'exterior_framing',
  defaultWallHeight: 9.0, // 9ft standard
  defaultCeilingHeight: 9.0,
  defaultWallThickness: 0.375, // 4.5"
  slabThicknessInches: 4.0,
  roofPitchScale: 4.0, // 4:12 pitch
  roofOverhangInches: 18.0,
  studSpacingInches: 16,
  gridSnapSize: 0.5,
  angleSnapIncrement: 15,
  orthoMode: false,
  showDimensions: true,
  showRoomLabels: true,
  showMepIcons: true,
  categoryInclusions: { ...DEFAULT_CATEGORY_INCLUSIONS },
};

export function createBlankProject(): FloorplanState {
  return {
    nodes: [],
    walls: [],
    apertures: [],
    stamps: [],
    rooms: [],
    decks: [],
    hardscapes: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function createModernTwoBedroomRancher(): FloorplanState {
  // Coordinates in feet (e.g. 40ft x 28ft main body + 14ft x 20ft garage)
  const nodes = [
    // Main Exterior Perimeter (0,0) to (40, 26)
    { id: 'n1', x: 0, y: 0 },
    { id: 'n2', x: 26, y: 0 },
    { id: 'n3', x: 40, y: 0 },
    { id: 'n4', x: 40, y: 24 },
    { id: 'n5', x: 26, y: 24 },
    { id: 'n6', x: 0, y: 24 },

    // Interior Dividers
    { id: 'n7', x: 26, y: 12 }, // Mid interior T-junction
    { id: 'n8', x: 14, y: 0 }, // Kitchen / Living divider top
    { id: 'n9', x: 14, y: 12 }, // Foyer / Hallway junction
    { id: 'n10', x: 14, y: 24 }, // Living / Bedroom divider bottom
    { id: 'n11', x: 0, y: 12 }, // Living / Dining left divider
    { id: 'n12', x: 40, y: 12 }, // Bedroom 1 / Bedroom 2 right junction
  ];

  const walls = [
    // Exterior perimeter
    { id: 'w1', startNodeId: 'n1', endNodeId: 'n8', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w2', startNodeId: 'n8', endNodeId: 'n2', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w3', startNodeId: 'n2', endNodeId: 'n3', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w4', startNodeId: 'n3', endNodeId: 'n12', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w5', startNodeId: 'n12', endNodeId: 'n4', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w6', startNodeId: 'n4', endNodeId: 'n5', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w7', startNodeId: 'n5', endNodeId: 'n10', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w8', startNodeId: 'n10', endNodeId: 'n6', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w9', startNodeId: 'n6', endNodeId: 'n11', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w10', startNodeId: 'n11', endNodeId: 'n1', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },

    // Interior walls
    { id: 'w11', startNodeId: 'n8', endNodeId: 'n9', thickness: 0.375, height: 9.0, wallType: 'interior_2x4' as const },
    { id: 'w12', startNodeId: 'n9', endNodeId: 'n7', thickness: 0.375, height: 9.0, wallType: 'interior_2x4' as const },
    { id: 'w13', startNodeId: 'n2', endNodeId: 'n7', thickness: 0.375, height: 9.0, wallType: 'interior_2x4' as const },
    { id: 'w14', startNodeId: 'n7', endNodeId: 'n5', thickness: 0.375, height: 9.0, wallType: 'interior_2x4' as const },
    { id: 'w15', startNodeId: 'n7', endNodeId: 'n12', thickness: 0.375, height: 9.0, wallType: 'interior_2x4' as const },
    { id: 'w16', startNodeId: 'n9', endNodeId: 'n10', thickness: 0.375, height: 9.0, wallType: 'interior_2x4' as const },
  ];

  const apertures = [
    // Exterior Entry Door on w1
    { id: 'ap1', wallId: 'w1', offset: 7.0, width: 3.0, height: 6.67, type: 'door_exterior' as const, label: 'Entry Door' },
    // Windows on exterior walls
    { id: 'ap2', wallId: 'w10', offset: 6.0, width: 5.0, height: 4.0, type: 'window_standard' as const, label: 'Living Window' },
    { id: 'ap3', wallId: 'w9', offset: 6.0, width: 5.0, height: 4.0, type: 'window_standard' as const, label: 'Living Window' },
    { id: 'ap4', wallId: 'w3', offset: 7.0, width: 4.0, height: 3.5, type: 'window_slider' as const, label: 'Kitchen Window' },
    { id: 'ap5', wallId: 'w4', offset: 6.0, width: 4.0, height: 4.0, type: 'window_standard' as const, label: 'Bed 1 Window' },
    { id: 'ap6', wallId: 'w5', offset: 6.0, width: 4.0, height: 4.0, type: 'window_standard' as const, label: 'Bed 2 Window' },
    { id: 'ap7', wallId: 'w7', offset: 6.0, width: 6.0, height: 6.67, type: 'door_sliding_patio' as const, label: 'Patio Slider' },

    // Interior Passage Doors
    { id: 'ap8', wallId: 'w13', offset: 6.0, width: 2.67, height: 6.67, type: 'door_passage' as const, label: 'Bath Door' },
    { id: 'ap9', wallId: 'w15', offset: 6.0, width: 2.67, height: 6.67, type: 'door_passage' as const, label: 'Bed 2 Door' },
    { id: 'ap10', wallId: 'w14', offset: 6.0, width: 2.67, height: 6.67, type: 'door_passage' as const, label: 'Bed 1 Door' },
  ];

  const stamps = [
    // Lighting & Switches in Living Area
    { id: 'st1', type: 'switch_std' as const, x: 5.5, y: 1.5, parentType: 'canvas' as const },
    { id: 'st2', type: 'switch_dimmer' as const, x: 6.5, y: 1.5, parentType: 'canvas' as const },
    { id: 'st3', type: 'light_potlight' as const, x: 4.0, y: 6.0, parentType: 'canvas' as const },
    { id: 'st4', type: 'light_potlight' as const, x: 10.0, y: 6.0, parentType: 'canvas' as const },
    { id: 'st5', type: 'light_potlight' as const, x: 4.0, y: 18.0, parentType: 'canvas' as const },
    { id: 'st6', type: 'light_potlight' as const, x: 10.0, y: 18.0, parentType: 'canvas' as const },
    { id: 'st7', type: 'fan_ceiling' as const, x: 7.0, y: 12.0, parentType: 'canvas' as const },
    { id: 'st8', type: 'outlet_std' as const, x: 0.8, y: 6.0, parentType: 'canvas' as const },
    { id: 'st9', type: 'outlet_std' as const, x: 0.8, y: 18.0, parentType: 'canvas' as const },
    { id: 'st10', type: 'outlet_std' as const, x: 13.2, y: 18.0, parentType: 'canvas' as const },
    { id: 'st11', type: 'alarm_smoke_co' as const, x: 13.0, y: 11.0, parentType: 'canvas' as const },

    // Kitchen Outlets & Plumbing
    { id: 'st12', type: 'plumbing_sink' as const, x: 33.0, y: 1.5, parentType: 'canvas' as const },
    { id: 'st13', type: 'outlet_gfci' as const, x: 30.0, y: 0.8, parentType: 'canvas' as const },
    { id: 'st14', type: 'outlet_gfci' as const, x: 36.0, y: 0.8, parentType: 'canvas' as const },
    { id: 'st15', type: 'outlet_240v' as const, x: 38.5, y: 4.0, parentType: 'canvas' as const },
    { id: 'st16', type: 'fan_rangehood' as const, x: 38.5, y: 6.0, parentType: 'canvas' as const },

    // Bathroom Plumbing & Fan
    { id: 'st17', type: 'plumbing_toilet' as const, x: 20.0, y: 1.5, parentType: 'canvas' as const },
    { id: 'st18', type: 'plumbing_sink' as const, x: 23.0, y: 1.5, parentType: 'canvas' as const },
    { id: 'st19', type: 'plumbing_tub' as const, x: 16.0, y: 5.0, parentType: 'canvas' as const },
    { id: 'st20', type: 'fan_exhaust' as const, x: 20.0, y: 6.0, parentType: 'canvas' as const },
    { id: 'st21', type: 'outlet_gfci' as const, x: 24.5, y: 2.0, parentType: 'canvas' as const },

    // Bedrooms & Structural Column
    { id: 'st22', type: 'alarm_smoke_co' as const, x: 33.0, y: 18.0, parentType: 'canvas' as const },
    { id: 'st23', type: 'column_post' as const, x: 14.0, y: 12.0, parentType: 'canvas' as const },
    { id: 'st24', type: 'beam_segment' as const, x: 14.0, y: 12.0, length: 14.0, parentType: 'canvas' as const },

    // Exterior Utility & Lights
    { id: 'st25', type: 'light_coach' as const, x: 5.0, y: -0.5, parentType: 'canvas' as const },
    { id: 'st26', type: 'plumbing_hose_bib' as const, x: 40.5, y: 18.0, parentType: 'canvas' as const },
    { id: 'st27', type: 'outlet_ev' as const, x: -0.8, y: 2.0, parentType: 'canvas' as const },
    { id: 'st28', type: 'utility_trench' as const, x: 0, y: 0, length: 35.0, parentType: 'canvas' as const },
  ];

  const decks = [
    {
      id: 'deck1',
      name: 'Rear Cedar Deck',
      points: [
        { x: 14, y: 24 },
        { x: 26, y: 24 },
        { x: 26, y: 34 },
        { x: 14, y: 34 },
      ],
      area: 120,
      perimeter: 44,
    },
  ];

  const hardscapes = [
    {
      id: 'hardscape1',
      name: 'Paver Entry Patio',
      points: [
        { x: 4, y: -6 },
        { x: 12, y: -6 },
        { x: 12, y: 0 },
        { x: 4, y: 0 },
      ],
      area: 48,
    },
  ];

  const detectedRooms = detectRoomFaces(nodes, walls);
  // Name rooms nicely
  const namedRooms = detectedRooms.map((r) => {
    if (r.centroid.x < 14) {
      return { ...r, name: 'Great Room & Foyer', floorFinish: 'hardwood' as const };
    } else if (r.centroid.x > 26 && r.centroid.y < 12) {
      return { ...r, name: 'Kitchen & Dining', floorFinish: 'luxury_vinyl_plank' as const };
    } else if (r.centroid.x >= 14 && r.centroid.x <= 26 && r.centroid.y < 12) {
      return { ...r, name: 'Full Bathroom', floorFinish: 'porcelain_tile' as const };
    } else if (r.centroid.x > 26 && r.centroid.y >= 12) {
      return { ...r, name: 'Primary Suite', floorFinish: 'carpet' as const };
    } else {
      return { ...r, name: 'Guest Bedroom', floorFinish: 'hardwood' as const };
    }
  });

  return {
    nodes,
    walls,
    apertures,
    stamps,
    rooms: namedRooms,
    decks,
    hardscapes,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function createStudioSuite(): FloorplanState {
  const nodes = [
    { id: 'n1', x: 0, y: 0 },
    { id: 'n2', x: 24, y: 0 },
    { id: 'n3', x: 24, y: 20 },
    { id: 'n4', x: 0, y: 20 },

    // Bath corner
    { id: 'n5', x: 16, y: 0 },
    { id: 'n6', x: 16, y: 8 },
    { id: 'n7', x: 24, y: 8 },
  ];

  const walls = [
    { id: 'w1', startNodeId: 'n1', endNodeId: 'n5', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w2', startNodeId: 'n5', endNodeId: 'n2', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w3', startNodeId: 'n2', endNodeId: 'n7', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w4', startNodeId: 'n7', endNodeId: 'n3', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w5', startNodeId: 'n3', endNodeId: 'n4', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },
    { id: 'w6', startNodeId: 'n4', endNodeId: 'n1', thickness: 0.5, height: 9.0, wallType: 'exterior_2x6' as const },

    // Bath walls
    { id: 'w7', startNodeId: 'n5', endNodeId: 'n6', thickness: 0.375, height: 9.0, wallType: 'interior_2x4' as const },
    { id: 'w8', startNodeId: 'n6', endNodeId: 'n7', thickness: 0.375, height: 9.0, wallType: 'interior_2x4' as const },
  ];

  const apertures = [
    { id: 'ap1', wallId: 'w1', offset: 6.0, width: 3.0, height: 6.67, type: 'door_exterior' as const, label: 'Main Entry' },
    { id: 'ap2', wallId: 'w6', offset: 10.0, width: 6.0, height: 4.5, type: 'window_picture' as const, label: 'View Window' },
    { id: 'ap3', wallId: 'w5', offset: 12.0, width: 5.0, height: 4.0, type: 'window_standard' as const, label: 'Side Window' },
    { id: 'ap4', wallId: 'w8', offset: 4.0, width: 2.5, height: 6.67, type: 'door_pocket' as const, label: 'Bath Pocket Door' },
  ];

  const stamps = [
    { id: 'st1', type: 'plumbing_toilet' as const, x: 22.0, y: 2.0, parentType: 'canvas' as const },
    { id: 'st2', type: 'plumbing_sink' as const, x: 18.0, y: 2.0, parentType: 'canvas' as const },
    { id: 'st3', type: 'plumbing_shower' as const, x: 21.0, y: 6.0, parentType: 'canvas' as const },
    { id: 'st4', type: 'fan_exhaust' as const, x: 20.0, y: 4.0, parentType: 'canvas' as const },
    { id: 'st5', type: 'switch_std' as const, x: 5.0, y: 1.0, parentType: 'canvas' as const },
    { id: 'st6', type: 'light_potlight' as const, x: 8.0, y: 6.0, parentType: 'canvas' as const },
    { id: 'st7', type: 'light_potlight' as const, x: 8.0, y: 14.0, parentType: 'canvas' as const },
    { id: 'st8', type: 'alarm_smoke_co' as const, x: 8.0, y: 10.0, parentType: 'canvas' as const },
    { id: 'st9', type: 'outlet_std' as const, x: 0.8, y: 10.0, parentType: 'canvas' as const },
  ];

  const detectedRooms = detectRoomFaces(nodes, walls);
  const namedRooms = detectedRooms.map((r) => {
    if (r.centroid.x > 16 && r.centroid.y < 8) {
      return { ...r, name: '3-Piece Bath', floorFinish: 'porcelain_tile' as const };
    }
    return { ...r, name: 'Studio Living Space', floorFinish: 'hardwood' as const };
  });

  return {
    nodes,
    walls,
    apertures,
    stamps,
    rooms: namedRooms,
    decks: [],
    hardscapes: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function createGarageWorkshop(): FloorplanState {
  const nodes = [
    { id: 'n1', x: 0, y: 0 },
    { id: 'n2', x: 24, y: 0 },
    { id: 'n3', x: 24, y: 28 },
    { id: 'n4', x: 0, y: 28 },

    // Workshop Partition
    { id: 'n5', x: 0, y: 20 },
    { id: 'n6', x: 24, y: 20 },
  ];

  const walls = [
    { id: 'w1', startNodeId: 'n1', endNodeId: 'n2', thickness: 0.5, height: 10.0, wallType: 'exterior_2x6' as const },
    { id: 'w2', startNodeId: 'n2', endNodeId: 'n6', thickness: 0.5, height: 10.0, wallType: 'exterior_2x6' as const },
    { id: 'w3', startNodeId: 'n6', endNodeId: 'n3', thickness: 0.5, height: 10.0, wallType: 'exterior_2x6' as const },
    { id: 'w4', startNodeId: 'n3', endNodeId: 'n4', thickness: 0.5, height: 10.0, wallType: 'exterior_2x6' as const },
    { id: 'w5', startNodeId: 'n4', endNodeId: 'n5', thickness: 0.5, height: 10.0, wallType: 'exterior_2x6' as const },
    { id: 'w6', startNodeId: 'n5', endNodeId: 'n1', thickness: 0.5, height: 10.0, wallType: 'exterior_2x6' as const },
    // Partition
    { id: 'w7', startNodeId: 'n5', endNodeId: 'n6', thickness: 0.375, height: 10.0, wallType: 'interior_2x4' as const },
  ];

  const apertures = [
    // Double garage bays
    { id: 'ap1', wallId: 'w1', offset: 6.5, width: 9.0, height: 8.0, type: 'door_garage' as const, label: 'Bay 1' },
    { id: 'ap2', wallId: 'w1', offset: 17.5, width: 9.0, height: 8.0, type: 'door_garage' as const, label: 'Bay 2' },
    { id: 'ap3', wallId: 'w6', offset: 10.0, width: 3.0, height: 6.67, type: 'door_exterior' as const, label: 'Man Door' },
    { id: 'ap4', wallId: 'w4', offset: 12.0, width: 5.0, height: 3.5, type: 'window_slider' as const, label: 'Workshop Window' },
    { id: 'ap5', wallId: 'w7', offset: 12.0, width: 3.0, height: 6.67, type: 'door_passage' as const, label: 'Workshop Entry' },
  ];

  const stamps = [
    { id: 'st1', type: 'outlet_ev' as const, x: 2.0, y: 1.0, parentType: 'canvas' as const },
    { id: 'st2', type: 'outlet_240v' as const, x: 22.0, y: 1.0, parentType: 'canvas' as const },
    { id: 'st3', type: 'outlet_240v' as const, x: 22.0, y: 25.0, parentType: 'canvas' as const },
    { id: 'st4', type: 'helical_pier' as const, x: 0, y: 0, parentType: 'canvas' as const },
    { id: 'st5', type: 'helical_pier' as const, x: 24, y: 0, parentType: 'canvas' as const },
    { id: 'st6', type: 'helical_pier' as const, x: 24, y: 28, parentType: 'canvas' as const },
    { id: 'st7', type: 'helical_pier' as const, x: 0, y: 28, parentType: 'canvas' as const },
    { id: 'st8', type: 'light_potlight' as const, x: 6.0, y: 10.0, parentType: 'canvas' as const },
    { id: 'st9', type: 'light_potlight' as const, x: 18.0, y: 10.0, parentType: 'canvas' as const },
    { id: 'st10', type: 'light_potlight' as const, x: 12.0, y: 24.0, parentType: 'canvas' as const },
    { id: 'st11', type: 'alarm_smoke_co' as const, x: 12.0, y: 10.0, parentType: 'canvas' as const },
  ];

  const detectedRooms = detectRoomFaces(nodes, walls);
  const namedRooms = detectedRooms.map((r) => {
    if (r.centroid.y > 20) {
      return { ...r, name: 'Rear Workshop & Tool Room', floorFinish: 'polished_concrete' as const };
    }
    return { ...r, name: '2-Bay Vehicle Garage', floorFinish: 'polished_concrete' as const };
  });

  return {
    nodes,
    walls,
    apertures,
    stamps,
    rooms: namedRooms,
    decks: [],
    hardscapes: [],
    settings: { ...DEFAULT_SETTINGS, defaultWallHeight: 10.0 },
  };
}
