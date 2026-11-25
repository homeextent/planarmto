import type {ActiveTool} from '../../types';
import type {FoundationEntity,Point} from './measurementTypes';
import {extendedStrip,foundationRectangle,type RectangleReference,type Bounds} from './foundationGeometry';
import {polygonDraftError} from './roofMeasurements';
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
 if(polygon){const error=polygonDraftError(polygon);if(error)throw Error(error);}
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

/** An explicit perimeter; four members share a physical reconciliation assembly. */
export function generateFoundationPerimeter(bounds:Bounds,reference:RectangleReference,widthFt:number,heightFt:number,baseFt:number|null,id:()=>string):FoundationEntity[]{
 if(!Number.isFinite(heightFt)||heightFt<=0||baseFt!==null&&!Number.isFinite(baseFt))throw Error('Specify positive wall height and valid base elevation');
 const rectangle=foundationRectangle(bounds,widthFt,reference),assemblyId=id();
 return rectangle.segments.map(segment=>{const entityId=id();return {id:entityId,physicalId:entityId,assemblyId,source:{reference:'Generated rectangular foundation — '+reference+' reference'},kind:'foundationWall',start:segment.start,end:segment.end,widthFt,heightFt,elevationFt:baseFt,foundation:{version:1,material:'poured concrete',centrelineConfirmed:true,...(baseFt!==null?{baseElevationConfirmed:true as const}:{}),joinStartFt:segment.joinStartFt,joinEndFt:segment.joinEndFt}}});
}

/** Plan overlays are informational; openings above the base do not erase the wall footprint. */
export function foundationDetailOutlines(e:FoundationEntity):{id:string;kind:'opening'|'thickening';points:Point[]}[]{
 const f=e.foundation;if(!f)return [];
 if(e.kind==='slab')return [...(f.slabOpenings??[]).map(o=>({id:o.id,kind:'opening' as const,points:o.polygon})),...(f.slabThickenings??[]).map(o=>({id:o.id,kind:'thickening' as const,points:o.polygon}))];
 if(e.kind!=='foundationWall'||!('widthFt' in e)||e.widthFt===null||!f.centrelineConfirmed)return [];
 const l=Math.hypot(e.end.x-e.start.x,e.end.y-e.start.y);if(l<=1e-8)return [];
 const ux=(e.end.x-e.start.x)/l,uy=(e.end.y-e.start.y)/l,t=e.widthFt/2;
 return (f.wallOpenings??[]).map(o=>{const a={x:e.start.x+ux*o.offsetFt,y:e.start.y+uy*o.offsetFt},b={x:a.x+ux*o.widthFt,y:a.y+uy*o.widthFt};return {id:o.id,kind:'opening',points:[{x:a.x-uy*t,y:a.y+ux*t},{x:b.x-uy*t,y:b.y+ux*t},{x:b.x+uy*t,y:b.y-ux*t},{x:a.x+uy*t,y:a.y-ux*t}]};});
}
