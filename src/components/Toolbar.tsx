import React, { useState } from 'react';
import { ActiveTool, WallPreset } from '../types';
import {
  MousePointer,
  PenTool,
  Square,
  Ruler,
  Type,
  DoorOpen,
  AppWindow,
  Columns,
  Disc,
  Spline,
  GitCommit,
  Zap,
  Lightbulb,
  Fan,
  ShieldAlert,
  Droplets,
  Flame,
  Layers,
  ChevronDown,
  ChevronRight,
  Shield,
  Home,
  Layout,
  Maximize2,
} from 'lucide-react';

interface ToolbarProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  activeWallPreset: WallPreset;
  onSelectWallPreset: (preset: WallPreset) => void;
}

interface ToolGroup {
  id: string;
  title: string;
  tools: Array<{
    id: ActiveTool;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }>;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  activeWallPreset,
  onSelectWallPreset,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    structural: false,
    electrical: false,
    plumbing: false,
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toolGroups: ToolGroup[] = [
    {
      id: 'drafting',
      title: 'DRAFTING & GEOMETRY',
      tools: [
        { id: 'select', label: 'Select & Move', icon: <MousePointer className="w-4 h-4" /> },
        { id: 'wall_pen', label: 'Wall Pen (Continuous)', icon: <PenTool className="w-4 h-4 text-sky-400" /> },
        { id: 'room_box', label: '4-Wall Room Box', icon: <Square className="w-4 h-4 text-sky-400" /> },
        { id: 'text_label', label: 'Text Label / Note', icon: <Type className="w-4 h-4 text-violet-400" /> },
        { id: 'ruler_measure', label: 'Measure Ruler', icon: <Ruler className="w-4 h-4 text-amber-400" /> },
        { id: 'calibrate_scale', label: 'Calibrate Underlay Scale', icon: <Maximize2 className="w-4 h-4 text-sky-400" /> },
      ],
    },
    {
      id: 'apertures',
      title: 'APERTURES & DOORS',
      tools: [
        { id: 'aperture_door', label: 'Passage Door (32")', icon: <DoorOpen className="w-4 h-4 text-emerald-400" /> },
        { id: 'aperture_exterior_door', label: 'Exterior Door (36")', icon: <DoorOpen className="w-4 h-4 text-emerald-400" /> },
        { id: 'aperture_pocket_door', label: 'Pocket Door', icon: <DoorOpen className="w-4 h-4 text-purple-400" /> },
        { id: 'aperture_garage', label: 'Garage Bay (9\')', icon: <Square className="w-4 h-4 text-amber-400" /> },
        { id: 'aperture_patio_slider', label: 'Patio Slider (6\')', icon: <DoorOpen className="w-4 h-4 text-teal-400" /> },
        { id: 'aperture_bifold_single', label: 'Bifold Single (30")', icon: <DoorOpen className="w-4 h-4 text-emerald-400" /> },
        { id: 'aperture_bifold_double', label: 'Bifold Double (60")', icon: <DoorOpen className="w-4 h-4 text-emerald-400" /> },
        { id: 'aperture_cased_opening', label: 'Cased Opening (36")', icon: <Square className="w-4 h-4 text-slate-400" /> },
        { id: 'aperture_window', label: 'Standard Window (4\')', icon: <AppWindow className="w-4 h-4 text-sky-400" /> },
      ],
    },
    {
      id: 'structural',
      title: 'CARPENTRY & STRUCTURAL',
      tools: [
        { id: 'stamp_column', label: 'Support Column (Post)', icon: <Columns className="w-4 h-4 text-slate-200" /> },
        { id: 'stamp_pier', label: 'Helical Pier / Pile', icon: <Disc className="w-4 h-4 text-amber-500" /> },
        { id: 'stamp_beam', label: 'Structural Beam', icon: <Spline className="w-4 h-4 text-rose-400" /> },
        { id: 'stamp_stair', label: 'Stair Run Flight', icon: <GitCommit className="w-4 h-4 text-indigo-400" /> },
      ],
    },
    {
      id: 'electrical',
      title: 'ELECTRICAL & LIGHTING',
      tools: [
        { id: 'stamp_switch', label: 'Standard Switch ($)', icon: <Zap className="w-4 h-4 text-yellow-400" /> },
        { id: 'stamp_dimmer', label: 'Dimmer Switch ($D)', icon: <Zap className="w-4 h-4 text-yellow-500" /> },
        { id: 'stamp_3way', label: '3-Way Switch ($3W)', icon: <Zap className="w-4 h-4 text-yellow-600" /> },
        { id: 'stamp_electrical_panel', label: 'Electrical Panel', icon: <Layout className="w-4 h-4 text-slate-400" /> },
        { id: 'stamp_sconce', label: 'Wall Sconce / Fixture', icon: <Lightbulb className="w-4 h-4 text-yellow-200" /> },
        { id: 'stamp_coach_light', label: 'Exterior Coach Light', icon: <Lightbulb className="w-4 h-4 text-yellow-400" /> },
        { id: 'stamp_soffit_light', label: 'Soffit / Eaves Light', icon: <Lightbulb className="w-4 h-4 text-yellow-600" /> },
        { id: 'stamp_outlet', label: '120V Std Outlet', icon: <Zap className="w-4 h-4 text-cyan-400" /> },
        { id: 'stamp_gfci', label: 'GFCI Wet Outlet', icon: <Zap className="w-4 h-4 text-blue-400" /> },
        { id: 'stamp_240v', label: '240V Heavy Outlet', icon: <Zap className="w-4 h-4 text-amber-400" /> },
        { id: 'stamp_ev', label: 'EV Fast Charger', icon: <Zap className="w-4 h-4 text-emerald-400" /> },
        { id: 'stamp_potlight', label: 'Potlight / Can Light', icon: <Lightbulb className="w-4 h-4 text-yellow-300" /> },
        { id: 'stamp_fan_ceiling', label: 'Ceiling Fan', icon: <Fan className="w-4 h-4 text-sky-400" /> },
        { id: 'stamp_fan_exhaust', label: 'Spot Exhaust Fan', icon: <Fan className="w-4 h-4 text-blue-400" /> },
        { id: 'stamp_rangehood', label: 'Range Hood Vent', icon: <Flame className="w-4 h-4 text-orange-400" /> },
        { id: 'alarm_smoke_co', label: 'Smoke / CO Alarm', icon: <ShieldAlert className="w-4 h-4 text-rose-500" /> },
      ],
    },
    {
      id: 'plumbing',
      title: 'PLUMBING & CIVIL',
      tools: [
        { id: 'stamp_plumbing_toilet', label: 'Water Closet (Toilet)', icon: <Droplets className="w-4 h-4 text-cyan-400" /> },
        { id: 'stamp_plumbing_sink', label: 'Lavatory / Kitchen Sink', icon: <Droplets className="w-4 h-4 text-cyan-400" /> },
        { id: 'stamp_plumbing_shower', label: 'Walk-In Shower', icon: <Droplets className="w-4 h-4 text-cyan-400" /> },
        { id: 'stamp_plumbing_tub', label: 'Soaker Bathtub', icon: <Droplets className="w-4 h-4 text-cyan-400" /> },
        { id: 'stamp_plumbing_water_heater', label: 'Water Heater / Boiler', icon: <Droplets className="w-4 h-4 text-cyan-500" /> },
        { id: 'stamp_utility_trench', label: 'Utility Trenching (LF)', icon: <Layers className="w-4 h-4 text-amber-400" /> },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-y-auto select-none shrink-0 scrollbar-thin scrollbar-thumb-slate-800">
      <div className="p-3 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          CAD Tool Palette
        </h2>
      </div>

      <div className="p-2 space-y-4">
        {toolGroups.map((group) => {
          const isCollapsed = collapsedGroups[group.id];
          return (
            <div key={group.id} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <span>{group.title}</span>
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                )}
              </button>

              {!isCollapsed && (
                <div className="grid grid-cols-1 gap-1">
                  {group.id === 'drafting' && (
                    <div className="px-2 pb-2 mb-2 border-b border-slate-800/50">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-tighter block mb-1.5">
                        Active Wall Preset
                      </label>
                      <div className="grid grid-cols-1 gap-1">
                        {[
                          { id: 'interior_2x4', label: 'Int Partition (2x4)', icon: <Layout className="w-3.5 h-3.5" /> },
                          { id: 'exterior_2x6', label: 'Ext Wall (2x6)', icon: <Home className="w-3.5 h-3.5" /> },
                          { id: 'foundation_10', label: 'Foundation (10")', icon: <Shield className="w-3.5 h-3.5" /> },
                        ].map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => onSelectWallPreset(preset.id as WallPreset)}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-all cursor-pointer ${
                              activeWallPreset === preset.id
                                ? 'bg-slate-700 text-sky-400 ring-1 ring-sky-500/50 shadow-inner'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <div className={activeWallPreset === preset.id ? 'text-sky-400' : 'text-slate-500'}>
                              {preset.icon}
                            </div>
                            <span className="truncate font-medium">{preset.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {group.tools.map((tool) => {
                    const isActive = activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => onSelectTool(tool.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                          isActive
                            ? 'bg-sky-600 text-white font-semibold shadow-md shadow-sky-900/30 ring-1 ring-sky-400'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <div className="shrink-0">{tool.icon}</div>
                        <span className="truncate">{tool.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
