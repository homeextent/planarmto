export const foundationMaterialCatalogue = {
  concrete: [['poured concrete', 'Poured concrete']],
  insulation: [['eps', 'EPS'], ['xps', 'XPS'], ['rigid mineral wool', 'Rigid mineral wool'], ['polyisocyanurate', 'Polyisocyanurate (PIR)']],
  waterproofing: [['liquid-applied dampproofing', 'Liquid-applied dampproofing'], ['liquid-applied waterproofing', 'Liquid-applied waterproofing'], ['sheet waterproofing membrane', 'Sheet waterproofing membrane'], ['polyethylene protection sheet', 'Polyethylene protection sheet'], ['dimpled drainage membrane', 'Dimpled drainage membrane']],
  drainage: [['perforated corrugated drainage pipe', 'Perforated corrugated drainage pipe'], ['perforated rigid pvc drainage pipe', 'Perforated rigid PVC drainage pipe'], ['solid drainage pipe', 'Solid drainage pipe']],
  granular: [['clear crushed stone', 'Clear crushed stone'], ['granular a', 'Granular A'], ['granular b', 'Granular B'], ['sand', 'Sand'], ['pea gravel', 'Pea gravel'], ['approved native backfill', 'Approved native backfill'], ['imported fill', 'Imported fill']],
} as const;

export function drainageCatalogueAttributes(id:string):{pipeMaterial?:string;perforation?:'perforated'|'solid'}{
  if(id==='perforated rigid pvc drainage pipe')return {pipeMaterial:'PVC',perforation:'perforated'};
  if(id==='perforated corrugated drainage pipe')return {perforation:'perforated'};
  if(id==='solid drainage pipe')return {perforation:'solid'};
  return {};
}
