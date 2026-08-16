import React, { useState, useRef } from 'react';
import {
  ProjectSettings,
  CalculationMode,
  CategoryInclusions,
  DEFAULT_CATEGORY_INCLUSIONS,
  CompanyBranding,
} from '../types';
import { savePersistedBranding } from '../utils/storage';
import {
  Settings,
  X,
  Sliders,
  Calculator,
  Layers,
  Ruler,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  Sparkles,
  Hammer,
  ShieldCheck,
  Building2,
  Upload,
  Image as ImageIcon,
  Trash2,
  MapPin,
  Phone,
  User,
  Hash,
} from 'lucide-react';

interface GlobalProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  onUpdateSettings: (newSettings: ProjectSettings, cascadeWallHeight?: boolean) => void;
  totalWallsCount: number;
}

export const GlobalProjectSettingsModal: React.FC<GlobalProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  totalWallsCount,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'engine' | 'financial' | 'inclusions' | 'branding'>('general');
  const [formSettings, setFormSettings] = useState<ProjectSettings>({ ...settings });
  const [cascadeToAllWalls, setCascadeToAllWalls] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleModeSelect = (mode: CalculationMode) => {
    setFormSettings((prev) => ({
      ...prev,
      calculationMode: mode,
    }));
  };

  const handleInclusionToggle = (key: keyof CategoryInclusions) => {
    setFormSettings((prev) => {
      const currentInc = prev.categoryInclusions || DEFAULT_CATEGORY_INCLUSIONS;
      return {
        ...prev,
        categoryInclusions: {
          ...currentInc,
          [key]: !currentInc[key],
        },
      };
    });
  };

  const handleToggleAllInclusions = (include: boolean) => {
    setFormSettings((prev) => ({
      ...prev,
      categoryInclusions: {
        finishes: include,
        carpentryFraming: include,
        fenestration: include,
        electricalSafety: include,
        plumbingCivil: include,
        concreteFoundations: include,
        roofingEnvelope: include,
      },
    }));
  };

  const handleBrandingChange = (key: keyof CompanyBranding, value: string) => {
    setFormSettings((prev) => ({
      ...prev,
      companyBranding: {
        ...prev.companyBranding,
        [key]: value,
      },
    }));
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        handleBrandingChange('logoUrl', result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (formSettings.companyBranding) {
      savePersistedBranding(formSettings.companyBranding);
    }
    onUpdateSettings(formSettings, cascadeToAllWalls);
    onClose();
  };

  const currentInclusions = formSettings.categoryInclusions || DEFAULT_CATEGORY_INCLUSIONS;

  const inclusionCategories: Array<{
    key: keyof CategoryInclusions;
    title: string;
    description: string;
    icon: string;
  }> = [
    {
      key: 'finishes',
      title: 'Architectural Finishes',
      description: 'Drywall boards, interior paint coats, finish flooring, batt insulation.',
      icon: '🎨',
    },
    {
      key: 'carpentryFraming',
      title: 'Carpentry & Structural Framing',
      description: 'Wall studs, OSB subfloor, primary structural beams, support columns, millwork casing, stair risers.',
      icon: '🪵',
    },
    {
      key: 'fenestration',
      title: 'Fenestration & Enclosure Apertures',
      description: 'Passage doors, pocket doors, exterior entries, overhead garage bays, standard windows, hardware.',
      icon: '🚪',
    },
    {
      key: 'electricalSafety',
      title: 'Electrical, Lighting & Life Safety',
      description: 'Switches, dimmers, standard/GFCI/240V/EV receptacles, LED potlights, sconces, exhaust & ceiling fans, smoke alarms.',
      icon: '⚡',
    },
    {
      key: 'plumbingCivil',
      title: 'Plumbing & Civil Infrastructure',
      description: 'Toilets, sinks, showers, bathtubs, water heaters, hose bibs, exterior utility trenching.',
      icon: '🚰',
    },
    {
      key: 'concreteFoundations',
      title: 'Concrete Foundations & Substructure',
      description: 'Cast-in-place slabs, thickened perimeter grade beams, helical screw piers, underslab insulation.',
      icon: '🧱',
    },
    {
      key: 'roofingEnvelope',
      title: 'Roofing, Facades & Outer Site Envelope',
      description: 'Sloped roofing shingles, lap siding, stone/brick veneers, soffits, fascia, eavestroughs, timber decks, hardscapes.',
      icon: '🏠',
    },
  ];

  return (
    <div
      id="global-project-settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        id="global-project-settings-modal-dialog"
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div
          id="global-settings-header"
          className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Global Project & Engine Settings
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/25">
                  PlanarMTO v5
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Central configuration for geometric takeoffs, estimation algorithms, and CAD drafting constraints.
              </p>
            </div>
          </div>
          <button
            id="close-global-settings-button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          id="global-settings-tabs"
          className="flex border-b border-slate-800 bg-slate-950/50 px-6 gap-2 pt-2"
        >
          <button
            id="tab-btn-general"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'general'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Ruler className="w-4 h-4" />
            Geometry & Dimensions
          </button>

          <button
            id="tab-btn-engine"
            onClick={() => setActiveTab('engine')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'engine'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Calculator className="w-4 h-4" />
            Calculation Engine Mode
          </button>

          <button
            id="tab-btn-inclusions"
            onClick={() => setActiveTab('inclusions')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'inclusions'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            Estimate Inclusions
          </button>

          <button
            id="tab-btn-financial"
            onClick={() => setActiveTab('financial')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'financial'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Waste & Markups
          </button>

          <button
            id="tab-btn-branding"
            onClick={() => setActiveTab('branding')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'branding'
                ? 'border-sky-500 text-sky-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Company Branding & Logo
          </button>
        </div>

        {/* Modal Body */}
        <div id="global-settings-body" className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* TAB 1: GENERAL & DIMENSIONS */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Master Wall Height */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-sky-400" />
                      Global Default Wall Height (ft)
                    </label>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sets the baseline vertical elevation for walls, ceiling framing, and wall area takeoffs.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="input-global-wall-height"
                      type="number"
                      step="0.5"
                      min="6"
                      max="30"
                      value={formSettings.defaultWallHeight}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          defaultWallHeight: Math.max(6, Math.min(30, parseFloat(e.target.value) || 8)),
                        })
                      }
                      className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-right font-mono font-bold text-sky-400 focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-xs text-slate-400 font-mono">FT</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between">
                  <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer">
                    <input
                      id="checkbox-cascade-wall-height"
                      type="checkbox"
                      checked={cascadeToAllWalls}
                      onChange={(e) => setCascadeToAllWalls(e.target.checked)}
                      className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 bg-slate-900"
                    />
                    Cascade new height to all {totalWallsCount} existing walls in plan
                  </label>
                  <span className="text-[11px] text-slate-400 italic">
                    {cascadeToAllWalls ? 'All walls will synchronize' : 'Only new walls affected'}
                  </span>
                </div>
              </div>

              {/* Framing & Envelope Geometry Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Default Wall Thickness */}
                <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Default Wall Thickness
                  </label>
                  <select
                    id="select-wall-thickness"
                    value={formSettings.defaultWallThickness}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        defaultWallThickness: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value={0.375}>2x4 Interior Partition (4.5 in / 0.375 ft)</option>
                    <option value={0.537}>2x6 Exterior Framing (6.5 in / 0.537 ft)</option>
                    <option value={0.687}>2x8 Heavy Envelope (8.25 in / 0.687 ft)</option>
                    <option value={0.833}>10 in Concrete/CMU (10.0 in / 0.833 ft)</option>
                  </select>
                </div>

                {/* Stud Spacing */}
                <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Framing Stud Spacing (O.C.)
                  </label>
                  <select
                    id="select-stud-spacing"
                    value={formSettings.studSpacingInches}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        studSpacingInches: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value={12}>12 in On-Center (Heavy / Commercial)</option>
                    <option value={16}>16 in On-Center (Standard Code Residential)</option>
                    <option value={24}>24 in On-Center (Advanced / Partition Framing)</option>
                  </select>
                </div>

                {/* Slab Thickness */}
                <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Foundation Slab Thickness
                  </label>
                  <select
                    id="select-slab-thickness"
                    value={formSettings.slabThicknessInches}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        slabThicknessInches: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value={4}>4 in Cast-in-place Slab (Standard)</option>
                    <option value={5}>5 in Engineered Reinforced Slab</option>
                    <option value={6}>6 in Heavy Commercial / Garage Slab</option>
                    <option value={8}>8 in Industrial Mat Foundation</option>
                  </select>
                </div>

                {/* Roof Pitch */}
                <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Roof Pitch Scale & Slope
                  </label>
                  <select
                    id="select-roof-pitch"
                    value={formSettings.roofPitchScale}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        roofPitchScale: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value={3}>3/12 Low Slope (Multiplier: 1.03x)</option>
                    <option value={4}>4/12 Standard Pitch (Multiplier: 1.05x)</option>
                    <option value={6}>6/12 Medium Architectural (Multiplier: 1.12x)</option>
                    <option value={8}>8/12 Steep Gable Pitch (Multiplier: 1.20x)</option>
                    <option value={12}>12/12 45-degree High Pitch (Multiplier: 1.41x)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CALCULATION ENGINE MODE */}
          {activeTab === 'engine' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-300 leading-relaxed bg-sky-950/30 border border-sky-800/40 p-3.5 rounded-xl">
                <span className="font-semibold text-sky-400 flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-4 h-4" /> Dual Cost & Geometric Engine Modes
                </span>
                Switch how the MTO algorithms interpret wall faces and exterior building envelopes.
              </div>

              {/* Mode 1: Interior Finish Mode */}
              <div
                id="mode-card-interior-finish"
                onClick={() => handleModeSelect('interior_finish')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  formSettings.calculationMode === 'interior_finish'
                    ? 'bg-sky-950/40 border-sky-500 shadow-md ring-1 ring-sky-500'
                    : 'bg-slate-800/30 border-slate-700/60 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mt-0.5 ${
                        formSettings.calculationMode === 'interior_finish'
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : 'border border-slate-600 text-slate-400'
                      }`}
                    >
                      ✓
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        Interior Finish Mode
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono font-semibold border border-emerald-500/30">
                          Drywall & Trade Focus
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Measures strictly face-to-face interior room dimensions. Ideal for drywall contractors, paint crews, flooring installers, and interior fit-out estimators.
                      </p>
                      <ul className="text-[11px] text-slate-400 mt-2 space-y-1 list-disc list-inside">
                        <li>Subfloor decking equals net interior room floor area</li>
                        <li>Wall net drywall calculated strictly from inner face geometry</li>
                        <li>Foundation volume ignores exterior thickened perimeter offsets</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mode 2: Exterior Framing Mode */}
              <div
                id="mode-card-exterior-framing"
                onClick={() => handleModeSelect('exterior_framing')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  formSettings.calculationMode === 'exterior_framing'
                    ? 'bg-sky-950/40 border-sky-500 shadow-md ring-1 ring-sky-500'
                    : 'bg-slate-800/30 border-slate-700/60 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mt-0.5 ${
                        formSettings.calculationMode === 'exterior_framing'
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : 'border border-slate-600 text-slate-400'
                      }`}
                    >
                      ✓
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        Exterior Framing Mode
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 font-mono font-semibold border border-sky-500/30">
                          General Contractor & Envelope
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Accounts for structural framing offsets, rim joist extensions, exterior wall thickness wraps, and outer foundation footing pads.
                      </p>
                      <ul className="text-[11px] text-slate-400 mt-2 space-y-1 list-disc list-inside">
                        <li>Subfloor decking extends to outer rim boards (+framing offset)</li>
                        <li>Exterior siding & insulation envelopes outer corner depths</li>
                        <li>Foundation concrete includes perimeter footing frost-wall mass</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ESTIMATE INCLUSIONS */}
          {activeTab === 'inclusions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 p-3 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Category Inclusion Switches</h4>
                  <p className="text-[11px] text-slate-400">
                    Excluded categories keep geometric takeoffs intact but zero out their financial budget contributions.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="btn-include-all-categories"
                    onClick={() => handleToggleAllInclusions(true)}
                    className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition-colors"
                  >
                    Include All
                  </button>
                  <button
                    id="btn-exclude-all-categories"
                    onClick={() => handleToggleAllInclusions(false)}
                    className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-colors"
                  >
                    Exclude All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {inclusionCategories.map((cat) => {
                  const isIncluded = currentInclusions[cat.key];
                  return (
                    <div
                      key={cat.key}
                      id={`category-toggle-card-${cat.key}`}
                      onClick={() => handleInclusionToggle(cat.key)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isIncluded
                          ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                          : 'bg-slate-900/60 border-slate-800 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{cat.icon}</span>
                        <div>
                          <h5
                            className={`text-xs font-bold ${
                              isIncluded ? 'text-slate-100' : 'text-slate-400 line-through'
                            }`}
                          >
                            {cat.title}
                          </h5>
                          <p className="text-[11px] text-slate-400 mt-0.5">{cat.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                            isIncluded
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}
                        >
                          {isIncluded ? 'INCLUDED' : 'ZEROED OUT'}
                        </span>
                        {isIncluded ? (
                          <ToggleRight className="w-6 h-6 text-sky-400" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-600" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: FINANCIAL MULTIPLIERS */}
          {activeTab === 'financial' && (
            <div className="space-y-6">
              <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
                <Sliders className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-300">
                    Waste Factors & Commercial Markups
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Adjust material waste factors and corporate financial multipliers. These percentages are applied to the base takeoff to generate the final contractor bid price.
                  </p>
                </div>
              </div>

              {/* Material & Labor Waste */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <Hammer className="w-4 h-4 text-sky-400" />
                  Jobsite Waste & Scrap
                </h4>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold text-slate-100 block">
                      Material & Labor Waste Factor (%)
                    </label>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Applied directly to base quantities to account for cutting, damage, and site waste.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="50"
                      value={formSettings.wasteFactorPercentage}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          wasteFactorPercentage: Math.max(0, Math.min(50, parseFloat(e.target.value) || 0)),
                        })
                      }
                      className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-right font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-xs text-slate-400 font-mono">%</span>
                  </div>
                </div>
              </div>

              {/* Commercial Markups */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-sky-400" />
                  Commercial Markups & Indirect Costs
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">Company Overhead (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          value={formSettings.overheadPercentage}
                          onChange={(e) => setFormSettings({...formSettings, overheadPercentage: parseFloat(e.target.value) || 0})}
                          className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-right font-mono text-sky-400"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">Company Profit (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          value={formSettings.profitPercentage}
                          onChange={(e) => setFormSettings({...formSettings, profitPercentage: parseFloat(e.target.value) || 0})}
                          className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-right font-mono text-sky-400"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">Project Contingency (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          value={formSettings.projectContingencyPercentage}
                          onChange={(e) => setFormSettings({...formSettings, projectContingencyPercentage: parseFloat(e.target.value) || 0})}
                          className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-right font-mono text-sky-400"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">Project Management (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          value={formSettings.projectManagementPercentage}
                          onChange={(e) => setFormSettings({...formSettings, projectManagementPercentage: parseFloat(e.target.value) || 0})}
                          className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-right font-mono text-sky-400"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: COMPANY BRANDING & LOGO */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div className="bg-sky-950/30 border border-sky-500/20 rounded-xl p-4 flex items-start gap-3">
                <Building2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-sky-300">
                    Architectural Firm & Contractor Branding
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Upload your company logo and customize firm credentials. Your branding will render in the top navigation bar and prominently atop all exported PDF, HTML, and CSV Architectural Take-Off & Specification reports.
                  </p>
                </div>
              </div>

              {/* Logo Upload Section */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-sky-400" />
                  Company Logo
                </h4>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Logo Preview Container */}
                  <div className="w-36 h-24 rounded-xl bg-slate-900 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-2 text-center overflow-hidden shrink-0 relative group">
                    {formSettings.companyBranding?.logoUrl ? (
                      <>
                        <img
                          src={formSettings.companyBranding.logoUrl}
                          alt="Firm Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => handleBrandingChange('logoUrl', '')}
                          className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center gap-1 text-xs font-semibold text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </button>
                      </>
                    ) : (
                      <div className="text-slate-500 flex flex-col items-center gap-1">
                        <ImageIcon className="w-6 h-6 text-slate-600" />
                        <span className="text-[10px]">No Logo Uploaded</span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Guidelines */}
                  <div className="space-y-2 flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml, image/webp"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {formSettings.companyBranding?.logoUrl ? 'Change Logo Image' : 'Upload Firm Logo'}
                      </button>
                      {formSettings.companyBranding?.logoUrl && (
                        <button
                          type="button"
                          onClick={() => handleBrandingChange('logoUrl', '')}
                          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Reset to Compass
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Supports PNG, JPG, SVG, or WebP. Optimal transparent horizontal badge (e.g. 400x120px).
                    </p>
                  </div>
                </div>
              </div>

              {/* Company & Estimator Credentials */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-400" />
                  Firm Credentials & Specification Details
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Company / Contractor Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Architectural & Construction Group"
                      value={formSettings.companyBranding?.companyName || ''}
                      onChange={(e) => handleBrandingChange('companyName', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Lead Estimator / Architect
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="e.g. Marcus Vance, Senior Estimator (PQS)"
                        value={formSettings.companyBranding?.estimatorName || ''}
                        onChange={(e) => handleBrandingChange('estimatorName', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Office / Mailing Address
                    </label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="e.g. 1040 Innovation Blvd, Suite 500, Seattle, WA"
                        value={formSettings.companyBranding?.address || ''}
                        onChange={(e) => handleBrandingChange('address', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Contact (Phone / Email / Web)
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="e.g. (555) 345-8900 | estimates@apexbld.com"
                        value={formSettings.companyBranding?.contact || ''}
                        onChange={(e) => handleBrandingChange('contact', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Project Job Reference / Specification Code
                    </label>
                    <div className="relative">
                      <Hash className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="e.g. PRJ-2026-MTO-084"
                        value={formSettings.companyBranding?.projectNumber || ''}
                        onChange={(e) => handleBrandingChange('projectNumber', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          id="global-settings-footer"
          className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/90"
        >
          <button
            id="reset-settings-button"
            onClick={() =>
              setFormSettings({
                ...settings,
                calculationMode: 'exterior_framing',
                categoryInclusions: { ...DEFAULT_CATEGORY_INCLUSIONS },
              })
            }
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>

          <div className="flex items-center gap-3">
            <button
              id="cancel-settings-button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-settings-button"
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Apply Settings & Recalculate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
