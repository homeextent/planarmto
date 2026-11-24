import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BlueprintPdf, renderBlueprintPage } from '../utils/pdfUnderlayImporter';

export function PdfSheetPickerModal({ pdf, filename, onSelect, onCancel, busy, error }: {
  pdf: BlueprintPdf; filename: string; onSelect: (page: number, edge: number) => void;
  onCancel: () => void; busy: boolean; error: string;
}) {
  const [page, setPage] = useState(1);
  const [edge, setEdge] = useState(5000);
  const [batch, setBatch] = useState(0);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const start = batch * 12 + 1;
  const end = Math.min(start + 11, pdf.numPages);
  useEffect(() => {
    let stopped = false;
    setPreviews({});
    void (async () => {
      for (let n = start; n <= end && !stopped; n++) {
        try {
          const result = await renderBlueprintPage(pdf, n, 320, 120000);
          if (!stopped) setPreviews(prev => ({ ...prev, [n]: result.src }));
        } catch { if (!stopped) setPreviews(prev => ({ ...prev, [n]: '' })); }
      }
    })();
    return () => { stopped = true; };
  }, [pdf, start, end]);
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
      <section role="dialog" aria-modal="true" aria-label="Import PDF blueprint" className="bg-slate-900 text-slate-100 rounded-xl border border-slate-700 w-full max-w-3xl p-5 space-y-4 max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-semibold">Import PDF Blueprint</h2>
        <p className="text-sm text-slate-300">{filename} · {pdf.numPages} pages</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(n =>
            <button key={n} disabled={busy} onClick={() => setPage(n)} aria-pressed={page === n} className={'p-2 rounded border ' + (page === n ? 'border-sky-400 bg-sky-950' : 'border-slate-700')}>
              <div className="h-28 flex items-center justify-center bg-slate-800">
                {previews[n] ? <img src={previews[n]} alt={'Preview of page ' + n} className="max-h-full max-w-full object-contain" /> : <span className="text-xs">{previews[n] === '' ? 'Preview unavailable' : 'Loading preview…'}</span>}
              </div>
              <span>Page {n}</span>
            </button>)}
        </div>
        <div className="flex items-center justify-between text-sm">
          <button disabled={busy || batch === 0} onClick={() => setBatch(b => b - 1)}>Previous pages</button>
          <span>{start}–{end} of {pdf.numPages}</span>
          <button disabled={busy || end === pdf.numPages} onClick={() => setBatch(b => b + 1)}>Next pages</button>
        </div>
        <label className="flex gap-3 items-center">Resolution
          <select disabled={busy} value={edge} onChange={e => setEdge(Number(e.target.value))} className="bg-slate-800 p-2 rounded">
            <option value={3400}>Standard — 3400 px</option><option value={5000}>High — 5000 px</option><option value={6000}>Maximum — 6000 px</option>
          </select>
        </label>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        <div className="flex justify-end gap-4">
          <button onClick={onCancel}>Cancel</button>
          <button disabled={busy} className="bg-sky-700 rounded px-4 py-2" onClick={() => onSelect(page, edge)}>{busy ? 'Rendering…' : 'Import page ' + page}</button>
        </div>
      </section>
    </div>, document.body);
}
