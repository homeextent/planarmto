import React from 'react';
import {
  FloorplanState,
  SelectionState,
  WallType,
  FloorFinish,
  ApertureType,
  ActiveTool,
} from '../types';
import {
  detectRoomFaces,
  getWallGeometry,
  getWallThickness,
  getNetInteriorPolygon,
  calculateSignedPolygonArea,
  calculatePolygonPerimeter,
} from '../engine/cadMath';
import { Settings2, Trash2, X, Sliders, Box, Layers, RotateCw, Type } from 'lucide-react';

interface InspectorPanelProps {
  state: FloorplanState;
  onChange: (newState: FloorplanState) => void;
  selection: SelectionState;
  onClose: () => void;
  onDelete: () => void;
  onToolChange?: (tool: ActiveTool) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  state,
  onChange,
  selection,
  onClose,
  onDelete,
  onToolChange,
}) => {
  if (selection.type === 'none' || !selection.id) return null;

  const nodeMap = new Map();
  state.nodes.forEach((n) => nodeMap.set(n.id, n));

  // 1. WALL INSPECTOR
  if (selection.type === 'wall') {
    const wall = state.walls.find((w) => w.id === selection.id);
    if (!wall) return null;
    const geom = getWallGeometry(wall, nodeMap);

    const handleWallTypeChange = (type: WallType) => {
      const updatedWalls = state.walls.map((w) => {
        if (w.id === wall.id) {
          let thickness = w.thickness;
          let finishExterior = w.finishExterior;

          if (type === 'partition_2x4' || type === 'interior_2x4') {
            thickness = 4.5 / 12; // 0.375 ft
            finishExterior = 'none';
          } else if (type === 'exterior_2x6') {
            thickness = 6.5 / 12; // 0.5417 ft
            finishExterior = 'vinyl_siding';
          } else if (type === 'foundation_wall') {
            thickness = 10 / 12; // 0.8333 ft
            finishExterior = 'none'; // Damp-proofing logic
          } else if (type === 'plumbing_2x6' || type === 'bearing_2x6') {
            thickness = 6.5 / 12;
            finishExterior = 'none';
          } else {
            // Default thickness logic for other types
            thickness = type.includes('2x6') ? 0.5417 : 0.375;
          }

          return {
            ...w,
            wallType: type,
            thickness,
            finishExterior,
          };
        }
        return w;
      });
      onChange({ ...state, walls: updatedWalls });
    };

    const handleHeightChange = (height: number) => {
      const updatedWalls = state.walls.map((w) =>
        w.id === wall.id ? { ...w, height } : w
      );
      onChange({ ...state, walls: updatedWalls });
    };

    const handleFinishChange = (finish: 'vinyl_siding' | 'brick_veneer' | 'stucco' | 'none') => {
      const updatedWalls = state.walls.map((w) =>
        w.id === wall.id ? { ...w, finishExterior: finish } : w
      );
      onChange({ ...state, walls: updatedWalls });
    };

    return (
      <div className="absolute top-16 right-88 w-72 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl p-4 text-slate-200 z-20 text-xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-sky-400">
            <Sliders className="w-4 h-4" />
            <span>Wall Segment Properties</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Wall Framing Type
            </label>
            <select
              value={wall.wallType}
              onChange={(e) => handleWallTypeChange(e.target.value as WallType)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="exterior_2x6">Exterior 2x6 (Insulated + Sheathing)</option>
              <option value="interior_2x4">Interior 2x4 (Double Drywall)</option>
              <option value="partition_2x4">Partition 2x4</option>
              <option value="plumbing_2x6">Plumbing Wet Wall 2x6</option>
              <option value="bearing_2x6">Load Bearing 2x6</option>
              <option value="foundation_wall">Foundation Wall</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Length (Derived)
              </label>
              <input
                type="text"
                disabled
                value={geom ? `${geom.length.toFixed(2)} ft` : '-'}
                className="w-full bg-slate-950/60 border border-slate-800/80 rounded-lg px-2 py-1 text-xs text-slate-400 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Wall Height (ft)
              </label>
              <input
                type="number"
                step="0.5"
                min="6"
                max="24"
                value={wall.height}
                onChange={(e) => handleHeightChange(parseFloat(e.target.value) || 8)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono focus:border-sky-500"
              />
            </div>
          </div>

          {/* Variable Wall Thickness Slider & Presets */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Assembly Thickness
              </label>
              <span className="text-xs font-mono font-bold text-sky-400">
                {(getWallThickness(wall) * 12).toFixed(1)}" (
                {getWallThickness(wall).toFixed(2)} ft)
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="16"
              step="0.5"
              value={(wall.thickness || 0.375) * 12}
              onChange={(e) => {
                const inches = parseFloat(e.target.value) || 4.5;
                const updatedWalls = state.walls.map((w) =>
                  w.id === wall.id ? { ...w, thickness: inches / 12 } : w
                );
                onChange({ ...state, walls: updatedWalls });
              }}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500 mb-2"
            />
            <div className="flex items-center gap-1">
              {[
                { label: '4.5" (2x4)', val: 4.5 / 12 },
                { label: '6.5" (2x6)', val: 6.5 / 12 },
                { label: '8" (CMU)', val: 8 / 12 },
                { label: '10"', val: 10 / 12 },
                { label: '12" (Fdn)', val: 12 / 12 },
              ].map((p) => {
                const isActive = Math.abs((wall.thickness || 0.375) - p.val) < 0.02;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      const updatedWalls = state.walls.map((w: any) =>
                        w.id === wall.id ? { ...w, thickness: p.val } : w
                      );
                      onChange({ ...state, walls: updatedWalls });
                    }}
                    className={`flex-1 py-1 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-sky-600/30 border-sky-500 text-sky-300'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Exterior Cladding Skin
            </label>
            <select
              value={wall.finishExterior || 'vinyl_siding'}
              onChange={(e) => handleFinishChange(e.target.value as any)}
              disabled={wall.wallType === 'foundation_wall'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 [&>option]:bg-slate-900 [&>option]:text-slate-100 disabled:opacity-50"
            >
              <option value="vinyl_siding">Standard Vinyl / Lap Siding</option>
              <option value="brick_veneer">Architectural Brick / Stone Veneer</option>
              <option value="stucco">Cement Stucco</option>
              <option value="none">None (Interior wall)</option>
            </select>
          </div>

          {wall.wallType === 'foundation_wall' && (
            <div className="p-3 bg-sky-950/30 border border-sky-500/30 rounded-xl space-y-3">
              <div className="text-[10px] uppercase font-bold text-sky-400">Foundation Dimensions</div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Wall Height (ft)</label>
                  <input
                    type="number"
                    value={wall.foundationDetails?.wallHeight ?? 8}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 8;
                      const updatedWalls = state.walls.map(w => w.id === wall.id ? {
                        ...w,
                        foundationDetails: { ...w.foundationDetails, wallHeight: val }
                      } : w);
                      onChange({ ...state, walls: updatedWalls });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Slab Thick (in)</label>
                  <input
                    type="number"
                    value={wall.foundationDetails?.slabThickness ?? 4}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 4;
                      const updatedWalls = state.walls.map(w => w.id === wall.id ? {
                        ...w,
                        foundationDetails: { ...w.foundationDetails, slabThickness: val }
                      } : w);
                      onChange({ ...state, walls: updatedWalls });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Footing Width (in)</label>
                  <input
                    type="number"
                    value={wall.foundationDetails?.footingWidth ?? 20}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 20;
                      const updatedWalls = state.walls.map(w => w.id === wall.id ? {
                        ...w,
                        foundationDetails: { ...w.foundationDetails, footingWidth: val }
                      } : w);
                      onChange({ ...state, walls: updatedWalls });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Footing Thick (in)</label>
                  <input
                    type="number"
                    value={wall.foundationDetails?.footingThickness ?? 10}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 10;
                      const updatedWalls = state.walls.map(w => w.id === wall.id ? {
                        ...w,
                        foundationDetails: { ...w.foundationDetails, footingThickness: val }
                      } : w);
                      onChange({ ...state, walls: updatedWalls });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs">
              <input
                type="checkbox"
                checked={wall.soundInsulated || false}
                onChange={(e) => {
                  const updatedWalls = state.walls.map((w: any) =>
                    w.id === wall.id ? { ...w, soundInsulated: e.target.checked } : w
                  );
                  onChange({ ...state, walls: updatedWalls });
                }}
                className="rounded bg-slate-950 border-slate-700 text-sky-500"
              />
              <span>{wall.wallType === 'foundation_wall' ? 'Damp-proofing Applied' : 'Sound Batt Insulation'}</span>
            </label>

            <button
              onClick={onDelete}
              className="px-2 py-1 bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 rounded text-xs flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. ROOM INSPECTOR
  if (selection.type === 'room') {
    const room = state.rooms.find((r) => r.id === selection.id);
    if (!room) return null;

    // Derived net metrics
    const wallThicknesses = (room.wallIds || []).map((wid) => {
      const w = state.walls.find((wall) => wall.id === wid);
      return w ? getWallThickness(w) : (state.settings.defaultWallThickness || 0.375);
    });
    const netPolygon = getNetInteriorPolygon(room.points, wallThicknesses);
    const netArea = calculateSignedPolygonArea(netPolygon);
    const netPerimeter = calculatePolygonPerimeter(netPolygon);

    const isFoundationRoom = room.roomType === 'Basement / Foundation Space' || room.wallIds.some(wid => {
      const w = state.walls.find(wall => wall.id === wid);
      return w?.wallType === 'foundation_wall';
    });

    const handleRoomNameChange = (name: string) => {
      const isBasement = name === 'Basement / Foundation Space';
      const updatedRooms = state.rooms.map((r) =>
        r.id === room.id ? { ...r, name, roomType: isBasement ? name : r.roomType } : r
      );
      onChange({ ...state, rooms: updatedRooms });
    };

    const handleRoomTypeChange = (roomType: string) => {
      const updatedRooms = state.rooms.map((r) =>
        r.id === room.id ? { ...r, roomType } : r
      );
      onChange({ ...state, rooms: updatedRooms });
    };

    const handleSlabThicknessChange = (slabThickness: number) => {
      const updatedRooms = state.rooms.map((r) =>
        r.id === room.id ? { ...r, slabThickness } : r
      );
      onChange({ ...state, rooms: updatedRooms });
    };

    const handleCeilingHeightChange = (ceilingHeight: number) => {
      const updatedRooms = state.rooms.map((r) =>
        r.id === room.id ? { ...r, ceilingHeight } : r
      );
      const updatedWalls = state.walls.map((w) =>
        room.wallIds.includes(w.id) ? { ...w, height: ceilingHeight } : w
      );
      onChange({ ...state, rooms: updatedRooms, walls: updatedWalls });
    };

    const handleCeilingDrywallToggle = (hasCeilingDrywall: boolean) => {
      const updatedRooms = state.rooms.map((r) =>
        r.id === room.id ? { ...r, hasCeilingDrywall } : r
      );
      onChange({ ...state, rooms: updatedRooms });
    };

    const handleFinishChange = (floorFinish: FloorFinish) => {
      const updatedRooms = state.rooms.map((r) =>
        r.id === room.id ? { ...r, floorFinish } : r
      );
      onChange({ ...state, rooms: updatedRooms });
    };

    const handleFoundationWallUpdate = (key: string, value: number) => {
      const updatedWalls = state.walls.map((w) => {
        if (room.wallIds.includes(w.id) && w.wallType === 'foundation_wall') {
          if (key === 'thickness') return { ...w, thickness: value / 12 };
          return {
            ...w,
            foundationDetails: {
              ...w.foundationDetails,
              [key]: value,
            },
          };
        }
        return w;
      });
      onChange({ ...state, walls: updatedWalls });
    };

    const roomPresets = [
      'Primary Bedroom',
      'Bedroom 2',
      'Bedroom 3',
      'Guest Bedroom',
      'Bathroom (Full)',
      'Primary Ensuite',
      'Powder Room (Half Bath)',
      'Kitchen',
      'Living Room',
      'Dining Room',
      'Great Room',
      'Home Office',
      'Laundry / Utility',
      'Mudroom / Entry',
      'Walk-In Closet',
      'Mechanical Room',
      'Garage (Attached)',
      'Basement / Foundation Space',
      'Deck',
      'Patio / Hardscape',
      'Covered Patio / Porch',
    ];

    // Get current values from first foundation wall found
    const firstFdnWall = state.walls.find(w => room.wallIds.includes(w.id) && w.wallType === 'foundation_wall');
    const fdnWallThickness = firstFdnWall ? Math.round((firstFdnWall.thickness || 0.833) * 12) : 10;
    const fdnWallHeight = firstFdnWall?.foundationDetails?.wallHeight ?? 8;
    const fdnFootingWidth = firstFdnWall?.foundationDetails?.footingWidth ?? 16;
    const fdnFootingThickness = firstFdnWall?.foundationDetails?.footingThickness ?? 8;

    return (
      <div className="absolute top-16 right-88 w-72 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl p-4 text-slate-200 z-20 text-xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-sky-400">
            <Box className="w-4 h-4" />
            <span>Room Face Properties</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Room Type / Usage Preset
            </label>
            <select
              value={roomPresets.includes(room.name) ? room.name : '__custom__'}
              onChange={(e) => {
                if (e.target.value !== '__custom__') {
                  handleRoomNameChange(e.target.value);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 mb-1.5"
            >
              <option value="__custom__">Custom Name / Manual Entry...</option>
              {roomPresets.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Custom room label..."
              value={room.name}
              onChange={(e) => handleRoomNameChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Floor Finish Package
            </label>
            <select
              value={room.floorFinish}
              onChange={(e) => handleFinishChange(e.target.value as FloorFinish)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="hardwood">Hardwood Plank Flooring</option>
              <option value="luxury_vinyl_plank">Luxury Vinyl Plank (LVP)</option>
              <option value="porcelain_tile">Porcelain / Ceramic Tile</option>
              <option value="carpet">Plush Carpet & Underpad</option>
              <option value="polished_concrete">Polished Concrete</option>
              <option value="osb_subfloor_only">OSB Subfloor Only (Unfinished)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-2 rounded-xl border border-slate-800">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">Net Floor Area</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">{netArea.toFixed(1)} SF</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">Ceiling Height</div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.5"
                  min="6"
                  max="24"
                  value={room.ceilingHeight || 8}
                  onChange={(e) => handleCeilingHeightChange(parseFloat(e.target.value) || 8)}
                  className="w-full bg-transparent text-sm font-bold text-sky-400 font-mono focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 font-bold">FT</span>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs">
            <input
              type="checkbox"
              checked={room.hasCeilingDrywall ?? true}
              onChange={(e) => handleCeilingDrywallToggle(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-sky-500"
            />
            <span>Include Ceiling Drywall & Paint</span>
          </label>

          {isFoundationRoom && (
            <div className="p-3 bg-sky-950/30 border border-sky-500/30 rounded-xl space-y-3">
              <div className="text-[10px] uppercase font-bold text-sky-400">Foundation & Slab Settings</div>
              
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Slab Thickness</label>
                <div className="flex items-center gap-1">
                  {[4, 5, 6].map((v) => (
                    <button
                      key={v}
                      onClick={() => handleSlabThicknessChange(v)}
                      className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors ${
                        (room.slabThickness || state.settings.slabThicknessInches || 4) === v
                          ? 'bg-sky-600/30 border-sky-500 text-sky-300'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {v}"
                    </button>
                  ))}
                  <input
                    type="number"
                    value={room.slabThickness || state.settings.slabThicknessInches || 4}
                    onChange={(e) => handleSlabThicknessChange(parseFloat(e.target.value) || 4)}
                    className="w-12 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px] text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Wall Thick (in)</label>
                  <select
                    value={fdnWallThickness}
                    onChange={(e) => handleFoundationWallUpdate('thickness', parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200"
                  >
                    <option value={8}>8"</option>
                    <option value={10}>10"</option>
                    <option value={12}>12"</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Wall Height (ft)</label>
                  <input
                    type="number"
                    value={fdnWallHeight}
                    onChange={(e) => handleFoundationWallUpdate('wallHeight', parseFloat(e.target.value) || 8)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Footing Width (in)</label>
                  <input
                    type="number"
                    value={fdnFootingWidth}
                    onChange={(e) => handleFoundationWallUpdate('footingWidth', parseFloat(e.target.value) || 16)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Footing Thick (in)</label>
                  <input
                    type="number"
                    value={fdnFootingThickness}
                    onChange={(e) => handleFoundationWallUpdate('footingThickness', parseFloat(e.target.value) || 8)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 flex justify-end">
            <button
              onClick={onDelete}
              className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. APERTURE INSPECTOR
  if (selection.type === 'aperture') {
    const ap = state.apertures.find((a) => a.id === selection.id);
    if (!ap) return null;

    const hostWall = state.walls.find((w) => w.id === ap.wallId);
    const hostGeom = hostWall ? getWallGeometry(hostWall, nodeMap) : null;
    const wallLength = hostGeom ? hostGeom.length : 10;
    const maxOffset = Math.max(0, wallLength - ap.width);

    const handleWidthChange = (width: number) => {
      const updated = state.apertures.map((a) =>
        a.id === ap.id ? { ...a, width: Math.max(1.0, width) } : a
      );
      onChange({ ...state, apertures: updated });
    };

    const handleHeightChange = (height: number) => {
      const updated = state.apertures.map((a) =>
        a.id === ap.id ? { ...a, height: Math.max(1.0, height) } : a
      );
      onChange({ ...state, apertures: updated });
    };

    const handleOffsetChange = (offset: number) => {
      const clampedOffset = Math.max(0, Math.min(maxOffset, offset));
      const updated = state.apertures.map((a) =>
        a.id === ap.id ? { ...a, offset: Math.round(clampedOffset * 100) / 100 } : a
      );
      onChange({ ...state, apertures: updated });
    };

    const handleTypeChange = (type: ApertureType) => {
      const updated = state.apertures.map((a) =>
        a.id === ap.id ? { ...a, type } : a
      );
      onChange({ ...state, apertures: updated });
    };

    const distFromStart = ap.offset;
    const distFromEnd = Math.max(0, wallLength - (ap.offset + ap.width));

    return (
      <div className="absolute top-16 right-88 w-76 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl p-4 text-slate-200 z-20 text-xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-sky-400">
            <Layers className="w-4 h-4" />
            <span>Aperture Properties</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Fenestration Type
            </label>
            <select
              value={ap.type}
              onChange={(e) => handleTypeChange(e.target.value as ApertureType)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="door_passage">Passage Interior Door</option>
              <option value="door_pocket">Pocket Door (In-Wall)</option>
              <option value="door_bifold_single">Bifold Closet Door (Single)</option>
              <option value="door_bifold_double">Bifold Closet Door (Double)</option>
              <option value="cased_opening">Cased Wall Opening</option>
              <option value="door_exterior">Exterior Entry Door</option>
              <option value="door_garage">Overhead Garage Bay</option>
              <option value="door_sliding_patio">Sliding Patio Door</option>
              <option value="window_standard">Standard Casement / Double Hung Window</option>
              <option value="window_slider">Slider Window</option>
              <option value="window_picture">Fixed Picture Window</option>
            </select>
          </div>

          {/* Wall Position & Offset Callout */}
          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Wall Offset Position
              </span>
              <span className="text-[11px] font-mono text-sky-400 font-bold">
                {ap.offset.toFixed(2)} ft
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={maxOffset}
              step="0.25"
              value={ap.offset}
              onChange={(e) => handleOffsetChange(parseFloat(e.target.value) || 0)}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>⟵ Start: {distFromStart.toFixed(2)}'</span>
              <span>End: {distFromEnd.toFixed(2)}' ⟶</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Width (ft)
              </label>
              <input
                type="number"
                step="0.25"
                min="1"
                value={ap.width}
                onChange={(e) => handleWidthChange(parseFloat(e.target.value) || 3)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Height (ft)
              </label>
              <input
                type="number"
                step="0.25"
                min="1"
                value={ap.height}
                onChange={(e) => handleHeightChange(parseFloat(e.target.value) || 6.67)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono focus:border-sky-500"
              />
            </div>
          </div>

          {/* Swing, Hinge & Inversion Actions */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 block">
              Orientation & Swing Dynamics
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const updated = state.apertures.map((a) =>
                    a.id === ap.id
                      ? {
                          ...a,
                          swingSide:
                            a.swingSide === 'inward'
                              ? ('outward' as const)
                              : ('inward' as const),
                        }
                      : a
                  );
                  onChange({ ...state, apertures: updated });
                }}
                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title="Flip door/window swing direction"
              >
                <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                Flip Swing ({ap.swingSide || 'inward'})
              </button>

              <button
                onClick={() => {
                  const updated = state.apertures.map((a) =>
                    a.id === ap.id
                      ? {
                          ...a,
                          hingeSide:
                            a.hingeSide === 'right'
                              ? ('left' as const)
                              : ('right' as const),
                        }
                      : a
                  );
                  onChange({ ...state, apertures: updated });
                }}
                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title="Flip hinge side"
              >
                <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                Hinge: {ap.hingeSide === 'right' ? 'Right' : 'Left'}
              </button>

              {ap.type === 'door_pocket' && (
                <button
                  onClick={() => {
                    const updated = state.apertures.map((a) =>
                      a.id === ap.id
                        ? {
                            ...a,
                            pocketDirection:
                              a.pocketDirection === 'right'
                                ? ('left' as const)
                                : ('right' as const),
                          }
                        : a
                    );
                    onChange({ ...state, apertures: updated });
                  }}
                  className="col-span-2 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Flip pocket sliding direction"
                >
                  <RotateCw className="w-3.5 h-3.5 text-purple-400" />
                  Flip Pocket ({ap.pocketDirection || 'left'})
                </button>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-end">
            <button
              onClick={onDelete}
              className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete Aperture
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. STAMP INSPECTOR
  if (selection.type === 'stamp') {
    const stamp = state.stamps.find((s) => s.id === selection.id);
    if (!stamp) return null;

    const handleRotate = () => {
      const currentRot = stamp.rotation || 0;
      const nextRot = (currentRot + 90) % 360;
      const updated = state.stamps.map((s) =>
        s.id === stamp.id ? { ...s, rotation: nextRot } : s
      );
      onChange({ ...state, stamps: updated });
    };

    return (
      <div className="absolute top-16 right-88 w-72 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl p-4 text-slate-200 z-20 text-xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-sky-400">
            <Settings2 className="w-4 h-4" />
            <span>Stamp Properties</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Stamp Element</div>
            <div className="text-sm font-semibold text-slate-200 capitalize">
              {stamp.type.replace(/_/g, ' ')}
            </div>
          </div>

          {/* Rotation Control */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Orientation & Rotation
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRotate}
                className="flex-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>+90° Rotate</span>
              </button>
              <div className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-mono font-bold">
                {stamp.rotation || 0}°
              </div>
            </div>
          </div>

          {(stamp.type === 'beam_segment' || stamp.type === 'utility_trench') && (
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Linear Length (LF)
              </label>
              <input
                type="number"
                step="1"
                value={stamp.length || 12}
                onChange={(e) => {
                  const updated = state.stamps.map((s) =>
                    s.id === stamp.id ? { ...s, length: parseFloat(e.target.value) || 12 } : s
                  );
                  onChange({ ...state, stamps: updated });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono focus:border-sky-500"
              />
            </div>
          )}

          {stamp.type === 'stair_run' && (
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Stair Risers Count
              </label>
              <input
                type="number"
                step="1"
                value={stamp.stairRisers || 14}
                onChange={(e) => {
                  const updated = state.stamps.map((s) =>
                    s.id === stamp.id ? { ...s, stairRisers: parseInt(e.target.value, 10) || 14 } : s
                  );
                  onChange({ ...state, stamps: updated });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono focus:border-sky-500"
              />
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 flex justify-end">
            <button
              onClick={onDelete}
              className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete Stamp
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. DECK INSPECTOR
  if (selection.type === 'deck') {
    const deck = state.decks.find((d) => d.id === selection.id);
    if (!deck) return null;

    const handleDeckNameChange = (name: string) => {
      const updated = state.decks.map((d) => (d.id === deck.id ? { ...d, name } : d));
      onChange({ ...state, decks: updated });
    };

    return (
      <div className="absolute top-16 right-88 w-72 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl p-4 text-slate-200 z-20 text-xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-amber-400">
            <Box className="w-4 h-4" />
            <span>Timber Deck Properties</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Deck Label / Name
            </label>
            <input
              type="text"
              value={deck.name}
              onChange={(e) => handleDeckNameChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-2 rounded-xl border border-slate-800">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">Decking Area</div>
              <div className="text-sm font-bold text-amber-400 font-mono">{deck.area} SF</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">Guardrail Perim</div>
              <div className="text-sm font-bold text-sky-400 font-mono">{deck.perimeter} LF</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            💡 Drag deck in canvas to reposition. Material calculations update live in MTO Matrix (Category 7).
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-end">
            <button
              onClick={onDelete}
              className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 rounded text-xs flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Delete Deck
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 6. HARDSCAPE INSPECTOR
  if (selection.type === 'hardscape') {
    const hardscape = state.hardscapes.find((h) => h.id === selection.id);
    if (!hardscape) return null;

    const handleHardscapeNameChange = (name: string) => {
      const updated = state.hardscapes.map((h) => (h.id === hardscape.id ? { ...h, name } : h));
      onChange({ ...state, hardscapes: updated });
    };

    return (
      <div className="absolute top-16 right-88 w-72 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl p-4 text-slate-200 z-20 text-xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-teal-400">
            <Box className="w-4 h-4" />
            <span>Site Hardscape Properties</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Hardscape / Patio Name
            </label>
            <input
              type="text"
              value={hardscape.name}
              onChange={(e) => handleHardscapeNameChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-medium">Paver / Concrete Area</div>
            <div className="text-sm font-bold text-teal-400 font-mono">{hardscape.area} SF</div>
          </div>

          <div className="text-[11px] text-slate-400">
            💡 Drag hardscape on canvas to reposition.
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-end">
            <button
              onClick={onDelete}
              className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 rounded text-xs flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Delete Hardscape
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 7. ANNOTATION INSPECTOR
  if (selection.type === 'annotation') {
    const annotation = (state.annotations || []).find((a) => a.id === selection.id);
    if (!annotation) return null;

    const handleTextChange = (text: string) => {
      const updated = (state.annotations || []).map((a) =>
        a.id === annotation.id ? { ...a, text } : a
      );
      onChange({ ...state, annotations: updated });
    };

    const handleFontSizeChange = (fontSize: number) => {
      const updated = (state.annotations || []).map((a) =>
        a.id === annotation.id ? { ...a, fontSize } : a
      );
      onChange({ ...state, annotations: updated });
    };

    const handleColorChange = (color: string) => {
      const updated = (state.annotations || []).map((a) =>
        a.id === annotation.id ? { ...a, color } : a
      );
      onChange({ ...state, annotations: updated });
    };

    const handleRotate = () => {
      const currentRot = annotation.rotation || 0;
      const nextRot = (currentRot + 90) % 360;
      const updated = (state.annotations || []).map((a) =>
        a.id === annotation.id ? { ...a, rotation: nextRot } : a
      );
      onChange({ ...state, annotations: updated });
    };

    const colorOptions = [
      { label: 'Cyan / Sky', val: '#38bdf8' },
      { label: 'Violet', val: '#a78bfa' },
      { label: 'Amber', val: '#fbbf24' },
      { label: 'Emerald', val: '#34d399' },
      { label: 'White', val: '#f8fafc' },
      { label: 'Rose', val: '#fb7185' },
    ];

    return (
      <div className="absolute top-16 right-88 w-72 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl p-4 text-slate-200 z-20 text-xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-violet-400">
            <Type className="w-4 h-4" />
            <span>Text Annotation Properties</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Note Text
            </label>
            <textarea
              rows={3}
              value={annotation.text}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-sans resize-none"
              placeholder="Enter note or title..."
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Font Size
              </label>
              <select
                value={annotation.fontSize || 14}
                onChange={(e) => handleFontSizeChange(parseInt(e.target.value, 10) || 14)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
              >
                <option value={11}>11px - Small Spec</option>
                <option value={14}>14px - Standard Note</option>
                <option value={18}>18px - Section Subhead</option>
                <option value={24}>24px - Room/Zone Title</option>
                <option value={32}>32px - Plan Title</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Orientation
              </label>
              <button
                onClick={handleRotate}
                className="w-full px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-violet-300 font-semibold rounded-lg flex items-center justify-center gap-1 border border-slate-700 cursor-pointer"
              >
                <RotateCw className="w-3 h-3" />
                <span>{annotation.rotation || 0}°</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Text Accent Color
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {colorOptions.map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => handleColorChange(opt.val)}
                  title={opt.label}
                  className={`w-6 h-6 rounded-full border flex items-center justify-center transition-transform ${
                    (annotation.color || '#38bdf8') === opt.val
                      ? 'border-white scale-110 shadow-sm'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: opt.val }}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-end">
            <button
              onClick={onDelete}
              className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 rounded text-xs flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Delete Text
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 8. UNDERLAY INSPECTOR
  if (selection.type === 'underlay') {
    const underlay = state.underlay;
    if (!underlay) return null;

    const handleOpacityChange = (opacity: number) => {
      onChange({
        ...state,
        underlay: { ...underlay, opacity }
      });
    };

    const handleLockedChange = (isLocked: boolean) => {
      onChange({
        ...state,
        underlay: { ...underlay, isLocked }
      });
    };

    const handleVisibleChange = (isVisible: boolean) => {
      onChange({
        ...state,
        underlay: { ...underlay, isVisible }
      });
    };

    return (
      <div className="absolute top-16 right-88 w-72 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl p-4 text-slate-200 z-20 text-xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-sky-400">
            <Layers className="w-4 h-4" />
            <span>Blueprint Underlay Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Opacity
              </label>
              <span className="text-xs font-mono font-bold text-sky-400">
                {Math.round(underlay.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={underlay.opacity}
              onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs font-semibold">
              <input
                type="checkbox"
                checked={underlay.isLocked}
                onChange={(e) => handleLockedChange(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-sky-500"
              />
              Lock Position
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs font-semibold">
              <input
                type="checkbox"
                checked={underlay.isVisible}
                onChange={(e) => handleVisibleChange(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-sky-500"
              />
              Visible
            </label>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-2">
            <button
              onClick={() => {
                if (onToolChange) onToolChange('calibrate_scale');
                onClose();
              }}
              className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              Re-Calibrate Scale
            </button>
            
            <button
              onClick={() => {
                onChange({ ...state, underlay: undefined });
                onClose();
              }}
              className="w-full px-3 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 font-bold rounded-lg flex items-center justify-center gap-2 border border-red-900/30 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Remove Image
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
