import React from 'react';
import { X, CheckCircle2, ShieldAlert, Cpu, Calculator, Compass } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-sky-400" />
            <h2 className="font-bold text-base text-white">
              PlanarMTO CAD Engine & Deductions Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs leading-relaxed text-slate-300">
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-sky-400 flex items-center gap-1.5 text-sm">
              <Calculator className="w-4 h-4" />
              Topological Wall Graph (PSLG) Model
            </h3>
            <p>
              Walls are stored as a Planar Straight-Line Graph with connected Nodes and directed Half-Edges.
              When closed wall cycles are detected, they automatically form bounded interior Room Faces without duplicate counting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <span className="font-bold text-emerald-400 text-xs block">
                Exterior Wall (1 adjacent room)
              </span>
              <ul className="list-disc list-inside text-slate-400 space-y-1 text-[11px]">
                <li><strong className="text-slate-200">Framing:</strong> 1 line sequence (LF)</li>
                <li><strong className="text-slate-200">Drywall:</strong> 1 interior face (Gross - Apertures)</li>
                <li><strong className="text-slate-200">Siding & Insulation:</strong> 1 exterior face (Gross - Apertures)</li>
                <li><strong className="text-slate-200">Door Casing:</strong> 2 sides (Interior trim + Exterior brickmould)</li>
              </ul>
            </div>

            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <span className="font-bold text-sky-400 text-xs block">
                Shared Interior Wall (2 adjacent rooms)
              </span>
              <ul className="list-disc list-inside text-slate-400 space-y-1 text-[11px]">
                <li><strong className="text-slate-200">Framing:</strong> 1 line sequence (DO NOT DOUBLE COUNT)</li>
                <li><strong className="text-slate-200">Drywall:</strong> 2 interior faces (Gross × 2 - Deductions)</li>
                <li><strong className="text-slate-200">Siding / Insulation:</strong> 0 (unless sound batt enabled)</li>
                <li><strong className="text-slate-200">Door Casing:</strong> 2 sides (Double-sided casing)</li>
              </ul>
            </div>
          </div>

          <div className="space-y-2 bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-[11px]">
            <h4 className="font-bold text-amber-400 text-xs uppercase tracking-wider">
              Exact Deduction Formulas Applied in Real-Time
            </h4>
            <div className="space-y-1 font-mono text-slate-300">
              <div>• <span className="text-sky-400">Net Drywall SF</span> = (Active Faces × Wall Length × Wall Height) - (Aperture W × H × Active Faces) + Room Ceilings</div>
              <div>• <span className="text-sky-400">Baseboard LF</span> = (Room Perimeter) - (Sum of Door Widths along the floor)</div>
              <div>• <span className="text-sky-400">Window Casing LF</span> = 2 × (Width + Height) per window</div>
              <div>• <span className="text-sky-400">Door Casing LF</span> = (Width + 2 × Height) × (Casing Sides: 1 or 2)</div>
              <div>• <span className="text-sky-400">Roofing SQ</span> = (Floorplan Footprint + Overhang Area) × √(1 + (Pitch/12)²) ÷ 100</div>
              <div>• <span className="text-sky-400">Poured Concrete CY</span> = Footprint Area × (Slab Thickness / 12) ÷ 27 + Exterior Footings</div>
            </div>
          </div>

          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="font-bold text-slate-200 text-xs block">Shortcuts & Navigation:</span>
            <div className="grid grid-cols-2 gap-2">
              <div>• <kbd className="px-1 py-0.5 bg-slate-800 rounded text-sky-400">Esc</kbd> : Cancel draft / Deselect</div>
              <div>• <kbd className="px-1 py-0.5 bg-slate-800 rounded text-sky-400">Del / Backspace</kbd> : Delete selected</div>
              <div>• <kbd className="px-1 py-0.5 bg-slate-800 rounded text-sky-400">Middle Mouse / Shift+Drag</kbd> : Pan canvas</div>
              <div>• <kbd className="px-1 py-0.5 bg-slate-800 rounded text-sky-400">Mouse Wheel</kbd> : Smooth zoom</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
