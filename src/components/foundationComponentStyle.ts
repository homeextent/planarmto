import type {FoundationEntity} from '../engine/measurements/measurementTypes';

export const foundationColor = {
  wall:'#38bdf8', footing:'#fbbf24', slab:'#94a3b8', waterproofing:'#c084fc',
  insulation:'#2dd4bf', drainage:'#fb923c', granular:'#a8a29e',
};

export function foundationStroke(entity:FoundationEntity):string{
  if(entity.kind==='stripFooting'||entity.kind==='padFooting')return foundationColor.footing;
  if(entity.kind==='slab')return foundationColor.slab;
  if('purpose' in entity&&entity.purpose in foundationColor)
    return foundationColor[entity.purpose as keyof typeof foundationColor];
  return foundationColor.wall;
}
