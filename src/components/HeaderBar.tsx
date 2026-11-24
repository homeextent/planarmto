import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { FloorplanState, ProjectSettings, UnitSystem, SelectionState } from '../types';
import {
  createBlankProject,
  createModernTwoBedroomRancher,
  createStudioSuite,
  createGarageWorkshop,
} from '../engine/samplePlans';
import { hydrateSettingsWithBranding } from '../utils/storage';
import {
  DraftingCompass,
  RotateCcw,
  RotateCw,
  FolderOpen,
  Save,
  Trash2,
  HelpCircle,
  Settings,
  Grid,
  Magnet,
  Compass,
  Layers,
  ChevronDown,
  Printer,
  Palette,
  SlidersHorizontal,
  HardDrive,
  Image as ImageIcon,
  FileCode,
  Plus,
  LogIn,
} from 'lucide-react';

import type { BlueprintPdf } from '../utils/pdfUnderlayImporter';
const PdfSheetPickerModal = lazy(() => import('./PdfSheetPickerModal').then(m => ({ default: m.PdfSheetPickerModal })));

interface HeaderBarProps {
  state: FloorplanState;
  onChange: (newState: FloorplanState) => void;
  canUndo: boolean;
  canRedo: boolean;
  isDirty?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onOpenSettingsModal: () => void;
  onOpenRateModal?: () => void;
  onOpenHelpModal: () => void;
  onOpenPrintModal?: () => void;
  onOpenProjectDirectoryModal?: () => void;
  onNewProject?: () => void;
  onSelectUnderlay?: () => void;
  selection: SelectionState;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  state,
  onChange,
  canUndo,
  canRedo,
  isDirty,
  onUndo,
  onRedo,
  onSave,
  onSaveAs,
  onOpenSettingsModal,
  onOpenRateModal,
  onOpenHelpModal,
  onOpenPrintModal,
  onOpenProjectDirectoryModal,
  onNewProject,
  onSelectUnderlay,
  selection,
}) => {
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  const latestState = useRef(state);
  latestState.current = state;
  const request = useRef(0);
  const [pdfImport, setPdfImport] = useState<{ pdf: BlueprintPdf; filename: string; origin: FloorplanState } | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfNotice, setPdfNotice] = useState('');
  const pdfRef = useRef<BlueprintPdf | null>(null);
  useEffect(() => () => { request.current++; void pdfRef.current?.destroy(); }, []);
  const cancelPdf = () => {
    request.current++;
    void pdfRef.current?.destroy();
    pdfRef.current = null;
    setPdfImport(null); setPdfBusy(false); setPdfError('');
  };
  const importPage = async (pdf: BlueprintPdf, filename: string, origin: FloorplanState, page: number, edge: number, token: number) => {
    setPdfBusy(true); setPdfError(''); setPdfNotice('');
    try {
      const { renderBlueprintPage } = await import('../utils/pdfUnderlayImporter');
      const result = await renderBlueprintPage(pdf, page, edge, 850_000, () => token === request.current);
      if (token !== request.current) return;
      if (latestState.current !== origin) throw new Error('Project changed during import. Cancel and import again.');
      // PDF underlays store the raster once; legacy image imports remain unchanged.
      const next: FloorplanState = { ...origin, underlay: {
        src: result.src, worldX: 0, worldY: 0,
        feetPerPixel: 50 / result.width, opacity: .7, isLocked: false, isVisible: true,
        pdfSource: { filename, page, width: result.width, height: result.height },
      }};
      const encoded = JSON.stringify(next);
      if (encoded.length > 2_000_000) throw new Error('Project exceeds the conservative import storage budget. Try a lower resolution.');
      const probe = '__planarmto_pdf_import_probe__';
      try { localStorage.setItem(probe, encoded); } catch { throw new Error('Insufficient local storage for this blueprint. Free storage or try a lower resolution.'); }
      finally { localStorage.removeItem(probe); }
      onChange(next);
      cancelPdf();
      setPdfNotice('PDF page ' + page + ' imported at ' + result.width + ' × ' + result.height + ' px' + (Math.max(result.width, result.height) < edge - 1 ? ' (optimized to fit storage or pixel limits).' : '.'));
    } catch (err) {
      if (token === request.current) setPdfError(err instanceof Error ? err.message : 'Unable to render PDF.');
    } finally { if (token === request.current) setPdfBusy(false); }
  };

  const handleUnitToggle = (unit: UnitSystem) => {
    onChange({
      ...state,
      settings: {
        ...state.settings,
        unitSystem: unit,
      },
    });
  };

  const handleSettingChange = <K extends keyof ProjectSettings>(
    key: K,
    value: ProjectSettings[K]
  ) => {
    onChange({
      ...state,
      settings: {
        ...state.settings,
        [key]: value,
      },
    });
  };

  const handleLoadTemplate = async (templateName: string) => {
    setTemplateMenuOpen(false);
    let baseState: FloorplanState;
    if (templateName === 'rancher') {
      baseState = createModernTwoBedroomRancher();
    } else if (templateName === 'studio') {
      baseState = createStudioSuite();
    } else if (templateName === 'garage') {
      baseState = createGarageWorkshop();
    } else {
      baseState = createBlankProject();
    }

    const hydratedSettings = await hydrateSettingsWithBranding(
      baseState.settings,
      templateName === 'blank'
        ? `PRJ-${new Date().getFullYear()}-MTO-${Math.floor(100 + Math.random() * 900)}`
        : undefined
    );

    onChange({
      ...baseState,
      settings: hydratedSettings,
    });
  };

  const handleSaveJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${state.activeProjectName || 'Project'}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleLoadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.nodes && parsed.walls) {
          onChange(parsed);
        }
      } catch (err) {
        console.error('Failed to parse floorplan JSON', err);
      }
    };
    reader.readAsText(file);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      cancelPdf();
      setPdfNotice('');
      const token = request.current;
      const origin = latestState.current;
      setPdfBusy(true);
      try {
        const { openBlueprintPdf } = await import('../utils/pdfUnderlayImporter');
        const pdf = await openBlueprintPdf(file);
        if (token !== request.current) { await pdf.destroy(); return; }
        pdfRef.current = pdf;
        if (pdf.numPages === 1) {
          await importPage(pdf, file.name, origin, 1, 5000, token);
          if (token === request.current) setPdfImport({ pdf, filename: file.name, origin });
        } else setPdfImport({ pdf, filename: file.name, origin });
      } catch (err) {
        if (token === request.current) setPdfError(err instanceof Error ? err.message : 'Unable to open PDF.');
      } finally { if (token === request.current) setPdfBusy(false); }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // ONLY run when user uploads a new file from file picker:
        const defaultFpp = 50 / img.naturalWidth;
        onChange({
          ...state,
          underlay: {
            src,
            url: src,
            worldX: 0,
            worldY: 0,
            feetPerPixel: defaultFpp,
            opacity: 0.7,
            isLocked: false,
            isVisible: true,
          },
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  return (
    <header className="h-14 bg-slate-900/95 border-b border-slate-800 px-4 flex items-center justify-between select-none shrink-0 z-30">
      {/* App Branding & Project Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {state.settings.companyBranding?.logoUrl ? (
            <div className="h-9 max-w-[120px] flex items-center justify-center rounded-lg bg-slate-950 p-1 border border-slate-800 shadow-md">
              <img
                src={state.settings.companyBranding.logoUrl}
                alt="Company Logo"
                className="max-h-full max-w-full object-contain rounded"
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-md shadow-sky-950">
              <DraftingCompass className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white font-sans truncate max-w-[180px]">
                {state.settings.companyBranding?.companyName || 'PlanarMTO'}
              </span>
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-sky-950 border border-sky-600/40 text-sky-400 rounded">
                CAD Engine
              </span>
            </div>
            <p className="text-[10px] text-slate-400 -mt-0.5">
              2D Material Take-Off & Estimator
            </p>
          </div>
        </div>

        <div className="h-8 w-[1px] bg-slate-800 mx-2" />

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Active Project</span>
            {isDirty && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved Changes"></span>}
          </div>
          <span className="text-sm font-semibold text-slate-100 truncate max-w-[200px]">
            {state.activeProjectName || 'Untitled Project'}{isDirty ? '*' : ''}
          </span>
        </div>
      </div>

      {/* Center Drafting Settings & Toggles */}
      <div className="flex items-center gap-2 text-xs">
        {/* Save Controls */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 mr-2">
          {onNewProject && (
            <button
              onClick={onNewProject}
              className="px-3 py-1 text-emerald-400 hover:text-emerald-300 rounded-md flex items-center gap-1.5 text-[11px] font-bold transition-colors cursor-pointer"
              title="Start New Project"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          )}
          <button
            onClick={onSave}
            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-md flex items-center gap-1.5 text-[11px] font-bold transition-colors cursor-pointer shadow-sm shadow-sky-950"
            title="Quick Save (Ctrl+S)"
          >
            <Save className="w-3 h-3" />
            <span>Save</span>
          </button>
          <button
            onClick={onSaveAs}
            className="px-3 py-1 text-slate-400 hover:text-white rounded-md flex items-center gap-1.5 text-[11px] font-bold transition-colors cursor-pointer"
            title="Save As (Ctrl+Shift+S)"
          >
            <FileCode className="w-3 h-3" />
            <span>Save As</span>
          </button>
        </div>

        {/* Templates Selector */}
        <div className="relative">
          <button
            onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors border border-slate-700/60"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Templates</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {templateMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 text-xs">
              <button
                onClick={() => handleLoadTemplate('rancher')}
                className="w-full px-3 py-2 text-left hover:bg-slate-800 text-slate-200 flex flex-col cursor-pointer"
              >
                <span className="font-semibold text-sky-400">2-Bedroom Rancher</span>
                <span className="text-[10px] text-slate-400">40'x24' Full Suite w/ Deck</span>
              </button>
              <button
                onClick={() => handleLoadTemplate('studio')}
                className="w-full px-3 py-2 text-left hover:bg-slate-800 text-slate-200 flex flex-col cursor-pointer"
              >
                <span className="font-semibold text-emerald-400">Studio Living Suite</span>
                <span className="text-[10px] text-slate-400">24'x20' Compact Studio + Bath</span>
              </button>
              <button
                onClick={() => handleLoadTemplate('garage')}
                className="w-full px-3 py-2 text-left hover:bg-slate-800 text-slate-200 flex flex-col cursor-pointer"
              >
                <span className="font-semibold text-amber-400">2-Bay Garage & Workshop</span>
                <span className="text-[10px] text-slate-400">24'x28' Slab & Heavy 240V</span>
              </button>
              <div className="border-t border-slate-800 my-1" />
              <button
                onClick={() => handleLoadTemplate('blank')}
                className="w-full px-3 py-1.5 text-left hover:bg-red-950/40 text-red-300 flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear / Blank Canvas</span>
              </button>
            </div>
          )}
        </div>

        {/* Blueprint Underlay Import */}
        <label
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors border border-slate-700/60"
          title="Import Blueprint / Floor Plan Image or PDF"
        >
          <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
          <span>Import Blueprint</span>
          <input
            type="file"
            accept=".png, .jpg, .jpeg, .webp, .svg, .pdf, application/pdf"
            disabled={pdfBusy || !!pdfImport}
            onChange={handleImageUpload}
            className="hidden"
          />
        </label>
        
        {pdfBusy && !pdfImport && <button onClick={cancelPdf} className="text-xs text-sky-300">Processing PDF… Cancel</button>}
        {pdfNotice && <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-sky-600 bg-slate-900 text-sky-100 px-4 py-3 text-sm shadow-xl flex items-center gap-4">{pdfNotice}<button onClick={() => setPdfNotice('')} aria-label="Dismiss import notification">Dismiss</button></div>}
        {pdfError && !pdfImport && <span role="alert" className="text-xs text-red-300">{pdfError}</span>}
        {pdfImport && <Suspense fallback={<span>Loading sheet picker…</span>}>
          <PdfSheetPickerModal pdf={pdfImport.pdf} filename={pdfImport.filename} busy={pdfBusy} error={pdfError}
            onCancel={cancelPdf} onSelect={(page, edge) => void importPage(pdfImport.pdf, pdfImport.filename, pdfImport.origin, page, edge, request.current)} />
        </Suspense>}
        {state.underlay && (
          <button
            onClick={onSelectUnderlay}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors border ${
              selection.type === 'underlay'
                ? 'bg-sky-950/80 border-sky-500 text-sky-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700/60'
            }`}
            title="Open Blueprint Underlay Settings"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
            <span>Blueprint Options</span>
          </button>
        )}

        {/* Unit Selector */}
        <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex items-center">
          <button
            onClick={() => handleUnitToggle('imperial')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
              state.settings.unitSystem === 'imperial'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Imperial (ft/in)
          </button>
          <button
            onClick={() => handleUnitToggle('metric')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
              state.settings.unitSystem === 'metric'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Metric (m)
          </button>
        </div>

        {/* Ortho Lock Toggle */}
        <button
          onClick={() => handleSettingChange('orthoMode', !state.settings.orthoMode)}
          className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors ${
            state.settings.orthoMode
              ? 'bg-sky-950/80 border-sky-500 text-sky-300'
              : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-700'
          }`}
          title="Ortho Mode (Lock 90° angles)"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Ortho 90°</span>
        </button>

        {/* Theme Selector */}
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
          <Palette className="w-3 h-3 text-slate-400" />
          <select
            value={state.settings.theme || 'dark'}
            onChange={(e) => handleSettingChange('theme', e.target.value as any)}
            className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-slate-100"
          >
            <option value="dark" style={{ color: '#1E293B', backgroundColor: '#FFFFFF' }}>Dark CAD</option>
            <option value="light" style={{ color: '#1E293B', backgroundColor: '#FFFFFF' }}>Light Print</option>
            <option value="blueprint" style={{ color: '#1E293B', backgroundColor: '#FFFFFF' }}>Blueprint</option>
          </select>
        </div>
      </div>

      {/* Right Controls (Undo/Redo, JSON Save/Load, Print, Help) */}
      <div className="flex items-center gap-1.5 text-xs">
        {typeof window !== 'undefined' && window.planarMTOConfig && window.planarMTOConfig.currentUserId === 0 && window.planarMTOConfig.loginUrl && (
          <a
            href={window.planarMTOConfig.loginUrl}
            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer mr-1"
            title="Sign in with your WordPress account to enable Cloud sync"
          >
            <LogIn className="w-3.5 h-3.5 text-amber-400" />
            <span>Guest Mode &bull; Sign In</span>
          </a>
        )}

        {onOpenProjectDirectoryModal && (
          <button
            onClick={onOpenProjectDirectoryModal}
            className="px-2.5 py-1 bg-slate-800 hover:bg-sky-600 hover:text-white border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="In-App Project Directory & Local Storage Manager"
          >
            <HardDrive className="w-3.5 h-3.5 text-sky-400" />
            <span>Projects</span>
          </button>
        )}

        <button
          onClick={() => (onOpenPrintModal ? onOpenPrintModal() : window.print())}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="Print Floorplan & MTO Report (Ctrl+P)"
        >
          <Printer className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            canUndo
              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              : 'bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            canRedo
              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              : 'bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Y)"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-5 bg-slate-800 mx-1" />

        <button
          onClick={onOpenSettingsModal}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 hover:text-sky-300 rounded-lg transition-colors cursor-pointer"
          title="Global Project & Engine Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {onOpenRateModal && (
          <button
            onClick={onOpenRateModal}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 hover:text-amber-300 rounded-lg transition-colors cursor-pointer"
            title="Project Unit Rates (Cost Model)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={handleSaveJson}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="Save Project JSON"
        >
          <Save className="w-3.5 h-3.5" />
        </button>

        <label
          className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="Import JSON Project"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <input
            type="file"
            accept=".json"
            onChange={handleLoadJson}
            className="hidden"
          />
        </label>

        <button
          onClick={onOpenHelpModal}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 rounded-lg transition-colors cursor-pointer ml-1"
          title="Quick Guide & Math Legend"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
