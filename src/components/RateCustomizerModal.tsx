import React, { useState, useEffect } from 'react';
import { UnitCostRates, CostRateItem } from '../types';
import { DEFAULT_UNIT_COST_RATES } from '../constants/rates';
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
  RefreshCw,
  Star,
  Download,
  Printer,
  Upload,
} from 'lucide-react';

import { getPersistedRateProfile, savePersistedRateProfile } from '../utils/storage';

interface RateCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  rates: UnitCostRates;
  onSaveRates: (newRates: UnitCostRates) => void;
  masterRates: UnitCostRates | null;
  onSaveMasterRates: (newMaster: UnitCostRates) => void;
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
  { key: 'drywall12PerSf', label: '1/2" Standard Drywall Board', unit: '$/SF', category: 'Board & Finishes', description: 'Standard interior wall & ceiling board (Tape & Finish)' },
  { key: 'drywall58PerSf', label: '5/8" Type X Fire-Rated Board', unit: '$/SF', category: 'Board & Finishes', description: 'Fire-rated assembly board (Tape & Finish)' },
  { key: 'drywallGreenboard12PerSf', label: '1/2" Moisture Board (Greenboard)', unit: '$/SF', category: 'Board & Finishes', description: 'Moisture resistant board for wet areas (Tape & Finish)' },
  { key: 'paintPerSf', label: 'Interior Paint (Primer + 2 Coats)', unit: '$/SF', category: 'Board & Finishes', description: 'Wall & ceiling latex paint coverage' },
  { key: 'flooringPerSf', label: 'Flooring Package (Average)', unit: '$/SF', category: 'Board & Finishes', description: 'Hardwood, LVP, or porcelain tile installation & materials' },
  { key: 'extInsulationPerSf', label: 'Exterior Wall Insulation (R-20+)', unit: '$/SF', category: 'Board & Finishes', description: 'Friction-fit mineral wool or fiberglass batts' },
  { key: 'resilientChannelPerLf', label: 'Resilient Channel (RC-1)', unit: '$/LF', category: 'Board & Finishes', description: 'Sound attenuation channels for ceiling drywall' },

  // 2. Carpentry & Framing
  { key: 'studFramingPerLf', label: 'Wall Stud Framing', unit: '$/LF', category: 'Framing & Carpentry', description: 'Plates, studs, and blocking framing assembly' },
  { key: 'osbSubfloorPerSf', label: 'OSB Subfloor Decking (3/4" T&G)', unit: '$/SF', category: 'Framing & Carpentry', description: 'Glued and ring-shank nailed subfloor panels' },
  { key: 'beamPerLf', label: 'Structural Beams (LVL / PSL)', unit: '$/LF', category: 'Framing & Carpentry', description: 'Engineered multi-ply beam materials & placement' },
  { key: 'postPerUnit', label: 'Support Columns / Posts', unit: '$/Post', category: 'Framing & Carpentry', description: '6x6 timber or steel telepost' },
  { key: 'baseboardPerLf', label: 'Baseboard Trims (4"-5")', unit: '$/LF', category: 'Framing & Carpentry', description: 'Finger-joint primed pine baseboard with miter cuts' },
  { key: 'casingPerLf', label: 'Aperture Casing / Moldings', unit: '$/LF', category: 'Framing & Carpentry', description: 'Door and window perimeter trim moldings' },
  { key: 'stairRiserPerUnit', label: 'Stair Flight Risers', unit: '$/Riser', category: 'Framing & Carpentry', description: 'Tread, riser, stringer, and glue assembly' },

  // 3. Fenestration
  { key: 'windowPerSf', label: 'Standard Vinyl Window', unit: '$/SF', category: 'Openings & Fenestration', description: 'Low-E Argon double-glazed casement/slider window' },
  { key: 'passageDoorPerUnit', label: 'Passage Interior Door (Pre-hung)', unit: '$/Unit', category: 'Openings & Fenestration', description: 'Hollow/solid core door, jamb, and hinges' },
  { key: 'pocketDoorPerUnit', label: 'In-Wall Pocket Door', unit: '$/Unit', category: 'Openings & Fenestration', description: 'Pocket frame cage, track, rollers, and slab' },
  { key: 'exteriorDoorPerUnit', label: 'Exterior Insulated Entry Door', unit: '$/Unit', category: 'Openings & Fenestration', description: 'Fiberglass or steel pre-hung entry system with threshold' },
  { key: 'garageDoorPerBay', label: 'Overhead Garage Bay Door', unit: '$/Bay', category: 'Openings & Fenestration', description: 'Insulated sectional door with tracks, torsion spring & motor' },
  { key: 'doorHardwarePerSet', label: 'Door Lockset & Handleset', unit: '$/Set', category: 'Openings & Fenestration', description: 'Lever handle, latch, strike plate, and privacy lock' },

  // 4. Electrical
  { key: 'switchPerUnit', label: 'Standard Light Switch (Decora)', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Box, romex wire, switch, and coverplate' },
  { key: 'switchDimmer', label: 'Dimmer Switch ($D)', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Variable voltage dimmer control device and wiring' },
  { key: 'switch3Way', label: '3-Way Switch ($3W)', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Dual switch control wiring and devices' },
  { key: 'electricalPanelMain100A', label: 'Main Panel - 100A', unit: '$/Unit', category: 'Electrical & Lighting', description: '100A Service entrance and breaker panel' },
  { key: 'electricalPanelMain200A', label: 'Main Panel - 200A', unit: '$/Unit', category: 'Electrical & Lighting', description: '200A Service entrance and breaker panel' },
  { key: 'electricalPanelMain400A', label: 'Main Panel - 400A', unit: '$/Unit', category: 'Electrical & Lighting', description: '400A Service entrance and breaker panel' },
  { key: 'electricalPanelSub60A', label: 'Subpanel - 60A', unit: '$/Unit', category: 'Electrical & Lighting', description: '60A Distribution subpanel' },
  { key: 'electricalPanelSub100A', label: 'Subpanel - 100A', unit: '$/Unit', category: 'Electrical & Lighting', description: '100A Distribution subpanel' },
  { key: 'electricalPanelSub125A', label: 'Subpanel - 125A', unit: '$/Unit', category: 'Electrical & Lighting', description: '125A Distribution subpanel' },
  { key: 'fixtureSconce', label: 'Wall Sconce / Interior Fixture', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Decorative wall-mounted fixture' },
  { key: 'exteriorCoachLight', label: 'Exterior Coach Light', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Exterior-rated decorative fixture' },
  { key: 'soffitLight', label: 'Exterior Soffit / Eaves Light', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Recessed soffit potlight' },
  { key: 'outletPerUnit', label: '120V Standard Duplex Outlet', unit: '$/Unit', category: 'Electrical & Lighting', description: '15A/20A tamper-resistant outlet box and wiring' },
  { key: 'gfciPerUnit', label: 'GFCI Wet Location Outlet', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Bath/kitchen GFCI circuit breaker/receptacle' },
  { key: 'outlet240v', label: '240V Heavy Outlet (Dryer / Range / HVAC)', unit: '$/Unit', category: 'Electrical & Lighting', description: 'High-voltage dedicated circuit for appliances' },
  { key: 'evChargerPerUnit', label: 'EV Level 2 Fast Charger', unit: '$/Unit', category: 'Electrical & Lighting', description: '50A breaker, 6/3 wire run, and Wallbox/NEMA 14-50 outlet' },
  { key: 'potlightPerUnit', label: 'Slim LED Potlight / Sconce', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Recessed canless LED with junction box' },
  { key: 'ceilingFanPerUnit', label: 'Ceiling Fan & Light Combo', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Heavy-duty ceiling box and fan assembly' },
  { key: 'exhaustFanPerUnit', label: 'Bathroom Exhaust Fan', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Quiet CFM fan and 4" ductwork to roof/wall cap' },
  { key: 'rangeHoodPerUnit', label: 'Kitchen Range Hood Vent', unit: '$/Unit', category: 'Electrical & Lighting', description: '6" rigid duct, damper, and hood unit' },
  { key: 'smokeAlarmPerUnit', label: 'Hardwired Smoke & CO Alarm', unit: '$/Unit', category: 'Electrical & Lighting', description: 'Interconnected 120V with battery backup' },

  // 5. Plumbing & Civil
  { key: 'plumbingPerFixture', label: 'Plumbing Fixture Rough-in & Trim', unit: '$/Fixture', category: 'Plumbing & Mechanical', description: 'Toilet, vanity sink, shower valve, or tub waste & vent rough-in' },
  { key: 'waterHeaterPerUnit', label: 'Water Heater / Boiler System', unit: '$/Unit', category: 'Plumbing & Mechanical', description: 'Tank or tankless heater installation and connections' },
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
  masterRates,
  onSaveMasterRates,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [localRates, setLocalRates] = useState<UnitCostRates>(rates || DEFAULT_UNIT_COST_RATES);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [globalLaborMultiplier, setGlobalLaborMultiplier] = useState<string>('0');
  const [globalMaterialMultiplier, setGlobalMaterialMultiplier] = useState<string>('0');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    if (rates && isOpen) {
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
    const field = RATE_FIELDS.find((f) => f.key === fieldKey);
    const category = field?.category || 'Unknown';
    
    setLocalRates((prev) => {
      const currentRate = prev[fieldKey] || DEFAULT_UNIT_COST_RATES[fieldKey];
      return {
        ...prev,
        [fieldKey]: {
          ...currentRate,
          [type]: Math.max(0, value),
        },
        categoryLastUpdated: {
          ...(prev.categoryLastUpdated || {}),
          [category]: new Date().toISOString(),
        },
      };
    });
  };

  const handleResetToDefaults = () => {
    setLocalRates(JSON.parse(JSON.stringify(DEFAULT_UNIT_COST_RATES)));
  };

  const handleApplyMultipliers = () => {
    const matMul = 1 + (parseFloat(globalMaterialMultiplier) || 0) / 100;
    const labMul = 1 + (parseFloat(globalLaborMultiplier) || 0) / 100;

    const updated = { ...localRates };
    const affectedCategories = new Set<string>();

    for (const field of RATE_FIELDS) {
      if (selectedCategory !== 'All Categories' && field.category !== selectedCategory) continue;
      
      const current = updated[field.key] || DEFAULT_UNIT_COST_RATES[field.key];
      const mat = current?.material ?? DEFAULT_UNIT_COST_RATES[field.key].material;
      const lab = current?.labor ?? DEFAULT_UNIT_COST_RATES[field.key].labor;
      updated[field.key] = {
        material: Math.round(mat * matMul * 100) / 100,
        labor: Math.round(lab * labMul * 100) / 100,
      };
      affectedCategories.add(field.category);
    }

    const newCategoryLastUpdated = { ...(updated.categoryLastUpdated || {}) };
    const now = new Date().toISOString();
    affectedCategories.forEach(cat => {
      newCategoryLastUpdated[cat] = now;
    });
    updated.categoryLastUpdated = newCategoryLastUpdated;

    setLocalRates(updated);
    setGlobalLaborMultiplier('0');
    setGlobalMaterialMultiplier('0');
  };

  const handleSyncWithMaster = async () => {
    try {
      const masterRates = await getPersistedRateProfile();
      if (masterRates) {
        setLocalRates(masterRates as UnitCostRates);
        setSyncStatus('Rates updated to master profile!');
        setTimeout(() => setSyncStatus(null), 3000);
      } else {
        setSyncStatus('No master rates found.');
        setTimeout(() => setSyncStatus(null), 3000);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncStatus('Sync failed.');
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const handleSaveAsMaster = async () => {
    try {
      await savePersistedRateProfile(localRates);
      onSaveMasterRates(localRates); // Update global masterRates in App.tsx
      onSaveRates(localRates); // ALSO update active project rates in App.tsx
      setSyncStatus('Saved as Master & Applied to Project!');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error('Save master failed:', err);
      setSyncStatus('Save failed.');
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const handleSave = () => {
    onSaveRates(localRates);
    onClose();
  };

  const handleExportCSV = () => {
    const headers = ['Category', 'Item', 'Unit', 'Material Rate', 'Labor Rate', 'Total Rate'];
    const rows = filteredFields.map((field) => {
      const rateItem = localRates[field.key] || DEFAULT_UNIT_COST_RATES[field.key];
      const material = rateItem?.material ?? DEFAULT_UNIT_COST_RATES[field.key].material;
      const labor = rateItem?.labor ?? DEFAULT_UNIT_COST_RATES[field.key].labor;
      const total = material + labor;
      return [
        field.category,
        field.label,
        field.unit,
        `$${material.toFixed(2)}`,
        `$${labor.toFixed(2)}`,
        `$${total.toFixed(2)}`,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${val}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    const categoryName = selectedCategory.toLowerCase().replace(/\s+/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `rates_${categoryName}_${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const date = new Date().toISOString().split('T')[0];
    const rows = filteredFields
      .map((field) => {
        const defaultRate = DEFAULT_UNIT_COST_RATES[field.key];
        const rateItem = localRates[field.key] || defaultRate;
        const material = rateItem?.material ?? defaultRate.material;
        const labor = rateItem?.labor ?? defaultRate.labor;
        const total = material + labor;
        return `
        <tr>
          <td>${field.label}</td>
          <td>${field.unit}</td>
          <td>$${material.toFixed(2)}</td>
          <td>$${labor.toFixed(2)}</td>
          <td><strong>$${total.toFixed(2)}</strong></td>
        </tr>
      `;
      })
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Pricing Rate Sheet: ${selectedCategory}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            h1 { color: #1e293b; margin-bottom: 5px; }
            p { color: #64748b; margin-bottom: 30px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f8fafc; text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
            tr:nth-child(even) { background-color: #f1f5f9; }
            .total { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Pricing Rate Sheet: ${selectedCategory}</h1>
          <p>Generated on ${date}</p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Unit</th>
                <th>Material</th>
                <th>Labor</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const lines = content.split('\n');
      if (lines.length < 2) return;

      const updated = { ...localRates };
      let updatedCount = 0;
      const updatedCategories = new Set<string>();

      // Simple CSV parser that handles quoted values
      const parseCSVLine = (line: string) => {
        const result = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuote = !inQuote;
          } else if (char === ',' && !inQuote) {
            result.push(cur);
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur);
        return result;
      };

      const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
      const categoryIdx = headers.indexOf('category');
      const itemIdx = headers.indexOf('item');
      const materialIdx = headers.indexOf('material rate');
      const laborIdx = headers.indexOf('labor rate');

      if (itemIdx === -1 || materialIdx === -1 || laborIdx === -1) {
        setSyncStatus('Invalid CSV format. Missing required columns.');
        setTimeout(() => setSyncStatus(null), 3000);
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cells = parseCSVLine(line);
        const itemName = cells[itemIdx]?.trim();
        const categoryName = categoryIdx !== -1 ? cells[categoryIdx]?.trim() : '';
        const materialStr = cells[materialIdx]?.trim().replace(/[$,]/g, '') || '0';
        const laborStr = cells[laborIdx]?.trim().replace(/[$,]/g, '') || '0';

        const materialVal = parseFloat(materialStr) || 0;
        const laborVal = parseFloat(laborStr) || 0;

        // Find matching field
        const field = RATE_FIELDS.find(f => 
          f.label === itemName && (categoryIdx === -1 || f.category === categoryName)
        );

        if (field) {
          updated[field.key] = {
            material: materialVal,
            labor: laborVal
          };
          updatedCount++;
          updatedCategories.add(field.category);
        }
      }

      const newCategoryLastUpdated = { ...(updated.categoryLastUpdated || {}) };
      const now = new Date().toISOString();
      updatedCategories.forEach(cat => {
        newCategoryLastUpdated[cat] = now;
      });
      updated.categoryLastUpdated = newCategoryLastUpdated;

      setLocalRates(updated);
      setSyncStatus(`Successfully updated ${updatedCount} rates!`);
      setTimeout(() => setSyncStatus(null), 3000);

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const filteredFields =
    selectedCategory === 'All Categories'
      ? RATE_FIELDS
      : RATE_FIELDS.filter((f) => f.category === selectedCategory);

  const activeCategoryTimestamp =
    selectedCategory !== 'All Categories'
      ? localRates.categoryLastUpdated?.[selectedCategory]
      : null;

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
          <div className="flex flex-col gap-2">
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
            {selectedCategory !== 'All Categories' && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400 font-semibold">{selectedCategory} —</span>
                {activeCategoryTimestamp ? (
                  <span className="text-sky-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Last Updated: {new Date(activeCategoryTimestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    }).replace(',', ' at')}
                  </span>
                ) : (
                  <span className="text-slate-500 italic">Last Updated: Standard Defaults</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-sky-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportCSV}
              accept=".csv"
              className="hidden"
            />
            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
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
                  const defaultRate = DEFAULT_UNIT_COST_RATES[field.key];
                  const rateItem: CostRateItem =
                    localRates[field.key] || defaultRate;
                  const material = rateItem?.material ?? defaultRate.material;
                  const labor = rateItem?.labor ?? defaultRate.labor;
                  const total = material + labor;

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
                            value={material}
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
                            value={labor}
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
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Project rates are isolated to this plan.</span>
            </div>
            {syncStatus && (
              <span className="text-[10px] text-emerald-400 font-bold animate-pulse uppercase tracking-wider">
                {syncStatus}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncWithMaster}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
              title="Pull master rates from database into this project"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Master</span>
            </button>
            <button
              onClick={handleSaveAsMaster}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
              title="Save these current rates as the new global master template"
            >
              <Star className="w-3.5 h-3.5" />
              <span>Save as Master</span>
            </button>
            <div className="w-px h-6 bg-slate-800 mx-1" />
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
              <span>Apply to Project</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
