import React, { useState, useEffect } from 'react';
import { UnitCostRates, CostRateItem } from '../types';
import { DEFAULT_UNIT_COST_RATES } from '../engine/estimator';
import {
  DollarSign,
  X,
  RotateCcw,
  Percent,
  Check,
  Hammer,
  Layers,
  DoorOpen,
  Zap,
  Droplets,
  Building2,
  Home,
  Save,
  HelpCircle,
} from 'lucide-react';

interface RateCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  rates: UnitCostRates;
  onSaveRates: (newRates: UnitCostRates) => void;
}

interface RateFieldConfig {
  key: keyof UnitCostRates;
  label: string;
  unit: string;
  category: string;
  description: string;
}

const RATE_FIELDS: RateFieldConfig[] = [
  // 1. Finishes
  { key: 'drywallPerSf', label: 'Drywall Board (Tape & Finish)', unit: '$/SF', category: 'Board & Finishes', description: 'Includes 1/2" or 5/8" drywall boards, mud, tape, and sanding' },
  { key: 'paintPerSf', label: 'Interior Paint (Primer + 2 Coats)', unit: '$/SF', category: 'Board & Finishes', description: 'Wall & ceiling latex paint coverage' },
  { key: 'flooringPerSf', label: 'Flooring Package (Average)', unit: '$/SF', category: 'Board & Finishes', description: 'Hardwood, LVP, or porcelain tile installation & materials' },
  { key: 'extInsulationPerSf', label: 'Exterior Wall Insulation (R-20+)', unit: '$/SF', category: 'Board & Finishes', description: 'Friction-fit mineral wool or fiberglass batts' },

  // 2. Carpentry & Framing
  { key: 'studFramingPerLf', label: 'Wall Stud Framing', unit: '$/LF', category: 'Framing & Carpentry', description: 'Plates, studs, and blocking framing assembly' },
  { key: 'osbSubfloorPerSf', label: 'OSB Subfloor Decking (3/4" T&G)', unit: '$/SF', category: 'Framing & Carpentry', description: 'Glued and ring-shank nailed subfloor panels' },
  { key: 'beamPerLf', label: 'Structural Beams (LVL / PSL)', unit: '$/LF', category: 'Framing & Carpentry', description: 'Engineered multi-ply beam materials & placement' },
  { key: 'postPerUnit', label: 'Support Columns / Posts', unit: '$/Post', category: 'Framing & Carpentry', description: '6x6 timber or steel telepost' },
  { key: 'baseboardPerLf', label: 'Baseboard Trims (4"-5")', unit: '$/LF', category: 'Framing & Carpentry', description: 'Finger-joint primed pine baseboard with miter cuts' },
  { key: 'casingPerLf', label: 'Aperture Casing / Moldings', unit: '$/LF', category: 'Framing & Carpentry', description: 'Door and window perimeter trim moldings' },
  { key: 'stairRiserPerUnit', label: 'Stair Flight Risers', unit: '$/Riser', category: 'Framing & Carpentry', description: 'Tread, riser, stringer, and glue assembly' },

  // 3. Fenestration
  { key: 'windowPerUnit', label: 'Standard Vinyl Window', unit: '$/Unit', category: 'Openings & Fenestration', description: 'Low-E Argon double-glazed casement/slider window' },
  { key: 'passageDoorPerUnit', label: 'Passage Interior Door (Pre-hung)', unit: '$/Unit', category: 'Openings & Fenestration', description: 'Hollow/solid core door, jamb, and hinges' },
  { key: 'pocketDoorPerUnit', label: 'In-Wall Pocket Door', unit: '$/Unit', category: 'Openings & Fenestration', description: 'Pocket frame cage, track, rollers, and slab' },
  { key: 'exteriorDoorPerUnit', label: 'Exterior Insulated Entry Door', unit: '$/Unit', category: 'Openings & Fenestration', description: 'Fiberglass or steel pre-hung entry system with threshold' },
  { key: 'garageDoorPerBay', label: 'Overhead Garage Bay Door', unit: '$/Bay', category: 'Openings & Fenestration', description: 'Insulated sectional door with tracks, torsion spring & motor' },
  { key: 'doorHardwarePerSet', label: 'Door Lockset & Handleset', unit: '$/Set', category: 'Openings & Fenestration', description: 'Lever handle, latch, strike plate, and privacy lock' },

  // 4. Electrical
  { key: 'switchPerUnit', label: 'Standard Light Switch (Decora)', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Box, romex wire, switch, and coverplate' },
  { key: 'outletPerUnit', label: '120V Standard Duplex Outlet', unit: '$/Unit', category: 'Electrical & Lighting', description: '15A/20A tamper-resistant outlet box and wiring' },
  { key: 'gfciPerUnit', label: 'GFCI Wet Location Outlet', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Bath/kitchen GFCI circuit breaker/receptacle' },
  { key: 'evChargerPerUnit', label: 'EV Level 2 Fast Charger', unit: '$/Unit', category: 'Electrical & Lighting', description: '50A breaker, 6/3 wire run, and Wallbox/NEMA 14-50 outlet' },
  { key: 'potlightPerUnit', label: 'Slim LED Potlight / Sconce', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Recessed canless LED with junction box' },
  { key: 'ceilingFanPerUnit', label: 'Ceiling Fan & Light Combo', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Heavy-duty ceiling box and fan assembly' },
  { key: 'exhaustFanPerUnit', label: 'Bathroom Exhaust Fan', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Quiet CFM fan and 4" ductwork to roof/wall cap' },
  { key: 'rangeHoodPerUnit', label: 'Kitchen Range Hood Vent', unit: '$/Unit', category: 'Electrical & Lighting', description: '6" rigid duct, damper, and hood unit' },
  { key: 'smokeAlarmPerUnit', label: 'Hardwired Smoke & CO Alarm', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Interconnected 120V with battery backup' },

  // 5. Plumbing & Civil
  { key: 'plumbingPerFixture', label: 'Plumbing Fixture Rough-in & Trim', unit: '$/Fixture', category: 'Plumbing & Mechanical', description: 'Toilet, vanity sink, shower valve, or tub waste & vent rough-in' },
  { key: 'utilityTrenchPerLf', label: 'Civil / Utility Trenching', unit: '$/LF', category: 'Plumbing & Mechanical', description: 'Excavation, sand bed, conduit, and backfill' },

  // 6. Concrete
  { key: 'concretePerCy', label: 'Poured Concrete Foundation / Slab', unit: '$/CY', category: 'Concrete & Foundations', description: '32 MPa pump mix, rebar grid, pour, and power trowel finish' },
  { key: 'pierPerUnit', label: 'Helical Pier / Concrete Pile', unit: '$/Pier', category: 'Concrete & Foundations', description: 'Engineered torque-driven screw pile or sonotube footing' },

  // 7. Roofing & Facades
  { key: 'roofingPerSq', label: 'Architectural Shingle Roofing', unit: '$/SQ (100 SF)', category: 'Roofing & Exterior Envelope', description: 'Underlayment, drip edge, ridge vent, and lifetime shingles' },
  { key: 'sidingPerSf', label: 'Exterior Lap Siding (Vinyl / Board)', unit: '$/SF', category: 'Roofing & Exterior Envelope', description: 'Housewrap, starter strip, J-channel, and siding' },
  { key: 'soffitPerLf', label: 'Vented Aluminum Soffit', unit: '$/LF', category: 'Roofing & Exterior Envelope', description: 'Perforated aluminum panels & J-trim under eaves' },
  { key: 'fasciaPerLf', label: 'Custom Aluminum Fascia Cover', unit: '$/LF', category: 'Roofing & Exterior Envelope', description: 'Formed aluminum coil over sub-fascia board' },
  { key: 'eavestroughPerLf', label: 'Seamless Aluminum Gutter', unit: '$/LF', category: 'Roofing & Exterior Envelope', description: '5" continuous gutter with downspouts & brackets' },
  { key: 'deckingPerSf', label: 'Pressure Treated / Cedar Decking', unit: '$/SF', category: 'Roofing & Exterior Envelope', description: 'Framing joists, fasteners, and deck planks' },
  { key: 'deckRailingPerLf', label: 'Deck Guardrail System', unit: '$/LF', category: 'Roofing & Exterior Envelope', description: 'Posts, balusters, and top rail' },
  { key: 'hardscapePerSf', label: 'Site Hardscape Pavers / Concrete', unit: '$/SF', category: 'Roofing & Exterior Envelope', description: 'Compacted base aggregate, bedding sand, and pavers' },
];

export const RateCustomizerModal: React.FC<RateCustomizerModalProps> = ({
  isOpen,
  onClose,
  rates,
  onSaveRates,
}) => {
  const [localRates, setLocalRates] = useState<UnitCostRates>(rates || DEFAULT_UNIT_COST_RATES);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [globalLaborMultiplier, setGlobalLaborMultiplier] = useState<string>('0');
  const [globalMaterialMultiplier, setGlobalMaterialMultiplier] = useState<string>('0');

  useEffect(() => {
    if (rates) {
      setLocalRates(rates);
    }
  }, [rates, isOpen]);

  if (!isOpen) return null;

  const categories = ['All Categories', ...Array.from(new Set(RATE_FIELDS.map((f) => f.category)))];

  const handleRateChange = (
    fieldKey: keyof UnitCostRates,
    type: 'material' | 'labor',
    value: number
  ) => {
    setLocalRates((prev) => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        [type]: Math.max(0, value),
      },
    }));
  };

  const handleResetToDefaults = () => {
    setLocalRates(JSON.parse(JSON.stringify(DEFAULT_UNIT_COST_RATES)));
  };

  const handleApplyMultipliers = () => {
    const matMul = 1 + (parseFloat(globalMaterialMultiplier) || 0) / 100;
    const labMul = 1 + (parseFloat(globalLaborMultiplier) || 0) / 100;

    const updated = { ...localRates };
    for (const field of RATE_FIELDS) {
      const current = updated[field.key] || DEFAULT_UNIT_COST_RATES[field.key];
      updated[field.key] = {
        material: Math.round(current.material * matMul * 100) / 100,
        labor: Math.round(current.labor * labMul * 100) / 100,
      };
    }
    setLocalRates(updated);
    setGlobalLaborMultiplier('0');
    setGlobalMaterialMultiplier('0');
  };

  const handleSave = () => {
    onSaveRates(localRates);
    onClose();
  };

  const filteredFields =
    selectedCategory === 'All Categories'
      ? RATE_FIELDS
      : RATE_FIELDS.filter((f) => f.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
                Contractor Cost Model & Unit Rate Customizer
              </h2>
              <p className="text-xs text-slate-400">
                Configure Material & Labor unit costs ($) separately to calculate accurate take-offs and margins.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToDefaults}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
              title="Reset all rates to standard national averages"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Bulk Adjustments Bar */}
        <div className="bg-slate-950/60 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-sky-600 text-white font-bold shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Bulk Percentage Adjuster */}
          <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-sky-400" />
              Bulk Adjust:
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">Mat %</span>
              <input
                type="number"
                value={globalMaterialMultiplier}
                onChange={(e) => setGlobalMaterialMultiplier(e.target.value)}
                placeholder="0"
                className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-100 font-mono text-center"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">Lab %</span>
              <input
                type="number"
                value={globalLaborMultiplier}
                onChange={(e) => setGlobalLaborMultiplier(e.target.value)}
                placeholder="0"
                className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-100 font-mono text-center"
              />
            </div>
            <button
              onClick={handleApplyMultipliers}
              className="px-2 py-0.5 bg-sky-700 hover:bg-sky-600 text-white font-bold rounded text-[11px] cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>

        {/* Scrollable Rate Items Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="border border-slate-800 rounded-xl overflow-hidden shadow-lg bg-slate-950/40">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px] font-bold">
                  <th className="p-3">Item & Trade Specification</th>
                  <th className="p-3 w-28 text-center">Unit</th>
                  <th className="p-3 w-36 text-center text-emerald-400">Material Cost ($)</th>
                  <th className="p-3 w-36 text-center text-sky-400">Labor Cost ($)</th>
                  <th className="p-3 w-32 text-right text-amber-400 font-bold">Total Unit Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredFields.map((field) => {
                  const rateItem: CostRateItem =
                    localRates[field.key] || DEFAULT_UNIT_COST_RATES[field.key] || { material: 0, labor: 0 };
                  const total = (rateItem.material || 0) + (rateItem.labor || 0);

                  return (
                    <tr key={field.key} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-slate-200">{field.label}</div>
                        <div className="text-[11px] text-slate-500 font-normal">{field.description}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-800 rounded text-[11px] font-mono text-slate-300">
                          {field.unit}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 focus-within:border-emerald-500">
                          <span className="text-slate-500 mr-1">$</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            value={rateItem.material}
                            onChange={(e) =>
                              handleRateChange(
                                field.key,
                                'material',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-20 bg-transparent text-emerald-300 font-mono text-xs focus:outline-none text-right font-medium"
                          />
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 focus-within:border-sky-500">
                          <span className="text-slate-500 mr-1">$</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            value={rateItem.labor}
                            onChange={(e) =>
                              handleRateChange(
                                field.key,
                                'labor',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-20 bg-transparent text-sky-300 font-mono text-xs focus:outline-none text-right font-medium"
                          />
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm font-bold font-mono text-amber-300">
                          ${total.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span>Rates apply live to MTO Matrix subtotals, export spreadsheets, and printable take-offs.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save & Recalculate Project</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
