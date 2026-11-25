import React, { useState } from 'react';
import type { FoundationEntity } from '../engine/measurements/measurementTypes';

const catalogue = {
  concrete: [['poured concrete', 'Poured concrete']],
  insulation: [['eps', 'EPS'], ['xps', 'XPS'], ['rigid mineral wool', 'Rigid mineral wool'], ['polyisocyanurate', 'Polyisocyanurate (PIR)']],
  waterproofing: [['liquid-applied dampproofing', 'Liquid-applied dampproofing'], ['liquid-applied waterproofing', 'Liquid-applied waterproofing'], ['sheet waterproofing membrane', 'Sheet waterproofing membrane'], ['polyethylene protection sheet', 'Polyethylene protection sheet'], ['dimpled drainage membrane', 'Dimpled drainage membrane']],
  drainage: [['perforated corrugated drainage pipe', 'Perforated corrugated drainage pipe'], ['perforated rigid pvc drainage pipe', 'Perforated rigid PVC drainage pipe'], ['solid drainage pipe', 'Solid drainage pipe']],
  granular: [['clear crushed stone', 'Clear crushed stone'], ['granular a', 'Granular A'], ['granular b', 'Granular B'], ['sand', 'Sand'], ['pea gravel', 'Pea gravel'], ['approved native backfill', 'Approved native backfill'], ['imported fill', 'Imported fill']],
} as const;

type Category = keyof typeof catalogue;

export function foundationMaterialCategory(entity: FoundationEntity): Category | undefined {
  if (entity.kind === 'foundationLine') return entity.purpose;
  if (entity.kind === 'foundationTrench') return undefined;
  if (entity.kind === 'foundationRegion') {
    if (entity.purpose === 'excavation') return undefined;
    if (entity.purpose === 'granular' || entity.purpose === 'backfill') return 'granular';
    if (entity.purpose === 'insulation') return 'insulation';
  }
  return 'concrete';
}

export function FoundationMaterialInput({ label, category, value, onChange, className }: {
  key?: string;
  label: string;
  category: Category;
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const [custom, setCustom] = useState(false);
  const options: readonly (readonly [string, string])[] = catalogue[category];
  const known = options.some(([id]) => id === value);
  const selected = custom ? 'other' : known || !value ? value : 'saved';

  return <>
    <label className="block">{label}
      <select aria-label={label} className={className} value={selected} onChange={event => {
        const choice = event.target.value;
        setCustom(choice === 'other');
        onChange(choice === 'other' ? '' : choice);
      }}>
        <option value="">Select material</option>
        {value && !known && !custom && <option value="saved" disabled>Saved material · {value}</option>}
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        {category !== 'concrete' && <option value="other">Other — Specify</option>}
      </select>
    </label>
    {custom && <label className="block">Material description
      <input aria-label="Material description" className={className} value={value} required onChange={event => onChange(event.target.value)}/>
    </label>}
  </>;
}
