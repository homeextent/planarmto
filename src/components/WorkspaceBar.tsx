import React, { useState } from 'react';
import type { ProjectDocument, WorkspaceType } from '../engine/projectDocument';

const types: WorkspaceType[] = ['floor', 'roof', 'foundation', 'site'];
const labels: Record<WorkspaceType,string> = { floor: 'Floor', roof: 'Roof', foundation: 'Foundation', site: 'Site' };
interface Props {
  document: ProjectDocument;
  onSelect: (id: string) => void;
  onAdd: (name: string, type: WorkspaceType) => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
}
export function WorkspaceBar({ document, onSelect, onAdd, onRename, onMove, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<WorkspaceType>('floor');
  const [name, setName] = useState('');
  const active = document.workspaces.find(w => w.id === document.activeWorkspaceId)!;
  const index = document.workspaces.indexOf(active);
  return <section aria-label="Project workspaces" className="shrink-0 bg-slate-900 border-b border-slate-700 px-3 py-2 text-xs">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-slate-400 font-semibold">Workspaces</span>
      <div role="group" aria-label="Select workspace" className="flex gap-1 flex-wrap">
        {document.workspaces.map(w => <button key={w.id} type="button" aria-pressed={w.id === active.id}
          onClick={() => onSelect(w.id)} className={'rounded px-3 py-1.5 border ' + (w.id === active.id ? 'bg-sky-900 border-sky-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300')}>
          {w.name} <span className="opacity-65">· {labels[w.type]}</span>
        </button>)}
      </div>
      <button type="button" className="px-2 py-1.5 bg-slate-800 rounded" onClick={() => setAdding(!adding)}>+ Add workspace</button>
      <button type="button" className="px-2 py-1" onClick={() => { const next = window.prompt('Workspace name', active.name); if (next?.trim()) onRename(active.id, next); }}>Rename</button>
      <button type="button" aria-label="Move workspace left" disabled={index === 0} className="px-2 disabled:opacity-30" onClick={() => onMove(active.id,-1)}>←</button>
      <button type="button" aria-label="Move workspace right" disabled={index === document.workspaces.length-1} className="px-2 disabled:opacity-30" onClick={() => onMove(active.id,1)}>→</button>
      <button type="button" disabled={document.workspaces.length === 1} className="px-2 text-red-300 disabled:opacity-30" onClick={() => { if (window.confirm('Delete "' + active.name + '" and its blueprint and geometry? This cannot be undone.')) onDelete(active.id); }}>Delete</button>
    </div>
    {adding && <form className="flex flex-wrap items-center gap-2 mt-2" onSubmit={e => { e.preventDefault(); if (!name.trim()) return; onAdd(name.trim(), type); setAdding(false); setName(''); }}>
      <label>Type <select aria-label="Workspace type" className="bg-slate-800 p-1 rounded" value={type} onChange={e => setType(e.target.value as WorkspaceType)}>
        {types.map(t => <option key={t} value={t}>{labels[t]}</option>)}
      </select></label>
      <input aria-label="New workspace name" className="bg-slate-800 border border-slate-600 rounded p-1" placeholder="Workspace name" required value={name} onChange={e => setName(e.target.value)}/>
      <button type="submit" className="bg-sky-700 rounded px-3 py-1">Create</button>
      <button type="button" onClick={() => setAdding(false)}>Cancel</button>
    </form>}
  </section>;
}
