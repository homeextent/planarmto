import type {ActiveTool} from '../../types';
import type {FoundationEntity,Point} from './measurementTypes';
import {extendedStrip} from './foundationGeometry';
import {rectanglePoints} from '../precisionDrafting';
export const foundationTools = [
 ['foundation_wall','Foundation wall'],['foundation_strip','Strip footing'],['foundation_pad','Pad footing'],['foundation_slab','Slab'],
 ['foundation_trench','Trench excavation'],['foundation_excavation','Area excavation'],['foundation_backfill','Backfill'],['foundation_granular','Granular'],
 ['foundation_insulation','Horizontal insulation'],['foundation_vertical_insulation','Vertical insulation'],['foundation_waterproofing','Waterproofing'],['foundation_drainage','Drainage']
] as const;
export const foundationArea=(tool:ActiveTool)=>['foundation_pad','foundation_slab','foundation_excavation','foundation_backfill','foundation_granular','foundation_insulation'].includes(tool);
export const foundationPoints=(e:FoundationEntity)=>'polygon' in e?e.polygon:[e.start,e.end];
export function createFoundationDraft(tool:ActiveTool,start:Point,end:Point,id:string,polygon?:Point[]):FoundationEntity {
 if(!foundationTools.some(([t])=>t===tool))throw Error('Choose a foundation drawing tool');
 if(!polygon&&Math.hypot(end.x-start.x,end.y-start.y)<=1e-8)throw Error('Choose distinct drafting points');
 const base={id,physicalId:id,assemblyId:id,source:{reference:'Manual foundation draft'}};
 if(tool==='foundation_wall'||tool==='foundation_strip'||tool==='foundation_trench')return {...base,kind:tool==='foundation_wall'?'foundationWall':tool==='foundation_strip'?'stripFooting':'foundationTrench',start,end,widthFt:null,heightFt:null,elevationFt:null};
 if(foundationArea(tool))return {...base,kind:tool==='foundation_pad'?'padFooting':tool==='foundation_slab'?'slab':'foundationRegion',polygon:polygon??rectanglePoints(start,end),depthFt:null,elevationFt:null,purpose:tool==='foundation_excavation'?'excavation':tool==='foundation_backfill'?'backfill':tool==='foundation_granular'?'granular':tool==='foundation_insulation'?'insulation':'concrete'};
 return {...base,kind:'foundationLine',start,end,purpose:tool==='foundation_drainage'?'drainage':tool==='foundation_waterproofing'?'waterproofing':'insulation'};
}

/** Only render a physical footprint when the centreline and width have been confirmed.
 * Unsupported strips retain their source line instead of presenting fictitious boundaries.
 */
export function foundationFootprint(e:FoundationEntity):Point[]|null{
 if('polygon' in e)return e.polygon;
 if(!('widthFt' in e)||e.widthFt===null||!e.foundation?.centrelineConfirmed)return null;
 try{const b=extendedStrip(e.start,e.end,e.widthFt,e.foundation.joinStartFt,e.foundation.joinEndFt);return [{x:b.xmin,y:b.ymin},{x:b.xmax,y:b.ymin},{x:b.xmax,y:b.ymax},{x:b.xmin,y:b.ymax}]}catch{return null}
}
